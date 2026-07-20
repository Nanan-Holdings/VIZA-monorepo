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
        status="completed"
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

  it("stops stale 99% progress and restores the result from a received QR image", async () => {
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
    const recovered: DigitalArrivalCardSubmissionResult = {
      ...awaitingQr,
      portalResponseSummary: "Official QR recovered.",
      artifacts: {
        screenshots: [],
        qrCodes: ["user/application-id/VN/vn-prearrival-qr-recovered.png"],
        pdfs: [],
        logs: ["vn_prearrival_qr_recovered_from_applicant"],
        traces: [],
      },
    };
    const fetchMock = vi.fn().mockImplementation(
      async (_url: string, options?: RequestInit) => {
        if (options?.method === "POST") {
          return {
            ok: true,
            status: 200,
            json: async () => ({ ok: true, result: recovered }),
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
            updatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
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
      expect(screen.getByText("官网二维码未同步")).toBeInTheDocument();
    });

    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const file = new File([pngBytes], "official-qr.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("上传已收到的官方二维码"), {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(screen.getByText("Vietnam Pre-Arrival 提交成功")).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/applications/application-id/submission-artifact",
      expect.objectContaining({ method: "POST" }),
    );
    expect(screen.getByRole("link", { name: "下载官方二维码" })).toHaveAttribute(
      "href",
      expect.stringContaining("vn-prearrival-qr-recovered.png"),
    );
  });
});
