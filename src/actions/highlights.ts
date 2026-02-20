"use server";

import { createServerClient } from "@/lib/supabase/server";
import type { Highlight } from "@/lib/supabase/types";

export async function createHighlight(params: {
  sectionId: string;
  startOffset: number;
  endOffset: number;
  label?: string;
  color?: string;
  collaboratorId?: string;
}): Promise<Highlight> {
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
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create highlight: ${error.message}`);
  return data;
}

export async function deleteHighlight(highlightId: string) {
  const supabase = createServerClient();

  const { error } = await supabase
    .from("highlights")
    .delete()
    .eq("id", highlightId);

  if (error) throw new Error(`Failed to delete highlight: ${error.message}`);
}

export async function updateHighlightNote(highlightId: string, note: string | null) {
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
