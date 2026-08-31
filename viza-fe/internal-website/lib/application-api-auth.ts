import {
  getClientSession,
  getUserFromSupabaseSession,
  type ClientSession,
} from "@/lib/client-session";
import { getImpersonationSession } from "@/lib/impersonation-session";

export type ApplicantOwnerIdentity = {
  id?: string | null;
  auth_user_id?: string | null;
  dependant_of_user_id?: string | null;
};

export function clientSessionOwnsApplicant(
  profile: ApplicantOwnerIdentity | null,
  session: ClientSession,
): profile is ApplicantOwnerIdentity & { id: string } {
  return Boolean(
    profile?.id &&
      (profile.id === session.userId ||
        (session.authUserId && profile.auth_user_id === session.authUserId) ||
        profile.dependant_of_user_id === (session.authUserId ?? session.userId)),
  );
}

/**
 * Resolve ownership against the target applicant rather than whichever of the
 * signed VIZA cookie or Supabase session happened to be read first.
 *
 * Each candidate still has to independently prove ownership. This preserves a
 * fail-closed boundary while preventing mixed legacy/current login sessions
 * from making a readable application fail on the following write request.
 */
export async function getOwnedApplicantSession(
  profile: ApplicantOwnerIdentity | null,
  preferredSession?: ClientSession | null,
): Promise<ClientSession | null> {
  if (preferredSession && clientSessionOwnsApplicant(profile, preferredSession)) {
    return preferredSession;
  }

  const cookieSession = await getClientSession();
  if (cookieSession && clientSessionOwnsApplicant(profile, cookieSession)) {
    return cookieSession;
  }

  const supabaseSession = await getUserFromSupabaseSession({
    requestTimeoutMs: 4_000,
    retryDelaysMs: [],
  });
  if (supabaseSession && clientSessionOwnsApplicant(profile, supabaseSession)) {
    return supabaseSession;
  }

  return null;
}

/** Applicant profile id for `/api/applications/*` ownership checks. */
export async function getApplicationApiApplicantProfileId(): Promise<string | null> {
  const impersonation = await getImpersonationSession();
  if (impersonation) return impersonation.userId;

  const cookieSession = await getClientSession();
  if (cookieSession) return cookieSession.userId;

  const supabaseSession = await getUserFromSupabaseSession({
    requestTimeoutMs: 4_000,
    retryDelaysMs: [],
  });
  return supabaseSession?.userId ?? null;
}
