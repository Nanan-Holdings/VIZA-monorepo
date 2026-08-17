export interface VietnamStatusCheckRpcError {
  message: string;
}

export type VietnamStatusCheckRpcName =
  | "claim_vn_official_status_checks"
  | "renew_vn_official_status_check"
  | "complete_vn_official_status_check"
  | "fail_vn_official_status_check"
  | "defer_vn_official_status_check";

export interface VietnamStatusCheckRpcClient {
  rpc(
    name: VietnamStatusCheckRpcName,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: VietnamStatusCheckRpcError | null }>;
}

export interface VietnamStatusCheckLease {
  id: string;
  leaseGeneration: number;
  leaseExpiresAt: string;
}

export class VietnamStatusCheckOwnershipLostError extends Error {
  readonly code = "vietnam_status_check_ownership_lost" as const;

  constructor(message = "Vietnam official status check ownership was lost") {
    super(message);
    this.name = "VietnamStatusCheckOwnershipLostError";
  }
}

export class VietnamStatusCheckRpcSchemaError extends Error {
  readonly code = "vietnam_status_check_rpc_schema_error" as const;

  constructor(message: string) {
    super(message);
    this.name = "VietnamStatusCheckRpcSchemaError";
  }
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseGeneration(value: unknown, operation: string): number {
  const parsed = typeof value === "number"
    ? value
    : typeof value === "string" && /^\d+$/.test(value.trim())
      ? Number(value)
      : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new VietnamStatusCheckRpcSchemaError(
      `${operation} returned an invalid lease_generation`,
    );
  }
  return parsed;
}

function parseExpiry(value: unknown, operation: string): string {
  if (!isNonBlankString(value) || !Number.isFinite(Date.parse(value))) {
    throw new VietnamStatusCheckRpcSchemaError(
      `${operation} returned an invalid lease_expires_at`,
    );
  }
  return value;
}

function parseLeaseRow(
  data: unknown,
  operation: string,
  expectedId?: string,
): VietnamStatusCheckLease | null {
  if (data === null || data === undefined) return null;
  if (!Array.isArray(data)) {
    throw new VietnamStatusCheckRpcSchemaError(`${operation} must return a table row`);
  }
  if (data.length === 0) return null;
  if (data.length !== 1) {
    throw new VietnamStatusCheckRpcSchemaError(`${operation} returned multiple rows`);
  }
  const row = data[0];
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    throw new VietnamStatusCheckRpcSchemaError(`${operation} returned a malformed row`);
  }
  const value = row as Record<string, unknown>;
  if (!isNonBlankString(value.id)) {
    throw new VietnamStatusCheckRpcSchemaError(`${operation} returned a blank check id`);
  }
  if (expectedId && value.id !== expectedId) {
    throw new VietnamStatusCheckRpcSchemaError(`${operation} returned the wrong check id`);
  }
  return {
    id: value.id,
    leaseGeneration: parseGeneration(value.lease_generation, operation),
    leaseExpiresAt: parseExpiry(value.lease_expires_at, operation),
  };
}

function parseBoolean(data: unknown, operation: string): boolean {
  if (data === true || data === false) return data;
  if (data === null || data === undefined || (Array.isArray(data) && data.length === 0)) {
    return false;
  }
  throw new VietnamStatusCheckRpcSchemaError(`${operation} returned a non-boolean result`);
}

function assertLeaseSeconds(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > 300) {
    throw new RangeError("leaseSeconds must be between 1 and 300");
  }
  return value;
}

function assertLeaseGeneration(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError("leaseGeneration must be a positive integer");
  }
  return value;
}

function assertCheckIdentity(checkId: string, workerId: string): void {
  if (!isNonBlankString(checkId) || !isNonBlankString(workerId)) {
    throw new TypeError("checkId and workerId are required");
  }
}

function assertJsonObjectSize(value: Record<string, unknown>, fieldName: string): void {
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new TypeError(`${fieldName} must be JSON serializable`);
  }
  if (Buffer.byteLength(serialized, "utf8") > 524_288) {
    throw new RangeError(`${fieldName} must be at most 524288 bytes`);
  }
}

export async function claimVietnamOfficialStatusChecks<T extends Record<string, unknown>>(
  client: VietnamStatusCheckRpcClient,
  input: { workerId: string; limit?: number; leaseSeconds?: number },
): Promise<Array<T & VietnamStatusCheckLease>> {
  if (!isNonBlankString(input.workerId)) throw new TypeError("workerId is required");
  const leaseSeconds = assertLeaseSeconds(input.leaseSeconds ?? 300);
  const { data, error } = await client.rpc("claim_vn_official_status_checks", {
    p_worker_id: input.workerId,
    p_limit: 1,
    p_lease_seconds: leaseSeconds,
  });
  if (error) {
    throw new Error(`Failed to claim Vietnam official status checks: ${error.message}`);
  }
  if (data === null || data === undefined) return [];
  if (!Array.isArray(data)) {
    throw new VietnamStatusCheckRpcSchemaError(
      "claim_vn_official_status_checks must return a table",
    );
  }
  if (data.length === 0) return [];
  if (data.length !== 1) {
    throw new VietnamStatusCheckRpcSchemaError(
      "claim_vn_official_status_checks returned more than one claim",
    );
  }
  const row = data[0];
  const lease = parseLeaseRow(data, "claim_vn_official_status_checks");
  if (!lease || !row || typeof row !== "object" || Array.isArray(row)) return [];
  return [{
    ...(row as T),
    id: lease.id,
    leaseGeneration: lease.leaseGeneration,
    leaseExpiresAt: lease.leaseExpiresAt,
  }];
}

export async function renewVietnamOfficialStatusCheck(
  client: VietnamStatusCheckRpcClient,
  input: {
    checkId: string;
    workerId: string;
    leaseGeneration: number;
    leaseSeconds?: number;
  },
): Promise<VietnamStatusCheckLease | null> {
  assertCheckIdentity(input.checkId, input.workerId);
  const leaseGeneration = assertLeaseGeneration(input.leaseGeneration);
  const leaseSeconds = assertLeaseSeconds(input.leaseSeconds ?? 300);
  const { data, error } = await client.rpc("renew_vn_official_status_check", {
    p_check_id: input.checkId,
    p_worker_id: input.workerId,
    p_lease_generation: leaseGeneration,
    p_lease_seconds: leaseSeconds,
  });
  if (error) {
    throw new Error(`Failed to renew Vietnam official status check: ${error.message}`);
  }
  return parseLeaseRow(data, "renew_vn_official_status_check", input.checkId);
}

export async function completeVietnamOfficialStatusCheck(
  client: VietnamStatusCheckRpcClient,
  input: {
    checkId: string;
    workerId: string;
    leaseGeneration: number;
    patch: Record<string, unknown>;
  },
): Promise<boolean> {
  assertCheckIdentity(input.checkId, input.workerId);
  const leaseGeneration = assertLeaseGeneration(input.leaseGeneration);
  if (!input.patch || typeof input.patch !== "object" || Array.isArray(input.patch)) {
    throw new TypeError("patch must be a JSON object");
  }
  assertJsonObjectSize(input.patch, "patch");
  const { data, error } = await client.rpc("complete_vn_official_status_check", {
    p_check_id: input.checkId,
    p_worker_id: input.workerId,
    p_lease_generation: leaseGeneration,
    p_patch: input.patch,
  });
  if (error) {
    throw new Error(`Failed to complete Vietnam official status check: ${error.message}`);
  }
  return parseBoolean(data, "complete_vn_official_status_check");
}

export async function failVietnamOfficialStatusCheck(
  client: VietnamStatusCheckRpcClient,
  input: {
    checkId: string;
    workerId: string;
    leaseGeneration: number;
    errorCode: string;
    errorMessage: string;
    rawStatusJson?: Record<string, unknown>;
  },
): Promise<boolean> {
  assertCheckIdentity(input.checkId, input.workerId);
  const leaseGeneration = assertLeaseGeneration(input.leaseGeneration);
  if (!isNonBlankString(input.errorCode) || input.errorCode.length > 100) {
    throw new RangeError("errorCode must be 1-100 characters");
  }
  if (typeof input.errorMessage !== "string" || input.errorMessage.length > 500) {
    throw new RangeError("errorMessage must be at most 500 characters");
  }
  const rawStatusJson = input.rawStatusJson ?? {};
  if (!rawStatusJson || typeof rawStatusJson !== "object" || Array.isArray(rawStatusJson)) {
    throw new TypeError("rawStatusJson must be a JSON object");
  }
  assertJsonObjectSize(rawStatusJson, "rawStatusJson");
  const { data, error } = await client.rpc("fail_vn_official_status_check", {
    p_check_id: input.checkId,
    p_worker_id: input.workerId,
    p_lease_generation: leaseGeneration,
    p_error_code: input.errorCode,
    p_error_message: input.errorMessage,
    p_raw_status_json: rawStatusJson,
  });
  if (error) {
    throw new Error(`Failed to fail Vietnam official status check: ${error.message}`);
  }
  return parseBoolean(data, "fail_vn_official_status_check");
}

export async function deferVietnamOfficialStatusCheck(
  client: VietnamStatusCheckRpcClient,
  input: {
    checkId: string;
    workerId: string;
    leaseGeneration: number;
    retryAfterSeconds: number;
  },
): Promise<boolean> {
  assertCheckIdentity(input.checkId, input.workerId);
  const leaseGeneration = assertLeaseGeneration(input.leaseGeneration);
  if (
    !Number.isSafeInteger(input.retryAfterSeconds) ||
    input.retryAfterSeconds < 1 ||
    input.retryAfterSeconds > 300
  ) {
    throw new RangeError("retryAfterSeconds must be between 1 and 300");
  }
  const { data, error } = await client.rpc("defer_vn_official_status_check", {
    p_check_id: input.checkId,
    p_worker_id: input.workerId,
    p_lease_generation: leaseGeneration,
    p_retry_after_seconds: input.retryAfterSeconds,
  });
  if (error) {
    throw new Error(`Failed to defer Vietnam official status check: ${error.message}`);
  }
  return parseBoolean(data, "defer_vn_official_status_check");
}

export function isVietnamStatusCheckLeaseOwned(
  lease: VietnamStatusCheckLease | null,
): lease is VietnamStatusCheckLease {
  return Boolean(
    lease &&
    isNonBlankString(lease.id) &&
    Number.isSafeInteger(lease.leaseGeneration) &&
    lease.leaseGeneration > 0 &&
    Number.isFinite(Date.parse(lease.leaseExpiresAt)),
  );
}

export interface VietnamStatusCheckLeaseHeartbeatContext {
  readonly signal: AbortSignal;
  readonly lease: VietnamStatusCheckLease;
  assertOwned(): void;
  stopRenewal(): Promise<void>;
}

/**
 * Keeps a single claimed status check alive while official-portal work runs.
 * The database-returned expiry is authoritative after every heartbeat; a
 * false/empty renew result aborts the operation and prevents any stale
 * settlement. Settlement callers stop this helper before invoking complete,
 * fail, or defer and wait for an in-flight renew to finish.
 */
export async function withVietnamStatusCheckLease<T>(input: {
  client: VietnamStatusCheckRpcClient;
  checkId: string;
  workerId: string;
  leaseGeneration: number;
  leaseExpiresAt: string;
  leaseSeconds?: number;
  heartbeatMs?: number;
  operation: (context: VietnamStatusCheckLeaseHeartbeatContext) => Promise<T>;
}): Promise<T> {
  assertCheckIdentity(input.checkId, input.workerId);
  const initialGeneration = assertLeaseGeneration(input.leaseGeneration);
  const initialExpiry = parseExpiry(input.leaseExpiresAt, "status check claim");
  const heartbeatMs = input.heartbeatMs ?? 60_000;
  if (!Number.isSafeInteger(heartbeatMs) || heartbeatMs < 1_000 || heartbeatMs > 60_000) {
    throw new RangeError("heartbeatMs must be between 1000 and 60000");
  }
  const leaseSeconds = assertLeaseSeconds(input.leaseSeconds ?? 300);
  const leaseWindowMs = leaseSeconds * 1_000;
  // Keep a bounded local safety window.  The lower bound matters for short
  // leases too: a timer must never be scheduled after the database lease has
  // already expired, even when the process clock is a little behind.
  const maxSafeWindowMs = Math.max(250, leaseWindowMs - 250);
  const safetyLeadMs = Math.min(maxSafeWindowMs, 5_000);
  const controller = new AbortController();
  let currentLease: VietnamStatusCheckLease = {
    id: input.checkId,
    leaseGeneration: initialGeneration,
    leaseExpiresAt: initialExpiry,
  };
  let ownershipLost = false;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let renewInFlight: Promise<void> | null = null;
  let conservativeDeadline = 0;

  const resetConservativeDeadline = (lease: VietnamStatusCheckLease, roundTripMs = 0): void => {
    const expiresAt = Date.parse(lease.leaseExpiresAt);
    const rttLead = Math.max(1_000, roundTripMs + 1_000);
    const safety = Math.min(
      maxSafeWindowMs,
      Math.max(250, safetyLeadMs, rttLead),
    );
    const localLeaseCap = Date.now() + Math.max(250, leaseWindowMs - safety);
    // Bound both by the DB timestamp and by the caller's requested lease
    // window.  The local cap prevents a process clock that lags the database
    // from treating a stale absolute expiry as an indefinitely live claim.
    conservativeDeadline = Math.min(expiresAt - safety, localLeaseCap);
  };

  resetConservativeDeadline(currentLease);

  const markLost = (): void => {
    if (ownershipLost) return;
    ownershipLost = true;
    controller.abort();
  };
  const assertOwned = (): void => {
    if (ownershipLost || Date.now() >= conservativeDeadline) {
      markLost();
      throw new VietnamStatusCheckOwnershipLostError();
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
        const renewed = await renewVietnamOfficialStatusCheck(input.client, {
          checkId: input.checkId,
          workerId: input.workerId,
          leaseGeneration: currentLease.leaseGeneration,
          leaseSeconds,
        });
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

  const stopRenewal = async (): Promise<void> => {
    stopped = true;
    if (timer) clearTimeout(timer);
    timer = null;
    if (renewInFlight) await renewInFlight;
  };

  assertOwned();
  schedule();
  if (ownershipLost) throw new VietnamStatusCheckOwnershipLostError();
  let operationPromise: Promise<T>;
  try {
    operationPromise = input.operation({
      signal: controller.signal,
      get lease() {
        return currentLease;
      },
      assertOwned,
      stopRenewal,
    });
  } catch (error) {
    operationPromise = Promise.reject(error);
  }
  let operationResult: T | undefined;
  let operationError: unknown;
  try {
    // The operation is responsible for asserting ownership immediately before
    // any fenced settlement.  Do not run another wall-clock assertion here:
    // a deliberately slow but successful DB settlement may cross the local
    // conservative deadline after renewal has been stopped.
    operationResult = await operationPromise;
  } catch (error) {
    operationError = error;
  } finally {
    await stopRenewal();
  }
  if (ownershipLost) throw new VietnamStatusCheckOwnershipLostError();
  if (operationError) throw operationError;
  return operationResult as T;
}
