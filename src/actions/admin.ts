"use server";

import { createServerClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/supabase/auth";
import type { Profile } from "@/lib/supabase/types";

export interface AdminUser {
  id: string;
  email: string;
  display_name: string;
  is_admin: boolean;
  can_upload: boolean;
  created_at: string;
}

/** Verify the current user is an admin. Throws if not. */
export async function requireAdmin() {
  const user = await requireAuth();
  const supabase = createServerClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    throw new Error("Admin access required");
  }

  return user;
}

/** List all registered users with their profile info and email. Admin only. */
export async function listUsers(): Promise<AdminUser[]> {
  await requireAdmin();
  const supabase = createServerClient();

  // Fetch all profiles
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });

  if (profileError) throw new Error(`Failed to list profiles: ${profileError.message}`);

  // Fetch auth users to get emails
  const { data: authData, error: authError } =
    await supabase.auth.admin.listUsers({ perPage: 1000 });

  if (authError) throw new Error(`Failed to list auth users: ${authError.message}`);

  const emailMap = new Map<string, string>();
  for (const u of authData.users) {
    emailMap.set(u.id, u.email ?? "");
  }

  return (profiles as Profile[]).map((p) => ({
    id: p.id,
    email: emailMap.get(p.id) ?? "",
    display_name: p.display_name,
    is_admin: p.is_admin,
    can_upload: p.can_upload,
    created_at: p.created_at,
  }));
}

/** Toggle a user's upload permission. Admin only. */
export async function setCanUpload(
  userId: string,
  canUpload: boolean
): Promise<void> {
  await requireAdmin();
  const supabase = createServerClient();

  const { error } = await supabase
    .from("profiles")
    .update({ can_upload: canUpload })
    .eq("id", userId);

  if (error) throw new Error(`Failed to update permission: ${error.message}`);
}

/** Delete a user, their projects, and their auth account. Admin only. */
export async function deleteUser(userId: string): Promise<void> {
  const admin = await requireAdmin();
  if (userId === admin.id) throw new Error("Cannot delete your own account");

  const supabase = createServerClient();

  // Delete all projects owned by this user (cascades to sections, highlights, media, etc.)
  const { error: projectError } = await supabase
    .from("projects")
    .delete()
    .eq("owner_id", userId);

  if (projectError) throw new Error(`Failed to delete user projects: ${projectError.message}`);

  // Delete their profile
  const { error: profileError } = await supabase
    .from("profiles")
    .delete()
    .eq("id", userId);

  if (profileError) throw new Error(`Failed to delete profile: ${profileError.message}`);

  // Delete from Supabase Auth
  const { error: authError } = await supabase.auth.admin.deleteUser(userId);

  if (authError) throw new Error(`Failed to delete auth user: ${authError.message}`);
}
