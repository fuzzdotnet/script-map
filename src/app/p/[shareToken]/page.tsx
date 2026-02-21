import { notFound } from "next/navigation";
import { getProjectByToken, getProjectSections } from "@/actions/projects";
import { getHighlightsForProject } from "@/actions/highlights";
import {
  getMediaFilesForProject,
  getFileReferencesForProject,
  getHighlightMediaForProject,
  getSectionMediaForProject,
} from "@/actions/media";
import { listMembers } from "@/actions/members";
import { getProfiles } from "@/actions/profiles";
import { getCommentsForProject } from "@/actions/comments";
import { getAuthUser } from "@/lib/supabase/auth";
import { ScriptViewer } from "@/components/script/ScriptViewer";
import { TopBar } from "@/components/layout/TopBar";
import type { ProjectRole } from "@/actions/projects";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = await params;
  const [project, user] = await Promise.all([
    getProjectByToken(shareToken),
    getAuthUser(),
  ]);

  if (!project) notFound();

  // Compute the user's role for this project
  let role: ProjectRole | "none" = "none";
  let isMember = false;

  if (user) {
    if (project.owner_id && user.id === project.owner_id) {
      role = "owner";
      isMember = true;
    } else {
      // Check membership
      const members = await listMembers(project.id);
      const email = user.email?.toLowerCase();
      const membership = members.find(
        (m) => m.user_id === user.id || m.invited_email === email
      );
      if (membership) {
        role = membership.role;
        isMember = true;
      }
    }
  }

  const canEdit = role === "owner" || role === "editor";

  // Fetch all data in parallel
  const [sections, highlights, mediaFiles, fileReferences, highlightMedia, sectionMedia, comments] =
    await Promise.all([
      getProjectSections(project.id),
      getHighlightsForProject(project.id),
      getMediaFilesForProject(project.id),
      getFileReferencesForProject(project.id),
      getHighlightMediaForProject(project.id),
      getSectionMediaForProject(project.id),
      getCommentsForProject(project.id),
    ]);

  // Collect unique user IDs from highlights, comments, and current user, then batch-fetch profiles
  const userIds = new Set<string>();
  if (user) userIds.add(user.id);
  for (const h of highlights) {
    if (h.created_by) userIds.add(h.created_by);
  }
  for (const c of comments) {
    userIds.add(c.user_id);
  }
  const profiles = await getProfiles([...userIds]);

  const canComment = role !== "none";

  return (
    <div className="flex h-screen flex-col">
      <TopBar
        project={project}
        canEdit={canEdit}
        role={role}
        isMember={isMember}
        isLoggedIn={!!user}
        ownerEmail={role === "owner" ? user?.email ?? undefined : undefined}
      />
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
          initialComments={comments}
          profiles={profiles}
          currentUserId={user?.id}
          canEdit={canEdit}
          canComment={canComment}
        />
      </main>
    </div>
  );
}
