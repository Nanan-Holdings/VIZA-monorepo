import { RunnerJobOwnershipLostError } from "./execution-context.js";
import type { RunnerExecutionContext } from "./execution-context.js";

export interface PortalDialogLike {
  accept(): Promise<void>;
  dismiss(): Promise<void>;
}

export async function runOwnedAction<T>(
  executionContext: RunnerExecutionContext | undefined,
  action: () => Promise<T>,
): Promise<T> {
  executionContext?.assertOwned();
  return action();
}

export async function clickOwned<TOptions>(
  target: { click(options?: TOptions): Promise<unknown> },
  executionContext?: RunnerExecutionContext,
  options?: TOptions,
): Promise<void> {
  await runOwnedAction(executionContext, async () => {
    await target.click(options);
  });
}

function abortReason(signal: AbortSignal | undefined, fallback: unknown): Error {
  const reason = signal?.reason;
  if (reason instanceof Error) return reason;
  return fallback instanceof Error
    ? fallback
    : new RunnerJobOwnershipLostError("runner job ownership was lost while a portal dialog was open");
}

/**
 * Accept an official portal dialog only while the queue lease is owned.
 * Ownership loss dismisses the dialog (best effort) and propagates the typed
 * cancellation so callers cannot convert it into a portal failure result.
 */
export async function acceptOwnedDialog(
  dialog: PortalDialogLike,
  executionContext?: RunnerExecutionContext,
): Promise<void> {
  try {
    executionContext?.assertOwned();
    await dialog.accept();
  } catch (error) {
    const ownershipLost =
      error instanceof RunnerJobOwnershipLostError ||
      executionContext?.signal.aborted ||
      (typeof error === "object" && error !== null &&
        "code" in error &&
        (error as { code?: unknown }).code === "runner_job_ownership_lost");
    if (!ownershipLost) throw error;
    await dialog.dismiss().catch(() => undefined);
    throw abortReason(executionContext?.signal, error);
  }
}

/**
 * Make browser/session acquisition cancellation-safe. The listener is
 * installed before launch; if an abort races the async launch, the resolved
 * resource is closed before the typed cancellation escapes.
 */
export async function launchAbortableResource<T>(
  signal: AbortSignal | undefined,
  launch: () => Promise<T>,
  close: (resource: T) => Promise<void> | void,
): Promise<T> {
  if (signal?.aborted) {
    throw abortReason(signal, new RunnerJobOwnershipLostError());
  }

  let resource: T | undefined;
  let hasResource = false;
  let closePromise: Promise<void> | null = null;
  const closeOnce = async (): Promise<void> => {
    if (!hasResource || resource === undefined || closePromise) return closePromise ?? Promise.resolve();
    closePromise = Promise.resolve(close(resource));
    await closePromise;
  };
  const abortListener = (): void => {
    void closeOnce();
  };
  signal?.addEventListener("abort", abortListener, { once: true });
  try {
    resource = await launch();
    hasResource = true;
    if (signal?.aborted) {
      await closeOnce();
      throw abortReason(signal, new RunnerJobOwnershipLostError());
    }
    return resource;
  } catch (error) {
    await closeOnce();
    throw error;
  } finally {
    signal?.removeEventListener("abort", abortListener);
  }
}
