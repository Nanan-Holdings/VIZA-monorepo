import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";
import {
  STATUS_VISIBLE_RUNNER_FLOWS,
  presentRunnerJobStatus,
  statusVisibleRunnerFlowForApplication,
  type StatusVisibleRunnerFlow,
} from "@/lib/status/runner-job-visibility";

export type LiveSubmissionState =
  | "pending"
  | "running"
  | "action_required"
  | "submitted"
  | "failed"
  | "completed";

export type LiveManualActionSummary = {
  id: string;
  jobId: string;
  applicationId: string | null;
  actionType: string;
  status: string;
  instruction: string | null;
  screenshotUrl: string | null;
  createdAt: string | null;
  completedAt: string | null;
  expiresAt: string | null;
  sourceTable: string;
};

export type LiveSubmissionSummary = {
  jobId: string;
  applicationId: string;
  status: string | null;
  state: LiveSubmissionState;
  mode: string | null;
  provider: string | null;
  currentStage: string | null;
  liveCheckpoint: string | null;
  manualActionStatus: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  officialPortalUrl: string | null;
  officialStatus: string | null;
  paymentStatus: string | null;
  officialReference: string | null;
  liveSubmittedAt: string | null;
  updatedAt: string | null;
  createdAt: string | null;
  pendingManualAction: LiveManualActionSummary | null;
  manualActions: LiveManualActionSummary[];
};

type AdminClient = ReturnType<typeof createAdminClient>;

type QueueRow = {
  id: string;
  application_id: string;
  status: string | null;
  mode: string | null;
  provider: string | null;
  current_stage?: string | null;
  live_checkpoint?: string | null;
  manual_action_status?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  official_portal_url?: string | null;
  official_status?: string | null;
  payment_status?: string | null;
  official_application_reference_encrypted?: string | null;
  vn_registration_code_encrypted?: string | null;
  live_submitted_at?: string | null;
  updated_at: string | null;
  created_at: string | null;
};

type RunnerJobRow = {
  id: string;
  application_id: string;
  country: string;
  status: string;
  last_error: string | null;
  enqueued_at: string | null;
  started_at: string | null;
  finished_at: string | null;
};

type ApplicationProductRow = {
  id: string;
  country: string | null;
  visa_type: string | null;
};

type ManualActionRow = {
  id: string;
  submission_queue_id?: string | null;
  job_id?: string | null;
  application_id: string | null;
  action_type: string;
  status: string | null;
  instruction: string | null;
  screenshot_url: string | null;
  created_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
};

type QueryErrorLike = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

const LIVE_PROVIDERS = new Set([
  "vietnam_evisa_live",
  "france_visas_live",
  "ceac_live",
  "malaysia_mdac_live",
  "thailand_tdac_live",
  "philippines_etravel_live",
  "korea_e_arrival_card_live",
]);

const LIVE_PENDING_STATUSES = new Set([
  "pending",
  "queued",
  "vn_cloud_live_pending",
  "vn_live_assisted_pending",
  "ds160_live_assisted_pending",
  "fv_prefill_pending",
  "france_live_assisted_pending",
  "mdac_live_assisted_pending",
  "tdac_live_assisted_pending",
  "phetravel_live_assisted_pending",
  "kr_eac_live_assisted_pending",
  "kr_eac_live_assisted_scheduled",
]);

const LIVE_RUNNING_STATUSES = new Set([
  "running",
  "processing",
  "in_progress",
  "vn_live_running",
  "france_live_official_portal_opened",
  "ds160_live_running",
  "mdac_live_assisted_processing",
  "tdac_live_assisted_processing",
  "phetravel_live_assisted_processing",
  "kr_eac_live_assisted_processing",
]);

const LIVE_ACTION_STATUSES = new Set([
  "blocked",
  "action_required",
  "manual_action_required",
  "needs_human",
  "vn_blocked",
  "ds160_blocked",
  "france_blocked",
  "mdac_live_assisted_blocked",
  "tdac_live_assisted_blocked",
  "phetravel_live_assisted_blocked",
  "kr_eac_blocked",
]);

const LIVE_SUBMITTED_STATUSES = new Set([
  "submitted",
  "lodged",
  "filed",
  "vn_submitted",
  "ds160_submitted",
  "france_submitted",
  "mdac_live_assisted_submitted",
  "tdac_live_assisted_submitted",
  "phetravel_live_assisted_submitted",
  "kr_eac_live_assisted_submitted",
]);

const LIVE_FAILED_STATUSES = new Set([
  "failed",
  "error",
  "cancelled",
  "canceled",
  "vn_failed",
  "ds160_failed",
  "france_failed",
  "mdac_live_assisted_failed",
  "tdac_live_assisted_failed",
  "mdac_live_assisted_cancelled",
  "tdac_live_assisted_cancelled",
  "phetravel_live_assisted_failed",
  "phetravel_live_assisted_cancelled",
  "kr_eac_live_assisted_failed",
  "kr_eac_live_assisted_cancelled",
]);

const LIVE_COMPLETED_STATUSES = new Set([
  "done",
  "complete",
  "completed",
  "approved",
  "issued",
  "granted",
  "mdac_live_assisted_completed",
  "tdac_live_assisted_completed",
  "phetravel_live_assisted_completed",
  "kr_eac_live_assisted_completed",
]);

function normalizeStatus(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function isSchemaMissingError(error: QueryErrorLike | null | undefined): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  const message = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();
  return (
    code === "PGRST204" ||
    code === "PGRST205" ||
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    message.includes("could not find the")
  );
}

function isLiveQueue(row: QueueRow): boolean {
  return row.mode === "live_assisted" || (row.provider ? LIVE_PROVIDERS.has(row.provider) : false);
}

function compareByNewest(a: { updated_at?: string | null; created_at?: string | null }, b: { updated_at?: string | null; created_at?: string | null }): number {
  const aTime = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
  const bTime = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
  return bTime - aTime;
}

function compareManualNewest(a: LiveManualActionSummary, b: LiveManualActionSummary): number {
  const aTime = new Date(a.createdAt ?? 0).getTime();
  const bTime = new Date(b.createdAt ?? 0).getTime();
  return bTime - aTime;
}

function deriveState(row: QueueRow, pendingManualAction: LiveManualActionSummary | null): LiveSubmissionState {
  const status = normalizeStatus(row.status);
  const manual = normalizeStatus(row.manual_action_status);
  const official = normalizeStatus(row.official_status);

  if (pendingManualAction || manual === "pending" || LIVE_ACTION_STATUSES.has(status)) return "action_required";
  if (LIVE_FAILED_STATUSES.has(status)) return "failed";
  if (LIVE_COMPLETED_STATUSES.has(status) || LIVE_COMPLETED_STATUSES.has(official)) return "completed";
  if (LIVE_SUBMITTED_STATUSES.has(status) || row.live_submitted_at) return "submitted";
  if (LIVE_RUNNING_STATUSES.has(status) || row.current_stage || row.live_checkpoint) return "running";
  if (LIVE_PENDING_STATUSES.has(status)) return "pending";
  return row.mode === "live_assisted" ? "running" : "pending";
}

function normalizeAction(row: ManualActionRow, sourceTable: string): LiveManualActionSummary {
  return {
    id: row.id,
    jobId: row.submission_queue_id ?? row.job_id ?? "",
    applicationId: row.application_id,
    actionType: row.action_type,
    status: row.status ?? "pending",
    instruction: row.instruction,
    screenshotUrl: row.screenshot_url,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    expiresAt: row.expires_at,
    sourceTable,
  };
}

export function runnerJobToLiveSubmissionSummary(
  row: RunnerJobRow,
  flow: StatusVisibleRunnerFlow,
): LiveSubmissionSummary {
  // This loader does not read persisted application results, so tourist
  // `succeeded` rows deliberately stay at the safe-checkpoint state. The
  // application status route can promote them only with independent proof.
  const presentation = presentRunnerJobStatus(row.status, flow);
  const runnerUpdatedAt = row.finished_at ?? row.started_at ?? row.enqueued_at;
  const normalizedRunnerStatus = normalizeStatus(row.status);
  return {
    jobId: row.id,
    applicationId: row.application_id,
    status: flow.singaporeArrivalCard ? row.status : presentation.queueStatus,
    state: presentation.state,
    mode: "live_assisted",
    provider: presentation.provider,
    currentStage: flow.singaporeArrivalCard
      ? normalizedRunnerStatus === "running"
        ? "official_portal_submission"
        : normalizedRunnerStatus === "queued"
          ? "waiting_for_singapore_runner"
          : null
      : presentation.currentStage,
    liveCheckpoint: null,
    manualActionStatus: flow.singaporeArrivalCard
      ? null
      : presentation.manualActionStatus,
    errorCode: null,
    errorMessage: row.last_error,
    officialPortalUrl: null,
    officialStatus: presentation.officialStatus,
    paymentStatus: null,
    officialReference: null,
    liveSubmittedAt: flow.singaporeArrivalCard ? row.finished_at : null,
    updatedAt: runnerUpdatedAt,
    createdAt: row.enqueued_at,
    pendingManualAction: null,
    manualActions: [],
  };
}

async function loadActionsForTable({
  adminClient,
  tableName,
  queueColumn,
  jobIds,
}: {
  adminClient: AdminClient;
  tableName: string;
  queueColumn: "submission_queue_id" | "job_id";
  jobIds: string[];
}): Promise<LiveManualActionSummary[]> {
  if (jobIds.length === 0) return [];
  const selectColumns =
    queueColumn === "submission_queue_id"
      ? "id, submission_queue_id, application_id, action_type, status, instruction, screenshot_url, created_at, completed_at, expires_at"
      : "id, job_id, application_id, action_type, status, instruction, screenshot_url, created_at, completed_at, expires_at";

  const { data, error } = await adminClient
    .from(tableName)
    .select(selectColumns)
    .in(queueColumn, jobIds)
    .order("created_at", { ascending: false, nullsFirst: false });

  if (error) {
    if (isSchemaMissingError(error)) return [];
    throw new Error(error.message);
  }

  return ((data ?? []) as ManualActionRow[]).map((row) => normalizeAction(row, tableName));
}

export async function loadLiveSubmissionSummaries(
  adminClient: AdminClient,
  applicationIds: string[],
): Promise<Map<string, LiveSubmissionSummary>> {
  if (applicationIds.length === 0) return new Map();

  const { data, error } = await adminClient
    .from("submission_queue")
    .select(
      "id, application_id, status, mode, provider, current_stage, live_checkpoint, manual_action_status, error_code, error_message, official_portal_url, official_status, payment_status, official_application_reference_encrypted, vn_registration_code_encrypted, live_submitted_at, updated_at, created_at",
    )
    .in("application_id", applicationIds)
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(500);

  if (error && !isSchemaMissingError(error)) {
    throw new Error(error.message);
  }

  const { data: applicationData, error: applicationError } = await adminClient
    .from("applications")
    .select("id, country, visa_type")
    .in("id", applicationIds);
  if (applicationError) throw new Error(applicationError.message);

  const runnerFlowByApplication = new Map<string, StatusVisibleRunnerFlow>();
  for (const application of (applicationData ?? []) as ApplicationProductRow[]) {
    const flow = statusVisibleRunnerFlowForApplication(
      application.country,
      application.visa_type,
    );
    if (flow) runnerFlowByApplication.set(application.id, flow);
  }
  const eligibleRunnerApplicationIds = [...runnerFlowByApplication.keys()];
  const runnerResult = eligibleRunnerApplicationIds.length > 0
    ? await adminClient
        .from("runner_job")
        .select(
          "id, application_id, country, status, last_error, enqueued_at, started_at, finished_at",
        )
        .in("application_id", eligibleRunnerApplicationIds)
        .in(
          "country",
          STATUS_VISIBLE_RUNNER_FLOWS.map((flow) => flow.country),
        )
        .order("enqueued_at", { ascending: false, nullsFirst: false })
        .limit(500)
    : { data: [], error: null };
  const { data: runnerData, error: runnerError } = runnerResult;
  if (runnerError && !isSchemaMissingError(runnerError)) {
    throw new Error(runnerError.message);
  }

  const liveRows = (error ? [] : ((data ?? []) as QueueRow[])).filter(isLiveQueue);
  const jobIds = liveRows.map((row) => row.id);
  const actionGroups = new Map<string, LiveManualActionSummary[]>();

  const actions = (
    await Promise.all([
      loadActionsForTable({
        adminClient,
        tableName: "submission_manual_actions",
        queueColumn: "submission_queue_id",
        jobIds,
      }),
      loadActionsForTable({
        adminClient,
        tableName: "vietnam_live_manual_actions",
        queueColumn: "job_id",
        jobIds,
      }),
      loadActionsForTable({
        adminClient,
        tableName: "france_live_manual_actions",
        queueColumn: "job_id",
        jobIds,
      }),
      loadActionsForTable({
        adminClient,
        tableName: "ds160_live_manual_actions",
        queueColumn: "job_id",
        jobIds,
      }),
    ])
  ).flat();

  for (const action of actions) {
    if (!action.jobId) continue;
    const group = actionGroups.get(action.jobId) ?? [];
    group.push(action);
    actionGroups.set(action.jobId, group);
  }

  const latestByApplication = new Map<string, QueueRow>();
  for (const row of [...liveRows].sort(compareByNewest)) {
    if (!latestByApplication.has(row.application_id)) {
      latestByApplication.set(row.application_id, row);
    }
  }

  const summaries = new Map<string, LiveSubmissionSummary>();
  for (const [applicationId, row] of latestByApplication.entries()) {
    const manualActions = [...(actionGroups.get(row.id) ?? [])].sort(compareManualNewest);
    const pendingManualAction =
      manualActions.find((action) => normalizeStatus(action.status) !== "completed") ?? null;
    summaries.set(applicationId, {
      jobId: row.id,
      applicationId,
      status: row.status,
      state: deriveState(row, pendingManualAction),
      mode: row.mode,
      provider: row.provider,
      currentStage: row.current_stage ?? null,
      liveCheckpoint: row.live_checkpoint ?? null,
      manualActionStatus: row.manual_action_status ?? null,
      errorCode: row.error_code ?? null,
      errorMessage: row.error_message ?? null,
      officialPortalUrl: row.official_portal_url ?? null,
      officialStatus: row.official_status ?? null,
      paymentStatus: row.payment_status ?? null,
      officialReference: null,
      liveSubmittedAt: row.live_submitted_at ?? null,
      updatedAt: row.updated_at,
      createdAt: row.created_at,
      pendingManualAction,
      manualActions,
    });
  }

  const latestRunnerByApplication = new Map<string, RunnerJobRow>();
  const visibleRunnerRows = ((runnerData ?? []) as RunnerJobRow[]).filter((row) => {
    const flow = runnerFlowByApplication.get(row.application_id);
    return flow?.country === row.country;
  });
  for (const row of [...visibleRunnerRows].sort((a, b) =>
    compareByNewest(
      { updated_at: a.finished_at ?? a.started_at, created_at: a.enqueued_at },
      { updated_at: b.finished_at ?? b.started_at, created_at: b.enqueued_at },
    ),
  )) {
    if (!latestRunnerByApplication.has(row.application_id)) {
      latestRunnerByApplication.set(row.application_id, row);
    }
  }

  for (const [applicationId, row] of latestRunnerByApplication.entries()) {
    const runnerUpdatedAt = row.finished_at ?? row.started_at ?? row.enqueued_at;
    const existing = summaries.get(applicationId);
    const existingMs = Date.parse(existing?.updatedAt ?? existing?.createdAt ?? "");
    const runnerMs = Date.parse(runnerUpdatedAt ?? "");
    if (existing && Number.isFinite(existingMs) && (!Number.isFinite(runnerMs) || existingMs > runnerMs)) {
      continue;
    }
    const flow = runnerFlowByApplication.get(applicationId);
    if (!flow) continue;
    summaries.set(applicationId, runnerJobToLiveSubmissionSummary(row, flow));
  }

  return summaries;
}
