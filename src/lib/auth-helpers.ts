import { requireAuth } from "@/lib/supabase/auth";
import { createServerClient } from "@/lib/supabase/server";

/** Verify the current user owns a project. Throws if not authorized. */
export async function requireProjectOwner(projectId: string) {
  const user = await requireAuth();
  const supabase = createServerClient();

  const { data: project } = await supabase
    .from("projects")
    .select("owner_id")
    .eq("id", projectId)
    .single();

  if (!project || project.owner_id !== user.id) {
    throw new Error("Not authorized to modify this project");
  }

  return user;
}

/** Verify the current user is the owner or an editor on a project. */
export async function requireProjectEditor(projectId: string) {
  const user = await requireAuth();
  const supabase = createServerClient();

  // Check ownership first
  const { data: project } = await supabase
    .from("projects")
    .select("owner_id")
    .eq("id", projectId)
    .single();

  if (!project) throw new Error("Project not found");
  if (project.owner_id === user.id) return user;

  // Check editor membership
  const email = user.email?.toLowerCase();
  const { data: member } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .or(`user_id.eq.${user.id}${email ? `,invited_email.eq.${email}` : ""}`)
    .single();

  if (!member || member.role !== "editor") {
    throw new Error("Not authorized to modify this project");
  }

  return user;
}
