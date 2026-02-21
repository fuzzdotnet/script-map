"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ScriptSection } from "./ScriptSection";
import { FloatingToolbar } from "./FloatingToolbar";
import { CoverageLegend } from "./CoverageLegend";
import { MediaSidebar } from "@/components/layout/MediaSidebar";
import { useTextSelection } from "@/hooks/useTextSelection";
import { useAnnotationStore } from "@/hooks/useAnnotationStore";
import { createHighlight } from "@/actions/highlights";
import { toLineColor } from "@/lib/annotationEngine";
import type {
  Section,
  Highlight,
  HighlightMedia,
  HighlightComment,
  SectionMedia,
  MediaFile,
  FileReference,
  Profile,
  ProjectSettings,
} from "@/lib/supabase/types";

interface ScriptViewerProps {
  sections: Section[];
  projectId: string;
  settings?: ProjectSettings;
  initialHighlights?: Highlight[];
  initialHighlightMedia?: HighlightMedia[];
  initialSectionMedia?: SectionMedia[];
  initialMediaFiles?: MediaFile[];
  initialFileReferences?: FileReference[];
  initialComments?: HighlightComment[];
  profiles?: Record<string, Profile>;
  currentUserId?: string;
  canEdit?: boolean;
  canComment?: boolean;
}

export function ScriptViewer({
  sections,
  projectId,
  settings,
  initialHighlights = [],
  initialHighlightMedia = [],
  initialSectionMedia = [],
  initialMediaFiles = [],
  initialFileReferences = [],
  initialComments = [],
  profiles = {},
  currentUserId,
  canEdit = false,
  canComment = false,
}: ScriptViewerProps) {
  const { selection, clearSelection } = useTextSelection();
  const [isPending, startTransition] = useTransition();

  const setHighlights = useAnnotationStore((s) => s.setHighlights);
  const setHighlightMedia = useAnnotationStore((s) => s.setHighlightMedia);
  const setSectionMedia = useAnnotationStore((s) => s.setSectionMedia);
  const setMediaFiles = useAnnotationStore((s) => s.setMediaFiles);
  const setFileReferences = useAnnotationStore((s) => s.setFileReferences);
  const setComments = useAnnotationStore((s) => s.setComments);
  const setProfiles = useAnnotationStore((s) => s.setProfiles);
  const setCurrentUserId = useAnnotationStore((s) => s.setCurrentUserId);
  const addHighlight = useAnnotationStore((s) => s.addHighlight);
  const selectHighlight = useAnnotationStore((s) => s.selectHighlight);
  const selectSectionForMedia = useAnnotationStore((s) => s.selectSectionForMedia);
  const openSidebar = useAnnotationStore((s) => s.openSidebar);

  // Hydrate store with server data
  useEffect(() => {
    setHighlights(initialHighlights);
    setHighlightMedia(initialHighlightMedia);
    setSectionMedia(initialSectionMedia);
    setMediaFiles(initialMediaFiles);
    setFileReferences(initialFileReferences);
    setComments(initialComments);
    setProfiles(profiles);
    setCurrentUserId(currentUserId ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track newly created highlight IDs for the flash animation
  const [newHighlightIds, setNewHighlightIds] = useState<Set<string>>(new Set());
  const newHighlightTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  function markAsNew(id: string) {
    setNewHighlightIds((prev) => new Set(prev).add(id));
    // Remove the "new" flag after the animation duration
    const timer = setTimeout(() => {
      setNewHighlightIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      newHighlightTimers.current.delete(id);
    }, 600);
    newHighlightTimers.current.set(id, timer);
  }

  // Apply saved coverage colors as CSS variable overrides
  useEffect(() => {
    const cc = settings?.coverageColors;
    if (!cc) return;
    if (cc.media) {
      document.documentElement.style.setProperty("--highlight-blue", cc.media);
      document.documentElement.style.setProperty("--highlight-blue-line", toLineColor(cc.media));
    }
    if (cc.graphics) {
      document.documentElement.style.setProperty("--highlight-green", cc.graphics);
      document.documentElement.style.setProperty("--highlight-green-line", toLineColor(cc.graphics));
    }
    if (cc.on_camera) {
      document.documentElement.style.setProperty("--highlight-amber", cc.on_camera);
      document.documentElement.style.setProperty("--highlight-amber-line", toLineColor(cc.on_camera));
    }

    return () => {
      // Reset on unmount so other pages aren't affected
      document.documentElement.style.removeProperty("--highlight-blue");
      document.documentElement.style.removeProperty("--highlight-blue-line");
      document.documentElement.style.removeProperty("--highlight-green");
      document.documentElement.style.removeProperty("--highlight-green-line");
      document.documentElement.style.removeProperty("--highlight-amber");
      document.documentElement.style.removeProperty("--highlight-amber-line");
    };
  }, [settings]);

  function handleMedia() {
    if (!selection) return;

    startTransition(async () => {
      try {
        const highlight = await createHighlight({
          sectionId: selection.sectionId,
          startOffset: selection.startOffset,
          endOffset: selection.endOffset,
          label: "media",
          color: "var(--highlight-blue)",
        });

        addHighlight(highlight);
        markAsNew(highlight.id);
        selectHighlight(highlight.id, "upload");
        clearSelection();
      } catch (err) {
        console.error("Failed to create highlight:", err);
      }
    });
  }

  function handleGraphics() {
    if (!selection) return;

    startTransition(async () => {
      try {
        const highlight = await createHighlight({
          sectionId: selection.sectionId,
          startOffset: selection.startOffset,
          endOffset: selection.endOffset,
          label: "graphics",
          color: "var(--highlight-green)",
        });

        addHighlight(highlight);
        markAsNew(highlight.id);
        clearSelection();
      } catch (err) {
        console.error("Failed to create highlight:", err);
      }
    });
  }

  function handleOnCamera() {
    if (!selection) return;

    startTransition(async () => {
      try {
        const highlight = await createHighlight({
          sectionId: selection.sectionId,
          startOffset: selection.startOffset,
          endOffset: selection.endOffset,
          label: "on_camera",
          color: "var(--highlight-amber)",
        });

        addHighlight(highlight);
        markAsNew(highlight.id);
        clearSelection();
      } catch (err) {
        console.error("Failed to create highlight:", err);
      }
    });
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Script panel */}
      <ScrollArea className="flex-1">
        <div className="mx-auto max-w-3xl px-8 py-12">
          {sections.length === 0 ? (
            <div className="py-24 text-center text-muted-foreground">
              <p className="text-lg">No sections found.</p>
              <p className="mt-2 text-sm">This script appears to be empty.</p>
            </div>
          ) : (
            <div className="script-sections space-y-6">
              {sections.map((section) => (
                <ScriptSection key={section.id} section={section} newHighlightIds={newHighlightIds} />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Floating toolbar on text selection (editors only) */}
      {canEdit && selection && !isPending && (
        <FloatingToolbar
          selection={selection}
          onMedia={handleMedia}
          onGraphics={handleGraphics}
          onCamera={handleOnCamera}
          onDismiss={clearSelection}
        />
      )}

      {/* Media sidebar (editors + commenters) */}
      {(canEdit || canComment) && <MediaSidebar projectId={projectId} canEdit={canEdit} canComment={canComment} />}

      {/* Coverage type legend (editors only) */}
      {canEdit && <CoverageLegend projectId={projectId} coverageColors={settings?.coverageColors} />}
    </div>
  );
}
