import type { ComponentType } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FailureCard } from "../FailureCard";

vi.mock("next-intl", () => ({
  useLocale: () => "zh",
}));

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
});
