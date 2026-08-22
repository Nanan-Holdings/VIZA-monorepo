import { describe, expect, it } from "vitest";
import type { DigitalArrivalCardSubmissionResult } from "@/lib/submission-result";
import { hasSuccessfulArrivalCardSubmission } from "./application-lifecycle";

const submittedMdac: DigitalArrivalCardSubmissionResult = {
  country: "MY",
  visaType: "MY_MDAC_ARRIVAL_CARD",
  status: "submitted",
  mode: "live_assisted",
  provider: "malaysia_mdac_live",
  applicationId: "application-id",
  submitted: true,
  portalUrl: "https://imigresen-online.imi.gov.my/mdac/main",
  portalResponseSummary: "Official confirmation captured.",
};

describe("arrival-card application lifecycle", () => {
  it("locks a successfully submitted MDAC application", () => {
    expect(hasSuccessfulArrivalCardSubmission({
      country: "malaysia",
      visaType: "MY_MDAC_ARRIVAL_CARD",
      submissionResult: submittedMdac,
    })).toBe(true);
  });

  it("keeps the assistant available before official success", () => {
    expect(hasSuccessfulArrivalCardSubmission({
      country: "malaysia",
      visaType: "MY_MDAC_ARRIVAL_CARD",
      submissionResult: {
        ...submittedMdac,
        status: "official_portal_error",
        submitted: false,
      },
    })).toBe(false);
  });

  it("does not lock a visa application with a submitted result", () => {
    expect(hasSuccessfulArrivalCardSubmission({
      country: "united_states",
      visaType: "DS160",
      submissionResult: {
        country: "US",
        status: "submitted",
        mode: "live_assisted",
        provider: "ceac",
        applicationId: "application-id",
        confirmationNumber: "AA00112233",
        submittedAt: "2026-08-18T00:00:00.000Z",
        artifacts: {},
      },
    })).toBe(false);
  });

  it("locks a successfully submitted Korea e-Arrival Card independently of C-3", () => {
    expect(hasSuccessfulArrivalCardSubmission({
      country: "south_korea",
      visaType: "KR_E_ARRIVAL_CARD",
      submissionResult: {
        country: "KR",
        visaType: "KR_E_ARRIVAL_CARD",
        status: "submitted",
        mode: "live_assisted",
        provider: "korea_e_arrival_card_live",
        applicationId: "korea-application-id",
        submitted: true,
        issueNumber: "KR-12345",
        portalUrl: "https://www.e-arrivalcard.go.kr/portal/check",
        confirmationPdfStoragePath: "applications/korea/confirmation.pdf",
        portalResponseSummary: "Official confirmation captured.",
      },
    })).toBe(true);
    expect(hasSuccessfulArrivalCardSubmission({
      country: "south_korea",
      visaType: "KR_C39_SHORT_TERM_VISIT",
      submissionResult: { status: "submitted", submitted: true },
    })).toBe(false);
  });

  it("does not lock Korea e-Arrival Card without the official issue number and evidence", () => {
    expect(hasSuccessfulArrivalCardSubmission({
      country: "south_korea",
      visaType: "KR_E_ARRIVAL_CARD",
      submissionResult: {
        country: "KR",
        visaType: "KR_E_ARRIVAL_CARD",
        status: "submitted",
        mode: "live_assisted",
        provider: "korea_e_arrival_card_live",
        applicationId: "korea-application-id",
        submitted: true,
        portalUrl: "https://www.e-arrivalcard.go.kr/portal/check",
        confirmationPdfStoragePath: "applications/korea/confirmation.pdf",
      },
    })).toBe(false);
    expect(hasSuccessfulArrivalCardSubmission({
      country: "south_korea",
      visaType: "KR_E_ARRIVAL_CARD",
      submissionResult: {
        country: "KR",
        visaType: "KR_E_ARRIVAL_CARD",
        status: "submitted",
        mode: "live_assisted",
        provider: "korea_e_arrival_card_live",
        applicationId: "korea-application-id",
        submitted: true,
        issueNumber: "KR-12345",
        portalUrl: "https://www.e-arrivalcard.go.kr/portal/check",
      },
    })).toBe(false);
  });
});
