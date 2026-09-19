import type { SubmissionQueueItem } from "./types";

export interface SubmissionQueueClaimOptions {
  workerId: string;
  limit: number;
  leaseSeconds: number;
  targetJobId?: string | null;
  maxAttempts?: number;
  providerAllowlist?: string[] | null;
  allowFailed?: boolean;
}

interface RpcError {
  code?: string;
  message: string;
}

export interface SubmissionQueueClaimClient {
  rpc(
    name:
      | "claim_submission_queue_batch"
      | "claim_vn_cloud_submission_queue_batch"
      | "claim_indonesia_submission_queue_batch"
      | "renew_submission_queue_lease",
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: RpcError | null }>;
}

export interface SubmissionQueueLease {
  queueId: string;
  leaseExpiresAt: string;
}

export class SubmissionQueueOwnershipLostError extends Error {
  readonly code = "submission_queue_ownership_lost" as const;

  constructor(message = "submission queue lease ownership was lost") {
    super(message);
    this.name = "SubmissionQueueOwnershipLostError";
  }
}

export interface SubmissionQueueLeaseHeartbeat {
  readonly signal: AbortSignal;
  readonly lease: SubmissionQueueLease;
  assertOwned(): void;
  isOwnershipLost(): boolean;
  stopRenewal(): Promise<void>;
}

export interface StartSubmissionQueueLeaseHeartbeatOptions {
  client: SubmissionQueueClaimClient;
  queueId: string;
  workerId: string;
  leaseSeconds?: number;
  heartbeatMs?: number;
  onOwnershipLost?: () => void | Promise<void>;
}

const DEFAULT_SUBMISSION_QUEUE_LEASE_SECONDS = 900;
const MIN_SUBMISSION_QUEUE_LEASE_SECONDS = 60;
const MAX_SUBMISSION_QUEUE_LEASE_SECONDS = 3_600;

function assertNonBlank(value: string, name: string): string {
  const normalized = value.trim();
  if (!normalized) throw new TypeError(`${name} is required`);
  return normalized;
}

function normalizeLeaseSeconds(value: number | undefined): number {
  const leaseSeconds = value ?? DEFAULT_SUBMISSION_QUEUE_LEASE_SECONDS;
  if (!Number.isSafeInteger(leaseSeconds) || leaseSeconds < 1) {
    throw new RangeError("leaseSeconds must be a positive integer");
  }
  return Math.max(
    MIN_SUBMISSION_QUEUE_LEASE_SECONDS,
    Math.min(MAX_SUBMISSION_QUEUE_LEASE_SECONDS, leaseSeconds),
  );
}

function parseLeaseRow(
  data: unknown,
  operation: string,
  expectedQueueId: string,
): SubmissionQueueLease | null {
  if (data === null || data === undefined) return null;
  if (!Array.isArray(data)) {
    throw new Error(`${operation} must return a table row`);
  }
  if (data.length === 0) return null;
  if (data.length !== 1 || !data[0] || typeof data[0] !== "object" || Array.isArray(data[0])) {
    throw new Error(`${operation} returned an invalid lease row`);
  }
  const row = data[0] as Record<string, unknown>;
  const queueId = typeof row.id === "string" ? row.id.trim() : "";
  const leaseExpiresAt = typeof row.locked_until === "string" ? row.locked_until.trim() : "";
  if (queueId !== expectedQueueId || !leaseExpiresAt || !Number.isFinite(Date.parse(leaseExpiresAt))) {
    throw new Error(`${operation} returned an invalid lease`);
  }
  return { queueId, leaseExpiresAt };
}

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("submission queue lease renewal timed out"));
    }, timeoutMs);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Renew one legacy submission_queue lease through the service-only RPC.
 * An empty result is an ownership conflict and is deliberately returned as
 * null so callers can abort the browser without touching the reclaimed row.
 */
export async function renewSubmissionQueueLease(
  client: SubmissionQueueClaimClient,
  input: { queueId: string; workerId: string; leaseSeconds?: number },
): Promise<SubmissionQueueLease | null> {
  const queueId = assertNonBlank(input.queueId, "queueId");
  const workerId = assertNonBlank(input.workerId, "workerId");
  const leaseSeconds = normalizeLeaseSeconds(input.leaseSeconds);
  const { data, error } = await client.rpc("renew_submission_queue_lease", {
    p_queue_id: queueId,
    p_worker_id: workerId,
    p_lease_seconds: leaseSeconds,
  });
  if (error) {
    throw new Error(`Failed to renew submission_queue lease: ${error.message}`);
  }
  return parseLeaseRow(data, "renew_submission_queue_lease", queueId);
}

/**
 * Keep one claimed DS-160 queue row alive while CEAC work runs. Renewal calls
 * are serialized, the database-returned expiry is treated as authoritative,
 * and a false/error result aborts the operation through the supplied callback.
 */
export async function startSubmissionQueueLeaseHeartbeat(
  input: StartSubmissionQueueLeaseHeartbeatOptions,
): Promise<SubmissionQueueLeaseHeartbeat> {
  const queueId = assertNonBlank(input.queueId, "queueId");
  const workerId = assertNonBlank(input.workerId, "workerId");
  const leaseSeconds = normalizeLeaseSeconds(input.leaseSeconds);
  const heartbeatMs = input.heartbeatMs ?? 60_000;
  if (!Number.isSafeInteger(heartbeatMs) || heartbeatMs < 1_000 || heartbeatMs > 60_000) {
    throw new RangeError("heartbeatMs must be between 1000 and 60000");
  }

  const controller = new AbortController();
  let currentLease: SubmissionQueueLease | null = null;
  let ownershipLost = false;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let renewInFlight: Promise<void> | null = null;
  let lossCleanup: Promise<void> | null = null;
  let conservativeDeadline = 0;
  const leaseWindowMs = leaseSeconds * 1_000;
  // The timeout is shorter than the remaining lease window, so a stuck
  // Supabase request cannot let the browser run past the database lease.
  const renewalTimeoutMs = Math.min(30_000, Math.max(5_000, Math.floor(leaseWindowMs / 3)));
  const maxSafeWindowMs = Math.max(250, leaseWindowMs - 250);
  const safetyLeadMs = Math.min(maxSafeWindowMs, 5_000);

  const resetConservativeDeadline = (lease: SubmissionQueueLease, roundTripMs = 0): void => {
    const expiresAt = Date.parse(lease.leaseExpiresAt);
    const rttLead = Math.max(1_000, roundTripMs + 1_000);
    const safety = Math.min(maxSafeWindowMs, Math.max(250, safetyLeadMs, rttLead));
    const localLeaseCap = Date.now() + Math.max(250, leaseWindowMs - safety);
    conservativeDeadline = Math.min(expiresAt - safety, localLeaseCap);
  };

  const markLost = (): void => {
    if (ownershipLost) return;
    ownershipLost = true;
    const error = new SubmissionQueueOwnershipLostError();
    controller.abort(error);
    if (input.onOwnershipLost) {
      lossCleanup = Promise.resolve()
        .then(() => input.onOwnershipLost?.())
        .then(() => undefined)
        .catch(() => undefined);
    }
  };

  const assertOwned = (): void => {
    if (ownershipLost || Date.now() >= conservativeDeadline) {
      markLost();
      throw new SubmissionQueueOwnershipLostError();
    }
  };

  const schedule = (): void => {
    if (stopped || ownershipLost) return;
    const remainingMs = conservativeDeadline - Date.now();
    const renewalLeadMs = 1_000;
    if (!Number.isFinite(remainingMs) || remainingMs <= renewalLeadMs) {
      markLost();
      return;
    }
    const delay = Math.min(heartbeatMs, remainingMs - renewalLeadMs);
    if (delay <= 0) {
      markLost();
      return;
    }
    timer = setTimeout(() => {
      timer = null;
      renewInFlight = (async () => {
        if (stopped || ownershipLost) return;
        if (conservativeDeadline - Date.now() <= renewalLeadMs) {
          markLost();
          return;
        }
        const startedAt = Date.now();
        const remainingMs = conservativeDeadline - startedAt;
        const requestTimeoutMs = Math.max(
          250,
          Math.min(renewalTimeoutMs, remainingMs - renewalLeadMs),
        );
        const renewed = await withTimeout(renewSubmissionQueueLease(input.client, {
          queueId,
          workerId,
          leaseSeconds,
        }), requestTimeoutMs);
        if (!renewed) {
          markLost();
          return;
        }
        currentLease = renewed;
        resetConservativeDeadline(renewed, Math.max(0, Date.now() - startedAt));
        schedule();
      })()
        .catch(() => {
          markLost();
        })
        .finally(() => {
          renewInFlight = null;
        });
    }, delay);
  };

  try {
    const startedAt = Date.now();
    currentLease = await withTimeout(renewSubmissionQueueLease(input.client, {
      queueId,
      workerId,
      leaseSeconds,
    }), renewalTimeoutMs);
    if (!currentLease) {
      markLost();
      throw new SubmissionQueueOwnershipLostError();
    }
    resetConservativeDeadline(currentLease, Math.max(0, Date.now() - startedAt));
    schedule();
    assertOwned();
  } catch (error) {
    markLost();
    stopped = true;
    if (timer) clearTimeout(timer);
    timer = null;
    await lossCleanup;
    if (error instanceof SubmissionQueueOwnershipLostError) throw error;
    throw new SubmissionQueueOwnershipLostError("submission queue lease renewal failed");
  }

  return {
    signal: controller.signal,
    get lease() {
      if (!currentLease) throw new SubmissionQueueOwnershipLostError();
      return currentLease;
    },
    assertOwned,
    isOwnershipLost: () => ownershipLost,
    async stopRenewal() {
      stopped = true;
      if (timer) clearTimeout(timer);
      timer = null;
      if (renewInFlight) await renewInFlight;
      await lossCleanup;
    },
  };
}

async function claimSubmissionQueueItems(
  client: SubmissionQueueClaimClient,
  rpcName:
    | "claim_vn_cloud_submission_queue_batch"
    | "claim_indonesia_submission_queue_batch",
  options: SubmissionQueueClaimOptions,
): Promise<SubmissionQueueItem[]> {
  const { data, error } = await client.rpc(rpcName, {
    p_worker_id: options.workerId,
    p_limit: options.limit,
    p_lease_seconds: options.leaseSeconds,
    p_target_job_id: options.targetJobId ?? null,
    p_max_attempts: options.maxAttempts ?? 3,
  });

  if (error) {
    throw new Error(`Failed to claim submission_queue batch via ${rpcName}: ${error.message}`);
  }

  return (Array.isArray(data) ? data : []) as SubmissionQueueItem[];
}

export async function claimPendingSubmissionQueueItems(
  client: SubmissionQueueClaimClient,
  options: SubmissionQueueClaimOptions,
): Promise<SubmissionQueueItem[]> {
  const providerAllowlist = options.providerAllowlist
    ?.map((provider) => provider.trim())
    .filter(Boolean);
  const { data, error } = await client.rpc("claim_submission_queue_batch", {
    p_worker_id: options.workerId,
    p_limit: options.limit,
    p_lease_seconds: options.leaseSeconds,
    p_target_job_id: options.targetJobId ?? null,
    p_max_attempts: options.maxAttempts ?? 3,
    p_provider_allowlist:
      providerAllowlist && providerAllowlist.length > 0 ? providerAllowlist : null,
    p_allow_failed: options.allowFailed ?? false,
  });

  if (error) {
    throw new Error(
      `Failed to claim submission_queue batch via claim_submission_queue_batch: ${error.message}`,
    );
  }

  return (Array.isArray(data) ? data : []) as SubmissionQueueItem[];
}

export async function claimPendingVietnamCloudQueueItems(
  client: SubmissionQueueClaimClient,
  options: SubmissionQueueClaimOptions,
): Promise<SubmissionQueueItem[]> {
  return claimSubmissionQueueItems(client, "claim_vn_cloud_submission_queue_batch", options);
}

export async function claimPendingIndonesiaQueueItems(
  client: SubmissionQueueClaimClient,
  options: SubmissionQueueClaimOptions,
): Promise<SubmissionQueueItem[]> {
  return claimSubmissionQueueItems(
    client,
    "claim_indonesia_submission_queue_batch",
    options,
  );
}

export function claimBatchLimitForConcurrency(concurrency: number): number {
  return Math.max(20, Math.min(Math.max(1, Math.floor(concurrency)) * 4, 100));
}
