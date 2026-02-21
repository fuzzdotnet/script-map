"use client";

import { useState, useEffect, useTransition } from "react";
import { Loader2, Trash2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { inviteMember, removeMember, listMembers } from "@/actions/members";
import type { ProjectMember } from "@/lib/supabase/types";

interface InviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

export function InviteDialog({ open, onOpenChange, projectId }: InviteDialogProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"viewer" | "editor">("viewer");
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [emailWarning, setEmailWarning] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadMembers();
    }
  }, [open, projectId]);

  async function loadMembers() {
    try {
      const data = await listMembers(projectId);
      setMembers(data);
    } catch {
      // ignore
    }
  }

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Please enter an email address.");
      return;
    }

    startTransition(async () => {
      try {
        const { member, emailError } = await inviteMember(projectId, email.trim(), role);
        setMembers((prev) => [...prev, member]);
        setEmail("");
        setEmailWarning(emailError || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to invite");
      }
    });
  }

  function handleRemove(memberId: string) {
    setRemovingId(memberId);
    startTransition(async () => {
      try {
        await removeMember(memberId);
        setMembers((prev) => prev.filter((m) => m.id !== memberId));
      } catch (err) {
        console.error("Failed to remove member:", err);
      } finally {
        setRemovingId(null);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite people</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleInvite} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email address</Label>
            <div className="flex gap-2">
              <Input
                id="invite-email"
                type="email"
                placeholder="person@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" size="sm" disabled={isPending} className="gap-2 shrink-0">
                {isPending && !removingId ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
                Invite
              </Button>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRole("viewer")}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                role === "viewer"
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              Viewer
            </button>
            <button
              type="button"
              onClick={() => setRole("editor")}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                role === "editor"
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              Editor
            </button>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          {emailWarning && (
            <p className="text-sm text-yellow-500">
              Member added, but email failed: {emailWarning}
            </p>
          )}
        </form>

        {members.length > 0 && (
          <div className="mt-2 space-y-1">
            <p className="text-xs text-muted-foreground font-medium mb-2">Members</p>
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between py-2 px-2 -mx-2 rounded-lg hover:bg-surface transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-sm truncate">{member.invited_email}</span>
                  <Badge variant="outline" className="text-[0.65rem] shrink-0">
                    {member.role}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemove(member.id)}
                  disabled={removingId === member.id}
                >
                  {removingId === member.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
