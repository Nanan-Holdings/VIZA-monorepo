import type { ComponentType } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FailureCard } from "../FailureCard";
import {
  localizeVietnamPaymentError,
  mergeOfficialFeeStatus,
  VnResultCard,
} from "../VnResultCard";

vi.mock("next-intl", () => ({
  useLocale: () => "zh",
}));

afterEach(() => {
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
});

describe("localizeVietnamPaymentError", () => {
  it("explains the exact safe handoff phase without exposing internals", () => {
    expect(localizeVietnamPaymentError("worker_readiness_timeout", true)).toBe(
      "云端付款服务启动超时，本次未创建付款任务，请重新提交。",
    );
    expect(localizeVietnamPaymentError("card_handoff_failed", false)).toBe(
      "The secure card session did not reach the cloud worker. No payment job was created; please resubmit.",
    );
    expect(localizeVietnamPaymentError("queue_enqueue_failed", true)).toBe(
      "云端付款任务未能创建，本次银行卡会话已取消，请重新提交。",
    );
  });

  it("does not expose browser abort internals in the Chinese UI", () => {
    expect(localizeVietnamPaymentError("signal is aborted without reason", true)).toBe(
      "状态查询暂时超时，系统会自动重新连接。",
    );
  });

  it("uses a safe Chinese fallback for unknown runtime errors", () => {
    expect(localizeVietnamPaymentError("unexpected worker transport failure", true)).toBe(
      "官网处理暂时未完成，系统会自动更新；如果长时间没有变化，请联系支持。",
    );
  });
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

  it("hides managed-inbox timeout internals and explains email forwarding recovery", async () => {
    const onRetry = vi.fn();

    render(
      <FailureCard
        applicationId="app-vn-prearrival"
        errorMessage="inbox.waitForMessage timeout after 300000ms for applicant private-applicant-id"
        retryModes={[{ mode: "live_assisted", label: "提交" }]}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText("邮箱验证码未完成")).toBeInTheDocument();
    expect(screen.getByText(/验证码邮件没有送达 VIZA 的托管收件箱/u)).toBeInTheDocument();
    expect(screen.getByText(/成功确认邮件、二维码和附件会继续转发到你的真实邮箱/u)).toBeInTheDocument();
    expect(screen.getByText(/可以点击下方“提交”创建新的云端任务/u)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /检查并授权官方邮件转发/u })).toHaveAttribute(
      "href",
      "/client/consent?applicationId=app-vn-prearrival",
    );
    const submitButton = screen.getByRole("button", { name: "提交" });
    expect(submitButton).toBeEnabled();
    fireEvent.click(submitButton);
    await waitFor(() => {
      expect(onRetry).toHaveBeenCalledWith("live_assisted", undefined);
    });
    expect(screen.queryByText(/private-applicant-id/u)).not.toBeInTheDocument();
    expect(screen.queryByText(/inbox\.waitForMessage/u)).not.toBeInTheDocument();
  });

  it("links the applicant to forwarding consent before starting Vietnam Pre-Arrival", () => {
    render(
      <FailureCard
        applicationId="app-vn-prearrival"
        errorMessage="vn_prearrival_email_forwarding_consent_required: Official email forwarding authorization is required."
      />,
    );

    expect(screen.getByText("请先授权官方邮件转发")).toBeInTheDocument();
    expect(screen.getByText(/二维码、PDF 和附件原样转发到你的真实邮箱/u)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /授权官方邮件转发/u })).toHaveAttribute(
      "href",
      "/client/consent?applicationId=app-vn-prearrival",
    );
    expect(screen.queryByText(/vn_prearrival_email_forwarding_consent_required/u)).not.toBeInTheDocument();
  });

  it("maps an unroutable managed inbox to the recoverable email delivery state", () => {
    render(
      <FailureCard
        errorMessage="vn_prearrival_otp_inbox_unroutable: Managed inbox domain haggstorm.com cannot receive email because it has no usable MX record."
      />,
    );

    expect(screen.getByText("邮箱验证码未完成")).toBeInTheDocument();
    expect(screen.getByText(/验证码邮件没有送达 VIZA 的托管收件箱/u)).toBeInTheDocument();
    expect(screen.queryByText(/haggstorm\.com/u)).not.toBeInTheDocument();
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
    expect(screen.getByText("重试失败").closest('[role="alert"]')).toHaveTextContent("持卡人姓名");
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

  it("shows a visible retry error and keeps the in-memory card after startup fails", async () => {
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
      expect(screen.getByLabelText("银行卡号")).toHaveValue("4111111111111111");
      expect(screen.getByLabelText("有效期")).toHaveValue("12/30");
      expect(screen.getByLabelText("CVV")).toHaveValue("123");
      expect(screen.getByRole("button", { name: /提交/u })).toBeEnabled();
    });
  });

  it("submits native browser-autofilled card values even without React change events", async () => {
    const onRetry = vi.fn().mockResolvedValue(undefined);

    render(
      <FailureCard
        applicationId="app-vn"
        errorMessage="Official Vietnam e-Visa portal validation blocked submission."
        retryModes={[{ mode: "live_assisted", label: "提交" }]}
        onRetry={onRetry}
        requiresVietnamPaymentCard
      />,
    );

    const cardNumber = screen.getByLabelText("银行卡号") as HTMLInputElement;
    const cardExpiry = screen.getByLabelText("有效期") as HTMLInputElement;
    const cardCvv = screen.getByLabelText("CVV") as HTMLInputElement;
    cardNumber.value = "4111111111111111";
    cardExpiry.value = "12/30";
    cardCvv.value = "123";

    fireEvent.click(screen.getByRole("button", { name: /提交/u }));

    await waitFor(() => {
      expect(onRetry).toHaveBeenCalledWith("live_assisted", {
        pan: "4111111111111111",
        expiry: "12/30",
        cvv: "123",
        holderName: "",
      });
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

    expect(screen.getByText("重试失败").closest('[role="alert"]')).toHaveTextContent("请填写银行卡号、有效期和 CVV");
    expect(screen.getByLabelText("银行卡号")).toHaveFocus();
    expect(onRetry).not.toHaveBeenCalled();
  });
});

describe("VnResultCard automated payment UI", () => {
  it("keeps the authorized queue stage when a later status payload omits the queue", () => {
    const authorizedQueue = {
      id: "queue-authorized",
      status: "vn_live_assisted_processing",
      current_stage: "starting",
      payment_status: "authorized",
    };

    expect(
      mergeOfficialFeeStatus(
        {
          paymentQueued: true,
          queueId: "queue-authorized",
          paymentQueue: authorizedQueue,
        },
        { paymentQueued: true, queueId: "queue-authorized" },
      ),
    ).toMatchObject({
      paymentQueued: true,
      queueId: "queue-authorized",
      paymentQueue: authorizedQueue,
    });
  });

  it("lets a terminal status response clear the optimistic queued flag", () => {
    expect(
      mergeOfficialFeeStatus(
        {
          paymentQueued: true,
          paymentNeedsOperator: false,
          queueId: "queue-authorized",
        },
        {
          paymentQueued: false,
          paymentNeedsOperator: true,
          paymentQueue: {
            id: "queue-authorized",
            status: "vn_blocked",
            payment_status: "manual_review",
          },
        },
      ),
    ).toMatchObject({
      paymentQueued: false,
      paymentNeedsOperator: true,
      paymentQueue: {
        status: "vn_blocked",
        payment_status: "manual_review",
      },
    });
  });

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

  it("shows one concise retry message at the bank-confirmation checkpoint", async () => {
    const bankConfirmationResult = {
      ...paymentResult,
      portalUrl: "https://pay.vnpay.vn/transaction",
      manualAction: {
        type: "payment_required" as const,
        status: "open" as const,
        instructions: "Internal payment diagnostic that must stay hidden.",
      },
    };
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (url: string) => {
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
      if (url.endsWith("/manual-actions")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            manualActions: [{
              id: "manual-action-id",
              actionType: "payment_required",
              status: "pending",
              instruction: "Internal manual action details.",
              screenshotUrl: "/private/payment-diagnostic.png",
            }],
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      };
    }));

    render(
      <VnResultCard
        applicationId="app-vn-bank-confirmation"
        jobId="job-vn-bank-confirmation"
        result={bankConfirmationResult}
      />,
    );

    expect(
      await screen.findByText("付款失败，请在手机银行里确认。现在可重新提交。"),
    ).toBeInTheDocument();
    expect(screen.getByText("重新自动付款银行卡")).toBeInTheDocument();
    expect(screen.queryByText("自动处理中")).not.toBeInTheDocument();
    expect(screen.queryByText("需要人工操作")).not.toBeInTheDocument();
    expect(screen.queryByText("Internal payment diagnostic that must stay hidden.")).not.toBeInTheDocument();
    expect(screen.queryByText("Internal manual action details.")).not.toBeInTheDocument();
    expect(screen.queryByText("/private/payment-diagnostic.png")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "我已在官网完成，继续" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "等待银行 App 验证结果" })).not.toBeInTheDocument();
  });

  it("shows and keeps the Fly loading UI after restarting from an older failed queue", async () => {
    window.sessionStorage.setItem(
      "viza:smooth-progress:submission-run:old-failed-queue",
      "88",
    );
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
    expect(screen.getByRole("progressbar", { name: "提交进度" })).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
    expect(screen.getByText("正在整理并校验官网所需的英文答案。")).toBeInTheDocument();
    expect(screen.queryByText("Fly 云端已到达官方付款阶段，正在等待支付结果或银行验证。"))
      .not.toBeInTheDocument();
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

  it("paces the form-filling backend stage from the first visual phase", async () => {
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
    expect(screen.getByText("正在整理并校验官网所需的英文答案。")).toBeInTheDocument();
    expect(screen.queryByText("Fly 云端正在填写越南 e-Visa 官网表单。"))
      .not.toBeInTheDocument();
    const firstPhase = screen
      .getAllByText("正在校验英文版答案")
      .find((element) => element.closest("ol"));
    expect(firstPhase?.closest("li")).toHaveClass("border-brand-500");
  });

  it("paces an authorized payment handoff from the first visual phase", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        paymentQueued: true,
        queueId: "queue-id",
        paymentQueue: {
          id: "queue-id",
          status: "vn_live_assisted_processing",
          current_stage: "starting",
          payment_status: "authorized",
        },
      }),
    }));

    render(<VnResultCard applicationId="app-vn-authorized" result={paymentResult} />);

    await screen.findByText("正在提交您的申请");
    expect(screen.getByText("正在整理并校验官网所需的英文答案。")).toBeInTheDocument();
    expect(screen.queryByText("Fly 云端已到达官方付款阶段，正在等待支付结果或银行验证。"))
      .not.toBeInTheDocument();
    const firstPhase = screen
      .getAllByText("正在校验英文版答案")
      .find((element) => element.closest("ol"));
    expect(firstPhase?.closest("li")).toHaveClass("border-brand-500");
  });
});
