import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const COOKIE_NAME = "client_session";
const SESSION_DURATION_DAYS = 7;

function getSecret() {
  const secret = process.env.CLIENT_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("CLIENT_SESSION_SECRET must be set and at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

export interface ClientSession {
  userId: string;
  email: string;
  isImpersonation?: boolean;
  userName?: string;
  auditLogId?: string;
}

export async function createClientSession(userId: string, email: string): Promise<void> {
  const secret = getSecret();
  const expires = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);
  const token = await new SignJWT({ userId, email })
    .setProtectedHeader({ alg: "HS256" })
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
    if (typeof payload.userId !== "string" || typeof payload.email !== "string") return null;
    return { userId: payload.userId, email: payload.email };
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
    if (typeof payload.userId !== "string" || typeof payload.email !== "string") return null;
    return { userId: payload.userId, email: payload.email };
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
export async function getUserFromSupabaseSession(): Promise<ClientSession | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !user.email) return null;

    const adminClient = createAdminClient();

    // Try by auth_user_id first
    let { data: profile } = await adminClient
      .from("applicant_profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!profile) {
      // Try by email
      const { data: profilesByEmail, error: profileByEmailError } = await adminClient
        .from("applicant_profiles")
        .select("id, auth_user_id")
        .ilike("email", user.email)
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

        profile = { id: resolution.profileId };
      } else {
        // Create new profile for first-time OTP login
        const { data: newProfile, error: createError } = await adminClient
          .from("applicant_profiles")
          .insert({ auth_user_id: user.id, email: user.email, language_pref: "en" })
          .select("id")
          .single();

        if (createError) {
          console.error("Error creating applicant profile for auth session:", createError);
          return null;
        }

        profile = newProfile;
      }
    }

    if (!profile) return null;
    return { userId: profile.id, email: user.email };
  } catch (error) {
    console.error("Error getting applicant from Supabase session:", error);
    return null;
  }
}

export async function getClientSessionWithFallback(): Promise<ClientSession | null> {
  const cookieSession = await getClientSession();
  if (cookieSession) return cookieSession;
  return getUserFromSupabaseSession();
}

export async function getImpersonationSession(): Promise<null> {
  return null;
}

