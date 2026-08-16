import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TwDuplicateRunError } from "../errors.js";
import { assertTwPrepareGuard } from "../prepare-guard.js";

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
    }));
  });

  it("allows a historical stopped-at-captcha result when no active handoff remains", () => {
    assert.doesNotThrow(() => assertTwPrepareGuard({
      submissionResultStatus: "needs_user_action",
      submissionResult: stoppedResult(),
      activeRunnerJobs: [],
    }));
  });

  it("ignores the current running job but blocks any other active job", () => {
    assert.doesNotThrow(() => assertTwPrepareGuard({
      submissionResult: stoppedResult(),
      activeRunnerJobs: [{ id: "current-job" }],
      currentJobId: "current-job",
    }));

    assert.throws(() => assertTwPrepareGuard({
      submissionResult: stoppedResult(),
      activeRunnerJobs: [{ id: "current-job" }, { id: "other-job" }],
      currentJobId: "current-job",
    }), TwDuplicateRunError);
  });

  it("does not let a historical applicant handoff block the formal submit path", () => {
    assert.doesNotThrow(() => assertTwPrepareGuard({
      submissionResult: stoppedResult("2026-08-06T09:00:00.000Z"),
      activeRunnerJobs: [],
    }));
  });

  it("always blocks an already submitted Taiwan result", () => {
    assert.throws(() => assertTwPrepareGuard({
      submissionResultStatus: "completed",
      submissionResult: { country: "TW", status: "submitted", officialReceipt: { caseNumber: "masked" } },
      activeRunnerJobs: [],
    }), TwDuplicateRunError);
  });
});
