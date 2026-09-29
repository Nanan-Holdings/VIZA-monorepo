import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GenericSubmissionResult } from "@/lib/submission-result";
import { GenericResultCard } from "../SubmissionStatusStep";

const locale = vi.hoisted(() => ({ value: "zh" }));
vi.mock("next-intl", () => ({ useLocale: () => locale.value }));

const recoveryResult: GenericSubmissionResult = {
  country: "GENERIC",
  targetCountry: "US",
  visaType: "DS160",
  status: "action_required",
  mode: "live_assisted",
  applicationId: "ds160-application-id",
  actionType: "final_submission_recovery",
  actionInstructions:
    "A DS-160 application already exists from an earlier submission attempt. Automatic new-draft and final-submit retries are disabled; verify or recover the existing CEAC application.",
  implementationStatus: "implemented",
  message:
    "A DS-160 application already exists from an earlier submission attempt. Automatic new-draft and final-submit retries are disabled; verify or recover the existing CEAC application.",
};

const portalResult: GenericSubmissionResult = {
  ...recoveryResult,
  actionType: "portal_action_required",
  actionInstructions: 'CEAC next rejected on page "work_education_previous": School attendance dates are required.',
  message: 'CEAC next rejected on page "work_education_previous": School attendance dates are required.',
};

function portalCard(props: {
  jobId?: string | null;
  result?: GenericSubmissionResult;
  onResubmit?: (mode: "live_assisted" | "dry_run") => Promise<void>;
} = {}) {
  return (
    <GenericResultCard
      applicationId="ds160-application-id"
      applicationCountry="united_states"
      applicationVisaType="DS160"
      jobId={props.jobId === undefined ? "blocked-job" : props.jobId}
      result={props.result ?? portalResult}
      onResubmit={props.onResubmit}
    />
  );
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("GenericResultCard DS-160 recovery", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    locale.value = "zh";
  });

  it("uses a dedicated recovery state without exposing the internal checkpoint or raw reason", () => {
    render(
      <GenericResultCard
        applicationId="ds160-application-id"
        applicationCountry="united_states"
        applicationVisaType="DS160"
        jobId={null}
        result={recoveryResult}
      />,
    );

    expect(screen.getByText("DS-160 提交已暂停")).toBeInTheDocument();
    expect(screen.getByText("可重试")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重试 DS-160" })).toBeEnabled();
    expect(screen.queryByText("需要你完成 CEAC 官网验证")).not.toBeInTheDocument();
    expect(screen.queryByText("final_submission_recovery")).not.toBeInTheDocument();
    expect(screen.queryByText(recoveryResult.actionInstructions!)).not.toBeInTheDocument();
  });

  it("uses the parent review callback to flush and validate the draft before retrying", async () => {
    const onResubmit = vi.fn().mockResolvedValue(undefined);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <GenericResultCard
        applicationId="ds160-application-id"
        applicationCountry="united_states"
        applicationVisaType="DS160"
        jobId={null}
        result={recoveryResult}
        onResubmit={onResubmit}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "重试 DS-160" }));

    await waitFor(() => {
      expect(onResubmit).toHaveBeenCalledWith("live_assisted", undefined, "retry");
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows a parent retry validation failure in the recovery card", async () => {
    const onResubmit = vi.fn().mockRejectedValue(
      new Error("请先补齐或修正以下信息：美国社会安全号码（如适用）。"),
    );

    render(
      <GenericResultCard
        applicationId="ds160-application-id"
        applicationCountry="united_states"
        applicationVisaType="DS160"
        jobId={null}
        result={recoveryResult}
        onResubmit={onResubmit}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "重试 DS-160" }));

    expect(
      await screen.findByText("请先补齐或修正以下信息：美国社会安全号码（如适用）。"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重试 DS-160" })).toBeEnabled();
  });

  it("uses the guarded ordinary retry intent when no parent review callback exists", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({}), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <GenericResultCard
        applicationId="ds160-application-id"
        applicationCountry="united_states"
        applicationVisaType="DS160"
        jobId={null}
        result={recoveryResult}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "重试 DS-160" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/applications/ds160-application-id/retry-submission",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            mode: "live_assisted",
            country: "united_states",
            visaType: "DS160",
            intent: "retry",
          }),
        }),
      );
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "DS-160 恢复请求未被接受（503），请稍后重试。",
    );
  });

  it("offers an ordinary retry through the parent save barrier only after confirming no manual task exists", async () => {
    const onResubmit = vi.fn().mockResolvedValue(undefined);
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ manualActions: [] }));
    vi.stubGlobal("fetch", fetchMock);
    render(portalCard({ onResubmit }));

    expect(screen.queryByRole("button", { name: "修改后重试" })).not.toBeInTheDocument();
    const retry = await screen.findByRole("button", { name: "修改后重试" });
    expect(retry).toBeEnabled();
    expect(screen.queryByRole("button", { name: "我已完成，继续" })).not.toBeInTheDocument();
    fireEvent.click(retry);

    await waitFor(() => expect(onResubmit).toHaveBeenCalledWith("live_assisted", undefined, "retry"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/submissions/blocked-job/manual-actions", { cache: "no-store" });
  });

  it.each([
    "The official portal returned HTTP 403 while continuing the DS-160.",
    "The CEAC navigation timed out while continuing the DS-160.",
    "The CEAC request failure stopped the DS-160 attempt.",
  ])("offers a guarded retry for recoverable portal stops after the manual-action read (%s)", async (message) => {
    const onResubmit = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ manualActions: [] })));
    render(portalCard({ result: { ...portalResult, message, actionInstructions: message }, onResubmit }));

    expect(await screen.findByRole("button", { name: "重试提交" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "修改后重试" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "我已完成，继续" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重试提交" }));

    await waitFor(() => expect(onResubmit).toHaveBeenCalledWith("live_assisted", undefined, "retry"));
  });

  it("keeps a real pending CAPTCHA task on the manual-action path", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ manualActions: [{
      id: "captcha-task",
      actionType: "captcha_required",
      status: "pending",
      instruction: "Complete the official CAPTCHA.",
      screenshotUrl: null,
    }] })));
    render(portalCard());

    await waitFor(() => expect(screen.getByRole("button", { name: "我已完成，继续" })).toBeEnabled());
    expect(screen.queryByRole("button", { name: "修改后重试" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "重试提交" })).not.toBeInTheDocument();
  });

  it.each([
    [503, { error: "temporarily unavailable" }],
    [200, {}],
    [200, { manualActions: null }],
    [200, { manualActions: "invalid" }],
  ])("does not equate an unreadable manual-action response with an empty task list (%s)", async (status, payload) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(payload, status)));
    render(portalCard());

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "修改后重试" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "重试提交" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "我已完成，继续" })).toBeDisabled();
  });

  it("does not reuse the old job's empty manual-action result after the job changes", async () => {
    let resolveNext!: (response: Response) => void;
    const pendingNext = new Promise<Response>((resolve) => { resolveNext = resolve; });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ manualActions: [] }))
      .mockReturnValueOnce(pendingNext);
    vi.stubGlobal("fetch", fetchMock);
    const { rerender } = render(portalCard());
    expect(await screen.findByRole("button", { name: "修改后重试" })).toBeEnabled();

    rerender(portalCard({ jobId: "new-job" }));
    expect(screen.queryByRole("button", { name: "修改后重试" })).not.toBeInTheDocument();
    await act(async () => resolveNext(jsonResponse({ manualActions: [{
      id: "new-task", actionType: "captcha_required", status: "pending", instruction: null, screenshotUrl: null,
    }] })));
    expect(screen.getByRole("button", { name: "我已完成，继续" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "修改后重试" })).not.toBeInTheDocument();
  });

  it("does not convert a distinct CAPTCHA checkpoint with no task into a form retry", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ manualActions: [] }));
    vi.stubGlobal("fetch", fetchMock);
    render(portalCard({ result: { ...portalResult, actionType: "captcha_required" } }));
    await act(async () => undefined);

    expect(screen.queryByRole("button", { name: "修改后重试" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "重试提交" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "我已完成，继续" })).toBeDisabled();
  });

  it("localizes the correction retry in English", async () => {
    locale.value = "en";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ manualActions: [] })));
    render(portalCard());

    expect(await screen.findByRole("button", { name: "Retry after corrections" })).toBeEnabled();
    expect(screen.queryByText("修改后重试")).not.toBeInTheDocument();
  });

  it("localizes the ordinary portal retry in English", async () => {
    locale.value = "en";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ manualActions: [] })));
    render(portalCard({ result: {
      ...portalResult,
      message: "The official portal returned HTTP 403 while continuing the DS-160.",
      actionInstructions: "The official portal returned HTTP 403 while continuing the DS-160.",
    } }));

    expect(await screen.findByRole("button", { name: "Retry submission" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Retry after corrections" })).not.toBeInTheDocument();
  });

  it("prevents duplicate ordinary retries while the guarded request is pending", async () => {
    let resolveRetry!: () => void;
    const onResubmit = vi.fn(() => new Promise<void>((resolve) => { resolveRetry = resolve; }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ manualActions: [] })));
    render(portalCard({
      result: {
        ...portalResult,
        message: "The official portal returned HTTP 403 while continuing the DS-160.",
        actionInstructions: "The official portal returned HTTP 403 while continuing the DS-160.",
      },
      onResubmit,
    }));

    const retry = await screen.findByRole("button", { name: "重试提交" });
    fireEvent.click(retry);
    fireEvent.click(retry);

    await waitFor(() => expect(onResubmit).toHaveBeenCalledTimes(1));
    expect(retry).toBeDisabled();
    resolveRetry();
    await waitFor(() => expect(retry).toBeEnabled());
  });

  it("re-enables ordinary retry after a guarded request fails", async () => {
    const onResubmit = vi.fn().mockRejectedValue(new Error("retry failed"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ manualActions: [] })));
    render(portalCard({
      result: {
        ...portalResult,
        message: "The official portal returned HTTP 403 while continuing the DS-160.",
        actionInstructions: "The official portal returned HTTP 403 while continuing the DS-160.",
      },
      onResubmit,
    }));

    const retry = await screen.findByRole("button", { name: "重试提交" });
    fireEvent.click(retry);
    expect(await screen.findByRole("alert")).toHaveTextContent("retry failed");
    await waitFor(() => expect(retry).toBeEnabled());

    fireEvent.click(retry);
    await waitFor(() => expect(onResubmit).toHaveBeenCalledTimes(2));
  });

  it("permits correction of a real personal-page surname validation error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ manualActions: [] })));
    const message = 'CEAC next rejected on page "personal1": Surname is required.';
    render(portalCard({ result: { ...portalResult, message, actionInstructions: message } }));

    expect(await screen.findByRole("button", { name: "修改后重试" })).toBeEnabled();
  });

  it("keeps a retrieval identity failure behind its existing safeguard", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ manualActions: [] })));
    const message = "CEAC retrieve failed: Surname does not match the application ID.";
    render(portalCard({ result: { ...portalResult, message, actionInstructions: message } }));
    await act(async () => undefined);

    expect(screen.queryByRole("button", { name: "修改后重试" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "重试提交" })).not.toBeInTheDocument();
  });

  it("offers an ordinary retry for a security gate when no manual task remains", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ manualActions: [] })));
    const message = "Cloudflare security verification is required before continuing.";
    render(portalCard({ result: { ...portalResult, message, actionInstructions: message } }));
    await act(async () => undefined);

    expect(await screen.findByRole("button", { name: "重试提交" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "修改后重试" })).not.toBeInTheDocument();
  });
});
