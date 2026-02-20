import Link from "next/link";
import { FileText, Upload, Share2, Layers, Plus } from "lucide-react";
import { ProjectList } from "@/components/ProjectList";
import {
  listProjects,
  getProjectSectionCount,
  getProjectHighlightCount,
} from "@/actions/projects";

export const dynamic = "force-dynamic";

export default async function Home() {
  let projectsWithStats: {
    id: string;
    title: string;
    share_token: string;
    created_at: string;
    updated_at: string;
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
      {/* Hero */}
      <section className="relative w-full max-w-2xl text-center pt-40 pb-28">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute left-1/2 top-24 -translate-x-1/2 h-72 w-[32rem] rounded-full bg-blue-500/[0.06] blur-[120px]" />

        <h1 className="relative text-6xl font-bold tracking-tight sm:text-8xl bg-gradient-to-b from-white via-white to-white/40 bg-clip-text text-transparent leading-none pb-2">
          Script Map
        </h1>
        <p className="relative mt-6 text-xl text-muted-foreground">
          Media annotations for documentary scripts.
        </p>

        <div className="relative mt-12">
          <Link
            href="/new"
            className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-black transition-all hover:bg-white/90 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            New Project
          </Link>
        </div>
      </section>

      {/* Features — no cards, just clean icon + text */}
      <section className="grid w-full max-w-2xl grid-cols-2 gap-x-20 gap-y-10 pb-28">
        <Feature
          icon={<FileText className="h-4 w-4" />}
          title="Import Scripts"
          description="Paste text or upload a .docx file. Your script becomes the canvas."
        />
        <Feature
          icon={<Layers className="h-4 w-4" />}
          title="Annotate with Media"
          description="Highlight words and attach photos, videos, or file references."
        />
        <Feature
          icon={<Upload className="h-4 w-4" />}
          title="Upload or Reference"
          description="Upload files directly or reference large assets by name and path."
        />
        <Feature
          icon={<Share2 className="h-4 w-4" />}
          title="Share Instantly"
          description="Get a shareable link. No login required for your editors."
        />
      </section>

      {/* Projects */}
      {projectsWithStats.length > 0 && (
        <section className="w-full max-w-2xl pb-24">
          <div className="flex items-center gap-4 mb-6">
            <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 whitespace-nowrap">
              Recent Projects
            </h2>
            <div className="flex-1 h-px bg-border/40" />
          </div>
          <ProjectList projects={projectsWithStats} />
        </section>
      )}

      {/* Footer */}
      <footer className="mt-auto py-12 text-center text-xs text-muted-foreground/25">
        Script Map
      </footer>
    </div>
  );
}

function Feature({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-muted-foreground">
          {icon}
        </div>
        <h3 className="text-sm font-medium text-foreground/90">{title}</h3>
      </div>
      <p className="text-[0.8rem] leading-relaxed text-muted-foreground pl-11">
        {description}
      </p>
    </div>
  );
}
