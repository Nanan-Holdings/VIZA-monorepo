import type { SubmissionResult, SubmissionResultStatus } from "@/lib/submission-result";

export function shouldShowSubmissionStatusStep(input: {
  submittedAt?: string | null;
  submissionResultStatus?: SubmissionResultStatus | null;
  submissionResult?: SubmissionResult | null;
}): boolean {
  if (input.submittedAt) return true;
  if (input.submissionResult) return true;
  return Boolean(input.submissionResultStatus);
}
