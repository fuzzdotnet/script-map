"use client";

import Link from "next/link";
import { ArrowLeft, Copy, Check, Download } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAnnotationStore } from "@/hooks/useAnnotationStore";
import { DownloadAllMediaDialog } from "@/components/media/DownloadAllMediaDialog";
import type { Project } from "@/lib/supabase/types";

export function TopBar({ project }: { project: Project }) {
  const [copied, setCopied] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);

  const mediaFiles = useAnnotationStore((s) => s.mediaFiles);
  const fileReferences = useAnnotationStore((s) => s.fileReferences);

  async function copyLink() {
    const url = window.location.href;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <header className="flex items-center justify-between border-b border-border px-6 py-3 bg-surface">
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-semibold truncate max-w-md">
          {project.title}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        {mediaFiles.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDownloadOpen(true)}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Download Media
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={copyLink}
          className="gap-2"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Share Link
            </>
          )}
        </Button>
      </div>

      <DownloadAllMediaDialog
        open={downloadOpen}
        onOpenChange={setDownloadOpen}
        projectId={project.id}
        projectTitle={project.title}
        mediaFiles={mediaFiles}
        fileReferences={fileReferences}
      />
    </header>
  );
}
