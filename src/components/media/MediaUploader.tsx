"use client";

import { useState, useCallback } from "react";
import { formatFileSize } from "@/lib/utils";
import { Upload, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useAnnotationStore } from "@/hooks/useAnnotationStore";
import {
  createUploadUrl,
  completeUpload,
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
  progress: number;
  error?: string;
}

function uploadWithProgress(
  url: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Upload failed — network error")));
    xhr.addEventListener("timeout", () => reject(new Error("Upload timed out")));

    xhr.send(file);
  });
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

  const updateUpload = useCallback(
    (file: File, patch: Partial<UploadItem>) =>
      setUploads((prev) =>
        prev.map((u) => (u.file === file ? { ...u, ...patch } : u))
      ),
    []
  );

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const newUploads: UploadItem[] = fileArray.map((file) => ({
        file,
        status: "pending" as const,
        progress: 0,
      }));
      setUploads((prev) => [...prev, ...newUploads]);

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];

        updateUpload(file, { status: "uploading", progress: 0 });

        try {
          // 1. Get a signed upload URL (lightweight server action, no file data)
          const { signedUrl, storagePath } = await createUploadUrl(
            projectId,
            file.name,
            file.type,
          );

          // 2. Upload directly from browser to Supabase Storage via XHR (no timeout, progress tracking)
          await uploadWithProgress(signedUrl, file, (percent) => {
            updateUpload(file, { progress: percent });
          });

          // 3. Create the DB record (lightweight server action, no file data)
          const { mediaFile } = await completeUpload({
            projectId,
            storagePath,
            filename: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
          });
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

          updateUpload(file, { status: "complete", progress: 100 });
        } catch (err) {
          updateUpload(file, {
            status: "error",
            error:
              err instanceof Error && err.message.includes("Upload permission")
                ? "Upload permission required. Ask your admin to enable uploads."
                : err instanceof Error
                  ? err.message
                  : "Upload failed",
          });
        }
      }

      onUploadComplete();
    },
    [projectId, targetType, targetId, addMediaFile, addHighlightMedia, addSectionMedia, onUploadComplete, updateUpload]
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
              className="rounded-md border border-border bg-card px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-3">
                {upload.status === "uploading" && (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                )}
                {upload.status === "complete" && (
                  <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
                )}
                {upload.status === "error" && (
                  <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                )}
                {upload.status === "pending" && (
                  <div className="h-4 w-4 shrink-0 rounded-full border-2 border-muted-foreground" />
                )}
                <span className="truncate flex-1">{upload.file.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {upload.status === "uploading"
                    ? `${upload.progress}%`
                    : formatFileSize(upload.file.size)}
                </span>
              </div>
              {upload.status === "uploading" && (
                <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-foreground rounded-full transition-[width] duration-200"
                    style={{ width: `${upload.progress}%` }}
                  />
                </div>
              )}
              {upload.status === "error" && upload.error && (
                <p className="mt-1 text-xs text-destructive">{upload.error}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
