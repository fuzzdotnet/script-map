import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getProjectByToken } from "@/actions/projects";
import { listVersions } from "@/actions/versions";
import { listMembers } from "@/actions/members";
import { getProfiles } from "@/actions/profiles";
import { getAuthUser } from "@/lib/supabase/auth";
import { VersionHistoryList } from "./VersionHistoryList";
import type { ProjectRole } from "@/actions/projects";
import type { Profile } from "@/lib/supabase/types";

export default async function VersionHistoryPage({
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
  if (!user) redirect("/login");

  const members = await listMembers(project.id);

  // Compute role (same pattern as main page.tsx)
  let role: ProjectRole | "none" = "none";

  if (project.owner_id && user.id === project.owner_id) {
    role = "owner";
  } else {
    const email = user.email?.toLowerCase();
    const membership = members.find(
      (m) => m.user_id === user.id || m.invited_email === email
    );
    if (membership) {
      role = membership.role;
    }
  }

  if (role === "none") notFound();

  const canEdit = role === "owner" || role === "editor";
  const versions = await listVersions(project.id);

  // Fetch profiles for created_by users
  const userIds = new Set<string>();
  userIds.add(user.id);
  for (const v of versions) {
    if (v.created_by) userIds.add(v.created_by);
  }
  const profiles = await getProfiles([...userIds]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center gap-4 border-b border-border px-6 py-4">
        <Link
          href={`/p/${shareToken}`}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-sm font-medium text-muted-foreground">
            Version History
          </h1>
          <p className="text-xs text-muted-foreground/60 truncate">
            {project.title}
          </p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-6 py-8">
          <p className="text-sm text-muted-foreground mb-6">
            Snapshots are created automatically before each script edit.
            Restoring a version saves the current state first, so it can always
            be undone.
          </p>

          {versions.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-sm text-muted-foreground">
                No versions yet. Edit the script to create the first snapshot.
              </p>
            </div>
          ) : (
            <VersionHistoryList
              versions={versions}
              profiles={profiles as Record<string, Profile>}
              canEdit={canEdit}
              projectId={project.id}
              shareToken={shareToken}
            />
          )}
        </div>
      </main>
    </div>
  );
}
