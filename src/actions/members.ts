"use server";

import { createServerClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/supabase/auth";
import { requireProjectOwner } from "@/lib/auth-helpers";
import { sendInviteEmail } from "@/lib/email";
import type { ProjectMember } from "@/lib/supabase/types";

export async function inviteMember(
  projectId: string,
  email: string,
  role: "viewer" | "editor"
): Promise<ProjectMember> {
  const user = await requireProjectOwner(projectId);
  const supabase = createServerClient();

  const normalizedEmail = email.trim().toLowerCase();

  // Prevent self-invite
  if (normalizedEmail === user.email?.toLowerCase()) {
    throw new Error("You can't invite yourself");
  }

  // Check for duplicate
  const { data: existing } = await supabase
    .from("project_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("invited_email", normalizedEmail)
    .single();

  if (existing) {
    throw new Error("This person has already been invited");
  }

  // Look up if a Supabase user exists with this email
  const { data: users } = await supabase.auth.admin.listUsers();
  const matchedUser = users?.users?.find(
    (u) => u.email?.toLowerCase() === normalizedEmail
  );

  // Insert membership
  const { data: member, error } = await supabase
    .from("project_members")
    .insert({
      project_id: projectId,
      user_id: matchedUser?.id || null,
      invited_email: normalizedEmail,
      role,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to invite member: ${error.message}`);

  // Fetch project for email context
  const { data: project } = await supabase
    .from("projects")
    .select("title, share_token")
    .eq("id", projectId)
    .single();

  if (project) {
    try {
      const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://parkvibes.media";
      await sendInviteEmail({
        to: normalizedEmail,
        projectTitle: project.title,
        role,
        shareUrl: `${origin}/p/${project.share_token}`,
        inviterEmail: user.email || "A Script Map user",
      });
    } catch (err) {
      // Don't fail the invite if the email fails to send
      console.error("Failed to send invite email:", err);
    }
  }

  return member;
}

export async function removeMember(memberId: string) {
  const supabase = createServerClient();

  // Look up member to get project_id
  const { data: member } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("id", memberId)
    .single();

  if (!member) throw new Error("Member not found");

  await requireProjectOwner(member.project_id);

  const { error } = await supabase
    .from("project_members")
    .delete()
    .eq("id", memberId);

  if (error) throw new Error(`Failed to remove member: ${error.message}`);
}

export async function listMembers(projectId: string): Promise<ProjectMember[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("project_members")
    .select()
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to list members: ${error.message}`);
  return data;
}

export async function joinProject(projectId: string): Promise<ProjectMember> {
  const user = await requireAuth();
  const supabase = createServerClient();

  const email = user.email?.toLowerCase();
  if (!email) throw new Error("No email associated with your account");

  // Check if user is the owner
  const { data: project } = await supabase
    .from("projects")
    .select("owner_id")
    .eq("id", projectId)
    .single();

  if (!project) throw new Error("Project not found");
  if (project.owner_id === user.id) throw new Error("You already own this project");

  // Check if already a member
  const { data: existing } = await supabase
    .from("project_members")
    .select("id")
    .eq("project_id", projectId)
    .or(`user_id.eq.${user.id},invited_email.eq.${email}`)
    .limit(1)
    .single();

  if (existing) throw new Error("You're already a member of this project");

  const { data: member, error } = await supabase
    .from("project_members")
    .insert({
      project_id: projectId,
      user_id: user.id,
      invited_email: email,
      role: "viewer",
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to join project: ${error.message}`);
  return member;
}

export async function claimPendingInvites(userId: string, email: string) {
  const supabase = createServerClient();

  await supabase
    .from("project_members")
    .update({ user_id: userId })
    .eq("invited_email", email.toLowerCase())
    .is("user_id", null);
}
