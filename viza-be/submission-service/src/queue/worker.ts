import { supabase } from "../supabase.js";
import { sendAlert } from "../alerts/dispatch.js";
import { emitRunnerMetric } from "../metrics/emit.js";
import { getMaxConcurrent, isPaused } from "./concurrency.js";

/**
 * runner_job consumer (INFRA-002).
 *
 * Postgres-backed FIFO using `SELECT ... FOR UPDATE SKIP LOCKED`
 * inside a transaction. Each tick:
 *   1. claim oldest queued row (per-country bucket).
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
 * Atomically claim the next queued job. Uses a single Postgres RPC-ish
 * pattern: an UPDATE ... RETURNING with a WHERE clause selecting the
 * oldest queued row, scoped to one row. The Supabase JS client does
 * not expose `FOR UPDATE SKIP LOCKED` directly; the equivalent here is
 * UPDATE WHERE id = (SELECT id … LIMIT 1 FOR UPDATE SKIP LOCKED) which
 * we expose as a SQL function. Until that lands we fall back to a
 * compare-and-swap on `status` which is racy under high concurrency
 * but fine for the single-digit-worker scale we ship at first.
 */
export async function claimNextJob(opts: ClaimOpts): Promise<RunnerJob | null> {
  const leaseMs = opts.leaseMs ?? DEFAULT_LEASE_MS;
  const leasedUntil = new Date(Date.now() + leaseMs).toISOString();

  let q = supabase
    .from("runner_job")
    .select("id, application_id, country, attempts, max_attempts, correlation_id, metadata")
    .eq("status", "queued")
    .order("enqueued_at", { ascending: true })
    .limit(1);
  if (opts.country) q = q.eq("country", opts.country);
  const { data: candidates, error } = await q;
  if (error) {
    throw new Error(`runner_job claim read: ${error.message}`);
  }
  const candidate = candidates?.[0];
  if (!candidate) return null;

  // QUE-006: per-country concurrency cap + pause, sourced from env config
  // (src/queue/concurrency.ts). Decline the claim if the country is paused
  // or already at its in-flight cap.
  if (isPaused(candidate.country)) return null;
  const max = getMaxConcurrent(candidate.country);
  const { count: running, error: countErr } = await supabase
    .from("runner_job")
    .select("id", { count: "exact", head: true })
    .eq("country", candidate.country)
    .eq("status", "running");
  if (countErr) {
    throw new Error(`runner_job running count: ${countErr.message}`);
  }
  if ((running ?? 0) >= max) return null;

  const { data: claimed, error: claimErr } = await supabase
    .from("runner_job")
    .update({
      status: "running",
      leased_by: opts.workerId,
      leased_until: leasedUntil,
      started_at: new Date().toISOString(),
    })
    .eq("id", candidate.id)
    .eq("status", "queued")
    .select("id, application_id, country, attempts, max_attempts, correlation_id, metadata")
    .maybeSingle();
  if (claimErr) {
    throw new Error(`runner_job claim update: ${claimErr.message}`);
  }
  if (!claimed) return null; // raced; another worker won
  return claimed as RunnerJob;
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
  const { error: updErr } = await supabase
    .from("runner_job")
    .update({
      status: exhausted ? "failed" : "queued",
      attempts: newAttempts,
      last_error: message,
      finished_at: exhausted ? new Date().toISOString() : null,
      leased_by: null,
      leased_until: null,
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

/**
 * Convenience driver: poll for jobs and run `handler` on each. Stops
 * when `signal` is aborted.
 */
export async function pollAndRun(
  workerId: string,
  handler: JobHandler,
  opts: { country?: string; pollMs?: number; signal?: AbortSignal } = {},
): Promise<void> {
  const pollMs = opts.pollMs ?? 5_000;
  for (;;) {
    if (opts.signal?.aborted) return;
    let job: RunnerJob | null;
    try {
      job = await claimNextJob({ workerId, country: opts.country });
    } catch (err) {
      console.error("[queue] claim failed", err);
      await new Promise((r) => setTimeout(r, pollMs));
      continue;
    }
    if (!job) {
      await new Promise((r) => setTimeout(r, pollMs));
      continue;
    }
    try {
      await handler(job);
      await markSucceeded(job.id);
    } catch (err) {
      console.error(`[queue] job ${job.id} failed`, err);
      try {
        await markFailedWithRetry(job, err);
      } catch (markErr) {
        console.error(`[queue] mark failed write failed`, markErr);
      }
    }
  }
}
