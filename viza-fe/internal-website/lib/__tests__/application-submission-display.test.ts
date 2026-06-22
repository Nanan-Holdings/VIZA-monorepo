import { describe, expect, it } from "vitest";
import { shouldShowSubmissionStatusStep } from "@/lib/application-submission-display";

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
