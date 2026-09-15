import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { VnSubmissionResult } from "@/lib/submission-result";
import { VnResultCard } from "../VnResultCard";

vi.mock("next-intl", () => ({
  useLocale: () => "zh",
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

const feeCheckpointResult: VnSubmissionResult = {
  country: "VN",
  status: "stopped_at_pay",
  mode: "live_assisted",
  provider: "vietnam_evisa_live",
  checkpoint: "payment_page_visible",
  portalUrl: "https://evisa.gov.vn/e-visa/foreigners",
  paymentStatus: "manual_required",
};

describe("VnResultCard payment-free checkpoint", () => {
  it("shows neutral attention copy without polling or payment controls", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<VnResultCard applicationId="app-vn" result={feeCheckpointResult} />);

    expect(screen.getAllByText("需要处理")).toHaveLength(2);
    expect(
      screen.getByText("需要处理，VIZA 自动付款已移除。请联系支持人员确认官方流程的下一步。"),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText(/虚拟卡|自动付款处理中|官方费用/u)).not.toBeInTheDocument();
  });

  it("keeps a legacy registration code visible while hiding fee handling", () => {
    render(
      <VnResultCard
        applicationId="app-vn"
        result={{ ...feeCheckpointResult, registrationCode: "VN-REG-123" }}
      />,
    );

    expect(screen.getByText("VN-REG-123")).toBeInTheDocument();
    expect(screen.getByText("官网登记编号")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("retains completion for a non-payment manual action", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        manualActions: [{
          id: "manual-action-id",
          actionType: "captcha_required",
          status: "pending",
          instruction: "Complete the official CAPTCHA.",
          screenshotUrl: "/private/captcha.png",
        }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const result: VnSubmissionResult = {
      country: "VN",
      status: "captcha_required",
      mode: "live_assisted",
      provider: "vietnam_evisa_live",
      manualAction: {
        type: "captcha_required",
        status: "open",
        instructions: "Complete the official CAPTCHA.",
      },
    };

    render(<VnResultCard applicationId="app-vn" jobId="job-vn" result={result} />);

    const completeButton = await screen.findByRole("button", { name: "我已在官网完成，继续" });
    expect(fetchMock).toHaveBeenCalledWith("/api/submissions/job-vn/manual-actions", {
      cache: "no-store",
    });
    fireEvent.click(completeButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/submissions/job-vn/manual-actions/manual-action-id/complete",
        { method: "POST" },
      );
    });
  });
});
