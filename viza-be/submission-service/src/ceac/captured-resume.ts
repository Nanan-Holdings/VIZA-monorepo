/**
 * Pure safety checks for resuming a DS-160 after CEAC issued an Application ID
 * but before the final Sign and Submit flow began.
 *
 * The worker owns the environment-variable gate and supplies a decryption
 * callback. Keeping the decision here free of Supabase, Playwright, and
 * process-global state makes the fail-closed behavior independently testable.
 */

const DS160_APPLICATION_ID_PATTERN = /^AA[A-Z0-9]{8,10}$/i;
const FINAL_FENCE_STATES = new Set(["started", "unknown", "confirmed"]);

export type CapturedDs160ResumeRejection =
  | "resume_job_mismatch"
  | "checkpoint_incomplete"
  | "checkpoint_decryption_failed"
  | "application_id_invalid"
  | "application_id_mismatch"
  | "final_submission_already_recorded"
  | "final_submission_fence_blocked"
  | "final_submission_fence_unreadable";

export interface CapturedDs160ResumeCheckpoint {
  applicationId: string;
  securityQuestionText: string;
  securityAnswer: string;
}

export type CapturedDs160ResumeDecision =
  | { ok: true; checkpoint: CapturedDs160ResumeCheckpoint }
  | { ok: false; reason: CapturedDs160ResumeRejection };

/**
 * Return true only when the server supplied an exact queue-job match.
 * Empty values and surrounding whitespace are treated as unset; the value is
 * never interpreted as a prefix, application ID, or general retry switch.
 */
export function isExactDs160ResumeJob(
  queueJobId: string,
  requestedJobId: string | null | undefined,
): boolean {
  const queueId = queueJobId.trim();
  const requested = requestedJobId?.trim() ?? "";
  return queueId.length > 0 && requested.length > 0 && queueId === requested;
}

interface CapturedDs160ResumeValidationInput {
  applicationId: unknown;
  officialApplicationIdEncrypted: unknown;
  officialSecurityQuestionEncrypted: unknown;
  officialSecurityAnswerEncrypted: unknown;
  decryptSecret: (ciphertext: string) => string;
  finalFenceStates: readonly unknown[];
  submissionAlreadyRecorded?: boolean;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeApplicationId(value: unknown): string | null {
  if (!nonEmptyString(value)) return null;
  const normalized = value.trim().toUpperCase();
  return DS160_APPLICATION_ID_PATTERN.test(normalized) ? normalized : null;
}

/**
 * Validate every prerequisite needed before a captured CEAC application can
 * be retrieved. Any missing, malformed, decrypted, or fenced state rejects
 * the resume so callers can route the queue item to action_required.
 */
export function validateCapturedDs160Resume(
  input: CapturedDs160ResumeValidationInput,
): CapturedDs160ResumeDecision {
  if (input.submissionAlreadyRecorded) {
    return { ok: false, reason: "final_submission_already_recorded" };
  }

  if (
    !nonEmptyString(input.officialApplicationIdEncrypted) ||
    !nonEmptyString(input.officialSecurityQuestionEncrypted) ||
    !nonEmptyString(input.officialSecurityAnswerEncrypted)
  ) {
    return { ok: false, reason: "checkpoint_incomplete" };
  }

  const applicationId = normalizeApplicationId(input.applicationId);
  if (!applicationId) return { ok: false, reason: "application_id_invalid" };

  let decryptedApplicationId: string;
  let securityQuestionText: string;
  let securityAnswer: string;
  try {
    decryptedApplicationId = input.decryptSecret(input.officialApplicationIdEncrypted).trim();
    // Preserve the answer byte-for-byte after decryption. CEAC compares the
    // submitted recovery answer, so validation trims only for the non-empty
    // check below and does not rewrite applicant-provided whitespace.
    securityQuestionText = input.decryptSecret(input.officialSecurityQuestionEncrypted);
    securityAnswer = input.decryptSecret(input.officialSecurityAnswerEncrypted);
  } catch {
    return { ok: false, reason: "checkpoint_decryption_failed" };
  }

  const normalizedDecryptedApplicationId = normalizeApplicationId(decryptedApplicationId);
  if (
    !normalizedDecryptedApplicationId ||
    normalizedDecryptedApplicationId !== applicationId
  ) {
    return { ok: false, reason: "application_id_mismatch" };
  }
  if (!securityQuestionText.trim() || !securityAnswer.trim()) {
    return { ok: false, reason: "checkpoint_incomplete" };
  }

  for (const state of input.finalFenceStates) {
    if (typeof state !== "string") {
      return { ok: false, reason: "final_submission_fence_unreadable" };
    }
    if (FINAL_FENCE_STATES.has(state)) {
      return { ok: false, reason: "final_submission_fence_blocked" };
    }
    return { ok: false, reason: "final_submission_fence_unreadable" };
  }

  return {
    ok: true,
    checkpoint: {
      applicationId,
      securityQuestionText,
      securityAnswer,
    },
  };
}
