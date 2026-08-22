import { getSupabaseCircuitBreaker } from "./circuit-breaker";

export type FetchWithTimeout = typeof fetch;

const DEFAULT_TRANSIENT_RETRY_DELAYS_MS = [1_000, 2_000, 4_000] as const;
const RETRYABLE_SUPABASE_STATUSES = new Set([503, 520]);
const CIRCUIT_FAILURE_STATUSES = new Set([500, 502, 503, 504, 520, 522, 524]);

type SupabaseFetchOptions = {
  requestTimeoutMs?: number;
  retryDelaysMs?: readonly number[];
  circuitBreakerScope?: string;
};

type SupabaseResultWithError = {
  error?: string;
};

function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (typeof Request !== "undefined" && input instanceof Request) return input.method.toUpperCase();
  return "GET";
}

function isRetryableNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  return error instanceof DOMException && ["NetworkError", "TimeoutError"].includes(error.name);
}

function waitForRetry(delayMs: number, signal?: AbortSignal | null): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(signal.reason ?? new DOMException("The request was aborted", "AbortError"));
  }
  if (delayMs <= 0) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      signal?.removeEventListener("abort", handleAbort);
      resolve();
    }, delayMs);
    const handleAbort = () => {
      clearTimeout(timeoutId);
      reject(signal?.reason ?? new DOMException("The request was aborted", "AbortError"));
    };
    signal?.addEventListener("abort", handleAbort, { once: true });
  });
}

export function isTransientSupabaseSchemaCacheError(error: unknown): boolean {
  const message = typeof error === "string"
    ? error
    : error && typeof error === "object" && "message" in error
      ? String(error.message)
      : "";
  const normalized = message.toLowerCase();
  return (
    normalized.includes("pgrst002") ||
    normalized.includes("could not query the database for the schema cache")
  );
}

/**
 * Retry an explicitly idempotent Supabase operation whose public result shape
 * returns an error string instead of throwing. Callers must opt in per
 * operation; arbitrary POST/PATCH/DELETE requests are never retried globally.
 */
export async function retryTransientSupabaseResult<T extends SupabaseResultWithError>(
  operation: () => Promise<T>,
  retryDelaysMs: readonly number[] = DEFAULT_TRANSIENT_RETRY_DELAYS_MS,
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    const result = await operation();
    const retryDelay = retryDelaysMs[attempt];
    if (!result.error || retryDelay === undefined || !isTransientSupabaseSchemaCacheError(result.error)) {
      return result;
    }
    await waitForRetry(retryDelay);
  }
}

/**
 * Wrap fetch with a real AbortController deadline. Promise.race only stops the
 * caller from waiting; it leaves the underlying socket and server work alive.
 */
export function createFetchWithTimeout(timeoutMs: number): FetchWithTimeout {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("timeoutMs must be a positive finite number");
  }

  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const controller = new AbortController();
    const upstreamSignal = init?.signal;
    const forwardAbort = () => controller.abort(upstreamSignal?.reason);

    if (upstreamSignal?.aborted) {
      forwardAbort();
    } else {
      upstreamSignal?.addEventListener("abort", forwardAbort, { once: true });
    }

    const timeoutId = setTimeout(() => {
      controller.abort(new DOMException("Supabase request timed out", "TimeoutError"));
    }, timeoutMs);

    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
      upstreamSignal?.removeEventListener("abort", forwardAbort);
    }
  };
}

/**
 * Supabase/PostgREST can briefly return 503 while rebuilding its schema cache.
 * Retry only idempotent reads, matching Supabase's client retry policy, so a
 * transient PGRST002 response does not become a user-facing application error.
 */
export function createFetchWithTransientRetry(
  options: SupabaseFetchOptions = {},
): FetchWithTimeout {
  const retryDelaysMs = options.retryDelaysMs ?? DEFAULT_TRANSIENT_RETRY_DELAYS_MS;
  const fetchOnce = options.requestTimeoutMs
    ? createFetchWithTimeout(options.requestTimeoutMs)
    : (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init);

  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const circuit = getSupabaseCircuitBreaker(options.circuitBreakerScope);
    circuit.beforeRequest();
    const method = requestMethod(input, init);
    const canRetry = method === "GET" || method === "HEAD";

    for (let attempt = 0; ; attempt += 1) {
      try {
        const response = await fetchOnce(input, init);
        const retryDelay = retryDelaysMs[attempt];
        if (!canRetry || retryDelay === undefined || !RETRYABLE_SUPABASE_STATUSES.has(response.status)) {
          if (CIRCUIT_FAILURE_STATUSES.has(response.status)) {
            circuit.recordFailure();
          } else {
            circuit.recordSuccess();
          }
          return response;
        }

        await response.body?.cancel().catch(() => undefined);
        await waitForRetry(retryDelay, init?.signal);
      } catch (error) {
        const retryDelay = retryDelaysMs[attempt];
        if (
          !canRetry ||
          retryDelay === undefined ||
          init?.signal?.aborted ||
          !isRetryableNetworkError(error)
        ) {
          if (isRetryableNetworkError(error)) circuit.recordFailure();
          throw error;
        }
        await waitForRetry(retryDelay, init?.signal);
      }
    }
  };
}
