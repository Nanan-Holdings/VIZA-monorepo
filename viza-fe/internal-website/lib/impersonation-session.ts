import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

// Single session cookie for impersonation
const IMPERSONATION_SESSION_COOKIE = "impersonation_session";
const IMPERSONATION_DURATION_MS = 60 * 60 * 1000; // 1 hour

function getSecret() {
  const secret = process.env.CLIENT_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "CLIENT_SESSION_SECRET must be set and at least 32 characters"
    );
  }
  return new TextEncoder().encode(secret);
}

export interface ImpersonationSession {
  userId: string;
  userEmail: string;
  userName: string;
  auditLogId: string;
  isImpersonation: true;
}

// Internal session data (stored in cookie)
interface SessionPayload {
  userId: string;
  userEmail: string;
  userName: string;
  auditLogId: string;
  exp: number;
  type: "impersonation_session";
  [key: string]: unknown;
}

/**
 * Get the current impersonation session from cookies (for Server Components/Actions)
 * Returns null if no valid impersonation session exists
 */
export async function getImpersonationSession(): Promise<ImpersonationSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(IMPERSONATION_SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  try {
    const secret = getSecret();
    const { payload } = await jwtVerify(token, secret);

    if (payload.type !== "impersonation_session") {
      return null;
    }

    const session = payload as unknown as SessionPayload;

    // Check expiration
    if (session.exp < Date.now()) {
      return null;
    }

    return {
      userId: session.userId,
      userEmail: session.userEmail,
      userName: session.userName,
      auditLogId: session.auditLogId,
      isImpersonation: true,
    };
  } catch {
    return null;
  }
}

/**
 * Get impersonation session from a NextRequest (for middleware/proxy)
 */
export async function getImpersonationSessionFromRequest(
  request: NextRequest
): Promise<ImpersonationSession | null> {
  const token = request.cookies.get(IMPERSONATION_SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  try {
    const secret = getSecret();
    const { payload } = await jwtVerify(token, secret);

    if (payload.type !== "impersonation_session") {
      return null;
    }

    const session = payload as unknown as SessionPayload;

    // Check expiration
    if (session.exp < Date.now()) {
      return null;
    }

    return {
      userId: session.userId,
      userEmail: session.userEmail,
      userName: session.userName,
      auditLogId: session.auditLogId,
      isImpersonation: true,
    };
  } catch {
    return null;
  }
}

/**
 * Create an impersonation session cookie
 * This overwrites any existing impersonation session
 */
export async function createImpersonationCookie(
  response: NextResponse,
  data: {
    userId: string;
    userEmail: string;
    userName: string;
    auditLogId: string;
  }
): Promise<void> {
  const secret = getSecret();
  const exp = Date.now() + IMPERSONATION_DURATION_MS;

  const token = await new SignJWT({
    userId: data.userId,
    userEmail: data.userEmail,
    userName: data.userName,
    auditLogId: data.auditLogId,
    exp,
    type: "impersonation_session",
  } as SessionPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .sign(secret);

  response.cookies.set(IMPERSONATION_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(exp),
    path: "/", // Use root path so cookie is sent to both /client/* and /api/client/*
  });
}

/**
 * Clear the impersonation session cookie
 */
export async function clearImpersonationSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(IMPERSONATION_SESSION_COOKIE);
}

/**
 * Check if the current request has an active impersonation session
 */
export async function isImpersonating(): Promise<boolean> {
  const session = await getImpersonationSession();
  return session !== null;
}

/**
 * Validate impersonation session and return validation result
 * Used by client-side to check if session is still valid
 */
export async function validateImpersonationSession(): Promise<{
  valid: boolean;
  userId?: string;
}> {
  const session = await getImpersonationSession();
  if (session) {
    return { valid: true, userId: session.userId };
  }
  return { valid: false };
}
