import Link from "next/link";
import { Plus, Settings } from "lucide-react";
import { redirect } from "next/navigation";
import { ProjectList } from "@/components/ProjectList";
import { SignOutButton } from "@/components/SignOutButton";
import {
  listProjects,
  getProjectSectionCount,
  getProjectHighlightCount,
} from "@/actions/projects";
import { claimPendingInvites } from "@/actions/members";
import { getProfile } from "@/actions/profiles";
import { getAuthUser } from "@/lib/supabase/auth";
import type { ProjectRole } from "@/actions/projects";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const profile = await getProfile(user.id);

  // Claim any pending invites for this user
  if (user.email) {
    try {
      await claimPendingInvites(user.id, user.email);
    } catch {
      // non-critical
    }
  }

  let projectsWithStats: {
    id: string;
    title: string;
    share_token: string;
    owner_id: string | null;
    created_at: string;
    updated_at: string;
    role: ProjectRole;
    sectionCount: number;
    highlightCount: number;
  }[] = [];

  try {
    const projects = await listProjects();
    projectsWithStats = await Promise.all(
      projects.map(async (p) => ({
        ...p,
        sectionCount: await getProjectSectionCount(p.id),
        highlightCount: await getProjectHighlightCount(p.id),
      }))
    );
  } catch {
    // Supabase may not be configured yet
  }

  return (
    <div className="flex min-h-screen flex-col items-center px-6">
      <header className="w-full max-w-2xl flex items-center justify-between pt-12 pb-8">
        <h1 className="text-2xl font-bold">My Projects</h1>
        <Link
          href="/new"
          className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black transition-all hover:bg-white/90 hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          New Project
        </Link>
      </header>

      <section className="w-full max-w-2xl flex-1 pb-24">
        {projectsWithStats.length > 0 ? (
          <ProjectList projects={projectsWithStats} />
        ) : (
          <div className="py-24 text-center text-muted-foreground">
            <p className="text-lg">No projects yet.</p>
            <p className="mt-2 text-sm">
              Create your first project to get started.
            </p>
          </div>
        )}
      </section>

      <footer className="mt-auto py-8 text-center">
        {profile && (
          <p className="text-sm font-medium mb-0.5">{profile.display_name}</p>
        )}
        <p className="text-xs text-muted-foreground/50 mb-2">{user.email}</p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/settings"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Settings className="h-3 w-3" />
            Settings
          </Link>
          <SignOutButton />
        </div>
      </footer>
    </div>
  );
}
