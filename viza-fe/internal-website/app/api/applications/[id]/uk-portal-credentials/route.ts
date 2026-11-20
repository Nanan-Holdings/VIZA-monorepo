import { NextResponse } from "next/server";
import { getApplicationApiApplicantProfileId } from "@/lib/application-api-auth";
import { getImpersonationSession } from "@/lib/impersonation-session";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const CANONICAL_AGENT_BACKEND_URL = "https://viza-agent-backend-gqix.onrender.com";
const REVEAL_TIMEOUT_MS = 12_000;

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function getAgentBackendUrl(): string {
  const configured =
    process.env.AGENT_BACKEND_URL?.trim()
    || process.env.NEXT_PUBLIC_AGENT_BACKEND_URL?.trim();
  if (configured) return normalizeBaseUrl(configured);
  return process.env.NODE_ENV === "production"
    ? CANONICAL_AGENT_BACKEND_URL
    : "http://localhost:3002";
}

async function fetchCredentialReveal(
  applicationId: string,
  token: string,
  signal: AbortSignal,
): Promise<Response> {
  const primaryUrl = getAgentBackendUrl();
  const retryUrl =
    process.env.NODE_ENV === "production" && primaryUrl !== CANONICAL_AGENT_BACKEND_URL
      ? CANONICAL_AGENT_BACKEND_URL
      : primaryUrl;
  let lastError: unknown;

  for (const baseUrl of new Set([primaryUrl, retryUrl])) {
    try {
      return await fetch(
        `${baseUrl}/api/applications/${encodeURIComponent(applicationId)}/uk-account/reveal`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
          signal,
        },
      );
    } catch (error) {
      lastError = error;
      if (signal.aborted) throw error;
    }
  }

  throw lastError;
}

function noStoreHeaders() {
  return {
    "Cache-Control": "private, no-store",
    Pragma: "no-cache",
    "X-Content-Type-Options": "nosniff",
  };
}

function upstreamError(status: number): string {
  if (status === 401) return "Not authenticated";
  if (status === 403) return "Forbidden";
  if (status === 404 || status === 409) return "The UK managed account is not available";
  if (status === 400) return "Invalid UK managed account request";
  return "Could not reveal the UK managed account";
}

/**
 * Legacy GET compatibility boundary. UKVI credentials are not exposed by GET;
 * the explicit POST below is the only owner-authorized reveal path.
 */
export async function GET(): Promise<Response> {
  const profileId = await getApplicationApiApplicantProfileId();
  if (!profileId) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      error: "UK portal credentials are managed by VIZA and are not customer-accessible",
    },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Explicit owner-session reveal. This route intentionally rejects staff
 * impersonation and forwards only the signed-in applicant's Supabase bearer
 * token to the application-scoped agent-backend endpoint.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: applicationId } = await context.params;
  if (!applicationId) {
    return NextResponse.json(
      { error: "Missing application id" },
      { status: 400, headers: noStoreHeaders() },
    );
  }

  if (await getImpersonationSession()) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: noStoreHeaders() },
    );
  }

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401, headers: noStoreHeaders() },
    );
  }
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401, headers: noStoreHeaders() },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REVEAL_TIMEOUT_MS);
  try {
    const upstream = await fetchCredentialReveal(applicationId, token, controller.signal);
    const body = (await upstream.json().catch(() => null)) as Record<string, unknown> | null;
    if (!upstream.ok) {
      return NextResponse.json(
        { error: upstreamError(upstream.status) },
        { status: upstream.status, headers: noStoreHeaders() },
      );
    }
    if (
      typeof body?.email !== "string"
      || typeof body.password !== "string"
      || typeof body.resumeUrl !== "string"
      || typeof body.revealedAt !== "string"
    ) {
      return NextResponse.json(
        { error: "UK managed account response was incomplete" },
        { status: 502, headers: noStoreHeaders() },
      );
    }

    return NextResponse.json(
      {
        email: body.email,
        password: body.password,
        resumeUrl: body.resumeUrl,
        revealedAt: body.revealedAt,
      },
      { headers: noStoreHeaders() },
    );
  } catch {
    return NextResponse.json(
      { error: "UK managed account service is unavailable" },
      { status: 503, headers: noStoreHeaders() },
    );
  } finally {
    clearTimeout(timeout);
  }
}
