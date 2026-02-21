"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export function AuthNav() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
    });
  }, []);

  return (
    <Link
      href={isLoggedIn ? "/dashboard" : "/login"}
      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      {isLoggedIn ? "Dashboard" : "Sign in"}
    </Link>
  );
}
