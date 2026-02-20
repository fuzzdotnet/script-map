"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Listens for Supabase auth events (e.g. tokens arriving via hash fragment
 * on the homepage when Supabase redirects to Site URL instead of callback).
 * Redirects to /dashboard on sign-in.
 */
export function AuthListener() {
  const pathname = usePathname();

  useEffect(() => {
    // Skip the callback page (it handles its own flow)
    if (pathname === "/auth/callback") return;

    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        // Read redirect target from cookie if present
        const match = document.cookie.match(/auth_redirect_to=([^;]*)/);
        const redirectTo = match ? decodeURIComponent(match[1]) : "/dashboard";
        document.cookie = "auth_redirect_to=; path=/; max-age=0";
        // Full page navigation so server components see the new session cookies
        window.location.href = redirectTo;
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [pathname]);

  return null;
}
