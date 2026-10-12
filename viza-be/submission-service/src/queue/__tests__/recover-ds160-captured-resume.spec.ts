import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  CAPTURED_RESUME_BLOCKED_STAGE,
  CAPTURED_RESUME_BLOCKED_STATUS,
  CAPTURED_RESUME_PENDING_STATUS,
  CAPTURED_RESUME_QUEUED_STAGE,
  evaluateCapturedResumeRecovery,
  parseCapturedResumeRecoveryArgs,
  transitionCapturedResumeQueue,
  type CapturedResumeRecoverySnapshot,
  type CapturedResumeQueueRow,
  type RecoveryMutationClient,
  type RecoveryUpdateBuilder,
} from "../captured-resume-recovery";

const APPLICATION_ID = "17691f09-6eb8-446b-9bda-cca54068ed3b";
const JOB_ID = "2f4618d1-1804-4c9a-bfe9-bddaa9f46fce";

function checkpointQueueRow(): CapturedResumeQueueRow {
  return {
    id: JOB_ID,
    application_id: APPLICATION_ID,
    status: CAPTURED_RESUME_BLOCKED_STATUS,
    current_stage: CAPTURED_RESUME_BLOCKED_STAGE,
    mode: "live_assisted",
    provider: "ceac_live",
    attempts: 0,
    locked_by: null,
    locked_at: null,
    locked_until: null,
    official_application_id_encrypted: "cipher-application-id",
    official_security_question_encrypted: "cipher-security-question",
    official_security_answer_encrypted: "cipher-security-answer",
    official_confirmation_number_encrypted: null,
    official_confirmation_page_url: null,
    live_submitted_at: null,
  };
}

function validSnapshot(): CapturedResumeRecoverySnapshot {
  return {
    application: {
      id: APPLICATION_ID,
      country: "united_states",
      visa_type: "DS160",
      // This marker is stale in the incident under recovery. It is not itself
      // official evidence and must not block the captured-resume path.
      status: "submitted",
      ds160_application_id: "AA12345678",
      submission_result_status: "action_required",
      submission_result: { country: "GENERIC", status: "action_required" },
    },
    queueRows: [checkpointQueueRow()],
    finalFenceRows: [],
    submissionJobRows: [],
  };
}

const decryptFixture = (ciphertext: string): string => ({
  "cipher-application-id": "AA12345678",
  "cipher-security-question": "What is your favorite color?",
  "cipher-security-answer": "Blue",
}[ciphertext] ?? "");

test("captured-resume command defaults to a read-only exact job/app preflight", () => {
  assert.deepEqual(
    parseCapturedResumeRecoveryArgs([
      `--application-id=${APPLICATION_ID}`,
      `--job-id=${JOB_ID}`,
    ]),
    { applicationId: APPLICATION_ID, jobId: JOB_ID, execute: false },
  );
  assert.throws(
    () => parseCapturedResumeRecoveryArgs([`--application-id=${APPLICATION_ID}`]),
    /--job-id must be an explicit UUID/,
  );
});

test("preflight accepts the captured checkpoint while ignoring a stale generic submitted marker", () => {
  const report = evaluateCapturedResumeRecovery(
    validSnapshot(),
    APPLICATION_ID,
    JOB_ID,
    decryptFixture,
  );
  assert.equal(report.ok, true);
  assert.deepEqual(report.blockers, []);
  assert.equal(report.queue.checkpointComplete, true);
  assert.equal(report.queue.finalFenceRows, 0);
});

test("preflight blocks an existing final fence, official success, or active sibling job", () => {
  const snapshot = validSnapshot();
  snapshot.finalFenceRows = [{ id: "attempt-id", state: "unknown" }];
  snapshot.queueRows.push({
    id: "00000000-0000-4000-8000-000000000001",
    application_id: APPLICATION_ID,
    status: "ds160_live_assisted_processing",
    locked_by: "worker",
    locked_until: "2099-01-01T00:00:00.000Z",
  });
  snapshot.application!.submission_result = { country: "US", status: "submitted" };

  const report = evaluateCapturedResumeRecovery(
    snapshot,
    APPLICATION_ID,
    JOB_ID,
    decryptFixture,
  );
  assert.equal(report.ok, false);
  assert.ok(report.blockers.includes("official_success_already_recorded"));
  assert.ok(report.blockers.includes("checkpoint_final_submission_fence_blocked"));
  assert.ok(report.blockers.includes("conflicting_active_queue_job"));
});

test("conditional transition preserves encrypted checkpoint fields and clears only queue recovery state", async () => {
  let patch: Record<string, unknown> | null = null;
  const filters: string[] = [];
  const builder: RecoveryUpdateBuilder = {
    eq(column, value) {
      filters.push(`eq:${column}=${String(value)}`);
      return builder;
    },
    is(column, value) {
      filters.push(`is:${column}=${String(value)}`);
      return builder;
    },
    select() {
      return builder;
    },
    async maybeSingle() {
      return {
        data: { id: JOB_ID, status: CAPTURED_RESUME_PENDING_STATUS, current_stage: CAPTURED_RESUME_QUEUED_STAGE },
        error: null,
      };
    },
  };
  const client: RecoveryMutationClient = {
    from(table) {
      assert.equal(table, "submission_queue");
      return {
        update(values) {
          patch = values;
          return builder;
        },
      };
    },
  };

  const queue = checkpointQueueRow();
  await transitionCapturedResumeQueue(client, queue, APPLICATION_ID, JOB_ID);
  const updatedPatch = patch as Record<string, unknown> | null;
  const updatedAt = updatedPatch?.updated_at;
  assert.equal(typeof updatedAt, "string");
  assert.deepEqual(patch, {
    status: CAPTURED_RESUME_PENDING_STATUS,
    current_stage: CAPTURED_RESUME_QUEUED_STAGE,
    last_error: null,
    error_code: null,
    error_message: null,
    locked_by: null,
    locked_at: null,
    locked_until: null,
    updated_at: updatedAt,
  });
  assert.ok(filters.includes("eq:official_application_id_encrypted=cipher-application-id"));
  assert.ok(filters.includes("eq:official_security_question_encrypted=cipher-security-question"));
  assert.ok(filters.includes("eq:official_security_answer_encrypted=cipher-security-answer"));
  assert.ok(filters.includes("is:official_confirmation_number_encrypted=null"));
});

test("conditional transition treats a zero-row result as a concurrent race", async () => {
  const builder: RecoveryUpdateBuilder = {
    eq: () => builder,
    is: () => builder,
    select: () => builder,
    async maybeSingle() {
      return { data: null, error: null };
    },
  };
  const client: RecoveryMutationClient = {
    from: () => ({ update: () => builder }),
  };
  await assert.rejects(
    () => transitionCapturedResumeQueue(client, checkpointQueueRow(), APPLICATION_ID, JOB_ID),
    /conditional race/,
  );
});

test("recovery relies on the existing one-active-job database fence", async () => {
  const migration = await readFile(
    resolve(process.cwd(), "..", "agent-backend", "drizzle", "0119_submission_retry_queue_isolation.sql"),
    "utf8",
  );
  assert.match(migration, /submission_queue_one_active_job_per_application_idx/);
  assert.match(migration, /ON public\.submission_queue\(application_id\)/);
  assert.match(migration, /status IN \('pending', 'processing', 'france_live_official_portal_opened'\)/);
  assert.match(migration, /status LIKE '%pending'/);
  assert.match(migration, /status LIKE '%processing'/);
  assert.match(migration, /status LIKE '%scheduled'/);
});
