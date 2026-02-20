"use client";

import { useMemo, useCallback } from "react";
import { X, Upload, FileText, ImagePlus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAnnotationStore } from "@/hooks/useAnnotationStore";
import { MediaUploader } from "@/components/media/MediaUploader";
import { FileReferenceForm } from "@/components/media/FileReferenceForm";
import { MediaGrid } from "@/components/media/MediaGrid";
import { deleteHighlight } from "@/actions/highlights";
import type { MediaFile, FileReference } from "@/lib/supabase/types";

interface MediaSidebarProps {
  projectId: string;
}

export function MediaSidebar({ projectId }: MediaSidebarProps) {
  const sidebarOpen = useAnnotationStore((s) => s.sidebarOpen);
  const closeSidebar = useAnnotationStore((s) => s.closeSidebar);
  const selectedHighlightId = useAnnotationStore((s) => s.selectedHighlightId);
  const selectedSectionId = useAnnotationStore((s) => s.selectedSectionId);

  // Select raw arrays (stable references)
  const allHighlightMedia = useAnnotationStore((s) => s.highlightMedia);
  const allSectionMedia = useAnnotationStore((s) => s.sectionMedia);
  const allMediaFiles = useAnnotationStore((s) => s.mediaFiles);
  const allFileReferences = useAnnotationStore((s) => s.fileReferences);

  const activeTab = useAnnotationStore((s) => s.sidebarTab);
  const setActiveTab = useAnnotationStore((s) => s.setSidebarTab);

  const handleClose = useCallback(() => {
    // If a highlight is selected with no media, closeSidebar will remove it from client state.
    // We also need to delete it from the database.
    const hId = selectedHighlightId;
    if (hId) {
      const hasMedia = allHighlightMedia.some((hm) => hm.highlight_id === hId);
      if (!hasMedia) {
        deleteHighlight(hId).catch(() => {});
      }
    }
    closeSidebar();
  }, [selectedHighlightId, allHighlightMedia, closeSidebar]);

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
                {targetType === "highlight" ? "Highlight Media" : "Section Media"}
              </h3>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Tab bar */}
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

            {/* Content */}
            <ScrollArea className="flex-1">
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
            </ScrollArea>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
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
