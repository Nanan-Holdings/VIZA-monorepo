import type { SubmissionResult, SubmissionResultStatus } from "@/lib/submission-result";

export const JP_VJW_PAYLOAD_VALIDATION_ERROR_CODE =
  "jp_vjw_payload_validation_failed";

const TERMINAL_RESULT_STATUSES = new Set([
  "completed",
  "submitted",
  "submitted_mock",
  "form_ready_for_agency",
  "failed",
  "stalled",
  "needs_user_action",
  "action_required",
  "stopped_at_sign",
  "stopped_at_pay",
  "stopped_at_review",
  "unsupported",
]);

export function hasDurableTerminalSubmissionResult(input: {
  submissionResultStatus?: SubmissionResultStatus | null;
  submissionResult?: SubmissionResult | null;
}): boolean {
  const normalizedStatus = (input.submissionResultStatus ?? "").trim().toLowerCase();
  return Boolean(input.submissionResult) && TERMINAL_RESULT_STATUSES.has(normalizedStatus);
}

export function shouldShowSubmissionStatusStep(input: {
  submittedAt?: string | null;
  submissionResultStatus?: SubmissionResultStatus | null;
  submissionResult?: SubmissionResult | null;
}): boolean {
  if (input.submittedAt) return true;
  if (input.submissionResult) return true;
  return Boolean(input.submissionResultStatus);
}

/**
 * The saved application review is part of the application record, not a
 * transient submission-state view. Once a status card is shown, keep the
 * review beside it for every country and every status so applicants can
 * always audit and amend the answers used for a retry or official handoff.
 */
export function shouldShowReviewAlongsideSubmissionStatus(): true {
  return true;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * A payload-validation failure happened before any official-site side effect.
 * Once the applicant edits their answers, that stale result must no longer
 * replace the primary review/submit action. Official portal failures and
 * active/terminal results remain untouched.
 */
export function shouldResetJpVjwPreflightAfterAnswerSave(input: {
  visaType?: string | null;
  submissionResultStatus?: string | null;
  submissionResult?: unknown;
}): boolean {
  if ((input.visaType ?? "").trim().toUpperCase() !== "JP_VISIT_JAPAN_WEB") {
    return false;
  }
  if ((input.submissionResultStatus ?? "").trim().toLowerCase() !== "needs_attention") {
    return false;
  }

  const result = asRecord(input.submissionResult);
  const errorDetails = asRecord(result?.errorDetails);
  return errorDetails?.code === JP_VJW_PAYLOAD_VALIDATION_ERROR_CODE;
}
