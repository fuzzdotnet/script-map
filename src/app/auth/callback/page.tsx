"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function CallbackHandler() {
  const searchParams = useSearchParams();
  const handled = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const supabase = createClient();
    const code = searchParams.get("code");
    const errorParam = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    // If Supabase returned an error directly
    if (errorParam) {
      setError(errorDescription || errorParam);
      return;
    }

    // Read redirect target from cookie
    const match = document.cookie.match(/auth_redirect_to=([^;]*)/);
    const redirectTo = match ? decodeURIComponent(match[1]) : "/dashboard";

    // Clear the cookie
    document.cookie = "auth_redirect_to=; path=/; max-age=0";

    async function checkProfileAndRedirect(userId: string) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .single();

      if (!profile) {
        window.location.href = "/setup";
      } else {
        window.location.href = redirectTo;
      }
    }

    async function handleAuth() {
      // PKCE flow: exchange code for session
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (!exchangeError) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await checkProfileAndRedirect(user.id);
            return;
          }
        }
        // If PKCE exchange failed, fall through to session check
        console.warn("Code exchange failed:", exchangeError?.message);
      }

      // Implicit flow / hash fragment: the Supabase client auto-detects
      // tokens in the URL hash and sets up the session
      // Give it a moment to process hash fragments
      await new Promise((r) => setTimeout(r, 500));

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (session) {
        await checkProfileAndRedirect(session.user.id);
        return;
      }

      // Try one more time with getUser() which forces a token refresh
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await checkProfileAndRedirect(user.id);
        return;
      }

      // Nothing worked — show error
      const detail = sessionError?.message || "No session found";
      setError(`Sign-in failed: ${detail}. Please try requesting a new magic link.`);
    }

    handleAuth();
  }, [searchParams]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm text-center space-y-4">
          <p className="text-sm text-destructive">{error}</p>
          <a
            href="/login"
            className="text-sm text-muted-foreground hover:text-foreground underline"
          >
            Back to sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <CallbackHandler />
    </Suspense>
  );
}
