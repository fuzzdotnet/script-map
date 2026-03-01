import DiffMatchPatch from "diff-match-patch";
import type { Section, Highlight } from "@/lib/supabase/types";
import type { ParsedSection } from "@/lib/sectionParser";

type Diff = [number, string];

interface SectionBoundary {
  sectionId: string;
  start: number; // inclusive, in full text
  end: number; // exclusive, in full text
}

export interface RemappedHighlight {
  highlightId: string;
  newSectionIndex: number;
  newStartOffset: number;
  newEndOffset: number;
}

/**
 * Build full text from sections (same as the edit page does)
 * and compute where each section sits in the full text.
 */
function buildFullText(sections: Section[]): {
  text: string;
  boundaries: SectionBoundary[];
} {
  const boundaries: SectionBoundary[] = [];
  let offset = 0;

  for (let i = 0; i < sections.length; i++) {
    const len = sections[i].body.length;
    boundaries.push({
      sectionId: sections[i].id,
      start: offset,
      end: offset + len,
    });
    offset += len;
    if (i < sections.length - 1) {
      offset += 2; // "\n\n" separator
    }
  }

  return {
    text: sections.map((s) => s.body).join("\n\n"),
    boundaries,
  };
}

/**
 * Remap a single offset from old-text coordinates to new-text coordinates.
 *
 * The `side` parameter controls boundary behavior when text is inserted
 * exactly at the offset position:
 * - "start": use strict `<` — insertions at the offset push it forward
 *   (so a highlight start doesn't absorb text inserted right before it)
 * - "end": use `<=` — insertions at the offset stay outside
 *   (so a highlight end doesn't expand to include text inserted right after it)
 *
 * For deleted regions, snaps to the boundary of the deletion in new-text
 * coordinates rather than dropping the offset entirely.
 */
function remapOffset(
  diffs: Diff[],
  oldOffset: number,
  side: "start" | "end"
): number {
  let oldPos = 0;
  let newPos = 0;

  for (const [op, text] of diffs) {
    const len = text.length;

    if (op === DiffMatchPatch.DIFF_EQUAL) {
      const inRange =
        side === "end"
          ? oldOffset <= oldPos + len
          : oldOffset < oldPos + len;
      if (inRange) {
        return newPos + (oldOffset - oldPos);
      }
      oldPos += len;
      newPos += len;
    } else if (op === DiffMatchPatch.DIFF_DELETE) {
      if (oldOffset < oldPos + len) {
        return newPos; // snap to boundary of deletion
      }
      oldPos += len;
    } else if (op === DiffMatchPatch.DIFF_INSERT) {
      newPos += len;
    }
  }

  return newPos;
}

/**
 * Compute new section boundaries from parsed sections using their sourceOffset.
 */
function newSectionBoundaries(
  sections: ParsedSection[]
): { start: number; end: number }[] {
  return sections.map((s) => ({
    start: s.sourceOffset,
    end: s.sourceOffset + s.body.length,
  }));
}

/**
 * Find which new section a given full-text offset falls within.
 * Returns the section index, or -1 if the offset falls in a gap.
 */
function findSectionForOffset(
  boundaries: { start: number; end: number }[],
  offset: number
): number {
  for (let i = 0; i < boundaries.length; i++) {
    if (offset >= boundaries[i].start && offset < boundaries[i].end) {
      return i;
    }
  }
  // Check if offset is at the very end of the last section
  if (
    boundaries.length > 0 &&
    offset === boundaries[boundaries.length - 1].end
  ) {
    return boundaries.length - 1;
  }
  return -1;
}

/**
 * Remap all highlights from old sections to new sections using a character-level diff.
 *
 * Returns an array of remapped highlights (only the ones that survived the edit).
 * Highlights whose text was deleted or that can't be cleanly assigned to a new
 * section are omitted — they'll be cascade-deleted when old sections are removed.
 */
export function remapHighlights(
  oldSections: Section[],
  highlights: Highlight[],
  newFullText: string,
  newParsedSections: ParsedSection[]
): RemappedHighlight[] {
  if (highlights.length === 0) return [];

  // 1. Build old full text and section boundaries
  const { text: oldFullText, boundaries: oldBoundaries } =
    buildFullText(oldSections);

  // 2. Compute character-level diff
  const dmp = new DiffMatchPatch();
  const diffs = dmp.diff_main(oldFullText, newFullText);
  dmp.diff_cleanupEfficiency(diffs);

  // 3. Compute new section boundaries from source offsets
  const newBounds = newSectionBoundaries(newParsedSections);

  // 4. Remap each highlight
  const result: RemappedHighlight[] = [];

  // Build a lookup for old section start offsets
  const oldStartBySection = new Map<string, number>();
  for (const b of oldBoundaries) {
    oldStartBySection.set(b.sectionId, b.start);
  }

  for (const h of highlights) {
    const sectionStart = oldStartBySection.get(h.section_id);
    if (sectionStart === undefined) continue; // orphaned highlight

    // Convert to full-text coordinates
    const fullStart = sectionStart + h.start_offset;
    const fullEnd = sectionStart + h.end_offset;

    // Remap through the diff
    // "start" side: insertions at the boundary push the start forward
    // "end" side: insertions at the boundary stay outside the highlight
    const newStart = remapOffset(diffs, fullStart, "start");
    const newEnd = remapOffset(diffs, fullEnd, "end");

    // If the highlight collapsed to zero width, it's been fully deleted
    if (newStart >= newEnd) continue;

    // Find which new section the start falls in
    const sectionIdx = findSectionForOffset(newBounds, newStart);
    if (sectionIdx === -1) continue; // falls in a gap between sections

    const sectionBound = newBounds[sectionIdx];

    // Clamp end to section boundary (in case it crosses into next section)
    const clampedEnd = Math.min(newEnd, sectionBound.end);

    // Convert to section-relative offsets
    const newStartOffset = newStart - sectionBound.start;
    const newEndOffset = clampedEnd - sectionBound.start;

    // Validate: must satisfy DB constraint end_offset > start_offset
    // and offsets must be within section body bounds
    if (newStartOffset >= newEndOffset) continue;
    if (newStartOffset < 0) continue;
    if (newEndOffset > newParsedSections[sectionIdx].body.length) continue;

    result.push({
      highlightId: h.id,
      newSectionIndex: sectionIdx,
      newStartOffset,
      newEndOffset,
    });
  }

  return result;
}
