import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    push.mockReset();
  });

  it("keeps required result-card accessibility messages in every locale", () => {
    for (const messages of [enMessages, zhMessages]) {
      const card = messages.usAppointment.ds160Card;
      expect(card.copyValue).toContain("{label}");
      expect(card.copiedValue).toContain("{label}");
      expect(card.customEmailLabel).toBeTruthy();
      expect(card.openCeacStatus).toBeTruthy();
    }
  });

  it("keeps result actions accessible and labels the custom email field", () => {
    render(<UsResultCard applicationId="viza-application-id" result={submittedResult} />);

    expect(screen.getAllByRole("button", { name: "copyValue" })).toHaveLength(3);
    const emailButton = screen.getByRole("button", { name: "emailConfirmation" });
    expect(emailButton).toHaveAttribute("aria-expanded", "false");
    expect(emailButton).toHaveAttribute("aria-controls");

    fireEvent.click(emailButton);

    expect(emailButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("customEmailLabel")).toHaveAttribute("type", "email");
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
    expect(fetchMock).toHaveBeenCalledTimes(1);
    anchorClick.mockRestore();
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
