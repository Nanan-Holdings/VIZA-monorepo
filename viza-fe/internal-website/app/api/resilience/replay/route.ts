import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { ensureFlyMachineCapacity } from "@/lib/fly-machine-wake.server";
import {
  APPLICATION_ANSWERS_EVENT,
  type ApplicationAnswersEvent,
} from "@/lib/resilience/application-answers";
import { decryptResilienceValue, verifyReplaySignature } from "@/lib/resilience/gateway";
import {
  RUNNER_JOB_WAKE_EVENT,
  type RunnerJobWakeEvent,
  type RunnerWakeTarget,
} from "@/lib/resilience/runner-job-wakeup";
import { desiredRunnerPoolCapacity } from "@/lib/queue/enqueue";
import { wakeCloudSubmissionWorker } from "@/lib/submission-worker-wake.server";
import {
  isRunnerCutoverPaused,
  RUNNER_CUTOVER_PAUSED_CODE,
} from "@/lib/runner-cutover-pause.server";

export const runtime = "nodejs";

type ReplayItem = {
  idempotencyKey?: unknown;
  eventType?: unknown;
  blob?: unknown;
  attempts?: unknown;
  leaseId?: unknown;
};

type ReplayRequest = { items?: unknown };
type ReplayResult = {
  idempotencyKey: string;
  leaseId?: string;
  outcome: "ack" | "nack";
  errorCode?: string;
  retryAfterSeconds?: number;
};

type ReplayRpcClient = {
  rpc(
    name: "replay_resilient_application_answers",
    params: {
      p_application_id: string;
      p_applicant_id: string;
      p_saved_at: string;
      p_answers: Record<string, string>;
    },
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

type ReplayQuery = {
  select(columns: string): ReplayQuery;
  eq(column: string, value: string): ReplayQuery;
  maybeSingle(): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

type ReplayDbClient = {
  from(table: "runner_job" | "submission_queue"): ReplayQuery;
};

type RunnerWakeRecord = {
  id: string;
  status: string;
  availableAt: string | null;
};

class ReplayTransientError extends Error {
  readonly code:
    | "database_unavailable"
    | "fly_capacity_unavailable"
    | typeof RUNNER_CUTOVER_PAUSED_CODE
    | "worker_wake_unavailable";

  constructor(
    code:
      | "database_unavailable"
      | "fly_capacity_unavailable"
      | typeof RUNNER_CUTOVER_PAUSED_CODE
      | "worker_wake_unavailable",
  ) {
    super(code);
    this.name = "ReplayTransientError";
    this.code = code;
  }
}

const RUNNER_WAKE_TARGETS: readonly RunnerWakeTarget[] = [
  "pool",
  "legacy",
  "indonesia",
  "south_korea",
];
const RUNNER_WAKE_EVENT_KEYS = new Set(["version", "jobId", "target"]);
const RUNNER_TERMINAL_STATUSES = new Set([
  "succeeded",
  "failed",
  "dead_letter",
  "paused",
  "cancelled",
]);
const SUBMISSION_TERMINAL_STATUSES = new Set([
  "done",
  "failed",
  "retry_superseded",
  "cancelled",
]);

function isSafeRunnerJobId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(value)
  );
}

function isRunnerJobWakeEvent(value: unknown): value is RunnerJobWakeEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const event = value as Partial<RunnerJobWakeEvent>;
  const keys = Object.keys(value);
  return (
    keys.every((key) => RUNNER_WAKE_EVENT_KEYS.has(key)) &&
    keys.length === RUNNER_WAKE_EVENT_KEYS.size &&
    event.version === 1 &&
    isSafeRunnerJobId(event.jobId) &&
    typeof event.target === "string" &&
    RUNNER_WAKE_TARGETS.includes(event.target as RunnerWakeTarget)
  );
}

function isRunnerWakeRunning(status: string): boolean {
  return status === "running";
}

function isSubmissionWakeRunning(status: string): boolean {
  return status === "processing" || status.endsWith("_processing");
}

function isSubmissionWakeQueued(status: string): boolean {
  return status === "pending" || status.endsWith("_pending");
}

function retryAfterSecondsForAvailableAt(availableAt: string | null): number | null {
  if (!availableAt) return null;
  const dueAt = Date.parse(availableAt);
  if (!Number.isFinite(dueAt)) return null;
  const remainingSeconds = Math.ceil((dueAt - Date.now()) / 1_000);
  if (remainingSeconds <= 0) return null;
  return Math.max(1, Math.min(300, remainingSeconds));
}

async function loadRunnerWakeRecord(
  event: RunnerJobWakeEvent,
): Promise<RunnerWakeRecord | null> {
  const admin = createAdminClient({
    requestTimeoutMs: 6_000,
    retryDelaysMs: [],
  }) as unknown as ReplayDbClient;
  const table = event.target === "pool" ? "runner_job" : "submission_queue";
  const columns = table === "runner_job" ? "id,status,available_at" : "id,status";
  const { data, error } = await admin
    .from(table)
    .select(columns)
    .eq("id", event.jobId)
    .maybeSingle();
  if (error) throw new ReplayTransientError("database_unavailable");
  if (!data || typeof data !== "object") return null;
  if (table === "runner_job") {
    const row = data as { id?: unknown; status?: unknown; available_at?: unknown };
    if (typeof row.id !== "string" || typeof row.status !== "string") return null;
    return {
      id: row.id,
      status: row.status,
      availableAt: typeof row.available_at === "string" ? row.available_at : null,
    };
  }
  const row = data as { id?: unknown; status?: unknown };
  if (typeof row.id !== "string" || typeof row.status !== "string") return null;
  return {
    id: row.id,
    status: row.status,
    availableAt: null,
  };
}

type RunnerWakeReplayResult = {
  outcome: "ack" | "nack";
  errorCode?: "job_not_found" | "job_not_due" | "runner_pool_not_ready";
  retryAfterSeconds?: number;
};

async function replayRunnerJobWake(event: RunnerJobWakeEvent): Promise<RunnerWakeReplayResult> {
  if (isRunnerCutoverPaused()) {
    throw new ReplayTransientError(RUNNER_CUTOVER_PAUSED_CODE);
  }
  const record = await loadRunnerWakeRecord(event);
  if (!record) return { outcome: "ack", errorCode: "job_not_found" };

  const normalizedStatus = record.status.trim().toLowerCase();
  if (event.target === "pool") {
    if (RUNNER_TERMINAL_STATUSES.has(normalizedStatus) || isRunnerWakeRunning(normalizedStatus)) {
      return { outcome: "ack" };
    }
    if (normalizedStatus !== "queued") return { outcome: "ack" };

    const retryAfterSeconds = retryAfterSecondsForAvailableAt(record.availableAt);
    if (retryAfterSeconds !== null) {
      return {
        outcome: "nack",
        errorCode: "job_not_due",
        retryAfterSeconds,
      };
    }
    const desired = await desiredRunnerPoolCapacity();
    if (!Number.isFinite(desired) || desired <= 0) {
      return {
        outcome: "nack",
        errorCode: "runner_pool_not_ready",
        retryAfterSeconds: 30,
      };
    }
    const capacity = await ensureFlyMachineCapacity("pool", desired);
    if (!capacity.ok) {
      throw new ReplayTransientError("fly_capacity_unavailable");
    }
    const wake = await wakeCloudSubmissionWorker(event.jobId, { target: "pool" });
    if (!wake.ok) throw new ReplayTransientError("worker_wake_unavailable");
    return { outcome: "ack" };
  }

  if (
    SUBMISSION_TERMINAL_STATUSES.has(normalizedStatus) ||
    isSubmissionWakeRunning(normalizedStatus) ||
    !isSubmissionWakeQueued(normalizedStatus)
  ) {
    return { outcome: "ack" };
  }
  const wake = await wakeCloudSubmissionWorker(event.jobId, { target: event.target });
  if (!wake.ok) throw new ReplayTransientError("worker_wake_unavailable");
  return { outcome: "ack" };
}

function isApplicationAnswersEvent(value: unknown): value is ApplicationAnswersEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<ApplicationAnswersEvent>;
  return (
    event.version === 1 &&
    typeof event.applicantId === "string" &&
    typeof event.applicationId === "string" &&
    typeof event.savedAt === "string" &&
    Number.isFinite(Date.parse(event.savedAt)) &&
    Boolean(event.answers) &&
    typeof event.answers === "object" &&
    !Array.isArray(event.answers) &&
    Object.keys(event.answers).length <= 500 &&
    Object.entries(event.answers).every(
      ([fieldName, answer]) => fieldName.trim().length > 0 && typeof answer === "string",
    )
  );
}

async function replayApplicationAnswers(event: ApplicationAnswersEvent): Promise<ReplayResult["errorCode"]> {
  const admin = createAdminClient({
    requestTimeoutMs: 6_000,
    retryDelaysMs: [],
  }) as unknown as ReplayRpcClient;
  const { error } = await admin.rpc("replay_resilient_application_answers", {
    p_application_id: event.applicationId,
    p_applicant_id: event.applicantId,
    p_saved_at: event.savedAt,
    p_answers: event.answers,
  });
  if (!error) return undefined;
  const normalized = error.message.toLowerCase();
  if (normalized.includes("ownership check failed")) return "ownership_rejected";
  throw new Error(error.message);
}

export async function POST(request: Request): Promise<NextResponse> {
  const rawBody = await request.text();
  if (!verifyReplaySignature(request, rawBody)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: ReplayRequest;
  try {
    payload = JSON.parse(rawBody) as ReplayRequest;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!Array.isArray(payload.items) || payload.items.length > 50) {
    return NextResponse.json({ error: "invalid_batch" }, { status: 400 });
  }

  const results: ReplayResult[] = [];
  for (const rawItem of payload.items) {
    const item = rawItem as ReplayItem;
    const idempotencyKey = typeof item.idempotencyKey === "string" ? item.idempotencyKey : "";
    const leaseId = typeof item.leaseId === "string" ? item.leaseId : undefined;
    if (!idempotencyKey || typeof item.eventType !== "string" || typeof item.blob !== "string") {
      if (idempotencyKey) results.push({ idempotencyKey, leaseId, outcome: "ack", errorCode: "invalid_event" });
      continue;
    }
    if (item.eventType !== APPLICATION_ANSWERS_EVENT && item.eventType !== RUNNER_JOB_WAKE_EVENT) {
      results.push({ idempotencyKey, leaseId, outcome: "ack", errorCode: "unsupported_event" });
      continue;
    }

    try {
      const event = decryptResilienceValue<unknown>(item.blob);
      if (item.eventType === RUNNER_JOB_WAKE_EVENT) {
        if (
          !isRunnerJobWakeEvent(event) ||
          idempotencyKey !== `runner-job-wakeup:${event.jobId}`
        ) {
          results.push({ idempotencyKey, leaseId, outcome: "ack", errorCode: "invalid_event" });
          continue;
        }
        const replay = await replayRunnerJobWake(event);
        results.push({
          idempotencyKey,
          leaseId,
          outcome: replay.outcome,
          ...(replay.errorCode ? { errorCode: replay.errorCode } : {}),
          ...(replay.retryAfterSeconds ? { retryAfterSeconds: replay.retryAfterSeconds } : {}),
        });
        continue;
      }
      if (!isApplicationAnswersEvent(event)) {
        results.push({ idempotencyKey, leaseId, outcome: "ack", errorCode: "invalid_event" });
        continue;
      }
      const rejected = await replayApplicationAnswers(event);
      results.push({
        idempotencyKey,
        leaseId,
        outcome: "ack",
        ...(rejected ? { errorCode: rejected } : {}),
      });
    } catch (error) {
      const errorCode = error instanceof ReplayTransientError ? error.code : "provider_unavailable";
      console.warn("Resilience event replay deferred", {
        idempotencyKeyPrefix: idempotencyKey.slice(0, 8),
        eventType: item.eventType,
        errorCode,
      });
      results.push({
        idempotencyKey,
        leaseId,
        outcome: "nack",
        errorCode,
        retryAfterSeconds: 30,
      });
    }
  }

  return NextResponse.json({ ok: true, results });
}
