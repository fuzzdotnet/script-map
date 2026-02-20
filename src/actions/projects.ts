"use server";

import { nanoid } from "nanoid";
import { createServerClient } from "@/lib/supabase/server";
import { parseScriptText } from "@/lib/sectionParser";
import type { Project } from "@/lib/supabase/types";

export async function createProject(title: string, scriptText: string) {
  const supabase = createServerClient();
  const shareToken = nanoid(12);

  // Create the project
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({ title, share_token: shareToken })
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

export async function listProjects(): Promise<Project[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("projects")
    .select()
    .order("updated_at", { ascending: false })
    .limit(20);

  if (error) throw new Error(`Failed to list projects: ${error.message}`);
  return data;
}

export async function deleteProject(projectId: string) {
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

export async function replaceProjectScript(projectId: string, scriptText: string) {
  const supabase = createServerClient();

  // Delete existing sections (cascades to highlights, highlight_media, section_media)
  const { error: deleteError } = await supabase
    .from("sections")
    .delete()
    .eq("project_id", projectId);

  if (deleteError) throw new Error(`Failed to clear sections: ${deleteError.message}`);

  // Re-parse and insert new sections
  const parsedSections = parseScriptText(scriptText);

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

  // Touch updated_at
  await supabase
    .from("projects")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", projectId);
}

export async function updateProjectTitle(projectId: string, title: string) {
  const supabase = createServerClient();

  const { error } = await supabase
    .from("projects")
    .update({ title })
    .eq("id", projectId);

  if (error) throw new Error(`Failed to update project: ${error.message}`);
}

export async function updateProjectSettings(projectId: string, settings: Record<string, unknown>) {
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
