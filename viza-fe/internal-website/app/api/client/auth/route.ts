import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type AuthOperation = "password" | "send_otp" | "verify_otp";

interface ClientAuthRequest {
  operation?: unknown;
  email?: unknown;
  password?: unknown;
  token?: unknown;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function jsonError(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
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

  const supabase = await createClient();

  if (operation === "password") {
    const password = readString(payload.password);
    if (!password) return jsonError("Please enter a password");

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error
      ? jsonError(error.message, 401)
      : NextResponse.json({ success: true });
  }

  if (operation === "send_otp") {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    return error
      ? jsonError(error.message, 400)
      : NextResponse.json({ success: true });
  }

  if (operation === "verify_otp") {
    const token = readString(payload.token);
    if (!/^\d{6,8}$/.test(token)) return jsonError("Please enter a valid verification code");

    const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    return error
      ? jsonError(error.message, 401)
      : NextResponse.json({ success: true });
  }

  return jsonError("Unsupported authentication operation");
}
