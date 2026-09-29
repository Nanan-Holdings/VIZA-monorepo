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
      expect(card.retryEmail).toBeTruthy();
      expect(card.proofEmailUnavailable).toBeTruthy();
      expect(card.proofEmailUnavailableBody).toBeTruthy();
    }
  });

  it("keeps result actions accessible and limits email delivery to the account email", () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true, status: "idle" }), { status: 200 })));
    render(<UsResultCard applicationId="viza-application-id" result={submittedResult} />);

    expect(screen.getAllByRole("button", { name: "copyValue" })).toHaveLength(3);
    const emailButton = screen.getByRole("button", { name: "emailConfirmation" });
    expect(emailButton).toHaveAttribute("aria-expanded", "false");
    expect(emailButton).toHaveAttribute("aria-controls");

    fireEvent.click(emailButton);

    expect(emailButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "sendToAccountEmail" })).toBeEnabled();
    expect(screen.queryByLabelText("customEmailLabel")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "sendToCustomEmail" })).not.toBeInTheDocument();
  });

  it("fails closed when the persisted email status cannot be read", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      ok: false,
      status: "unavailable",
      code: "ds160_proof_email_unavailable",
    }), { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<UsResultCard applicationId="viza-application-id" result={submittedResult} />);
    fireEvent.click(screen.getByRole("button", { name: "emailConfirmation" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "sendToAccountEmail" })).toBeDisabled();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
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

    expect(screen.getByText("proofEmailUnknown")).toBeInTheDocument();
    expect(screen.getByText("proofEmailUnknownBody")).toBeInTheDocument();
    expect(screen.queryByText("proofEmailSending")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "printConfirmation" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "retryEmail" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "retryEmail" })).toBeEnabled();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0);
  });

  it("starts a download without opening a popup after proof is ready", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
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

  it("keeps an email delivery failure separate from the saved proof and submission", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        if (body.retry === true) {
          return new Response(JSON.stringify({
            ok: true,
            status: "sent",
            recipient: "account@example.com",
          }), { status: 200 });
        }
        return new Response(JSON.stringify({
          ok: true,
          status: "failed",
          code: "ds160_proof_email_failed",
          error: "provider details must never be shown",
        }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true, status: "idle" }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<UsResultCard applicationId="viza-application-id" result={submittedResult} />);
    fireEvent.click(screen.getByRole("button", { name: "emailConfirmation" }));
    fireEvent.click(screen.getByRole("button", { name: "sendToAccountEmail" }));

    await waitFor(() => {
      expect(screen.getByText("proofEmailFailed")).toBeInTheDocument();
      expect(screen.getByText("proofEmailFailedBody")).toBeInTheDocument();
    });
    expect(screen.queryByText(/provider details/u)).not.toBeInTheDocument();
    expect(screen.getByText("submitted")).toBeInTheDocument();
    const postCalls = () => fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
    const firstRequest = JSON.parse(String(postCalls()[0]?.[1]?.body)) as Record<string, unknown>;
    expect(firstRequest.recipientMode).toBe("account");
    expect(firstRequest.retry).toBe(false);
    expect(firstRequest.requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu);
    const retryButtons = screen.getAllByRole("button", { name: "retryEmail" });
    expect(retryButtons.at(-1)).toBeEnabled();
    fireEvent.click(retryButtons.at(-1)!);
    await waitFor(() => expect(screen.getByText("proofEmailSent")).toBeInTheDocument());
    expect(postCalls()).toHaveLength(2);
    const retryRequest = JSON.parse(String(postCalls()[1]?.[1]?.body)) as Record<string, unknown>;
    expect(retryRequest.recipientMode).toBe("account");
    expect(retryRequest.retry).toBe(true);
    expect(retryRequest.requestId).not.toBe(firstRequest.requestId);
  });

  it("does not automatically resend when CEAC receipt is unknown", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") {
        return new Response(JSON.stringify({
          ok: true,
          status: "unknown",
          code: "ds160_proof_email_unknown",
          error: "receipt details must not be shown",
        }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true, status: "idle" }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<UsResultCard applicationId="viza-application-id" result={submittedResult} />);
    fireEvent.click(screen.getByRole("button", { name: "emailConfirmation" }));
    fireEvent.click(screen.getByRole("button", { name: "sendToAccountEmail" }));

    await waitFor(() => expect(screen.getByText("proofEmailUnknown")).toBeInTheDocument());
    expect(screen.getByText("proofEmailUnknownBody")).toBeInTheDocument();
    expect(screen.queryByText(/receipt details/u)).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
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
