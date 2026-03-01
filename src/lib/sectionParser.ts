export interface ParsedSection {
  title: string | null;
  body: string;
  section_type: "act" | "scene" | "paragraph" | "heading";
  /** Byte offset of `body` within the original input text */
  sourceOffset: number;
}

const ACT_PATTERN = /^ACT\s+(\w+)/i;
const SCENE_PATTERN = /^(?:SCENE|SC\.?)\s+(\w+)/i;
const INT_EXT_PATTERN = /^(?:INT|EXT|INT\.\/EXT)\./i;
const ALL_CAPS_HEADING = /^[A-Z][A-Z\s\d:,'-]{4,}$/;

function classifyLine(line: string): {
  type: "act" | "scene" | "heading" | null;
  title: string | null;
} {
  const trimmed = line.trim();

  const actMatch = trimmed.match(ACT_PATTERN);
  if (actMatch) return { type: "act", title: trimmed };

  const sceneMatch = trimmed.match(SCENE_PATTERN);
  if (sceneMatch) return { type: "scene", title: trimmed };

  if (INT_EXT_PATTERN.test(trimmed)) return { type: "scene", title: trimmed };

  if (ALL_CAPS_HEADING.test(trimmed) && trimmed.length < 80) {
    return { type: "heading", title: trimmed };
  }

  return { type: null, title: null };
}

/** Split text on blank lines, returning each chunk with its start offset in the original text */
function splitWithPositions(text: string): { text: string; offset: number }[] {
  const result: { text: string; offset: number }[] = [];
  const regex = /\n\s*\n/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    result.push({ text: text.slice(lastIndex, match.index), offset: lastIndex });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    result.push({ text: text.slice(lastIndex), offset: lastIndex });
  }

  return result;
}

export function parseScriptText(text: string): ParsedSection[] {
  const sections: ParsedSection[] = [];
  const paragraphs = splitWithPositions(text);

  for (const { text: paragraph, offset: paraOffset } of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    const trimLeading = paragraph.indexOf(trimmed);
    const bodyOffset = paraOffset + trimLeading;

    const lines = trimmed.split("\n");
    const firstLine = lines[0].trim();
    const classification = classifyLine(firstLine);

    if (classification.type && lines.length === 1) {
      // Standalone heading line
      sections.push({
        title: classification.title,
        body: trimmed,
        section_type: classification.type,
        sourceOffset: bodyOffset,
      });
    } else if (classification.type && lines.length > 1) {
      // Heading followed by body text — create heading + paragraph
      const firstLineOffset = bodyOffset + trimmed.indexOf(firstLine);
      sections.push({
        title: classification.title,
        body: firstLine,
        section_type: classification.type,
        sourceOffset: firstLineOffset,
      });
      const rest = lines.slice(1).join("\n").trim();
      if (rest) {
        const restOffset = bodyOffset + trimmed.indexOf(rest, firstLine.length);
        sections.push({
          title: null,
          body: rest,
          section_type: "paragraph",
          sourceOffset: restOffset,
        });
      }
    } else {
      // Regular paragraph
      sections.push({
        title: null,
        body: trimmed,
        section_type: "paragraph",
        sourceOffset: bodyOffset,
      });
    }
  }

  return sections;
}
