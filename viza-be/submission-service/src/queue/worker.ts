import { supabase } from "../supabase";
import { sendAlert } from "../alerts/dispatch";
import { emitRunnerMetric } from "../metrics/emit";
import {
  RunnerJobOwnershipLostError,
  type RunnerExecutionContext,
} from "./execution-context.js";

export { RunnerJobOwnershipLostError } from "./execution-context.js";
export type { RunnerExecutionContext } from "./execution-context.js";

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
  /** Test/runtime I/O boundary override. */
  client?: RunnerPoolClient;
}

const DEFAULT_LEASE_MS = 15 * 60 * 1000;

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

  const client = opts.client ?? defaultClient;
  const { data, error } = await client.rpc("claim_runner_pool_job", {
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

export interface RunnerPoolRpcResult {
  data: unknown;
  error: { message: string } | null;
}

export interface RunnerPoolQuery {
  update(values: Record<string, unknown>): RunnerPoolQuery;
  eq(column: string, value: unknown): RunnerPoolQuery;
  gt(column: string, value: unknown): RunnerPoolQuery;
  select(columns: string): RunnerPoolQuery;
  maybeSingle(): Promise<RunnerPoolRpcResult>;
}

export interface RunnerPoolClient {
  rpc(name: string, args: Record<string, unknown>): Promise<RunnerPoolRpcResult>;
  /** Retained for compatibility with callers that still inspect the queue. */
  from?: (table: string) => RunnerPoolQuery;
}

export interface RunnerQueueDependencies {
  client?: RunnerPoolClient;
}

const defaultClient = supabase as unknown as RunnerPoolClient;

function asRpcRow(data: unknown): Record<string, unknown> | null {
  const row = Array.isArray(data) ? data[0] : data;
  return row && typeof row === "object" ? (row as Record<string, unknown>) : null;
}

export async function markSucceeded(
  jobId: string,
  workerId: string,
  client: RunnerPoolClient = defaultClient,
): Promise<void> {
  const finishedAt = new Date();
  // Deliberately omit p_now in production. PostgreSQL's clock_timestamp()
  // fences both the live lease predicate and the authoritative finish stamp.
  const { data, error } = await client.rpc("complete_runner_pool_job", {
    p_job_id: jobId,
    p_worker_id: workerId,
  });
  if (error) throw new Error(`runner_job complete RPC: ${error.message}`);
  const row = asRpcRow(data) as
    | { application_id?: string; country?: string; started_at?: string | null }
    | null;
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
  client: RunnerPoolClient = defaultClient,
): Promise<number | null> {
  const message = error instanceof Error ? error.message : String(error);
  const newAttempts = job.attempts + 1;
  const exhausted = newAttempts >= job.max_attempts;
  const retryAfterSeconds = exhausted ? 0 : Math.min(300, 15 * newAttempts);
  const { data: updated, error: updErr } = await client.rpc("fail_runner_pool_job", {
    p_job_id: job.id,
    p_worker_id: workerId,
    p_status: exhausted ? "failed" : "queued",
    p_attempts: newAttempts,
    p_last_error: message,
    p_retry_after_seconds: retryAfterSeconds,
  });
  if (updErr) {
    throw new Error(`runner_job mark failed: ${updErr.message}`);
  }
  if (!asRpcRow(updated)) throw new RunnerJobOwnershipLostError();
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
  return exhausted ? null : retryAfterSeconds * 1_000;
}

export type JobHandler = (
  job: RunnerJob,
  execution: RunnerExecutionContext,
) => Promise<void>;

export interface DrainOpts {
  /** Stable id for this worker instance — lands in leased_by. */
  workerId: string;
  /** Job handler invoked for each atomically claimed row. */
  handler: JobHandler;
  /** Stop before the next claim when the process is shutting down. */
  signal?: AbortSignal;
  /** Lease duration in ms. Default 15 minutes. */
  leaseMs?: number;
  /** Override the heartbeat period for tests; defaults to one minute. */
  renewEveryMs?: number;
  /** Runtime I/O overrides for executable worker tests. */
  dependencies?: RunnerQueueDependencies;
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

export async function renewJobLease(
  jobId: string,
  workerId: string,
  leaseMs: number,
  client: RunnerPoolClient = defaultClient,
): Promise<{ leasedUntil: Date; roundTripMs: number }> {
  const startedAt = Date.now();
  const { data, error } = await client.rpc("renew_runner_pool_job", {
    p_job_id: jobId,
    p_worker_id: workerId,
    p_lease_ms: leaseMs,
  });
  if (error) throw new Error(`runner_job lease renewal: ${error.message}`);
  const row = asRpcRow(data);
  if (!row || typeof row.leased_until !== "string") {
    throw new RunnerJobOwnershipLostError();
  }
  const leasedUntilMs = Date.parse(row.leased_until);
  if (!Number.isFinite(leasedUntilMs)) {
    throw new RunnerJobOwnershipLostError("runner job renewal returned an invalid lease timestamp");
  }
  return {
    leasedUntil: new Date(leasedUntilMs),
    roundTripMs: Math.max(0, Date.now() - startedAt),
  };
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
  const client = opts.dependencies?.client ?? defaultClient;
  let jobsProcessed = 0;

  for (;;) {
    if (opts.signal?.aborted) {
      return { jobsProcessed, stoppedBecause: "aborted" };
    }

    let job: RunnerJob | null;
    let claimRoundTripMs = 0;
    try {
      const claimStartedAt = Date.now();
      job = await claimNextJob({ workerId: opts.workerId, leaseMs, client });
      claimRoundTripMs = Math.max(0, Date.now() - claimStartedAt);
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
    let ownershipLost = false;
    let ownershipLostError: RunnerJobOwnershipLostError | null = null;
    let renewInFlight: Promise<void> | null = null;
    let renewalStopped = false;
    let expiryStopped = false;
    let expiryTimer: ReturnType<typeof setTimeout> | null = null;
    const controller = new AbortController();
    const markOwnershipLost = (error: unknown): void => {
      if (ownershipLost) return;
      ownershipLost = true;
      ownershipLostError = isRunnerJobOwnershipLost(error)
        ? error
        : new RunnerJobOwnershipLostError(
            error instanceof Error
              ? `runner job lease renewal failed: ${error.message}`
              : "runner job lease ownership was lost",
          );
      controller.abort(ownershipLostError);
    };
    const execution: RunnerExecutionContext = {
      signal: controller.signal,
      assertOwned: () => {
        if (ownershipLost || controller.signal.aborted) {
          throw ownershipLostError ?? new RunnerJobOwnershipLostError();
        }
      },
      checkpoint: () => {
        if (ownershipLost || controller.signal.aborted) {
          throw ownershipLostError ?? new RunnerJobOwnershipLostError();
        }
      },
    };
    const expiryLeadMs = Math.min(1_000, Math.floor(leaseMs / 10));
    const scheduleExpiry = (roundTripMs: number): void => {
      if (expiryStopped || ownershipLost) return;
      if (expiryTimer) clearTimeout(expiryTimer);
      // The DB RPC's lease starts at the server's clock. Subtract the full
      // observed round-trip plus a bounded safety margin locally so network
      // delay can only make us stop early, never act after the DB lease.
      const conservativeDelay =
        leaseMs - Math.max(0, roundTripMs) - expiryLeadMs;
      if (conservativeDelay <= 0) {
        // The observed claim/renewal round trip has already consumed the
        // conservative lease budget. Fence ownership in this call stack so
        // the handler cannot observe a live signal for one event-loop turn
        // (or a queued microtask) before a zero/one-millisecond timer fires.
        markOwnershipLost(new RunnerJobOwnershipLostError("runner job lease expired"));
        return;
      }
      expiryTimer = setTimeout(() => {
        if (expiryStopped) return;
        markOwnershipLost(new RunnerJobOwnershipLostError("runner job lease expired"));
      }, conservativeDelay);
      expiryTimer.unref?.();
    };
    const beginRenewal = (): void => {
      if (renewalStopped || renewInFlight || ownershipLost) return;
      renewInFlight = renewJobLease(job.id, opts.workerId, leaseMs, client)
        .then((renewal) => {
          scheduleExpiry(renewal.roundTripMs);
          opts.onClaimHealthy?.();
        })
        .catch((error) => {
          console.error(`[queue] job ${job.id} lease renewal failed`, error);
          opts.onClaimError?.(error);
          markOwnershipLost(error);
        })
        .finally(() => {
          renewInFlight = null;
        });
    };
    const renewEveryMs = Math.max(1, opts.renewEveryMs ?? 60_000);
    const leaseTimer = setInterval(beginRenewal, renewEveryMs);
    // Claim/renew latency is subtracted from the local lease timer. Abort a
    // small bounded margin early so delayed network responses cannot let the
    // handler reach an irreversible action after the database lease expires.
    scheduleExpiry(claimRoundTripMs);
    leaseTimer.unref?.();
    let handlerError: unknown = null;
    try {
      await opts.handler(job, execution);
    } catch (error) {
      handlerError = error;
    }

    // Stop scheduling new heartbeats as soon as handler execution returns.
    // Otherwise an interval tick can start a renewal while completion/failure
    // settlement is already in flight, creating a stale-owner write race.
    renewalStopped = true;
    expiryStopped = true;
    clearInterval(leaseTimer);
    if (expiryTimer) clearTimeout(expiryTimer);
    // A renewal may have crossed the handler's completion boundary. Capture
    // and await that last promise before deciding whether terminal settlement
    // is safe; `renewalStopped` also guards a callback already queued by the
    // event loop when clearInterval ran.
    const finalRenewal = renewInFlight;
    if (finalRenewal) {
      await finalRenewal;
    }

    if (!handlerError && !ownershipLost) {
      try {
        execution.assertOwned();
        await markSucceeded(job.id, opts.workerId, client);
      } catch (error) {
        handlerError = error;
        if (isRunnerJobOwnershipLost(error)) markOwnershipLost(error);
      }
    }

    try {
      if (handlerError) {
        console.error(`[queue] job ${job.id} failed`, handlerError);
        if (ownershipLost || isRunnerJobOwnershipLost(handlerError)) {
          console.warn(`[queue] job ${job.id} ownership lost; skipping fallback failure write`);
        } else {
          try {
            const retryDelayMs = await markFailedWithRetry(job, handlerError, opts.workerId, client);
            if (retryDelayMs !== null) opts.onRetryScheduled?.(retryDelayMs);
          } catch (markError) {
            if (isRunnerJobOwnershipLost(markError)) {
              console.warn(`[queue] job ${job.id} ownership lost; skipping alert/metric fallback`);
            } else {
              console.error("[queue] mark failed write failed", markError);
            }
          }
        }
      }
    } finally {
      if (expiryTimer) clearTimeout(expiryTimer);
      opts.onJobFinish?.(job);
    }
  }
}
