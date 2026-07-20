import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DigitalArrivalCardSubmissionResult } from "@/lib/submission-result";
import {
  DigitalArrivalCardResultCard,
  SubmissionStatusStep,
} from "../SubmissionStatusStep";

vi.mock("next-intl", () => ({
  useLocale: () => "zh",
}));

describe("DigitalArrivalCardResultCard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows downloadable Vietnam QR and PDF artifacts", () => {
    const result: DigitalArrivalCardSubmissionResult = {
      country: "VN",
      visaType: "VN_PREARRIVAL_DECLARATION",
      status: "submitted",
      mode: "live_assisted",
      provider: "vietnam_prearrival_live",
      applicationId: "application-id",
      submitted: true,
      confirmationNumber: "DE123456789",
      referenceNumber: "DE123456789",
      portalUrl: "https://prearrival.immigration.gov.vn/",
      portalResponseSummary: "Official confirmation captured.",
      confirmationPdfStoragePath:
        "user/application-id/VN/vn-prearrival-confirmation-pdf-1.pdf",
      artifacts: {
        screenshots: [],
        qrCodes: ["user/application-id/VN/vn-prearrival-qr-1.png"],
        pdfs: ["user/application-id/VN/vn-prearrival-confirmation-pdf-1.pdf"],
        logs: ["vn_prearrival_qr_saved", "vn_prearrival_pdf_downloaded"],
        traces: [],
      },
      payloadSummary: {
        accommodationAddressProvided: true,
      },
    };

    render(<DigitalArrivalCardResultCard result={result} />);

    expect(screen.getByText("Vietnam Pre-Arrival 提交成功")).toBeInTheDocument();
    expect(screen.getByAltText("越南入境前申报官方二维码")).toHaveAttribute(
      "src",
      expect.stringContaining("vn-prearrival-qr-1.png"),
    );
    expect(screen.getByRole("button", { name: "下载确认文件" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "下载官方二维码" })).toHaveAttribute(
      "href",
      expect.stringContaining("vn-prearrival-qr-1.png"),
    );
  });

  it("keeps polling an incomplete Vietnam result and switches to the QR download", async () => {
    const awaitingQr: DigitalArrivalCardSubmissionResult = {
      country: "VN",
      visaType: "VN_PREARRIVAL_DECLARATION",
      status: "submitted",
      mode: "live_assisted",
      provider: "vietnam_prearrival_live",
      applicationId: "application-id",
      submitted: true,
      confirmationNumber: null,
      referenceNumber: null,
      portalUrl: "https://prearrival.immigration.gov.vn/",
      portalResponseSummary: "The official portal is finalizing the result.",
      artifacts: {
        screenshots: [],
        qrCodes: [],
        pdfs: [],
        logs: ["vn_prearrival_official_finalizing_visible"],
        traces: [],
      },
      payloadSummary: {
        accommodationAddressProvided: true,
      },
    };
    const completed: DigitalArrivalCardSubmissionResult = {
      ...awaitingQr,
      confirmationNumber: "DE123456789",
      referenceNumber: "DE123456789",
      confirmationPdfStoragePath:
        "user/application-id/VN/vn-prearrival-confirmation-pdf-1.pdf",
      portalResponseSummary: "Official confirmation captured.",
      artifacts: {
        screenshots: [],
        qrCodes: ["user/application-id/VN/vn-prearrival-qr-1.png"],
        pdfs: ["user/application-id/VN/vn-prearrival-confirmation-pdf-1.pdf"],
        logs: ["vn_prearrival_qr_saved", "vn_prearrival_pdf_downloaded"],
        traces: [],
      },
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: "completed",
        stage: "completed",
        progress: 100,
        result: completed,
        error: null,
        message: "Submission completed.",
        updatedAt: new Date().toISOString(),
        applicationStatus: "completed",
        country: "VN",
        visaType: "VN_PREARRIVAL_DECLARATION",
        queue: null,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <SubmissionStatusStep
        applicationId="application-id"
        country="vietnam"
        visaType="VN_PREARRIVAL_DECLARATION"
        status="waiting"
        result={awaitingQr}
      />,
    );

    expect(
      screen.getByText(
        "官网已接收申报。系统每 3 秒自动检查一次；二维码生成后，本页面会立即显示提交成功和下载按钮。",
      ),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Vietnam Pre-Arrival 提交成功")).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/applications/application-id/submission-status",
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(screen.getByRole("link", { name: "下载官方二维码" })).toHaveAttribute(
      "href",
      expect.stringContaining("vn-prearrival-qr-1.png"),
    );
  });

  it("treats a terminal Vietnam result without a QR as failed and retries it", async () => {
    const awaitingQr: DigitalArrivalCardSubmissionResult = {
      country: "VN",
      visaType: "VN_PREARRIVAL_DECLARATION",
      status: "submitted",
      mode: "live_assisted",
      provider: "vietnam_prearrival_live",
      applicationId: "application-id",
      submitted: true,
      confirmationNumber: null,
      referenceNumber: null,
      portalUrl: "https://prearrival.immigration.gov.vn/",
      portalResponseSummary: "The old runner did not retain the QR.",
      artifacts: { screenshots: [], qrCodes: [], pdfs: [], logs: [], traces: [] },
      payloadSummary: { accommodationAddressProvided: true },
    };
    const fetchMock = vi.fn().mockImplementation(
      async (url: string, options?: RequestInit) => {
        if (options?.method === "POST") {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ok: true,
              jobId: "retry-queue-id",
              queueStatus: "vn_prearrival_live_assisted_pending",
              provider: "vietnam_prearrival_live",
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: "completed",
            stage: "completed",
            progress: 100,
            result: awaitingQr,
            error: null,
            message: "Submission completed.",
            updatedAt: new Date().toISOString(),
            applicationStatus: "completed",
            country: "VN",
            visaType: "VN_PREARRIVAL_DECLARATION",
            queue: {
              id: "queue-id",
              status: "done",
              mode: "live_assisted",
              provider: "vietnam_prearrival_live",
            },
          }),
        };
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <SubmissionStatusStep
        applicationId="application-id"
        country="vietnam"
        visaType="VN_PREARRIVAL_DECLARATION"
        status="completed"
        result={awaitingQr}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("提交没有完成")).toBeInTheDocument();
    });
    expect(screen.queryByText("官网二维码未同步")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("上传已收到的官方二维码")).not.toBeInTheDocument();
    expect(
      screen.getByText(/没有获取并保存可下载的官方二维码/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "提交" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/applications/application-id/retry-submission",
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/applications/application-id/retry-submission",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
