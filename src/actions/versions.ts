"use server";

import { createServerClient } from "@/lib/supabase/server";
import { requireProjectEditor, requireProjectMember } from "@/lib/auth-helpers";
import { remapSections } from "@/lib/highlightRemapper";
import type { ParsedSection } from "@/lib/sectionParser";
import type { Section, VersionSnapshot, ScriptVersion } from "@/lib/supabase/types";

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

  // Fetch current sections and their sticky notes so the notes can be
  // carried over to the restored sections (notes aren't versioned — they
  // live outside the script's history and should survive reverts)
  const { data: oldSectionData } = await supabase
    .from("sections")
    .select()
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });

  const oldSections: Section[] = oldSectionData || [];
  const oldSectionIds = oldSections.map((s) => s.id);

  let oldNotes: { id: string; section_id: string }[] = [];
  if (oldSectionIds.length > 0) {
    const { data: noteData } = await supabase
      .from("notes")
      .select("id, section_id")
      .in("section_id", oldSectionIds);
    oldNotes = (noteData || []) as { id: string; section_id: string }[];
  }

  // Restore sections from snapshot — insert alongside the old ones so
  // notes can be re-pointed before the old sections are deleted
  if (snapshot.sections.length === 0) {
    const { error: deleteError } = await supabase
      .from("sections")
      .delete()
      .eq("project_id", projectId);

    if (deleteError) {
      throw new Error(`Failed to clear sections: ${deleteError.message}`);
    }
    return;
  }

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

  // Re-point sticky notes at the restored sections so they survive the
  // cascade delete of the old ones
  if (oldNotes.length > 0 && insertedSections && insertedSections.length > 0) {
    // Build ParsedSection-shaped entries for the restored script so the
    // section remapper can diff old text against restored text
    let offset = 0;
    const restoredParsed: ParsedSection[] = snapshot.sections.map((s, i) => {
      const parsed = {
        title: s.title,
        body: s.body,
        section_type: s.section_type,
        sourceOffset: offset,
      };
      offset += s.body.length;
      if (i < snapshot.sections.length - 1) offset += 2; // "\n\n" separator
      return parsed;
    });
    const restoredFullText = snapshot.sections.map((s) => s.body).join("\n\n");

    const sectionMap = new Map(
      remapSections(oldSections, restoredFullText, restoredParsed).map((r) => [
        r.oldSectionId,
        r.newSectionIndex,
      ])
    );

    await Promise.all(
      oldNotes
        .filter((n) => sectionMap.has(n.section_id))
        .map((n) =>
          supabase
            .from("notes")
            .update({
              section_id: insertedSections[sectionMap.get(n.section_id)!].id,
            })
            .eq("id", n.id)
        )
    );
  }

  // Delete the old sections (cascade cleans up old highlights and any
  // notes that couldn't be remapped)
  if (oldSectionIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("sections")
      .delete()
      .in("id", oldSectionIds);

    if (deleteError) {
      throw new Error(`Failed to clear sections: ${deleteError.message}`);
    }
  }

  // Touch updated_at
  await supabase
    .from("projects")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", projectId);
}
