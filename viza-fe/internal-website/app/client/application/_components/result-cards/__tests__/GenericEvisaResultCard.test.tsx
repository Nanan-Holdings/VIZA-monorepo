import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GenericEvisaResultCard } from "../GenericEvisaResultCard";
import type { GenericEvisaSubmissionResult } from "@/lib/submission-result";

vi.mock("next-intl", () => ({
  useLocale: () => "zh",
}));

describe("GenericEvisaResultCard", () => {
  it("shows Indonesia one-time-card autopay copy at the user payment checkpoint", () => {
    const result = {
      country: "ID",
      status: "stopped_at_pay",
      checkpoint: "user_payment_required",
      portalUrl: "https://live.finpay.id/payment/test",
    } as GenericEvisaSubmissionResult & { checkpoint: string };

    render(
      <GenericEvisaResultCard
        applicationId="app-id"
        applicationCountry="indonesia"
        applicationVisaType="ID_B1_EVOA"
        result={result}
      />,
    );

    expect(screen.getByText("等待银行验证")).toBeInTheDocument();
    expect(screen.getByText(/VIZA 已经把你的银行卡提交到官方付款页/u)).toBeInTheDocument();
    expect(screen.queryByText(/请在那个窗口里完成银行卡付款/u)).not.toBeInTheDocument();
  });
});
