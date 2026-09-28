import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GenericSubmissionResult } from "@/lib/submission-result";
import { GenericResultCard } from "../SubmissionStatusStep";

vi.mock("next-intl", () => ({
  useLocale: () => "zh",
}));

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

describe("GenericResultCard DS-160 recovery", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
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
});
