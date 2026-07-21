import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GenericEvisaResultCard } from "../GenericEvisaResultCard";
import type { GenericEvisaSubmissionResult } from "@/lib/submission-result";

vi.mock("next-intl", () => ({
  useLocale: () => "zh",
}));

describe("GenericEvisaResultCard", () => {
  it("shows Indonesia payment as automatic cloud processing without manual payment controls", () => {
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

    expect(screen.getByText("云端处理中")).toBeInTheDocument();
    expect(screen.getByText(/正在自动确认银行和印尼官网的最终结果/u)).toBeInTheDocument();
    expect(screen.getByText(/正在确认官方付款结果/u)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /打开官方付款页/u })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /刷新状态/u })).not.toBeInTheDocument();
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
