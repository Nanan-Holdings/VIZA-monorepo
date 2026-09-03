import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const COOKIE_NAME = "client_session";
const SESSION_DURATION_DAYS = 7;

/**
 * How long a session minted from a verified Supabase session is trusted before
 * the applicant is re-verified against Supabase Auth.
 *
 * Every server action in the portal starts by resolving the applicant, and
 * without this cookie that means two remote calls (`auth.getUser()` plus a
 * profile lookup) on each one — the dominant cost of a portal page that fires
 * several actions. Ten minutes removes that cost from a browsing session while
 * keeping the window in which a revoked Supabase session still works short.
 */
const DERIVED_SESSION_DURATION_MS = 10 * 60 * 1000;

function getSecret() {
  const secret = process.env.CLIENT_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("CLIENT_SESSION_SECRET must be set and at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

/** True when a signed session cookie can be produced in this deployment. */
function canSignSessions() {
  const secret = process.env.CLIENT_SESSION_SECRET;
  return Boolean(secret && secret.length >= 32);
}

export interface ClientSession {
  userId: string;
  email: string;
  /** Supabase Auth UUID, retained only for legacy ownership columns. */
  authUserId?: string;
  isImpersonation?: boolean;
  userName?: string;
  auditLogId?: string;
}

export async function createClientSession(
  userId: string,
  email: string,
  authUserId?: string,
): Promise<void> {
  const secret = getSecret();
  const expires = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);
  const token = await new SignJWT({ userId, email, authUserId, type: "client_session", version: 1 })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expires)
    .setIssuedAt()
    .sign(secret);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires,
    path: "/",
  });
}

export async function getClientSession(): Promise<ClientSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const secret = getSecret();
    const { payload } = await jwtVerify(token, secret);
    if (
      typeof payload.userId !== "string" ||
      typeof payload.email !== "string" ||
      (payload.type !== undefined && payload.type !== "client_session")
    ) return null;
    return {
      userId: payload.userId,
      email: payload.email,
      authUserId: typeof payload.authUserId === "string" ? payload.authUserId : undefined,
    };
  } catch {
    return null;
  }
}

export async function getClientSessionFromRequest(request: NextRequest): Promise<ClientSession | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const secret = getSecret();
    const { payload } = await jwtVerify(token, secret);
    if (
      typeof payload.userId !== "string" ||
      typeof payload.email !== "string" ||
      (payload.type !== undefined && payload.type !== "client_session")
    ) return null;
    return {
      userId: payload.userId,
      email: payload.email,
      authUserId: typeof payload.authUserId === "string" ? payload.authUserId : undefined,
    };
  } catch {
    return null;
  }
}

export async function clearClientSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

type ApplicantProfileSessionRow = {
  id: string;
  auth_user_id: string | null;
  email?: string | null;
};

type SupabaseSessionOptions = {
  requestTimeoutMs?: number;
  retryDelaysMs?: readonly number[];
};

export function chooseApplicantProfileForAuthSession({
  authUserId,
  emailMatches,
}: {
  authUserId: string;
  emailMatches: ApplicantProfileSessionRow[];
}): { action: "link"; profileId: string } | { action: "conflict" } | { action: "create" } {
  if (emailMatches.length === 0) return { action: "create" };
  if (emailMatches.length > 1) return { action: "conflict" };

  const [profile] = emailMatches;
  if (!profile.auth_user_id || profile.auth_user_id === authUserId) {
    return { action: "link", profileId: profile.id };
  }

  return { action: "conflict" };
}

/**
 * Get applicant session from Supabase Auth.
 * Finds or creates an applicant_profiles record for the authenticated user.
 */
export async function getUserFromSupabaseSession(
  options: SupabaseSessionOptions = {}
): Promise<ClientSession | null> {
  try {
    const supabase = await createClient(options);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !user.email) return null;

    const adminClient = createAdminClient(options);

    // Try by auth_user_id first
    let { data: profile } = await adminClient
      .from("applicant_profiles")
      .select("id, email")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (profile && profile.email?.toLowerCase() !== user.email.toLowerCase()) {
      const { error: emailSyncError } = await adminClient
        .from("applicant_profiles")
        .update({ email: user.email })
        .eq("id", profile.id)
        .eq("auth_user_id", user.id);
      if (emailSyncError) {
        console.error("Error synchronizing confirmed applicant email:", emailSyncError);
        return null;
      }
      profile = { ...profile, email: user.email };
    }

    if (!profile) {
      // Try by email
      const { data: profilesByEmail, error: profileByEmailError } = await adminClient
        .from("applicant_profiles")
        .select("id, auth_user_id")
        .ilike("email", user.email)
        .is("dependant_of_user_id", null)
        .is("deleted_at", null)
        .limit(2);

      if (profileByEmailError) {
        console.error("Error loading applicant profile by email:", profileByEmailError);
        return null;
      }

      const resolution = chooseApplicantProfileForAuthSession({
        authUserId: user.id,
        emailMatches: (profilesByEmail ?? []) as ApplicantProfileSessionRow[],
      });

      if (resolution.action === "conflict") {
        console.error("Applicant profile auth/email conflict; refusing to relink profile", {
          authUserId: user.id,
          email: user.email,
        });
        return null;
      }

      if (resolution.action === "link") {
        // Link auth_user_id
        const { error: linkError } = await adminClient
          .from("applicant_profiles")
          .update({ auth_user_id: user.id })
          .eq("id", resolution.profileId);

        if (linkError) {
          console.error("Error linking applicant profile to auth user:", linkError);
          return null;
        }

        profile = { id: resolution.profileId, email: user.email };
      } else {
        // Create new profile for first-time OTP login
        const { data: newProfile, error: createError } = await adminClient
          .from("applicant_profiles")
          .insert({ auth_user_id: user.id, email: user.email, language_pref: "en" })
          .select("id, email")
          .single();

        if (createError) {
          console.error("Error creating applicant profile for auth session:", createError);
          return null;
        }

        profile = newProfile;
      }
    }

    if (!profile) return null;
    return { userId: profile.id, email: user.email, authUserId: user.id };
  } catch (error) {
    console.error("Error getting applicant from Supabase session:", error);
    return null;
  }
}

export async function getClientSessionWithFallback(): Promise<ClientSession | null> {
  const cookieSession = await getClientSession();
  if (cookieSession) return cookieSession;

  const supabaseSession = await getUserFromSupabaseSession();
  if (supabaseSession) await cacheVerifiedSession(supabaseSession);
  return supabaseSession;
}

/**
 * Stores an already-verified applicant identity in the signed session cookie so
 * the next server action skips the remote Supabase round trips.
 *
 * Best effort by design: writing cookies is only allowed from Server Actions
 * and Route Handlers, and the signing secret is optional, so a failure here
 * just means the next request verifies against Supabase again.
 */
async function cacheVerifiedSession(session: ClientSession): Promise<void> {
  if (!canSignSessions()) return;
  try {
    const secret = getSecret();
    const expires = new Date(Date.now() + DERIVED_SESSION_DURATION_MS);
    const token = await new SignJWT({
      userId: session.userId,
      email: session.email,
      authUserId: session.authUserId,
      type: "client_session",
      version: 1,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expires)
      .setIssuedAt()
      .sign(secret);
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires,
      path: "/",
    });
  } catch {
    // Read-only cookie store (a Server Component render) or a signing problem.
  }
}

export async function getImpersonationSession(): Promise<null> {
  return null;
}
