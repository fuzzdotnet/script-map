"use client";

import dynamic from "next/dynamic";

const AuthListener = dynamic(
  () => import("@/components/AuthListener").then((m) => m.AuthListener),
  { ssr: false }
);

export function LazyAuthListener() {
  return <AuthListener />;
}
