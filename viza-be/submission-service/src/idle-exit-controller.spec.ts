import assert from "node:assert/strict";
import test from "node:test";

import { IdleExitController } from "./idle-exit-controller.js";

test("idle exit requires two safe checks and no activity during recheck", async () => {
  let now = 0;
  let safeChecks = 0;
  let exits = 0;
  const controller = new IdleExitController({
    enabled: true,
    idleMs: 1_000,
    recheckMs: 1_000,
    checkIntervalMs: 60_000,
    now: () => now,
    isSafeToExit: async () => {
      safeChecks += 1;
      return true;
    },
    onExit: () => {
      exits += 1;
    },
  });

  controller.markReady();
  now = 1_000;
  await controller.evaluate();
  assert.equal(safeChecks, 1);
  assert.equal(controller.snapshot().state, "draining");

  controller.workStarted();
  controller.workFinished();
  await new Promise((resolve) => setTimeout(resolve, 1_050));
  assert.equal(exits, 0);

  now = 2_000;
  await controller.evaluate();
  await new Promise((resolve) => setTimeout(resolve, 1_050));
  assert.equal(safeChecks, 3);
  assert.equal(exits, 1);
});

test("unsafe authoritative check leaves the worker running", async () => {
  let now = 2_000;
  const controller = new IdleExitController({
    enabled: true,
    idleMs: 1_000,
    now: () => now,
    isSafeToExit: async () => false,
    onExit: () => assert.fail("must not exit"),
  });
  controller.markReady();
  now = 3_000;
  await controller.evaluate();
  assert.equal(controller.snapshot().state, "idle_grace");
  controller.stop();
});

