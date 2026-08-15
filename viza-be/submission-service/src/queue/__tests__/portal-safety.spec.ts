import assert from "node:assert/strict";
import test from "node:test";
import { RunnerJobOwnershipLostError, type RunnerExecutionContext } from "../execution-context.js";

test("owned dialog helper dismisses instead of accepting after ownership loss", async () => {
  const module = await import("../portal-safety.js").catch(() => ({} as Record<string, unknown>));
  assert.equal(typeof module.acceptOwnedDialog, "function");
  const acceptOwnedDialog = module.acceptOwnedDialog as (
    dialog: { accept: () => Promise<void>; dismiss: () => Promise<void> },
    executionContext?: RunnerExecutionContext,
  ) => Promise<void>;
  let accepted = 0;
  let dismissed = 0;
  const dialog = {
    accept: async () => { accepted += 1; },
    dismiss: async () => { dismissed += 1; },
  };
  const ownershipLost = new RunnerJobOwnershipLostError("lease lost while dialog was open");
  let owned = true;
  const execution: RunnerExecutionContext = {
    jobId: "job-portal-test",
    workerId: "worker-portal-test",
    signal: new AbortController().signal,
    assertOwned: () => {
      if (!owned) throw ownershipLost;
    },
    checkpoint: () => {
      if (!owned) throw ownershipLost;
    },
  };

  await acceptOwnedDialog(dialog, execution);
  assert.equal(accepted, 1);
  owned = false;
  await assert.rejects(() => acceptOwnedDialog(dialog, execution), (error: unknown) => error === ownershipLost);
  assert.equal(accepted, 1);
  assert.equal(dismissed, 1);
});

test("abortable launch closes a resource that resolves after cancellation", async () => {
  const module = await import("../portal-safety.js").catch(() => ({} as Record<string, unknown>));
  assert.equal(typeof module.launchAbortableResource, "function");
  const launchAbortableResource = module.launchAbortableResource as <T>(
    signal: AbortSignal | undefined,
    launch: () => Promise<T>,
    close: (resource: T) => Promise<void> | void,
  ) => Promise<T>;
  const controller = new AbortController();
  const ownershipLost = new RunnerJobOwnershipLostError("lease lost during browser launch");
  let resolveLaunch: ((resource: { id: string }) => void) | null = null;
  let closeCount = 0;
  const launch = launchAbortableResource(
    controller.signal,
    () => new Promise<{ id: string }>((resolve) => {
      resolveLaunch = resolve;
    }),
    async () => {
      closeCount += 1;
    },
  );
  controller.abort(ownershipLost);
  (resolveLaunch as ((resource: { id: string }) => void) | null)?.({ id: "browser" });
  await assert.rejects(() => launch, (error: unknown) => error === ownershipLost);
  assert.equal(closeCount, 1);
});
