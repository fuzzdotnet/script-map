"use client";

import { useState } from "react";
import { Monitor, X } from "lucide-react";

export function MobileBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-40 flex items-center gap-3 rounded-xl border border-white/10 bg-surface/95 backdrop-blur-md px-4 py-3 shadow-lg">
      <Monitor className="h-4 w-4 text-muted-foreground shrink-0" />
      <p className="text-xs text-muted-foreground flex-1">
        Open on desktop to add and view annotations
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
