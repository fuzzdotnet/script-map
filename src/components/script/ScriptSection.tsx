"use client";

import { useMemo } from "react";
import { ImagePlus } from "lucide-react";
import { computeRenderSpans, getSpanColor } from "@/lib/annotationEngine";
import { useAnnotationStore } from "@/hooks/useAnnotationStore";
import { Badge } from "@/components/ui/badge";
import type { Section } from "@/lib/supabase/types";

interface ScriptSectionProps {
  section: Section;
}

export function ScriptSection({ section }: ScriptSectionProps) {
  // Select raw arrays from store (stable references — no new objects created)
  const allHighlights = useAnnotationStore((s) => s.highlights);
  const allSectionMedia = useAnnotationStore((s) => s.sectionMedia);
  const allMediaFiles = useAnnotationStore((s) => s.mediaFiles);
  const allFileReferences = useAnnotationStore((s) => s.fileReferences);
  const selectHighlight = useAnnotationStore((s) => s.selectHighlight);
  const selectSectionForMedia = useAnnotationStore((s) => s.selectSectionForMedia);
  const selectedHighlightId = useAnnotationStore((s) => s.selectedHighlightId);

  // Derive filtered data in useMemo (avoids infinite loop)
  const highlights = useMemo(
    () => allHighlights.filter((h) => h.section_id === section.id),
    [allHighlights, section.id]
  );

  const sectionMediaEntries = useMemo(
    () => allSectionMedia.filter((sm) => sm.section_id === section.id),
    [allSectionMedia, section.id]
  );

  const totalSectionMedia = useMemo(() => {
    const uploadedCount = sectionMediaEntries.filter((e) => e.media_file_id).length;
    const refCount = sectionMediaEntries.filter((e) => e.file_reference_id).length;
    return uploadedCount + refCount;
  }, [sectionMediaEntries]);

  const isHeading =
    section.section_type === "act" ||
    section.section_type === "scene" ||
    section.section_type === "heading";

  const spans = useMemo(
    () => computeRenderSpans(section.body, highlights),
    [section.body, highlights]
  );

  if (isHeading) {
    return (
      <div className="group pt-8 pb-2" data-section-id={section.id}>
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            {section.body}
          </h2>
          {totalSectionMedia > 0 && (
            <Badge
              variant="secondary"
              className="cursor-pointer text-xs"
              onClick={() => selectSectionForMedia(section.id)}
            >
              {totalSectionMedia} media
            </Badge>
          )}
          <button
            onClick={() => selectSectionForMedia(section.id)}
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
            title="Add section media"
          >
            <ImagePlus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative" data-section-id={section.id}>
      <p className="script-text text-foreground/90 selection:bg-highlight-blue selection:text-foreground" data-section-text>
        {spans.map((span, i) => {
          if (span.highlightIds.length === 0) {
            return <span key={i}>{span.text}</span>;
          }

          const isSelected = span.highlightIds.some(
            (id) => id === selectedHighlightId
          );

          return (
            <span
              key={i}
              className={`annotation-highlight ${isSelected ? "ring-1 ring-ring" : ""}`}
              style={{
                backgroundColor: getSpanColor(span.highlightIds, highlights),
              }}
              onClick={() => selectHighlight(span.highlightIds[0])}
            >
              {span.text}
            </span>
          );
        })}
      </p>

      {/* Section-level media indicator */}
      {totalSectionMedia > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <Badge
            variant="secondary"
            className="cursor-pointer text-xs gap-1"
            onClick={() => selectSectionForMedia(section.id)}
          >
            <ImagePlus className="h-3 w-3" />
            {totalSectionMedia} media option{totalSectionMedia !== 1 ? "s" : ""}
          </Badge>
        </div>
      )}
    </div>
  );
}
