import {
  clientSessionOwnsApplicant,
  type ApplicantOwnerIdentity,
} from "@/lib/application-api-auth";
import type { ClientSession } from "@/lib/client-session";

type SubmissionAccessOwner = ApplicantOwnerIdentity & {
  id: string;
};

/**
 * Resolve the authoritative auth-account payer only after one of the two
 * client-portal session types proves ownership of the target application.
 */
export function resolveSubmissionAccessPayerAuthUserId({
  profile,
  groupPayerAuthUserId,
  legacySession,
  supabaseAuthUserId,
}: {
  profile: SubmissionAccessOwner;
  groupPayerAuthUserId: string | null;
  legacySession: ClientSession | null;
  supabaseAuthUserId: string | null;
}): string | null {
  if (groupPayerAuthUserId) {
    if (supabaseAuthUserId === groupPayerAuthUserId) {
      return groupPayerAuthUserId;
    }
    if (legacySession?.authUserId === groupPayerAuthUserId) {
      return groupPayerAuthUserId;
    }
    return null;
  }

  const authoritativePayer = profile.auth_user_id ?? profile.dependant_of_user_id;
  if (!authoritativePayer) return null;

  const supabaseOwnsApplication = Boolean(
    supabaseAuthUserId
      && (profile.auth_user_id === supabaseAuthUserId
        || profile.dependant_of_user_id === supabaseAuthUserId),
  );
  if (supabaseOwnsApplication) return authoritativePayer;

  if (legacySession && clientSessionOwnsApplicant(profile, legacySession)) {
    return authoritativePayer;
  }

  return null;
}
