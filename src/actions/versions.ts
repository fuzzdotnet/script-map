"use server";

import { createServerClient } from "@/lib/supabase/server";
import { requireProjectEditor, requireProjectMember } from "@/lib/auth-helpers";
import type { VersionSnapshot, ScriptVersion } from "@/lib/supabase/types";

const MAX_VERSIONS_PER_PROJECT = 50;

/**
 * Create a snapshot of the current script state (sections + highlights).
 * Called automatically before edits and reverts.
 */
export async function createSnapshot(
  projectId: string,
  label: string,
  userId?: string
): Promise<void> {
  const supabase = createServerClient();

  // Fetch sections
  const { data: sections } = await supabase
    .from("sections")
    .select()
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });

  if (!sections || sections.length === 0) return;

  // Fetch highlights for these sections
  const sectionIds = sections.map((s) => s.id);
  const { data: highlights } = await supabase
    .from("highlights")
    .select()
    .in("section_id", sectionIds);

  // Build section index lookup
  const sectionIndexMap = new Map<string, number>();
  sections.forEach((s, i) => sectionIndexMap.set(s.id, i));

  // Build snapshot
  const snapshot: VersionSnapshot = {
    sections: sections.map((s) => ({
      title: s.title,
      body: s.body,
      section_type: s.section_type,
      sort_order: s.sort_order,
    })),
    highlights: (highlights || [])
      .filter((h) => sectionIndexMap.has(h.section_id))
      .map((h) => ({
        section_index: sectionIndexMap.get(h.section_id)!,
        start_offset: h.start_offset,
        end_offset: h.end_offset,
        label: h.label,
        color: h.color,
        note: h.note,
        group_id: h.group_id,
        filmed: h.filmed,
        collaborator_id: h.collaborator_id,
        created_by: h.created_by,
      })),
  };

  // Compute next version number
  const { data: maxRow } = await supabase
    .from("script_versions")
    .select("version_number")
    .eq("project_id", projectId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (maxRow?.version_number ?? 0) + 1;

  // Insert snapshot
  const { error } = await supabase.from("script_versions").insert({
    project_id: projectId,
    version_number: nextVersion,
    label,
    snapshot,
    created_by: userId || null,
  });

  if (error) {
    console.error("Failed to create version snapshot:", error.message);
    // Don't throw — snapshot failure shouldn't block the edit
    return;
  }

  // Cleanup: keep only the most recent MAX_VERSIONS_PER_PROJECT
  const { data: allVersions } = await supabase
    .from("script_versions")
    .select("id")
    .eq("project_id", projectId)
    .order("version_number", { ascending: false });

  if (allVersions && allVersions.length > MAX_VERSIONS_PER_PROJECT) {
    const idsToDelete = allVersions
      .slice(MAX_VERSIONS_PER_PROJECT)
      .map((v) => v.id);
    await supabase
      .from("script_versions")
      .delete()
      .in("id", idsToDelete);
  }
}

/**
 * List all versions for a project (without the snapshot payload).
 */
export async function listVersions(
  projectId: string
): Promise<Omit<ScriptVersion, "snapshot">[]> {
  await requireProjectMember(projectId);
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("script_versions")
    .select("id, project_id, version_number, label, created_by, created_at")
    .eq("project_id", projectId)
    .order("version_number", { ascending: false });

  if (error) throw new Error(`Failed to list versions: ${error.message}`);
  return (data || []) as Omit<ScriptVersion, "snapshot">[];
}

/**
 * Revert the project to a previous version.
 * Snapshots the current state first so the revert is undoable.
 */
export async function revertToVersion(
  projectId: string,
  versionId: string
): Promise<void> {
  const user = await requireProjectEditor(projectId);
  const supabase = createServerClient();

  // Fetch the target version
  const { data: version, error: fetchError } = await supabase
    .from("script_versions")
    .select()
    .eq("id", versionId)
    .eq("project_id", projectId)
    .single();

  if (fetchError || !version) {
    throw new Error("Version not found");
  }

  const snapshot = version.snapshot as VersionSnapshot;

  // Snapshot current state before reverting (so it's undoable)
  await createSnapshot(
    projectId,
    `Before revert to v${version.version_number}`,
    user.id
  );

  // Delete all current sections (CASCADE handles highlights etc.)
  const { error: deleteError } = await supabase
    .from("sections")
    .delete()
    .eq("project_id", projectId);

  if (deleteError) {
    throw new Error(`Failed to clear sections: ${deleteError.message}`);
  }

  // Restore sections from snapshot
  if (snapshot.sections.length === 0) return;

  const sectionRows = snapshot.sections.map((s, index) => ({
    project_id: projectId,
    title: s.title,
    body: s.body,
    section_type: s.section_type,
    sort_order: index,
  }));

  const { data: insertedSections, error: sectionError } = await supabase
    .from("sections")
    .insert(sectionRows)
    .select("id, sort_order")
    .order("sort_order", { ascending: true });

  if (sectionError) {
    throw new Error(`Failed to restore sections: ${sectionError.message}`);
  }

  // Restore highlights from snapshot
  if (snapshot.highlights.length > 0 && insertedSections) {
    const highlightRows = snapshot.highlights
      .filter((h) => h.section_index < insertedSections.length)
      .map((h) => ({
        section_id: insertedSections[h.section_index].id,
        start_offset: h.start_offset,
        end_offset: h.end_offset,
        label: h.label,
        color: h.color,
        note: h.note,
        group_id: h.group_id,
        filmed: h.filmed,
        collaborator_id: h.collaborator_id,
        created_by: h.created_by,
      }));

    if (highlightRows.length > 0) {
      const { error: hlError } = await supabase
        .from("highlights")
        .insert(highlightRows);

      if (hlError) {
        throw new Error(`Failed to restore highlights: ${hlError.message}`);
      }
    }
  }

  // Touch updated_at
  await supabase
    .from("projects")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", projectId);
}
