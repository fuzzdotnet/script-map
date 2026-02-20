"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Listens for Supabase auth tokens arriving via hash fragment
 * (implicit flow fallback when Supabase redirects to Site URL).
 * Only acts when fresh tokens are detected in the URL hash.
 */
export function AuthListener() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/auth/callback") return;

    // Only act if there are auth tokens in the URL hash (fresh implicit-flow sign-in)
    const hash = window.location.hash;
    if (!hash || !hash.includes("access_token")) return;

    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        const match = document.cookie.match(/auth_redirect_to=([^;]*)/);
        const redirectTo = match ? decodeURIComponent(match[1]) : "/dashboard";
        document.cookie = "auth_redirect_to=; path=/; max-age=0";
        window.location.href = redirectTo;
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [pathname]);

  return null;
}
