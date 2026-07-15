import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type AuthOperation = "password" | "send_otp" | "verify_otp";
const SUPABASE_AUTH_TIMEOUT_MS = 6_000;

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

function withSupabaseTimeout<T>(operation: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new SupabaseAuthUnavailableError()),
      SUPABASE_AUTH_TIMEOUT_MS
    );

    operation.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      }
    );
  });
}

function isSupabaseUnavailable(error: unknown): boolean {
  if (error instanceof SupabaseAuthUnavailableError) return true;
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  return (
    error.name === "AbortError" ||
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
    const supabase = await createClient();

    if (operation === "password") {
      const password = readString(payload.password);
      if (!password) return jsonError("Please enter a password");

      const { error } = await withSupabaseTimeout(
        supabase.auth.signInWithPassword({ email, password })
      );
      return error
        ? isSupabaseUnavailable(error)
          ? providerUnavailableResponse()
          : jsonError(error.message, 401)
        : NextResponse.json({ success: true });
    }

    if (operation === "send_otp") {
      const { error } = await withSupabaseTimeout(
        supabase.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: false },
        })
      );
      return error
        ? isSupabaseUnavailable(error)
          ? providerUnavailableResponse()
          : jsonError(error.message, 400)
        : NextResponse.json({ success: true });
    }

    if (operation === "verify_otp") {
      const token = readString(payload.token);
      if (!/^\d{6,8}$/.test(token)) return jsonError("Please enter a valid verification code");

      const { error } = await withSupabaseTimeout(
        supabase.auth.verifyOtp({ email, token, type: "email" })
      );
      return error
        ? isSupabaseUnavailable(error)
          ? providerUnavailableResponse()
          : jsonError(error.message, 401)
        : NextResponse.json({ success: true });
    }
  } catch (error) {
    if (isSupabaseUnavailable(error)) return providerUnavailableResponse();
    return jsonError("Authentication service request failed", 500);
  }

  return jsonError("Unsupported authentication operation");
}
