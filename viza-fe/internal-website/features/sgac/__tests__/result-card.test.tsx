import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SgArrivalCardSubmissionResult } from "@/lib/submission-result";
import { SgArrivalCardResultCard } from "../SgArrivalCardResultCard";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
}));

describe("SgArrivalCardResultCard", () => {
  it("shows the successful status, arrival date, and stored ICA PDF", () => {
    const result: SgArrivalCardSubmissionResult = {
      country: "SG",
      visaType: "SG_ARRIVAL_CARD",
      status: "submitted",
      mode: "live_assisted",
      provider: "sg_arrival_card_live",
      applicationId: "application-id",
      submitted: true,
      confirmationNumber: null,
      referenceNumber: null,
      portalUrl: "https://eservices.ica.gov.sg/sgarrivalcard/ltp",
      portalResponseSummary: "Your Singapore Arrival Card submission is successful!",
      confirmationPdfStoragePath: "jobs/job-id/sgac/pdfs/01-confirmation.pdf",
      artifacts: {
        screenshots: ["jobs/job-id/sgac/screenshots/01-confirmation.png"],
        pdfs: ["jobs/job-id/sgac/pdfs/01-confirmation.pdf"],
        logs: ["sgac_confirmation_pdf_downloaded official=true"],
        traces: [],
      },
      payloadSummary: {
        arrivalDate: "2026-08-24",
        accommodationAddressProvided: false,
      },
    };

    render(<SgArrivalCardResultCard result={result} />);

    expect(screen.getByText("SG Arrival Card submitted")).toBeInTheDocument();
    expect(screen.getByText("2026-08-24")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Download confirmation PDF" })).toHaveAttribute(
      "href",
      expect.stringContaining("01-confirmation.pdf"),
    );
  });
});
