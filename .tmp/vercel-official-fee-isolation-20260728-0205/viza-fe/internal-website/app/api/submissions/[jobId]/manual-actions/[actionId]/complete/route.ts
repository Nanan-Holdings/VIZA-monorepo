import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type QueueRow = {
  id: string;
  application_id: string;
  status: string | null;
  mode: string | null;
  provider: string | null;
};

type ApplicationRow = {
  id: string;
  applicant_id: string;
  country: string | null;
  visa_type: string | null;
};

type ManualActionTable = {
  tableName: string;
  queueColumn: "submission_queue_id" | "job_id";
};

type ManualActionRow = {
  id: string;
  submission_queue_id?: string | null;
  job_id?: string | null;
  application_id: string | null;
  action_type: string;
  status: string | null;
};

type CompleteManualActionBody = {
  answer?: unknown;
  confirmed?: unknown;
};

function isMissingManualActionSchema(error: { message?: string; code?: string }): boolean {
  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "PGRST204" ||
    message.includes("could not find the") ||
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    message.includes("submission_manual_actions") ||
    message.includes("ds160_live_manual_actions") ||
    message.includes("france_live_manual_actions") ||
    message.includes("vietnam_live_manual_actions")
  );
}

function normalizeCountry(country: string | null | undefined): string {
  return (country ?? "").trim().toLowerCase();
}

function normalizeVisaType(visaType: string | null | undefined): string {
  return (visaType ?? "").trim().toLowerCase();
}

function isDs160Job(queue: QueueRow, application: ApplicationRow): boolean {
  const country = normalizeCountry(application.country);
  const visaType = normalizeVisaType(application.visa_type);
  return (
    queue.provider === "ceac_live" ||
    queue.status?.startsWith("ds160_") === true ||
    visaType === "ds160" ||
    country === "united_states" ||
    country === "united states" ||
    country === "us" ||
    country === "美国"
  );
}

function isFranceJob(queue: QueueRow, application: ApplicationRow): boolean {
  const country = normalizeCountry(application.country);
  return (
    queue.provider === "france_visas_live" ||
    country === "france" ||
    country === "fr" ||
    country === "法国"
  );
}

function isVietnamJob(queue: QueueRow, application: ApplicationRow): boolean {
  const country = normalizeCountry(application.country);
  return (
    queue.provider === "vietnam_evisa_live" ||
    country === "vietnam" ||
    country === "vn" ||
    country === "viet_nam"
  );
}

function manualActionTables(queue: QueueRow, application: ApplicationRow): ManualActionTable[] {
  const tables: ManualActionTable[] = [
    { tableName: "submission_manual_actions", queueColumn: "submission_queue_id" },
  ];
  if (isFranceJob(queue, application)) {
    tables.push({ tableName: "france_live_manual_actions", queueColumn: "job_id" });
  }
  if (isVietnamJob(queue, application)) {
    tables.push({ tableName: "vietnam_live_manual_actions", queueColumn: "job_id" });
  }
  if (isDs160Job(queue, application)) {
    tables.push({ tableName: "ds160_live_manual_actions", queueColumn: "job_id" });
  }
  return tables;
}

function requeuePatch(queue: QueueRow, application: ApplicationRow, now: string): Record<string, unknown> {
  if (isDs160Job(queue, application)) {
    return {
      status: "ds160_live_assisted_pending",
      mode: "live_assisted",
      provider: "ceac_live",
      manual_action_status: "completed",
      live_checkpoint: null,
      last_error: null,
      error_message: null,
      updated_at: now,
    };
  }
  if (isFranceJob(queue, application)) {
    return {
      status: "fv_prefill_pending",
      mode: "live_assisted",
      provider: "france_visas_live",
      manual_action_status: "completed",
      live_checkpoint: null,
      last_error: null,
      error_message: null,
      updated_at: now,
    };
  }
  if (isVietnamJob(queue, application)) {
    return {
      status: "vn_cloud_live_pending",
      mode: "live_assisted",
      provider: "vietnam_evisa_live",
      manual_action_status: "completed",
      last_error: null,
      error_message: null,
      updated_at: now,
    };
  }
  return {
    status: "pending",
    manual_action_status: "completed",
    last_error: null,
    error_message: null,
    updated_at: now,
  };
}

async function readBody(request: Request): Promise<CompleteManualActionBody> {
  try {
    return (await request.json()) as CompleteManualActionBody;
  } catch {
    return {};
  }
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
    .select("id, application_id, status, mode, provider")
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

async function findManualAction(
  admin: ReturnType<typeof createAdminClient>,
  jobId: string,
  actionId: string,
  tables: ManualActionTable[],
): Promise<
  | { ok: true; table: ManualActionTable; action: ManualActionRow }
  | { ok: false; error: string; status: number; code?: string }
> {
  const missingTables: string[] = [];
  for (const table of tables) {
    const selectColumns =
      table.queueColumn === "submission_queue_id"
        ? "id, submission_queue_id, application_id, action_type, status"
        : "id, job_id, application_id, action_type, status";

    const { data, error } = await admin
      .from(table.tableName)
      .select(selectColumns)
      .eq("id", actionId)
      .eq(table.queueColumn, jobId)
      .maybeSingle();

    if (error) {
      if (isMissingManualActionSchema(error)) {
        missingTables.push(table.tableName);
        continue;
      }
      return { ok: false, error: error.message, status: 500 };
    }
    if (data) return { ok: true, table, action: data as ManualActionRow };
  }

  if (missingTables.length === tables.length) {
    return {
      ok: false,
      error: "Manual actions are not available because the live-assisted manual action schema has not been applied.",
      status: 503,
      code: "manual_actions_schema_not_ready",
    };
  }

  return { ok: false, error: "Manual action not found", status: 404 };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ jobId: string; actionId: string }> },
): Promise<Response> {
  const { jobId, actionId } = await context.params;
  if (!jobId || !actionId) {
    return NextResponse.json({ error: "Missing submission job or manual action id" }, { status: 400 });
  }

  const body = await readBody(request);
  const hasAnswer = typeof body.answer === "string" && body.answer.trim().length > 0;
  const confirmed = body.confirmed !== false;
  if (!confirmed && !hasAnswer) {
    return NextResponse.json(
      { error: "Manual action completion requires confirmed=true or a one-time answer." },
      { status: 400 },
    );
  }

  const authorized = await authorizeSubmissionJob(jobId);
  if (!authorized.ok) return authorized.response;

  const found = await findManualAction(
    authorized.admin,
    jobId,
    actionId,
    manualActionTables(authorized.queue, authorized.application),
  );
  if (!found.ok) {
    return NextResponse.json(
      { error: found.error, code: found.code },
      { status: found.status },
    );
  }

  const action = found.action;
  if (action.application_id !== authorized.queue.application_id) {
    return NextResponse.json({ error: "Manual action not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  if (action.status !== "completed") {
    const { error: updateActionError } = await authorized.admin
      .from(found.table.tableName)
      .update({
        status: "completed",
        completed_at: now,
      })
      .eq("id", actionId)
      .eq(found.table.queueColumn, jobId);

    if (updateActionError) {
      return NextResponse.json({ error: updateActionError.message }, { status: 500 });
    }
  }

  const queuePatch = requeuePatch(authorized.queue, authorized.application, now);
  const { error: queueError } = await authorized.admin
    .from("submission_queue")
    .update(queuePatch)
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
    queueStatus: queuePatch.status,
    answerWasReceivedForOneTimeUse: hasAnswer,
  });
}
