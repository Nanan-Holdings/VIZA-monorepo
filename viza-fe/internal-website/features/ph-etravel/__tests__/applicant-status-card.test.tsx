import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { PhEtravelApplicantStatusCard } from "../PhEtravelApplicantStatusCard";

vi.mock("next-intl", () => ({
  useLocale: () => "zh",
}));

vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,ph-etravel"),
  },
}));

describe("PhEtravelApplicantStatusCard", () => {
  test("shows scheduled as a read-only refresh state without a submit action", () => {
    render(
      <PhEtravelApplicantStatusCard
        applicationId="application-id"
        status={{ status: "scheduled", queueStatus: "phetravel_live_assisted_scheduled" }}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByText("eTravel 已安排")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "刷新状态" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "提交" })).not.toBeInTheDocument();
  });

  test("shows queued separately from active processing", () => {
    const { rerender } = render(
      <PhEtravelApplicantStatusCard
        applicationId="application-id"
        status={{ queueStatus: "queued" }}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByText("eTravel 已排队")).toBeInTheDocument();

    rerender(
      <PhEtravelApplicantStatusCard
        applicationId="application-id"
        status={{ queueStatus: "running" }}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByText("eTravel 正在处理")).toBeInTheDocument();
  });

  test("renders a QR only from the same authoritative reference", async () => {
    render(
      <PhEtravelApplicantStatusCard
        applicationId="application-id"
        status={{
          status: "completed",
          result: {
            country: "PH",
            resultEvidence: {
              authoritativeRead: {
                source: "official_registration_result_read",
                postSubmitRead: true,
                stableReference: true,
                referenceNumber: "ETR-123",
              },
              qrRender: {
                renderer: "official_client_reference_qr",
                rendered: true,
                renderedForReference: "ETR-123",
                referenceValueValidated: true,
              },
            },
          },
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("ETR-123")).toBeInTheDocument();
      expect(screen.getByAltText("菲律宾 eTravel 参考号二维码")).toHaveAttribute(
        "src",
        "data:image/png;base64,ph-etravel",
      );
    });
  });

  test("keeps local reference-only results in recovery with no resubmit", () => {
    render(
      <PhEtravelApplicantStatusCard
        applicationId="application-id"
        status={{
          status: "submitted",
          result: { country: "PH", referenceNumber: "LOCAL-ONLY" },
        }}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByText("正在确认官方结果")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重新读取官方结果状态" })).toBeInTheDocument();
    expect(screen.queryByAltText("菲律宾 eTravel 参考号二维码")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "提交" })).not.toBeInTheDocument();
  });
});
