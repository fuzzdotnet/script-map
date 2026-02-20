"use client";

import { useState, useTransition } from "react";
import { ImagePlus, Layers, Video } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { COVERAGE_TYPES, type CoverageType } from "@/lib/annotationEngine";
import { updateProjectSettings } from "@/actions/projects";

const icons = {
  media: ImagePlus,
  graphics: Layers,
  on_camera: Video,
} as const;

// Preset colors that look good at 35% opacity on dark backgrounds (OKLCH)
const COLOR_PRESETS = [
  { label: "Blue", value: "oklch(0.55 0.15 250 / 35%)" },
  { label: "Green", value: "oklch(0.55 0.15 155 / 35%)" },
  { label: "Amber", value: "oklch(0.65 0.15 80 / 35%)" },
  { label: "Rose", value: "oklch(0.55 0.15 10 / 35%)" },
  { label: "Purple", value: "oklch(0.55 0.15 300 / 35%)" },
  { label: "Cyan", value: "oklch(0.55 0.15 200 / 35%)" },
  { label: "Lime", value: "oklch(0.65 0.18 130 / 35%)" },
  { label: "Orange", value: "oklch(0.65 0.18 50 / 35%)" },
] as const;

interface CoverageLegendProps {
  projectId: string;
  coverageColors?: Record<string, string>;
}

export function CoverageLegend({ projectId, coverageColors }: CoverageLegendProps) {
  const [colors, setColors] = useState<Record<string, string>>(coverageColors || {});
  const [isPending, startTransition] = useTransition();

  function getColor(type: CoverageType): string {
    return colors[type] || COVERAGE_TYPES[type].color;
  }

  function handleColorChange(type: CoverageType, color: string) {
    const updated = { ...colors, [type]: color };
    setColors(updated);

    // Apply CSS variable override immediately
    const varName = type === "media" ? "--highlight-blue" : type === "graphics" ? "--highlight-green" : "--highlight-amber";
    document.documentElement.style.setProperty(varName, color);

    // Persist to DB
    startTransition(async () => {
      try {
        await updateProjectSettings(projectId, { coverageColors: updated });
      } catch (err) {
        console.error("Failed to save color:", err);
      }
    });
  }

  return (
    <div className="fixed bottom-4 left-4 z-40 flex items-center gap-3 rounded-full border border-white/15 bg-surface/90 backdrop-blur-sm px-4 py-2 text-xs text-muted-foreground shadow-lg">
      {Object.values(COVERAGE_TYPES).map((ct) => {
        const Icon = icons[ct.type];
        return (
          <Popover key={ct.type}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                <span
                  className="h-3 w-3 rounded-full ring-1 ring-white/15"
                  style={{ backgroundColor: getColor(ct.type) }}
                />
                <Icon className="h-3 w-3" />
                <span>{ct.label}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="top"
              align="start"
              className="w-auto p-2"
            >
              <p className="text-xs font-medium mb-2 px-1">{ct.label} color</p>
              <div className="grid grid-cols-4 gap-1.5">
                {COLOR_PRESETS.map((preset) => {
                  const isActive = getColor(ct.type) === preset.value;
                  return (
                    <button
                      key={preset.label}
                      title={preset.label}
                      disabled={isPending}
                      className={`h-6 w-6 rounded-md transition-transform hover:scale-110 ${isActive ? "ring-2 ring-foreground ring-offset-1 ring-offset-surface" : "ring-1 ring-white/10"}`}
                      style={{ backgroundColor: preset.value }}
                      onClick={() => handleColorChange(ct.type, preset.value)}
                    />
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        );
      })}
    </div>
  );
}
