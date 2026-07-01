import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SubmissionApiStatus =
  | "scheduled"
  | "queued"
  | "running"
  | "needs_user_action"
  | "completed"
  | "failed"
  | "stalled";

type SubmissionApiStage =
  | "scheduled"
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
  error_code: string | null;
  error_message: string | null;
  current_stage: string | null;
  heartbeat_at: string | null;
  manual_action_status: string | null;
  official_status: string | null;
  official_portal_url?: string | null;
  vn_result_payload?: unknown | null;
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

function readPayloadString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isVietnamPaymentCheckpointQueue(queue: QueueRow | null): boolean {
  if (!queue) return false;
  const payload = isRecord(queue.vn_result_payload) ? queue.vn_result_payload : {};
  const checkpoint = readPayloadString(payload, "checkpoint") ?? queue.current_stage;
  const actionType = readPayloadString(payload, "actionType");
  return checkpoint === "payment_page_visible" || actionType === "payment_required";
}

function isIndonesiaPaymentCheckpointQueue(queue: QueueRow | null): boolean {
  if (!queue) return false;
  const payload = isRecord(queue.vn_result_payload) ? queue.vn_result_payload : {};
  const queueStatus = normalizeStatus(queue.status);
  const checkpoint = readPayloadString(payload, "checkpoint") ?? queue.current_stage;
  const actionType = readPayloadString(payload, "actionType");
  return (
    queueStatus.startsWith("id_c1_payment_") ||
    queueStatus.startsWith("id_b1_evoa_payment_") ||
    checkpoint === "payment_page_visible" ||
    actionType === "official_fee_payment_required"
  );
}

function normalizeVisaType(visaType: string | null | undefined): string {
  return (visaType ?? "").trim().toUpperCase().replace(/[\s/-]+/g, "_");
}

function isIndonesiaB1Evoa(visaType: string | null | undefined): boolean {
  return normalizeVisaType(visaType) === "ID_B1_EVOA";
}

function indonesiaProviderForQueue(queue: QueueRow | null, application: ApplicationForStatus): string {
  if (queue?.provider && queue.provider !== "vietnam_evisa_live") return queue.provider;
  if (isIndonesiaB1Evoa(application.visa_type)) return "indonesia_b1_evoa_live";
  return "indonesia_c1_live";
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

function extractFieldFallbacks(payload: unknown): unknown[] {
  if (!isRecord(payload)) return [];
  const direct = payload.fieldFallbacks;
  if (Array.isArray(direct)) return direct;
  const diagnostics = payload.diagnostics;
  if (isRecord(diagnostics) && Array.isArray(diagnostics.fieldFallbacks)) {
    return diagnostics.fieldFallbacks;
  }
  return [];
}

function synthesizeQueueResult(queue: QueueRow | null, application: ApplicationForStatus): unknown | null {
  const queueStatus = normalizeStatus(queue?.status);
  const isIndonesiaPayment = isIndonesiaPaymentCheckpointQueue(queue);
  if (
    !queue ||
    !(
      queueStatus === "vn_blocked" ||
      isVietnamPaymentCheckpointQueue(queue) ||
      isIndonesiaPayment
    )
  ) {
    return null;
  }
  const payload = isRecord(queue.vn_result_payload) ? queue.vn_result_payload : {};
  const actionType =
    typeof payload.actionType === "string" && payload.actionType.trim()
      ? payload.actionType.trim()
      : isVietnamPaymentCheckpointQueue(queue) || isIndonesiaPayment
        ? "payment_required"
        : "captcha_required";
  const instruction =
    typeof payload.instruction === "string" && payload.instruction.trim()
      ? payload.instruction.trim()
      : queue.error_message ??
        queue.last_error ??
        (actionType === "payment_required"
        ? "The official Vietnam e-Visa portal reached payment. Continue payment from the official payment page."
        : "Vietnam official portal needs action before VIZA can continue.");
    const checkpoint =
      typeof payload.checkpoint === "string" && payload.checkpoint.trim()
        ? payload.checkpoint.trim()
        : queue.current_stage ??
          (actionType === "payment_required" ? "payment_page_visible" : "captcha_submitted_blocked");
  const evidence = isRecord(payload.evidence) ? payload.evidence : undefined;
  const instructionText = isVietnamPaymentCheckpointQueue(queue)
    ? "The official Vietnam e-Visa portal reached payment. Continue payment from the official payment page."
    : isIndonesiaPayment
      ? checkpoint === "user_payment_required"
        ? "The official Indonesia payment window is open. Complete card payment and OTP verification in that visible official browser window."
        : "The official Indonesia e-Visa portal reached payment. Continue payment from the official payment page."
      : "The official portal needs action before VIZA can continue.";
  const resolvedPortalUrl = readPayloadString(payload, "url") ?? queue.official_portal_url;

    return {
      country: isIndonesiaPayment ? "ID" : "VN",
      status: actionType === "payment_required" || actionType === "official_fee_payment_required"
        ? "stopped_at_pay"
        : actionType,
      mode: "live_assisted",
      provider: isIndonesiaPayment
        ? indonesiaProviderForQueue(queue, application)
        : "vietnam_evisa_live",
      portalUrl:
        isIndonesiaPayment
          ? resolvedPortalUrl ?? "https://evisa.imigrasi.go.id"
          : resolvedPortalUrl ?? "https://evisa.gov.vn/e-visa/foreigners",
      checkpoint,
      manualAction: {
        type: actionType,
        status: "open",
        instructions: isIndonesiaPayment ? instructionText : instruction,
      },
      paymentStatus: actionType === "payment_required" || actionType === "official_fee_payment_required"
        ? "manual_required"
        : "not_required",
      applicationCountry: application.country,
      applicationVisaType: application.visa_type,
      evidence,
  };
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

function isAfterOrEqual(candidate: string | null, baseline: string | null): boolean {
  if (!candidate) return false;
  if (!baseline) return true;
  const candidateMs = Date.parse(candidate);
  const baselineMs = Date.parse(baseline);
  return Number.isFinite(candidateMs) && Number.isFinite(baselineMs) && candidateMs >= baselineMs;
}

function stageForActionStatus(status: string): SubmissionApiStage {
  if (status === "stopped_at_pay" || status === "needs_user_action" || status === "action_required") {
    return "payment_handoff";
  }
  return "confirming_result";
}

function messageForStage(stage: SubmissionApiStage): string {
  switch (stage) {
    case "scheduled":
      return "SG Arrival Card is scheduled for automatic submission when ICA accepts it.";
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

  if (appStatus === "stalled") {
    return {
      status: "stalled",
      stage: "confirming_result",
      progress: 99,
      message:
        resultError ??
        queueError ??
        "Submission job stalled because the worker did not pick it up in time.",
      error:
        resultError ??
        queueError ??
        "Submission job stalled because the worker did not pick it up in time.",
    };
  }

  if (appStatus === "scheduled") {
    return {
      status: "scheduled",
      stage: "scheduled",
      progress: 0,
      message:
        resultError ??
        queueError ??
        "SG Arrival Card is scheduled for automatic submission when ICA accepts it.",
      error: null,
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

  if (queueStatus === "sgac_live_assisted_scheduled") {
    return { status: "scheduled", stage: "scheduled", progress: 0 };
  }

  if (
    queueStatus === "failed" ||
    queueStatus.endsWith("_failed") ||
    queueStatus === "needs_manual_verification" ||
    queueStatus === "vn_blocked"
  ) {
    if (queueStatus === "vn_blocked") {
      return { status: "needs_user_action", stage: "payment_handoff", progress: 99 };
    }
    return { status: "failed", stage: "failed", progress: 0 };
  }

  if (queueStatus === "stalled") {
    return { status: "stalled", stage: "confirming_result", progress: 99 };
  }

  if (queueStatus.endsWith("_blocked")) {
    return { status: "needs_user_action", stage: "confirming_result", progress: 99 };
  }

  if (queueStatus === "action_required") {
    return { status: "needs_user_action", stage: "payment_handoff", progress: 99 };
  }

  if (queueStatus === "done") {
    return { status: "completed", stage: "completed", progress: 100 };
  }

  if (queueStatus.endsWith("_prefilled")) {
    return { status: "running", stage: "confirming_result", progress: 92 };
  }

  if (queueStatus === "vn_payment_pending") {
    return { status: "running", stage: "payment_handoff", progress: 82 };
  }

  if (queueStatus === "vn_payment_processing") {
    return { status: "running", stage: "payment_handoff", progress: 88 };
  }

  if (queueStatus === "vn_payment_paid") {
    return { status: "completed", stage: "completed", progress: 100 };
  }

  if (
    queueStatus === "id_c1_payment_pending" ||
    queueStatus === "id_c1_payment_processing" ||
    queueStatus === "id_b1_evoa_payment_pending" ||
    queueStatus === "id_b1_evoa_payment_processing"
  ) {
    return { status: "needs_user_action", stage: "payment_handoff", progress: 99 };
  }

  if (
    queueStatus === "id_c1_payment_paid" ||
    queueStatus === "id_b1_evoa_payment_paid"
  ) {
    return { status: "completed", stage: "completed", progress: 100 };
  }

  if (queueStatus === "processing" || queueStatus === "france_live_processing") {
    return { status: "running", stage: "mapping_answers", progress: 34 };
  }

  if (queueStatus === "france_live_official_portal_opened") {
    return { status: "running", stage: "filling_form", progress: 48 };
  }

  if (queueStatus.endsWith("_processing")) {
    return { status: "running", stage: "filling_form", progress: 72 };
  }

  if (
    queueStatus === "pending" ||
    queueStatus === "france_live_assisted_pending" ||
    queueStatus.endsWith("_pending")
  ) {
    if (
      queueStatus === "sgac_live_assisted_pending" ||
      queueStatus === "mdac_live_assisted_pending" ||
      queueStatus === "tdac_live_assisted_pending"
    ) {
      return { status: "queued", stage: "preparing", progress: 52 };
    }
    return { status: "queued", stage: "preparing", progress: 12 };
  }

  return { status: "running", stage: "confirming_result", progress: 92 };
}

function isActiveQueue(queue: QueueRow | null): boolean {
  if (!queue) return false;
  const queueStatus = normalizeStatus(queue.status);
  const provider = normalizeStatus(queue.provider);
  if (queueStatus.startsWith("ds160_proof_") || provider === "ceac_proof") return false;
  if (queueStatus === "done" || queueStatus.endsWith("_prefilled")) return false;
  const derived = deriveQueueStage(queueStatus);
  return derived.status === "scheduled" || derived.status === "queued" || derived.status === "running";
}

export function deriveNonTerminalStatus(
  application: ApplicationForStatus,
  queue: QueueRow | null,
): DerivedStatus {
  const queueStatus = normalizeStatus(queue?.status);
  const queueDerived = deriveQueueStage(queueStatus);
  const updatedAt = latestTimestamp(
    queue?.heartbeat_at,
    queue?.updated_at,
    application.submission_result_updated_at,
    application.updated_at,
  );
  const queueMessage =
    queue?.error_message?.trim() ||
    queue?.last_error?.trim() ||
    extractResultError(application.submission_result);
  const currentStage = normalizeStatus(queue?.current_stage);
  const error = queueMessage;

  if (isVietnamPaymentCheckpointQueue(queue)) {
    return {
      status: "needs_user_action",
      stage: "payment_handoff",
      progress: 99,
      message:
        queueMessage ??
        "The official Vietnam e-Visa portal reached payment. Continue payment from the official payment page.",
      error: queueMessage,
    };
  }

  if (isIndonesiaPaymentCheckpointQueue(queue)) {
    return {
      status: "needs_user_action",
      stage: "payment_handoff",
      progress: 99,
      message:
        queueMessage ??
        "The official Indonesia e-Visa portal reached payment. Continue payment from the official payment page.",
      error: queueMessage,
    };
  }

  if (queueDerived.status === "needs_user_action") {
    return {
      status: "needs_user_action",
      stage: "payment_handoff",
      progress: 99,
      message:
        queueMessage ??
        (currentStage
          ? `Official portal checkpoint: ${currentStage}.`
          : "The official portal needs a human action before VIZA can continue."),
      error: queueMessage,
    };
  }

  if (queueDerived.status === "scheduled") {
    return {
      status: "scheduled",
      stage: "scheduled",
      progress: 0,
      message:
        queueMessage ??
        "SG Arrival Card is scheduled for automatic submission when the ICA three-day window opens.",
      error: null,
    };
  }

  if (
    (queueDerived.status === "queued" || queueDerived.status === "running") &&
    isStale(updatedAt)
  ) {
    return {
      status: "stalled",
      stage: "confirming_result",
      progress: 99,
      message:
        queueStatus === "pending" || queueStatus.endsWith("_pending")
          ? "Submission job is still queued. The worker has not picked it up yet."
          : "Still confirming the submission result. The runner heartbeat has not changed recently.",
      error,
    };
  }

  return {
    status: queueDerived.status,
    stage: queueDerived.stage,
    progress: clampProgress(queueDerived.progress),
    message:
      error ??
      (currentStage ? `Current stage: ${currentStage}.` : messageForStage(queueDerived.stage)),
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
  const queueUpdatedAt = latestTimestamp(queue?.heartbeat_at, queue?.updated_at, queue?.created_at);
  const queueDerived = deriveQueueStage(normalizeStatus(queue?.status));
  const activeQueueOverridesTerminal =
    isActiveQueue(queue) && isAfterOrEqual(queueUpdatedAt, application.submission_result_updated_at);
  const terminalQueueOverridesApplication =
    !activeQueueOverridesTerminal &&
    queueDerived.status !== "queued" &&
    queueDerived.status !== "running" &&
    isAfterOrEqual(queueUpdatedAt, application.submission_result_updated_at);
  const queueResult = synthesizeQueueResult(queue, application);
  const queueOverridesApplication = activeQueueOverridesTerminal || terminalQueueOverridesApplication;
  const derived = queueOverridesApplication
    ? deriveNonTerminalStatus(application, queue)
    : deriveTerminalApplicationStatus(application, queue) ??
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
      result: queueResult ?? (activeQueueOverridesTerminal ? null : application.submission_result ?? null),
      error: derived.error,
      updatedAt,
      applicationStatus: queueResult
        ? "action_required"
        : queueOverridesApplication
        ? queue?.status === "sgac_live_assisted_scheduled"
          ? "scheduled"
          : queue?.status?.endsWith("_pending")
          ? "waiting"
          : terminalQueueOverridesApplication
            ? "action_required"
            : "processing"
        : application.submission_result_status ?? null,
      queue: queue
        ? {
            id: queue.id,
            status: queue.status,
            attempts: queue.attempts,
            mode: queue.mode,
            provider: queue.provider,
            lastError: queue.last_error,
            errorCode: queue.error_code,
            errorMessage: queue.error_message,
            currentStage: queue.current_stage,
            heartbeatAt: queue.heartbeat_at,
            manualActionStatus: queue.manual_action_status,
            officialStatus: queue.official_status,
            fieldFallbacks: extractFieldFallbacks(queue.vn_result_payload),
            createdAt: queue.created_at,
            updatedAt: queue.updated_at,
          }
        : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
