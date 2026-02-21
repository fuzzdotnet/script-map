"use client";

import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { ImagePlus } from "lucide-react";
import { computeRenderSpans, getSpanColor, getSpanLineColor } from "@/lib/annotationEngine";
import { useAnnotationStore } from "@/hooks/useAnnotationStore";
import { Badge } from "@/components/ui/badge";
import type { Section, Highlight } from "@/lib/supabase/types";

interface ScriptSectionProps {
  section: Section;
  newHighlightIds?: Set<string>;
}

export function ScriptSection({ section, newHighlightIds }: ScriptSectionProps) {
  // Select raw arrays from store (stable references — no new objects created)
  const allHighlights = useAnnotationStore((s) => s.highlights);
  const allSectionMedia = useAnnotationStore((s) => s.sectionMedia);
  const selectHighlight = useAnnotationStore((s) => s.selectHighlight);
  const selectSectionForMedia = useAnnotationStore((s) => s.selectSectionForMedia);
  const selectedHighlightId = useAnnotationStore((s) => s.selectedHighlightId);
  const selectedGroupId = useAnnotationStore((s) => s.selectedGroupId);

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

  // Track which highlight was just selected (for pulse animation)
  const [pulsingId, setPulsingId] = useState<string | null>(null);
  const prevSelectedRef = useRef<string | null>(null);

  useEffect(() => {
    if (selectedHighlightId && selectedHighlightId !== prevSelectedRef.current) {
      // Only pulse if this section contains the selected highlight
      const isInSection = highlights.some((h) => h.id === selectedHighlightId);
      if (isInSection) {
        setPulsingId(selectedHighlightId);
        const timer = setTimeout(() => setPulsingId(null), 500);
        return () => clearTimeout(timer);
      }
    }
    prevSelectedRef.current = selectedHighlightId;
  }, [selectedHighlightId, highlights]);

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
      {/* Margin coverage indicators */}
      {highlights.length > 0 && (
        <MarginGutter highlights={highlights} sectionBody={section.body} />
      )}

      <p className="script-text text-foreground/90" data-section-text>
        {spans.map((span, i) => {
          if (span.highlightIds.length === 0) {
            return <span key={i}>{span.text}</span>;
          }

          const isSelected = span.highlightIds.some(
            (id) => id === selectedHighlightId ||
              (selectedGroupId && highlights.find((h) => h.id === id)?.group_id === selectedGroupId)
          );
          const isPulsing = span.highlightIds.some(
            (id) => id === pulsingId
          );
          const isNew = newHighlightIds && span.highlightIds.some(
            (id) => newHighlightIds.has(id)
          );

          return (
            <span
              key={i}
              className={`annotation-highlight ${isSelected ? "ring-1 ring-ring" : ""} ${isPulsing ? "highlight-selected" : ""}`}
              style={{
                backgroundColor: getSpanColor(span.highlightIds, highlights),
                "--span-line": getSpanLineColor(span.highlightIds, highlights),
              } as React.CSSProperties}
              data-new={isNew ? "" : undefined}
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

/**
 * Renders small colored bars in the left margin showing which lines have highlights.
 * Uses DOM measurement after render to determine line positions.
 */
function MarginGutter({ highlights, sectionBody }: { highlights: Highlight[]; sectionBody: string }) {
  const gutterRef = useRef<HTMLDivElement>(null);
  const [marks, setMarks] = useState<{ top: number; height: number; color: string }[]>([]);

  const computeMarks = useCallback(() => {
    const gutter = gutterRef.current;
    if (!gutter) return;

    const container = gutter.parentElement;
    if (!container) return;

    const paragraph = container.querySelector("[data-section-text]");
    if (!paragraph) return;

    const containerRect = paragraph.getBoundingClientRect();
    const spans = paragraph.querySelectorAll(".annotation-highlight");

    // Group spans by visual line (same Y position within 2px tolerance)
    const lineMap = new Map<number, string>();

    spans.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const relTop = Math.round(rect.top - containerRect.top);
      const lineHeight = rect.height;

      // Snap to nearest line
      const lineKey = Math.round(relTop / lineHeight) * lineHeight;

      if (!lineMap.has(lineKey)) {
        const lineColor = (el as HTMLElement).style.getPropertyValue("--span-line");
        lineMap.set(lineKey, lineColor);
      }
    });

    const newMarks: { top: number; height: number; color: string }[] = [];
    lineMap.forEach((color, top) => {
      newMarks.push({ top, height: 3, color });
    });

    setMarks(newMarks);
  }, []);

  useEffect(() => {
    // Compute after initial render
    const raf = requestAnimationFrame(computeMarks);
    return () => cancelAnimationFrame(raf);
  }, [computeMarks, highlights, sectionBody]);

  return (
    <div ref={gutterRef} className="margin-gutter">
      {marks.map((mark, i) => (
        <div
          key={i}
          className="margin-mark"
          style={{
            top: mark.top,
            height: mark.height,
            backgroundColor: mark.color,
          }}
        />
      ))}
    </div>
  );
}
