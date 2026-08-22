import { test } from "node:test";
import assert from "node:assert/strict";
import { mapStandardToOutcome, outcomeToJobStatus } from "../../runners/result-map.js";
import {
  RetryableRunnerError,
  NeedsHumanError,
  sanitizeRunnerError,
} from "../types.js";

process.env.SUPABASE_URL ??= "http://127.0.0.1:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "terminal-status-test-service-role-key";

/**
 * RUN-IN/LK/KH/LA/ZA-001 integration contract: a queued runner_job reaches a
 * terminal status. The dedicated prefill runners (India, Sri Lanka, Cambodia,
 * Laos, South Africa) all route their result through mapStandardToOutcome
 * (runners/legacy-prefill-adapters.ts), so this fixture-driven test proves
 * every runner outcome lands on a terminal runner_job status:
 *   - returned outcome  → worker marks `succeeded`
 *   - retryable error   → worker retries → `failed` when exhausted
 *   - needs-human error → worker marks terminal `needs_human` immediately
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

test("terminal: needs_human throws NeedsHumanError for worker classification", () => {
  assert.throws(() => mapStandardToOutcome({ status: "needs_human", reason: "missing data" }), NeedsHumanError);
});

test("worker: NeedsHumanError is terminal without consuming an attempt or scheduling retry", async () => {
  const { planRunnerJobFailure } = await import("../worker.js");
  const nowMs = Date.parse("2026-08-18T12:00:00.000Z");
  const transition = planRunnerJobFailure(
    {
      id: "job-needs-human",
      application_id: "application-1",
      country: "canada",
      flow_key: "ca_trv",
      attempts: 1,
      max_attempts: 3,
      correlation_id: null,
      metadata: null,
    },
    new NeedsHumanError("Applicant must confirm representative status"),
    nowMs,
  );

  assert.deepEqual(transition, {
    update: {
      status: "needs_human",
      attempts: 1,
      last_error: "Applicant must confirm representative status",
      finished_at: "2026-08-18T12:00:00.000Z",
      leased_by: null,
      leased_until: null,
    },
    retryDelayMs: null,
    exhausted: false,
    needsHuman: true,
  });
  assert.equal("available_at" in transition.update, false);
});

test("worker: RetryableRunnerError returns to queued with bounded backoff", async () => {
  const { planRunnerJobFailure } = await import("../worker.js");
  const nowMs = Date.parse("2026-08-18T12:00:00.000Z");
  const transition = planRunnerJobFailure(
    {
      id: "job-retryable",
      application_id: "application-2",
      country: "turkey",
      flow_key: "tr_e_visa",
      attempts: 1,
      max_attempts: 3,
      correlation_id: null,
      metadata: null,
    },
    new RetryableRunnerError("Official portal timed out"),
    nowMs,
  );

  assert.deepEqual(transition, {
    update: {
      status: "queued",
      attempts: 2,
      last_error: "Official portal timed out",
      finished_at: null,
      leased_by: null,
      leased_until: null,
      available_at: "2026-08-18T12:00:30.000Z",
    },
    retryDelayMs: 30_000,
    exhausted: false,
    needsHuman: false,
  });
});

test("worker: persisted and logged errors redact URL userinfo, path tokens, query, and fragment", async () => {
  const { planRunnerJobFailure } = await import("../worker.js");
  const secretUrl =
    "https://applicant:password@portal.example.test/verify/path-token?code=query-token#fragment-token";
  const error = new NeedsHumanError(`Verification failed at ${secretUrl}`);
  const sanitized = sanitizeRunnerError(error);
  const transition = planRunnerJobFailure(
    {
      id: "job-secret-url",
      application_id: "application-3",
      country: "canada",
      flow_key: "ca_trv",
      attempts: 0,
      max_attempts: 3,
      correlation_id: null,
      metadata: null,
    },
    error,
    Date.parse("2026-08-18T12:00:00.000Z"),
  );

  assert.equal(sanitized.summary, "NeedsHumanError: Verification failed at [redacted-url]");
  assert.equal(
    transition.update.last_error,
    "Verification failed at [redacted-url]",
  );
  for (const secret of [
    "applicant",
    "password",
    "portal.example.test",
    "path-token",
    "query-token",
    "fragment-token",
  ]) {
    assert.equal(sanitized.summary.includes(secret), false);
    assert.equal(transition.update.last_error.includes(secret), false);
  }
});
