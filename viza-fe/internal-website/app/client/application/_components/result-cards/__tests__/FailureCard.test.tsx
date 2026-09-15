import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FailureCard } from "../FailureCard";

vi.mock("next-intl", () => ({
  useLocale: () => "zh",
}));

afterEach(() => {
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
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
      expect(onRetry).toHaveBeenCalledWith("live_assisted");
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


});
