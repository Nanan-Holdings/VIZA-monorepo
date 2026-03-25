"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getImpersonationSession } from "@/lib/impersonation-session";

/**
 * Get the authenticated user linked to the current Supabase auth session
 */
export async function getAuthenticatedUser(): Promise<{
  id: string;
  name: string;
  email: string;
  date_of_birth: string | null;
  sex: "M" | "F" | null;
  isImpersonation?: boolean;
} | null> {
  // 1. Check for impersonation session first
  const impersonation = await getImpersonationSession();
  if (impersonation) {
    const adminClient = createAdminClient();
    const { data: profile, error } = await adminClient
      .from("users")
      .select("id, name, email, date_of_birth, sex")
      .eq("id", impersonation.userId)
      .single();

    if (!error && profile) {
      return {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        date_of_birth: profile.date_of_birth,
        sex: profile.sex as "M" | "F" | null,
        isImpersonation: true,
      };
    }
  }

  // 2. Fall back to normal Supabase auth session
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return null;
  }

  // Use admin client to bypass RLS for auth_user_id lookup
  const adminClient = createAdminClient();
  const { data: profile, error } = await adminClient
    .from("users")
    .select("id, name, email, date_of_birth, sex")
    .eq("auth_user_id", authUser.id)
    .single();

  if (error || !profile) {
    return null;
  }

  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    date_of_birth: profile.date_of_birth,
    sex: profile.sex as "M" | "F" | null,
  };
}

/**
 * Get only the user ID for the authenticated user
 */
export async function getAuthenticatedUserId(): Promise<string | null> {
  // 1. Check for impersonation session first
  const impersonation = await getImpersonationSession();
  if (impersonation) {
    return impersonation.userId;
  }

  // 2. Fall back to normal Supabase auth session
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return null;
  }

  const adminClient = createAdminClient();
  const { data: profile, error } = await adminClient
    .from("users")
    .select("id")
    .eq("auth_user_id", authUser.id)
    .single();

  if (error || !profile) {
    return null;
  }

  return profile.id;
}
