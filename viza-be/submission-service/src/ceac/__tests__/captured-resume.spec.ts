import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isExactDs160ResumeJob,
  validateCapturedDs160Resume,
} from "../captured-resume";

const APPLICATION_ID = "AA00FHOZ99";

function validInput(overrides: Record<string, unknown> = {}) {
  const encrypted = new Map([
    ["application", APPLICATION_ID],
    ["question", "What was your first school?"],
    ["answer", "Example School"],
  ]);
  return {
    applicationId: APPLICATION_ID,
    officialApplicationIdEncrypted: "encrypted-application",
    officialSecurityQuestionEncrypted: "encrypted-question",
    officialSecurityAnswerEncrypted: "encrypted-answer",
    decryptSecret: (ciphertext: string) => {
      const key = ciphertext.replace("encrypted-", "");
      const value = encrypted.get(key);
      if (!value) throw new Error("missing test secret");
      return value;
    },
    finalFenceStates: [],
    ...overrides,
  };
}

test("requires an exact server job ID match", () => {
  assert.equal(isExactDs160ResumeJob("queue-1", "queue-1"), true);
  assert.equal(isExactDs160ResumeJob("queue-1", " queue-1 "), true);
  assert.equal(isExactDs160ResumeJob("queue-1", undefined), false);
  assert.equal(isExactDs160ResumeJob("queue-1", "queue-10"), false);
  assert.equal(isExactDs160ResumeJob("queue-1", ""), false);
});

test("accepts a complete same-ID checkpoint when the application fence is empty", () => {
  const decision = validateCapturedDs160Resume(validInput());

  assert.deepEqual(decision, {
    ok: true,
    checkpoint: {
      applicationId: APPLICATION_ID,
      securityQuestionText: "What was your first school?",
      securityAnswer: "Example School",
    },
  });
});

test("rejects incomplete, mismatched, and undecryptable checkpoints", () => {
  assert.deepEqual(
    validateCapturedDs160Resume(validInput({ officialSecurityQuestionEncrypted: null })),
    { ok: false, reason: "checkpoint_incomplete" },
  );
  assert.deepEqual(
    validateCapturedDs160Resume(validInput({
      applicationId: "AA00FHOZ98",
    })),
    { ok: false, reason: "application_id_mismatch" },
  );
  assert.deepEqual(
    validateCapturedDs160Resume(validInput({
      decryptSecret: () => { throw new Error("ciphertext invalid"); },
    })),
    { ok: false, reason: "checkpoint_decryption_failed" },
  );
});

test("rejects every application-level final fence state", () => {
  for (const state of ["started", "unknown", "confirmed"]) {
    const decision = validateCapturedDs160Resume(validInput({ finalFenceStates: [state] }));
    assert.deepEqual(decision, {
      ok: false,
      reason: "final_submission_fence_blocked",
    });
  }
  assert.deepEqual(
    validateCapturedDs160Resume(validInput({ finalFenceStates: ["unexpected"] })),
    { ok: false, reason: "final_submission_fence_unreadable" },
  );
  assert.deepEqual(
    validateCapturedDs160Resume(validInput({ submissionAlreadyRecorded: true })),
    { ok: false, reason: "final_submission_already_recorded" },
  );
});
