"use server";

import { createServerClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/supabase/auth";
import { requireProjectMember } from "@/lib/auth-helpers";
import type { HighlightComment } from "@/lib/supabase/types";

async function getProjectIdForHighlight(highlightId: string): Promise<string> {
  const supabase = createServerClient();
  const { data: highlight } = await supabase
    .from("highlights")
    .select("section_id")
    .eq("id", highlightId)
    .single();
  if (!highlight) throw new Error("Highlight not found");

  const { data: section } = await supabase
    .from("sections")
    .select("project_id")
    .eq("id", highlight.section_id)
    .single();
  if (!section) throw new Error("Section not found");

  return section.project_id;
}

export async function addComment(
  highlightId: string,
  body: string
): Promise<HighlightComment> {
  const projectId = await getProjectIdForHighlight(highlightId);
  const user = await requireProjectMember(projectId);

  const trimmed = body.trim();
  if (!trimmed) throw new Error("Comment body is required");

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("highlight_comments")
    .insert({
      highlight_id: highlightId,
      user_id: user.id,
      body: trimmed,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to add comment: ${error.message}`);
  return data;
}

export async function deleteComment(commentId: string) {
  const user = await requireAuth();
  const supabase = createServerClient();

  const { data: comment } = await supabase
    .from("highlight_comments")
    .select("user_id, highlight_id")
    .eq("id", commentId)
    .single();

  if (!comment) throw new Error("Comment not found");

  // Allow deletion if user is the comment author or the project owner
  if (comment.user_id !== user.id) {
    const projectId = await getProjectIdForHighlight(comment.highlight_id);
    const { data: project } = await supabase
      .from("projects")
      .select("owner_id")
      .eq("id", projectId)
      .single();

    if (!project || project.owner_id !== user.id) {
      throw new Error("Not authorized to delete this comment");
    }
  }

  const { error } = await supabase
    .from("highlight_comments")
    .delete()
    .eq("id", commentId);

  if (error) throw new Error(`Failed to delete comment: ${error.message}`);
}

export async function getCommentsForProject(
  projectId: string
): Promise<HighlightComment[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("highlight_comments")
    .select(`
      *,
      highlights!inner(
        section_id,
        sections!inner(project_id)
      )
    `)
    .eq("highlights.sections.project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to fetch comments: ${error.message}`);
  return data.map(({ highlights, ...comment }) => comment);
}
