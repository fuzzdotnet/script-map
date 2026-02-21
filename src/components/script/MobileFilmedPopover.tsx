"use client";

import { useEffect, useRef, useTransition, useCallback } from "react";
import { Check, Circle, X } from "lucide-react";
import { useAnnotationStore } from "@/hooks/useAnnotationStore";
import { toggleHighlightFilmed } from "@/actions/highlights";
import { getCoverageType, COVERAGE_TYPES } from "@/lib/annotationEngine";

export function MobileFilmedPopover() {
  const selectedHighlightId = useAnnotationStore((s) => s.selectedHighlightId);
  const allHighlights = useAnnotationStore((s) => s.highlights);
  const selectHighlight = useAnnotationStore((s) => s.selectHighlight);
  const setHighlightFilmed = useAnnotationStore((s) => s.setHighlightFilmed);
  const [isPending, startTransition] = useTransition();
  const popoverRef = useRef<HTMLDivElement>(null);

  const selectedHighlight = selectedHighlightId
    ? allHighlights.find((h) => h.id === selectedHighlightId)
    : null;

  // Position popover near the selected highlight span
  useEffect(() => {
    if (!selectedHighlightId || !popoverRef.current) return;

    // Find the selected highlight element (it has ring-1 class)
    const target = document.querySelector(".annotation-highlight.ring-1");
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const popover = popoverRef.current;
    const popoverHeight = popover.offsetHeight;

    // Position above the highlight, centered
    let top = rect.top - popoverHeight - 8 + window.scrollY;
    let left = rect.left + rect.width / 2 - popover.offsetWidth / 2;

    // If above would go off-screen, place below
    if (rect.top - popoverHeight - 8 < 8) {
      top = rect.bottom + 8 + window.scrollY;
    }

    // Keep within viewport horizontally
    left = Math.max(8, Math.min(left, window.innerWidth - popover.offsetWidth - 8));

    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
  }, [selectedHighlightId]);

  // Dismiss on outside tap
  const handleOutsideTap = useCallback(
    (e: TouchEvent | MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        !(e.target as Element)?.closest?.(".annotation-highlight")
      ) {
        selectHighlight(null);
      }
    },
    [selectHighlight]
  );

  useEffect(() => {
    if (!selectedHighlightId) return;
    document.addEventListener("touchstart", handleOutsideTap);
    return () => document.removeEventListener("touchstart", handleOutsideTap);
  }, [selectedHighlightId, handleOutsideTap]);

  if (!selectedHighlight) return null;

  const coverageType = getCoverageType(selectedHighlight);
  const config = COVERAGE_TYPES[coverageType];
  const filmed = selectedHighlight.filmed;

  function handleToggle() {
    if (!selectedHighlightId) return;
    const newValue = !filmed;
    setHighlightFilmed(selectedHighlightId, newValue);
    startTransition(async () => {
      try {
        await toggleHighlightFilmed(selectedHighlightId, newValue);
      } catch (err) {
        console.error("Failed to toggle filmed:", err);
        setHighlightFilmed(selectedHighlightId, filmed);
      }
    });
  }

  return (
    <div
      ref={popoverRef}
      className="absolute z-50 flex items-center gap-2 rounded-full border border-white/15 bg-surface/95 backdrop-blur-md px-3 py-2 shadow-lg"
    >
      <span
        className="h-2 w-2 rounded-full shrink-0"
        style={{ backgroundColor: config.color }}
      />
      <span className="text-xs text-muted-foreground whitespace-nowrap">{config.label}</span>
      <button
        onClick={handleToggle}
        disabled={isPending}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
          filmed
            ? "bg-green-500/20 text-green-400"
            : "bg-elevated text-foreground/70"
        }`}
      >
        {filmed ? <Check className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
        {filmed ? "Filmed" : "Not filmed"}
      </button>
      <button
        onClick={() => selectHighlight(null)}
        className="text-muted-foreground/50 ml-1"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
