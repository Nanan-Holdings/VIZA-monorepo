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
      resultEvidence: {
        authoritativeRead: {
          source: "official_registration_result_read",
          postSubmitRead: true,
          stableReference: true,
          referenceNumber: "SG-REF-123456",
        },
      },
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
    expect(screen.getByText("SG-REF-123456")).toBeInTheDocument();
    expect(screen.getByText("Arrival date:", { exact: false })).toHaveTextContent("2026-08-24");
    expect(screen.getByRole("link", { name: "Download confirmation PDF" })).toHaveAttribute(
      "href",
      expect.stringContaining("01-confirmation.pdf"),
    );
    expect(screen.getByText("Arrival date:", { exact: false }).closest("[data-submission-state]")).toHaveAttribute(
      "data-submission-state",
      "success",
    );
  });

  it("does not promote an unverified submitted value to terminal success", () => {
    render(
      <SgArrivalCardResultCard
        result={{
          country: "SG",
          visaType: "SG_ARRIVAL_CARD",
          status: "submitted",
          mode: "live_assisted",
          provider: "sg_arrival_card_live",
          applicationId: "application-id",
          submitted: true,
          portalUrl: "https://eservices.ica.gov.sg/sgarrivalcard/ltp",
          portalResponseSummary: "Submitted",
        }}
      />,
    );

    expect(screen.getByText("Verifying the SG Arrival Card receipt")).toBeInTheDocument();
    expect(document.querySelector('[data-submission-state="success"]')).not.toBeInTheDocument();
  });
});
