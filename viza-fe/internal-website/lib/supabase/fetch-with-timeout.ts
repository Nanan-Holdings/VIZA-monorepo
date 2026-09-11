import {
  getSupabaseCircuitBreaker,
  SupabaseCircuitOpenError,
  type SupabaseCircuitRequest,
} from "./circuit-breaker";

export type FetchWithTimeout = typeof fetch;

const DEFAULT_TRANSIENT_RETRY_DELAYS_MS = [1_000, 2_000, 4_000] as const;
const RETRYABLE_SUPABASE_STATUSES = new Set([503, 520]);
const CIRCUIT_FAILURE_STATUSES = new Set([500, 502, 503, 504, 520, 522, 524]);

export type SupabaseFetchOptions = {
  requestTimeoutMs?: number;
  retryDelaysMs?: readonly number[];
  circuitBreakerScope?: string | null;
  returnUnavailableResponse?: boolean;
  requestSignal?: AbortSignal;
  fetchImplementation?: typeof fetch;
};

type SupabaseResultWithError = {
  error?: string;
};

function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (typeof Request !== "undefined" && input instanceof Request) return input.method.toUpperCase();
  return "GET";
}

function requestSignal(input: RequestInfo | URL, init?: RequestInit): AbortSignal | null | undefined {
  if (init?.signal !== undefined) return init.signal;
  return typeof Request !== "undefined" && input instanceof Request ? input.signal : undefined;
}

type CombinedAbortSignal = {
  signal: AbortSignal | null;
  cleanup: () => void;
};

function combineAbortSignals(
  ...signals: Array<AbortSignal | null | undefined>
): CombinedAbortSignal {
  const activeSignals = signals.filter((signal): signal is AbortSignal => signal != null);
  if (activeSignals.length === 0) return { signal: null, cleanup: () => undefined };

  const firstSignal = activeSignals[0];
  if (activeSignals.every((signal) => signal === firstSignal)) {
    return { signal: firstSignal, cleanup: () => undefined };
  }

  if (typeof AbortSignal.any === "function") {
    // Native composition keeps both source signals connected after fetch has
    // returned headers, so a request-scope abort can still cancel the body.
    return { signal: AbortSignal.any(activeSignals), cleanup: () => undefined };
  }

  // Older browsers have no AbortSignal.any. This fallback keeps the existing
  // per-call cancellation behavior; request-scope body cancellation remains a
  // Node-runtime feature where native composition is available.
  const controller = new AbortController();
  const listeners = activeSignals.map((source) => {
    const listener = () => controller.abort(source.reason);
    source.addEventListener("abort", listener, { once: true });
    return { source, listener };
  });
  const preAborted = activeSignals.find((source) => source.aborted);
  if (preAborted) controller.abort(preAborted.reason);

  return {
    signal: controller.signal,
    cleanup: () => {
      for (const { source, listener } of listeners) {
        source.removeEventListener("abort", listener);
      }
    },
  };
}

function isRetryableNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  return error instanceof DOMException && ["NetworkError", "TimeoutError"].includes(error.name);
}

function createSupabaseUnavailableResponse(retryAfterMs?: number): Response {
  const headers = new Headers({
    "content-type": "application/json",
  });
  if (retryAfterMs !== undefined) {
    headers.set("retry-after", String(Math.max(1, Math.ceil(retryAfterMs / 1_000))));
  }

  return new Response(
    JSON.stringify({
      code: "VIZA_SUPABASE_UNAVAILABLE",
      message: "Supabase is temporarily unavailable after a network failure",
    }),
    {
      status: 503,
      statusText: "Service Unavailable",
      headers,
    },
  );
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
export function createFetchWithTimeout(
  timeoutMs: number,
  fetchImplementation?: typeof fetch,
): FetchWithTimeout {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("timeoutMs must be a positive finite number");
  }

  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const controller = new AbortController();
    const upstreamSignal = requestSignal(input, init);
    upstreamSignal?.throwIfAborted();
    const useNativeSignalComposition =
      Boolean(upstreamSignal) && typeof AbortSignal.any === "function";
    const signal = useNativeSignalComposition
      ? AbortSignal.any([controller.signal, upstreamSignal as AbortSignal])
      : controller.signal;
    const forwardAbort = upstreamSignal && !useNativeSignalComposition
      ? () => controller.abort(upstreamSignal.reason)
      : undefined;
    if (forwardAbort) upstreamSignal?.addEventListener("abort", forwardAbort, { once: true });

    const timeoutId = setTimeout(() => {
      controller.abort(new DOMException("Supabase request timed out", "TimeoutError"));
    }, timeoutMs);

    try {
      const baseFetch = fetchImplementation ?? globalThis.fetch;
      return await baseFetch(input, { ...init, signal });
    } finally {
      clearTimeout(timeoutId);
      if (forwardAbort) upstreamSignal?.removeEventListener("abort", forwardAbort);
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
    ? createFetchWithTimeout(options.requestTimeoutMs, options.fetchImplementation)
    : (input: RequestInfo | URL, init?: RequestInit) =>
      (options.fetchImplementation ?? globalThis.fetch)(input, init);

  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const perCallSignal = requestSignal(input, init);
    const combinedSignal = combineAbortSignals(options.requestSignal, perCallSignal);
    const effectiveSignal = combinedSignal.signal;
    try {
      effectiveSignal?.throwIfAborted();
      const fetchInit = options.requestSignal
        ? { ...init, signal: effectiveSignal ?? undefined }
        : init;
      const circuit = options.circuitBreakerScope === null
        ? null
        : getSupabaseCircuitBreaker(options.circuitBreakerScope);
      let circuitRequest: SupabaseCircuitRequest | undefined;
      try {
        circuitRequest = circuit?.beforeRequest();
      } catch (error) {
        if (options.returnUnavailableResponse && error instanceof SupabaseCircuitOpenError) {
          return createSupabaseUnavailableResponse(error.retryAfterMs);
        }
        throw error;
      }
      try {
        const method = requestMethod(input, init);
        const canRetry = method === "GET" || method === "HEAD";
        for (let attempt = 0; ; attempt += 1) {
          effectiveSignal?.throwIfAborted();
          try {
            const response = await fetchOnce(input, fetchInit);
            if (effectiveSignal?.aborted) {
              await response.body?.cancel().catch(() => undefined);
              effectiveSignal.throwIfAborted();
            }
            const retryDelay = retryDelaysMs[attempt];
            if (!canRetry || retryDelay === undefined || !RETRYABLE_SUPABASE_STATUSES.has(response.status)) {
              if (CIRCUIT_FAILURE_STATUSES.has(response.status)) {
                circuitRequest?.recordFailure();
              } else {
                circuitRequest?.recordSuccess();
              }
              return response;
            }

            await response.body?.cancel().catch(() => undefined);
            await waitForRetry(retryDelay, effectiveSignal);
          } catch (error) {
            // A caller may cancel with any reason, including TimeoutError or
            // TypeError. That is not evidence that the database is unhealthy.
            effectiveSignal?.throwIfAborted();
            const retryDelay = retryDelaysMs[attempt];
            if (
              !canRetry ||
              retryDelay === undefined ||
              !isRetryableNetworkError(error)
            ) {
              if (isRetryableNetworkError(error)) circuitRequest?.recordFailure();
              if (options.returnUnavailableResponse && isRetryableNetworkError(error)) {
                return createSupabaseUnavailableResponse();
              }
              throw error;
            }
            await waitForRetry(retryDelay, effectiveSignal);
          }
        }
      } finally {
        // Cancellation during fetch or retry sleep, and unexpected failures,
        // must release the recovery probe without declaring recovery success.
        circuitRequest?.release();
      }
    } finally {
      combinedSignal.cleanup();
    }
  };
}
