"use client";

import { useEffect, useRef } from "react";
import { ImagePlus, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TextSelection } from "@/hooks/useTextSelection";

interface FloatingToolbarProps {
  selection: TextSelection;
  onAttachMedia: () => void;
  onReferenceFile: () => void;
  onDismiss: () => void;
}

export function FloatingToolbar({
  selection,
  onAttachMedia,
  onReferenceFile,
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
      className="fixed z-50 flex items-center gap-1 rounded-lg border border-border bg-elevated px-1 py-1 shadow-xl animate-in fade-in zoom-in-95 duration-150"
    >
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 text-xs"
        onClick={onAttachMedia}
      >
        <ImagePlus className="h-3.5 w-3.5" />
        Attach Media
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 text-xs"
        onClick={onReferenceFile}
      >
        <FileText className="h-3.5 w-3.5" />
        Reference File
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
