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
