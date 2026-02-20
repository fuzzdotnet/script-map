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
} from "@/lib/supabase/types";

interface ScriptViewerProps {
  sections: Section[];
  projectId: string;
  initialHighlights?: Highlight[];
  initialHighlightMedia?: HighlightMedia[];
  initialSectionMedia?: SectionMedia[];
  initialMediaFiles?: MediaFile[];
  initialFileReferences?: FileReference[];
}

export function ScriptViewer({
  sections,
  projectId,
  initialHighlights = [],
  initialHighlightMedia = [],
  initialSectionMedia = [],
  initialMediaFiles = [],
  initialFileReferences = [],
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
          {/* Coverage type legend */}
          <div className="mb-8 flex justify-center">
            <CoverageLegend />
          </div>
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

      {/* Floating toolbar on text selection */}
      {selection && !isPending && (
        <FloatingToolbar
          selection={selection}
          onMedia={handleMedia}
          onGraphics={handleGraphics}
          onCamera={handleOnCamera}
          onDismiss={clearSelection}
        />
      )}

      {/* Media sidebar */}
      <MediaSidebar projectId={projectId} />
    </div>
  );
}
