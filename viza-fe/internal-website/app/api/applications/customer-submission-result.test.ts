import { describe, expect, it } from "vitest";
import { sanitizeCustomerSubmissionResult } from "./customer-submission-result";

describe("sanitizeCustomerSubmissionResult", () => {
  it("removes UK portal credentials and the force-resume URL", () => {
    const result = sanitizeCustomerSubmissionResult({
      country: "UK",
      status: "stopped_at_pay",
      portalUrl: "https://visas-immigration.service.gov.uk/forceResume/private-token",
      portalUsername: "private@example.com",
      generatedPasswordCipher: "salt:iv:ciphertext:tag",
      credentials: { password: "secret" },
      applicationReference: "GWF123456789",
      prefillProgress: { pagesFilled: 44, pagesSkipped: 0, totalPages: 44 },
    });

    expect(result).toEqual({
      country: "UK",
      status: "stopped_at_pay",
      applicationReference: "GWF123456789",
      prefillProgress: { pagesFilled: 44, pagesSkipped: 0, totalPages: 44 },
    });
  });

  it("does not rewrite other country result contracts", () => {
    const result = { country: "VN", status: "submitted_pending_email" };
    expect(sanitizeCustomerSubmissionResult(result)).toBe(result);
  });
});
