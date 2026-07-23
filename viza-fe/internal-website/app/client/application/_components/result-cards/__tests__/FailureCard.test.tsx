import type { ComponentType } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FailureCard } from "../FailureCard";
import { VnResultCard } from "../VnResultCard";

vi.mock("next-intl", () => ({
  useLocale: () => "zh",
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("FailureCard", () => {
  it("shows a precise E-Visa number error instead of the legacy trip-control cascade", () => {
    render(
      <FailureCard
        errorMessage="Vietnam Pre-Arrival portal controls were not matched exactly: trip_information_form_not_ready, mode_of_travel, departure_country_before_arrival, purpose_of_travel, flight_number, accommodation_type, accommodation_address."
      />,
    );

    expect(screen.getByText("电子签证号码错误")).toBeInTheDocument();
    expect(screen.getByText(/“Số \/ No\.”后的 9 位纯数字/u)).toBeInTheDocument();
    expect(screen.getByText(/正确格式示例：106527303/u)).toBeInTheDocument();
    expect(screen.queryByText(/trip_information_form_not_ready/u)).not.toBeInTheDocument();
  });

  it("shows the same precise error for the new runner response", () => {
    render(
      <FailureCard
        errorMessage="Vietnam Pre-Arrival rejected the E-Visa number. Enter the exact 9-digit numeric value from the “Số / No.” line."
      />,
    );

    expect(screen.getByText("电子签证号码错误")).toBeInTheDocument();
    expect(screen.queryByText(/Vietnam Pre-Arrival rejected/u)).not.toBeInTheDocument();
  });

  it("shows a recoverable Chinese message for the legacy OTP dialog timeout", () => {
    render(
      <FailureCard
        errorMessage="Vietnam Pre-Arrival email verification dialog remained open after verification."
      />,
    );

    expect(screen.getByText("邮箱验证码未完成")).toBeInTheDocument();
    expect(screen.getByText(/避免重复使用旧验证码/u)).toBeInTheDocument();
    expect(screen.getByText(/无需重新填写表单/u)).toBeInTheDocument();
    expect(screen.queryByText(/dialog remained open/u)).not.toBeInTheDocument();
  });

  it("distinguishes an explicitly rejected OTP from a slow confirmation", () => {
    render(
      <FailureCard
        errorMessage="vn_prearrival_otp_rejected: Vietnam Pre-Arrival rejected the email verification code."
      />,
    );

    expect(screen.getByText("邮箱验证码未完成")).toBeInTheDocument();
    expect(screen.getByText(/验证码可能已过期或不正确/u)).toBeInTheDocument();
    expect(screen.queryByText(/vn_prearrival_otp_rejected/u)).not.toBeInTheDocument();
  });

  it("collects a one-time Vietnam payment card before live-assisted retry", async () => {
    const onRetry = vi.fn().mockResolvedValue(undefined);
    const TestFailureCard = FailureCard as ComponentType<Record<string, unknown>>;

    render(
      <TestFailureCard
        applicationId="app-vn"
        errorMessage="Form filled but registration code element not found on review screen."
        retryModes={[{ mode: "live_assisted", label: "提交" }]}
        onRetry={onRetry}
        requiresVietnamPaymentCard
      />,
    );

    fireEvent.change(screen.getByLabelText("银行卡号"), { target: { value: "4111111111111111" } });
    fireEvent.change(screen.getByLabelText("有效期"), { target: { value: "12/30" } });
    fireEvent.change(screen.getByLabelText("CVV"), { target: { value: "123" } });
    fireEvent.change(screen.getByLabelText("持卡人姓名（可选）"), { target: { value: "VIZA TEST" } });
    fireEvent.click(screen.getByRole("button", { name: /提交/u }));

    await waitFor(() => {
      expect(onRetry).toHaveBeenCalledWith("live_assisted", {
        pan: "4111111111111111",
        expiry: "12/30",
        cvv: "123",
        holderName: "VIZA TEST",
      });
    });
  });

  it("requires and forwards the real cardholder name for an Indonesia payment retry", async () => {
    const onRetry = vi.fn().mockResolvedValue(undefined);

    render(
      <FailureCard
        applicationId="app-id"
        errorMessage="印尼云端付款会话暂时不可用，请稍后重试。"
        retryModes={[{ mode: "live_assisted", label: "提交" }]}
        onRetry={onRetry}
        requiresIndonesiaPaymentCard
      />,
    );

    fireEvent.change(screen.getByLabelText("银行卡号"), { target: { value: "4111111111111111" } });
    fireEvent.change(screen.getByLabelText("有效期"), { target: { value: "12/30" } });
    fireEvent.change(screen.getByLabelText("CVV"), { target: { value: "123" } });
    expect(screen.getByRole("button", { name: /提交/u })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /提交/u }));
    expect(screen.getByRole("alert")).toHaveTextContent("持卡人姓名");
    expect(screen.getByLabelText("持卡人姓名（必填，按银行卡）")).toHaveFocus();

    fireEvent.change(screen.getByLabelText("持卡人姓名（必填，按银行卡）"), {
      target: { value: "REAL CARDHOLDER" },
    });
    fireEvent.click(screen.getByRole("button", { name: /提交/u }));

    await waitFor(() => {
      expect(onRetry).toHaveBeenCalledWith("live_assisted", {
        pan: "4111111111111111",
        expiry: "12/30",
        cvv: "123",
        holderName: "REAL CARDHOLDER",
      });
    });
  });

  it("shows a visible retry error after the loading state when submission startup fails", async () => {
    let rejectRetry: ((reason?: unknown) => void) | undefined;
    const onRetry = vi.fn().mockImplementation(() => new Promise<void>((_resolve, reject) => {
      rejectRetry = reject;
    }));

    render(
      <FailureCard
        applicationId="app-vn"
        errorMessage="Official Vietnam e-Visa portal validation blocked submission."
        retryModes={[{ mode: "live_assisted", label: "提交" }]}
        onRetry={onRetry}
        requiresVietnamPaymentCard
      />,
    );

    fireEvent.change(screen.getByLabelText("银行卡号"), { target: { value: "4111111111111111" } });
    fireEvent.change(screen.getByLabelText("有效期"), { target: { value: "12/30" } });
    fireEvent.change(screen.getByLabelText("CVV"), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: /提交/u }));

    expect(screen.getByRole("button", { name: /提交/u })).toBeDisabled();
    rejectRetry?.(new Error("越南云端付款会话暂时不可用，请稍后重试。"));

    expect(await screen.findByRole("alert")).toHaveTextContent("越南云端付款会话暂时不可用");
    await waitFor(() => {
      expect(screen.getByLabelText("银行卡号")).toHaveValue("");
      expect(screen.getByLabelText("有效期")).toHaveValue("");
      expect(screen.getByLabelText("CVV")).toHaveValue("");
      expect(screen.getByRole("button", { name: /提交/u })).toBeEnabled();
    });
  });

  it("keeps the submit action clickable and focuses the first missing card field", () => {
    const onRetry = vi.fn();

    render(
      <FailureCard
        applicationId="app-vn"
        errorMessage="Submission job failed: worker heartbeat stopped."
        retryModes={[{ mode: "live_assisted", label: "提交" }]}
        onRetry={onRetry}
        requiresVietnamPaymentCard
      />,
    );

    const submitButton = screen.getByRole("button", { name: /提交/u });
    expect(submitButton).toBeEnabled();
    fireEvent.click(submitButton);

    expect(screen.getByRole("alert")).toHaveTextContent("请填写银行卡号、有效期和 CVV");
    expect(screen.getByLabelText("银行卡号")).toHaveFocus();
    expect(onRetry).not.toHaveBeenCalled();
  });
});

describe("VnResultCard automated payment UI", () => {
  const paymentResult = {
    country: "VN" as const,
    status: "stopped_at_pay" as const,
    mode: "live_assisted" as const,
    provider: "vietnam_evisa_live" as const,
    checkpoint: "payment_page_visible",
    portalUrl: "https://evisa.gov.vn/e-visa/foreigners",
    paymentStatus: "manual_required" as const,
    manualAction: {
      type: "payment_required" as const,
      status: "open" as const,
      instructions: "Backend payment handling is required.",
    },
  };

  it("matches the simple Indonesia retry flow and hides internal payment details", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string, options?: RequestInit) => {
      if (url.endsWith("/official-fee/status")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            paymentNeedsOperator: true,
            quote: { official_fee_amount: 25, official_fee_currency: "USD" },
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => options?.body
          ? { cardSession: { redactedCard: { last4: "1111" } }, queueId: "queue-id" }
          : {},
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<VnResultCard applicationId="app-vn" result={paymentResult} />);

    await screen.findByText("重新自动付款银行卡");
    expect(screen.queryByText("payment_page_visible")).not.toBeInTheDocument();
    expect(screen.queryByText(/72%/u)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("持卡人姓名（可选）")).not.toBeInTheDocument();
    expect(screen.queryByText("需要人工操作")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("银行卡号"), { target: { value: "4111111111111111" } });
    fireEvent.change(screen.getByLabelText("有效期"), { target: { value: "12/30" } });
    fireEvent.change(screen.getByLabelText("CVV"), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: "重新自动付款" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/applications/app-vn/official-fee/pay",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            card: { pan: "4111111111111111", expiry: "12/30", cvv: "123" },
          }),
        }),
      );
    });
  });

  it("shows and keeps the Fly loading UI after restarting from an older failed queue", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith("/official-fee/status")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            paymentQueue: { id: "old-failed-queue", status: "vn_blocked" },
            paymentNeedsOperator: true,
          }),
        };
      }
      if (url.endsWith("/official-fee/pay")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            cardSession: { redactedCard: { last4: "1111" } },
            queueId: "new-cloud-queue",
            queueStatus: "vn_cloud_live_pending",
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<VnResultCard applicationId="app-vn" result={paymentResult} />);

    await screen.findByText("重新自动付款银行卡");
    fireEvent.change(screen.getByLabelText("银行卡号"), { target: { value: "4111111111111111" } });
    fireEvent.change(screen.getByLabelText("有效期"), { target: { value: "12/30" } });
    fireEvent.change(screen.getByLabelText("CVV"), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: "重新自动付款" }));

    expect(await screen.findByText("正在提交您的申请")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "提交进度" })).toBeInTheDocument();
    expect(screen.getByText("正在安全发送银行卡并启动 Fly 云端任务。")).toBeInTheDocument();
    expect(screen.queryByLabelText("银行卡号")).not.toBeInTheDocument();
  });

  it("switches to the Fly loading UI immediately when the payment button is clicked", async () => {
    let resolveAuthorize:
      | ((response: { ok: boolean; status: number; json: () => Promise<Record<string, unknown>> }) => void)
      | undefined;
    const authorizeResponse = new Promise<{
      ok: boolean;
      status: number;
      json: () => Promise<Record<string, unknown>>;
    }>((resolve) => {
      resolveAuthorize = resolve;
    });
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith("/official-fee/status")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            paymentQueue: { id: "old-failed-queue", status: "vn_blocked" },
            paymentNeedsOperator: true,
          }),
        };
      }
      if (url.endsWith("/official-fee/authorize")) {
        return authorizeResponse;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          cardSession: { redactedCard: { last4: "1111" } },
          queueId: "new-cloud-queue",
          queueStatus: "vn_cloud_live_pending",
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<VnResultCard applicationId="app-vn" result={paymentResult} />);

    await screen.findByText("重新自动付款银行卡");
    fireEvent.change(screen.getByLabelText("银行卡号"), { target: { value: "4111111111111111" } });
    fireEvent.change(screen.getByLabelText("有效期"), { target: { value: "12/30" } });
    fireEvent.change(screen.getByLabelText("CVV"), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: "重新自动付款" }));

    expect(screen.getByText("正在提交您的申请")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "提交进度" })).toBeInTheDocument();
    expect(screen.queryByLabelText("银行卡号")).not.toBeInTheDocument();

    resolveAuthorize?.({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    await waitFor(() => {
      expect(screen.getByText("正在安全发送银行卡并启动 Fly 云端任务。")).toBeInTheDocument();
    });
  });

  it("shows one processing action instead of the card form after payment is queued", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ paymentQueued: true, queueId: "queue-id" }),
    }));

    render(<VnResultCard applicationId="app-vn" result={paymentResult} />);

    await screen.findByText("正在提交您的申请");
    expect(screen.getByRole("progressbar", { name: "提交进度" })).toBeInTheDocument();
    expect(screen.getByText("正在安全发送银行卡并启动 Fly 云端任务。")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "打开越南 e-Visa 官网" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("银行卡号")).not.toBeInTheDocument();
    expect(screen.queryByText("payment_page_visible")).not.toBeInTheDocument();
  });

  it("advances the full loading UI when the Fly worker starts filling the official form", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        paymentQueued: true,
        queueId: "queue-id",
        paymentQueue: {
          id: "queue-id",
          status: "vn_live_assisted_processing",
          current_stage: "filling_fields",
        },
      }),
    }));

    render(<VnResultCard applicationId="app-vn" result={paymentResult} />);

    await screen.findByText("正在提交您的申请");
    expect(screen.getByRole("progressbar", { name: "提交进度" })).toBeInTheDocument();
    expect(screen.getByText("Fly 云端正在填写越南 e-Visa 官网表单。")).toBeInTheDocument();
    expect(screen.getAllByText("正在填写官网表单").length).toBeGreaterThan(0);
  });
});
