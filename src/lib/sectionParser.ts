export interface ParsedSection {
  title: string | null;
  body: string;
  section_type: "act" | "scene" | "paragraph" | "heading";
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

export function parseScriptText(text: string): ParsedSection[] {
  const sections: ParsedSection[] = [];
  const paragraphs = text.split(/\n\s*\n/);

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    const lines = trimmed.split("\n");
    const firstLine = lines[0].trim();
    const classification = classifyLine(firstLine);

    if (classification.type && lines.length === 1) {
      // Standalone heading line
      sections.push({
        title: classification.title,
        body: trimmed,
        section_type: classification.type,
      });
    } else if (classification.type && lines.length > 1) {
      // Heading followed by body text — create heading + paragraph
      sections.push({
        title: classification.title,
        body: firstLine,
        section_type: classification.type,
      });
      const rest = lines.slice(1).join("\n").trim();
      if (rest) {
        sections.push({
          title: null,
          body: rest,
          section_type: "paragraph",
        });
      }
    } else {
      // Regular paragraph
      sections.push({
        title: null,
        body: trimmed,
        section_type: "paragraph",
      });
    }
  }

  return sections;
}
