"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, FileText, Layers, MoreHorizontal, Pencil, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteProject } from "@/actions/projects";
import type { Project } from "@/lib/supabase/types";

interface ProjectWithStats extends Project {
  sectionCount: number;
  highlightCount: number;
}

export function ProjectList({ projects }: { projects: ProjectWithStats[] }) {
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<ProjectWithStats | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      try {
        await deleteProject(deleteTarget.id);
        setDeleteTarget(null);
        router.refresh();
      } catch (err) {
        console.error("Failed to delete:", err);
      }
    });
  }

  return (
    <>
      <div className="space-y-1">
        {projects.map((project) => (
          <div
            key={project.id}
            className="group flex items-center rounded-xl -mx-3 hover:bg-surface transition-colors duration-150"
          >
            <Link
              href={`/p/${project.share_token}`}
              className="flex flex-1 items-center gap-4 px-3 py-3.5 min-w-0"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface group-hover:bg-elevated transition-colors">
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[0.9rem] font-medium truncate leading-snug">
                  {project.title}
                </p>
                <div className="flex items-center gap-2.5 mt-1">
                  <span className="text-xs text-muted-foreground/60">
                    {formatRelativeDate(project.updated_at)}
                  </span>
                  <span className="text-[0.4rem] text-muted-foreground/30">
                    ·
                  </span>
                  <span className="text-xs text-muted-foreground/60">
                    {project.sectionCount} section{project.sectionCount !== 1 ? "s" : ""}
                  </span>
                  {project.highlightCount > 0 && (
                    <>
                      <span className="text-[0.4rem] text-muted-foreground/30">·</span>
                      <span className="text-xs text-muted-foreground/60 flex items-center gap-1">
                        <Layers className="h-3 w-3" />
                        {project.highlightCount}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </Link>

            <div className="pr-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/p/${project.share_token}/edit`}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit script
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `${window.location.origin}/p/${project.share_token}`
                      );
                    }}
                  >
                    <Link2 className="h-4 w-4 mr-2" />
                    Copy link
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setDeleteTarget(project)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete project?</DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>{deleteTarget?.title}</strong> and
              all its sections, highlights, and media. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
