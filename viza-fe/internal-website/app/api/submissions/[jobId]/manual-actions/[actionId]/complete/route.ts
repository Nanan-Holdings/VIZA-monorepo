import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type QueueRow = {
  id: string;
  application_id: string;
};

type ApplicationRow = {
  id: string;
  applicant_id: string;
};

type ManualActionRow = {
  id: string;
  job_id: string | null;
  application_id: string;
  action_type: string;
  status: string;
};

function isMissingManualActionSchema(error: { message?: string; code?: string }): boolean {
  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "PGRST204" ||
    message.includes("could not find the") ||
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    message.includes("vietnam_live_manual_actions")
  );
}

async function authorizeSubmissionJob(jobId: string): Promise<
  | {
      ok: true;
      admin: ReturnType<typeof createAdminClient>;
      queue: QueueRow;
    }
  | { ok: false; response: Response }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("applicant_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileError) {
    return { ok: false, response: NextResponse.json({ error: profileError.message }, { status: 500 }) };
  }
  if (!profile) {
    return { ok: false, response: NextResponse.json({ error: "Applicant profile not found" }, { status: 404 }) };
  }

  const { data: queueData, error: queueError } = await admin
    .from("submission_queue")
    .select("id, application_id")
    .eq("id", jobId)
    .maybeSingle();

  if (queueError) {
    return { ok: false, response: NextResponse.json({ error: queueError.message }, { status: 500 }) };
  }
  const queue = queueData as QueueRow | null;
  if (!queue) {
    return { ok: false, response: NextResponse.json({ error: "Submission job not found" }, { status: 404 }) };
  }

  const { data: applicationData, error: applicationError } = await admin
    .from("applications")
    .select("id, applicant_id")
    .eq("id", queue.application_id)
    .maybeSingle();

  if (applicationError) {
    return { ok: false, response: NextResponse.json({ error: applicationError.message }, { status: 500 }) };
  }
  const application = applicationData as ApplicationRow | null;
  if (!application) {
    return { ok: false, response: NextResponse.json({ error: "Application not found" }, { status: 404 }) };
  }
  if (application.applicant_id !== profile.id) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { ok: true, admin, queue };
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ jobId: string; actionId: string }> },
): Promise<Response> {
  const { jobId, actionId } = await context.params;
  if (!jobId || !actionId) {
    return NextResponse.json({ error: "Missing submission job or manual action id" }, { status: 400 });
  }

  const authorized = await authorizeSubmissionJob(jobId);
  if (!authorized.ok) return authorized.response;

  const { data: actionData, error: actionError } = await authorized.admin
    .from("vietnam_live_manual_actions")
    .select("id, job_id, application_id, action_type, status")
    .eq("id", actionId)
    .eq("job_id", jobId)
    .maybeSingle();

  if (actionError) {
    if (isMissingManualActionSchema(actionError)) {
      return NextResponse.json(
        {
          error:
            "Vietnam manual actions are not available because migration 0096_vietnam_live_assisted_controls.sql has not been applied.",
          code: "vietnam_manual_actions_schema_not_ready",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: actionError.message }, { status: 500 });
  }

  const action = actionData as ManualActionRow | null;
  if (!action || action.application_id !== authorized.queue.application_id) {
    return NextResponse.json({ error: "Manual action not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  if (action.status !== "completed") {
    const { error: updateActionError } = await authorized.admin
      .from("vietnam_live_manual_actions")
      .update({
        status: "completed",
        completed_at: now,
      })
      .eq("id", actionId)
      .eq("job_id", jobId);

    if (updateActionError) {
      return NextResponse.json({ error: updateActionError.message }, { status: 500 });
    }
  }

  const { error: queueError } = await authorized.admin
    .from("submission_queue")
    .update({
      status: "vn_live_assisted_pending",
      mode: "live_assisted",
      provider: "vietnam_evisa_live",
      manual_action_status: "completed",
      last_error: null,
      updated_at: now,
    })
    .eq("id", jobId);

  if (queueError) {
    return NextResponse.json({ error: queueError.message }, { status: 500 });
  }

  const { error: applicationError } = await authorized.admin
    .from("applications")
    .update({
      status: "submitted",
      submission_result_status: "waiting",
      submission_result: null,
      submission_result_updated_at: now,
      updated_at: now,
    })
    .eq("id", authorized.queue.application_id);

  if (applicationError) {
    return NextResponse.json({ error: applicationError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    jobId,
    actionId,
    actionType: action.action_type,
    status: "completed",
    queueStatus: "vn_live_assisted_pending",
  });
}
