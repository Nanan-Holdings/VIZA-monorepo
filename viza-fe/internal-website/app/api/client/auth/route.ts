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

function jsonError(error: string, _status = 200, code?: string) {
  // Authentication failures are expected application states, not browser
  // transport failures. Keep them as JSON so the login UI can recover without
  // generating a browser console error for a 4xx/5xx response.
  return NextResponse.json({ success: false, error, code });
}

class SupabaseAuthUnavailableError extends Error {
  constructor() {
    super("supabase_auth_unavailable");
    this.name = "SupabaseAuthUnavailableError";
  }
}

function readErrorField(error: unknown, field: "name" | "message"): string {
  if (typeof error !== "object" || error === null) return "";

  const value = (error as Record<string, unknown>)[field];
  return typeof value === "string" ? value : "";
}

function isSupabaseUnavailable(error: unknown): boolean {
  if (error instanceof SupabaseAuthUnavailableError) return true;

  const name = readErrorField(error, "name");
  const message = readErrorField(error, "message").toLowerCase();
  return (
    name === "AbortError" ||
    name === "TimeoutError" ||
    name === "AuthRetryableFetchError" ||
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("econnreset")
  );
}

function providerUnavailableResponse() {
  return NextResponse.json(
    {
      success: false,
      code: "provider_unavailable",
      error: "The authentication provider is temporarily unavailable.",
    },
    { headers: { "Retry-After": "3" } }
  );
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
    });

    if (operation === "password") {
      const password = readString(payload.password);
      if (!password) return jsonError("Please enter a password");

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        return isSupabaseUnavailable(error)
          ? providerUnavailableResponse()
          : jsonError(error.message, 401);
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

  return jsonError("Unsupported authentication operation");
}
