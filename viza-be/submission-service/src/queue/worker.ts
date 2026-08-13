import { supabase } from "../supabase";
import { sendAlert } from "../alerts/dispatch";
import { emitRunnerMetric } from "../metrics/emit";
import { getMaxConcurrent, isPaused } from "./concurrency";

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
  /** Restrict to one runner_job.id. Requires a country. */
  jobId?: string;
  /** Optional guard for single-job runs. */
  expectedApplicationId?: string;
  /** Normalize country aliases before comparing a targeted row. */
  normalizeCountry?: (country: string) => string;
  /** Test seam; production uses the module Supabase client. */
  client?: RunnerJobClient;
}

const DEFAULT_LEASE_MS = 15 * 60 * 1000;
const RUNNER_JOB_COLUMNS = "id, application_id, country, attempts, max_attempts, correlation_id, metadata";

type QueryResult<T = any> = { data: T | null; error: { message: string } | null; count?: number | null };

interface RunnerJobQuery {
  select(columns: string, options?: Record<string, unknown>): RunnerJobQuery;
  eq(column: string, value: unknown): RunnerJobQuery;
  order(column: string, options?: Record<string, unknown>): RunnerJobQuery;
  limit(count: number): RunnerJobQuery;
  update(values: Record<string, unknown>): RunnerJobQuery;
  maybeSingle(): Promise<QueryResult>;
  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2>;
}

export interface RunnerJobClient {
  from(table: "runner_job" | string): RunnerJobQuery;
}

export class TargetRunnerJobError extends Error {
  constructor(
    message: string,
    readonly reason:
      | "target_requires_country"
      | "target_not_found"
      | "target_country_mismatch"
      | "target_application_mismatch"
      | "target_not_claimable"
      | "target_claim_raced",
  ) {
    super(message);
    this.name = "TargetRunnerJobError";
  }
}

function canonicalizeTargetCountry(value: string, normalizeCountry?: (country: string) => string): string {
  const trimmed = value.trim().toLowerCase();
  return normalizeCountry ? normalizeCountry(trimmed) : trimmed;
}

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
  if (opts.jobId) return claimTargetJob(opts);

  const leaseMs = opts.leaseMs ?? DEFAULT_LEASE_MS;
  const leasedUntil = new Date(Date.now() + leaseMs).toISOString();
  const client = (opts.client ?? supabase) as RunnerJobClient;

  let q = client
    .from("runner_job")
    .select(RUNNER_JOB_COLUMNS)
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
  const { count: running, error: countErr } = await client
    .from("runner_job")
    .select("id", { count: "exact", head: true })
    .eq("country", candidate.country)
    .eq("status", "running");
  if (countErr) {
    throw new Error(`runner_job running count: ${countErr.message}`);
  }
  if ((running ?? 0) >= max) return null;

  const { data: claimed, error: claimErr } = await client
    .from("runner_job")
    .update({
      status: "running",
      leased_by: opts.workerId,
      leased_until: leasedUntil,
      started_at: new Date().toISOString(),
    })
    .eq("id", candidate.id)
    .eq("status", "queued")
    .select(RUNNER_JOB_COLUMNS)
    .maybeSingle();
  if (claimErr) {
    throw new Error(`runner_job claim update: ${claimErr.message}`);
  }
  if (!claimed) return null; // raced; another worker won
  return claimed as RunnerJob;
}

export async function claimTargetJob(opts: ClaimOpts): Promise<RunnerJob> {
  if (!opts.jobId) throw new TargetRunnerJobError("runner_job target id is required", "target_not_found");
  if (!opts.country) {
    throw new TargetRunnerJobError("runner_job targeted mode requires RUNNER_JOB_COUNTRY", "target_requires_country");
  }

  const client = (opts.client ?? supabase) as RunnerJobClient;
  const expectedCountry = canonicalizeTargetCountry(opts.country, opts.normalizeCountry);
  const { data: existing, error: readErr } = await client
    .from("runner_job")
    .select(`${RUNNER_JOB_COLUMNS}, status`)
    .eq("id", opts.jobId)
    .maybeSingle();
  if (readErr) throw new Error(`runner_job target read: ${readErr.message}`);
  if (!existing) {
    throw new TargetRunnerJobError("runner_job target was not found", "target_not_found");
  }

  const row = existing as RunnerJob & { status?: string | null };
  const rowCountry = canonicalizeTargetCountry(row.country, opts.normalizeCountry);
  if (rowCountry !== expectedCountry) {
    throw new TargetRunnerJobError("runner_job target country mismatch", "target_country_mismatch");
  }
  if (opts.expectedApplicationId && row.application_id !== opts.expectedApplicationId) {
    throw new TargetRunnerJobError("runner_job target application mismatch", "target_application_mismatch");
  }
  if (row.status !== "queued") {
    throw new TargetRunnerJobError("runner_job target is not queued", "target_not_claimable");
  }

  if (isPaused(row.country)) {
    throw new TargetRunnerJobError("runner_job target country is paused", "target_not_claimable");
  }
  const max = getMaxConcurrent(row.country);
  const { count: running, error: countErr } = await client
    .from("runner_job")
    .select("id", { count: "exact", head: true })
    .eq("country", row.country)
    .eq("status", "running");
  if (countErr) {
    throw new Error(`runner_job running count: ${countErr.message}`);
  }
  if ((running ?? 0) >= max) {
    throw new TargetRunnerJobError("runner_job target country is already at concurrency limit", "target_not_claimable");
  }

  const leaseMs = opts.leaseMs ?? DEFAULT_LEASE_MS;
  const leasedUntil = new Date(Date.now() + leaseMs).toISOString();
  const { data: claimed, error: claimErr } = await client
    .from("runner_job")
    .update({
      status: "running",
      leased_by: opts.workerId,
      leased_until: leasedUntil,
      started_at: new Date().toISOString(),
    })
    .eq("id", opts.jobId)
    .eq("country", row.country)
    .eq("status", "queued")
    .select(RUNNER_JOB_COLUMNS)
    .maybeSingle();
  if (claimErr) {
    throw new Error(`runner_job target claim update: ${claimErr.message}`);
  }
  if (!claimed) {
    throw new TargetRunnerJobError("runner_job target could not be claimed", "target_claim_raced");
  }
  return claimed as RunnerJob;
}

export async function markSucceeded(
  jobId: string,
  client: RunnerJobClient = supabase as unknown as RunnerJobClient,
): Promise<void> {
  const finishedAt = new Date().toISOString();
  // Capture lifecycle stamps before the update so we can compute time-to-submit.
  const { data: pre } = await client
    .from("runner_job")
    .select("application_id, country, started_at")
    .eq("id", jobId)
    .maybeSingle();
  const { error } = await client
    .from("runner_job")
    .update({
      status: "succeeded",
      finished_at: finishedAt,
      leased_by: null,
      leased_until: null,
    })
    .eq("id", jobId);
  if (error) throw new Error(`runner_job mark succeeded: ${error.message}`);
  if (client === (supabase as unknown as RunnerJobClient) && pre?.application_id && pre.country) {
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
  client: RunnerJobClient = supabase as unknown as RunnerJobClient,
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  const newAttempts = job.attempts + 1;
  const exhausted = newAttempts >= job.max_attempts;
  const { error: updErr } = await client
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
  opts: {
    country?: string;
    pollMs?: number;
    signal?: AbortSignal;
    targetJobId?: string;
    expectedApplicationId?: string;
    normalizeCountry?: (country: string) => string;
    client?: RunnerJobClient;
  } = {},
): Promise<void> {
  const pollMs = opts.pollMs ?? 5_000;
  for (;;) {
    if (opts.signal?.aborted) return;
    let job: RunnerJob | null;
    try {
      job = await claimNextJob({
        workerId,
        country: opts.country,
        jobId: opts.targetJobId,
        expectedApplicationId: opts.expectedApplicationId,
        normalizeCountry: opts.normalizeCountry,
        client: opts.client,
      });
    } catch (err) {
      if (opts.targetJobId) throw err;
      console.error("[queue] claim failed", err);
      await new Promise((r) => setTimeout(r, pollMs));
      continue;
    }
    if (!job) {
      if (opts.targetJobId) return;
      await new Promise((r) => setTimeout(r, pollMs));
      continue;
    }
    try {
      await handler(job);
      await markSucceeded(job.id, opts.client);
    } catch (err) {
      console.error(`[queue] job ${job.id} failed`, err);
      try {
        await markFailedWithRetry(job, err, opts.client);
      } catch (markErr) {
        console.error(`[queue] mark failed write failed`, markErr);
      }
    }
    if (opts.targetJobId) return;
  }
}
