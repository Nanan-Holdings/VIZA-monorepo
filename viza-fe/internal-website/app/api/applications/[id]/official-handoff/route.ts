import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getApplicationApiApplicantProfileId } from "@/lib/application-api-auth";
import { getImpersonationSession } from "@/lib/impersonation-session";
import { isAllowedBrowserbaseLiveViewUrl } from "@/lib/browserbase-live-view-url";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

interface ClaimRow {
  claimed?: unknown;
  takeover_id?: unknown;
  application_id?: unknown;
  live_view_url?: unknown;
  expires_at?: unknown;
}

function singleRow(data: unknown): ClaimRow | null {
  const row = Array.isArray(data) ? (data.length === 1 ? data[0] : null) : data;
  return row && typeof row === "object" && !Array.isArray(row) ? (row as ClaimRow) : null;
}

function nonBlank(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

async function authorize(applicationId: string) {
  // The live official session belongs to the applicant alone; staff
  // impersonation must never receive it.
  if (await getImpersonationSession()) {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  const profileId = await getApplicationApiApplicantProfileId();
  if (!profileId) return { ok: false as const, response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  const admin = createAdminClient();
  const { data: application, error } = await admin
    .from("applications")
    .select("id, applicant_id, submission_result")
    .eq("id", applicationId)
    .maybeSingle();
  if (error) return { ok: false as const, response: NextResponse.json({ error: "Application lookup failed" }, { status: 500 }) };
  if (!application) return { ok: false as const, response: NextResponse.json({ error: "Application not found" }, { status: 404 }) };
  if (application.applicant_id !== profileId) {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true as const, admin, profileId, application };
}

/**
 * Open the official-site handoff for the signed-in owner. Returns the live
 * view of the already-filled official session; the applicant submits and
 * pays there themselves. POST because claiming changes handoff state.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: applicationId } = await context.params;
  const auth = await authorize(applicationId);
  if (!auth.ok) return auth.response;
  const { admin, profileId, application } = auth;

  const result = application.submission_result as Record<string, unknown> | null;
  // Before submit, or after the applicant submitted but may still need to pay
  // in the same session; the RPC decides whether that session is still open.
  // Vietnam's submitted result keeps its own status vocabulary (0211).
  const handoffResult =
    result?.status === "awaiting_applicant_official_submit" ||
    ((result?.status === "submitted" || result?.status === "submitted_pending_email") &&
      result.submittedBy === "applicant_on_official_portal");
  if (!handoffResult || !nonBlank(result.handoffId)) {
    return NextResponse.json({ error: "Official handoff is not ready", code: "handoff_not_ready" }, { status: 409 });
  }
  if (result.handoffExpired === true) {
    return NextResponse.json({ error: "Official handoff expired", code: "handoff_expired" }, { status: 410 });
  }

  const { data, error } = await admin.rpc("claim_official_applicant_handoff", {
    p_takeover_id: result.handoffId,
    p_application_id: applicationId,
    p_applicant_id: profileId,
  });
  const claim = error ? null : singleRow(data);
  if (
    !claim ||
    claim.claimed !== true ||
    claim.takeover_id !== result.handoffId ||
    claim.application_id !== applicationId ||
    !nonBlank(claim.live_view_url) ||
    !nonBlank(claim.expires_at) ||
    !Number.isFinite(Date.parse(claim.expires_at))
  ) {
    return NextResponse.json(
      { error: "Official handoff session is no longer available", code: "handoff_unavailable" },
      { status: 409 },
    );
  }
  if (Date.parse(claim.expires_at) <= Date.now()) {
    return NextResponse.json({ error: "Official handoff expired", code: "handoff_expired" }, { status: 410 });
  }
  if (!isAllowedBrowserbaseLiveViewUrl(claim.live_view_url)) {
    return NextResponse.json({ error: "Official handoff URL is unavailable" }, { status: 503 });
  }

  return NextResponse.json(
    { liveViewUrl: claim.live_view_url, expiresAt: claim.expires_at },
    { headers: NO_STORE },
  );
}
