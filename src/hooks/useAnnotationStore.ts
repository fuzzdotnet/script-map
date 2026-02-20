"use client";

import { create } from "zustand";
import type {
  Highlight,
  HighlightMedia,
  SectionMedia,
  MediaFile,
  FileReference,
} from "@/lib/supabase/types";

interface AnnotationState {
  // Data
  highlights: Highlight[];
  highlightMedia: HighlightMedia[];
  sectionMedia: SectionMedia[];
  mediaFiles: MediaFile[];
  fileReferences: FileReference[];

  // UI state
  selectedHighlightId: string | null;
  selectedSectionId: string | null;
  sidebarOpen: boolean;
  sidebarTab: "media" | "upload" | "reference";

  // Actions: data
  setHighlights: (highlights: Highlight[]) => void;
  addHighlight: (highlight: Highlight) => void;
  removeHighlight: (id: string) => void;
  setHighlightMedia: (media: HighlightMedia[]) => void;
  addHighlightMedia: (media: HighlightMedia) => void;
  removeHighlightMedia: (id: string) => void;
  setSectionMedia: (media: SectionMedia[]) => void;
  addSectionMedia: (media: SectionMedia) => void;
  removeSectionMedia: (id: string) => void;
  setMediaFiles: (files: MediaFile[]) => void;
  addMediaFile: (file: MediaFile) => void;
  removeMediaFile: (id: string) => void;
  setFileReferences: (refs: FileReference[]) => void;
  addFileReference: (ref: FileReference) => void;
  removeFileReference: (id: string) => void;

  // Actions: UI
  selectHighlight: (id: string | null, tab?: "media" | "upload" | "reference") => void;
  selectSectionForMedia: (id: string | null) => void;
  openSidebar: () => void;
  closeSidebar: () => void;
  setSidebarTab: (tab: "media" | "upload" | "reference") => void;

  // Derived helpers
  getHighlightsForSection: (sectionId: string) => Highlight[];
  getMediaForHighlight: (highlightId: string) => {
    uploaded: MediaFile[];
    references: FileReference[];
    entries: HighlightMedia[];
  };
  getMediaForSection: (sectionId: string) => {
    uploaded: MediaFile[];
    references: FileReference[];
    entries: SectionMedia[];
  };
}

export const useAnnotationStore = create<AnnotationState>((set, get) => ({
  // Data
  highlights: [],
  highlightMedia: [],
  sectionMedia: [],
  mediaFiles: [],
  fileReferences: [],

  // UI state
  selectedHighlightId: null,
  selectedSectionId: null,
  sidebarOpen: false,
  sidebarTab: "media",

  // Actions: data
  setHighlights: (highlights) => set({ highlights }),
  addHighlight: (highlight) =>
    set((s) => ({ highlights: [...s.highlights, highlight] })),
  removeHighlight: (id) =>
    set((s) => ({
      highlights: s.highlights.filter((h) => h.id !== id),
      highlightMedia: s.highlightMedia.filter((hm) => hm.highlight_id !== id),
      selectedHighlightId:
        s.selectedHighlightId === id ? null : s.selectedHighlightId,
    })),

  setHighlightMedia: (media) => set({ highlightMedia: media }),
  addHighlightMedia: (media) =>
    set((s) => ({ highlightMedia: [...s.highlightMedia, media] })),
  removeHighlightMedia: (id) =>
    set((s) => ({ highlightMedia: s.highlightMedia.filter((hm) => hm.id !== id) })),

  setSectionMedia: (media) => set({ sectionMedia: media }),
  addSectionMedia: (media) =>
    set((s) => ({ sectionMedia: [...s.sectionMedia, media] })),
  removeSectionMedia: (id) =>
    set((s) => ({ sectionMedia: s.sectionMedia.filter((sm) => sm.id !== id) })),

  setMediaFiles: (files) => set({ mediaFiles: files }),
  addMediaFile: (file) =>
    set((s) => ({ mediaFiles: [...s.mediaFiles, file] })),
  removeMediaFile: (id) =>
    set((s) => ({
      mediaFiles: s.mediaFiles.filter((f) => f.id !== id),
      highlightMedia: s.highlightMedia.filter((hm) => hm.media_file_id !== id),
      sectionMedia: s.sectionMedia.filter((sm) => sm.media_file_id !== id),
    })),

  setFileReferences: (refs) => set({ fileReferences: refs }),
  addFileReference: (ref) =>
    set((s) => ({ fileReferences: [...s.fileReferences, ref] })),
  removeFileReference: (id) =>
    set((s) => ({
      fileReferences: s.fileReferences.filter((f) => f.id !== id),
      highlightMedia: s.highlightMedia.filter((hm) => hm.file_reference_id !== id),
      sectionMedia: s.sectionMedia.filter((sm) => sm.file_reference_id !== id),
    })),

  // Actions: UI
  selectHighlight: (id, tab) =>
    set({ selectedHighlightId: id, selectedSectionId: null, sidebarOpen: !!id, sidebarTab: tab ?? "media" }),
  selectSectionForMedia: (id) =>
    set({ selectedSectionId: id, selectedHighlightId: null, sidebarOpen: !!id, sidebarTab: "media" }),
  openSidebar: () => set({ sidebarOpen: true }),
  setSidebarTab: (tab) => set({ sidebarTab: tab }),
  closeSidebar: () => {
    const state = get();
    const hId = state.selectedHighlightId;

    // If a media highlight is selected but has no media attached, it's orphaned — remove it
    // Graphics and on_camera highlights are valid without media
    if (hId) {
      const highlight = state.highlights.find((h) => h.id === hId);
      const isMediaType = !highlight?.label || highlight.label === "media";
      if (isMediaType) {
        const hasMedia = state.highlightMedia.some((hm) => hm.highlight_id === hId);
        if (!hasMedia) {
          set((s) => ({
            sidebarOpen: false,
            selectedHighlightId: null,
            selectedSectionId: null,
            highlights: s.highlights.filter((h) => h.id !== hId),
          }));
          return;
        }
      }
    }

    set({ sidebarOpen: false, selectedHighlightId: null, selectedSectionId: null });
  },

  // Derived helpers
  getHighlightsForSection: (sectionId) =>
    get().highlights.filter((h) => h.section_id === sectionId),

  getMediaForHighlight: (highlightId) => {
    const state = get();
    const entries = state.highlightMedia.filter(
      (hm) => hm.highlight_id === highlightId
    );
    const uploaded = entries
      .filter((e) => e.media_file_id)
      .map((e) => state.mediaFiles.find((f) => f.id === e.media_file_id))
      .filter((f): f is MediaFile => !!f);
    const references = entries
      .filter((e) => e.file_reference_id)
      .map((e) => state.fileReferences.find((f) => f.id === e.file_reference_id))
      .filter((f): f is FileReference => !!f);
    return { uploaded, references, entries };
  },

  getMediaForSection: (sectionId) => {
    const state = get();
    const entries = state.sectionMedia.filter(
      (sm) => sm.section_id === sectionId
    );
    const uploaded = entries
      .filter((e) => e.media_file_id)
      .map((e) => state.mediaFiles.find((f) => f.id === e.media_file_id))
      .filter((f): f is MediaFile => !!f);
    const references = entries
      .filter((e) => e.file_reference_id)
      .map((e) => state.fileReferences.find((f) => f.id === e.file_reference_id))
      .filter((f): f is FileReference => !!f);
    return { uploaded, references, entries };
  },
}));
