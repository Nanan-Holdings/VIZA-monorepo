export const SUBMISSION_STATUS_POLL_BASE_DELAY_MS = 3_000;
export const SUBMISSION_STATUS_POLL_MAX_DELAY_MS = 15_000;

export function isRetryableSubmissionStatusResponse(status: number): boolean {
  return (
    status === 408 ||
    status === 425 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}

export function getSubmissionStatusPollDelay(failureCount: number): number {
  if (failureCount <= 0) return SUBMISSION_STATUS_POLL_BASE_DELAY_MS;
  const exponent = Math.min(Math.max(Math.floor(failureCount) - 1, 0), 3);
  return Math.min(
    SUBMISSION_STATUS_POLL_BASE_DELAY_MS * 2 ** exponent,
    SUBMISSION_STATUS_POLL_MAX_DELAY_MS,
  );
}
