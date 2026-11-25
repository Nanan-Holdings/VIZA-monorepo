import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getApplicationApiApplicantProfileId } from "@/lib/application-api-auth";
import { getImpersonationSession } from "@/lib/impersonation-session";
import { wakeCloudSubmissionWorker } from "@/lib/submission-worker-wake.server";

export const dynamic = "force-dynamic";

/**
 * Ask the runner to refill the official portal after an expired handoff. The
 * RPC accepts only the owning applicant, only an expired handoff, and at most
 * three handoffs per application in 24 hours.
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
  const { data, error } = await admin.rpc("request_official_applicant_handoff_regeneration", {
    p_application_id: applicationId,
    p_applicant_id: profileId,
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row || (row as { requested?: unknown }).requested !== true) {
    return NextResponse.json(
      {
        error: "A new official session cannot be prepared right now",
        code: "handoff_regeneration_unavailable",
      },
      { status: 409 },
    );
  }
  // The requeued row only runs once its worker is awake; Fly suspends idle
  // workers. The route reads nothing beyond the RPC, so wake both workers
  // that own handoff providers; each claims only its own queue statuses.
  // Best effort: the reconciler still recovers if a wake fails.
  const queueId = (row as { submission_queue_id?: unknown }).submission_queue_id;
  const jobId = typeof queueId === "string" && queueId ? queueId : null;
  await Promise.all(
    ["legacy", "indonesia"].map((target) =>
      wakeCloudSubmissionWorker(jobId, { target }).catch(() => undefined),
    ),
  );
  return NextResponse.json({ requested: true }, { headers: { "Cache-Control": "no-store" } });
}
