import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AutomatedOnlineResultCard } from "../AutomatedOnlineResultCard";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
}));

describe("AutomatedOnlineResultCard", () => {
  it("renders Japan's official QR evidence in the terminal success panel", () => {
    render(
      <AutomatedOnlineResultCard
        result={{
          country: "JP",
          visaType: "JP_VISIT_JAPAN_WEB",
          status: "qr_ready",
          mode: "live_assisted",
          provider: "jp_visit_japan_web_live",
          applicationId: "application-id",
          submitted: true,
          qrReady: true,
          referenceNumber: "JP-REF-01",
          portalUrl: "https://services.digital.go.jp/en/visit-japan-web/",
          portalResponseSummary: "QR ready",
          artifacts: { screenshots: [], qrCodes: ["evidence/jp-qr.png"], logs: [], traces: [] },
        }}
      />,
    );

    expect(screen.getByText("JP-REF-01").closest("[data-submission-state]")).toHaveAttribute(
      "data-submission-state",
      "success",
    );
  });

  it("keeps Kenya submitted-but-unapproved results out of the terminal success panel", () => {
    render(
      <AutomatedOnlineResultCard
        result={{
          country: "KE",
          visaType: "KE_ETA",
          status: "submitted",
          mode: "live_assisted",
          provider: "ke_eta_live",
          applicationId: "application-id",
          submitted: true,
          officialReference: "KE-REF-01",
          portalUrl: "https://etakenya.go.ke/",
          portalResponseSummary: "Submitted",
          artifacts: { screenshots: [], pdfs: [], logs: [], traces: [] },
        }}
      />,
    );

    expect(screen.getByText("Verifying the official result")).toBeInTheDocument();
    expect(document.querySelector('[data-submission-state="success"]')).not.toBeInTheDocument();
  });
});
