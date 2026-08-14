import { supabase } from "../supabase";
import { sendAlert } from "../alerts/dispatch";
import { emitRunnerMetric } from "../metrics/emit";

/**
 * runner_job consumer (INFRA-002).
 *
 * Postgres-backed FIFO claimed through one service-role-only RPC using
 * database locks and `SKIP LOCKED`. Each tick:
 *   1. recover expired leases and claim the oldest eligible typed flow.
 *   2. mark `status='running'`, set leased_by + leased_until.
 *   3. invoke the per-country `runOne(applicationId)` handler.
 *   4. on success → status='succeeded'; on failure with retries left
 *      → back to 'queued' + bump attempts; otherwise 'failed' or
 *      'dead_letter'.
 *
 * The Cloudflare Queues / BullMQ swap path is documented in
 * docs/infra/queue.md. The contract here (claim + lease + status
 * write-back) survives the transport change unchanged.
 */

export interface RunnerJob {
  id: string;
  application_id: string;
  country: string;
  flow_key: string;
  attempts: number;
  max_attempts: number;
  correlation_id: string | null;
  metadata: Record<string, unknown> | null;
}

export interface ClaimOpts {
  /** Stable id for this worker instance — lands in leased_by. */
  workerId: string;
  /** Lease duration in ms. Default 15 minutes. */
  leaseMs?: number;
  /** Restrict to a country bucket. Omit to claim across all countries. */
  country?: string;
}

const DEFAULT_LEASE_MS = 15 * 60 * 1000;

export class RunnerJobOwnershipLostError extends Error {
  readonly code = "runner_job_ownership_lost" as const;

  constructor(message = "runner job lease ownership was lost") {
    super(message);
    this.name = "RunnerJobOwnershipLostError";
  }
}

export function isRunnerJobOwnershipLost(
  error: unknown,
): error is RunnerJobOwnershipLostError {
  return (
    error instanceof RunnerJobOwnershipLostError ||
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "runner_job_ownership_lost")
  );
}

/**
 * Atomically claim the next queued job through claim_runner_pool_job.
 */
export async function claimNextJob(opts: ClaimOpts): Promise<RunnerJob | null> {
  const leaseMs = opts.leaseMs ?? DEFAULT_LEASE_MS;
  if (opts.country) {
    throw new Error(
      "Country-scoped claims are disabled for the shared runner pool. " +
        "Start the retained rollback image instead of mixing claim transports.",
    );
  }

  const { data, error } = await supabase.rpc("claim_runner_pool_job", {
    p_worker_id: opts.workerId,
    p_lease_ms: leaseMs,
    p_require_slot: Boolean(process.env.FLY_MACHINE_ID),
  });
  if (error) {
    throw new Error(`runner pool claim RPC: ${error.message}`);
  }
  const row = Array.isArray(data) ? data[0] : data;
  return row ? (row as RunnerJob) : null;
}

export async function markSucceeded(
  jobId: string,
  workerId: string,
): Promise<void> {
  const finishedAt = new Date();
  const { data, error } = await supabase.rpc("complete_runner_pool_job", {
    p_job_id: jobId,
    p_worker_id: workerId,
    p_now: finishedAt.toISOString(),
  });
  if (error) throw new Error(`runner_job complete RPC: ${error.message}`);
  const row = (Array.isArray(data) ? data[0] : data) as
    | { application_id?: string; country?: string; started_at?: string | null }
    | null
    | undefined;
  if (!row) throw new RunnerJobOwnershipLostError();
  if (row.application_id && row.country) {
    const ttsSeconds = row.started_at
      ? Math.max(
          0,
          Math.round(
            (finishedAt.getTime() - Date.parse(row.started_at)) / 1000,
          ),
        )
      : null;
    void emitRunnerMetric({
      jobId,
      applicationId: row.application_id,
      country: row.country,
      success: true,
      timeToSubmitSeconds: ttsSeconds,
    });
  }
}

export async function markFailedWithRetry(
  job: RunnerJob,
  error: unknown,
  workerId: string,
): Promise<number | null> {
  const message = error instanceof Error ? error.message : String(error);
  const newAttempts = job.attempts + 1;
  const exhausted = newAttempts >= job.max_attempts;
  const availableAt = new Date(
    Date.now() + Math.min(300, 15 * newAttempts) * 1_000,
  ).toISOString();
  const nowIso = new Date().toISOString();
  const { data: updated, error: updErr } = await supabase
    .from("runner_job")
    .update({
      status: exhausted ? "failed" : "queued",
      attempts: newAttempts,
      last_error: message,
      finished_at: exhausted ? nowIso : null,
      leased_by: null,
      leased_until: null,
      available_at: exhausted ? undefined : availableAt,
    })
    .eq("id", job.id)
    .eq("status", "running")
    .eq("leased_by", workerId)
    .gt("leased_until", nowIso)
    .select("id")
    .maybeSingle();
  if (updErr) {
    throw new Error(`runner_job mark failed: ${updErr.message}`);
  }
  if (!updated) throw new RunnerJobOwnershipLostError();
  if (exhausted) {
    // OPS-003: page on-call once retries are exhausted. Per-country
    // throttle absorbs portal-outage storms.
    void sendAlert({
      severity: "error",
      class: `runner.failed.${job.country}`,
      title: `Runner job failed (${job.country})`,
      body:
        `Job ${job.id.slice(0, 8)} hit max_attempts=${job.max_attempts}.\n` +
        `Last error: ${message}`,
      jobId: job.id,
      applicationId: job.application_id,
    });
    // OPS-005: emit a failure metric so the success-rate KPI on
    // /admin/metrics reflects exhaustion as a hard fail.
    void emitRunnerMetric({
      jobId: job.id,
      applicationId: job.application_id,
      country: job.country,
      success: false,
      timeToSubmitSeconds: null,
    });
  }
  return exhausted ? null : Math.max(0, Date.parse(availableAt) - Date.now());
}

export type JobHandler = (job: RunnerJob) => Promise<void>;

export interface DrainOpts {
  /** Stable id for this worker instance — lands in leased_by. */
  workerId: string;
  /** Job handler invoked for each atomically claimed row. */
  handler: JobHandler;
  /** Stop before the next claim when the process is shutting down. */
  signal?: AbortSignal;
  /** Lease duration in ms. Default 15 minutes. */
  leaseMs?: number;
  onJobStart?: (job: RunnerJob) => void;
  onJobFinish?: (job: RunnerJob) => void;
  onClaimHealthy?: () => void;
  onClaimError?: (error: unknown) => void;
  /** Schedule one local wake for a retry made available in the future. */
  onRetryScheduled?: (delayMs: number) => void;
}

export interface DrainResult {
  jobsProcessed: number;
  stoppedBecause: "empty" | "aborted" | "claim_error";
}

async function renewJobLease(
  jobId: string,
  workerId: string,
  leaseMs: number,
): Promise<void> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("runner_job")
    .update({ leased_until: new Date(Date.now() + leaseMs).toISOString() })
    .eq("id", jobId)
    .eq("status", "running")
    .eq("leased_by", workerId)
    .gt("leased_until", nowIso)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`runner_job lease renewal: ${error.message}`);
  if (!data) throw new RunnerJobOwnershipLostError();
}

/**
 * Drain the runner_job queue once, claiming until the database reports that
 * no eligible row remains. This function deliberately has no sleep/retry
 * loop: a later enqueue (or the startup/wake endpoint) starts another drain.
 * A single caller owns the coalescing promise in index.ts, so concurrent
 * endpoint wakes never create duplicate consumers.
 */
export async function drainAndRun(opts: DrainOpts): Promise<DrainResult> {
  const leaseMs = opts.leaseMs ?? DEFAULT_LEASE_MS;
  let jobsProcessed = 0;

  for (;;) {
    if (opts.signal?.aborted) {
      return { jobsProcessed, stoppedBecause: "aborted" };
    }

    let job: RunnerJob | null;
    try {
      job = await claimNextJob({ workerId: opts.workerId, leaseMs });
      opts.onClaimHealthy?.();
    } catch (error) {
      // Do not poll through an outage. The next explicit wake retries the
      // claim and avoids an idle worker repeatedly reading Supabase.
      console.error("[queue] runner_job claim failed", error);
      opts.onClaimError?.(error);
      return { jobsProcessed, stoppedBecause: "claim_error" };
    }

    if (!job) {
      return { jobsProcessed, stoppedBecause: "empty" };
    }

    jobsProcessed += 1;
    opts.onJobStart?.(job);
    let leaseRenewing = false;
    const leaseTimer = setInterval(() => {
      if (leaseRenewing) return;
      leaseRenewing = true;
      void renewJobLease(job.id, opts.workerId, leaseMs)
        .then(() => opts.onClaimHealthy?.())
        .catch((error) => {
          console.error(`[queue] job ${job.id} lease renewal failed`, error);
          opts.onClaimError?.(error);
        })
        .finally(() => {
          leaseRenewing = false;
        });
    }, 60_000);
    leaseTimer.unref?.();
    try {
      await opts.handler(job);
      await markSucceeded(job.id, opts.workerId);
    } catch (error) {
      console.error(`[queue] job ${job.id} failed`, error);
      if (isRunnerJobOwnershipLost(error)) {
        console.warn(`[queue] job ${job.id} ownership lost; skipping fallback failure write`);
        continue;
      }
      try {
        const retryDelayMs = await markFailedWithRetry(job, error, opts.workerId);
        if (retryDelayMs !== null) opts.onRetryScheduled?.(retryDelayMs);
      } catch (markError) {
        if (isRunnerJobOwnershipLost(markError)) {
          console.warn(`[queue] job ${job.id} ownership lost; skipping alert/metric fallback`);
          continue;
        }
        console.error("[queue] mark failed write failed", markError);
      }
    } finally {
      clearInterval(leaseTimer);
      opts.onJobFinish?.(job);
    }
  }
}
