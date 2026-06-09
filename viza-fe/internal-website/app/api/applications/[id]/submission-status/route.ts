import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SubmissionApiStatus =
  | "queued"
  | "running"
  | "needs_user_action"
  | "completed"
  | "failed"
  | "stalled";

type SubmissionApiStage =
  | "preparing"
  | "mapping_answers"
  | "filling_form"
  | "submitting_form"
  | "confirming_result"
  | "payment_handoff"
  | "completed"
  | "failed";

type ApplicationForStatus = {
  id: string;
  applicant_id: string;
  country: string | null;
  visa_type: string | null;
  submitted_at: string | null;
  submission_result: unknown | null;
  submission_result_status: string | null;
  submission_result_updated_at: string | null;
  updated_at: string | null;
};

type QueueRow = {
  [key: string]: unknown;
  id: string;
  status: string;
  attempts: number | null;
  mode: string | null;
  provider: string | null;
  last_error: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type DerivedStatus = {
  status: SubmissionApiStatus;
  stage: SubmissionApiStage;
  progress: number;
  message: string;
  error: string | null;
};

const STALE_AFTER_MS = 3 * 60 * 1000;

const COMPLETED_APPLICATION_STATUSES = new Set([
  "completed",
  "submitted",
  "submitted_mock",
  "form_ready_for_agency",
]);

const ACTION_REQUIRED_APPLICATION_STATUSES = new Set([
  "needs_user_action",
  "action_required",
  "stopped_at_sign",
  "stopped_at_pay",
  "stopped_at_review",
  "unsupported",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeStatus(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function extractResultError(result: unknown): string | null {
  if (!isRecord(result)) return null;
  const error = result.error;
  if (typeof error === "string" && error.trim()) return error.trim();
  if (isRecord(error) && typeof error.message === "string" && error.message.trim()) {
    return error.message.trim();
  }
  return null;
}

function latestTimestamp(...values: Array<string | null | undefined>): string | null {
  let latest: string | null = null;
  let latestMs = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (!value) continue;
    const ms = Date.parse(value);
    if (!Number.isFinite(ms) || ms <= latestMs) continue;
    latest = value;
    latestMs = ms;
  }
  return latest;
}

function isStale(updatedAt: string | null): boolean {
  if (!updatedAt) return false;
  const ms = Date.parse(updatedAt);
  return Number.isFinite(ms) && Date.now() - ms > STALE_AFTER_MS;
}

function stageForActionStatus(status: string): SubmissionApiStage {
  if (status === "stopped_at_pay" || status === "needs_user_action" || status === "action_required") {
    return "payment_handoff";
  }
  return "confirming_result";
}

function messageForStage(stage: SubmissionApiStage): string {
  switch (stage) {
    case "preparing":
      return "Submission job is queued and waiting for the runner.";
    case "mapping_answers":
      return "Preparing and mapping application answers for the official portal.";
    case "filling_form":
      return "The runner is filling the official portal form.";
    case "submitting_form":
      return "The runner is advancing through the safe submit/review checkpoint.";
    case "confirming_result":
      return "Still confirming the submission result.";
    case "payment_handoff":
      return "The official portal needs a human action before VIZA can continue.";
    case "completed":
      return "Submission completed.";
    case "failed":
      return "Submission failed.";
  }
}

function deriveTerminalApplicationStatus(
  application: ApplicationForStatus,
  queue: QueueRow | null,
): DerivedStatus | null {
  const appStatus = normalizeStatus(application.submission_result_status);
  const resultError = extractResultError(application.submission_result);
  const queueError = queue?.last_error?.trim() || null;

  if (appStatus === "failed") {
    return {
      status: "failed",
      stage: "failed",
      progress: 0,
      message: resultError ?? queueError ?? "Submission failed.",
      error: resultError ?? queueError ?? "Submission failed.",
    };
  }

  if (COMPLETED_APPLICATION_STATUSES.has(appStatus)) {
    return {
      status: "completed",
      stage: "completed",
      progress: 100,
      message: "Submission completed.",
      error: null,
    };
  }

  if (ACTION_REQUIRED_APPLICATION_STATUSES.has(appStatus)) {
    const stage = stageForActionStatus(appStatus);
    return {
      status: "needs_user_action",
      stage,
      progress: 99,
      message: resultError ?? queueError ?? messageForStage(stage),
      error: resultError ?? queueError,
    };
  }

  return null;
}

function deriveQueueStage(queueStatus: string): Pick<DerivedStatus, "status" | "stage" | "progress"> {
  if (!queueStatus || queueStatus === "retry_superseded") {
    return { status: "queued", stage: "preparing", progress: 0 };
  }

  if (
    queueStatus === "failed" ||
    queueStatus.endsWith("_failed") ||
    queueStatus === "vn_blocked"
  ) {
    return { status: "failed", stage: "failed", progress: 0 };
  }

  if (queueStatus.endsWith("_blocked")) {
    return { status: "needs_user_action", stage: "confirming_result", progress: 99 };
  }

  if (queueStatus === "done" || queueStatus.endsWith("_prefilled")) {
    return { status: "running", stage: "confirming_result", progress: 92 };
  }

  if (queueStatus === "processing") {
    return { status: "running", stage: "mapping_answers", progress: 34 };
  }

  if (queueStatus.endsWith("_processing")) {
    return { status: "running", stage: "filling_form", progress: 72 };
  }

  if (queueStatus === "pending" || queueStatus.endsWith("_pending")) {
    return { status: "queued", stage: "preparing", progress: 12 };
  }

  return { status: "running", stage: "confirming_result", progress: 92 };
}

function deriveNonTerminalStatus(
  application: ApplicationForStatus,
  queue: QueueRow | null,
): DerivedStatus {
  const queueStatus = normalizeStatus(queue?.status);
  const queueDerived = deriveQueueStage(queueStatus);
  const updatedAt = latestTimestamp(
    queue?.updated_at,
    application.submission_result_updated_at,
    application.updated_at,
  );
  const error = queue?.last_error?.trim() || extractResultError(application.submission_result);

  if (
    (queueDerived.status === "queued" || queueDerived.status === "running") &&
    isStale(updatedAt)
  ) {
    return {
      status: "stalled",
      stage: "confirming_result",
      progress: 99,
      message: "Still confirming the submission result. The runner heartbeat has not changed recently.",
      error,
    };
  }

  return {
    status: queueDerived.status,
    stage: queueDerived.stage,
    progress: clampProgress(queueDerived.progress),
    message: error ?? messageForStage(queueDerived.stage),
    error: queueDerived.status === "failed" ? error ?? "Submission failed." : error,
  };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: applicationId } = await context.params;
  if (!applicationId) {
    return NextResponse.json({ error: "Missing application id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("applicant_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }
  if (!profile) {
    return NextResponse.json({ error: "Applicant profile not found" }, { status: 404 });
  }

  const { data: applicationData, error: applicationError } = await admin
    .from("applications")
    .select(
      "id, applicant_id, country, visa_type, submitted_at, submission_result, submission_result_status, submission_result_updated_at, updated_at",
    )
    .eq("id", applicationId)
    .maybeSingle();

  if (applicationError) {
    return NextResponse.json({ error: applicationError.message }, { status: 500 });
  }

  const application = applicationData as ApplicationForStatus | null;
  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  if (application.applicant_id !== profile.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: queueData, error: queueError } = await admin
    .from("submission_queue")
    .select("*")
    .eq("application_id", applicationId)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (queueError) {
    return NextResponse.json({ error: queueError.message }, { status: 500 });
  }

  const queue = (queueData ?? null) as QueueRow | null;
  const derived =
    deriveTerminalApplicationStatus(application, queue) ??
    deriveNonTerminalStatus(application, queue);
  const updatedAt = latestTimestamp(
    application.submission_result_updated_at,
    queue?.updated_at,
    application.updated_at,
  );

  return NextResponse.json(
    {
      ok: true,
      applicationId,
      jobId: queue?.id ?? null,
      country: application.country,
      visaType: application.visa_type,
      status: derived.status,
      stage: derived.stage,
      progress: derived.progress,
      message: derived.message,
      result: application.submission_result ?? null,
      error: derived.error,
      updatedAt,
      applicationStatus: application.submission_result_status ?? null,
      queue: queue
        ? {
            id: queue.id,
            status: queue.status,
            attempts: queue.attempts,
            mode: queue.mode,
            provider: queue.provider,
            lastError: queue.last_error,
            createdAt: queue.created_at,
            updatedAt: queue.updated_at,
          }
        : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
