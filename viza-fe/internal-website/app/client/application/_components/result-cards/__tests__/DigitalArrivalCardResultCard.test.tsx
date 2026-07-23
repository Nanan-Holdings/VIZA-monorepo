import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DigitalArrivalCardSubmissionResult } from "@/lib/submission-result";
import {
  DigitalArrivalCardResultCard,
  SubmissionStatusStep,
} from "../SubmissionStatusStep";
import { FailureCard } from "../FailureCard";

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

  it("renders a stored Philippines success immediately without polling or starting a new submission", () => {
    const result: DigitalArrivalCardSubmissionResult = {
      country: "PH",
      visaType: "PH_ETRAVEL_ARRIVAL_CARD",
      status: "submitted",
      mode: "live_assisted",
      provider: "philippines_etravel_live",
      applicationId: "application-id",
      submitted: true,
      referenceNumber: "PH-REFERENCE",
      portalUrl: "https://etravel.gov.ph/",
      portalResponseSummary: "Official confirmation captured.",
      artifacts: {
        screenshots: ["user/application-id/PH/ph-confirmation.png"],
        qrCodes: [],
        pdfs: [],
        logs: [],
        traces: [],
      },
    };
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <SubmissionStatusStep
        applicationId="application-id"
        country="philippines"
        visaType="PH_ETRAVEL_ARRIVAL_CARD"
        status="completed"
        result={result}
      />,
    );

    expect(screen.getByText("eTravel 提交成功")).toBeInTheDocument();
    expect(screen.getByText("PH-REFERENCE")).toBeInTheDocument();
    expect(screen.getByAltText("菲律宾 eTravel 官网确认页截图")).toHaveAttribute(
      "src",
      expect.stringContaining("ph-confirmation.png"),
    );
    expect(screen.getByRole("link", { name: "下载官网确认截图" })).toHaveAttribute(
      "href",
      expect.stringContaining("ph-confirmation.png"),
    );
    expect(screen.queryByText("正在提交您的申请")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
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

describe("cloud submission retry routing", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("retries through the cloud handler without starting a local worker", async () => {
    const onRetry = vi.fn().mockResolvedValue(undefined);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <FailureCard
        applicationId="application-id"
        errorMessage="Submission job stalled because the worker did not pick it up in time."
        retryModes={[{ mode: "live_assisted", label: "提交" }]}
        onRetry={onRetry}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "提交" }));

    await waitFor(() => {
      expect(onRetry).toHaveBeenCalledWith("live_assisted", undefined);
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lets a new Indonesia payment retry outrank the previous durable failure", async () => {
    const previousResult = {
      country: "ID",
      status: "stopped_at_pay",
      portalUrl: "https://evisa.imigrasi.go.id/",
    } as const;
    const previousError = "The Indonesia official payment gateway returned a failed payment result.";
    let retryQueued = false;
    const fetchMock = vi.fn().mockImplementation(async (url: string, options?: RequestInit) => {
      if (options?.method === "POST" && url.endsWith("/official-fee/pay")) {
        retryQueued = true;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            queueId: "new-indonesia-queue",
            queueStatus: "pending",
            provider: "indonesia_evisa_live",
          }),
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => retryQueued
          ? {
              status: "running",
              stage: "bank_authentication_processing",
              progress: 72,
              result: null,
              error: null,
              message: "Waiting for bank authentication.",
              updatedAt: new Date().toISOString(),
              applicationStatus: "waiting",
              country: "ID",
              visaType: "ID_B1_EVOA",
              queue: {
                id: "new-indonesia-queue",
                status: "id_b1_evoa_payment_processing",
                mode: "live_assisted",
                provider: "indonesia_evisa_live",
              },
            }
          : {
              status: "failed",
              stage: "failed",
              progress: 59,
              result: previousResult,
              error: previousError,
              message: previousError,
              updatedAt: new Date().toISOString(),
              applicationStatus: "failed",
              country: "ID",
              visaType: "ID_B1_EVOA",
              queue: {
                id: "old-indonesia-queue",
                status: "failed",
                mode: "live_assisted",
                provider: "indonesia_evisa_live",
              },
            },
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <SubmissionStatusStep
        applicationId="application-id"
        country="indonesia"
        visaType="ID_B1_EVOA"
        status="failed"
        result={previousResult}
      />,
    );

    fireEvent.change(screen.getByLabelText("银行卡号"), { target: { value: "4111111111111111" } });
    fireEvent.change(screen.getByLabelText("有效期"), { target: { value: "12/30" } });
    fireEvent.change(screen.getByLabelText("CVV"), { target: { value: "123" } });
    fireEvent.change(screen.getByLabelText("持卡人姓名（必填，按银行卡）"), {
      target: { value: "REAL CARDHOLDER" },
    });
    fireEvent.click(screen.getByRole("button", { name: "提交" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/applications/application-id/official-fee/pay",
        expect.objectContaining({ method: "POST" }),
      );
      expect(screen.queryByText("提交没有完成")).not.toBeInTheDocument();
      expect(screen.getByText("正在提交您的申请")).toBeInTheDocument();
    });
  });

  it("sends a failed Vietnam retry directly to the cloud payment queue", async () => {
    let resolvePayment: ((value: unknown) => void) | undefined;
    const paymentResponse = new Promise((resolve) => {
      resolvePayment = resolve;
    });
    const fetchMock = vi.fn().mockImplementation(async (url: string, options?: RequestInit) => {
      if (options?.method === "POST" && url.endsWith("/official-fee/pay")) {
        return paymentResponse;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: "failed",
          stage: "failed",
          progress: 0,
          result: null,
          error: "Submission job failed: worker heartbeat stopped for 600s in status vn_live_assisted_processing.",
          message: "Previous cloud attempt ended.",
          updatedAt: new Date().toISOString(),
          applicationStatus: "failed",
          country: "VN",
          visaType: "evisa_tourism",
          queue: {
            id: "old-vietnam-queue",
            status: "failed",
            mode: "live_assisted",
            provider: "vietnam_evisa_live",
          },
        }),
      };
    });
    const onResubmit = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <SubmissionStatusStep
        applicationId="application-id"
        country="vietnam"
        visaType="evisa_tourism"
        status="failed"
        result={null}
        onResubmit={onResubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText("银行卡号"), { target: { value: "4111111111111111" } });
    fireEvent.change(screen.getByLabelText("有效期"), { target: { value: "12/30" } });
    fireEvent.change(screen.getByLabelText("CVV"), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: "提交" }));

    expect(await screen.findByText("正在提交您的申请")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "提交进度" })).toBeInTheDocument();
    expect(onResubmit).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/applications/application-id/official-fee/pay",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          card: {
            pan: "4111111111111111",
            expiry: "12/30",
            cvv: "123",
            holderName: "",
          },
        }),
      }),
    );

    await act(async () => {
      resolvePayment?.({
        ok: true,
        status: 200,
        json: async () => ({
          queueId: "new-vietnam-queue",
          queueStatus: "vn_cloud_live_pending",
          provider: "vietnam_evisa_live",
        }),
      });
    });
  });

  it("shows Fly cloud loading immediately while a Vietnam payment retry is being accepted", async () => {
    let resolvePayment: ((value: unknown) => void) | undefined;
    const paymentResponse = new Promise((resolve) => {
      resolvePayment = resolve;
    });
    const fetchMock = vi.fn().mockImplementation(async (url: string, options?: RequestInit) => {
      if (options?.method === "POST" && url.endsWith("/official-fee/pay")) {
        return paymentResponse;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: "failed",
          stage: "failed",
          progress: 0,
          result: {
            country: "VN",
            status: "stopped_at_pay",
            mode: "live_assisted",
            provider: "vietnam_evisa_live",
            portalUrl: "https://evisa.gov.vn/e-visa/foreigners",
            checkpoint: "payment_page_visible",
            manualAction: {
              type: "payment_required",
              status: "open",
              instructions: "Previous cloud attempt ended.",
            },
          },
          error: "Previous cloud attempt ended.",
          message: "Previous cloud attempt ended.",
          updatedAt: new Date().toISOString(),
          applicationStatus: "failed",
          country: "VN",
          visaType: "evisa_tourism",
          queue: {
            id: "old-vietnam-queue",
            status: "failed",
            mode: "live_assisted",
            provider: "vietnam_evisa_live",
          },
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <SubmissionStatusStep
        applicationId="application-id"
        country="vietnam"
        visaType="evisa_tourism"
        status="failed"
        result={{
          country: "VN",
          status: "stopped_at_pay",
          mode: "live_assisted",
          provider: "vietnam_evisa_live",
          portalUrl: "https://evisa.gov.vn/e-visa/foreigners",
          checkpoint: "payment_page_visible",
          manualAction: {
            type: "payment_required",
            status: "open",
            instructions: "Previous cloud attempt ended.",
          },
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("银行卡号"), { target: { value: "4111111111111111" } });
    fireEvent.change(screen.getByLabelText("有效期"), { target: { value: "12/30" } });
    fireEvent.change(screen.getByLabelText("CVV"), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: "开始自动付款" }));

    expect(await screen.findByText("正在提交您的申请")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "提交进度" })).toBeInTheDocument();
    expect(screen.getByText("正在安全发送银行卡并启动 Fly 云端任务。")).toBeInTheDocument();

    await act(async () => {
      resolvePayment?.({
        ok: true,
        status: 200,
        json: async () => ({
          queueId: "new-vietnam-queue",
          queueStatus: "vn_payment_pending",
          provider: "vietnam_evisa_live",
        }),
      });
    });
  });
});
