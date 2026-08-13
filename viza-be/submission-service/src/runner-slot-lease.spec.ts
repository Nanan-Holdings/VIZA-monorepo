import { test } from "node:test";
import assert from "node:assert/strict";
import { acquireRunnerSlotWithRetry, RunnerSlotLease } from "./runner-slot-lease.js";

test("acquireRunnerSlotWithRetry keeps the worker alive through transient database failures", async () => {
  let attempts = 0;
  const errors: number[] = [];
  const acquired = await acquireRunnerSlotWithRetry({
    start: async () => {
      attempts += 1;
      if (attempts < 3) throw new Error("temporary database gateway failure");
      return true;
    },
  }, {
    initialDelayMs: 1,
    maxDelayMs: 2,
    onError: (_error, attempt) => errors.push(attempt),
  });

  assert.equal(acquired, true);
  assert.equal(attempts, 3);
  assert.deepEqual(errors, [1, 2]);
});

test("acquireRunnerSlotWithRetry stops retrying when shutdown is requested", async () => {
  const controller = new AbortController();
  let attempts = 0;
  const acquired = await acquireRunnerSlotWithRetry({
    start: async () => {
      attempts += 1;
      controller.abort();
      throw new Error("database unavailable");
    },
  }, {
    signal: controller.signal,
    initialDelayMs: 1,
  });

  assert.equal(acquired, false);
  assert.equal(attempts, 1);
});

test("RunnerSlotLease reserves, renews, and releases a pool slot", async () => {
  let reserveCalls = 0;
  let releases = 0;
  const lease = new RunnerSlotLease({
    machineId: "pool-machine-1",
    kind: "pool",
    renewEveryMs: 5,
    rpc: {
      reserve: async () => {
        reserveCalls += 1;
        return 3;
      },
      reserveSticky: async () => null,
      release: async () => {
        releases += 1;
      },
    },
  });

  assert.equal(await lease.start(), true);
  assert.equal(lease.slot(), 3);
  await new Promise((resolve) => setTimeout(resolve, 15));
  await lease.stop();
  assert.ok(reserveCalls >= 2);
  assert.equal(releases, 1);
});

test("RunnerSlotLease reports a healthy authoritative lease loss", async () => {
  let reserveCalls = 0;
  let lost = 0;
  const lease = new RunnerSlotLease({
    machineId: "pool-machine-2",
    kind: "pool",
    renewEveryMs: 5,
    onLeaseLost: () => {
      lost += 1;
    },
    rpc: {
      reserve: async () => {
        reserveCalls += 1;
        return reserveCalls === 1 ? 4 : null;
      },
      reserveSticky: async () => null,
      release: async () => undefined,
    },
  });

  assert.equal(await lease.start(), true);
  await new Promise((resolve) => setTimeout(resolve, 12));
  assert.equal(lost, 1);
  assert.equal(lease.isHealthy(), true);
  assert.equal(lease.slot(), null);
  await lease.stop();
});

test("RunnerSlotLease uses the sticky reservation path for Indonesia", async () => {
  let stickyKind: string | null = null;
  const lease = new RunnerSlotLease({
    machineId: "indonesia-machine-1",
    kind: "indonesia",
    renewEveryMs: 60_000,
    rpc: {
      reserve: async () => {
        throw new Error("pool reservation must not be used");
      },
      reserveSticky: async (_machineId, kind) => {
        stickyKind = kind;
        return { slotNumber: 7, evictedPoolMachineId: null };
      },
      release: async () => undefined,
    },
  });

  assert.equal(await lease.start(), true);
  assert.equal(stickyKind, "indonesia");
  assert.equal(lease.slot(), 7);
  await lease.stop();
});
