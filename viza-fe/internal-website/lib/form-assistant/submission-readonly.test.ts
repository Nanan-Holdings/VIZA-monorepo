import { describe, expect, it } from "vitest";
import { hasSuccessfulFormSubmission } from "./submission-readonly";

describe("hasSuccessfulFormSubmission", () => {
  it("locks a durable successful non-arrival-card result", () => {
    expect(hasSuccessfulFormSubmission({
      country: "united_states",
      visaType: "US_DS160",
      submissionResultStatus: "submitted",
      submissionResult: { country: "US", status: "submitted", applicationId: "AA00" },
    })).toBe(true);
  });

  it("does not lock from a status string without a durable result", () => {
    expect(hasSuccessfulFormSubmission({
      country: "united_states",
      visaType: "US_DS160",
      submissionResultStatus: "submitted",
      submissionResult: null,
    })).toBe(false);
  });

  it("keeps recoverable and handoff results editable", () => {
    expect(hasSuccessfulFormSubmission({
      country: "australia",
      visaType: "AU_SUBCLASS_600",
      submissionResultStatus: "stopped_at_review",
      submissionResult: { country: "AU", status: "stopped_at_review", trn: "TRN" },
    })).toBe(false);
  });

  it("preserves Korea's issue-number, official-portal, and PDF evidence contract", () => {
    const base = {
      country: "south_korea",
      visaType: "KR_E_ARRIVAL_CARD",
      submissionResultStatus: "submitted",
    };
    expect(hasSuccessfulFormSubmission({
      ...base,
      submissionResult: {
        country: "KR",
        visaType: "KR_E_ARRIVAL_CARD",
        status: "submitted",
        submitted: true,
      },
    })).toBe(false);
    expect(hasSuccessfulFormSubmission({
      ...base,
      submissionResult: {
        country: "KR",
        visaType: "KR_E_ARRIVAL_CARD",
        status: "submitted",
        submitted: true,
        issueNumber: "EAC-123456",
        portalUrl: "https://www.e-arrivalcard.go.kr/portal/check",
        confirmationPdfStoragePath: "applications/result.pdf",
      },
    })).toBe(true);
  });
});
