import { describe, expect, it } from "vitest";
import {
  DS160_PROOF_EMAIL_ERROR_CODE,
  DS160_PROOF_EMAIL_UNAVAILABLE_CODE,
  DS160_PROOF_QUEUE_STATUS,
  buildDs160ProofDownloadUrl,
  ds160ProofEmailFailureResponse,
  ds160ProofEmailUnavailableResponse,
  resolveDs160ProofAction,
  type Ds160ProofKind,
} from "../ds160-proof";

describe("DS-160 proof actions", () => {
  it("returns a safe email failure payload without provider configuration details", () => {
    const response = ds160ProofEmailFailureResponse();

    expect(response.code).toBe(DS160_PROOF_EMAIL_ERROR_CODE);
    expect(response.error).toContain("saved");
    expect(response.error).toContain("download");
    expect(response.error).not.toMatch(/RESEND|NOTIFY_FROM_EMAIL|\.env/u);
  });

  it("returns a separate safe payload when the proof email artifact is unavailable", () => {
    const response = ds160ProofEmailUnavailableResponse();

    expect(response.code).toBe(DS160_PROOF_EMAIL_UNAVAILABLE_CODE);
    expect(response.error).not.toMatch(/RESEND|NOTIFY_FROM_EMAIL|\.env/u);
  });

  it.each([
    ["confirmation", "confirmationPdfStoragePath", "ds160-confirmation-AA00FLSF69.pdf"],
    ["application", "applicationPdfStoragePath", "ds160-application-AA00FLSF69.pdf"],
    ["email-confirmation", "emailConfirmationPdfStoragePath", "ds160-email-confirmation-AA00FLSF69.pdf"],
  ] as const)("returns a download URL when %s already exists", (kind, pathKey, fileName) => {
    const result = {
      country: "US",
      status: "submitted",
      applicationId: "AA00FLSF69",
      [pathKey]: `user/app/US/${kind}.pdf`,
    };

    expect(resolveDs160ProofAction("app", kind, result)).toEqual({
      status: "ready",
      downloadUrl: buildDs160ProofDownloadUrl("app", `user/app/US/${kind}.pdf`, fileName),
      storagePath: `user/app/US/${kind}.pdf`,
    });
  });

  it("allows email confirmation to reuse the confirmation PDF path", () => {
    const result = {
      country: "US",
      status: "submitted",
      applicationId: "AA00FLSF69",
      confirmationPdfStoragePath: "user/app/US/confirmation.pdf",
    };

    expect(resolveDs160ProofAction("app", "email-confirmation", result)).toMatchObject({
      status: "ready",
      storagePath: "user/app/US/confirmation.pdf",
    });
  });

  it("requests proof recovery without clearing the submitted result when a PDF is missing", () => {
    const result = {
      country: "US",
      status: "submitted",
      applicationId: "AA00FLSF69",
    };

    expect(resolveDs160ProofAction("app", "application", result)).toEqual({
      status: "queued",
      queueStatus: DS160_PROOF_QUEUE_STATUS,
    });
  });

  it("rejects non-US or unsubmitted results", () => {
    expect(resolveDs160ProofAction("app", "confirmation", { country: "VN" })).toEqual({
      status: "unsupported",
      reason: "DS-160 proof recovery requires a submitted US DS-160 result.",
    });
  });

  it.each(["confirmation", "application", "email-confirmation"] satisfies Ds160ProofKind[])(
    "builds stable URLs for %s",
    (kind) => {
      const action = resolveDs160ProofAction("app id", kind, {
        country: "US",
        status: "submitted",
        applicationId: "AA00FLSF69",
        confirmationPdfStoragePath: "u/app id/US/confirmation.pdf",
        applicationPdfStoragePath: "u/app id/US/application.pdf",
      });

      if (action.status === "ready") {
        expect(action.downloadUrl).toContain("/api/applications/app%20id/submission-artifact?");
        expect(action.downloadUrl).toContain("download=ds160-");
      }
    },
  );
});
