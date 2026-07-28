import { describe, expect, it } from "vitest";
import {
  getSubmissionStatusPollDelay,
  isRetryableSubmissionStatusResponse,
  shouldPreferDurableTerminalProps,
  shouldStopSubmissionStatusPolling,
  SUBMISSION_STATUS_POLL_BASE_DELAY_MS,
  SUBMISSION_STATUS_POLL_MAX_DELAY_MS,
} from "../submission-status-poll";

describe("submission status polling", () => {
  it("retries transient network and upstream response statuses", () => {
    for (const status of [408, 425, 429, 500, 502, 503, 504]) {
      expect(isRetryableSubmissionStatusResponse(status)).toBe(true);
    }

    for (const status of [400, 401, 403, 404, 409, 422]) {
      expect(isRetryableSubmissionStatusResponse(status)).toBe(false);
    }
  });

  it("uses bounded exponential backoff after consecutive failures", () => {
    expect(getSubmissionStatusPollDelay(0)).toBe(SUBMISSION_STATUS_POLL_BASE_DELAY_MS);
    expect(getSubmissionStatusPollDelay(1)).toBe(3_000);
    expect(getSubmissionStatusPollDelay(2)).toBe(6_000);
    expect(getSubmissionStatusPollDelay(3)).toBe(12_000);
    expect(getSubmissionStatusPollDelay(4)).toBe(SUBMISSION_STATUS_POLL_MAX_DELAY_MS);
    expect(getSubmissionStatusPollDelay(20)).toBe(SUBMISSION_STATUS_POLL_MAX_DELAY_MS);
  });

  it("keeps polling a stalled queue so a late worker pickup can recover the UI", () => {
    expect(
      shouldStopSubmissionStatusPolling({
        completedWithResult: false,
        failed: false,
        snapshotHasQueue: true,
      }),
    ).toBe(false);
  });

  it("stops polling completed results and durable failures", () => {
    expect(
      shouldStopSubmissionStatusPolling({
        completedWithResult: true,
        failed: false,
        snapshotHasQueue: true,
      }),
    ).toBe(true);
    expect(
      shouldStopSubmissionStatusPolling({
        completedWithResult: false,
        failed: true,
        snapshotHasQueue: true,
      }),
    ).toBe(true);
  });

  it("lets an active queue override an older durable terminal result after reload", () => {
    expect(
      shouldPreferDurableTerminalProps({
        durableTerminalPropsAvailable: true,
        localRetryActive: false,
        snapshotIsActive: true,
      }),
    ).toBe(false);
    expect(
      shouldPreferDurableTerminalProps({
        durableTerminalPropsAvailable: true,
        localRetryActive: false,
        snapshotIsActive: false,
      }),
    ).toBe(true);
  });
});
