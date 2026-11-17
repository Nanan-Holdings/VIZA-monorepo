import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getApplicationApiApplicantProfileId } from "@/lib/application-api-auth";
import { getImpersonationSession } from "@/lib/impersonation-session";

export const dynamic = "force-dynamic";

/**
 * Cancel the signed-in applicant's official submission (migration 0209).
 * Queued work and open handoffs are cancelled at once; a run already filling
 * the official site is asked to stop at its next step. Answers are kept.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: applicationId } = await context.params;
  if (await getImpersonationSession()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const profileId = await getApplicationApiApplicantProfileId();
  if (!profileId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("cancel_official_applicant_submission", {
    p_application_id: applicationId,
    p_applicant_id: profileId,
  });
  const row = (Array.isArray(data) ? data[0] : data) as { outcome?: unknown } | null | undefined;
  if (error || (row?.outcome !== "cancelled" && row?.outcome !== "cancel_requested")) {
    return NextResponse.json(
      { error: "There is no submission to cancel right now", code: "nothing_to_cancel" },
      { status: 409 },
    );
  }
  return NextResponse.json({ outcome: row.outcome }, { headers: { "Cache-Control": "no-store" } });
}
