import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getImpersonationSession } from "@/lib/impersonation-session";

const AGENT_BACKEND_URL =
  process.env.AGENT_BACKEND_URL ?? process.env.NEXT_PUBLIC_AGENT_BACKEND_URL ?? "http://localhost:3002";
const TRANSLATION_PROXY_TIMEOUT_MS = 12000;

function isMissingColumnError(message: string, column: string) {
  const normalized = message.toLowerCase();
  return normalized.includes(column.toLowerCase()) &&
    (normalized.includes("schema cache") || normalized.includes("column") || normalized.includes("does not exist"));
}

export async function authorizeApplication(applicationId: string): Promise<NextResponse | null> {
  if (!applicationId) {
    return NextResponse.json({ error: "Missing application id" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: app, error: appError } = await admin
    .from("applications")
    .select("id, applicant_id")
    .eq("id", applicationId)
    .maybeSingle();

  if (appError) {
    return NextResponse.json({ error: appError.message }, { status: 500 });
  }
  if (!app) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const impersonation = await getImpersonationSession();
  if (impersonation) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let { data: profile, error: profileError } = await admin
    .from("applicant_profiles")
    .select("id, auth_user_id, dependant_of_user_id")
    .eq("id", app.applicant_id)
    .maybeSingle();

  if (profileError && isMissingColumnError(profileError.message, "dependant_of_user_id")) {
    const fallback = await admin
      .from("applicant_profiles")
      .select("id, auth_user_id")
      .eq("id", app.applicant_id)
      .maybeSingle();

    profile = fallback.data ? { ...fallback.data, dependant_of_user_id: null } : null;
    profileError = fallback.error;
  }

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  if (!profile || (profile.auth_user_id !== user.id && profile.dependant_of_user_id !== user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}

export async function proxyTranslationRequest(
  path: string,
  init: RequestInit,
): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TRANSLATION_PROXY_TIMEOUT_MS);

  try {
    const response = await fetch(`${AGENT_BACKEND_URL}${path}`, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });

    const body = await response.text();
    return new Response(body, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") ?? "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
