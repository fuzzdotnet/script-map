"use client";

import { useState, useTransition } from "react";
import { FolderOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAnnotationStore } from "@/hooks/useAnnotationStore";
import {
  createFileReference,
  attachMediaToHighlight,
  attachMediaToSection,
} from "@/actions/media";

interface FileReferenceFormProps {
  projectId: string;
  targetType: "highlight" | "section";
  targetId: string;
  onComplete: () => void;
}

export function FileReferenceForm({
  projectId,
  targetType,
  targetId,
  onComplete,
}: FileReferenceFormProps) {
  const [filename, setFilename] = useState("");
  const [location, setLocation] = useState("");
  const [fileType, setFileType] = useState("video");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const addFileReference = useAnnotationStore((s) => s.addFileReference);
  const addHighlightMedia = useAnnotationStore((s) => s.addHighlightMedia);
  const addSectionMedia = useAnnotationStore((s) => s.addSectionMedia);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!filename.trim()) {
      setError("Filename is required.");
      return;
    }

    startTransition(async () => {
      try {
        const ref = await createFileReference({
          projectId,
          filename: filename.trim(),
          location: location.trim() || undefined,
          description: undefined,
          fileType,
        });

        addFileReference(ref);

        // Attach to target
        if (targetType === "highlight") {
          const hm = await attachMediaToHighlight({
            highlightId: targetId,
            fileReferenceId: ref.id,
          });
          addHighlightMedia(hm);
        } else {
          const sm = await attachMediaToSection({
            sectionId: targetId,
            fileReferenceId: ref.id,
          });
          addSectionMedia(sm);
        }

        // Reset form
        setFilename("");
        setLocation("");
        onComplete();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create reference.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3 text-muted-foreground">
          <FolderOpen className="h-4 w-4" />
          <span className="text-xs font-medium">External File Reference</span>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Point to a file in LucidLink, a shared drive, or any external location.
          The file won&apos;t be uploaded — editors will see the reference and find it themselves.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ref-filename">Filename *</Label>
        <Input
          id="ref-filename"
          placeholder="e.g. B-Roll_Interview_Jones_Take3.mov"
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ref-location">Location / Path</Label>
        <Input
          id="ref-location"
          placeholder="e.g. /Production/B-Roll/Interviews/"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ref-type">File Type</Label>
        <select
          id="ref-type"
          value={fileType}
          onChange={(e) => setFileType(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
        >
          <option value="video">Video</option>
          <option value="image">Image</option>
          <option value="audio">Audio</option>
          <option value="other">Other</option>
        </select>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Adding...
          </>
        ) : (
          "Add Reference"
        )}
      </Button>
    </form>
  );
}
