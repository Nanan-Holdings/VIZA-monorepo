export interface ApplicantProfileIdentityRow {
  id: string;
  auth_user_id?: string | null;
  email?: string | null;
  [key: string]: unknown;
}

export interface ApplicantProfileIdentityStore<
  TProfile extends ApplicantProfileIdentityRow = ApplicantProfileIdentityRow,
> {
  findByAuthUserId(authUserId: string): Promise<{ profile: TProfile | null; error?: string }>;
  findByEmail(email: string): Promise<{ profile: TProfile | null; error?: string }>;
  bindProfileToAuthUser(
    profileId: string,
    authUserId: string,
  ): Promise<{ profile: TProfile | null; error?: string }>;
}

export interface AuthUserIdentity {
  id: string;
  email?: string | null;
}

export type ApplicantProfileIdentityResult<
  TProfile extends ApplicantProfileIdentityRow = ApplicantProfileIdentityRow,
> =
  | {
      profile: TProfile | null;
      recoveredByEmail: boolean;
      error?: undefined;
    }
  | {
      profile: null;
      recoveredByEmail: boolean;
      error: string;
    };

function normalizeEmail(email: string | null | undefined) {
  const normalized = email?.trim().toLowerCase();
  return normalized || null;
}

export async function resolveApplicantProfileForAuthUser<
  TProfile extends ApplicantProfileIdentityRow = ApplicantProfileIdentityRow,
>(
  store: ApplicantProfileIdentityStore<TProfile>,
  user: AuthUserIdentity,
): Promise<ApplicantProfileIdentityResult<TProfile>> {
  const byAuthUser = await store.findByAuthUserId(user.id);
  if (byAuthUser.error) {
    return { profile: null, recoveredByEmail: false, error: byAuthUser.error };
  }
  if (byAuthUser.profile) {
    return { profile: byAuthUser.profile, recoveredByEmail: false };
  }

  const email = normalizeEmail(user.email);
  if (!email) return { profile: null, recoveredByEmail: false };

  const byEmail = await store.findByEmail(email);
  if (byEmail.error) {
    return { profile: null, recoveredByEmail: false, error: byEmail.error };
  }
  if (!byEmail.profile) {
    return { profile: null, recoveredByEmail: false };
  }

  if (byEmail.profile.auth_user_id === user.id) {
    return { profile: byEmail.profile, recoveredByEmail: true };
  }

  const rebound = await store.bindProfileToAuthUser(byEmail.profile.id, user.id);
  if (rebound.error) {
    return { profile: null, recoveredByEmail: true, error: rebound.error };
  }

  return {
    profile: rebound.profile ?? { ...byEmail.profile, auth_user_id: user.id },
    recoveredByEmail: true,
  };
}
