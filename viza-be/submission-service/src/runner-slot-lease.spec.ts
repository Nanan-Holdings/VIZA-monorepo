import { test } from "node:test";
import assert from "node:assert/strict";
import {
  acquireRunnerSlotWithRetry,
  parseRunnerSlotRenewal,
  RunnerSlotLease,
} from "./runner-slot-lease.js";

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
  let renewCalls = 0;
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
      renew: async () => {
        renewCalls += 1;
        return { slotNumber: 3, leaseUntil: new Date(Date.now() + 30_000) };
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
  assert.equal(reserveCalls, 1);
  assert.ok(renewCalls >= 1);
  assert.equal(releases, 1);
});

test("RunnerSlotLease reports an unhealthy authoritative lease loss", async () => {
  let renewCalls = 0;
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
        return 4;
      },
      renew: async () => {
        renewCalls += 1;
        return renewCalls === 1 ? null : null;
      },
      reserveSticky: async () => null,
      release: async () => undefined,
    },
  });

  assert.equal(await lease.start(), true);
  await new Promise((resolve) => setTimeout(resolve, 12));
  assert.equal(lost, 1);
  assert.equal(lease.isHealthy(), false);
  assert.equal(lease.slot(), null);
  await lease.stop();
});

test("RunnerSlotLease fails closed when renewal returns a different slot", async () => {
  let renewCalls = 0;
  let lost = 0;
  const lease = new RunnerSlotLease({
    machineId: "pool-machine-slot-mismatch",
    kind: "pool",
    renewEveryMs: 1,
    onLeaseLost: () => {
      lost += 1;
    },
    rpc: {
      reserve: async () => 4,
      renew: async () => {
        renewCalls += 1;
        return {
          slotNumber: 5,
          leaseUntil: new Date(Date.now() + 30_000),
        };
      },
      reserveSticky: async () => null,
      release: async () => undefined,
    },
  });

  assert.equal(await lease.start(), true);
  await new Promise((resolve) => setTimeout(resolve, 20));
  const callsAfterLoss = renewCalls;
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.equal(lost, 1);
  assert.equal(lease.isHealthy(), false);
  assert.equal(lease.slot(), null);
  assert.equal(renewCalls, callsAfterLoss);
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
      renew: async () => {
        throw new Error("pool renewal must not be used");
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

test("RunnerSlotLease renews the exact slot through the dedicated RPC and never re-reserves", async () => {
  const calls: string[] = [];
  let renewCount = 0;
  const lease = new RunnerSlotLease({
    machineId: "pool-machine-3",
    kind: "pool",
    renewEveryMs: 5,
    rpc: {
      reserve: async () => {
        calls.push("reserve");
        return 2;
      },
      renew: async (machineId, kind, leaseSeconds) => {
        calls.push(`renew:${machineId}:${kind}:${leaseSeconds}`);
        renewCount += 1;
        return {
          slotNumber: 2,
          leaseUntil: new Date(Date.now() + 30_000),
        };
      },
      reserveSticky: async () => null,
      release: async () => undefined,
    },
  });

  assert.equal(await lease.start(), true);
  await new Promise((resolve) => setTimeout(resolve, 15));
  await lease.stop();

  assert.equal(calls[0], "reserve");
  assert.ok(renewCount >= 1);
  assert.ok(calls.slice(1).every((call) => call.startsWith("renew:")));
});

test("RunnerSlotLease reports three consecutive temporary renewal failures without reacquiring", async () => {
  let reserveCalls = 0;
  let renewCalls = 0;
  const failures: number[] = [];
  let lost = 0;
  const lease = new RunnerSlotLease({
    machineId: "pool-machine-4",
    kind: "pool",
    renewEveryMs: 5,
    onLeaseLost: () => {
      lost += 1;
    },
    onRenewalFailure: (_error, consecutiveFailures) => {
      failures.push(consecutiveFailures);
    },
    rpc: {
      reserve: async () => {
        reserveCalls += 1;
        return 8;
      },
      renew: async () => {
        renewCalls += 1;
        throw new Error("temporary RPC failure");
      },
      reserveSticky: async () => null,
      release: async () => undefined,
    },
  });

  assert.equal(await lease.start(), true);
  await new Promise((resolve) => setTimeout(resolve, 45));
  await lease.stop();

  assert.equal(reserveCalls, 1);
  assert.ok(renewCalls >= 3);
  assert.deepEqual(failures.slice(0, 3), [1, 2, 3]);
  assert.equal(lost, 0);
  assert.equal(lease.slot(), null);
});

test("parseRunnerSlotRenewal accepts one exact row and rejects malformed schemas", () => {
  const parsed = parseRunnerSlotRenewal([{
    slot_number: 2,
    lease_until: "2026-08-20T16:00:00.000Z",
  }]);
  assert.equal(parsed?.slotNumber, 2);
  assert.equal(parsed?.leaseUntil.toISOString(), "2026-08-20T16:00:00.000Z");
  assert.equal(parseRunnerSlotRenewal([]), null);
  assert.throws(
    () => parseRunnerSlotRenewal([{
      slot_number: 2,
      lease_until: "not-a-date",
    }]),
    /invalid lease timestamp/i,
  );
  assert.throws(
    () => parseRunnerSlotRenewal([
      { slot_number: 1, lease_until: "2026-08-20T16:00:00.000Z" },
      { slot_number: 2, lease_until: "2026-08-20T16:00:00.000Z" },
    ]),
    /expected at most one/i,
  );
});
