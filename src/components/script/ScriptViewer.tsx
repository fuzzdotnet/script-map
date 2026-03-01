"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ScriptSection } from "./ScriptSection";
import { FloatingToolbar } from "./FloatingToolbar";
import { CoverageLegend } from "./CoverageLegend";
import { MobileBanner } from "./MobileBanner";
import { MobileFilmedPopover } from "./MobileFilmedPopover";
import { MediaSidebar } from "@/components/layout/MediaSidebar";
import { useTextSelection } from "@/hooks/useTextSelection";
import { useAnnotationStore } from "@/hooks/useAnnotationStore";
import { useIsMobile } from "@/hooks/useIsMobile";
import { FlipHorizontal2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { createHighlight, createHighlights } from "@/actions/highlights";
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
  const isMobile = useIsMobile();
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
  const presenterMode = useAnnotationStore((s) => s.presenterMode);
  const mirrorText = useAnnotationStore((s) => s.mirrorText);
  const toggleMirrorText = useAnnotationStore((s) => s.toggleMirrorText);
  const allHighlights = useAnnotationStore((s) => s.highlights);

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
    if (cc.field_footage) {
      document.documentElement.style.setProperty("--highlight-purple", cc.field_footage);
      document.documentElement.style.setProperty("--highlight-purple-line", toLineColor(cc.field_footage));
    }

    return () => {
      // Reset on unmount so other pages aren't affected
      document.documentElement.style.removeProperty("--highlight-blue");
      document.documentElement.style.removeProperty("--highlight-blue-line");
      document.documentElement.style.removeProperty("--highlight-green");
      document.documentElement.style.removeProperty("--highlight-green-line");
      document.documentElement.style.removeProperty("--highlight-amber");
      document.documentElement.style.removeProperty("--highlight-amber-line");
      document.documentElement.style.removeProperty("--highlight-purple");
      document.documentElement.style.removeProperty("--highlight-purple-line");
    };
  }, [settings]);

  // In presenter mode, only show sections that have on_camera highlights
  const visibleSections = useMemo(() => {
    if (!presenterMode) return sections;
    return sections.filter((section) => {
      const isHeading =
        section.section_type === "act" ||
        section.section_type === "scene" ||
        section.section_type === "heading";
      if (isHeading) return false;
      return allHighlights.some(
        (h) => h.section_id === section.id && h.label === "on_camera"
      );
    });
  }, [presenterMode, sections, allHighlights]);

  function handleCoverage(label: string, color: string, openToTab?: "upload" | "reference") {
    if (!selection) return;

    startTransition(async () => {
      try {
        const groupId = selection.ranges.length > 1 ? crypto.randomUUID() : undefined;

        // Batch: single server call with 1 auth check + 1 insert query
        const highlights = await createHighlights({
          ranges: selection.ranges.map((r) => ({
            sectionId: r.sectionId,
            startOffset: r.startOffset,
            endOffset: r.endOffset,
          })),
          label,
          color,
          groupId,
        });

        for (const h of highlights) {
          addHighlight(h);
          markAsNew(h.id);
        }
        if (openToTab && highlights.length > 0) {
          selectHighlight(highlights[0].id, openToTab);
        }
        clearSelection();
      } catch (err) {
        console.error("Failed to create highlight:", err);
      }
    });
  }

  const handleMedia = () => handleCoverage("media", "var(--highlight-blue)", "upload");
  const handleGraphics = () => handleCoverage("graphics", "var(--highlight-green)");
  const handleOnCamera = () => handleCoverage("on_camera", "var(--highlight-amber)");
  const handleFieldFootage = () => handleCoverage("field_footage", "var(--highlight-purple)", "reference");

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Script panel */}
      <ScrollArea className="flex-1">
        <div className={`mx-auto max-w-3xl px-4 py-8 md:px-8 md:py-12 ${mirrorText ? "presenter-mirror" : ""}`}>
          {visibleSections.length === 0 ? (
            <div className="py-24 text-center text-muted-foreground">
              {presenterMode ? (
                <>
                  <p className="text-lg">No on-camera text found.</p>
                  <p className="mt-2 text-sm">
                    Mark text as &quot;On Camera&quot; in edit mode to see it here.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-lg">No sections found.</p>
                  <p className="mt-2 text-sm">This script appears to be empty.</p>
                </>
              )}
            </div>
          ) : (
            <div className="script-sections space-y-6">
              {visibleSections.map((section) => (
                <ScriptSection key={section.id} section={section} newHighlightIds={newHighlightIds} presenterMode={presenterMode} />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Mirror toggle — only visible in presenter mode */}
      {presenterMode && (
        <TooltipProvider>
          <div className="fixed bottom-4 right-4 z-40">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={mirrorText ? "default" : "outline"}
                  size="icon"
                  onClick={toggleMirrorText}
                  className="h-10 w-10 rounded-full shadow-lg border-white/15"
                >
                  <FlipHorizontal2 className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                {mirrorText ? "Disable Mirror" : "Mirror Text"}
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      )}

      {/* Desktop editing UI — hidden in presenter mode */}
      {!presenterMode && !isMobile && (
        <>
          {canEdit && selection && !isPending && (
            <FloatingToolbar
              selection={selection}
              onMedia={handleMedia}
              onGraphics={handleGraphics}
              onCamera={handleOnCamera}
              onFieldFootage={handleFieldFootage}
              onDismiss={clearSelection}
            />
          )}

          {(canEdit || canComment) && <MediaSidebar projectId={projectId} canEdit={canEdit} canComment={canComment} />}

          {canEdit && <CoverageLegend projectId={projectId} coverageColors={settings?.coverageColors} />}
        </>
      )}

      {/* Mobile editing UI — hidden in presenter mode */}
      {!presenterMode && isMobile && (
        <>
          {canEdit && <MobileFilmedPopover />}
          <MobileBanner />
        </>
      )}
    </div>
  );
}
