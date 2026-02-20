"use client";

import { useState, useCallback } from "react";
import { Upload, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useAnnotationStore } from "@/hooks/useAnnotationStore";
import {
  uploadMediaFile,
  attachMediaToHighlight,
  attachMediaToSection,
} from "@/actions/media";

interface MediaUploaderProps {
  projectId: string;
  targetType: "highlight" | "section";
  targetId: string;
  onUploadComplete: () => void;
}

interface UploadItem {
  file: File;
  status: "pending" | "uploading" | "complete" | "error";
  error?: string;
}

export function MediaUploader({
  projectId,
  targetType,
  targetId,
  onUploadComplete,
}: MediaUploaderProps) {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const addMediaFile = useAnnotationStore((s) => s.addMediaFile);
  const addHighlightMedia = useAnnotationStore((s) => s.addHighlightMedia);
  const addSectionMedia = useAnnotationStore((s) => s.addSectionMedia);

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const newUploads: UploadItem[] = fileArray.map((file) => ({
        file,
        status: "pending" as const,
      }));
      setUploads((prev) => [...prev, ...newUploads]);

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];

        setUploads((prev) =>
          prev.map((u) =>
            u.file === file ? { ...u, status: "uploading" } : u
          )
        );

        try {
          const formData = new FormData();
          formData.set("file", file);
          formData.set("projectId", projectId);

          const { mediaFile } = await uploadMediaFile(formData);
          addMediaFile(mediaFile);

          // Attach to target
          if (targetType === "highlight") {
            const hm = await attachMediaToHighlight({
              highlightId: targetId,
              mediaFileId: mediaFile.id,
            });
            addHighlightMedia(hm);
          } else {
            const sm = await attachMediaToSection({
              sectionId: targetId,
              mediaFileId: mediaFile.id,
            });
            addSectionMedia(sm);
          }

          setUploads((prev) =>
            prev.map((u) =>
              u.file === file ? { ...u, status: "complete" } : u
            )
          );
        } catch (err) {
          setUploads((prev) =>
            prev.map((u) =>
              u.file === file
                ? {
                    ...u,
                    status: "error",
                    error: err instanceof Error ? err.message : "Upload failed",
                  }
                : u
            )
          );
        }
      }

      onUploadComplete();
    },
    [projectId, targetType, targetId, addMediaFile, addHighlightMedia, addSectionMedia, onUploadComplete]
  );

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  }

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 transition-colors ${
          isDragging
            ? "border-ring bg-ring/10"
            : "border-border hover:border-muted-foreground"
        }`}
      >
        <Upload className="h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground mb-1">
          Drag & drop files here
        </p>
        <p className="text-xs text-muted-foreground">
          or click to browse
        </p>
        <input
          type="file"
          multiple
          accept="image/*,video/*,audio/*"
          onChange={handleFileInput}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </div>

      {/* Upload progress */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((upload, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2 text-sm"
            >
              {upload.status === "uploading" && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
              {upload.status === "complete" && (
                <CheckCircle className="h-4 w-4 text-green-500" />
              )}
              {upload.status === "error" && (
                <AlertCircle className="h-4 w-4 text-destructive" />
              )}
              {upload.status === "pending" && (
                <div className="h-4 w-4 rounded-full border-2 border-muted-foreground" />
              )}
              <span className="truncate flex-1">{upload.file.name}</span>
              <span className="text-xs text-muted-foreground">
                {formatFileSize(upload.file.size)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
