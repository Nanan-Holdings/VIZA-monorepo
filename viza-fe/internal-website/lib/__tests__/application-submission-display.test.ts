import { describe, expect, it } from "vitest";
import {
  hasDurableTerminalSubmissionResult,
  shouldResetJpVjwPreflightAfterAnswerSave,
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
  it("keeps the read-only application review beside every submission status", () => {
    expect(shouldShowReviewAlongsideSubmissionStatus()).toBe(true);
  });
});

describe("shouldResetJpVjwPreflightAfterAnswerSave", () => {
  it("resets only the stale Japan payload-validation result", () => {
    expect(
      shouldResetJpVjwPreflightAfterAnswerSave({
        visaType: "JP_VISIT_JAPAN_WEB",
        submissionResultStatus: "needs_attention",
        submissionResult: {
          errorDetails: { code: "jp_vjw_payload_validation_failed" },
        },
      }),
    ).toBe(true);
  });

  it.each([
    {
      visaType: "KE_ETA",
      submissionResultStatus: "needs_attention",
      submissionResult: {
        errorDetails: { code: "jp_vjw_payload_validation_failed" },
      },
    },
    {
      visaType: "JP_VISIT_JAPAN_WEB",
      submissionResultStatus: "needs_attention",
      submissionResult: { errorDetails: { code: "official_portal_blocked" } },
    },
    {
      visaType: "JP_VISIT_JAPAN_WEB",
      submissionResultStatus: "qr_ready",
      submissionResult: {
        errorDetails: { code: "jp_vjw_payload_validation_failed" },
      },
    },
  ])("preserves non-editable or non-Japan submission state", (input) => {
    expect(shouldResetJpVjwPreflightAfterAnswerSave(input)).toBe(false);
  });
});
