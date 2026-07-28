import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { UsSubmissionResult } from "@/lib/submission-result";
import { UsResultCard } from "../UsResultCard";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
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

describe("UsResultCard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests a fresh DS-160 application instead of a completed-submission retry", async () => {
    const fetchMock = vi.fn(() => new Promise<Response>(() => undefined));
    vi.stubGlobal("fetch", fetchMock);

    render(<UsResultCard applicationId="viza-application-id" result={submittedResult} />);
    fireEvent.click(screen.getByRole("button", { name: "newApplication" }));

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
