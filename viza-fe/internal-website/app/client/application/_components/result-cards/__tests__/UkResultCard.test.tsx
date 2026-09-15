import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { UkSubmissionResult } from "@/lib/submission-result";
import { UkResultCard } from "../UkResultCard";

vi.mock("next-intl", () => ({
  useLocale: () => "zh",
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

const legacySecretBearingResult = {
  country: "UK" as const,
  status: "stopped_at_pay" as const,
  portalUrl: "https://visas-immigration.service.gov.uk/forceResume/private-token",
  portalUsername: "private@example.com",
  generatedPasswordCipher: "salt:iv:ciphertext:tag",
  applicationReference: "GWF123456789",
} satisfies UkSubmissionResult;

describe("UkResultCard", () => {
  it("shows a neutral needs-attention state without credentials or payment controls", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <UkResultCard
        applicationId="application-id"
        result={legacySecretBearingResult}
      />,
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("需要处理")).toBeInTheDocument();
    expect(
      screen.getByText("需要处理，VIZA 自动付款已移除。请联系支持人员确认官方流程的下一步。"),
    ).toBeInTheDocument();
    expect(screen.getByText("GWF123456789")).toBeInTheDocument();
    expect(screen.queryByText("private@example.com")).not.toBeInTheDocument();
    expect(screen.queryByText("salt:iv:ciphertext:tag")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("does not send a request when a legacy fee checkpoint is rendered", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <UkResultCard
        applicationId="application-id"
        result={{ ...legacySecretBearingResult, status: "funding_required" }}
      />,
    );

    expect(screen.getByText("需要处理")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /自动|支付/u })).not.toBeInTheDocument();
  });

  it("maps uncertain portal outcomes to the same neutral state", () => {
    render(
      <UkResultCard
        applicationId="application-id"
        result={{
          country: "UK",
          status: "payment_review_required",
          paymentStatus: "review_required",
          staffReviewCode: "uk_payment_3ds_review",
        }}
      />,
    );

    expect(screen.getByText("需要处理")).toBeInTheDocument();
    expect(
      screen.getByText("需要处理，VIZA 自动付款已移除。请联系支持人员确认官方流程的下一步。"),
    ).toBeInTheDocument();
    expect(screen.queryByText("VIZA 正在复核")).not.toBeInTheDocument();
  });

  it("does not claim that a legacy paid status was completed", () => {
    render(
      <UkResultCard
        applicationId="application-id"
        result={{
          country: "UK",
          status: "paid",
          paymentStatus: "paid",
          officialFeeReceiptId: "GWF123456789",
        }}
      />,
    );

    expect(screen.getByText("需要处理")).toBeInTheDocument();
    expect(screen.getByText(/自动付款已移除/u)).toBeInTheDocument();
    expect(screen.queryByText("已支付")).not.toBeInTheDocument();
    expect(screen.queryByText(/保存官方回执/u)).not.toBeInTheDocument();
  });

  it("keeps ordinary gov.uk prefill retry available", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("confirm", vi.fn(() => true));

    render(
      <UkResultCard
        applicationId="application-id"
        applicationCountry="UK"
        applicationVisaType="UK_STANDARD_VISITOR"
        result={{ country: "UK", status: "registered" }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "重新提交到 gov.uk" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/applications/application-id/retry-submission",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });
});
