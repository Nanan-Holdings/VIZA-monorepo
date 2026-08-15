import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GenericEvisaResultCard } from "../GenericEvisaResultCard";
import type { GenericEvisaSubmissionResult } from "@/lib/submission-result";

vi.mock("next-intl", () => ({
  useLocale: () => "zh",
}));

describe("GenericEvisaResultCard", () => {
  it("keeps Indonesia payment inside VIZA without manual portal controls", () => {
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

    expect(screen.getByText("VIZA 正在处理付款")).toBeInTheDocument();
    expect(screen.getByText(/本申请专属的一次性虚拟卡/u)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "由 VIZA 继续支付官网费用" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /打开官方付款页/u })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /刷新状态/u })).not.toBeInTheDocument();
  });

  it("never links applicants to a non-Indonesia portal to pay directly", () => {
    const result = {
      country: "EG",
      status: "stopped_at_pay",
      portalUrl: "https://example.gov.test/pay",
    } satisfies GenericEvisaSubmissionResult;

    render(
      <GenericEvisaResultCard
        applicationId="app-id"
        applicationCountry="egypt"
        applicationVisaType="EG_E_VISA"
        result={result}
      />,
    );

    expect(screen.getByRole("button", { name: "由 VIZA 继续支付官网费用" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /付款/u })).not.toBeInTheDocument();
    expect(screen.queryByText(/请在官方页面完成付款/u)).not.toBeInTheDocument();
  });

  it("shows official evidence and status tracking only after confirmed success", () => {
    const result = {
      country: "ID",
      status: "submitted",
      reference: "ID-REF-123456",
      artifactStoragePath: "owner/app-id/ID/evidence.pdf",
    } satisfies GenericEvisaSubmissionResult;

    render(
      <GenericEvisaResultCard
        applicationId="app-id"
        applicationCountry="indonesia"
        applicationVisaType="ID_B1_EVOA"
        result={result}
      />,
    );

    expect(screen.getByText("ID-REF-123456")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "下载官网成功凭证" })).toHaveAttribute(
      "href",
      "/api/applications/app-id/evisa-artifact",
    );
    expect(screen.getByRole("link", { name: /Track status/u })).toHaveAttribute("href", "/client/status");
  });
});
