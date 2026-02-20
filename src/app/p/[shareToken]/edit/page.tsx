"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getProjectByToken,
  getProjectSections,
  replaceProjectScript,
  updateProjectTitle,
} from "@/actions/projects";

export default function EditScriptPage() {
  const router = useRouter();
  const params = useParams<{ shareToken: string }>();
  const [isPending, startTransition] = useTransition();

  const [projectId, setProjectId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [scriptText, setScriptText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const project = await getProjectByToken(params.shareToken);
        if (!project) {
          setError("Project not found.");
          setLoading(false);
          return;
        }

        setProjectId(project.id);
        setTitle(project.title);

        const sections = await getProjectSections(project.id);
        // Reconstruct the script text from sections
        const text = sections.map((s) => s.body).join("\n\n");
        setScriptText(text);
      } catch {
        setError("Failed to load project.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.shareToken]);

  function handleSave() {
    if (!projectId || !title.trim() || !scriptText.trim()) return;

    startTransition(async () => {
      try {
        await updateProjectTitle(projectId, title.trim());
        await replaceProjectScript(projectId, scriptText);
        router.push(`/p/${params.shareToken}`);
      } catch (err) {
        console.error("Failed to save:", err);
        setError("Failed to save changes.");
      }
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (error && !projectId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">{error}</p>
        <Link href="/">
          <Button variant="outline">Back to home</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="flex items-center gap-4 border-b border-border px-6 py-4">
        <Link
          href={`/p/${params.shareToken}`}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-sm font-medium text-muted-foreground">Edit Script</h1>
        <div className="flex-1" />
        <Button
          onClick={handleSave}
          disabled={isPending || !title.trim() || !scriptText.trim()}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          {isPending ? "Saving..." : "Save Changes"}
        </Button>
      </header>

      {/* Editor */}
      <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        {error && (
          <p className="mb-4 text-sm text-destructive">{error}</p>
        )}

        <div className="mb-6">
          <label className="mb-2 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Project Title
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-lg font-medium"
          />
        </div>

        <div className="flex-1">
          <label className="mb-2 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Script
          </label>
          <p className="mb-3 text-xs text-muted-foreground/60">
            Separate sections with blank lines. ALL CAPS lines and ACT/SCENE markers become headings.
          </p>
          <textarea
            value={scriptText}
            onChange={(e) => setScriptText(e.target.value)}
            className="w-full min-h-[60vh] rounded-lg border border-border bg-surface p-5 text-[0.95rem] leading-relaxed text-foreground/90 placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring resize-y"
            placeholder="Paste or edit your script here..."
          />
        </div>
      </div>
    </div>
  );
}
