"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { StickyNote, Trash2, Send, Loader2 } from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useAnnotationStore } from "@/hooks/useAnnotationStore";
import { createStickyNote, deleteStickyNote } from "@/actions/notes";

interface StickyNotePopoverProps {
  sectionId: string;
  projectId: string;
  canComment: boolean;
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function StickyNotePopover({ sectionId, projectId, canComment }: StickyNotePopoverProps) {
  const allNotes = useAnnotationStore((s) => s.notes);
  const addNote = useAnnotationStore((s) => s.addNote);
  const removeNote = useAnnotationStore((s) => s.removeNote);
  const profiles = useAnnotationStore((s) => s.profiles);
  const currentUserId = useAnnotationStore((s) => s.currentUserId);

  const sectionNotes = allNotes.filter((n) => n.section_id === sectionId);
  const hasNotes = sectionNotes.length > 0;

  const [isOpen, setIsOpen] = useState(false);
  const [newBody, setNewBody] = useState("");
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  function handleCreate() {
    const trimmed = newBody.trim();
    if (!trimmed) return;

    startTransition(async () => {
      try {
        const note = await createStickyNote(projectId, sectionId, trimmed);
        addNote(note);
        setNewBody("");
      } catch (err) {
        console.error("Failed to create note:", err);
      }
    });
  }

  function handleDelete(noteId: string) {
    removeNote(noteId);
    startTransition(async () => {
      try {
        await deleteStickyNote(noteId);
      } catch (err) {
        console.error("Failed to delete note:", err);
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleCreate();
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className={`relative text-muted-foreground hover:text-amber-500 transition-all ${
            hasNotes
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100"
          }`}
          title={hasNotes ? `${sectionNotes.length} note${sectionNotes.length !== 1 ? "s" : ""}` : "Add a note"}
        >
          <StickyNote className="h-3.5 w-3.5" />
          {hasNotes && (
            <span className="absolute -top-1 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500/80 text-[0.55rem] font-bold text-black">
              {sectionNotes.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="right"
        sideOffset={12}
        className="w-80 p-0"
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-xs font-semibold text-muted-foreground">
            Notes ({sectionNotes.length})
          </span>
        </div>

        <div className="max-h-64 overflow-y-auto">
          {sectionNotes.length === 0 && !canComment && (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              No notes yet.
            </div>
          )}

          {sectionNotes.length === 0 && canComment && (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              No notes yet. Add one below.
            </div>
          )}

          {sectionNotes.map((note) => {
            const profile = note.user_id ? profiles[note.user_id] : null;
            const isOwn = note.user_id === currentUserId;

            return (
              <div key={note.id} className="group/note px-3 py-2 border-b border-border last:border-b-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium">
                    {profile?.display_name ?? "Unknown"}
                  </span>
                  <span className="text-[0.6rem] text-muted-foreground/50">
                    {formatTime(note.created_at)}
                  </span>
                  {isOwn && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-auto h-5 w-5 shrink-0 text-destructive hover:text-destructive opacity-0 group-hover/note:opacity-100 transition-opacity"
                      onClick={() => handleDelete(note.id)}
                      disabled={isPending}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <p className="text-sm text-foreground/80 mt-1 whitespace-pre-wrap">
                  {note.body}
                </p>
              </div>
            );
          })}
        </div>

        {canComment && (
          <div className="flex gap-2 items-end p-3 border-t border-border">
            <textarea
              ref={inputRef}
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add a note..."
              rows={1}
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={handleCreate}
              disabled={isPending || !newBody.trim()}
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
