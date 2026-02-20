import { notFound } from "next/navigation";
import { getProjectByToken, getProjectSections } from "@/actions/projects";
import { getHighlightsForProject } from "@/actions/highlights";
import {
  getMediaFilesForProject,
  getFileReferencesForProject,
  getHighlightMediaForProject,
  getSectionMediaForProject,
} from "@/actions/media";
import { ScriptViewer } from "@/components/script/ScriptViewer";
import { TopBar } from "@/components/layout/TopBar";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = await params;
  const project = await getProjectByToken(shareToken);

  if (!project) notFound();

  // Fetch all data in parallel
  const [sections, highlights, mediaFiles, fileReferences, highlightMedia, sectionMedia] =
    await Promise.all([
      getProjectSections(project.id),
      getHighlightsForProject(project.id),
      getMediaFilesForProject(project.id),
      getFileReferencesForProject(project.id),
      getHighlightMediaForProject(project.id),
      getSectionMediaForProject(project.id),
    ]);

  return (
    <div className="flex h-screen flex-col">
      <TopBar project={project} />
      <main className="flex flex-1 overflow-hidden">
        <ScriptViewer
          sections={sections}
          projectId={project.id}
          settings={project.settings}
          initialHighlights={highlights}
          initialHighlightMedia={highlightMedia}
          initialSectionMedia={sectionMedia}
          initialMediaFiles={mediaFiles}
          initialFileReferences={fileReferences}
        />
      </main>
    </div>
  );
}
