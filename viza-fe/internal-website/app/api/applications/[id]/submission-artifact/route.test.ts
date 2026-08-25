import { describe, expect, it } from "vitest";
import { isArtifactReferencedBySubmissionResult } from "./route-handler";

describe("isArtifactReferencedBySubmissionResult", () => {
  const qrPath =
    "jobs/job-id/vn_prearrival/qr/01-confirmation-qr.png";

  it("accepts a runner-job artifact exactly referenced by the application result", () => {
    expect(
      isArtifactReferencedBySubmissionResult(qrPath, {
        artifacts: {
          qrCodes: [qrPath],
        },
      }),
    ).toBe(true);
  });

  it("rejects an unreferenced artifact from another runner job", () => {
    expect(
      isArtifactReferencedBySubmissionResult(
        "jobs/other-job/vn_prearrival/qr/01-confirmation-qr.png",
        {
          artifacts: {
            qrCodes: [qrPath],
          },
        },
      ),
    ).toBe(false);
  });

  it("does not treat log text as an authorized artifact path", () => {
    expect(
      isArtifactReferencedBySubmissionResult(qrPath, {
        artifacts: {
          logs: [qrPath],
        },
      }),
    ).toBe(false);
  });

  it("accepts direct confirmation screenshot and approval PDF paths", () => {
    expect(
      isArtifactReferencedBySubmissionResult(
        "jobs/job-id/ke/confirmation.png",
        {
          officialConfirmationScreenshotStoragePath: "jobs/job-id/ke/confirmation.png",
          approvalPdfStoragePath: "jobs/job-id/ke/approval.pdf",
        },
      ),
    ).toBe(true);
    expect(
      isArtifactReferencedBySubmissionResult(
        "jobs/job-id/ke/approval.pdf",
        {
          officialConfirmationScreenshotStoragePath: "jobs/job-id/ke/confirmation.png",
          approvalPdfStoragePath: "jobs/job-id/ke/approval.pdf",
        },
      ),
    ).toBe(true);
  });

  it("accepts a CEAC evidence screenshot only when it is exactly referenced", () => {
    const screenshotPath = "jobs/job-id/us/ceac-confirmation.png";
    expect(
      isArtifactReferencedBySubmissionResult(screenshotPath, {
        evidence: { screenshotPath },
      }),
    ).toBe(true);
    expect(
      isArtifactReferencedBySubmissionResult("jobs/other/us/ceac-confirmation.png", {
        evidence: { screenshotPath },
      }),
    ).toBe(false);
  });
});
