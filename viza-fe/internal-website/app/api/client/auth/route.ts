import { NextResponse } from "next/server";
import {
  clearClientSession,
  createClientSession,
  getUserFromSupabaseSession,
} from "@/lib/client-session";
import { createClient } from "@/lib/supabase/server";
import {
  cacheContinuityIdentity,
  sendContinuityOtp,
  verifyContinuityOtp,
} from "@/lib/resilience/continuity-auth";
import { SupabaseCircuitOpenError } from "@/lib/supabase/circuit-breaker";

type AuthOperation = "password" | "send_otp" | "verify_otp";
// Hosted email OTP requests include SMTP delivery and can legitimately take
// longer than password verification. Recent production requests completed in
// 8-9 seconds, so the previous 6-second deadline reported a false outage and
// abandoned successful code requests before the UI could advance.
const SUPABASE_AUTH_TIMEOUT_MS = 20_000;
const CLIENT_SESSION_BOOTSTRAP_TIMEOUT_MS = 500;

interface ClientAuthRequest {
  operation?: unknown;
  email?: unknown;
  password?: unknown;
  token?: unknown;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function jsonError(error: string, status = 400, code?: string) {
  return NextResponse.json(
    { success: false, error, code },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

class SupabaseAuthUnavailableError extends Error {
  constructor() {
    super("supabase_auth_unavailable");
    this.name = "SupabaseAuthUnavailableError";
  }
}

function readErrorField(error: unknown, field: "name" | "message" | "code"): string {
  if (typeof error !== "object" || error === null) return "";

  const value = (error as Record<string, unknown>)[field];
  return typeof value === "string" ? value : "";
}

function isSupabaseUnavailable(error: unknown): boolean {
  if (error instanceof SupabaseAuthUnavailableError || error instanceof SupabaseCircuitOpenError) {
    return true;
  }

  const name = readErrorField(error, "name");
  const code = readErrorField(error, "code").toLowerCase();
  const message = readErrorField(error, "message").toLowerCase();
  const status = typeof error === "object" && error !== null
    ? Number((error as Record<string, unknown>).status)
    : Number.NaN;
  return (
    (Number.isFinite(status) && status >= 500) ||
    name === "AbortError" ||
    name === "TimeoutError" ||
    name === "AuthRetryableFetchError" ||
    code === "unexpected_failure" ||
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("econnreset") ||
    message.includes("context canceled") ||
    message.includes("database error querying")
  );
}

function providerUnavailableResponse() {
  return NextResponse.json(
    {
      success: false,
      code: "provider_unavailable",
      error: "The authentication provider is temporarily unavailable.",
    },
    {
      status: 503,
      headers: { "Retry-After": "3", "Cache-Control": "no-store" },
    }
  );
}

async function passwordProviderUnavailableResponse(email: string, requestId: string) {
  try {
    await sendContinuityOtp(email);
    // Keep cached and unknown identities indistinguishable. Known identities
    // receive a code; unknown ones see the same response without an email.
    return NextResponse.json(
      {
        success: false,
        code: "continuity_otp_sent",
        error: "A continuity sign-in code was sent because the authentication provider is unavailable.",
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store", "X-Viza-Request-Id": requestId },
      },
    );
  } catch (continuityError) {
    console.error("Continuity OTP send after password outage failed", {
      error: continuityError instanceof Error ? continuityError.message : String(continuityError),
    });
  }
  return providerUnavailableResponse();
}

async function bootstrapClientSession(): Promise<void> {
  try {
    const session = await getUserFromSupabaseSession({
      requestTimeoutMs: CLIENT_SESSION_BOOTSTRAP_TIMEOUT_MS,
      retryDelaysMs: [],
    });
    if (session) {
      await createClientSession(session.userId, session.email, session.authUserId);
      await cacheContinuityIdentity(session).catch((error) => {
        console.warn("Failed to refresh continuity identity cache", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
  } catch {
    // Supabase authentication already succeeded. Keep its cookie session as a
    // fallback when applicant profile/session bootstrap is temporarily unavailable.
  }
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  let payload: ClientAuthRequest;
  try {
    payload = (await request.json()) as ClientAuthRequest;
  } catch {
    return jsonError("Invalid JSON");
  }

  const operation = readString(payload.operation) as AuthOperation;
  const email = readString(payload.email).toLowerCase();

  if (!email || !email.includes("@")) {
    return jsonError("Please enter a valid email address");
  }

  try {
    const supabase = await createClient({
      requestTimeoutMs: SUPABASE_AUTH_TIMEOUT_MS,
      retryDelaysMs: [],
      circuitBreakerScope: "auth",
    });

    if (operation === "password") {
      const password = readString(payload.password);
      if (!password) return jsonError("Please enter a password");

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (isSupabaseUnavailable(error)) {
          console.error("Supabase password sign-in dependency failure", {
            requestId,
            durationMs: Date.now() - startedAt,
            errorName: readErrorField(error, "name"),
            errorCode: readErrorField(error, "code"),
            status: typeof error === "object" && error !== null
              ? (error as unknown as Record<string, unknown>).status
              : undefined,
          });
          return passwordProviderUnavailableResponse(email, requestId);
        }
        return jsonError(error.message, 401);
      }

      await clearClientSession();
      await bootstrapClientSession();
      return NextResponse.json({ success: true });
    }

    if (operation === "send_otp") {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      if (!error) return NextResponse.json({ success: true });
      if (!isSupabaseUnavailable(error)) return jsonError(error.message, 400);

      try {
        const sent = await sendContinuityOtp(email);
        // Preserve non-enumeration: cached and unknown identities have the same
        // response. Only an existing cached identity receives a message.
        if (sent) return NextResponse.json({ success: true, continuity: true });
        return NextResponse.json({ success: true, continuity: true });
      } catch (continuityError) {
        console.error("Continuity OTP send failed", {
          error: continuityError instanceof Error ? continuityError.message : String(continuityError),
        });
      }
      return providerUnavailableResponse();
    }

    if (operation === "verify_otp") {
      const token = readString(payload.token);
      if (!/^\d{6,8}$/.test(token)) return jsonError("Please enter a valid verification code");

      const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
      if (error) {
        if (!isSupabaseUnavailable(error)) return jsonError(error.message, 401);
        try {
          const session = await verifyContinuityOtp(email, token);
          if (session) {
            await clearClientSession();
            await createClientSession(session.userId, session.email, session.authUserId);
            return NextResponse.json({ success: true, continuity: true });
          }
        } catch (continuityError) {
          console.error("Continuity OTP verification failed", {
            error: continuityError instanceof Error ? continuityError.message : String(continuityError),
          });
        }
        return providerUnavailableResponse();
      }

      await clearClientSession();
      await bootstrapClientSession();
      return NextResponse.json({ success: true });
    }
  } catch (error) {
    if (isSupabaseUnavailable(error)) {
      if (operation === "password") {
        console.error("Supabase password sign-in request failed", {
          requestId,
          durationMs: Date.now() - startedAt,
          errorName: readErrorField(error, "name"),
          errorCode: readErrorField(error, "code"),
        });
        return passwordProviderUnavailableResponse(email, requestId);
      }
      if (operation === "send_otp") {
        try {
          await sendContinuityOtp(email);
          return NextResponse.json({ success: true, continuity: true });
        } catch {
          // Return the controlled provider error below.
        }
      }
      if (operation === "verify_otp") {
        const token = readString(payload.token);
        try {
          const session = await verifyContinuityOtp(email, token);
          if (session) {
            await clearClientSession();
            await createClientSession(session.userId, session.email, session.authUserId);
            return NextResponse.json({ success: true, continuity: true });
          }
        } catch {
          // Return the controlled provider error below.
        }
      }
      return providerUnavailableResponse();
    }
    return jsonError("Authentication service request failed", 500);
  }

  return jsonError("Unsupported authentication operation", 400);
}
