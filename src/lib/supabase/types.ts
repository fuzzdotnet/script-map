export interface ProjectSettings {
  coverageColors?: {
    media?: string;
    graphics?: string;
    on_camera?: string;
  };
}

export interface Project {
  id: string;
  title: string;
  share_token: string;
  owner_id: string | null;
  settings?: ProjectSettings;
  created_at: string;
  updated_at: string;
}

export interface Section {
  id: string;
  project_id: string;
  title: string | null;
  body: string;
  section_type: "act" | "scene" | "paragraph" | "heading";
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Collaborator {
  id: string;
  project_id: string;
  display_name: string;
  color: string;
  created_at: string;
}

export interface Highlight {
  id: string;
  section_id: string;
  collaborator_id: string | null;
  created_by: string | null;
  start_offset: number;
  end_offset: number;
  label: string | null;
  color: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface MediaFile {
  id: string;
  project_id: string;
  uploaded_by: string | null;
  storage_path: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  duration_secs: number | null;
  thumbnail_path: string | null;
  upload_status: "uploading" | "complete" | "failed";
  created_at: string;
}

export interface FileReference {
  id: string;
  project_id: string;
  created_by: string | null;
  filename: string;
  location: string | null;
  description: string | null;
  file_type: "video" | "image" | "audio" | "other";
  created_at: string;
}

export interface HighlightMedia {
  id: string;
  highlight_id: string;
  media_file_id: string | null;
  file_reference_id: string | null;
  sort_order: number;
  note: string | null;
  created_at: string;
}

export interface SectionMedia {
  id: string;
  section_id: string;
  media_file_id: string | null;
  file_reference_id: string | null;
  added_by: string | null;
  sort_order: number;
  is_preferred: boolean;
  note: string | null;
  created_at: string;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string | null;
  invited_email: string;
  role: "viewer" | "editor";
  created_at: string;
}

export interface Note {
  id: string;
  project_id: string;
  highlight_id: string | null;
  section_id: string | null;
  collaborator_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  display_name: string;
  created_at: string;
  updated_at: string;
}

export interface HighlightComment {
  id: string;
  highlight_id: string;
  user_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}
