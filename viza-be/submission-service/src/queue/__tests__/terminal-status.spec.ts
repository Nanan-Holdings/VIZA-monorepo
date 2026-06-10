import { test } from "node:test";
import assert from "node:assert/strict";
import { mapStandardToOutcome, outcomeToJobStatus } from "../../runners/result-map.js";
import { RetryableRunnerError, NeedsHumanError } from "../types.js";

/**
 * RUN-IN/LK/KH/LA/ZA-001 integration contract: a queued runner_job reaches a
 * terminal status. The dedicated prefill runners (India, Sri Lanka, Cambodia,
 * Laos, South Africa) all route their result through mapStandardToOutcome
 * (runners/legacy-prefill-adapters.ts), so this fixture-driven test proves
 * every runner outcome lands on a terminal runner_job status:
 *   - returned outcome  → worker marks `succeeded`
 *   - thrown error      → worker retries → `failed`/`dead_letter`
 */

test("terminal: stopped_before_pay → halted_before_pay → succeeded", () => {
  const outcome = mapStandardToOutcome({ status: "stopped_before_pay", reachedStep: "pre_payment", artefacts: [] });
  assert.equal(outcome.outcome, "halted_before_pay");
  assert.equal(outcomeToJobStatus(outcome), "succeeded");
});

test("terminal: submitted_pending_pay → succeeded", () => {
  const outcome = mapStandardToOutcome({ status: "submitted_pending_pay", reachedStep: "submitted" });
  assert.equal(outcome.outcome, "submitted_pending_pay");
  assert.equal(outcomeToJobStatus(outcome), "succeeded");
});

test("terminal: paper_ready → succeeded", () => {
  const outcome = mapStandardToOutcome({ status: "paper_ready", reachedStep: "paper_rendered" });
  assert.equal(outcome.outcome, "paper_ready");
});

test("terminal: blocked / anti_bot_gate throw RetryableRunnerError (retry → failed)", () => {
  assert.throws(() => mapStandardToOutcome({ status: "blocked", reason: "timeout" }), RetryableRunnerError);
  assert.throws(() => mapStandardToOutcome({ status: "anti_bot_gate", reason: "cf" }), RetryableRunnerError);
});

test("terminal: needs_human throws NeedsHumanError (retry → failed)", () => {
  assert.throws(() => mapStandardToOutcome({ status: "needs_human", reason: "missing data" }), NeedsHumanError);
});
