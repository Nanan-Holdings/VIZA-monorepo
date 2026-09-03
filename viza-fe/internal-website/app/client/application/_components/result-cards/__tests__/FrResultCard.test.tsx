import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FrSubmissionResult } from "@/lib/submission-result";
import { FrResultCard } from "../FrResultCard";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

const submittedResult: FrSubmissionResult = {
  country: "FR",
  status: "submitted",
  mode: "live_assisted",
  applicationReference: "FR-2026-001",
  officialStatus: "lodged_at_visa_centre",
};

describe("FrResultCard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the shared terminal panel only for confirmed official submission", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })));
    render(<FrResultCard applicationId="application-id" result={submittedResult} />);

    expect(screen.getByText("FR-2026-001").closest("[data-submission-state]")).toHaveAttribute(
      "data-submission-state",
      "success",
    );
    expect(screen.getByRole("link", { name: "button" })).toHaveAttribute(
      "href",
      "/client/applications/application-id/france-appointment",
    );
  });
});
