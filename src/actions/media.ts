"use server";

import { createServerClient } from "@/lib/supabase/server";
import { requireProjectEditor } from "@/lib/auth-helpers";
import type {
  MediaFile,
  FileReference,
  HighlightMedia,
  SectionMedia,
} from "@/lib/supabase/types";

// ============================================
// LOOKUP HELPERS (for auth checks)
// ============================================

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

async function getProjectIdForHighlightMedia(hmId: string): Promise<string> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("highlight_media")
    .select("highlight_id")
    .eq("id", hmId)
    .single();
  if (!data) throw new Error("Highlight media not found");
  return getProjectIdForHighlight(data.highlight_id);
}

async function getProjectIdForSectionMedia(smId: string): Promise<string> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("section_media")
    .select("section_id")
    .eq("id", smId)
    .single();
  if (!data) throw new Error("Section media not found");
  return getProjectIdForSection(data.section_id);
}

// ============================================
// MEDIA FILE UPLOADS
// ============================================

export async function createMediaFileRecord(params: {
  projectId: string;
  storagePath: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  collaboratorId?: string;
}): Promise<MediaFile> {
  await requireProjectEditor(params.projectId);
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("media_files")
    .insert({
      project_id: params.projectId,
      storage_path: params.storagePath,
      filename: params.filename,
      mime_type: params.mimeType,
      size_bytes: params.sizeBytes,
      uploaded_by: params.collaboratorId || null,
      upload_status: "complete",
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create media record: ${error.message}`);
  return data;
}

export async function getSignedUrl(
  storagePath: string,
  options?: { width?: number; height?: number }
): Promise<string> {
  const supabase = createServerClient();

  const transform = options ? { width: options.width, height: options.height, resize: "contain" as const } : undefined;

  const { data, error } = await supabase.storage
    .from("script-map-media")
    .createSignedUrl(storagePath, 3600, { transform });

  if (error) throw new Error(`Failed to create signed URL: ${error.message}`);
  return data.signedUrl;
}

export async function getMediaFilesForProject(projectId: string): Promise<MediaFile[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("media_files")
    .select()
    .eq("project_id", projectId)
    .eq("upload_status", "complete");

  if (error) throw new Error(`Failed to fetch media files: ${error.message}`);
  return data;
}

export async function getSignedUrlsForProject(
  projectId: string
): Promise<{ filename: string; url: string; sizeBytes: number }[]> {
  const supabase = createServerClient();

  const { data: files, error } = await supabase
    .from("media_files")
    .select("filename, storage_path, size_bytes")
    .eq("project_id", projectId)
    .eq("upload_status", "complete");

  if (error) throw new Error(`Failed to fetch media files: ${error.message}`);
  if (!files || files.length === 0) return [];

  const paths = files.map((f) => f.storage_path);
  const { data: urlData, error: urlError } = await supabase.storage
    .from("script-map-media")
    .createSignedUrls(paths, 3600);

  if (urlError) throw new Error(`Failed to create signed URLs: ${urlError.message}`);

  return files.map((file, index) => ({
    filename: file.filename,
    url: urlData[index]?.signedUrl ?? "",
    sizeBytes: file.size_bytes,
  }));
}

// ============================================
// FILE REFERENCES
// ============================================

export async function createFileReference(params: {
  projectId: string;
  filename: string;
  location?: string;
  description?: string;
  fileType?: string;
  collaboratorId?: string;
}): Promise<FileReference> {
  await requireProjectEditor(params.projectId);
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("file_references")
    .insert({
      project_id: params.projectId,
      filename: params.filename,
      location: params.location || null,
      description: params.description || null,
      file_type: params.fileType || "other",
      created_by: params.collaboratorId || null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create file reference: ${error.message}`);
  return data;
}

export async function getFileReferencesForProject(projectId: string): Promise<FileReference[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("file_references")
    .select()
    .eq("project_id", projectId);

  if (error) throw new Error(`Failed to fetch file references: ${error.message}`);
  return data;
}

// ============================================
// HIGHLIGHT MEDIA (attach media to highlights)
// ============================================

export async function attachMediaToHighlight(params: {
  highlightId: string;
  mediaFileId?: string;
  fileReferenceId?: string;
  note?: string;
}): Promise<HighlightMedia> {
  const projectId = await getProjectIdForHighlight(params.highlightId);
  await requireProjectEditor(projectId);

  const supabase = createServerClient();

  // Get current max sort order
  const { data: existing } = await supabase
    .from("highlight_media")
    .select("sort_order")
    .eq("highlight_id", params.highlightId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

  const { data, error } = await supabase
    .from("highlight_media")
    .insert({
      highlight_id: params.highlightId,
      media_file_id: params.mediaFileId || null,
      file_reference_id: params.fileReferenceId || null,
      sort_order: nextOrder,
      note: params.note || null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to attach media: ${error.message}`);
  return data;
}

export async function getHighlightMediaForProject(projectId: string): Promise<HighlightMedia[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("highlight_media")
    .select(`
      *,
      highlights!inner(
        section_id,
        sections!inner(project_id)
      )
    `)
    .eq("highlights.sections.project_id", projectId);

  if (error) throw new Error(`Failed to fetch highlight media: ${error.message}`);
  return data.map(({ highlights, ...hm }) => hm);
}

// ============================================
// SECTION MEDIA (attach media to sections)
// ============================================

export async function attachMediaToSection(params: {
  sectionId: string;
  mediaFileId?: string;
  fileReferenceId?: string;
  note?: string;
  collaboratorId?: string;
}): Promise<SectionMedia> {
  const projectId = await getProjectIdForSection(params.sectionId);
  await requireProjectEditor(projectId);

  const supabase = createServerClient();

  const { data: existing } = await supabase
    .from("section_media")
    .select("sort_order")
    .eq("section_id", params.sectionId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

  const { data, error } = await supabase
    .from("section_media")
    .insert({
      section_id: params.sectionId,
      media_file_id: params.mediaFileId || null,
      file_reference_id: params.fileReferenceId || null,
      added_by: params.collaboratorId || null,
      sort_order: nextOrder,
      note: params.note || null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to attach media to section: ${error.message}`);
  return data;
}

export async function getSectionMediaForProject(projectId: string): Promise<SectionMedia[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("section_media")
    .select(`
      *,
      sections!inner(project_id)
    `)
    .eq("sections.project_id", projectId);

  if (error) throw new Error(`Failed to fetch section media: ${error.message}`);
  return data.map(({ sections, ...sm }) => sm);
}

// ============================================
// REMOVE MEDIA FROM ANNOTATIONS
// ============================================

export async function removeHighlightMedia(id: string) {
  const projectId = await getProjectIdForHighlightMedia(id);
  await requireProjectEditor(projectId);

  const supabase = createServerClient();
  const { error } = await supabase
    .from("highlight_media")
    .delete()
    .eq("id", id);
  if (error) throw new Error(`Failed to remove highlight media: ${error.message}`);
}

export async function removeSectionMedia(id: string) {
  const projectId = await getProjectIdForSectionMedia(id);
  await requireProjectEditor(projectId);

  const supabase = createServerClient();
  const { error } = await supabase
    .from("section_media")
    .delete()
    .eq("id", id);
  if (error) throw new Error(`Failed to remove section media: ${error.message}`);
}

export async function deleteMediaFile(id: string, storagePath: string) {
  const supabase = createServerClient();

  // Look up the project for this media file
  const { data: mf } = await supabase
    .from("media_files")
    .select("project_id")
    .eq("id", id)
    .single();
  if (!mf) throw new Error("Media file not found");
  await requireProjectEditor(mf.project_id);

  // Delete from storage
  await supabase.storage.from("script-map-media").remove([storagePath]);

  // Delete DB record (cascades to highlight_media / section_media)
  const { error } = await supabase
    .from("media_files")
    .delete()
    .eq("id", id);
  if (error) throw new Error(`Failed to delete media file: ${error.message}`);
}

export async function deleteFileReference(id: string) {
  const supabase = createServerClient();

  // Look up the project for this file reference
  const { data: fr } = await supabase
    .from("file_references")
    .select("project_id")
    .eq("id", id)
    .single();
  if (!fr) throw new Error("File reference not found");
  await requireProjectEditor(fr.project_id);

  // Cascades to highlight_media / section_media
  const { error } = await supabase
    .from("file_references")
    .delete()
    .eq("id", id);
  if (error) throw new Error(`Failed to delete file reference: ${error.message}`);
}

// ============================================
// UPLOAD HELPERS
// ============================================

export async function uploadMediaFile(formData: FormData): Promise<{
  mediaFile: MediaFile;
  signedUrl: string;
}> {
  const file = formData.get("file") as File;
  const projectId = formData.get("projectId") as string;

  if (!file || !projectId) throw new Error("Missing file or projectId");

  await requireProjectEditor(projectId);

  const supabase = createServerClient();

  // Convert File to Buffer for reliable server-side upload
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const fileId = crypto.randomUUID();
  const storagePath = `${projectId}/originals/${fileId}/${file.name}`;

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from("script-map-media")
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("Storage upload error:", uploadError);
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  // Create the database record (auth already checked above, call internal helper)
  const { data, error } = await supabase
    .from("media_files")
    .insert({
      project_id: projectId,
      storage_path: storagePath,
      filename: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      uploaded_by: null,
      upload_status: "complete",
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create media record: ${error.message}`);

  // Get a signed URL for immediate use
  const signedUrl = await getSignedUrl(storagePath);

  return { mediaFile: data, signedUrl };
}
