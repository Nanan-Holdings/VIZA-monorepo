import { describe, expect, it } from "vitest";
import {
  hasDurableTerminalSubmissionResult,
  shouldShowReviewAlongsideSubmissionStatus,
  shouldShowSubmissionStatusStep,
} from "@/lib/application-submission-display";

describe("shouldShowSubmissionStatusStep", () => {
  it("shows the status step for France live results without submitted_at", () => {
    expect(
      shouldShowSubmissionStatusStep({
        submittedAt: null,
        submissionResultStatus: "completed",
        submissionResult: {
          country: "FR",
          status: "final_review_required",
          mode: "live_assisted",
          provider: "france_visas_live",
          applicationReference: "FRA...8335",
          officialStatus: "official_record_confirmed",
        },
      }),
    ).toBe(true);
  });

  it("keeps a fresh draft on the final confirmation panel", () => {
    expect(
      shouldShowSubmissionStatusStep({
        submittedAt: null,
        submissionResultStatus: null,
        submissionResult: null,
      }),
    ).toBe(false);
  });
});

describe("hasDurableTerminalSubmissionResult", () => {
  it("treats a stored completed result as authoritative over an older polling snapshot", () => {
    expect(
      hasDurableTerminalSubmissionResult({
        submissionResultStatus: "completed",
        submissionResult: {
          country: "PH",
          visaType: "PH_ETRAVEL_ARRIVAL_CARD",
          applicationId: "application_1",
          status: "submitted",
          submitted: true,
          mode: "live_assisted",
          provider: "philippines_etravel_live",
          portalUrl: "https://etravel.gov.ph/",
          portalResponseSummary: "Submission completed.",
        },
      }),
    ).toBe(true);
  });

  it("does not mark an in-progress result as terminal", () => {
    expect(
      hasDurableTerminalSubmissionResult({
        submissionResultStatus: "processing",
        submissionResult: null,
      }),
    ).toBe(false);
  });
});

describe("shouldShowReviewAlongsideSubmissionStatus", () => {
  it.each(["waiting", "processing", "action_required", "completed"] as const)(
    "keeps the Indonesia B1/C1 review visible while the submission is %s",
    (submissionResultStatus) => {
      expect(
        shouldShowReviewAlongsideSubmissionStatus({
          submissionResultStatus,
          preserveReview: true,
        }),
      ).toBe(true);
    },
  );

  it.each(["failed", "stalled"] as const)(
    "keeps the read-only review visible for a %s retry state",
    (submissionResultStatus) => {
      expect(
        shouldShowReviewAlongsideSubmissionStatus({
          submissionResultStatus,
        }),
      ).toBe(true);
    },
  );

  it.each(["waiting", "processing", "completed"] as const)(
    "keeps the status-only view for %s",
    (submissionResultStatus) => {
      expect(
        shouldShowReviewAlongsideSubmissionStatus({
          submissionResultStatus,
        }),
      ).toBe(false);
    },
  );
});
