import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHaltedStuckAlert } from "../dispatch.js";

/** OBSV-002: halted-stuck alert payload shape. */
test("buildHaltedStuckAlert: warn severity + per-country routing class", () => {
  const alert = buildHaltedStuckAlert({
    country: "indonesia",
    jobId: "abcdef12-3456",
    applicationId: "app-1",
    ageHours: 48,
  });
  assert.equal(alert.severity, "warn");
  assert.equal(alert.class, "runner.halted_stuck.indonesia");
  assert.equal(alert.applicationId, "app-1");
  assert.match(alert.body, /48h/);
  assert.ok((alert.throttleSeconds ?? 0) > 0);
});
