"use client";

import { useEffect, useTransition } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ScriptSection } from "./ScriptSection";
import { FloatingToolbar } from "./FloatingToolbar";
import { CoverageLegend } from "./CoverageLegend";
import { MediaSidebar } from "@/components/layout/MediaSidebar";
import { useTextSelection } from "@/hooks/useTextSelection";
import { useAnnotationStore } from "@/hooks/useAnnotationStore";
import { createHighlight } from "@/actions/highlights";
import type {
  Section,
  Highlight,
  HighlightMedia,
  SectionMedia,
  MediaFile,
  FileReference,
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
  canEdit?: boolean;
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
  canEdit = false,
}: ScriptViewerProps) {
  const { selection, clearSelection } = useTextSelection();
  const [isPending, startTransition] = useTransition();

  const setHighlights = useAnnotationStore((s) => s.setHighlights);
  const setHighlightMedia = useAnnotationStore((s) => s.setHighlightMedia);
  const setSectionMedia = useAnnotationStore((s) => s.setSectionMedia);
  const setMediaFiles = useAnnotationStore((s) => s.setMediaFiles);
  const setFileReferences = useAnnotationStore((s) => s.setFileReferences);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply saved coverage colors as CSS variable overrides
  useEffect(() => {
    const cc = settings?.coverageColors;
    if (!cc) return;
    if (cc.media) document.documentElement.style.setProperty("--highlight-blue", cc.media);
    if (cc.graphics) document.documentElement.style.setProperty("--highlight-green", cc.graphics);
    if (cc.on_camera) document.documentElement.style.setProperty("--highlight-amber", cc.on_camera);

    return () => {
      // Reset on unmount so other pages aren't affected
      document.documentElement.style.removeProperty("--highlight-blue");
      document.documentElement.style.removeProperty("--highlight-green");
      document.documentElement.style.removeProperty("--highlight-amber");
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
            <div className="space-y-6">
              {sections.map((section) => (
                <ScriptSection key={section.id} section={section} />
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

      {/* Media sidebar (editors only) */}
      {canEdit && <MediaSidebar projectId={projectId} />}

      {/* Coverage type legend (editors only) */}
      {canEdit && <CoverageLegend projectId={projectId} coverageColors={settings?.coverageColors} />}
    </div>
  );
}
