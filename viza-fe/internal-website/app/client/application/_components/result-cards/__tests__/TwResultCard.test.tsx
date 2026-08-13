import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SubmissionStatusStep } from "../SubmissionStatusStep";
import { normalizeTwStatus, TwResultCard } from "../TwResultCard";
import type { TwSubmissionResult } from "@/lib/submission-result";

vi.mock("next-intl", () => ({
  useLocale: () => "zh",
}));

describe("TwResultCard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps Taiwan queue stages to the eight honest frontend states", () => {
    expect(normalizeTwStatus("waiting")).toBe("queued");
    expect(normalizeTwStatus("running", "logging_in")).toBe("logging_in");
    expect(normalizeTwStatus("running", "otp_required")).toBe("otp_required");
    expect(normalizeTwStatus("running", "filling_fields")).toBe("filling");
    expect(normalizeTwStatus("running", "uploading_documents")).toBe("uploading");
    expect(normalizeTwStatus("running", "validating_uploads")).toBe("validating");
    expect(normalizeTwStatus("completed", "captcha_boundary")).toBe("stopped_at_captcha");
    expect(normalizeTwStatus("completed", "submitted")).toBe("submitted");
    expect(normalizeTwStatus("failed")).toBe("failed");
  });

  it("opens the authenticated live handoff instead of linking to a fresh official portal", async () => {
    const result: TwSubmissionResult = {
      country: "TW",
      status: "stopped_at_captcha",
      portalUrl: "https://coa.immigration.gov.tw/coa-frontend/overseas-foreign-china",
      pagesFilled: ["delivery_location", "applicant_identity", "uploads"],
      caseNumber: "12345678901234567890",
      handoffId: "handoff-id",
      handoffExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };

    const replace = vi.fn();
    const close = vi.fn();
    vi.stubGlobal("open", vi.fn(() => ({ location: { replace }, close })));
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        liveViewUrl: "https://www.browserbase.com/live/session-123",
        expiresAt: "2026-08-05T10:00:00.000Z",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<TwResultCard applicationId="application-id" result={result} />);

    expect(screen.getByText("台湾官网申请已填写完成")).toBeInTheDocument();
    expect(screen.getByText(/亲自核对并点击「确认资料」提交/u)).toBeInTheDocument();
    expect(screen.getByText(/同一官网会话，不是空白申请/u)).toBeInTheDocument();
    expect(screen.getByText("12345678901234567890")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "重新自动填写" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "打开已填写的台湾官网" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/applications/application-id/taiwan-handoff",
        expect.objectContaining({ cache: "no-store", credentials: "same-origin" }),
      );
      expect(replace).toHaveBeenCalledWith("https://www.browserbase.com/live/session-123");
    });
  });

  it("does not keep an old open button after the Taiwan handoff expires and offers refill", async () => {
    const onRetry = vi.fn();
    render(
      <TwResultCard
        applicationId="application-id"
        onRetry={onRetry}
        result={{
          country: "TW",
          status: "stopped_at_captcha",
          handoffId: "handoff-id",
          handoffExpiresAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        }}
      />,
    );

    expect(screen.getByText("台湾官网会话已过期")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "打开已填写的台湾官网" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "重新自动填写" }));
    expect(onRetry).toHaveBeenCalledWith("live_assisted");
  });

  it("shows submitted only as official receipt evidence, not approval or payment", () => {
    const result: TwSubmissionResult = {
      country: "TW",
      status: "submitted",
      portalUrl: "https://coa.immigration.gov.tw/coa-frontend/result",
      caseNumber: "TW20260801ABC123",
      submittedAt: "2026-08-01T00:00:00.000Z",
      officialReceipt: {
        source: "official_success_page_with_application_number",
        capturedAt: "2026-08-01T00:00:00.000Z",
        portalUrl: "https://coa.immigration.gov.tw/coa-frontend/result",
        caseNumber: "TW20260801ABC123",
      },
    };

    render(<TwResultCard result={result} />);

    expect(screen.getByText("已向台湾官网提交")).toBeInTheDocument();
    expect(screen.getByText("已取得官网回执编号")).toBeInTheDocument();
    expect(screen.getByText(/submitted 只代表官网已收件，不代表已核准，也不代表已缴费/u)).toBeInTheDocument();
    expect(screen.getAllByText(/后续审核与缴费请以官网通知为准/u).length).toBeGreaterThan(0);
    expect(screen.getByText("TW20260801ABC123")).toBeInTheDocument();
    expect(screen.queryByText(/自动查询/u)).not.toBeInTheDocument();
    expect(screen.queryByText("验证码前停止")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "重新自动填写" })).not.toBeInTheDocument();
  });

  it("lists completeness blockers with safe navigation links after retry is rejected", () => {
    render(
      <TwResultCard
        applicationId="application-id"
        onRetry={vi.fn()}
        retryError="申请资料尚未完整，不能开始官网自动填写。请先补齐缺失信息和材料。"
        retryCompleteness={{
          complete: false,
          missingInfoCount: 1,
          missingDocumentCount: 1,
          missingInfo: [
            {
              fieldName: "household_revoked",
              labelZh: "户籍是否已注销",
              labelEn: "Household registration revoked",
              stepNumber: 2,
              stepName: "Photo & Basic Status",
              stepLabelZh: "照片与基本状态",
            },
          ],
          missingDocuments: [
            {
              requirementKey: "mainland_id_card_scan",
              documentType: "identity_document",
              labelZh: "大陆身份证",
              labelEn: "Mainland ID card",
              description: "上传大陆身份证扫描件。",
              required: true,
            },
          ],
        }}
        result={{
          country: "TW",
          status: "failed",
          error: "taiwan applicant handoff expired before official receipt evidence was captured",
        }}
      />,
    );

    expect(screen.getByText("还缺 1 项信息、1 份材料")).toBeInTheDocument();
    expect(screen.getByText("户籍是否已注销").closest("a")).toHaveAttribute(
      "href",
      "/client/application/long-form?applicationId=application-id&field=household_revoked",
    );
    expect(screen.getByText("大陆身份证").closest("a")).toHaveAttribute(
      "href",
      "/client/application/long-form?applicationId=application-id&requirementKey=mainland_id_card_scan",
    );
  });

  it("categorizes missing field failures without exposing the raw sensitive error", () => {
    render(
      <TwResultCard
        result={{
          country: "TW",
          status: "failed",
          error: 'taiwan: [household_revoked] missing required yes-no value for applicant "Zhang San"',
        }}
      />,
    );

    expect(screen.getByText("缺必填字段")).toBeInTheDocument();
    expect(screen.getByText("field:household_revoked")).toBeInTheDocument();
    expect(screen.queryByText(/Zhang San/u)).not.toBeInTheDocument();
    expect(screen.queryByText(/missing required yes-no/u)).not.toBeInTheDocument();
  });

  it("categorizes document and OTP failures into actionable buckets", () => {
    const { rerender } = render(
      <TwResultCard
        result={{
          country: "TW",
          status: "failed",
          error: 'taiwan: required document "eligibility_supporting_document_3" has not been uploaded yet',
        }}
      />,
    );

    expect(screen.getByText("缺文件或文件不合格")).toBeInTheDocument();
    expect(screen.getByText("doc:eligibility_supporting_document_3")).toBeInTheDocument();

    rerender(
      <TwResultCard
        result={{
          country: "TW",
          status: "failed",
          error: "otp timeout after waiting for official email verification",
        }}
      />,
    );

    expect(screen.getByText("OTP 超时")).toBeInTheDocument();
    expect(screen.getByText(/确认授权邮箱\/转发设置可用后重新排队/u)).toBeInTheDocument();
  });

  it("redacts account, OTP, cookie, raw error, and screenshot details from failed states", () => {
    render(
      <TwResultCard
        result={{
          country: "TW",
          status: "failed",
          errorCode: "official_field_changed",
          missingFields: ["traveller.email"],
          error:
            "TwFieldVerificationError: official field mismatch for account ops@example.com OTP 123456 Cookie tw_session=secret screenshot=/tmp/tw-captcha.png applicant Li Lei",
        }}
      />,
    );

    expect(screen.getByText("缺必填字段")).toBeInTheDocument();
    expect(screen.getByText("field:traveller.email")).toBeInTheDocument();
    expect(screen.queryByText(/ops@example\.com/u)).not.toBeInTheDocument();
    expect(screen.queryByText(/123456/u)).not.toBeInTheDocument();
    expect(screen.queryByText(/tw_session=secret/u)).not.toBeInTheDocument();
    expect(screen.queryByText(/tw-captcha\.png/u)).not.toBeInTheDocument();
    expect(screen.queryByText(/Li Lei/u)).not.toBeInTheDocument();
    expect(screen.queryByText(/TwFieldVerificationError/u)).not.toBeInTheDocument();
  });

  it("renders Taiwan queue currentStage from the submission status poll", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: "running",
        stage: "filling_form",
        progress: 55,
        result: null,
        error: null,
        message: "Uploading files on the official site.",
        updatedAt: new Date().toISOString(),
        applicationStatus: "waiting",
        country: "taiwan",
        visaType: "TW_ENTRY_PERMIT",
        queue: {
          id: "queue-id",
          status: "processing",
          mode: "live_assisted",
          provider: "taiwan_overseas_cn_entry_permit_live",
          currentStage: "uploading_documents",
          heartbeatAt: new Date().toISOString(),
          fieldFallbacks: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <SubmissionStatusStep
        applicationId="application-id"
        country="taiwan"
        visaType="TW_ENTRY_PERMIT"
        status="waiting"
        result={null}
      />,
    );

    expect(screen.getByText("台湾官网自动填写任务已排队")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("正在上传台湾申请文件")).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/applications/application-id/submission-status",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("prefers an active Taiwan retry snapshot over a stale failed result", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: "running",
        stage: "filling_form",
        progress: 40,
        result: null,
        error: null,
        message: "Filling the official Taiwan form.",
        updatedAt: new Date().toISOString(),
        applicationStatus: "processing",
        country: "taiwan",
        visaType: "TW_ENTRY_PERMIT",
        queue: {
          id: "runner-id",
          status: "tw_live_assisted_processing",
          mode: "live_assisted",
          provider: "taiwan_overseas_cn_entry_permit_live",
          currentStage: "filling_fields",
          heartbeatAt: new Date().toISOString(),
          fieldFallbacks: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <SubmissionStatusStep
        applicationId="application-id"
        country="taiwan"
        visaType="TW_ENTRY_PERMIT"
        status="failed"
        result={{
          country: "TW",
          status: "failed",
          error: "previous handoff expired",
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("正在填写台湾官网申请表")).toBeInTheDocument();
    });
    expect(screen.queryByText("台湾官网自动填写未完成")).not.toBeInTheDocument();
  });

  it("posts Taiwan refill directly to retry-submission without calling the long-form live callback", async () => {
    const onResubmit = vi.fn();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/retry-submission")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            jobId: "runner-id",
            queueStatus: "tw_live_assisted_pending",
            provider: "taiwan_overseas_cn_entry_permit_live",
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: "failed",
          stage: "failed",
          progress: 0,
          result: {
            country: "TW",
            status: "failed",
            error: "previous handoff expired",
          },
          error: "previous handoff expired",
          updatedAt: new Date().toISOString(),
          applicationStatus: "failed",
          country: "taiwan",
          visaType: "TW_ENTRY_PERMIT",
          queue: null,
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <SubmissionStatusStep
        applicationId="application-id"
        country="taiwan"
        visaType="TW_ENTRY_PERMIT"
        status="failed"
        onResubmit={onResubmit}
        result={{
          country: "TW",
          status: "failed",
          error: "taiwan applicant handoff expired before official receipt evidence was captured",
        }}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "重新自动填写" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/applications/application-id/retry-submission",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"visaType":"TW_ENTRY_PERMIT"'),
        }),
      );
    });
    expect(onResubmit).not.toHaveBeenCalled();
    expect(screen.getByText("台湾官网自动填写任务已排队")).toBeInTheDocument();
  });
});
