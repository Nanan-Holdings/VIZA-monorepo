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
      const { data: profileByEmail } = await adminClient
        .from("applicant_profiles")
        .select("id")
        .eq("email", user.email)
        .maybeSingle();

      if (profileByEmail) {
        // Link auth_user_id
        await adminClient
          .from("applicant_profiles")
          .update({ auth_user_id: user.id })
          .eq("id", profileByEmail.id);
        profile = profileByEmail;
      } else {
        // Create new profile for first-time OTP login
        const { data: newProfile } = await adminClient
          .from("applicant_profiles")
          .insert({ auth_user_id: user.id, email: user.email, language_pref: "en" })
          .select("id")
          .single();
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

