import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TwDuplicateRunError } from "../errors.js";
import { assertTwPrepareGuard } from "../prepare-guard.js";

const NOW = Date.parse("2026-08-06T08:00:00.000Z");

function stoppedResult(handoffExpiresAt?: string): Record<string, unknown> {
  return {
    country: "TW",
    status: "stopped_at_captcha",
    ...(handoffExpiresAt ? { handoffExpiresAt } : {}),
  };
}

describe("Taiwan prepare duplicate-run guard", () => {
  it("allows an expired historical stopped-at-captcha result with no other active job", () => {
    assert.doesNotThrow(() => assertTwPrepareGuard({
      submissionResultStatus: "needs_user_action",
      submissionResult: stoppedResult("2026-08-06T07:00:00.000Z"),
      activeRunnerJobs: [],
      activeHandoffs: [{ expiresAt: "2026-08-06T07:00:00.000Z" }],
      nowMs: NOW,
    }));
  });

  it("allows a historical stopped-at-captcha result when no active handoff remains", () => {
    assert.doesNotThrow(() => assertTwPrepareGuard({
      submissionResultStatus: "needs_user_action",
      submissionResult: stoppedResult(),
      activeRunnerJobs: [],
      activeHandoffs: [],
      nowMs: NOW,
    }));
  });

  it("ignores the current running job but blocks any other active job", () => {
    assert.doesNotThrow(() => assertTwPrepareGuard({
      submissionResult: stoppedResult(),
      activeRunnerJobs: [{ id: "current-job" }],
      activeHandoffs: [],
      currentJobId: "current-job",
      nowMs: NOW,
    }));

    assert.throws(() => assertTwPrepareGuard({
      submissionResult: stoppedResult(),
      activeRunnerJobs: [{ id: "current-job" }, { id: "other-job" }],
      activeHandoffs: [],
      currentJobId: "current-job",
      nowMs: NOW,
    }), TwDuplicateRunError);
  });

  it("blocks an unexpired applicant handoff", () => {
    assert.throws(() => assertTwPrepareGuard({
      submissionResult: stoppedResult("2026-08-06T09:00:00.000Z"),
      activeRunnerJobs: [],
      activeHandoffs: [{ expiresAt: "2026-08-06T09:00:00.000Z" }],
      nowMs: NOW,
    }), TwDuplicateRunError);
  });

  it("always blocks an already submitted Taiwan result", () => {
    assert.throws(() => assertTwPrepareGuard({
      submissionResultStatus: "completed",
      submissionResult: { country: "TW", status: "submitted", officialReceipt: { caseNumber: "masked" } },
      activeRunnerJobs: [],
      activeHandoffs: [],
      nowMs: NOW,
    }), TwDuplicateRunError);
  });
});
