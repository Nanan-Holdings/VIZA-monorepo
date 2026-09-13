import "server-only";

export const CLIENT_PORTAL_READ_BUDGET_MS = 8_000;

export interface PortalReadBudget {
  signal: AbortSignal;
  didTimeout: () => boolean;
  dispose: () => void;
}

function timeoutReason(): DOMException {
  return new DOMException("Client portal read budget exceeded", "TimeoutError");
}

/**
 * Create one request-wide cancellation budget for a read-only portal
 * aggregate. The signal is intended to be passed into every Supabase client
 * used by the aggregate so an expired budget aborts the underlying response
 * body and prevents retry attempts from starting.
 */
export function createPortalReadBudget(
  timeoutMs = CLIENT_PORTAL_READ_BUDGET_MS,
  upstreamSignal?: AbortSignal,
): PortalReadBudget {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("timeoutMs must be a positive finite number");
  }

  const controller = new AbortController();
  let timedOut = false;
  let disposed = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort(timeoutReason());
  }, timeoutMs);

  const abortFromUpstream = upstreamSignal
    ? () => {
        clearTimeout(timeoutId);
        if (!controller.signal.aborted) {
          controller.abort(
            upstreamSignal.reason ?? new DOMException("Client portal read cancelled", "AbortError"),
          );
        }
      }
    : undefined;
  if (upstreamSignal && abortFromUpstream) {
    if (upstreamSignal.aborted) abortFromUpstream();
    else upstreamSignal.addEventListener("abort", abortFromUpstream, { once: true });
  }

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      clearTimeout(timeoutId);
      if (abortFromUpstream) upstreamSignal?.removeEventListener("abort", abortFromUpstream);
    },
  };
}
