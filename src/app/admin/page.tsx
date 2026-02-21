import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";
import { getAuthUser } from "@/lib/supabase/auth";
import { listUsers } from "@/actions/admin";
import { getProfile } from "@/actions/profiles";
import { UserTable } from "./UserTable";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const profile = await getProfile(user.id);
  if (!profile?.is_admin) redirect("/dashboard");

  const users = await listUsers();

  return (
    <div className="flex min-h-screen flex-col items-center px-6">
      <header className="w-full max-w-2xl flex items-center justify-between pt-12 pb-8">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-purple-400" />
            <h1 className="text-2xl font-bold">Admin</h1>
          </div>
        </div>
      </header>

      <section className="w-full max-w-2xl flex-1 pb-24">
        <div className="mb-4">
          <p className="text-sm text-muted-foreground">
            {users.length} registered user{users.length !== 1 ? "s" : ""}
          </p>
        </div>
        <UserTable users={users} />
      </section>
    </div>
  );
}
