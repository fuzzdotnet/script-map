import { notFound } from "next/navigation";
import { getProjectByToken, getProjectPageData } from "@/actions/projects";
import { getMediaFilesForProject, getFileReferencesForProject } from "@/actions/media";
import { listMembers } from "@/actions/members";
import { getProfiles } from "@/actions/profiles";
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

  // Stage 2: 4 parallel queries (down from 8)
  // getProjectPageData combines sections + highlights + highlight_media + section_media + comments
  const [pageData, mediaFiles, fileReferences, members] = await Promise.all([
    getProjectPageData(project.id),
    getMediaFilesForProject(project.id),
    getFileReferencesForProject(project.id),
    user ? listMembers(project.id) : Promise.resolve([]),
  ]);

  const { sections, highlights, highlightMedia, sectionMedia, comments } = pageData;

  // Compute role from already-fetched data (no extra queries)
  let role: ProjectRole | "none" = "none";
  let isMember = false;

  if (user) {
    if (project.owner_id && user.id === project.owner_id) {
      role = "owner";
      isMember = true;
    } else {
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

  // Stage 3: batch-fetch profiles for all referenced users
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
