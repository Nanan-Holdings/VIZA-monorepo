import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";

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
]);

const LIVE_PENDING_STATUSES = new Set([
  "pending",
  "queued",
  "vn_live_assisted_pending",
  "ds160_live_assisted_pending",
  "fv_prefill_pending",
  "france_live_assisted_pending",
]);

const LIVE_RUNNING_STATUSES = new Set([
  "running",
  "processing",
  "in_progress",
  "vn_live_running",
  "france_live_official_portal_opened",
  "ds160_live_running",
]);

const LIVE_ACTION_STATUSES = new Set([
  "blocked",
  "action_required",
  "manual_action_required",
  "vn_blocked",
  "ds160_blocked",
  "france_blocked",
]);

const LIVE_SUBMITTED_STATUSES = new Set([
  "submitted",
  "lodged",
  "filed",
  "vn_submitted",
  "ds160_submitted",
  "france_submitted",
]);

const LIVE_FAILED_STATUSES = new Set([
  "failed",
  "error",
  "cancelled",
  "canceled",
  "vn_failed",
  "ds160_failed",
  "france_failed",
]);

const LIVE_COMPLETED_STATUSES = new Set([
  "complete",
  "completed",
  "approved",
  "issued",
  "granted",
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

  if (error) {
    if (isSchemaMissingError(error)) return new Map();
    throw new Error(error.message);
  }

  const liveRows = ((data ?? []) as QueueRow[]).filter(isLiveQueue);
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
    const officialReference =
      row.vn_registration_code_encrypted ??
      row.official_application_reference_encrypted ??
      null;

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
      officialReference,
      liveSubmittedAt: row.live_submitted_at ?? null,
      updatedAt: row.updated_at,
      createdAt: row.created_at,
      pendingManualAction,
      manualActions,
    });
  }

  return summaries;
}
