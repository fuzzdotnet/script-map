"use server";

import { createServerClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/supabase/auth";
import type { Profile } from "@/lib/supabase/types";

export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("profiles")
    .select()
    .eq("id", userId)
    .single();
  return data;
}

/** Fetch multiple profiles by ID. Returns only public fields (id, display_name). */
export async function getProfiles(
  userIds: string[]
): Promise<Record<string, Profile>> {
  if (userIds.length === 0) return {};

  const supabase = createServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", userIds);

  const map: Record<string, Profile> = {};
  if (data) {
    for (const profile of data) {
      map[profile.id] = profile as Profile;
    }
  }
  return map;
}

export async function hasProfile(): Promise<boolean> {
  const user = await requireAuth();
  const supabase = createServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .single();
  return !!data;
}

export async function createProfile(displayName: string): Promise<Profile> {
  const user = await requireAuth();
  const supabase = createServerClient();

  const trimmed = displayName.trim();
  if (!trimmed) throw new Error("Display name is required");

  const { data, error } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      display_name: trimmed,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create profile: ${error.message}`);
  return data;
}

export async function updateProfile(displayName: string): Promise<Profile> {
  const user = await requireAuth();
  const supabase = createServerClient();

  const trimmed = displayName.trim();
  if (!trimmed) throw new Error("Display name is required");

  const { data, error } = await supabase
    .from("profiles")
    .update({
      display_name: trimmed,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update profile: ${error.message}`);
  return data;
}
