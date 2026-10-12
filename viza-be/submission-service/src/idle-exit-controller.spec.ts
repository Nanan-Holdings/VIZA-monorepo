import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { IdleExitController, runIdleTrackedDrain } from "./idle-exit-controller.js";

test("automatic email drain refreshes idle activity only for queued work", async () => {
  let activityNotes = 0;
  let drainCalls = 0;
  const noteActivity = () => { activityNotes += 1; };

  const emptyResult = await runIdleTrackedDrain(async () => {
    drainCalls += 1;
    return 0;
  }, noteActivity);
  assert.equal(emptyResult, 0);
  assert.equal(drainCalls, 1);
  assert.equal(activityNotes, 0);

  const queuedResult = await runIdleTrackedDrain(async () => 2, noteActivity);
  assert.equal(queuedResult, 2);
  assert.equal(activityNotes, 1);

  await assert.rejects(
    () => runIdleTrackedDrain(async () => { throw new Error("drain unavailable"); }, noteActivity),
    /drain unavailable/,
  );
  assert.equal(activityNotes, 1);
});

test("empty email polls preserve idle exit while an in-flight drain blocks shutdown", async () => {
  let now = 0;
  let pollInFlight = false;
  let safeChecks = 0;
  let exits = 0;
  const controller = new IdleExitController({
    enabled: true, idleMs: 1_000, recheckMs: 1_000, now: () => now,
    isSafeToExit: async () => { safeChecks += 1; return !pollInFlight; },
    onExit: () => { exits += 1; },
  });
  controller.markReady();
  try {
    for (const pollTime of [400, 800, 1_200]) {
      now = pollTime;
      await runIdleTrackedDrain(async () => 0, () => controller.noteActivity());
    }
    assert.equal(controller.snapshot().idleSince, new Date(0).toISOString());
    pollInFlight = true;
    await controller.evaluate();
    assert.equal(controller.snapshot().state, "idle_grace");
    assert.equal(exits, 0);
    pollInFlight = false;
    await controller.evaluate();
    assert.equal(controller.snapshot().state, "draining");
    now = 1_600;
    await runIdleTrackedDrain(async () => 0, () => controller.noteActivity());
    await new Promise(resolve => setTimeout(resolve, 1_050));
    assert.equal(safeChecks, 3);
    assert.equal(exits, 1);
  } finally { controller.stop(); }
});

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

test("shared runner-job consumers keep the Machine awake for unfiltered queued work", () => {
  const indexSource = readFileSync(path.join(__dirname, "index.ts"), "utf8");
  const availabilitySource = readFileSync(path.join(__dirname, "work-availability.ts"), "utf8");

  assert.match(
    indexSource,
    /RUNNER_JOB_CONSUMER_ENABLED\s*&&\s*await hasCountryRunnerWork\(RUNNER_JOB_COUNTRY \|\| undefined\)/,
  );
  assert.match(availabilitySource, /hasCountryRunnerWork\(country\?: string\)/);
  assert.match(availabilitySource, /if \(country\) query = query\.eq\("country", country\)/);
});
