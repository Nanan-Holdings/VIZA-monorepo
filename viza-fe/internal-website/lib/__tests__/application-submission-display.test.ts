import { describe, expect, it } from "vitest";
import {
  hasDurableTerminalSubmissionResult,
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
