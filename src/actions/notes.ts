"use server";

import { createServerClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/supabase/auth";
import { requireProjectMember } from "@/lib/auth-helpers";
import type { Note } from "@/lib/supabase/types";

export async function createStickyNote(
  projectId: string,
  sectionId: string,
  body: string
): Promise<Note> {
  const user = await requireProjectMember(projectId);

  const trimmed = body.trim();
  if (!trimmed) throw new Error("Note body is required");

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("notes")
    .insert({
      project_id: projectId,
      section_id: sectionId,
      highlight_id: null,
      user_id: user.id,
      body: trimmed,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create note: ${error.message}`);
  return data;
}

export async function deleteStickyNote(noteId: string) {
  const user = await requireAuth();
  const supabase = createServerClient();

  const { data: note } = await supabase
    .from("notes")
    .select("user_id, project_id")
    .eq("id", noteId)
    .single();

  if (!note) throw new Error("Note not found");

  // Allow deletion by author or project owner
  if (note.user_id !== user.id) {
    const { data: project } = await supabase
      .from("projects")
      .select("owner_id")
      .eq("id", note.project_id)
      .single();

    if (!project || project.owner_id !== user.id) {
      throw new Error("Not authorized to delete this note");
    }
  }

  const { error } = await supabase
    .from("notes")
    .delete()
    .eq("id", noteId);

  if (error) throw new Error(`Failed to delete note: ${error.message}`);
}

export async function getStickyNotesForProject(
  projectId: string
): Promise<Note[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("project_id", projectId)
    .is("highlight_id", null)
    .not("section_id", "is", null)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to fetch notes: ${error.message}`);
  return data;
}
