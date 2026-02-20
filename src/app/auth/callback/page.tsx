"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const supabase = createClient();
    const code = searchParams.get("code");

    // Read redirect target from cookie
    const match = document.cookie.match(/auth_redirect_to=([^;]*)/);
    const redirectTo = match ? decodeURIComponent(match[1]) : "/dashboard";

    // Clear the cookie
    document.cookie = "auth_redirect_to=; path=/; max-age=0";

    async function handleAuth() {
      // PKCE flow: exchange code for session
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          router.push(redirectTo);
          return;
        }
      }

      // Implicit flow: check if tokens arrived via hash fragment
      // createBrowserClient auto-detects hash fragments when getSession is called
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        router.push(redirectTo);
        return;
      }

      router.push("/login");
    }

    handleAuth();
  }, [searchParams, router]);

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
