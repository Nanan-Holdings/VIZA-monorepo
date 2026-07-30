import { test } from "node:test";
import assert from "node:assert/strict";
import { RunnerSlotLease } from "./runner-slot-lease.js";

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
