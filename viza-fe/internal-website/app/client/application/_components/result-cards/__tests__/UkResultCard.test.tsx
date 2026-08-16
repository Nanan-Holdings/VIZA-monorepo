import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { UkSubmissionResult } from "@/lib/submission-result";
import { UkResultCard } from "../UkResultCard";

vi.mock("next-intl", () => ({
  useLocale: () => "zh",
}));

describe("UkResultCard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps portal credentials and the force-resume handoff out of the customer UI", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const legacySecretBearingResult = {
      country: "UK",
      status: "stopped_at_pay",
      portalUrl: "https://visas-immigration.service.gov.uk/forceResume/private-token",
      portalUsername: "private@example.com",
      generatedPasswordCipher: "salt:iv:ciphertext:tag",
      applicationReference: "GWF123456789",
    } satisfies UkSubmissionResult;

    render(
      <UkResultCard
        applicationId="application-id"
        result={legacySecretBearingResult}
      />,
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("待 VIZA 自动支付")).toBeInTheDocument();
    expect(screen.getByText(/限额虚拟卡并自动支付官方费用/u)).toBeInTheDocument();
    expect(screen.queryByText("private@example.com")).not.toBeInTheDocument();
    expect(screen.queryByText("salt:iv:ciphertext:tag")).not.toBeInTheDocument();
    expect(screen.queryByText("登录邮箱")).not.toBeInTheDocument();
    expect(screen.queryByText("密码")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText(/这些最后步骤需由你本人完成/u)).not.toBeInTheDocument();
    expect(screen.queryByText(/前往 gov\.uk 核对并支付/u)).not.toBeInTheDocument();
  });

  it("starts managed official-fee payment without sending card details", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Temporary test response" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const legacySecretBearingResult = {
      country: "UK",
      status: "stopped_at_pay",
      portalUrl: "https://visas-immigration.service.gov.uk/forceResume/private-token",
      portalUsername: "private@example.com",
      generatedPasswordCipher: "salt:iv:ciphertext:tag",
    } satisfies UkSubmissionResult;

    render(
      <UkResultCard
        applicationId="application-id"
        result={legacySecretBearingResult}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "由 VIZA 自动支付官方费用" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/applications/application-id/official-fee/pay",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentMethod: "viza_managed_virtual_card" }),
        },
      );
    });
    expect(screen.getByText("Temporary test response")).toBeInTheDocument();
  });

  it("keeps uncertain portal outcomes with VIZA staff instead of asking for duplicate payment", () => {
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

    expect(screen.getByText("VIZA 正在复核")).toBeInTheDocument();
    expect(screen.getByText(/请勿前往 gov\.uk 重复付款/u)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "由 VIZA 自动支付官方费用" })).not.toBeInTheDocument();
  });

  it("shows paid only after the runner persisted official success", () => {
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

    expect(screen.getByText("已支付")).toBeInTheDocument();
    expect(screen.getByText(/保存官方回执/u)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "由 VIZA 自动支付官方费用" })).not.toBeInTheDocument();
  });
});
