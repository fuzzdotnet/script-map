"use client";

import { useState, useCallback, useEffect } from "react";

export interface SectionRange {
  sectionId: string;
  startOffset: number;
  endOffset: number;
}

export interface TextSelection {
  ranges: SectionRange[];
  selectedText: string;
  rect: DOMRect;
}

/**
 * Hook that converts browser text selections into section-relative char offsets.
 * Supports selections that span multiple sections — returns one range per section.
 */
export function useTextSelection() {
  const [selection, setSelection] = useState<TextSelection | null>(null);

  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) {
      return;
    }

    const range = sel.getRangeAt(0);
    const selectedText = sel.toString().trim();
    if (!selectedText) return;

    const startSectionEl = findSectionContainer(range.startContainer);
    const endSectionEl = findSectionContainer(range.endContainer);
    if (!startSectionEl || !endSectionEl) {
      setSelection(null);
      return;
    }

    // Single-section selection (common case)
    if (startSectionEl === endSectionEl) {
      const sectionId = startSectionEl.getAttribute("data-section-id");
      if (!sectionId) { setSelection(null); return; }

      const textEl = startSectionEl.querySelector("[data-section-text]") || startSectionEl;
      const offsets = domRangeToTextOffsets(textEl, range);
      if (!offsets) { setSelection(null); return; }

      setSelection({
        ranges: [{ sectionId, startOffset: offsets.start, endOffset: offsets.end }],
        selectedText,
        rect: range.getBoundingClientRect(),
      });
      return;
    }

    // Multi-section selection — collect ranges for each section
    const container = startSectionEl.parentElement;
    if (!container) { setSelection(null); return; }

    const allSections = Array.from(container.querySelectorAll("[data-section-id]"));
    const startIdx = allSections.indexOf(startSectionEl);
    const endIdx = allSections.indexOf(endSectionEl);
    if (startIdx === -1 || endIdx === -1) { setSelection(null); return; }

    const ranges: SectionRange[] = [];

    for (let i = startIdx; i <= endIdx; i++) {
      const sectionEl = allSections[i];
      const sectionId = sectionEl.getAttribute("data-section-id");
      if (!sectionId) continue;

      // Skip headings (they don't have data-section-text)
      const textEl = sectionEl.querySelector("[data-section-text]");
      if (!textEl) continue;

      const fullLength = (textEl.textContent || "").length;
      if (fullLength === 0) continue;

      if (i === startIdx) {
        // First section: from selection start to end of section text
        const startOffset = getOffsetAtRangeStart(textEl, range);
        if (startOffset !== null && startOffset < fullLength) {
          ranges.push({ sectionId, startOffset, endOffset: fullLength });
        }
      } else if (i === endIdx) {
        // Last section: from start of section text to selection end
        const endOffset = getOffsetAtRangeEnd(textEl, range);
        if (endOffset !== null && endOffset > 0) {
          ranges.push({ sectionId, startOffset: 0, endOffset });
        }
      } else {
        // Middle section: entire text
        ranges.push({ sectionId, startOffset: 0, endOffset: fullLength });
      }
    }

    if (ranges.length === 0) { setSelection(null); return; }

    setSelection({
      ranges,
      selectedText,
      rect: range.getBoundingClientRect(),
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  useEffect(() => {
    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, [handleMouseUp]);

  return { selection, clearSelection };
}

function findSectionContainer(node: Node): HTMLElement | null {
  let current: Node | null = node;
  while (current) {
    if (
      current instanceof HTMLElement &&
      current.hasAttribute("data-section-id")
    ) {
      return current;
    }
    current = current.parentNode;
  }
  return null;
}

/**
 * Walks the DOM tree to convert a browser Range into plain-text character offsets
 * relative to a container element. This handles the case where the container
 * has nested <span> elements (from annotation highlights).
 */
function domRangeToTextOffsets(
  container: Node,
  range: Range
): { start: number; end: number } | null {
  try {
    const preRange = document.createRange();
    preRange.selectNodeContents(container);
    preRange.setEnd(range.startContainer, range.startOffset);
    const start = preRange.toString().length;

    preRange.setEnd(range.endContainer, range.endOffset);
    const end = preRange.toString().length;

    if (start === end) return null;

    return { start: Math.min(start, end), end: Math.max(start, end) };
  } catch {
    return null;
  }
}

/** Get the text offset where the selection starts within a container */
function getOffsetAtRangeStart(container: Node, range: Range): number | null {
  try {
    const preRange = document.createRange();
    preRange.selectNodeContents(container);
    preRange.setEnd(range.startContainer, range.startOffset);
    return preRange.toString().length;
  } catch {
    return null;
  }
}

/** Get the text offset where the selection ends within a container */
function getOffsetAtRangeEnd(container: Node, range: Range): number | null {
  try {
    const preRange = document.createRange();
    preRange.selectNodeContents(container);
    preRange.setEnd(range.endContainer, range.endOffset);
    return preRange.toString().length;
  } catch {
    return null;
  }
}
