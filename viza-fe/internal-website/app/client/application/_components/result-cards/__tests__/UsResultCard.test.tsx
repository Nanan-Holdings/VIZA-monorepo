import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
