export type FetchWithTimeout = typeof fetch;

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
