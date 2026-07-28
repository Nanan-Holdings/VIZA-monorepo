import type { SubmissionResult, SubmissionResultStatus } from "@/lib/submission-result";

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
