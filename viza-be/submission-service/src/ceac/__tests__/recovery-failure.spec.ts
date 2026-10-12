import assert from "node:assert/strict";
import test from "node:test";
import { withDs160RecoveryFailure } from "../recovery-failure";

test("replaces stale bootstrap reason while preserving draft recovery metadata", () => {
  const result = withDs160RecoveryFailure(
    {
      reason: "Old mode error",
      error: { name: "OldError", message: "old-sensitive-error" },
      currentFailure: { runId: "old-run", message: "old-sensitive-failure" },
      stack: "old-sensitive-stack",
      context: { secret: "old-sensitive-context" },
      gateContext: { secret: "old-sensitive-gate-context" },
      recovery: { state: "application_captured" },
    },
    new Error("Failed to load CEAC start page within 60000ms"), "current-run",
  );
  assert.equal(result.reason, "Failed to load CEAC start page within 60000ms");
  assert.deepEqual(result.recovery, { state: "application_captured" });
  assert.equal(result.status, "action_required");
  assert.equal((result.currentFailure as Record<string, unknown>).runId, "current-run");
  for (const key of ["stack", "context", "gateContext"]) {
    assert.equal(Object.prototype.hasOwnProperty.call(result, key), false);
  }
  const serialized = JSON.stringify(result);
  for (const secret of ["OldError", "old-sensitive-error", "old-run", "old-sensitive-failure", "old-sensitive-stack", "old-sensitive-context", "old-sensitive-gate-context"]) {
    assert.equal(serialized.includes(secret), false);
  }
});

test("serialized orchestration failures omit secrets, answers, URLs and raw context", () => {
  const result = withDs160RecoveryFailure(null, {
    name: "NavigationError",
    message: 'Failed XIAOMING token-secret at wss://host/path?key=secret and https://host/private "answer"',
    context: { password: "never-copy-this" }, stack: "never-copy-stack",
  }, "run", ["XIAOMING", "token-secret"]);
  const text = JSON.stringify(result);
  for (const secret of ["XIAOMING", "token-secret", "wss://", "https://", "never-copy", '"answer"']) {
    assert.equal(text.includes(secret), false);
  }
  assert.deepEqual(Object.keys(result.error as object).sort(), ["message", "name"]);
});
