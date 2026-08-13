"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getClientSessionWithFallback } from "@/lib/client-session";
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

  // 2. VIZA's signed, HttpOnly session is the continuity boundary. It was
  // established only after a successful Supabase sign-in, so ordinary portal
  // requests do not need to call Auth again on every render/action.
  const session = await getClientSessionWithFallback();
  if (!session) return null;

  const adminClient = createAdminClient({ requestTimeoutMs: 4_000, retryDelaysMs: [] });
  const { data: profile, error } = await adminClient
    .from("users")
    .select("id, name, email, date_of_birth, sex")
    .eq("id", session.userId)
    .maybeSingle();

  if (!error && profile) {
    return {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      date_of_birth: profile.date_of_birth,
      sex: profile.sex as "M" | "F" | null,
    };
  }

  const { data: applicantProfile } = await adminClient
    .from("applicant_profiles")
    .select("id, full_name, email, date_of_birth, gender")
    .eq("id", session.userId)
    .maybeSingle();

  return {
    id: applicantProfile?.id ?? session.userId,
    name: applicantProfile?.full_name ?? session.userName ?? session.email ?? "Applicant",
    email: applicantProfile?.email ?? session.email,
    date_of_birth: applicantProfile?.date_of_birth ?? null,
    sex: applicantProfile?.gender === "male" || applicantProfile?.gender === "M"
      ? "M"
      : applicantProfile?.gender === "female" || applicantProfile?.gender === "F"
        ? "F"
        : null,
  };
}

export async function resolveAuthenticatedUserId({
  authUserId,
  userRowId,
  applicantProfileId,
}: {
  authUserId: string;
  userRowId?: string | null;
  applicantProfileId?: string | null;
}): Promise<string | null> {
  void authUserId;
  return userRowId ?? applicantProfileId ?? null;
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

  const session = await getClientSessionWithFallback();
  return session?.userId ?? null;
}
