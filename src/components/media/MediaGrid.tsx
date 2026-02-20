"use client";

import { useState, useEffect, useTransition } from "react";
import {
  Download,
  Play,
  Trash2,
  Image as ImageIcon,
  FileVideo,
  FileAudio,
  File,
  FolderOpen,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAnnotationStore } from "@/hooks/useAnnotationStore";
import {
  getSignedUrl,
  deleteMediaFile,
  deleteFileReference,
} from "@/actions/media";
import type { MediaFile, FileReference } from "@/lib/supabase/types";

interface MediaGridProps {
  uploaded: MediaFile[];
  references: FileReference[];
  projectId: string;
}

export function MediaGrid({ uploaded, references }: MediaGridProps) {
  return (
    <div className="space-y-4">
      {/* Uploaded media */}
      {uploaded.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Uploaded Media
          </h4>
          <div className="space-y-2">
            {uploaded.map((file) => (
              <UploadedMediaCard key={file.id} file={file} />
            ))}
          </div>
        </div>
      )}

      {/* File references */}
      {references.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            File References
          </h4>
          <div className="space-y-2">
            {references.map((ref) => (
              <FileReferenceCard key={ref.id} reference={ref} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function UploadedMediaCard({ file }: { file: MediaFile }) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [fullUrl, setFullUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const removeMediaFile = useAnnotationStore((s) => s.removeMediaFile);

  const isImage = file.mime_type.startsWith("image/");
  const isVideo = file.mime_type.startsWith("video/");
  const isAudio = file.mime_type.startsWith("audio/");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (isImage) {
          const url = await getSignedUrl(file.storage_path, { width: 400 });
          if (!cancelled) setThumbnailUrl(url);
        } else if (isVideo) {
          const url = await getSignedUrl(file.storage_path);
          if (!cancelled) setThumbnailUrl(url);
        }
      } catch {
        try {
          const url = await getSignedUrl(file.storage_path);
          if (!cancelled) setThumbnailUrl(url);
        } catch {
          // icon fallback
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [file.storage_path, isImage, isVideo]);

  async function handleDownload() {
    try {
      const url = fullUrl || (await getSignedUrl(file.storage_path));
      if (!fullUrl) setFullUrl(url);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.filename;
      a.click();
    } catch {
      // Download failed
    }
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteMediaFile(file.id, file.storage_path);
        removeMediaFile(file.id);
      } catch (err) {
        console.error("Failed to delete media:", err);
      }
    });
  }

  return (
    <div className={`group rounded-lg border border-border bg-card overflow-hidden ${isPending ? "opacity-50 pointer-events-none" : ""}`}>
      {(isImage || isVideo) && (
        <div
          className="relative w-full bg-elevated flex items-center justify-center overflow-hidden"
          style={{ minHeight: "120px", maxHeight: "240px" }}
        >
          {thumbnailUrl && isImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnailUrl}
              alt={file.filename}
              className="w-full h-auto max-h-[240px] object-contain"
            />
          )}
          {thumbnailUrl && isVideo && (
            <video
              src={`${thumbnailUrl}#t=1`}
              className="w-full h-auto max-h-[240px] object-contain"
              muted
              playsInline
              preload="metadata"
            />
          )}
          {!thumbnailUrl && (
            <div className="py-8 text-muted-foreground animate-pulse">
              {isImage ? <ImageIcon className="h-8 w-8" /> : <FileVideo className="h-8 w-8" />}
            </div>
          )}

          {isVideo && thumbnailUrl && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
              <Play className="h-8 w-8 text-white" fill="white" />
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="text-muted-foreground shrink-0">
          {isImage && <ImageIcon className="h-4 w-4" />}
          {isVideo && <FileVideo className="h-4 w-4" />}
          {isAudio && <FileAudio className="h-4 w-4" />}
          {!isImage && !isVideo && !isAudio && <File className="h-4 w-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{file.filename}</p>
          <p className="text-[0.65rem] text-muted-foreground/60">
            {formatFileSize(file.size_bytes)}
          </p>
        </div>
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleDownload}>
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={handleDelete}
            disabled={isPending}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function FileReferenceCard({ reference }: { reference: FileReference }) {
  const [isPending, startTransition] = useTransition();
  const removeFileReference = useAnnotationStore((s) => s.removeFileReference);

  const typeIcon: Record<string, React.ReactNode> = {
    video: <FileVideo className="h-4 w-4" />,
    image: <ImageIcon className="h-4 w-4" />,
    audio: <FileAudio className="h-4 w-4" />,
    other: <File className="h-4 w-4" />,
  };

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteFileReference(reference.id);
        removeFileReference(reference.id);
      } catch (err) {
        console.error("Failed to delete reference:", err);
      }
    });
  }

  return (
    <div className={`group rounded-lg border border-border bg-card p-3 ${isPending ? "opacity-50 pointer-events-none" : ""}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-muted-foreground">
          {typeIcon[reference.file_type] || typeIcon.other}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{reference.filename}</p>
          {reference.location && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3" />
              <span className="truncate">{reference.location}</span>
            </p>
          )}
          {reference.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {reference.description}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleDelete}
          disabled={isPending}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
