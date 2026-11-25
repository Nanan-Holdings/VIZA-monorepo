import { NextResponse } from "next/server";
import { agentBackendBaseUrls } from "@/lib/agent-backend-url.server";
import { getImpersonationSession } from "@/lib/impersonation-session";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const REVEAL_TIMEOUT_MS = 12_000;

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
  if (status === 404) return "The France-Visas account has not been created yet";
  if (status === 409) return "This application is not a France short-stay application";
  return "Could not reveal the France-Visas account";
}

/**
 * Explicit owner-session reveal of the per-application France-Visas login.
 * Staff impersonation is rejected; only the signed-in applicant's Supabase
 * bearer token is forwarded to the application-scoped agent-backend route,
 * which holds the cipher key.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: applicationId } = await context.params;
  if (!applicationId) {
    return NextResponse.json({ error: "Missing application id" }, { status: 400, headers: noStoreHeaders() });
  }

  if (await getImpersonationSession()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: noStoreHeaders() });
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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REVEAL_TIMEOUT_MS);
  try {
    let upstream: Response | null = null;
    let lastError: unknown = null;
    for (const baseUrl of agentBackendBaseUrls()) {
      try {
        upstream = await fetch(
          `${baseUrl}/api/applications/${encodeURIComponent(applicationId)}/france-visas-account/reveal`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
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
        { error: upstreamError(upstream.status) },
        { status: upstream.status, headers: noStoreHeaders() },
      );
    }
    if (
      typeof body?.email !== "string"
      || typeof body.password !== "string"
      || typeof body.revealedAt !== "string"
    ) {
      return NextResponse.json(
        { error: "France-Visas account response was incomplete" },
        { status: 502, headers: noStoreHeaders() },
      );
    }

    return NextResponse.json(
      { email: body.email, password: body.password, revealedAt: body.revealedAt },
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
