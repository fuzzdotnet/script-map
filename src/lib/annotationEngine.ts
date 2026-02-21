import type { Highlight } from "@/lib/supabase/types";

// ============================================
// COVERAGE TYPES
// ============================================

export type CoverageType = "media" | "graphics" | "on_camera" | "field_footage";

export interface CoverageTypeConfig {
  type: CoverageType;
  label: string;
  color: string; // CSS variable reference
}

export const COVERAGE_TYPES: Record<CoverageType, CoverageTypeConfig> = {
  media: { type: "media", label: "Media", color: "var(--highlight-blue)" },
  graphics: { type: "graphics", label: "Graphics", color: "var(--highlight-green)" },
  on_camera: { type: "on_camera", label: "On Camera", color: "var(--highlight-amber)" },
  field_footage: { type: "field_footage", label: "Field Footage", color: "var(--highlight-purple)" },
};

/** Get the coverage type from a highlight's label field */
export function getCoverageType(highlight: Highlight): CoverageType {
  if (highlight.label && highlight.label in COVERAGE_TYPES) {
    return highlight.label as CoverageType;
  }
  return "media"; // default for legacy highlights
}

/** Get the CSS color for a highlight */
export function getHighlightCssColor(highlight: Highlight): string {
  return highlight.color || COVERAGE_TYPES[getCoverageType(highlight)].color;
}

/** Get the dominant color for a span covered by multiple highlights */
export function getSpanColor(highlightIds: string[], allHighlights: Highlight[]): string {
  if (highlightIds.length === 0) return "transparent";
  const highlight = allHighlights.find((h) => h.id === highlightIds[0]);
  if (!highlight) return COVERAGE_TYPES.media.color;
  return getHighlightCssColor(highlight);
}

/** CSS variable → line variant mapping */
const LINE_VAR_MAP: Record<string, string> = {
  "var(--highlight-blue)": "var(--highlight-blue-line)",
  "var(--highlight-green)": "var(--highlight-green-line)",
  "var(--highlight-amber)": "var(--highlight-amber-line)",
  "var(--highlight-purple)": "var(--highlight-purple-line)",
  "var(--highlight-rose)": "var(--highlight-rose-line)",
};

/** Convert a highlight bg color to its higher-opacity line variant */
export function toLineColor(bgColor: string): string {
  // If it's a known CSS variable, return the line variant
  if (LINE_VAR_MAP[bgColor]) return LINE_VAR_MAP[bgColor];
  // If it's an oklch() string with alpha, bump the alpha to 55%
  return bgColor.replace(/\/\s*[\d.]+%?\s*\)/, "/ 55%)");
}

/** Get the line/accent color for a span (higher opacity for underlines & glow) */
export function getSpanLineColor(highlightIds: string[], allHighlights: Highlight[]): string {
  return toLineColor(getSpanColor(highlightIds, allHighlights));
}

// ============================================
// RENDER SPANS
// ============================================

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
