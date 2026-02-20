import type { Highlight } from "@/lib/supabase/types";

export interface RenderSpan {
  text: string;
  highlightIds: string[];
  startOffset: number;
  endOffset: number;
}

/**
 * Converts overlapping highlight ranges into non-overlapping renderable spans.
 *
 * Example:
 *   Input:  "The quick brown fox jumps"
 *            [highlight A: 4-15]
 *                   [highlight B: 10-24]
 *
 *   Output spans:
 *     "The "           → no highlight
 *     "quick "         → highlight A only
 *     "brown"          → highlight A + B (stacked)
 *     " fox jumps"     → highlight B only
 */
export function computeRenderSpans(
  text: string,
  highlights: Highlight[]
): RenderSpan[] {
  if (highlights.length === 0) {
    return [{ text, highlightIds: [], startOffset: 0, endOffset: text.length }];
  }

  // Collect all boundary points
  const boundaries = new Set<number>();
  boundaries.add(0);
  boundaries.add(text.length);

  for (const h of highlights) {
    const start = Math.max(0, Math.min(h.start_offset, text.length));
    const end = Math.max(0, Math.min(h.end_offset, text.length));
    boundaries.add(start);
    boundaries.add(end);
  }

  // Sort boundaries
  const sorted = Array.from(boundaries).sort((a, b) => a - b);

  // Build spans between consecutive boundaries
  const spans: RenderSpan[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];

    if (start === end) continue;

    // Find which highlights cover this span
    const covering = highlights
      .filter((h) => h.start_offset <= start && h.end_offset >= end)
      .map((h) => h.id);

    spans.push({
      text: text.slice(start, end),
      highlightIds: covering,
      startOffset: start,
      endOffset: end,
    });
  }

  return spans;
}

/** Highlight colors for collaborators */
export const HIGHLIGHT_COLORS = [
  "var(--highlight-blue)",
  "var(--highlight-amber)",
  "var(--highlight-green)",
  "var(--highlight-purple)",
  "var(--highlight-rose)",
] as const;

export function getHighlightColor(index: number): string {
  return HIGHLIGHT_COLORS[index % HIGHLIGHT_COLORS.length];
}
