"use client";

import { useState, useCallback, useRef } from "react";
import { downloadZip } from "client-zip";
import { getSignedUrlsForProject } from "@/actions/media";
import type { MediaFile, FileReference } from "@/lib/supabase/types";

export type DownloadState =
  | { status: "idle" }
  | { status: "preparing" }
  | { status: "downloading"; completed: number; total: number; currentFile: string }
  | { status: "complete" }
  | { status: "error"; message: string }
  | { status: "cancelled" };

interface UseDownloadAllMediaOptions {
  projectId: string;
  projectTitle: string;
  mediaFiles: MediaFile[];
  fileReferences: FileReference[];
}

export function useDownloadAllMedia({
  projectId,
  projectTitle,
  mediaFiles,
  fileReferences,
}: UseDownloadAllMediaOptions) {
  const [state, setState] = useState<DownloadState>({ status: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  const totalSizeBytes = mediaFiles.reduce((sum, f) => sum + f.size_bytes, 0);
  const fileCount = mediaFiles.length;

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setState({ status: "cancelled" });
  }, []);

  const reset = useCallback(() => {
    setState({ status: "idle" });
  }, []);

  const startDownload = useCallback(async () => {
    if (mediaFiles.length === 0) {
      setState({ status: "error", message: "No media files to download." });
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setState({ status: "preparing" });
      const signedFiles = await getSignedUrlsForProject(projectId);

      if (controller.signal.aborted) return;

      let completed = 0;

      // De-duplicate filenames
      const nameCount = new Map<string, number>();
      const uniqueNames = signedFiles.map((f) => {
        const count = nameCount.get(f.filename) ?? 0;
        nameCount.set(f.filename, count + 1);
        if (count === 0) return f.filename;
        const ext = f.filename.lastIndexOf(".");
        if (ext === -1) return `${f.filename} (${count})`;
        return `${f.filename.slice(0, ext)} (${count})${f.filename.slice(ext)}`;
      });

      async function* generateFiles() {
        for (let i = 0; i < signedFiles.length; i++) {
          if (controller.signal.aborted) return;

          const file = signedFiles[i];
          setState({
            status: "downloading",
            completed,
            total: signedFiles.length,
            currentFile: file.filename,
          });

          const response = await fetch(file.url, {
            signal: controller.signal,
          });

          if (!response.ok) {
            throw new Error(`Failed to fetch ${file.filename}: ${response.status}`);
          }

          yield {
            name: uniqueNames[i],
            lastModified: new Date(),
            input: response,
          };

          completed++;
        }

        // Include a manifest of file references if any exist
        if (fileReferences.length > 0) {
          const manifest = fileReferences
            .map((ref) => {
              let line = `- ${ref.filename}`;
              if (ref.file_type !== "other") line += ` [${ref.file_type}]`;
              if (ref.location) line += `\n  Location: ${ref.location}`;
              if (ref.description) line += `\n  Description: ${ref.description}`;
              return line;
            })
            .join("\n\n");

          yield {
            name: "_file_references.txt",
            lastModified: new Date(),
            input: new Blob([
              `File References (not included in ZIP)\n${"=".repeat(44)}\n\n${manifest}\n`,
            ]),
          };
        }
      }

      const blob = await downloadZip(generateFiles()).blob();

      if (controller.signal.aborted) return;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safeName =
        projectTitle.replace(/[^a-zA-Z0-9\s\-_]/g, "").trim() || "project";
      a.href = url;
      a.download = `${safeName} - Media.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setState({ status: "complete" });
    } catch (err) {
      if (controller.signal.aborted) {
        setState({ status: "cancelled" });
      } else {
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Download failed.",
        });
      }
    }
  }, [projectId, projectTitle, mediaFiles, fileReferences]);

  return {
    state,
    totalSizeBytes,
    fileCount,
    startDownload,
    cancel,
    reset,
  };
}
