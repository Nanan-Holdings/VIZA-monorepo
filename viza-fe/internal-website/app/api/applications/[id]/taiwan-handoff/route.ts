import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getApplicationApiApplicantProfileId } from "@/lib/application-api-auth";
import type { TwSubmissionResult } from "@/lib/submission-result";
import { isAllowedTaiwanLiveViewUrl } from "@/lib/taiwan-handoff-url";

export const dynamic = "force-dynamic";

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

  let query = admin
    .from("takeover_session")
    .select("id, applicant_id, status, vnc_url, expires_at")
    .eq("application_id", applicationId)
    .eq("handoff_kind", "taiwan_applicant_final_submit")
    .in("status", ["queued", "claimed"]);
  if (result.handoffId) query = query.eq("id", result.handoffId);
  const { data: handoff, error: handoffError } = await query
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (handoffError) return NextResponse.json({ error: handoffError.message }, { status: 500 });
  if (!handoff || handoff.applicant_id !== profileId) {
    return NextResponse.json({ error: "Taiwan handoff session not found" }, { status: 404 });
  }

  const expiresAt = typeof handoff.expires_at === "string" ? handoff.expires_at : result.handoffExpiresAt;
  if (!expiresAt || Date.parse(expiresAt) <= Date.now()) {
    return NextResponse.json({ error: "Taiwan handoff session expired" }, { status: 410 });
  }
  if (typeof handoff.vnc_url !== "string" || !isAllowedTaiwanLiveViewUrl(handoff.vnc_url)) {
    return NextResponse.json({ error: "Taiwan handoff URL is unavailable" }, { status: 503 });
  }

  await admin
    .from("takeover_session")
    .update({ status: "claimed", claimed_at: new Date().toISOString() })
    .eq("id", handoff.id)
    .eq("status", "queued");
  await admin.from("takeover_action_log").insert({
    takeover_id: handoff.id,
    action: "claim",
    detail: { kind: "taiwan_applicant_final_submit" },
  });

  return NextResponse.json(
    { liveViewUrl: handoff.vnc_url, expiresAt },
    { headers: { "Cache-Control": "no-store" } },
  );
}
