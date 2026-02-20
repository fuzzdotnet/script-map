"use client";

import {
  Download,
  X,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useDownloadAllMedia } from "@/hooks/useDownloadAllMedia";
import { formatFileSize } from "@/lib/utils";
import type { MediaFile, FileReference } from "@/lib/supabase/types";

const LARGE_PROJECT_THRESHOLD = 2 * 1024 * 1024 * 1024; // 2 GB

interface DownloadAllMediaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectTitle: string;
  mediaFiles: MediaFile[];
  fileReferences: FileReference[];
}

export function DownloadAllMediaDialog({
  open,
  onOpenChange,
  projectId,
  projectTitle,
  mediaFiles,
  fileReferences,
}: DownloadAllMediaDialogProps) {
  const { state, totalSizeBytes, fileCount, startDownload, cancel, reset } =
    useDownloadAllMedia({ projectId, projectTitle, mediaFiles, fileReferences });

  const isLarge = totalSizeBytes > LARGE_PROJECT_THRESHOLD;

  function handleClose() {
    if (state.status === "downloading" || state.status === "preparing") {
      cancel();
    }
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Download All Media</DialogTitle>
          <DialogDescription>
            {fileCount} file{fileCount !== 1 ? "s" : ""} (
            {formatFileSize(totalSizeBytes)})
            {fileReferences.length > 0 &&
              ` + ${fileReferences.length} file reference${fileReferences.length !== 1 ? "s" : ""} (listed in manifest)`}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          {state.status === "idle" && isLarge && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-500">Large project</p>
                <p className="text-muted-foreground mt-1">
                  This project has {formatFileSize(totalSizeBytes)} of media.
                  Downloading as a ZIP may use significant memory. Consider
                  downloading files individually for very large video files.
                </p>
              </div>
            </div>
          )}

          {state.status === "preparing" && (
            <div className="flex items-center gap-3 py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Preparing download...
              </p>
            </div>
          )}

          {state.status === "downloading" && (
            <div className="space-y-3 py-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground truncate max-w-[260px]">
                  {state.currentFile}
                </span>
                <span className="font-medium">
                  {state.completed}/{state.total}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-foreground rounded-full transition-all duration-300"
                  style={{
                    width: `${(state.completed / state.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {state.status === "complete" && (
            <div className="flex items-center gap-3 py-4">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <p className="text-sm">Download complete!</p>
            </div>
          )}

          {state.status === "error" && (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-destructive">Download failed</p>
                <p className="text-muted-foreground mt-1">{state.message}</p>
              </div>
            </div>
          )}

          {state.status === "cancelled" && (
            <div className="flex items-center gap-3 py-4">
              <X className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Download cancelled.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          {(state.status === "idle" ||
            state.status === "error" ||
            state.status === "cancelled") && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={startDownload} className="gap-2">
                <Download className="h-4 w-4" />
                {state.status === "error" || state.status === "cancelled"
                  ? "Retry"
                  : "Download ZIP"}
              </Button>
            </>
          )}

          {(state.status === "preparing" ||
            state.status === "downloading") && (
            <Button variant="outline" onClick={cancel}>
              Cancel Download
            </Button>
          )}

          {state.status === "complete" && (
            <Button onClick={handleClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
