"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, Shield, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { setCanUpload, deleteUser } from "@/actions/admin";
import type { AdminUser } from "@/actions/admin";

export function UserTable({ users }: { users: AdminUser[] }) {
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  function handleDelete() {
    if (!deleteTarget) return;
    startDeleteTransition(async () => {
      await deleteUser(deleteTarget.id);
      setDeleteTarget(null);
      router.refresh();
    });
  }

  return (
    <>
      <div className="space-y-1">
        {users.map((user) => (
          <UserRow
            key={user.id}
            user={user}
            onDelete={() => setDeleteTarget(user)}
          />
        ))}
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete user?</DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>{deleteTarget?.display_name}</strong> ({deleteTarget?.email}),
              all their projects, and all associated data. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function UserRow({
  user,
  onDelete,
}: {
  user: AdminUser;
  onDelete: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function toggleUpload() {
    startTransition(async () => {
      await setCanUpload(user.id, !user.can_upload);
      router.refresh();
    });
  }

  return (
    <div className="group flex items-center justify-between rounded-xl px-3 py-3.5 -mx-3 hover:bg-purple-500/[0.04] transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-500/10">
          {user.is_admin ? (
            <Shield className="h-4 w-4 text-purple-300/70" />
          ) : (
            <div className="h-4 w-4 rounded-full bg-muted-foreground/20" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[0.9rem] font-medium truncate leading-snug">
              {user.display_name}
            </p>
            {user.is_admin && (
              <span className="text-[0.6rem] uppercase tracking-wider text-purple-400 font-semibold">
                Admin
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground/60 truncate">
            {user.email}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleUpload}
          disabled={isPending}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            user.can_upload
              ? "bg-purple-500/15 text-purple-300 hover:bg-purple-500/25"
              : "bg-surface text-muted-foreground/50 hover:bg-elevated hover:text-muted-foreground"
          }`}
        >
          {isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Upload className="h-3 w-3" />
          )}
          {user.can_upload ? "Can upload" : "No upload"}
        </button>

        {!user.is_admin && (
          <button
            onClick={onDelete}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
