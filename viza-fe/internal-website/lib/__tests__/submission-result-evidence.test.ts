import { describe, expect, it } from "vitest";
import { getAutomatedOnlineSubmissionEvidence } from "../submission-result-evidence";

describe("automated online submission evidence", () => {
  it("does not treat a Japan qr_ready status as success without a QR artifact", () => {
    expect(
      getAutomatedOnlineSubmissionEvidence({
        visaType: "JP_VISIT_JAPAN_WEB",
        status: "qr_ready",
        qrReady: true,
        artifacts: { qrCodes: [] },
      }),
    ).toMatchObject({ submitted: false, qrReady: false, needsAttention: true });
  });

  it("requires the Kenya approval PDF before exposing approved", () => {
    expect(
      getAutomatedOnlineSubmissionEvidence({
        visaType: "KE_ETA",
        status: "approved",
        officialReference: "ETA-123",
        artifacts: { pdfs: [] },
      }),
    ).toMatchObject({ submitted: false, approved: false, needsAttention: true });

    expect(
      getAutomatedOnlineSubmissionEvidence({
        visaType: "KE_ETA",
        status: "approved",
        officialReference: "ETA-123",
        approvalPdfStoragePath: "ke/approval.pdf",
        artifacts: { pdfs: [] },
      }),
    ).toMatchObject({
      submitted: true,
      approved: true,
      pdfPaths: ["ke/approval.pdf"],
      needsAttention: false,
    });
  });

  it("allows a Kenya submitted state only with an official reference", () => {
    expect(
      getAutomatedOnlineSubmissionEvidence({ visaType: "KE_ETA", status: "submitted" }),
    ).toMatchObject({ submitted: false });
    expect(
      getAutomatedOnlineSubmissionEvidence({
        visaType: "KE_ETA",
        status: "submitted",
        officialReference: "ETA-123",
      }),
    ).toMatchObject({ submitted: true, reference: "ETA-123" });
  });
});
