import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("restarts Indonesia automated payment with a fresh one-time card session", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({ cardSession: { redactedCard: { last4: "4242" } }, queueId: "queue-id" }),
      });
    vi.stubGlobal("fetch", fetchMock);

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

    fireEvent.change(screen.getByLabelText("银行卡号"), { target: { value: "4111111111114242" } });
    fireEvent.change(screen.getByLabelText("有效期"), { target: { value: "12/30" } });
    fireEvent.change(screen.getByLabelText("CVV"), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: /重新自动付款/u }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/applications/app-id/official-fee/pay",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          card: {
            pan: "4111111111114242",
            expiry: "12/30",
            cvv: "123",
          },
        }),
      }),
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/applications/app-id/retry-submission",
      expect.anything(),
    );
  });
});
