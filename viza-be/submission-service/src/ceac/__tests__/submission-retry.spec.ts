import assert from "node:assert/strict";
import { test } from "node:test";
import {
  classifyDs160RetryFailure,
  loadDs160RetryPlan,
  type Ds160RetryQueueSnapshot,
  type Ds160RetryReadClient,
} from "../submission-retry";

const APPLICATION_UUID = "application-1";
const CEAC_ID = "AA00FHOZ99";

type DbResult = { data: unknown; error: { message?: string | null } | null };

class FakeQuery implements PromiseLike<DbResult> {
  private readonly table: string;
  private readonly tables: Record<string, unknown>;
  private readonly errors: Record<string, { message?: string | null } | null>;
  private filters: Record<string, string> = {};

  constructor(
    table: string,
    tables: Record<string, unknown>,
    errors: Record<string, { message?: string | null } | null>,
  ) {
    this.table = table;
    this.tables = tables;
    this.errors = errors;
  }

  select(_columns: string): FakeQuery {
    return this;
  }

  eq(column: string, value: string): FakeQuery {
    this.filters[column] = value;
    return this;
  }

  limit(_count: number): FakeQuery {
    return this;
  }

  maybeSingle(): Promise<DbResult> {
    const result = this.result();
    if (Array.isArray(result.data)) {
      return Promise.resolve({
        data: result.data.length === 1 ? result.data[0] : null,
        error: result.error,
      });
    }
    return Promise.resolve(result);
  }

  then<TResult1 = DbResult, TResult2 = never>(
    onfulfilled?:
      ((value: DbResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.result()).then(onfulfilled, onrejected);
  }

  private result(): DbResult {
    const error = this.errors[this.table] ?? null;
    if (error) return { data: null, error };
    const value = this.tables[this.table];
    if (this.table !== "submission_queue" || !Array.isArray(value)) {
      return { data: value ?? null, error: null };
    }
    return {
      data: value.filter((row) => {
        if (!row || typeof row !== "object") return false;
        return (
          (row as Record<string, unknown>).application_id ===
          this.filters.application_id
        );
      }),
      error: null,
    };
  }
}

function client(
  tables: Record<string, unknown>,
  errors: Record<string, { message?: string | null } | null> = {},
): Ds160RetryReadClient {
  return {
    from(table: string) {
      return new FakeQuery(table, tables, errors);
    },
  };
}

function decrypt(ciphertext: string): string {
  const values: Record<string, string> = {
    application: CEAC_ID,
    other: "AA00FHOZ98",
    question: "What was your first school?",
    answer: "Example School",
  };
  const key = ciphertext.replace("cipher-", "");
  const value = values[key];
  if (!value) throw new Error("ciphertext unavailable");
  return value;
}

function checkpoint(
  overrides: Partial<Ds160RetryQueueSnapshot> = {},
): Ds160RetryQueueSnapshot {
  return {
    id: "queue-old",
    application_id: APPLICATION_UUID,
    status: "ds160_live_assisted_failed",
    official_application_id_encrypted: "cipher-application",
    official_security_question_encrypted: "cipher-question",
    official_security_answer_encrypted: "cipher-answer",
    updated_at: "2026-09-28T10:00:00.000Z",
    ...overrides,
  };
}

function application(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    ds160_application_id: CEAC_ID,
    submission_result: null,
    ...overrides,
  };
}

async function plan(
  tables: Record<string, unknown>,
  currentQueue: Ds160RetryQueueSnapshot | null = null,
  errors: Record<string, { message?: string | null } | null> = {},
) {
  return loadDs160RetryPlan(
    client(tables, errors),
    APPLICATION_UUID,
    currentQueue,
    decrypt,
  );
}

test("creates a fresh plan only when no application identity or prior checkpoint exists", async () => {
  const result = await plan({
    applications: application({ ds160_application_id: null }),
    ds160_final_submission_attempts: [],
    submission_queue: [],
  });
  assert.deepEqual(result, {
    kind: "fresh",
    reason: "no_prior_official_application",
  });

  const dryRunResult = await plan({
    applications: application({
      ds160_application_id: null,
      submission_result: {
        country: "GENERIC",
        targetCountry: "US",
        visaType: "DS160",
        status: "unsupported",
        mode: "dry_run",
        applicationId: APPLICATION_UUID,
      },
    }),
    ds160_final_submission_attempts: [],
    submission_queue: [
      {
        id: "queue-dry-run",
        application_id: APPLICATION_UUID,
        status: "ds160_prefill_failed",
        ceac_result_payload: {
          country: "GENERIC",
          status: "unsupported",
          mode: "dry_run",
          applicationId: APPLICATION_UUID,
        },
      },
    ],
  });
  assert.deepEqual(dryRunResult, {
    kind: "fresh",
    reason: "no_prior_official_application",
  });
});

test("resumes a complete checkpoint from the current queue row", async () => {
  const result = await plan(
    {
      applications: application(),
      ds160_final_submission_attempts: [],
      submission_queue: [checkpoint()],
    },
    checkpoint(),
  );
  assert.deepEqual(result, {
    kind: "resume",
    reason: "captured_application_checkpoint",
    checkpoint: {
      applicationId: CEAC_ID,
      securityQuestionText: "What was your first school?",
      securityAnswer: "Example School",
    },
  });
});

test("finds the latest same-application checkpoint when a new retry row is empty", async () => {
  const result = await plan(
    {
      applications: application(),
      ds160_final_submission_attempts: [],
      submission_queue: [checkpoint()],
    },
    {
      id: "queue-new",
      application_id: APPLICATION_UUID,
      status: "ds160_live_assisted_pending",
    },
  );
  assert.equal(result.kind, "resume");
  if (result.kind === "resume")
    assert.equal(result.checkpoint.applicationId, CEAC_ID);
});

test("does not bypass a partial current checkpoint in favor of an older valid row", async () => {
  const result = await plan(
    {
      applications: application(),
      ds160_final_submission_attempts: [],
      submission_queue: [
        checkpoint({
          id: "queue-old",
          updated_at: "2026-09-28T12:00:00.000Z",
        }),
      ],
    },
    {
      id: "queue-current",
      application_id: APPLICATION_UUID,
      status: "ds160_live_assisted_pending",
      official_application_id_encrypted: "cipher-application",
      official_security_question_encrypted: "cipher-question",
      updated_at: "2026-09-28T11:00:00.000Z",
    },
  );
  assert.deepEqual(result, {
    kind: "recover",
    reason: "checkpoint_incomplete",
  });
});

test("routes stored official success and historical queue success to recovery", async () => {
  const appResult = await plan({
    applications: application({
      submission_result_status: "submitted",
      submission_result: { country: "US", status: "submitted" },
    }),
    ds160_final_submission_attempts: [],
    submission_queue: [checkpoint()],
  });
  assert.deepEqual(appResult, {
    kind: "recover",
    reason: "official_submission_already_recorded",
  });

  const queueResult = await plan({
    applications: application(),
    ds160_final_submission_attempts: [],
    submission_queue: [
      checkpoint({
        status: "ds160_submitted",
        live_submitted_at: "2026-09-28T11:00:00Z",
      }),
    ],
  });
  assert.deepEqual(queueResult, {
    kind: "recover",
    reason: "historical_official_submission_detected",
  });
});

test("does not treat a saved .dat artifact as official submission proof", async () => {
  const result = await plan({
    applications: application({
      ds160_dat_storage_path: "private/app/application.dat",
    }),
    ds160_final_submission_attempts: [],
    submission_queue: [checkpoint()],
  });
  assert.equal(result.kind, "resume");
});

test("treats an empty legacy .dat path as absent optional metadata", async () => {
  const result = await plan({
    applications: application({ ds160_dat_storage_path: "" }),
    ds160_final_submission_attempts: [],
    submission_queue: [checkpoint()],
  });
  assert.equal(result.kind, "resume");
});

test("routes partial, mismatched, and undecryptable checkpoints to recovery", async () => {
  const partial = await plan({
    applications: application(),
    ds160_final_submission_attempts: [],
    submission_queue: [
      checkpoint({ official_security_answer_encrypted: null }),
    ],
  });
  assert.deepEqual(partial, {
    kind: "recover",
    reason: "checkpoint_incomplete",
  });

  const mismatch = await plan({
    applications: application(),
    ds160_final_submission_attempts: [],
    submission_queue: [
      checkpoint({ official_application_id_encrypted: "cipher-other" }),
    ],
  });
  assert.deepEqual(mismatch, {
    kind: "recover",
    reason: "application_id_mismatch",
  });

  const undecryptable = await plan({
    applications: application(),
    ds160_final_submission_attempts: [],
    submission_queue: [
      checkpoint({ official_security_answer_encrypted: "cipher-missing" }),
    ],
  });
  assert.deepEqual(undecryptable, {
    kind: "recover",
    reason: "checkpoint_decryption_failed",
  });
});

test("allows a fresh attempt after generic dry-run or live-mode results", async () => {
  const result = await plan({
    applications: application({
      ds160_application_id: null,
      submission_result: {
        country: "GENERIC",
        targetCountry: "US",
        visaType: "DS160",
        status: "action_required",
        mode: "live_assisted",
        applicationId: APPLICATION_UUID,
        actionType: "live_mode_config",
      },
    }),
    ds160_final_submission_attempts: [],
    submission_queue: [
      {
        id: "queue-live-disabled",
        application_id: APPLICATION_UUID,
        status: "ds160_blocked",
        ceac_result_payload: {
          status: "blocked_by_config",
          mode: "live_assisted",
          country: "GENERIC",
          applicationId: APPLICATION_UUID,
        },
      },
    ],
  });
  assert.deepEqual(result, {
    kind: "fresh",
    reason: "no_prior_official_application",
  });
});

test("fails closed on malformed identity and final-recovery metadata", async () => {
  const malformedId = await plan({
    applications: application({ ds160_application_id: 123 }),
    ds160_final_submission_attempts: [],
    submission_queue: [],
  });
  assert.deepEqual(malformedId, {
    kind: "recover",
    reason: "application_id_invalid",
  });

  const malformedOfficialResult = await plan({
    applications: application({
      ds160_application_id: null,
      submission_result: {
        country: "US",
        status: "action_required",
      },
    }),
    ds160_final_submission_attempts: [],
    submission_queue: [],
  });
  assert.deepEqual(malformedOfficialResult, {
    kind: "recover",
    reason: "application_id_invalid",
  });

  const finalRecoveryResult = await plan({
    applications: application({
      ds160_application_id: null,
      submission_result: {
        country: "GENERIC",
        targetCountry: "US",
        visaType: "DS160",
        status: "action_required",
        actionType: "final_submission_recovery",
      },
    }),
    ds160_final_submission_attempts: [],
    submission_queue: [],
  });
  assert.deepEqual(finalRecoveryResult, {
    kind: "recover",
    reason: "application_id_invalid",
  });

  const capturedWithoutCheckpoint = await plan({
    applications: application({ ds160_application_id: null }),
    ds160_final_submission_attempts: [],
    submission_queue: [
      {
        id: "queue-captured",
        application_id: APPLICATION_UUID,
        status: "ds160_live_assisted_failed",
        ceac_result_payload: {
          status: "action_required",
          recovery: { status: "application_captured" },
        },
      },
    ],
  });
  assert.deepEqual(capturedWithoutCheckpoint, {
    kind: "recover",
    reason: "application_id_invalid",
  });

  const malformedQueueMetadata = await plan({
    applications: application({ ds160_application_id: null }),
    ds160_final_submission_attempts: [],
    submission_queue: [
      {
        id: "queue-history",
        application_id: APPLICATION_UUID,
        status: "ds160_live_assisted_failed",
        ceac_result_payload: [],
      },
    ],
  });
  assert.deepEqual(malformedQueueMetadata, {
    kind: "recover",
    reason: "queue_history_read_failed",
  });

  const unknownRecovery = await plan({
    applications: application({ ds160_application_id: null }),
    ds160_final_submission_attempts: [],
    submission_queue: [
      {
        id: "queue-unknown-recovery",
        application_id: APPLICATION_UUID,
        status: "ds160_live_assisted_failed",
        ceac_result_payload: {
          status: "action_required",
          recovery: { status: "unknown" },
        },
      },
    ],
  });
  assert.deepEqual(unknownRecovery, {
    kind: "recover",
    reason: "queue_history_read_failed",
  });
});

test("fails closed when the queue history is truncated or associated with another application", async () => {
  const rows = Array.from({ length: 1000 }, (_, index) => ({
    id: `queue-${index}`,
    application_id: APPLICATION_UUID,
  }));
  const truncated = await plan({
    applications: application({ ds160_application_id: null }),
    ds160_final_submission_attempts: [],
    submission_queue: rows,
  });
  assert.deepEqual(truncated, {
    kind: "recover",
    reason: "queue_history_read_failed",
  });

  const mismatchedCurrent = await plan(
    {
      applications: application({ ds160_application_id: null }),
      ds160_final_submission_attempts: [],
      submission_queue: [],
    },
    { id: "queue-current", application_id: "other-application" },
  );
  assert.deepEqual(mismatchedCurrent, {
    kind: "recover",
    reason: "current_queue_application_mismatch",
  });
});

test("routes any final submission fence state to recovery before resume", async () => {
  for (const state of ["started", "unknown", "confirmed"]) {
    const result = await plan({
      applications: application(),
      ds160_final_submission_attempts: [{ id: "attempt-1", state }],
      submission_queue: [checkpoint()],
    });
    assert.deepEqual(result, {
      kind: "recover",
      reason: "final_submission_fence_present",
    });
  }
});

test("fails closed on application, fence, and queue history read errors", async () => {
  assert.deepEqual(
    await plan({}, null, { applications: { message: "database unavailable" } }),
    { kind: "recover", reason: "application_read_failed" },
  );
  assert.deepEqual(
    await plan({ applications: application() }, null, {
      ds160_final_submission_attempts: { message: "database unavailable" },
    }),
    { kind: "recover", reason: "final_fence_read_failed" },
  );
  assert.deepEqual(
    await plan(
      { applications: application(), ds160_final_submission_attempts: [] },
      null,
      { submission_queue: { message: "database unavailable" } },
    ),
    { kind: "recover", reason: "queue_history_read_failed" },
  );
});

test("classifies validation and official gates as blocked, then bounds runtime retries", () => {
  for (const code of [
    "VALIDATION_FAILED",
    "GATE_DETECTED",
    "MANUAL_ACTION_REQUIRED",
  ]) {
    assert.equal(classifyDs160RetryFailure({ code }, 0, 3), "blocked");
  }
  assert.equal(
    classifyDs160RetryFailure({ error: { code: "gate_detected" } }, 0, 3),
    "blocked",
  );
  assert.equal(
    classifyDs160RetryFailure(new Error("network timeout"), 0, 3),
    "retry",
  );
  assert.equal(
    classifyDs160RetryFailure(new Error("network timeout"), 2, 3),
    "failed",
  );
});
