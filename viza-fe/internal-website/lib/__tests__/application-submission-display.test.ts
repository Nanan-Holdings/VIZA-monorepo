import { describe, expect, it } from "vitest";
import {
  getSubmissionResultPlacement,
  hasDurableTerminalSubmissionResult,
  shouldResetJpVjwPreflightAfterAnswerSave,
  shouldShowReviewAlongsideSubmissionStatus,
  shouldShowSubmissionStatusStep,
} from "@/lib/application-submission-display";
import type { SubmissionResult } from "@/lib/submission-result";
import { RESULT_PRESENTATION_REGISTRY } from "@/app/client/application/_components/result-cards/covered-countries";

describe("submission result placement", () => {
  it.each([
    ["Singapore", "SG", "SG_ARRIVAL_CARD", {
      country: "SG", visaType: "SG_ARRIVAL_CARD", status: "submitted", submitted: true,
      applicationId: "app", mode: "live_assisted", provider: "sg_arrival_card_live", portalUrl: "https://eservices.ica.gov.sg/sgarrivalcard/portal/",
      portalResponseSummary: "Confirmed", resultEvidence: { authoritativeRead: { source: "official_registration_result_read", postSubmitRead: true, stableReference: true, referenceNumber: "SG-1" } },
    }],
    ["Philippines arrival", "PH", "PH_ETRAVEL_ARRIVAL_CARD", {
      country: "PH", visaType: "PH_ETRAVEL_ARRIVAL_CARD", status: "submitted", submitted: true,
      applicationId: "app", mode: "live_assisted", provider: "philippines_etravel_live", portalUrl: "https://etravel.gov.ph/", portalResponseSummary: "Confirmed",
      referenceNumber: "PH-1", artifacts: { qrCodes: ["owner/app/PH/qr.png"] },
      resultEvidence: { authoritativeRead: { postSubmitRead: true, stableReference: true, referenceNumber: "PH-1" }, qrRender: { rendered: true, renderedForReference: "PH-1" } },
    }],
    ["generic e-visa", "ID", "ID_B1_EVOA", {
      country: "ID", status: "submitted", reference: "ID-1",
      artifactStoragePath: "owner/app/ID/success.pdf",
    }],
  ] as const)("puts confirmed %s success after Review", (_name, country, visaType, result) => {
    expect(getSubmissionResultPlacement({ country, visaType, submissionResultStatus: "submitted", submissionResult: result as SubmissionResult })).toBe("confirmation");
  });

  it.each([
    ["pending", "SG", "SG_ARRIVAL_CARD", "processing", null],
    ["manual", "VN", "VN_E_VISA", "needs_user_action", { country: "VN", status: "stopped_at_pay" }],
    ["failed", "ID", "ID_B1_EVOA", "failed", { country: "ID", status: "stopped_at_pay" }],
    ["Korea incomplete evidence", "KR", "KR_E_ARRIVAL_CARD", "submitted", {
      country: "KR", visaType: "KR_E_ARRIVAL_CARD", status: "submitted", submitted: true, applicationId: "app", mode: "live_assisted", provider: "korea_e_arrival_card_live", portalUrl: "https://www.e-arrivalcard.go.kr/portal/view", portalResponseSummary: "Submitted", issueNumber: "", artifacts: { pdfs: ["official.pdf"] },
    }],
  ] as const)("keeps %s state with Review", (_name, country, visaType, status, result) => {
    expect(getSubmissionResultPlacement({ country, visaType, submissionResultStatus: status, submissionResult: result as SubmissionResult | null })).toBe("review");
  });

  it("keeps pre-payment screenshot evidence in Review", () => {
    expect(getSubmissionResultPlacement({
      country: "ID",
      visaType: "ID_B1_EVOA",
      submissionResultStatus: "stopped_at_pay",
      submissionResult: {
        country: "ID",
        status: "stopped_at_pay",
        artifacts: { screenshots: ["owner/app/ID/payment.png"] },
      } as SubmissionResult,
    })).toBe("review");
  });

  it.each(RESULT_PRESENTATION_REGISTRY)(
    "never promotes pre-payment evidence for $country / $visaType ($adapter) to Confirmation",
    ({ country, visaType }) => {
      const result = {
        country,
        visaType,
        status: "stopped_at_pay",
        submitted: false,
        paymentBoundary: {
          screenshotStoragePath: `owner/application-1/${country}/payment-boundary.png`,
        },
        artifacts: {
          screenshots: [`owner/application-1/${country}/payment-boundary.png`],
        },
      } as unknown as SubmissionResult;

      expect(getSubmissionResultPlacement({
        country,
        visaType,
        submissionResultStatus: "stopped_at_pay",
        submissionResult: result,
      })).toBe("review");
    },
  );

  it("lets a durable failure override stale success-looking result data", () => {
    expect(getSubmissionResultPlacement({
      country: "ID",
      visaType: "ID_B1_EVOA",
      submissionResultStatus: "failed",
      submissionResult: {
        country: "ID",
        status: "submitted",
        reference: "ID-1",
        artifactStoragePath: "owner/app/ID/success.pdf",
      } as SubmissionResult,
    })).toBe("review");
  });
});

describe("submission status display", () => {
  it("shows a Review-associated status for France without submitted_at", () => {
    expect(shouldShowSubmissionStatusStep({
      submittedAt: null,
      submissionResultStatus: "completed",
      submissionResult: {
        country: "FR", status: "final_review_required", mode: "live_assisted",
        provider: "france_visas_live", applicationReference: "FRA...8335",
        officialStatus: "official_record_confirmed",
      },
    })).toBe(true);
  });

  it("keeps a fresh draft free of a status surface", () => {
    expect(shouldShowSubmissionStatusStep({
      submittedAt: null, submissionResultStatus: null, submissionResult: null,
    })).toBe(false);
  });

  it("treats a stored completed result as durable over an older poll", () => {
    expect(hasDurableTerminalSubmissionResult({
      submissionResultStatus: "completed",
      submissionResult: {
        country: "PH", visaType: "PH_ETRAVEL_ARRIVAL_CARD", applicationId: "application_1",
        status: "submitted", submitted: true, mode: "live_assisted", provider: "philippines_etravel_live",
        portalUrl: "https://etravel.gov.ph/", portalResponseSummary: "Submission completed.",
      },
    })).toBe(true);
  });

  it("does not mark in-progress state as terminal", () => {
    expect(hasDurableTerminalSubmissionResult({
      submissionResultStatus: "processing", submissionResult: null,
    })).toBe(false);
  });

  it("always keeps the saved application review available", () => {
    expect(shouldShowReviewAlongsideSubmissionStatus()).toBe(true);
  });

  it("resets only the stale Japan payload-validation result after an answer save", () => {
    expect(shouldResetJpVjwPreflightAfterAnswerSave({
      visaType: "JP_VISIT_JAPAN_WEB",
      submissionResultStatus: "needs_attention",
      submissionResult: { errorDetails: { code: "jp_vjw_payload_validation_failed" } },
    })).toBe(true);
  });

  it.each([
    { visaType: "KE_ETA", submissionResultStatus: "needs_attention", submissionResult: { errorDetails: { code: "jp_vjw_payload_validation_failed" } } },
    { visaType: "JP_VISIT_JAPAN_WEB", submissionResultStatus: "needs_attention", submissionResult: { errorDetails: { code: "official_portal_blocked" } } },
    { visaType: "JP_VISIT_JAPAN_WEB", submissionResultStatus: "qr_ready", submissionResult: { errorDetails: { code: "jp_vjw_payload_validation_failed" } } },
  ])("preserves non-resettable submission state", (input) => {
    expect(shouldResetJpVjwPreflightAfterAnswerSave(input)).toBe(false);
  });
});
