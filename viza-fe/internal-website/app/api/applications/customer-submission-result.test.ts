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

  it("removes nested payment and mailbox secrets while preserving Kenya evidence", () => {
    const result = {
      country: "KE",
      visaType: "KE_ETA",
      status: "approved",
      officialReference: "ETA-123",
      portalUrl: "https://etakenya.go.ke/",
      approvalPdfStoragePath: "ke/approval.pdf",
      paymentReceipt: "ke/payment-receipt.pdf",
      payment: {
        cardNumber: "4111111111111111",
        cvv: "123",
        otp: "123456",
      },
      mailbox: { accessToken: "token", email: "alias@example.test" },
    };

    expect(sanitizeCustomerSubmissionResult(result)).toEqual({
      country: "KE",
      visaType: "KE_ETA",
      status: "approved",
      officialReference: "ETA-123",
      portalUrl: "https://etakenya.go.ke/",
      approvalPdfStoragePath: "ke/approval.pdf",
      paymentReceipt: "ke/payment-receipt.pdf",
      payment: {},
      mailbox: { email: "alias@example.test" },
    });
  });

  it("keeps a safe Japan QR result object unchanged", () => {
    const result = {
      country: "JP",
      visaType: "JP_VISIT_JAPAN_WEB",
      status: "qr_ready",
      qrReady: true,
      portalUrl: "https://www.vjw.digital.go.jp/",
      artifacts: { qrCodes: ["jp/qr.png"] },
    };

    expect(sanitizeCustomerSubmissionResult(result)).toBe(result);
  });
});
