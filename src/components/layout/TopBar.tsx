"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Copy,
  Check,
  Download,
  Pencil,
  UserPlus,
  BookmarkPlus,
} from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
    <header className="flex items-center justify-between border-b border-[oklch(0.22_0.06_290)] px-6 py-3 bg-gradient-to-r from-[oklch(0.14_0.07_295)] via-[oklch(0.13_0.05_280)] to-[oklch(0.11_0.03_265)]">
      <div className="flex items-center gap-4">
        <Link
          href={backHref}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-semibold truncate max-w-md">
          {project.title}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        {mediaFiles.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDownloadOpen(true)}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Download Media
          </Button>
        )}

        {canEdit && (
          <Link href={`/p/${project.share_token}/edit`}>
            <Button variant="outline" size="sm" className="gap-2">
              <Pencil className="h-4 w-4" />
              Edit Script
            </Button>
          </Link>
        )}

        {role === "owner" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setInviteOpen(true)}
            className="gap-2"
          >
            <UserPlus className="h-4 w-4" />
            Invite
          </Button>
        )}

        {isLoggedIn && !isMember && role === "none" && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleJoin}
            disabled={joining || joined}
            className="gap-2"
          >
            <BookmarkPlus className="h-4 w-4" />
            {joined ? "Saved" : joining ? "Saving..." : "Save to Dashboard"}
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={copyLink}
          className="gap-2"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Share Link
            </>
          )}
        </Button>
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
  );
}
