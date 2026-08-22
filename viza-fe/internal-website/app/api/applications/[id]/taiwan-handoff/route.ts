import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getApplicationApiApplicantProfileId } from "@/lib/application-api-auth";
import type { TwSubmissionResult } from "@/lib/submission-result";
import { isAllowedTaiwanLiveViewUrl } from "@/lib/taiwan-handoff-url";

export const dynamic = "force-dynamic";

interface TaiwanHandoffClaimRow {
  claimed: unknown;
  takeover_id: unknown;
  job_id: unknown;
  application_id: unknown;
  vnc_url: unknown;
  expires_at: unknown;
}

function parseClaimResult(data: unknown): TaiwanHandoffClaimRow | null {
  if (Array.isArray(data)) {
    if (data.length !== 1) return null;
    data = data[0];
  }
  const row = data;
  return row && typeof row === "object" && !Array.isArray(row)
    ? (row as TaiwanHandoffClaimRow)
    : null;
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: applicationId } = await context.params;
  const profileId = await getApplicationApiApplicantProfileId();
  if (!profileId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  const { data: application, error: applicationError } = await admin
    .from("applications")
    .select("id, applicant_id, submission_result")
    .eq("id", applicationId)
    .maybeSingle();
  if (applicationError) return NextResponse.json({ error: applicationError.message }, { status: 500 });
  if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });
  if (application.applicant_id !== profileId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const result = application.submission_result as TwSubmissionResult | null;
  if (result?.country !== "TW" || result.status !== "stopped_at_captcha") {
    return NextResponse.json({ error: "Taiwan handoff is not ready" }, { status: 409 });
  }

  if (!isNonBlankString(result.handoffId)) {
    return NextResponse.json({ error: "Taiwan handoff session is no longer available" }, { status: 409 });
  }

  const { data: claimData, error: claimError } = await admin.rpc("claim_tw_applicant_handoff", {
    p_takeover_id: result.handoffId,
    p_application_id: applicationId,
    p_applicant_id: profileId,
  });
  if (claimError) {
    return NextResponse.json({ error: "Taiwan handoff session is no longer available" }, { status: 409 });
  }
  const claim = parseClaimResult(claimData);
  if (
    !claim
    || claim.claimed !== true
    || claim.takeover_id !== result.handoffId
    || claim.application_id !== applicationId
    || !isNonBlankString(claim.job_id)
    || !isNonBlankString(claim.vnc_url)
    || !isNonBlankString(claim.expires_at)
    || !Number.isFinite(Date.parse(claim.expires_at))
  ) {
    return NextResponse.json(
      { error: "Taiwan handoff session is no longer available" },
      { status: 409 },
    );
  }
  if (Date.parse(claim.expires_at) <= Date.now()) {
    return NextResponse.json({ error: "Taiwan handoff session expired" }, { status: 410 });
  }
  if (!isAllowedTaiwanLiveViewUrl(claim.vnc_url)) {
    return NextResponse.json({ error: "Taiwan handoff URL is unavailable" }, { status: 503 });
  }

  return NextResponse.json(
    { liveViewUrl: claim.vnc_url, expiresAt: claim.expires_at },
    { headers: { "Cache-Control": "no-store" } },
  );
}
