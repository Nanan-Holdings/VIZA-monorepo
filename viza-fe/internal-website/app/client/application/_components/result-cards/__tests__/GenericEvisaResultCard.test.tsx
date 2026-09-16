import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GenericEvisaResultCard } from "../GenericEvisaResultCard";
import type { GenericEvisaSubmissionResult } from "@/lib/submission-result";

vi.mock("next-intl", () => ({
  useLocale: () => "zh",
}));

describe("GenericEvisaResultCard", () => {
  it("shows Indonesia needs-attention guidance without payment controls", () => {
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

    expect(screen.getByText("需要关注")).toBeInTheDocument();
    expect(
      screen.getByText(
        "你的印度尼西亚申请需要在官网完成后续步骤。请联系支持团队获取下一步指引。",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows non-Indonesia needs-attention guidance without payment controls", () => {
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

    expect(screen.getByText("需要关注")).toBeInTheDocument();
    expect(
      screen.getByText("你的埃及申请需要在官网完成后续步骤。请联系支持团队获取下一步指引。"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
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
