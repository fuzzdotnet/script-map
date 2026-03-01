"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { revertToVersion } from "@/actions/versions";
import type { Profile, ScriptVersion } from "@/lib/supabase/types";

interface VersionHistoryListProps {
  versions: Omit<ScriptVersion, "snapshot">[];
  profiles: Record<string, Profile>;
  canEdit: boolean;
  projectId: string;
  shareToken: string;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function VersionHistoryList({
  versions,
  profiles,
  canEdit,
  projectId,
  shareToken,
}: VersionHistoryListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmVersion, setConfirmVersion] = useState<
    Omit<ScriptVersion, "snapshot"> | null
  >(null);

  function handleRevert() {
    if (!confirmVersion) return;
    const versionId = confirmVersion.id;

    startTransition(async () => {
      try {
        await revertToVersion(projectId, versionId);
        setConfirmVersion(null);
        router.push(`/p/${shareToken}`);
        router.refresh();
      } catch (err) {
        console.error("Failed to revert:", err);
      }
    });
  }

  return (
    <>
      <div className="space-y-2">
        {versions.map((version) => {
          const creator = version.created_by
            ? profiles[version.created_by]
            : null;

          return (
            <div
              key={version.id}
              className="flex items-center gap-4 rounded-lg border border-border px-4 py-3 hover:bg-muted/30 transition-colors"
            >
              <div className="shrink-0 w-10 text-center">
                <span className="text-xs font-mono font-medium text-muted-foreground">
                  v{version.version_number}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{version.label}</p>
                <p className="text-xs text-muted-foreground">
                  {timeAgo(version.created_at)}
                  {creator && (
                    <span className="ml-1">
                      by {creator.display_name}
                    </span>
                  )}
                </p>
              </div>

              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmVersion(version)}
                  className="gap-2 shrink-0"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restore
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <Dialog
        open={!!confirmVersion}
        onOpenChange={(open) => !open && setConfirmVersion(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Restore to v{confirmVersion?.version_number}?
            </DialogTitle>
            <DialogDescription>
              This will replace all current sections and highlights with the
              snapshot from{" "}
              {confirmVersion &&
                new Date(confirmVersion.created_at).toLocaleString()}
              . A snapshot of the current state will be saved first, so this
              action can be undone.
            </DialogDescription>
          </DialogHeader>
          <p className="text-xs text-muted-foreground/70">
            Note: Media attachments and comments on highlights may be lost.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmVersion(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleRevert} disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Restoring...
                </>
              ) : (
                "Restore"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
