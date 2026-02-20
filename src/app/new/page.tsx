"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { createProject } from "@/actions/projects";

export default function NewProjectPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [scriptText, setScriptText] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!scriptText.trim()) {
      setError("Please paste your script text.");
      return;
    }

    startTransition(async () => {
      try {
        const { shareToken } = await createProject(
          title.trim() || "Untitled Script",
          scriptText
        );
        router.push(`/p/${shareToken}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="flex items-center gap-4 border-b border-border px-6 py-4">
        <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-semibold">New Project</h1>
      </header>

      {/* Form */}
      <main className="flex flex-1 justify-center px-6 py-12">
        <form onSubmit={handleSubmit} className="w-full max-w-2xl space-y-8">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Project Title</Label>
            <Input
              id="title"
              placeholder="e.g. The Nature of Things — Episode 4"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-12 text-base"
            />
          </div>

          {/* Script input */}
          <div className="space-y-2">
            <Label htmlFor="script">Script</Label>
            <p className="text-sm text-muted-foreground">
              Paste your documentary script below. The text will be automatically
              split into sections based on headings and paragraph breaks.
            </p>
            <Textarea
              id="script"
              placeholder={"ACT ONE\n\nThe camera pans across a vast landscape...\n\nNARRATOR (V.O.)\nIn the heart of the wilderness, something extraordinary is about to happen..."}
              value={scriptText}
              onChange={(e) => setScriptText(e.target.value)}
              className="min-h-[400px] text-base leading-relaxed font-mono resize-y"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Submit */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              <FileText className="inline h-4 w-4 mr-1" />
              .docx upload coming soon
            </p>
            <Button
              type="submit"
              size="lg"
              disabled={isPending}
              className="px-8"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Project"
              )}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
