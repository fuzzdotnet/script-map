"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Copy,
  Check,
  Clock,
  Download,
  Pencil,
  UserPlus,
  BookmarkPlus,
} from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAnnotationStore } from "@/hooks/useAnnotationStore";
import { DownloadAllMediaDialog } from "@/components/media/DownloadAllMediaDialog";
import { InviteDialog } from "@/components/InviteDialog";
import { joinProject } from "@/actions/members";
import type { Project } from "@/lib/supabase/types";
import type { ProjectRole } from "@/actions/projects";

interface TopBarProps {
  project: Project;
  canEdit?: boolean;
  role?: ProjectRole | "none";
  isMember?: boolean;
  isLoggedIn?: boolean;
  ownerEmail?: string;
}

export function TopBar({
  project,
  canEdit,
  role = "none",
  isMember = false,
  isLoggedIn = false,
  ownerEmail,
}: TopBarProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [joining, startJoinTransition] = useTransition();
  const [joined, setJoined] = useState(false);

  const mediaFiles = useAnnotationStore((s) => s.mediaFiles);
  const fileReferences = useAnnotationStore((s) => s.fileReferences);

  async function copyLink() {
    const url = window.location.href;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleJoin() {
    startJoinTransition(async () => {
      try {
        await joinProject(project.id);
        setJoined(true);
        router.refresh();
      } catch (err) {
        console.error("Failed to join:", err);
      }
    });
  }

  const backHref = isMember || role === "owner" ? "/dashboard" : "/";

  return (
    <TooltipProvider>
      <header className="flex items-center justify-between border-b border-[oklch(0.22_0.06_290)] px-3 py-2 md:px-6 md:py-3 bg-gradient-to-r from-[oklch(0.14_0.07_295)] via-[oklch(0.13_0.05_280)] to-[oklch(0.11_0.03_265)]">
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
          <Link
            href={backHref}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-sm md:text-lg font-semibold truncate">
            {project.title}
          </h1>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {mediaFiles.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setDownloadOpen(true)}
                  className="h-8 w-8 hidden md:inline-flex"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Download Media</TooltipContent>
            </Tooltip>
          )}

          {canEdit && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href={`/p/${project.share_token}/edit`} className="hidden md:inline-flex">
                  <Button variant="outline" size="icon" className="h-8 w-8">
                    <Pencil className="h-4 w-4" />
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="bottom">Edit Script</TooltipContent>
            </Tooltip>
          )}

          {role !== "none" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href={`/p/${project.share_token}/history`} className="hidden md:inline-flex">
                  <Button variant="outline" size="icon" className="h-8 w-8">
                    <Clock className="h-4 w-4" />
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="bottom">History</TooltipContent>
            </Tooltip>
          )}

          {role === "owner" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setInviteOpen(true)}
                  className="h-8 w-8 hidden md:inline-flex"
                >
                  <UserPlus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Invite</TooltipContent>
            </Tooltip>
          )}

          {isLoggedIn && !isMember && role === "none" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleJoin}
                  disabled={joining || joined}
                  className="h-8 w-8"
                >
                  <BookmarkPlus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {joined ? "Saved" : joining ? "Saving..." : "Save to Dashboard"}
              </TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={copyLink}
                className="h-8 w-8"
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {copied ? "Copied" : "Share Link"}
            </TooltipContent>
          </Tooltip>
        </div>

        <DownloadAllMediaDialog
          open={downloadOpen}
          onOpenChange={setDownloadOpen}
          projectId={project.id}
          projectTitle={project.title}
          mediaFiles={mediaFiles}
          fileReferences={fileReferences}
        />

        {role === "owner" && (
          <InviteDialog
            open={inviteOpen}
            onOpenChange={setInviteOpen}
            projectId={project.id}
            ownerEmail={ownerEmail}
          />
        )}
      </header>
    </TooltipProvider>
  );
}
