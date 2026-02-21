"use server";

import { createServerClient } from "@/lib/supabase/server";
import { requireProjectEditor } from "@/lib/auth-helpers";
import type { Highlight } from "@/lib/supabase/types";

async function getProjectIdForSection(sectionId: string): Promise<string> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("sections")
    .select("project_id")
    .eq("id", sectionId)
    .single();
  if (!data) throw new Error("Section not found");
  return data.project_id;
}

async function getProjectIdForHighlight(highlightId: string): Promise<string> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("highlights")
    .select("section_id")
    .eq("id", highlightId)
    .single();
  if (!data) throw new Error("Highlight not found");
  return getProjectIdForSection(data.section_id);
}

export async function createHighlight(params: {
  sectionId: string;
  startOffset: number;
  endOffset: number;
  label?: string;
  color?: string;
  collaboratorId?: string;
  groupId?: string;
}): Promise<Highlight> {
  const projectId = await getProjectIdForSection(params.sectionId);
  const user = await requireProjectEditor(projectId);

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("highlights")
    .insert({
      section_id: params.sectionId,
      start_offset: params.startOffset,
      end_offset: params.endOffset,
      label: params.label || null,
      color: params.color || null,
      collaborator_id: params.collaboratorId || null,
      created_by: user.id,
      group_id: params.groupId || null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create highlight: ${error.message}`);
  return data;
}

export async function deleteHighlight(highlightId: string) {
  const projectId = await getProjectIdForHighlight(highlightId);
  await requireProjectEditor(projectId);

  const supabase = createServerClient();

  // Check if this highlight belongs to a group — if so, delete all members
  const { data: highlight } = await supabase
    .from("highlights")
    .select("group_id")
    .eq("id", highlightId)
    .single();

  if (highlight?.group_id) {
    const { error } = await supabase
      .from("highlights")
      .delete()
      .eq("group_id", highlight.group_id);
    if (error) throw new Error(`Failed to delete highlight group: ${error.message}`);
  } else {
    const { error } = await supabase
      .from("highlights")
      .delete()
      .eq("id", highlightId);
    if (error) throw new Error(`Failed to delete highlight: ${error.message}`);
  }
}

export async function updateHighlightNote(highlightId: string, note: string | null) {
  const projectId = await getProjectIdForHighlight(highlightId);
  await requireProjectEditor(projectId);

  const supabase = createServerClient();

  const { error } = await supabase
    .from("highlights")
    .update({ note })
    .eq("id", highlightId);

  if (error) throw new Error(`Failed to update highlight note: ${error.message}`);
}

export async function getHighlightsForProject(projectId: string): Promise<Highlight[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("highlights")
    .select(`
      *,
      sections!inner(project_id)
    `)
    .eq("sections.project_id", projectId);

  if (error) throw new Error(`Failed to fetch highlights: ${error.message}`);
  return data.map(({ sections, ...highlight }) => highlight);
}
