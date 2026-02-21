"use client";

import { useEffect, useRef } from "react";
import { ImagePlus, Layers, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TextSelection } from "@/hooks/useTextSelection";

interface FloatingToolbarProps {
  selection: TextSelection;
  onMedia: () => void;
  onGraphics: () => void;
  onCamera: () => void;
  onDismiss: () => void;
}

export function FloatingToolbar({
  selection,
  onMedia,
  onGraphics,
  onCamera,
  onDismiss,
}: FloatingToolbarProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const toolbar = ref.current;
    const rect = selection.rect;

    // Position above the selection, centered
    const top = rect.top - toolbar.offsetHeight - 8 + window.scrollY;
    const left =
      rect.left + rect.width / 2 - toolbar.offsetWidth / 2 + window.scrollX;

    toolbar.style.top = `${Math.max(8, top)}px`;
    toolbar.style.left = `${Math.max(8, left)}px`;
  }, [selection.rect]);

  return (
    <div
      ref={ref}
      className="fixed z-50 flex items-center gap-0.5 rounded-lg border border-white/20 bg-[oklch(0.22_0.005_260/0.85)] backdrop-blur-md px-1 py-1 shadow-[0_4px_24px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200"
    >
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 text-xs"
        onClick={onMedia}
      >
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--highlight-blue)" }} />
        <ImagePlus className="h-3.5 w-3.5" />
        Media
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 text-xs"
        onClick={onGraphics}
      >
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--highlight-green)" }} />
        <Layers className="h-3.5 w-3.5" />
        Graphics
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 text-xs"
        onClick={onCamera}
      >
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--highlight-amber)" }} />
        <Video className="h-3.5 w-3.5" />
        On Camera
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onDismiss}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
