import { NextResponse, type NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { createServerClient } from "@/lib/supabase/server";
import { parseScriptText } from "@/lib/sectionParser";

/**
 * POST /api/import — machine-to-machine script ingestion.
 *
 * Lets an external tool (Scripty / script-machine) create a Script Liner
 * project without a browser session. Authenticated with a shared secret:
 *
 *   Authorization: Bearer <SCRIPTLINER_IMPORT_TOKEN>
 *
 * Body (JSON):
 *   {
 *     "title":      "Episode title",
 *     "scriptText": "Full script text (split into sections like /new)",
 *     "ownerEmail": "who@example.com",   // optional — defaults to SCRIPTLINER_IMPORT_OWNER_EMAIL
 *     "source":     { "app": "scripty", "scriptId": 123, "url": "https://..." }  // optional provenance
 *   }
 *
 * Response: { projectId, shareToken, url }
 *
 * The project is created exactly like the /new form does (same section
 * parser), owned by the resolved user so it shows on their dashboard. The
 * caller's provenance is stored on projects.settings.source.
 */

export const runtime = "nodejs";

const MAX_SCRIPT_CHARS = 2_000_000;

interface ImportBody {
  title?: unknown;
  scriptText?: unknown;
  ownerEmail?: unknown;
  source?: unknown;
}

function unauthorized(message: string) {
  return NextResponse.json({ error: message }, { status: 401 });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function resolveOwnerId(email: string): Promise<string | null> {
  const supabase = createServerClient();
  const target = email.trim().toLowerCase();
  // Single-team app: the user list is small, so a paginated scan is fine.
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`Failed to look up owner: ${error.message}`);
    const hit = data.users.find((u) => (u.email || "").toLowerCase() === target);
    if (hit) return hit.id;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

export async function POST(request: NextRequest) {
  const expected = process.env.SCRIPTLINER_IMPORT_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: "Import is not enabled on this server (SCRIPTLINER_IMPORT_TOKEN unset)" },
      { status: 503 }
    );
  }

  const header = request.headers.get("authorization") || "";
  const presented = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!presented || !timingSafeEqual(presented, expected)) {
    return unauthorized("Invalid or missing import token");
  }

  let body: ImportBody;
  try {
    body = (await request.json()) as ImportBody;
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const scriptText = typeof body.scriptText === "string" ? body.scriptText : "";
  if (!scriptText.trim()) {
    return NextResponse.json({ error: "scriptText is required" }, { status: 400 });
  }
  if (scriptText.length > MAX_SCRIPT_CHARS) {
    return NextResponse.json({ error: "scriptText is too large" }, { status: 413 });
  }
  const title =
    (typeof body.title === "string" && body.title.trim()) || "Untitled Script";

  const ownerEmail =
    (typeof body.ownerEmail === "string" && body.ownerEmail.trim()) ||
    process.env.SCRIPTLINER_IMPORT_OWNER_EMAIL ||
    "";
  if (!ownerEmail) {
    return NextResponse.json(
      { error: "No owner: pass ownerEmail or set SCRIPTLINER_IMPORT_OWNER_EMAIL" },
      { status: 400 }
    );
  }

  let ownerId: string | null;
  try {
    ownerId = await resolveOwnerId(ownerEmail);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Owner lookup failed" },
      { status: 500 }
    );
  }
  if (!ownerId) {
    return NextResponse.json(
      { error: `No Script Liner account for ${ownerEmail}` },
      { status: 404 }
    );
  }

  const source =
    body.source && typeof body.source === "object" && !Array.isArray(body.source)
      ? (body.source as Record<string, unknown>)
      : undefined;

  const supabase = createServerClient();
  const shareToken = nanoid(12);

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      title: title.slice(0, 500),
      share_token: shareToken,
      owner_id: ownerId,
      settings: source ? { source: { ...source, importedAt: new Date().toISOString() } } : {},
    })
    .select()
    .single();

  if (projectError || !project) {
    return NextResponse.json(
      { error: `Failed to create project: ${projectError?.message ?? "unknown"}` },
      { status: 500 }
    );
  }

  const parsedSections = parseScriptText(scriptText);
  if (parsedSections.length > 0) {
    const { error: sectionsError } = await supabase.from("sections").insert(
      parsedSections.map((section, index) => ({
        project_id: project.id,
        title: section.title,
        body: section.body,
        section_type: section.section_type,
        sort_order: index,
      }))
    );
    if (sectionsError) {
      // Don't leave an empty shell behind.
      await supabase.from("projects").delete().eq("id", project.id);
      return NextResponse.json(
        { error: `Failed to create sections: ${sectionsError.message}` },
        { status: 500 }
      );
    }
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
  return NextResponse.json(
    {
      projectId: project.id,
      shareToken,
      url: `${origin.replace(/\/$/, "")}/p/${shareToken}`,
      sections: parsedSections.length,
    },
    { status: 201 }
  );
}
