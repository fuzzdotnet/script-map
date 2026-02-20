"use client";

import { ImagePlus, Layers, Video } from "lucide-react";
import { COVERAGE_TYPES } from "@/lib/annotationEngine";

const icons = {
  media: ImagePlus,
  graphics: Layers,
  on_camera: Video,
} as const;

export function CoverageLegend() {
  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground">
      {Object.values(COVERAGE_TYPES).map((ct) => {
        const Icon = icons[ct.type];
        return (
          <div key={ct.type} className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: ct.color }}
            />
            <Icon className="h-3 w-3" />
            <span>{ct.label}</span>
          </div>
        );
      })}
    </div>
  );
}
