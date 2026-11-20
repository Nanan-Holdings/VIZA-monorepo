import { NextResponse } from "next/server";
import { agentBackendBaseUrls } from "@/lib/agent-backend-url.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { toBrowserSafeFranceVisasAccount } from "./route-handler";

export const dynamic = "force-dynamic";

const LINK_TIMEOUT_MS = 12_000;

type ApplicationRow = {
  id: string;
  applicant_id: string;
};

type FvAccountRow = {
  id: string;
  updated_at?: string | null;
  created_at?: string | null;
};

function noStoreHeaders() {
  return {
    "Cache-Control": "private, no-store",
    Pragma: "no-cache",
    "X-Content-Type-Options": "nosniff",
  };
}

/**
 * Whether this application's France-Visas account exists (the worker
 * registers one per application). Browser-safe status
 * only — credentials are encrypted with a key this app does not hold, and are
 * never selected here.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: applicationId } = await context.params;
  if (!applicationId) {
    return NextResponse.json({ error: "Missing application id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("applicant_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }
  if (!profile) {
    return NextResponse.json({ error: "Applicant profile not found" }, { status: 404 });
  }

  const { data: applicationData, error: applicationError } = await admin
    .from("applications")
    .select("id, applicant_id")
    .eq("id", applicationId)
    .maybeSingle();
  if (applicationError) {
    return NextResponse.json({ error: applicationError.message }, { status: 500 });
  }
  const application = applicationData as ApplicationRow | null;
  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  if (application.applicant_id !== profile.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: accountData, error: accountError } = await admin
    .from("fv_accounts")
    .select("id, updated_at, created_at")
    .eq("application_id", application.id)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (accountError) {
    return NextResponse.json({ error: accountError.message }, { status: 500 });
  }

  const account = accountData as FvAccountRow | null;
  return NextResponse.json(
    { ok: true, account: account ? toBrowserSafeFranceVisasAccount(account) : null },
    { headers: noStoreHeaders() },
  );
}

/**
 * Link the France-Visas login the applicant registered themselves. The
 * agent-backend owns the submission secret cipher, so this forwards the
 * owner's session; the password is never stored or logged here.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: applicationId } = await context.params;
  if (!applicationId) {
    return NextResponse.json({ error: "Missing application id" }, { status: 400, headers: noStoreHeaders() });
  }

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401, headers: noStoreHeaders() });
  }
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401, headers: noStoreHeaders() });
  }

  const input = (await request.json().catch(() => null)) as { email?: unknown; password?: unknown } | null;
  const payload = JSON.stringify({ email: input?.email, password: input?.password });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LINK_TIMEOUT_MS);
  try {
    let upstream: Response | null = null;
    let lastError: unknown = null;
    for (const baseUrl of agentBackendBaseUrls()) {
      try {
        upstream = await fetch(
          `${baseUrl}/api/applications/${encodeURIComponent(applicationId)}/france-visas-account`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: payload,
            cache: "no-store",
            signal: controller.signal,
          },
        );
        break;
      } catch (error) {
        lastError = error;
        if (controller.signal.aborted) break;
      }
    }
    if (!upstream) throw lastError ?? new Error("agent-backend unreachable");

    const body = (await upstream.json().catch(() => null)) as Record<string, unknown> | null;
    if (!upstream.ok) {
      return NextResponse.json(
        { error: typeof body?.error === "string" ? body.error : "Could not link the France-Visas account" },
        { status: upstream.status, headers: noStoreHeaders() },
      );
    }
    return NextResponse.json(
      {
        ok: true,
        email: typeof body?.email === "string" ? body.email : null,
        linkedAt: typeof body?.linkedAt === "string" ? body.linkedAt : null,
      },
      { headers: noStoreHeaders() },
    );
  } catch {
    return NextResponse.json(
      { error: "France-Visas account service is unavailable" },
      { status: 503, headers: noStoreHeaders() },
    );
  } finally {
    clearTimeout(timeout);
  }
}
