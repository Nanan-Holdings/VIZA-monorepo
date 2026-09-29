import { createHash } from "node:crypto";

/**
 * The audit transport is deliberately narrower than the shared artifact API.
 * Its upload implementation must pass the signal to the underlying request and
 * must not resolve until the storage service has acknowledged the write.  The
 * current Supabase `StorageFileApi.upload` does not expose an abort signal, so
 * the caller must provide a small, cancellation-aware transport (or use a
 * fetch wrapper that does so) when wiring this helper into the worker.
 */
export interface Ds160AuditStorageTransport {
  upload: (input: {
    path: string;
    body: Uint8Array;
    contentType: "application/octet-stream";
    signal: AbortSignal;
  }) => Promise<void | { path?: string }>;
  download: (input: {
    path: string;
    signal: AbortSignal;
  }) => Promise<Uint8Array | null>;
}

export interface Ds160AuditArtifactRef {
  path: string;
  sha256: string;
  sizeBytes: number;
}

export interface Ds160AuditStorageOptions {
  /** The runner-job id used by the canonical `jobs/{jobId}/...` layout. */
  jobId: string;
  /** The CEAC run id. It is part of the idempotency key and object path. */
  runId: string;
  transport: Ds160AuditStorageTransport;
  /**
   * Called before and after each storage operation.  A pre-sign caller should
   * use this to enforce the queue lease.  Omit it for finally-block evidence
   * whose caller intentionally owns a different terminal-state policy.
   */
  assertActive?: () => void | Promise<void>;
  /** Receives only non-sensitive storage metadata after persistence is proven. */
  onStored?: (ref: Ds160AuditArtifactRef & { name: string }) => void | Promise<void>;
  /** Overall wall-clock budget, including retries and backoff. */
  deadlineMs?: number;
  /** Maximum upload/reconciliation attempts. Defaults to three. */
  maxAttempts?: number;
  /** Initial retry delay. Delays are capped and exponential. */
  retryDelayMs?: number;
  /** Per-upload/download bound within the overall deadline. */
  operationTimeoutMs?: number;
  now?: () => number;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
}

export interface Ds160AuditStore {
  encrypt: (plaintext: string) => string;
  /** Runtime validation keeps the allowlist at the storage boundary. */
  write: (name: string, ciphertext: string) => Promise<void>;
}

export type Ds160AuditEvidenceName =
  | "input-snapshot.enc"
  | "pre-sign-review.enc"
  | "official-evidence.enc";

type FailureKind =
  | "authorization"
  | "bucket_missing"
  | "conflict"
  | "deadline"
  | "ownership"
  | "transient"
  | "unknown";

interface ClassifiedFailure {
  kind: FailureKind;
  status?: number;
}

// Bound each request while retaining time for a private SHA reconciliation
// and another upload within the total audit-persistence budget.
const DEFAULT_DEADLINE_MS = 60_000;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 250;
const MAX_RETRY_DELAY_MS = 2_000;
const DEFAULT_OPERATION_TIMEOUT_MS = 15_000;

/** Errors intentionally contain no path, ciphertext, answer, or provider URL. */
export class Ds160AuditStorageError extends Error {
  readonly code:
    | "AUDIT_STORAGE_AUTHORIZATION"
    | "AUDIT_STORAGE_BUCKET_MISSING"
    | "AUDIT_STORAGE_CONFLICT"
    | "AUDIT_STORAGE_DEADLINE"
    | "AUDIT_STORAGE_OWNERSHIP"
    | "AUDIT_STORAGE_UNAVAILABLE"
    | "AUDIT_STORAGE_UNVERIFIED";
  readonly attempts: number;

  constructor(
    code: Ds160AuditStorageError["code"],
    attempts: number,
    message: string,
  ) {
    super(message);
    this.name = "Ds160AuditStorageError";
    this.code = code;
    this.attempts = attempts;
  }
}

/** Internal marker: this one request timed out while the overall budget remains. */
class Ds160AuditOperationTimeoutError extends Error {
  constructor() {
    super("DS-160 audit storage operation timed out.");
    this.name = "Ds160AuditOperationTimeoutError";
  }
}

function toBytes(ciphertext: string): Uint8Array {
  return Buffer.from(ciphertext, "utf8");
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (isRecord(error) && typeof error.message === "string") return error.message;
  return String(error);
}

function errorStatus(error: unknown): number | undefined {
  if (!isRecord(error)) return undefined;
  const candidate = error.status ?? error.statusCode;
  if (typeof candidate === "number" && Number.isFinite(candidate)) return candidate;
  if (typeof candidate === "string" && /^\d{3}$/.test(candidate)) return Number(candidate);
  return undefined;
}

function isAbortError(error: unknown): boolean {
  return isRecord(error) && error.name === "AbortError";
}

function classifyFailure(error: unknown): ClassifiedFailure {
  if (error instanceof Ds160AuditOperationTimeoutError) return { kind: "transient" };
  const status = errorStatus(error);
  const text = errorText(error).toLowerCase();

  if (status === 401 || status === 403 || /\b(unauthorized|forbidden|invalid token|jwt)/.test(text)) {
    return { kind: "authorization", status };
  }
  if (
    /(?:no such|missing|not found|does not exist|invalid)\s+(?:storage\s+)?bucket/.test(text) ||
    /bucket[^\n]*(?:missing|not found|does not exist|invalid)/.test(text) ||
    /specified bucket does not exist/.test(text)
  ) {
    return { kind: "bucket_missing", status };
  }
  if (
    status === 409 ||
    /\b(conflict|already exists|duplicate|resource exists|object exists)\b/.test(text)
  ) {
    return { kind: "conflict", status };
  }
  if (
    status === 408 ||
    status === 425 ||
    status === 429 ||
    (status !== undefined && status >= 500 && status <= 599) ||
    /(?:timeout|timed out|network|fetch failed|econnreset|econnrefused|eai_again|enotfound|socket|temporar(?:y|ily)|service unavailable|connection)/.test(text)
  ) {
    return { kind: "transient", status };
  }
  return { kind: "unknown", status };
}

function asErrorMessage(kind: FailureKind): string {
  switch (kind) {
    case "authorization":
      return "DS-160 audit evidence storage authorization was rejected.";
    case "bucket_missing":
      return "DS-160 audit evidence storage bucket is unavailable.";
    case "conflict":
      return "DS-160 audit evidence path contains different bytes.";
    case "deadline":
      return "DS-160 audit evidence storage deadline expired.";
    case "ownership":
      return "DS-160 audit evidence write lost queue ownership.";
    case "transient":
      return "DS-160 audit evidence storage remained unavailable after bounded retries.";
    case "unknown":
      return "DS-160 audit evidence storage failed with an unclassified error.";
  }
}

function storageErrorCode(kind: FailureKind): Ds160AuditStorageError["code"] {
  switch (kind) {
    case "authorization": return "AUDIT_STORAGE_AUTHORIZATION";
    case "bucket_missing": return "AUDIT_STORAGE_BUCKET_MISSING";
    case "conflict": return "AUDIT_STORAGE_CONFLICT";
    case "deadline": return "AUDIT_STORAGE_DEADLINE";
    case "ownership": return "AUDIT_STORAGE_OWNERSHIP";
    case "transient": return "AUDIT_STORAGE_UNAVAILABLE";
    case "unknown": return "AUDIT_STORAGE_UNVERIFIED";
  }
}

function assertEvidenceName(name: string): asserts name is Ds160AuditEvidenceName {
  if (
    name !== "input-snapshot.enc" &&
    name !== "pre-sign-review.enc" &&
    name !== "official-evidence.enc"
  ) {
    throw new Ds160AuditStorageError(
      "AUDIT_STORAGE_UNVERIFIED",
      0,
      "DS-160 audit evidence name is not allowlisted.",
    );
  }
}

function assertPathSegment(value: string, label: string): void {
  if (!value || value === "." || value === ".." || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Ds160AuditStorageError(
      "AUDIT_STORAGE_UNVERIFIED",
      0,
      `DS-160 audit ${label} is invalid.`,
    );
  }
}

function auditPath(jobId: string, runId: string, name: Ds160AuditEvidenceName): string {
  assertPathSegment(jobId, "job id");
  assertPathSegment(runId, "run id");
  return `jobs/${jobId}/${runId}/${name}`;
}

async function defaultSleep(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) throw new DOMException("The operation was aborted.", "AbortError");
  await new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>;
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
    };
    const finish = () => {
      cleanup();
      resolve();
    };
    const abort = () => {
      cleanup();
      reject(new DOMException("The operation was aborted.", "AbortError"));
    };
    timer = setTimeout(finish, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}

function remainingMs(deadlineAt: number, now: () => number): number {
  return Math.max(0, deadlineAt - now());
}

async function runWithSignal<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  deadlineAt: number,
  now: () => number,
  operationTimeoutMs: number,
): Promise<T> {
  const remaining = remainingMs(deadlineAt, now);
  if (remaining <= 0) {
    throw new Ds160AuditStorageError("AUDIT_STORAGE_DEADLINE", 0, asErrorMessage("deadline"));
  }

  const controller = new AbortController();
  const operationTimeout = Math.min(Math.max(1, operationTimeoutMs), remaining);
  let operationTimedOut = false;
  const timer = setTimeout(() => {
    operationTimedOut = true;
    controller.abort();
  }, operationTimeout);
  try {
    // Do not race and detach this promise.  The transport contract requires
    // it to honor AbortSignal; awaiting it prevents a late upload from
    // re-entering the next retry after the helper has returned.
    const value = await operation(controller.signal);
    if (controller.signal.aborted) {
      if (operationTimedOut && remainingMs(deadlineAt, now) > 0) {
        throw new Ds160AuditOperationTimeoutError();
      }
      throw new Ds160AuditStorageError("AUDIT_STORAGE_DEADLINE", 0, asErrorMessage("deadline"));
    }
    return value;
  } catch (error) {
    if (controller.signal.aborted || isAbortError(error)) {
      if (operationTimedOut && remainingMs(deadlineAt, now) > 0) {
        throw new Ds160AuditOperationTimeoutError();
      }
      throw new Ds160AuditStorageError("AUDIT_STORAGE_DEADLINE", 0, asErrorMessage("deadline"));
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function assertStillActive(assertActive: (() => void | Promise<void>) | undefined): Promise<void> {
  if (!assertActive) return;
  try {
    await assertActive();
  } catch {
    throw new Ds160AuditStorageError("AUDIT_STORAGE_OWNERSHIP", 0, asErrorMessage("ownership"));
  }
}

function isInternalStorageError(error: unknown, code: Ds160AuditStorageError["code"]): boolean {
  return error instanceof Ds160AuditStorageError && error.code === code;
}

/**
 * Persist one encrypted DS-160 audit object using a bounded, same-bytes
 * idempotency protocol.  A timeout/409 is reconciled by downloading the
 * private object and comparing its SHA-256 before a retry can occur.  A
 * different object at the same path is never overwritten.
 */
export async function writeDs160AuditArtifact(
  options: Ds160AuditStorageOptions,
  name: Ds160AuditEvidenceName,
  ciphertext: string,
): Promise<Ds160AuditArtifactRef> {
  assertEvidenceName(name);
  const bytes = toBytes(ciphertext);
  const expectedSha256 = sha256(bytes);
  const path = auditPath(options.jobId, options.runId, name);
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  const maxAttempts = Math.max(1, Math.min(options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS, 3));
  const deadlineAt = now() + Math.max(1, options.deadlineMs ?? DEFAULT_DEADLINE_MS);
  const baseDelay = Math.max(0, Math.min(options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS, MAX_RETRY_DELAY_MS));
  const operationTimeoutMs = Math.max(1, Math.min(
    options.operationTimeoutMs ?? DEFAULT_OPERATION_TIMEOUT_MS,
    DEFAULT_OPERATION_TIMEOUT_MS,
  ));
  let lastKind: FailureKind = "unknown";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await assertStillActive(options.assertActive);
    if (remainingMs(deadlineAt, now) <= 0) {
      throw new Ds160AuditStorageError("AUDIT_STORAGE_DEADLINE", attempt - 1, asErrorMessage("deadline"));
    }

    try {
      await runWithSignal(
        signal => options.transport.upload({
          path,
          body: bytes,
          contentType: "application/octet-stream",
          signal,
        }),
        deadlineAt,
        now,
        operationTimeoutMs,
      );
      await assertStillActive(options.assertActive);
      const result = { path, sha256: expectedSha256, sizeBytes: bytes.byteLength };
      await options.onStored?.({ ...result, name });
      return result;
    } catch (error) {
      if (isInternalStorageError(error, "AUDIT_STORAGE_OWNERSHIP")) throw error;
      if (isInternalStorageError(error, "AUDIT_STORAGE_DEADLINE")) {
        throw new Ds160AuditStorageError("AUDIT_STORAGE_DEADLINE", attempt, asErrorMessage("deadline"));
      }

      const classified = classifyFailure(error);
      lastKind = classified.kind;
      if (
        classified.kind === "authorization" ||
        classified.kind === "bucket_missing" ||
        classified.kind === "unknown"
      ) {
        throw new Ds160AuditStorageError(
          storageErrorCode(classified.kind),
          attempt,
          asErrorMessage(classified.kind),
        );
      }

      // A response can be lost after the provider has committed the object;
      // 409 has the same ambiguity.  Reconcile before deciding to retry.
      await assertStillActive(options.assertActive);
      try {
        const existing = await runWithSignal(
          signal => options.transport.download({ path, signal }),
          deadlineAt,
          now,
          operationTimeoutMs,
        );
        if (existing !== null) {
          if (sha256(existing) !== expectedSha256) {
            throw new Ds160AuditStorageError(
              "AUDIT_STORAGE_CONFLICT",
              attempt,
              asErrorMessage("conflict"),
            );
          }
          await assertStillActive(options.assertActive);
          const result = { path, sha256: expectedSha256, sizeBytes: bytes.byteLength };
          await options.onStored?.({ ...result, name });
          return result;
        }
      } catch (reconciliationError) {
        if (reconciliationError instanceof Ds160AuditStorageError) {
          if (
            reconciliationError.code === "AUDIT_STORAGE_CONFLICT" ||
            reconciliationError.code === "AUDIT_STORAGE_OWNERSHIP"
          ) throw reconciliationError;
          if (reconciliationError.code === "AUDIT_STORAGE_DEADLINE") {
            throw new Ds160AuditStorageError("AUDIT_STORAGE_DEADLINE", attempt, asErrorMessage("deadline"));
          }
        }
        const reconciliationKind = classifyFailure(reconciliationError);
        if (reconciliationKind.kind === "authorization" || reconciliationKind.kind === "bucket_missing") {
          throw new Ds160AuditStorageError(
            storageErrorCode(reconciliationKind.kind),
            attempt,
            asErrorMessage(reconciliationKind.kind),
          );
        }
        // A transient reconciliation failure leaves persistence unproven; a
        // later bounded attempt may upload and reconcile again.
        lastKind = reconciliationKind.kind === "unknown" ? "transient" : reconciliationKind.kind;
      }

      if (attempt >= maxAttempts) break;
      const delay = Math.min(MAX_RETRY_DELAY_MS, baseDelay * (2 ** (attempt - 1)));
      const remaining = remainingMs(deadlineAt, now);
      if (remaining <= 0) {
        throw new Ds160AuditStorageError("AUDIT_STORAGE_DEADLINE", attempt, asErrorMessage("deadline"));
      }
      const controller = new AbortController();
      const sleepFor = Math.min(delay, remaining);
      try {
        await sleep(sleepFor, controller.signal);
      } catch (sleepError) {
        if (isAbortError(sleepError)) {
          throw new Ds160AuditStorageError("AUDIT_STORAGE_DEADLINE", attempt, asErrorMessage("deadline"));
        }
        throw sleepError;
      }
    }
  }

  const finalCode = lastKind === "conflict" ? "AUDIT_STORAGE_CONFLICT" : "AUDIT_STORAGE_UNAVAILABLE";
  throw new Ds160AuditStorageError(finalCode, maxAttempts, asErrorMessage(lastKind === "conflict" ? "conflict" : "transient"));
}

/**
 * Adapter for `persistDs160InputSnapshot` and `persistDs160RunEvidence`.
 * `onStored` is where the caller should update its queue result audit map.
 */
export function createDs160AuditStore(
  encrypt: (plaintext: string) => string,
  options: Ds160AuditStorageOptions,
): Ds160AuditStore {
  return {
    encrypt,
    async write(name, ciphertext) {
      assertEvidenceName(name);
      await writeDs160AuditArtifact(options, name, ciphertext);
    },
  };
}
