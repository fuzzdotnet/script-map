import { computeRenderSpans } from "@/lib/annotationEngine";
import type { Section, Highlight } from "@/lib/supabase/types";

/** Which text the prompter shows. */
export type PrompterScope = "on_camera" | "full";

/** What a pedal press does. */
export type PedalAction = "play_pause" | "rewind" | "faster" | "slower" | "restart";

export const PEDAL_ACTIONS: { value: PedalAction; label: string }[] = [
  { value: "play_pause", label: "Play / Pause" },
  { value: "rewind", label: "Jump back" },
  { value: "faster", label: "Faster" },
  { value: "slower", label: "Slower" },
  { value: "restart", label: "Back to top" },
];

export interface PrompterSettings {
  scope: PrompterScope;
  /** rem */
  fontSize: number;
  /** pixels per second */
  speed: number;
  mirror: boolean;
  leftPedal: PedalAction;
  rightPedal: PedalAction;
}

export const DEFAULT_PROMPTER_SETTINGS: PrompterSettings = {
  scope: "on_camera",
  fontSize: 2.4,
  speed: 60,
  mirror: false,
  leftPedal: "rewind",
  rightPedal: "play_pause",
};

export const MIN_FONT = 1.2;
export const MAX_FONT = 5;
export const FONT_STEP = 0.2;
export const MIN_SPEED = 10;
export const MAX_SPEED = 300;
export const SPEED_STEP = 10;

const STORAGE_KEY = "script-map:prompter-settings";

export function loadPrompterSettings(): PrompterSettings {
  if (typeof window === "undefined") return DEFAULT_PROMPTER_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROMPTER_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<PrompterSettings>;
    return { ...DEFAULT_PROMPTER_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_PROMPTER_SETTINGS;
  }
}

export function savePrompterSettings(settings: PrompterSettings) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Private mode or storage disabled: settings just won't persist.
  }
}

/**
 * Bluetooth pedals (AirTurn DUO/PED 500, PageFlip, Donner, etc.) pair as
 * keyboards. AirTurn's keyboard modes send:
 *   Mode 2 (default): Left = ArrowUp,  Right = ArrowDown
 *   Mode 3:           Left = PageUp,   Right = PageDown
 *   Mode 5:           Left = Space,    Right = Enter
 * Mode 4 sends media keys, which iPadOS does not deliver to web pages.
 * We accept every keyboard mode so the pedal works with no setup.
 */
const LEFT_PEDAL_KEYS = new Set(["ArrowUp", "ArrowLeft", "PageUp", "Space", " "]);
const RIGHT_PEDAL_KEYS = new Set(["ArrowDown", "ArrowRight", "PageDown", "Enter"]);

export type Pedal = "left" | "right";

export function pedalForKey(e: Pick<KeyboardEvent, "code" | "key">): Pedal | null {
  if (LEFT_PEDAL_KEYS.has(e.code) || LEFT_PEDAL_KEYS.has(e.key)) return "left";
  if (RIGHT_PEDAL_KEYS.has(e.code) || RIGHT_PEDAL_KEYS.has(e.key)) return "right";
  return null;
}

/** A block of text the prompter renders. */
export interface PrompterBlock {
  key: string;
  kind: "heading" | "text";
  text: string;
}

function isHeadingSection(section: Section) {
  return (
    section.section_type === "act" ||
    section.section_type === "scene" ||
    section.section_type === "heading"
  );
}

/**
 * Builds the list of blocks to display for a given scope.
 *
 * - "full": every section, headings included, in script order.
 * - "on_camera": only text covered by on-camera highlights. Each contiguous
 *   on-camera run becomes its own block so unrelated fragments from one
 *   paragraph are not fused into a single sentence.
 */
export function buildPrompterBlocks(
  sections: Section[],
  highlights: Highlight[],
  scope: PrompterScope
): PrompterBlock[] {
  const blocks: PrompterBlock[] = [];

  if (scope === "full") {
    for (const section of sections) {
      const text = section.body.trim();
      if (!text) continue;
      blocks.push({
        key: section.id,
        kind: isHeadingSection(section) ? "heading" : "text",
        text,
      });
    }
    return blocks;
  }

  const onCameraIds = new Set(
    highlights.filter((h) => h.label === "on_camera").map((h) => h.id)
  );

  for (const section of sections) {
    if (isHeadingSection(section)) continue;
    const sectionHighlights = highlights.filter((h) => h.section_id === section.id);
    if (!sectionHighlights.some((h) => onCameraIds.has(h.id))) continue;

    const spans = computeRenderSpans(section.body, sectionHighlights);
    let run = "";
    let runIndex = 0;
    const flush = () => {
      const text = run.trim();
      if (text) blocks.push({ key: `${section.id}:${runIndex++}`, kind: "text", text });
      run = "";
    };

    for (const span of spans) {
      const onCamera = span.highlightIds.some((id) => onCameraIds.has(id));
      if (onCamera) {
        run += span.text;
      } else {
        flush();
      }
    }
    flush();
  }

  return blocks;
}
