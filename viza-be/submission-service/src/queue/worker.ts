import { supabase } from "../supabase.js";

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
  const { error } = await supabase
    .from("runner_job")
    .update({
      status: "succeeded",
      finished_at: new Date().toISOString(),
      leased_by: null,
      leased_until: null,
    })
    .eq("id", jobId);
  if (error) throw new Error(`runner_job mark succeeded: ${error.message}`);
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
