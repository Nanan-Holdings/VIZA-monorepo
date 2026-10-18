import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ManualHandoffResultCard } from "../ManualHandoffResultCard";
import type { ManualHandoffSubmissionResult } from "@/lib/submission-result";

vi.mock("next-intl", () => ({ useLocale: () => "en" }));

const base: ManualHandoffSubmissionResult = {
  country: "MANUAL",
  status: "handed_to_team",
  handedAt: "2026-10-19T02:04:00.000Z",
  destinationCountry: "kenya",
  visaType: "KE_ETA",
};

describe("ManualHandoffResultCard", () => {
  it("tells the applicant a consultant has it and nothing is needed", () => {
    render(<ManualHandoffResultCard result={base} />);
    expect(screen.getByText("With your VIZA consultant")).toBeInTheDocument();
    expect(screen.getByText(/There is nothing you need to do right now/)).toBeInTheDocument();
  });

  it("shows the government reference once filed", () => {
    render(<ManualHandoffResultCard result={{ ...base, status: "submitted", reference: "KE-ETA-12345", updatedAt: "2026-10-20T03:00:00.000Z" }} />);
    expect(screen.getByText("Filed with the government")).toBeInTheDocument();
    expect(screen.getByText("KE-ETA-12345")).toBeInTheDocument();
  });

  it("shows the consultant's note for needs-info and refusals, and a download link when approved", () => {
    const { rerender } = render(<ManualHandoffResultCard result={{ ...base, status: "needs_info", notes: "Please upload a clearer passport scan." }} />);
    expect(screen.getByText("We need something from you")).toBeInTheDocument();
    expect(screen.getByText("Please upload a clearer passport scan.")).toBeInTheDocument();
    rerender(<ManualHandoffResultCard result={{ ...base, status: "refused", notes: "Travel dates fall outside the eTA window." }} />);
    expect(screen.getByText("Travel dates fall outside the eTA window.")).toBeInTheDocument();
    rerender(<ManualHandoffResultCard result={{ ...base, status: "approved" }} />);
    expect(screen.getByRole("link", { name: "Go to the Status page to download" })).toHaveAttribute("href", "/client/status");
  });
});
