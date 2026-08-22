// Submission workers can take several seconds to transition between stages.
// Keep the initial refresh useful while avoiding a tight 3s request loop; the
// client also backs off further while a snapshot remains unchanged.
export const SUBMISSION_STATUS_POLL_BASE_DELAY_MS = 5_000;
export const SUBMISSION_STATUS_POLL_MAX_DELAY_MS = 30_000;

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

export function getSubmissionStatusPollDelay(
  failureCount: number,
  stablePollCount = 0,
): number {
  const exponent = failureCount > 0
    ? Math.min(Math.max(Math.floor(failureCount) - 1, 0), 3)
    : Math.min(Math.max(Math.floor(stablePollCount), 0), 3);
  return Math.min(
    SUBMISSION_STATUS_POLL_BASE_DELAY_MS * 2 ** exponent,
    SUBMISSION_STATUS_POLL_MAX_DELAY_MS,
  );
}

export function shouldStopSubmissionStatusPolling({
  completedWithResult,
  failed,
  snapshotHasQueue,
}: {
  completedWithResult: boolean;
  failed: boolean;
  snapshotHasQueue: boolean;
}): boolean {
  if (completedWithResult) return true;
  return failed && snapshotHasQueue;
}

export function shouldPreferDurableTerminalProps({
  durableTerminalPropsAvailable,
  localRetryActive,
  snapshotIsActive,
  snapshotAvailable,
}: {
  durableTerminalPropsAvailable: boolean;
  localRetryActive: boolean;
  snapshotIsActive: boolean;
  snapshotAvailable: boolean;
}): boolean {
  // The props are the server-rendered starting point, while a successfully
  // polled snapshot is newer by definition. Keeping an old terminal prop
  // authoritative after polling means a temporary "stalled" result can mask a
  // later worker pickup or completion until the whole page is reloaded.
  return (
    durableTerminalPropsAvailable &&
    !localRetryActive &&
    !snapshotIsActive &&
    !snapshotAvailable
  );
}
