-- Script Map Database Schema
-- Run this in your Supabase SQL editor to set up the database

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- PROJECTS
-- ============================================
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT 'Untitled Script',
  share_token TEXT UNIQUE NOT NULL,
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_share_token ON projects(share_token);

-- ============================================
-- SECTIONS (script broken into ordered parts)
-- ============================================
CREATE TABLE sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT,
  body TEXT NOT NULL,
  section_type TEXT NOT NULL DEFAULT 'paragraph',
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sections_project ON sections(project_id, sort_order);

-- ============================================
-- COLLABORATORS (no auth — self-declared identity)
-- ============================================
CREATE TABLE collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_collaborators_project ON collaborators(project_id);

-- ============================================
-- HIGHLIGHTS (text selections within sections)
-- ============================================
CREATE TABLE highlights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  collaborator_id UUID REFERENCES collaborators(id) ON DELETE SET NULL,
  start_offset INTEGER NOT NULL,
  end_offset INTEGER NOT NULL,
  label TEXT,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_range CHECK (end_offset > start_offset)
);

CREATE INDEX idx_highlights_section ON highlights(section_id);

-- ============================================
-- MEDIA FILES (uploaded to Supabase Storage)
-- ============================================
CREATE TABLE media_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES collaborators(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  width INTEGER,
  height INTEGER,
  duration_secs REAL,
  thumbnail_path TEXT,
  upload_status TEXT NOT NULL DEFAULT 'uploading',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_media_project ON media_files(project_id);

-- ============================================
-- FILE REFERENCES (pointers to external files)
-- ============================================
CREATE TABLE file_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by UUID REFERENCES collaborators(id) ON DELETE SET NULL,
  filename TEXT NOT NULL,
  location TEXT,
  description TEXT,
  file_type TEXT DEFAULT 'other',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_file_references_project ON file_references(project_id);

-- ============================================
-- HIGHLIGHT MEDIA (junction: media on highlights)
-- ============================================
CREATE TABLE highlight_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  highlight_id UUID NOT NULL REFERENCES highlights(id) ON DELETE CASCADE,
  media_file_id UUID REFERENCES media_files(id) ON DELETE CASCADE,
  file_reference_id UUID REFERENCES file_references(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT has_attachment CHECK (media_file_id IS NOT NULL OR file_reference_id IS NOT NULL)
);

CREATE INDEX idx_highlight_media_highlight ON highlight_media(highlight_id);

-- ============================================
-- SECTION MEDIA (junction: media on sections)
-- ============================================
CREATE TABLE section_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  media_file_id UUID REFERENCES media_files(id) ON DELETE CASCADE,
  file_reference_id UUID REFERENCES file_references(id) ON DELETE CASCADE,
  added_by UUID REFERENCES collaborators(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_preferred BOOLEAN DEFAULT false,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT has_attachment CHECK (media_file_id IS NOT NULL OR file_reference_id IS NOT NULL)
);

CREATE INDEX idx_section_media_section ON section_media(section_id);

-- ============================================
-- NOTES (comments on highlights or sections)
-- ============================================
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  highlight_id UUID REFERENCES highlights(id) ON DELETE CASCADE,
  section_id UUID REFERENCES sections(id) ON DELETE CASCADE,
  collaborator_id UUID REFERENCES collaborators(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT note_has_target CHECK (highlight_id IS NOT NULL OR section_id IS NOT NULL)
);

CREATE INDEX idx_notes_highlight ON notes(highlight_id);
CREATE INDEX idx_notes_section ON notes(section_id);

-- ============================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER sections_updated_at
  BEFORE UPDATE ON sections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER highlights_updated_at
  BEFORE UPDATE ON highlights
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
-- For MVP: permissive policies. All reads are public (share_token validated at app layer).
-- Writes go through Server Actions with service role key.

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE highlight_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE section_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Public read access for all tables (share_token validated at app layer)
CREATE POLICY "Public read" ON projects FOR SELECT USING (true);
CREATE POLICY "Public read" ON sections FOR SELECT USING (true);
CREATE POLICY "Public read" ON collaborators FOR SELECT USING (true);
CREATE POLICY "Public read" ON highlights FOR SELECT USING (true);
CREATE POLICY "Public read" ON media_files FOR SELECT USING (true);
CREATE POLICY "Public read" ON file_references FOR SELECT USING (true);
CREATE POLICY "Public read" ON highlight_media FOR SELECT USING (true);
CREATE POLICY "Public read" ON section_media FOR SELECT USING (true);
CREATE POLICY "Public read" ON notes FOR SELECT USING (true);

-- Service role bypasses RLS, so writes via Server Actions work automatically
