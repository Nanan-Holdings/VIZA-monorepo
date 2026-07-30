import { describe, expect, it } from "vitest";
import { isArtifactReferencedBySubmissionResult } from "./route";

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
});
