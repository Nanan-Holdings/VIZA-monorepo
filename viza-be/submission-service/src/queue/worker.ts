import { supabase } from "../supabase";
import { sendAlert } from "../alerts/dispatch";
import { emitRunnerMetric } from "../metrics/emit";
import {
  calculateQueueErrorBackoffMs,
  summarizeQueueError,
} from "./poll-backoff";

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

export async function markSucceeded(jobId: string): Promise<void> {
  const finishedAt = new Date().toISOString();
  // Capture lifecycle stamps before the update so we can compute time-to-submit.
  const { data: pre } = await supabase
    .from("runner_job")
    .select("application_id, country, started_at")
    .eq("id", jobId)
    .maybeSingle();
  const { error } = await supabase
    .from("runner_job")
    .update({
      status: "succeeded",
      finished_at: finishedAt,
      leased_by: null,
      leased_until: null,
    })
    .eq("id", jobId);
  if (error) throw new Error(`runner_job mark succeeded: ${error.message}`);
  if (pre?.application_id && pre.country) {
    const ttsSeconds = pre.started_at
      ? Math.max(
          0,
          Math.round(
            (Date.parse(finishedAt) - Date.parse(pre.started_at as string)) / 1000,
          ),
        )
      : null;
    void emitRunnerMetric({
      jobId,
      applicationId: pre.application_id as string,
      country: pre.country as string,
      success: true,
      timeToSubmitSeconds: ttsSeconds,
    });
  }
}

export async function markFailedWithRetry(
  job: RunnerJob,
  error: unknown,
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  const newAttempts = job.attempts + 1;
  const exhausted = newAttempts >= job.max_attempts;
  const availableAt = new Date(
    Date.now() + Math.min(300, 15 * newAttempts) * 1_000,
  ).toISOString();
  const { error: updErr } = await supabase
    .from("runner_job")
    .update({
      status: exhausted ? "failed" : "queued",
      attempts: newAttempts,
      last_error: message,
      finished_at: exhausted ? new Date().toISOString() : null,
      leased_by: null,
      leased_until: null,
      available_at: exhausted ? undefined : availableAt,
    })
    .eq("id", job.id);
  if (updErr) {
    throw new Error(`runner_job mark failed: ${updErr.message}`);
  }
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
}

export type JobHandler = (job: RunnerJob) => Promise<void>;

async function renewJobLease(
  jobId: string,
  workerId: string,
  leaseMs: number,
): Promise<void> {
  const { data, error } = await supabase
    .from("runner_job")
    .update({ leased_until: new Date(Date.now() + leaseMs).toISOString() })
    .eq("id", jobId)
    .eq("status", "running")
    .eq("leased_by", workerId)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`runner_job lease renewal: ${error.message}`);
  if (!data) throw new Error(`runner_job lease ${jobId.slice(0, 8)} is no longer owned`);
}

/**
 * Convenience driver: poll for jobs and run `handler` on each. Stops
 * when `signal` is aborted.
 */
export async function pollAndRun(
  workerId: string,
  handler: JobHandler,
  opts: {
    country?: string;
    pollMs?: number;
    signal?: AbortSignal;
    onJobStart?: (job: RunnerJob) => void;
    onJobFinish?: (job: RunnerJob) => void;
    onClaimHealthy?: () => void;
    onClaimError?: (error: unknown) => void;
  } = {},
): Promise<void> {
  const pollMs = opts.pollMs ?? 5_000;
  const leaseMs = DEFAULT_LEASE_MS;
  let consecutiveClaimFailures = 0;
  for (;;) {
    if (opts.signal?.aborted) return;
    let job: RunnerJob | null;
    try {
      job = await claimNextJob({ workerId, country: opts.country });
      consecutiveClaimFailures = 0;
      opts.onClaimHealthy?.();
    } catch (err) {
      consecutiveClaimFailures += 1;
      const retryMs = calculateQueueErrorBackoffMs(pollMs, consecutiveClaimFailures);
      console.error(
        `[queue] claim failed attempt=${consecutiveClaimFailures} retryMs=${retryMs} ${summarizeQueueError(err)}`,
      );
      opts.onClaimError?.(err);
      await new Promise((r) => setTimeout(r, retryMs));
      continue;
    }
    if (!job) {
      await new Promise((r) => setTimeout(r, pollMs));
      continue;
    }
    opts.onJobStart?.(job);
    let leaseRenewing = false;
    const leaseTimer = setInterval(() => {
      if (leaseRenewing) return;
      leaseRenewing = true;
      void renewJobLease(job.id, workerId, leaseMs)
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
      await handler(job);
      clearInterval(leaseTimer);
      await markSucceeded(job.id);
    } catch (err) {
      console.error(`[queue] job ${job.id} failed`, err);
      try {
        await markFailedWithRetry(job, err);
      } catch (markErr) {
        console.error(`[queue] mark failed write failed`, markErr);
      }
    } finally {
      clearInterval(leaseTimer);
      opts.onJobFinish?.(job);
    }
  }
}
