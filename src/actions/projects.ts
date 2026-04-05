"use server";

import { nanoid } from "nanoid";
import { createServerClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/supabase/auth";
import { requireProjectOwner, requireProjectEditor } from "@/lib/auth-helpers";
import { parseScriptText } from "@/lib/sectionParser";
import { remapHighlights } from "@/lib/highlightRemapper";
import { createSnapshot } from "@/actions/versions";
import type {
  Project,
  Section,
  Highlight,
  HighlightMedia,
  SectionMedia,
  HighlightComment,
} from "@/lib/supabase/types";

export type ProjectRole = "owner" | "editor" | "viewer";

export interface ProjectWithRole extends Project {
  role: ProjectRole;
}

export async function createProject(title: string, scriptText: string) {
  const user = await requireAuth();
  const supabase = createServerClient();
  const shareToken = nanoid(12);

  // Create the project
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({ title, share_token: shareToken, owner_id: user.id })
    .select()
    .single();

  if (projectError) throw new Error(`Failed to create project: ${projectError.message}`);

  // Parse the script into sections
  const parsedSections = parseScriptText(scriptText);

  if (parsedSections.length > 0) {
    const sectionRows = parsedSections.map((section, index) => ({
      project_id: project.id,
      title: section.title,
      body: section.body,
      section_type: section.section_type,
      sort_order: index,
    }));

    const { error: sectionsError } = await supabase
      .from("sections")
      .insert(sectionRows);

    if (sectionsError) throw new Error(`Failed to create sections: ${sectionsError.message}`);
  }

  return { shareToken, projectId: project.id };
}

export async function getProjectByToken(shareToken: string): Promise<Project | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("projects")
    .select()
    .eq("share_token", shareToken)
    .single();

  if (error) return null;
  return data;
}

export async function getProjectSections(projectId: string) {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("sections")
    .select()
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(`Failed to fetch sections: ${error.message}`);
  return data;
}

/**
 * Fetch all project page data in a single Supabase query using nested selects.
 * Replaces 5 separate round-trips (sections, highlights, highlight_media,
 * section_media, comments) with 1.
 */
export async function getProjectPageData(projectId: string): Promise<{
  sections: Section[];
  highlights: Highlight[];
  highlightMedia: HighlightMedia[];
  sectionMedia: SectionMedia[];
  comments: HighlightComment[];
}> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("sections")
    .select(`
      *,
      highlights(
        *,
        highlight_media(*),
        highlight_comments(*)
      ),
      section_media(*)
    `)
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(`Failed to fetch project data: ${error.message}`);

  const sections: Section[] = [];
  const highlights: Highlight[] = [];
  const highlightMedia: HighlightMedia[] = [];
  const sectionMedia: SectionMedia[] = [];
  const comments: HighlightComment[] = [];

  for (const row of data) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { highlights: hlRows, section_media: smRows, ...section } = row as any;
    sections.push(section);

    if (hlRows) {
      for (const hlRow of hlRows) {
        const { highlight_media: hmRows, highlight_comments: hcRows, ...highlight } = hlRow;
        highlights.push(highlight);
        if (hmRows) highlightMedia.push(...hmRows);
        if (hcRows) comments.push(...hcRows);
      }
    }

    if (smRows) sectionMedia.push(...smRows);
  }

  // Nested queries don't guarantee order
  comments.sort((a, b) => a.created_at.localeCompare(b.created_at));

  return { sections, highlights, highlightMedia, sectionMedia, comments };
}

export async function listProjects(): Promise<ProjectWithRole[]> {
  const user = await requireAuth();
  const supabase = createServerClient();
  const email = user.email?.toLowerCase();

  // Check admin status
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (profile?.is_admin) {
    const { data: all, error } = await supabase
      .from("projects")
      .select()
      .order("updated_at", { ascending: false });
    if (error) throw new Error(`Failed to list projects: ${error.message}`);
    return (all || []).map((p) => ({
      ...p,
      role: (p.owner_id === user.id ? "owner" : "editor") as ProjectRole,
    }));
  }

  // 1. Owned projects
  const { data: owned, error: ownedError } = await supabase
    .from("projects")
    .select()
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(20);

  if (ownedError) throw new Error(`Failed to list projects: ${ownedError.message}`);

  const ownedWithRole: ProjectWithRole[] = (owned || []).map((p) => ({
    ...p,
    role: "owner" as const,
  }));

  // 2. Shared projects (via project_members)
  const { data: memberships } = await supabase
    .from("project_members")
    .select("project_id, role")
    .or(`user_id.eq.${user.id}${email ? `,invited_email.eq.${email}` : ""}`);

  if (!memberships || memberships.length === 0) return ownedWithRole;

  // Filter out any we already own
  const ownedIds = new Set(ownedWithRole.map((p) => p.id));
  const sharedMemberships = memberships.filter((m) => !ownedIds.has(m.project_id));

  if (sharedMemberships.length === 0) return ownedWithRole;

  const sharedIds = sharedMemberships.map((m) => m.project_id);
  const { data: sharedProjects } = await supabase
    .from("projects")
    .select()
    .in("id", sharedIds)
    .order("updated_at", { ascending: false });

  if (!sharedProjects) return ownedWithRole;

  const roleMap = new Map(sharedMemberships.map((m) => [m.project_id, m.role]));
  const sharedWithRole: ProjectWithRole[] = sharedProjects.map((p) => ({
    ...p,
    role: (roleMap.get(p.id) || "viewer") as ProjectRole,
  }));

  // Merge and sort by updated_at
  return [...ownedWithRole, ...sharedWithRole].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

export async function deleteProject(projectId: string) {
  await requireProjectOwner(projectId);
  const supabase = createServerClient();

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId);

  if (error) throw new Error(`Failed to delete project: ${error.message}`);
}

export async function getProjectSectionCount(projectId: string): Promise<number> {
  const supabase = createServerClient();

  const { count, error } = await supabase
    .from("sections")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId);

  if (error) return 0;
  return count ?? 0;
}

export async function getProjectHighlightCount(projectId: string): Promise<number> {
  const supabase = createServerClient();

  const { count, error } = await supabase
    .from("highlights")
    .select("*, sections!inner(project_id)", { count: "exact", head: true })
    .eq("sections.project_id", projectId);

  if (error) return 0;
  return count ?? 0;
}

/**
 * Batch-fetch section and highlight counts for multiple projects in 2 queries
 * instead of 2×N.
 */
export async function getProjectStats(
  projectIds: string[]
): Promise<Record<string, { sectionCount: number; highlightCount: number }>> {
  if (projectIds.length === 0) return {};

  const supabase = createServerClient();

  const [sectionsResult, highlightsResult] = await Promise.all([
    supabase
      .from("sections")
      .select("project_id")
      .in("project_id", projectIds),
    supabase
      .from("highlights")
      .select("sections!inner(project_id)")
      .in("sections.project_id", projectIds),
  ]);

  const stats: Record<string, { sectionCount: number; highlightCount: number }> = {};
  for (const id of projectIds) {
    stats[id] = { sectionCount: 0, highlightCount: 0 };
  }

  if (sectionsResult.data) {
    for (const row of sectionsResult.data) {
      stats[row.project_id].sectionCount++;
    }
  }

  if (highlightsResult.data) {
    for (const row of highlightsResult.data) {
      const pid = (row as unknown as { sections: { project_id: string } }).sections.project_id;
      if (stats[pid]) stats[pid].highlightCount++;
    }
  }

  return stats;
}

export async function replaceProjectScript(projectId: string, scriptText: string) {
  const user = await requireProjectEditor(projectId);
  const supabase = createServerClient();

  // 1. Fetch old sections (ordered) and their highlights
  const { data: oldSections } = await supabase
    .from("sections")
    .select()
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });

  const oldSectionList: Section[] = oldSections || [];
  const oldSectionIds = oldSectionList.map((s) => s.id);

  // Reconstruct old full text (same as the edit page does)
  const oldFullText = oldSectionList.map((s) => s.body).join("\n\n");

  // 2. Early return if nothing changed
  if (oldFullText === scriptText) {
    return;
  }

  // 3. Snapshot current state before editing (so it can be reverted)
  await createSnapshot(projectId, "Before script edit", user.id);

  // 4. Parse new script text
  const parsedSections = parseScriptText(scriptText);

  // 4. Try to preserve highlights via diff-based remapping
  try {
    // Fetch highlights for old sections
    let oldHighlights: Highlight[] = [];
    if (oldSectionIds.length > 0) {
      const { data: hlData } = await supabase
        .from("highlights")
        .select()
        .in("section_id", oldSectionIds);
      oldHighlights = hlData || [];
    }

    // Insert new sections alongside old ones
    let insertedSectionIds: string[] = [];
    if (parsedSections.length > 0) {
      const sectionRows = parsedSections.map((section, index) => ({
        project_id: projectId,
        title: section.title,
        body: section.body,
        section_type: section.section_type,
        sort_order: index,
      }));

      const { data: inserted, error: insertError } = await supabase
        .from("sections")
        .insert(sectionRows)
        .select("id, sort_order")
        .order("sort_order", { ascending: true });

      if (insertError) throw new Error(insertError.message);
      insertedSectionIds = (inserted || []).map((s) => s.id);
    }

    // Compute remapping and update surviving highlights
    if (oldHighlights.length > 0 && insertedSectionIds.length > 0) {
      const remapped = remapHighlights(
        oldSectionList,
        oldHighlights,
        scriptText,
        parsedSections
      );

      // Update each surviving highlight to point to its new section
      await Promise.all(
        remapped.map((r) =>
          supabase
            .from("highlights")
            .update({
              section_id: insertedSectionIds[r.newSectionIndex],
              start_offset: r.newStartOffset,
              end_offset: r.newEndOffset,
            })
            .eq("id", r.highlightId)
        )
      );
    }

    // Delete old sections (cascade cleans up un-remapped highlights)
    if (oldSectionIds.length > 0) {
      const { error: deleteError } = await supabase
        .from("sections")
        .delete()
        .in("id", oldSectionIds);

      if (deleteError) throw new Error(deleteError.message);
    }
  } catch (err) {
    // Fallback: delete all old sections and insert fresh (current behavior)
    console.error("Highlight remapping failed, falling back to clean replace:", err);

    const { error: deleteError } = await supabase
      .from("sections")
      .delete()
      .eq("project_id", projectId);

    if (deleteError) throw new Error(`Failed to clear sections: ${deleteError.message}`);

    if (parsedSections.length > 0) {
      const sectionRows = parsedSections.map((section, index) => ({
        project_id: projectId,
        title: section.title,
        body: section.body,
        section_type: section.section_type,
        sort_order: index,
      }));

      const { error: insertError } = await supabase
        .from("sections")
        .insert(sectionRows);

      if (insertError) throw new Error(`Failed to create sections: ${insertError.message}`);
    }
  }

  // Touch updated_at
  await supabase
    .from("projects")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", projectId);
}

export async function updateProjectTitle(projectId: string, title: string) {
  await requireProjectEditor(projectId);
  const supabase = createServerClient();

  const { error } = await supabase
    .from("projects")
    .update({ title })
    .eq("id", projectId);

  if (error) throw new Error(`Failed to update project: ${error.message}`);
}

export async function updateProjectSettings(projectId: string, settings: Record<string, unknown>) {
  await requireProjectOwner(projectId);
  const supabase = createServerClient();

  // Merge with existing settings
  const { data: project } = await supabase
    .from("projects")
    .select("settings")
    .eq("id", projectId)
    .single();

  const merged = { ...(project?.settings || {}), ...settings };

  const { error } = await supabase
    .from("projects")
    .update({ settings: merged })
    .eq("id", projectId);

  if (error) throw new Error(`Failed to update settings: ${error.message}`);
  return merged;
}
