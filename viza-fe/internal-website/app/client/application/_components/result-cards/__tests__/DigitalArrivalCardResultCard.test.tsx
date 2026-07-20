import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DigitalArrivalCardSubmissionResult } from "@/lib/submission-result";
import { DigitalArrivalCardResultCard } from "../SubmissionStatusStep";

vi.mock("next-intl", () => ({
  useLocale: () => "zh",
}));

describe("DigitalArrivalCardResultCard", () => {
  it("shows downloadable Vietnam QR and PDF artifacts", () => {
    const result: DigitalArrivalCardSubmissionResult = {
      country: "VN",
      visaType: "VN_PREARRIVAL_DECLARATION",
      status: "submitted",
      mode: "live_assisted",
      provider: "vietnam_prearrival_live",
      applicationId: "application-id",
      submitted: true,
      confirmationNumber: "DE123456789",
      referenceNumber: "DE123456789",
      portalUrl: "https://prearrival.immigration.gov.vn/",
      portalResponseSummary: "Official confirmation captured.",
      confirmationPdfStoragePath:
        "user/application-id/VN/vn-prearrival-confirmation-pdf-1.pdf",
      artifacts: {
        screenshots: [],
        qrCodes: ["user/application-id/VN/vn-prearrival-qr-1.png"],
        pdfs: ["user/application-id/VN/vn-prearrival-confirmation-pdf-1.pdf"],
        logs: ["vn_prearrival_qr_saved", "vn_prearrival_pdf_downloaded"],
        traces: [],
      },
      payloadSummary: {
        accommodationAddressProvided: true,
      },
    };

    render(<DigitalArrivalCardResultCard result={result} />);

    expect(screen.getByText("Vietnam Pre-Arrival 提交成功")).toBeInTheDocument();
    expect(screen.getByAltText("越南入境前申报官方二维码")).toHaveAttribute(
      "src",
      expect.stringContaining("vn-prearrival-qr-1.png"),
    );
    expect(screen.getByRole("button", { name: "下载确认文件" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "下载官方二维码" })).toHaveAttribute(
      "href",
      expect.stringContaining("vn-prearrival-qr-1.png"),
    );
  });
});
