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
};

export type SupabaseSessionOptions = {
  requestTimeoutMs?: number;
  /** Retained for source compatibility; auth identity reads never retry. */
  retryDelaysMs?: readonly number[];
  requestSignal?: AbortSignal;
};

export type ClientSessionUnavailableReason = "timeout" | "cancelled" | "provider";

export type ClientSessionUnauthenticatedReason =
  | "missing_auth_session"
  | "invalid_auth_session"
  | "missing_profile"
  | "profile_conflict";

export type ClientSessionReadResult =
  | {
      status: "authenticated";
      session: ClientSession;
      source: "cookie" | "supabase";
    }
  | {
      status: "unauthenticated";
      session: null;
      reason: ClientSessionUnauthenticatedReason;
    }
  | {
      status: "unavailable";
      session: null;
      reason: ClientSessionUnavailableReason;
    };

const DEFAULT_SUPABASE_SESSION_TIMEOUT_MS = 3_000;

type SessionDeadline = {
  signal: AbortSignal;
  cleanup: () => void;
};

function resolveSessionTimeout(timeoutMs?: number): number {
  return timeoutMs !== undefined && Number.isFinite(timeoutMs) && timeoutMs > 0
    ? timeoutMs
    : DEFAULT_SUPABASE_SESSION_TIMEOUT_MS;
}

function createSessionDeadline(
  timeoutMs: number,
  upstreamSignal?: AbortSignal,
): SessionDeadline {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new DOMException("Supabase session deadline exceeded", "TimeoutError"));
  }, timeoutMs);

  let upstreamAbort: (() => void) | undefined;
  if (upstreamSignal) {
    upstreamAbort = () => {
      controller.abort(
        upstreamSignal.reason ?? new DOMException("Supabase session request cancelled", "AbortError"),
      );
    };
    if (upstreamSignal.aborted) {
      upstreamAbort();
    } else {
      upstreamSignal.addEventListener("abort", upstreamAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeoutId);
      if (upstreamAbort) upstreamSignal?.removeEventListener("abort", upstreamAbort);
    },
  };
}

function readErrorField(error: unknown, field: "name" | "message" | "code"): string {
  if (typeof error !== "object" || error === null) return "";
  const value = (error as Record<string, unknown>)[field];
  return typeof value === "string" ? value : "";
}

function isUnavailableError(error: unknown, signal: AbortSignal): boolean {
  if (signal.aborted) return true;

  const name = readErrorField(error, "name");
  const code = readErrorField(error, "code").toLowerCase();
  const message = readErrorField(error, "message").toLowerCase();
  const status = typeof error === "object" && error !== null
    ? Number((error as Record<string, unknown>).status)
    : Number.NaN;

  return (
    error instanceof TypeError ||
    (error instanceof DOMException &&
      ["AbortError", "NetworkError", "TimeoutError"].includes(error.name)) ||
    ["AbortError", "AuthRetryableFetchError", "SupabaseCircuitOpenError", "TimeoutError"].includes(name) ||
    (Number.isFinite(status) && (status === 408 || status === 425 || status === 429 || status >= 500)) ||
    code === "unexpected_failure" ||
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("econn") ||
    message.includes("database error")
  );
}

function unavailableReason(
  deadlineSignal: AbortSignal,
  upstreamSignal?: AbortSignal,
): ClientSessionUnavailableReason {
  if (upstreamSignal?.aborted) return "cancelled";
  if (deadlineSignal.aborted) return "timeout";
  return "provider";
}

function unavailableResult(
  reason: ClientSessionUnavailableReason,
): ClientSessionReadResult {
  return { status: "unavailable", session: null, reason };
}

function unauthenticatedResult(
  reason: ClientSessionUnauthenticatedReason,
): ClientSessionReadResult {
  return { status: "unauthenticated", session: null, reason };
}

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

function escapeIlikePattern(value: string): string {
  // `.ilike()` accepts a PostgreSQL LIKE pattern. Escape the pattern
  // metacharacters so an email lookup remains case-insensitive but exact.
  return value.replace(/[\\%_]/g, "\\$&");
}

async function readSupabaseSession(
  options: SupabaseSessionOptions = {},
  allowProfileBootstrap = false,
): Promise<ClientSessionReadResult> {
  const timeoutMs = resolveSessionTimeout(options.requestTimeoutMs);
  const deadline = createSessionDeadline(timeoutMs, options.requestSignal);
  const clientOptions: SupabaseSessionOptions = {
    requestTimeoutMs: timeoutMs,
    // Auth identity resolution is deliberately single-attempt. Retrying a
    // session read multiplies the hot-path load and can outlive the caller.
    retryDelaysMs: [],
    requestSignal: deadline.signal,
  };

  try {
    deadline.signal.throwIfAborted();
    const supabase = await createClient(clientOptions);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      return isUnavailableError(authError, deadline.signal)
        ? unavailableResult(unavailableReason(deadline.signal, options.requestSignal))
        : unauthenticatedResult("invalid_auth_session");
    }
    if (!user || !user.email) return unauthenticatedResult("missing_auth_session");

    const adminClient = createAdminClient(clientOptions);
    const { data: profile, error: profileError } = await adminClient
      .from("applicant_profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    // A failed auth-id lookup is not the same as an empty lookup. Do not fall
    // through to email matching or profile creation after a provider failure.
    if (profileError) {
      return unavailableResult(unavailableReason(deadline.signal, options.requestSignal));
    }

    if (profile) {
      return {
        status: "authenticated",
        source: "supabase",
        session: { userId: profile.id, email: user.email, authUserId: user.id },
      };
    }

    const { data: profilesByEmail, error: profileByEmailError } = await adminClient
      .from("applicant_profiles")
      .select("id, auth_user_id")
      .ilike("email", escapeIlikePattern(user.email))
      .limit(2);

    if (profileByEmailError) {
      return unavailableResult(unavailableReason(deadline.signal, options.requestSignal));
    }

    const resolution = chooseApplicantProfileForAuthSession({
      authUserId: user.id,
      emailMatches: (profilesByEmail ?? []) as ApplicantProfileSessionRow[],
    });

    if (resolution.action === "conflict") {
      return unauthenticatedResult("profile_conflict");
    }

    if (resolution.action === "link") {
      if (!allowProfileBootstrap) {
        // A read-only session can use the existing unlinked profile by id. The
        // explicit login/bootstrap path may link it later.
        return {
          status: "authenticated",
          source: "supabase",
          session: { userId: resolution.profileId, email: user.email, authUserId: user.id },
        };
      }

      const { error: linkError } = await adminClient
        .from("applicant_profiles")
        .update({ auth_user_id: user.id })
        .eq("id", resolution.profileId);

      if (linkError) {
        return unavailableResult(unavailableReason(deadline.signal, options.requestSignal));
      }

      return {
        status: "authenticated",
        source: "supabase",
        session: { userId: resolution.profileId, email: user.email, authUserId: user.id },
      };
    }

    if (!allowProfileBootstrap) return unauthenticatedResult("missing_profile");

    // First-time OTP login is the only compatibility path that creates a new
    // applicant profile. Read-only session checks never reach this branch.
    const { data: newProfile, error: createError } = await adminClient
      .from("applicant_profiles")
      .insert({ auth_user_id: user.id, email: user.email, language_pref: "en" })
      .select("id")
      .single();

    if (createError || !newProfile) {
      return unavailableResult(unavailableReason(deadline.signal, options.requestSignal));
    }

    return {
      status: "authenticated",
      source: "supabase",
      session: { userId: newProfile.id, email: user.email, authUserId: user.id },
    };
  } catch (error) {
    if (isUnavailableError(error, deadline.signal)) {
      return unavailableResult(unavailableReason(deadline.signal, options.requestSignal));
    }
    // Keep configuration/internal details out of the response and logs. The
    // legacy nullable API remains fail-closed for unexpected failures.
    return unavailableResult("provider");
  } finally {
    deadline.cleanup();
  }
}

/**
 * Read the current applicant identity without linking or creating a profile.
 * The result distinguishes an absent/invalid session from a provider outage so
 * callers can keep authentication failures fail-closed without hiding outages
 * as empty applicant data.
 */
export async function getClientSessionReadResult(
  options: SupabaseSessionOptions = {},
): Promise<ClientSessionReadResult> {
  const cookieSession = await getClientSession();
  if (cookieSession) {
    return { status: "authenticated", source: "cookie", session: cookieSession };
  }
  return readSupabaseSession(options);
}

/**
 * Get applicant session from Supabase Auth. This legacy nullable API retains
 * the explicit login/bootstrap behavior, including first-time profile setup.
 */
export async function getUserFromSupabaseSession(
  options: SupabaseSessionOptions = {},
): Promise<ClientSession | null> {
  const result = await readSupabaseSession(options, true);
  return result.status === "authenticated" ? result.session : null;
}

/** Legacy nullable wrapper retained for existing actions and routes. */
export async function getClientSessionWithFallback(
  options: SupabaseSessionOptions = {},
): Promise<ClientSession | null> {
  const result = await getClientSessionReadResult(options);
  return result.status === "authenticated" ? result.session : null;
}

export async function getImpersonationSession(): Promise<null> {
  return null;
}
