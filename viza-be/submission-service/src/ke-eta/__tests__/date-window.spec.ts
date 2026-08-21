import assert from "node:assert/strict";
import test from "node:test";
import { computeKeEtaSchedule } from "../date-window";

test("schedules remote Kenya eTA fourteen days before arrival", () => {
  const decision = computeKeEtaSchedule("2026-09-30", new Date("2026-08-20T00:00:00.000Z"));
  assert.equal(decision.status, "scheduled");
  assert.equal(decision.submitAt?.slice(0, 10), "2026-09-16");
});

test("opens Kenya eTA window when arrival is near", () => {
  const decision = computeKeEtaSchedule("2026-09-30", new Date("2026-09-20T00:00:00.000Z"));
  assert.equal(decision.status, "ready");
});
