import "server-only";

import { getImpersonationSession } from "@/lib/impersonation-session";
import { getUserFromSupabaseSession } from "@/lib/client-session";
import { createAdminClient } from "@/lib/supabase/admin";

interface ApplicantProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
}

export interface CommercialAuthenticatedUser {
  id: string;
  name: string;
  email: string;
  isImpersonation?: boolean;
}

function displayName(profile: ApplicantProfileRow | null, email: string): string {
  return profile?.full_name?.trim() || email;
}

async function getApplicantProfile(userId: string): Promise<ApplicantProfileRow | null> {
  const { data, error } = await createAdminClient()
    .from("applicant_profiles")
    .select("id, full_name, email")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[commercial-session] Failed to load applicant profile:", error.message);
    return null;
  }

  return data;
}

export async function getCommercialAuthenticatedUser(): Promise<CommercialAuthenticatedUser | null> {
  const impersonation = await getImpersonationSession();
  if (impersonation) {
    const profile = await getApplicantProfile(impersonation.userId);
    if (!profile?.email) return null;

    return {
      id: profile.id,
      name: displayName(profile, profile.email),
      email: profile.email,
      isImpersonation: true,
    };
  }

  const session = await getUserFromSupabaseSession();
  if (!session) return null;

  const profile = await getApplicantProfile(session.userId);
  const email = profile?.email?.trim() || session.email;

  return {
    id: session.userId,
    name: displayName(profile, email),
    email,
  };
}
