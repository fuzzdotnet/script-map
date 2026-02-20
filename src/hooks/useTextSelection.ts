"use client";

import { useState, useCallback, useEffect } from "react";

export interface TextSelection {
  sectionId: string;
  startOffset: number;
  endOffset: number;
  selectedText: string;
  rect: DOMRect;
}

/**
 * Hook that converts browser text selections into section-relative char offsets.
 * Sections must have data-section-id attributes on their container elements.
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

    // Walk up from the selection to find the section container
    const sectionEl = findSectionContainer(range.startContainer);
    if (!sectionEl) {
      setSelection(null);
      return;
    }

    // Make sure the selection stays within a single section
    const endSectionEl = findSectionContainer(range.endContainer);
    if (!endSectionEl || endSectionEl !== sectionEl) {
      setSelection(null);
      return;
    }

    const sectionId = sectionEl.getAttribute("data-section-id");
    if (!sectionId) {
      setSelection(null);
      return;
    }

    // Convert DOM range offsets to plain text offsets within the section
    const textContentEl = sectionEl.querySelector("[data-section-text]") || sectionEl;
    const offsets = domRangeToTextOffsets(textContentEl, range);
    if (!offsets) {
      setSelection(null);
      return;
    }

    const rect = range.getBoundingClientRect();

    setSelection({
      sectionId,
      startOffset: offsets.start,
      endOffset: offsets.end,
      selectedText,
      rect,
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
