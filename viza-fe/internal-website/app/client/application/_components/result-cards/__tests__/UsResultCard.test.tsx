import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import enMessages from "@/messages/en.json";
import zhMessages from "@/messages/zh.json";
import type { UsSubmissionResult } from "@/lib/submission-result";
import { UsResultCard } from "../UsResultCard";

const { push } = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const submittedResult: UsSubmissionResult = {
  country: "US",
  status: "submitted",
  applicationId: "AA00EXAMPLE",
  surnameFirst5: "EXAMP",
  yearOfBirth: 1990,
  securityQuestion: "City of birth",
  securityAnswer: "Singapore",
  embassyOrConsulate: "U.S. Embassy Singapore",
  retrievalUrl: "https://ceac.state.gov/GenNIV/Default.aspx?ApplicationID=AA00EXAMPLE",
};

const stoppedAtSignResult: UsSubmissionResult = {
  ...submittedResult,
  status: "stopped_at_sign",
};

describe("UsResultCard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    push.mockReset();
  });

  it("keeps required result-card accessibility messages in every locale", () => {
    for (const messages of [enMessages, zhMessages]) {
      const card = messages.usAppointment.ds160Card;
      expect(card.copyValue).toContain("{label}");
      expect(card.copiedValue).toContain("{label}");
      expect(card.openCeacStatus).toBeTruthy();
      expect(card.proofEmailFailed).toBeTruthy();
      expect(card.proofEmailFailedBody).toBeTruthy();
      expect(card.proofEmailSending).toBeTruthy();
      expect(card.proofEmailUnknown).toBeTruthy();
      expect(card.proofEmailUnknownBody).toBeTruthy();
      expect(card.proofEmailUnavailable).toBeTruthy();
      expect(card.proofEmailUnavailableBody).toBeTruthy();
      expect(card.automaticEmailTitle).toBeTruthy();
      expect(card.automaticEmailPreparing).toBeTruthy();
      expect(card.automaticEmailPreparingBody).toBeTruthy();
      expect(card.automaticEmailPending).toBeTruthy();
      expect(card.automaticEmailPendingBody).toBeTruthy();
      expect(card.automaticEmailSent).toBeTruthy();
      expect(card.automaticEmailSentBody).toBeTruthy();
      expect(card.automaticEmailFailed).toBeTruthy();
      expect(card.automaticEmailFailedBody).toBeTruthy();
      expect(card.automaticEmailUnknown).toBeTruthy();
      expect(card.automaticEmailUnknownBody).toBeTruthy();
      expect(card.automaticEmailUnavailable).toBeTruthy();
      expect(card.automaticEmailUnavailableBody).toBeTruthy();
    }
  });

  it("keeps the PDF action and shows automatic email status without email controls", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ ok: true, status: "none" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<UsResultCard applicationId="viza-application-id" result={submittedResult} />);

    expect(screen.getAllByRole("button", { name: "copyValue" })).toHaveLength(3);
    expect(screen.getByRole("button", { name: "printConfirmation" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "emailConfirmation" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "sendToAccountEmail" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "retryEmail" })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("automaticEmailPreparing")).toBeInTheDocument());
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0);
  });

  it("fails closed when the persisted email status cannot be read", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      ok: false,
      status: "unavailable",
      code: "ds160_proof_email_unavailable",
    }), { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<UsResultCard applicationId="viza-application-id" result={submittedResult} />);

    await waitFor(() => {
      expect(screen.getByText("automaticEmailUnavailable")).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "retryEmail" })).not.toBeInTheDocument();
  });

  it("resumes read-only email polling after refresh and preserves the PDF action on unknown receipt", async () => {
    vi.useFakeTimers();
    let readCount = 0;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") {
        throw new Error("refresh polling must not send email");
      }
      readCount += 1;
      if (readCount === 1) {
        return new Response(JSON.stringify({
          ok: true,
          status: "sending",
          jobId: "email-job-id",
        }), { status: 200 });
      }
      return new Response(JSON.stringify({
        ok: true,
        status: "unknown",
        code: "ds160_proof_email_unknown",
        error: "safe unknown receipt",
        jobId: "email-job-id",
      }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<UsResultCard applicationId="viza-application-id" result={submittedResult} />);
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(screen.getByText("automaticEmailUnknown")).toBeInTheDocument();
    expect(screen.getByText("automaticEmailUnknownBody")).toBeInTheDocument();
    expect(screen.queryByText("automaticEmailPending")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "printConfirmation" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "retryEmail" })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0);
  });

  it("starts a download without opening a popup after proof is ready", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      ok: true,
      status: "ready",
      downloadUrl: "/api/applications/viza-application-id/submission-artifact?download=confirmation.pdf",
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    let clickedHref = "";
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clickedHref = this.href;
    });

    render(<UsResultCard applicationId="viza-application-id" result={submittedResult} />);
    fireEvent.click(screen.getByRole("button", { name: "printConfirmation" }));

    await waitFor(() => {
      expect(clickedHref).toContain("/api/applications/viza-application-id/submission-artifact");
    });
    const downloadCalls = fetchMock.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit | undefined]>;
    expect(downloadCalls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
    anchorClick.mockRestore();
  });

  it("keeps an automatic email failure separate from the saved proof and submission", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      ok: true,
      status: "failed",
      code: "ds160_proof_email_failed",
      error: "provider details must never be shown",
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<UsResultCard applicationId="viza-application-id" result={submittedResult} />);

    await waitFor(() => {
      expect(screen.getByText("automaticEmailFailed")).toBeInTheDocument();
      expect(screen.getByText("automaticEmailFailedBody")).toBeInTheDocument();
    });
    expect(screen.queryByText(/provider details/u)).not.toBeInTheDocument();
    expect(screen.getByText("submitted")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "emailConfirmation" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "retryEmail" })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0);
  });

  it("keeps an unknown CEAC receipt read-only", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      ok: true,
      status: "unknown",
      code: "ds160_proof_email_unknown",
      error: "receipt details must not be shown",
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<UsResultCard applicationId="viza-application-id" result={submittedResult} />);

    await waitFor(() => expect(screen.getByText("automaticEmailUnknown")).toBeInTheDocument());
    expect(screen.getByText("automaticEmailUnknownBody")).toBeInTheDocument();
    expect(screen.queryByText(/receipt details/u)).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "retryEmail" })).not.toBeInTheDocument();
  });

  it("does not promise CEAC retrieval when the security answer is hidden", () => {
    render(
      <UsResultCard
        applicationId="viza-application-id"
        result={{ ...submittedResult, securityAnswer: "[REDACTED]" }}
      />,
    );

    expect(screen.getByText("securityAnswerUnavailable")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "openCeacStatus" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "openCeac" })).not.toBeInTheDocument();
  });

  it("creates a new VIZA draft and navigates back to the form", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      applicationId: "new-draft-id",
      href: "/client/application/long-form?applicationId=new-draft-id&country=united_states&visaType=B1_B2",
    }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<UsResultCard applicationId="viza-application-id" result={submittedResult} />);
    fireEvent.click(screen.getByRole("button", { name: "newApplication" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/applications/viza-application-id/new-application",
        { method: "POST" },
      );
      expect(push).toHaveBeenCalledWith(
        "/client/application/long-form?applicationId=new-draft-id&country=united_states&visaType=B1_B2",
      );
    });
  });

  it("offers automatic continuation when the prior run stopped before official confirmation", async () => {
    const fetchMock = vi.fn(() => new Promise<Response>(() => undefined));
    vi.stubGlobal("fetch", fetchMock);

    render(<UsResultCard applicationId="viza-application-id" result={stoppedAtSignResult} />);
    fireEvent.click(screen.getByRole("button", { name: "continueAutomaticSubmission" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/applications/viza-application-id/retry-submission",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            mode: "live_assisted",
            intent: "new_application",
          }),
        }),
      );
    });
  });
});
