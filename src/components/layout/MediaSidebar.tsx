"use client";

import { useState, useEffect, useRef, useMemo, useCallback, useTransition } from "react";
import { X, Upload, FileText, ImagePlus, Layers, Video, Trash2, MessageSquare, Send, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useAnnotationStore } from "@/hooks/useAnnotationStore";
import { MediaUploader } from "@/components/media/MediaUploader";
import { FileReferenceForm } from "@/components/media/FileReferenceForm";
import { MediaGrid } from "@/components/media/MediaGrid";
import { deleteHighlight, updateHighlightNote } from "@/actions/highlights";
import { addComment, deleteComment } from "@/actions/comments";
import { getCoverageType, COVERAGE_TYPES } from "@/lib/annotationEngine";
import type { MediaFile, FileReference } from "@/lib/supabase/types";

interface MediaSidebarProps {
  projectId: string;
  canEdit?: boolean;
  canComment?: boolean;
}

export function MediaSidebar({ projectId, canEdit = false, canComment = false }: MediaSidebarProps) {
  const sidebarOpen = useAnnotationStore((s) => s.sidebarOpen);
  const closeSidebar = useAnnotationStore((s) => s.closeSidebar);
  const selectedHighlightId = useAnnotationStore((s) => s.selectedHighlightId);
  const selectedSectionId = useAnnotationStore((s) => s.selectedSectionId);
  const removeHighlight = useAnnotationStore((s) => s.removeHighlight);

  // Select raw arrays (stable references)
  const allHighlights = useAnnotationStore((s) => s.highlights);
  const allHighlightMedia = useAnnotationStore((s) => s.highlightMedia);
  const allSectionMedia = useAnnotationStore((s) => s.sectionMedia);
  const allMediaFiles = useAnnotationStore((s) => s.mediaFiles);
  const allFileReferences = useAnnotationStore((s) => s.fileReferences);
  const allComments = useAnnotationStore((s) => s.comments);
  const profiles = useAnnotationStore((s) => s.profiles);
  const currentUserId = useAnnotationStore((s) => s.currentUserId);

  const activeTab = useAnnotationStore((s) => s.sidebarTab);
  const setActiveTab = useAnnotationStore((s) => s.setSidebarTab);

  const [isDeleting, startDeleteTransition] = useTransition();

  // Get the selected highlight and its coverage type
  const selectedHighlight = useMemo(
    () => selectedHighlightId ? allHighlights.find((h) => h.id === selectedHighlightId) : null,
    [selectedHighlightId, allHighlights]
  );

  const coverageType = selectedHighlight ? getCoverageType(selectedHighlight) : "media";
  const isMediaType = coverageType === "media";

  // Get attribution name
  const creatorName = useMemo(() => {
    if (!selectedHighlight?.created_by) return null;
    const profile = profiles[selectedHighlight.created_by];
    return profile?.display_name ?? null;
  }, [selectedHighlight, profiles]);

  // Get comments for selected highlight
  const highlightComments = useMemo(
    () => selectedHighlightId ? allComments.filter((c) => c.highlight_id === selectedHighlightId) : [],
    [selectedHighlightId, allComments]
  );

  const handleClose = useCallback(() => {
    closeSidebar();
  }, [closeSidebar]);

  function handleDeleteHighlight() {
    if (!selectedHighlightId) return;
    startDeleteTransition(async () => {
      try {
        await deleteHighlight(selectedHighlightId);
        removeHighlight(selectedHighlightId);
        closeSidebar();
      } catch (err) {
        console.error("Failed to delete highlight:", err);
      }
    });
  }

  // Derive media for the selected target using useMemo
  const { uploaded, references, totalMedia } = useMemo(() => {
    let entries: { media_file_id: string | null; file_reference_id: string | null }[] = [];

    if (selectedHighlightId) {
      entries = allHighlightMedia.filter((hm) => hm.highlight_id === selectedHighlightId);
    } else if (selectedSectionId) {
      entries = allSectionMedia.filter((sm) => sm.section_id === selectedSectionId);
    }

    const uploaded = entries
      .filter((e) => e.media_file_id)
      .map((e) => allMediaFiles.find((f) => f.id === e.media_file_id))
      .filter((f): f is MediaFile => !!f);

    const references = entries
      .filter((e) => e.file_reference_id)
      .map((e) => allFileReferences.find((f) => f.id === e.file_reference_id))
      .filter((f): f is FileReference => !!f);

    return { uploaded, references, totalMedia: uploaded.length + references.length };
  }, [selectedHighlightId, selectedSectionId, allHighlightMedia, allSectionMedia, allMediaFiles, allFileReferences]);

  const targetType = selectedHighlightId ? "highlight" : "section";
  const targetId = selectedHighlightId || selectedSectionId;

  const coverageConfig = COVERAGE_TYPES[coverageType];
  const CoverageIcon = coverageType === "graphics" ? Layers : coverageType === "on_camera" ? Video : ImagePlus;

  return (
    <AnimatePresence>
      {sidebarOpen && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 420, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="border-l border-border bg-surface overflow-hidden flex-shrink-0"
        >
          <div className="flex h-full w-[420px] flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold">
                {!isMediaType
                  ? coverageConfig.label
                  : targetType === "highlight"
                    ? "Highlight Media"
                    : "Section Media"
                }
              </h3>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Non-media highlight: info panel with note */}
            {selectedHighlightId && !isMediaType && (
              <div className="flex-1 flex flex-col overflow-y-auto">
                <div className="flex flex-col items-center pt-8 pb-4 px-8 text-center">
                  <div
                    className="flex items-center justify-center h-16 w-16 rounded-full mb-4"
                    style={{ backgroundColor: coverageConfig.color }}
                  >
                    <CoverageIcon className="h-7 w-7 text-foreground" />
                  </div>
                  <p className="text-lg font-medium mb-1">{coverageConfig.label}</p>
                  {creatorName ? (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground/70">{creatorName}</span> marked this as {coverageConfig.label.toLowerCase()}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      This text is marked as <span className="font-medium">{coverageConfig.label.toLowerCase()}</span> coverage.
                    </p>
                  )}
                </div>

                {/* Editable note */}
                {canEdit && (
                  <div className="px-4 pb-4">
                    <HighlightNote
                      highlightId={selectedHighlightId}
                      initialNote={selectedHighlight?.note ?? null}
                    />
                  </div>
                )}

                {/* Comments */}
                {selectedHighlightId && (
                  <div className="px-4 pb-4 flex-1">
                    <CommentThread
                      highlightId={selectedHighlightId}
                      comments={highlightComments}
                      profiles={profiles}
                      currentUserId={currentUserId}
                      canComment={canComment}
                    />
                  </div>
                )}

                {canEdit && (
                  <div className="px-4 pb-6 text-center">
                    <Button
                      variant="ghost"
                      className="text-destructive hover:text-destructive gap-2"
                      onClick={handleDeleteHighlight}
                      disabled={isDeleting}
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove highlight
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Media highlight or section: tabs + content */}
            {(isMediaType || selectedSectionId) && (
              <>
                {/* Attribution for media highlights */}
                {selectedHighlightId && creatorName && (
                  <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border">
                    <span className="font-medium text-foreground/70">{creatorName}</span> added this media highlight
                  </div>
                )}

                {/* Tab bar */}
                {canEdit && (
                  <div className="flex border-b border-border">
                    <TabButton
                      active={activeTab === "media"}
                      onClick={() => setActiveTab("media")}
                      icon={<ImagePlus className="h-3.5 w-3.5" />}
                      label={`Media${totalMedia > 0 ? ` (${totalMedia})` : ""}`}
                    />
                    <TabButton
                      active={activeTab === "upload"}
                      onClick={() => setActiveTab("upload")}
                      icon={<Upload className="h-3.5 w-3.5" />}
                      label="Upload"
                    />
                    <TabButton
                      active={activeTab === "reference"}
                      onClick={() => setActiveTab("reference")}
                      icon={<FileText className="h-3.5 w-3.5" />}
                      label="Reference"
                    />
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden">
                  {canEdit ? (
                    <div className="p-4">
                      {activeTab === "media" && totalMedia > 0 && (
                        <MediaGrid
                          uploaded={uploaded}
                          references={references}
                          projectId={projectId}
                        />
                      )}
                      {activeTab === "media" && totalMedia === 0 && (
                        <div className="py-12 text-center text-muted-foreground">
                          <ImagePlus className="mx-auto h-8 w-8 mb-3 opacity-50" />
                          <p className="text-sm">No media attached yet.</p>
                          <p className="text-xs mt-1">Upload files or add a reference.</p>
                        </div>
                      )}

                      {activeTab === "upload" && targetId && (
                        <MediaUploader
                          projectId={projectId}
                          targetType={targetType}
                          targetId={targetId}
                          onUploadComplete={() => setActiveTab("media")}
                        />
                      )}

                      {activeTab === "reference" && targetId && (
                        <FileReferenceForm
                          projectId={projectId}
                          targetType={targetType}
                          targetId={targetId}
                          onComplete={() => setActiveTab("media")}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="p-4">
                      {totalMedia > 0 ? (
                        <MediaGrid
                          uploaded={uploaded}
                          references={references}
                          projectId={projectId}
                        />
                      ) : (
                        <div className="py-12 text-center text-muted-foreground">
                          <ImagePlus className="mx-auto h-8 w-8 mb-3 opacity-50" />
                          <p className="text-sm">No media attached yet.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Comments for media highlights */}
                  {selectedHighlightId && (
                    <div className="px-4 pb-4 border-t border-border mt-2 pt-4">
                      <CommentThread
                        highlightId={selectedHighlightId}
                        comments={highlightComments}
                        profiles={profiles}
                        currentUserId={currentUserId}
                        canComment={canComment}
                      />
                    </div>
                  )}

                  {/* Delete button for media highlights */}
                  {canEdit && selectedHighlightId && (
                    <div className="px-4 pb-6 text-center border-t border-border pt-4">
                      <Button
                        variant="ghost"
                        className="text-destructive hover:text-destructive gap-2"
                        onClick={handleDeleteHighlight}
                        disabled={isDeleting}
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove highlight
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CommentThread({
  highlightId,
  comments,
  profiles,
  currentUserId,
  canComment,
}: {
  highlightId: string;
  comments: { id: string; user_id: string; body: string; created_at: string }[];
  profiles: Record<string, { display_name: string }>;
  currentUserId: string | null;
  canComment: boolean;
}) {
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();
  const storeAddComment = useAnnotationStore((s) => s.addComment);
  const storeRemoveComment = useAnnotationStore((s) => s.removeComment);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit() {
    const trimmed = body.trim();
    if (!trimmed) return;

    startTransition(async () => {
      try {
        const comment = await addComment(highlightId, trimmed);
        storeAddComment(comment);
        setBody("");
      } catch (err) {
        console.error("Failed to add comment:", err);
      }
    });
  }

  function handleDelete(commentId: string) {
    startTransition(async () => {
      try {
        await deleteComment(commentId);
        storeRemoveComment(commentId);
      } catch (err) {
        console.error("Failed to delete comment:", err);
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
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

  return (
    <div className="space-y-3">
      {comments.length > 0 && (
        <label className="text-xs font-medium text-muted-foreground">Comments</label>
      )}

      {comments.map((comment) => {
        const profile = profiles[comment.user_id];
        const isOwn = comment.user_id === currentUserId;

        return (
          <div key={comment.id} className="group/comment">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium">
                    {profile?.display_name ?? "Unknown"}
                  </span>
                  <span className="text-[0.65rem] text-muted-foreground/50">
                    {formatTime(comment.created_at)}
                  </span>
                </div>
                <p className="text-sm text-foreground/80 mt-0.5">
                  {comment.body.split("\n").map((line, i) => (
                    <span key={i}>
                      {i > 0 && <br />}
                      {line}
                    </span>
                  ))}
                </p>
              </div>
              {isOwn && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 shrink-0 text-destructive hover:text-destructive opacity-0 group-hover/comment:opacity-100 transition-opacity"
                  onClick={() => handleDelete(comment.id)}
                  disabled={isPending}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        );
      })}

      {canComment && (
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a comment..."
            rows={1}
            className="flex-1 rounded-md border border-border bg-elevated px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={handleSubmit}
            disabled={isPending || !body.trim()}
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

function HighlightNote({
  highlightId,
  initialNote,
}: {
  highlightId: string;
  initialNote: string | null;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [note, setNote] = useState(initialNote ?? "");
  const [isSaving, startSaveTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const updateNote = useAnnotationStore((s) => s.updateHighlightNote);

  // Sync when switching between highlights
  useEffect(() => {
    setNote(initialNote ?? "");
    setIsEditing(false);
  }, [highlightId, initialNote]);

  // Auto-focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(
        textareaRef.current.value.length,
        textareaRef.current.value.length
      );
    }
  }, [isEditing]);

  function save(value: string) {
    const trimmed = value.trim();
    const noteValue = trimmed || null;
    setNote(trimmed);
    setIsEditing(false);
    updateNote(highlightId, noteValue);
    startSaveTransition(async () => {
      try {
        await updateHighlightNote(highlightId, noteValue);
      } catch (err) {
        console.error("Failed to save note:", err);
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      save((e.target as HTMLTextAreaElement).value);
    }
    if (e.key === "Escape") {
      setNote(initialNote ?? "");
      setIsEditing(false);
    }
  }

  function handleDelete() {
    setNote("");
    setIsEditing(false);
    updateNote(highlightId, null);
    startSaveTransition(async () => {
      try {
        await updateHighlightNote(highlightId, null);
      } catch (err) {
        console.error("Failed to delete note:", err);
      }
    });
  }

  // No note, not editing → show "Add a note" button
  if (!note && !isEditing) {
    return (
      <button
        onClick={() => setIsEditing(true)}
        className="w-full flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        Add a note...
      </button>
    );
  }

  // Editing mode
  if (isEditing) {
    return (
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Note</label>
        <textarea
          ref={textareaRef}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={(e) => save(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add context for this highlight..."
          rows={3}
          className="w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <p className="text-[0.65rem] text-muted-foreground/50">
          Enter to save · Esc to cancel · Shift+Enter for new line
        </p>
      </div>
    );
  }

  // Display mode (has note, not editing) — click note text to edit
  return (
    <div className="group/note space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground">Note</label>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-destructive hover:text-destructive opacity-0 group-hover/note:opacity-100 transition-opacity"
          onClick={handleDelete}
          disabled={isSaving}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      <div
        onClick={() => setIsEditing(true)}
        className="w-full text-left text-sm text-foreground/80 rounded-md bg-elevated px-3 py-2 hover:bg-elevated/80 transition-colors cursor-text"
      >
        {note.split("\n").map((line, i) => (
          <span key={i}>
            {i > 0 && <br />}
            {line}
          </span>
        ))}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors ${
        active
          ? "text-foreground border-b-2 border-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
