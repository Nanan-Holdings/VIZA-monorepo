import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type QueueRow = {
  id: string;
  application_id: string;
  mode: string | null;
  provider: string | null;
};

type ApplicationRow = {
  id: string;
  applicant_id: string;
  country: string | null;
  visa_type: string | null;
};

type ManualActionRow = {
  id: string;
  job_id: string | null;
  application_id: string;
  action_type: string;
  status: string;
  instruction: string | null;
  screenshot_url: string | null;
  redacted_metadata_json: Record<string, unknown> | null;
  created_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
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
      application: ApplicationRow;
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
    .select("id, application_id, mode, provider")
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
    .select("id, applicant_id, country, visa_type")
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

  return { ok: true, admin, queue, application };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
): Promise<Response> {
  const { jobId } = await context.params;
  if (!jobId) {
    return NextResponse.json({ error: "Missing submission job id" }, { status: 400 });
  }

  const authorized = await authorizeSubmissionJob(jobId);
  if (!authorized.ok) return authorized.response;

  const { data, error } = await authorized.admin
    .from("vietnam_live_manual_actions")
    .select(
      "id, job_id, application_id, action_type, status, instruction, screenshot_url, redacted_metadata_json, created_at, completed_at, expires_at",
    )
    .eq("job_id", jobId)
    .order("created_at", { ascending: false, nullsFirst: false });

  if (error) {
    if (isMissingManualActionSchema(error)) {
      return NextResponse.json(
        {
          error:
            "Vietnam manual actions are not available because migration 0096_vietnam_live_assisted_controls.sql has not been applied.",
          code: "vietnam_manual_actions_schema_not_ready",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const manualActions = ((data ?? []) as ManualActionRow[]).map((action) => ({
    id: action.id,
    jobId: action.job_id,
    applicationId: action.application_id,
    actionType: action.action_type,
    status: action.status,
    instruction: action.instruction,
    screenshotUrl: action.screenshot_url,
    metadata: action.redacted_metadata_json ?? {},
    createdAt: action.created_at,
    completedAt: action.completed_at,
    expiresAt: action.expires_at,
  }));

  return NextResponse.json({
    ok: true,
    jobId,
    applicationId: authorized.queue.application_id,
    country: authorized.application.country,
    visaType: authorized.application.visa_type,
    manualActions,
  });
}
