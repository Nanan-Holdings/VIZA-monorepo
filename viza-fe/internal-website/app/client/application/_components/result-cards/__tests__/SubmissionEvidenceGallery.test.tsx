import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  getSubmissionScreenshotPaths,
  SubmissionEvidenceGallery,
} from "../SubmissionEvidenceGallery";
import { RESULT_PRESENTATION_REGISTRY } from "../covered-countries";

vi.mock("next-intl", () => ({ useLocale: () => "en" }));

describe("getSubmissionScreenshotPaths", () => {
  it("collects durable evidence paths from every supported result shape once", () => {
    expect(getSubmissionScreenshotPaths({
      artifacts: { screenshots: ["owner/app/ID/payment.png", "owner/app/ID/payment.png"] },
      reviewScreenshotStoragePath: "owner/app/AU/review.png",
      evidence: { screenshotPath: "owner/app/US/sign.png" },
      paymentBoundary: { screenshotStoragePath: "owner/app/UK/pay.png" },
      manualAction: { evidence: { screenshotPath: "owner/app/KR/checkpoint.png" } },
    })).toEqual([
      "owner/app/ID/payment.png",
      "owner/app/AU/review.png",
      "owner/app/US/sign.png",
      "owner/app/UK/pay.png",
      "owner/app/KR/checkpoint.png",
    ]);
  });

  it("rejects external, absolute, and traversal-looking display sources", () => {
    expect(getSubmissionScreenshotPaths({
      artifacts: { screenshots: ["https://example.test/evidence.png", "/tmp/evidence.png"] },
      manualAction: { screenshotUrl: "../other-app/evidence.png" },
    })).toEqual([]);
  });

  it("renders a pre-payment screenshot through the application-scoped artifact route", () => {
    render(
      <SubmissionEvidenceGallery
        applicationId="app-1"
        result={{
          status: "stopped_at_pay",
          artifacts: { screenshots: ["owner/app-1/ID/payment-boundary.png"] },
          checkpointEvidence: [{
            kind: "pre_payment",
            screenshotStoragePath: "owner/app-1/ID/payment-boundary.png",
            capturedAt: "2026-08-29T00:00:00.000Z",
            authoritative: true,
          }],
        }}
      />,
    );

    expect(screen.getByText("Official payment page — stopped before payment")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Official payment page screenshot" })).toHaveAttribute(
      "src",
      "/api/applications/app-1/submission-artifact?path=owner%2Fapp-1%2FID%2Fpayment-boundary.png&inline=1",
    );
    expect(screen.getByText("Download screenshot").closest("a")).toHaveAttribute(
      "href",
      "/api/applications/app-1/submission-artifact?path=owner%2Fapp-1%2FID%2Fpayment-boundary.png&download=official-portal-evidence-1.png",
    );
  });

  it("does not mislabel an ordinary review screenshot as payment evidence", () => {
    render(
      <SubmissionEvidenceGallery
        applicationId="app-1"
        result={{
          status: "stopped_at_pay",
          artifacts: { screenshots: ["owner/app-1/EG/form-review.png"] },
        }}
      />,
    );

    expect(screen.getByText("Official portal evidence")).toBeInTheDocument();
    expect(screen.queryByText("Official payment page — stopped before payment"))
      .not.toBeInTheDocument();
  });

  it.each(RESULT_PRESENTATION_REGISTRY)(
    "renders application-scoped screenshot evidence for $country / $visaType ($adapter)",
    ({ country, visaType, adapter }) => {
      const applicationId = `application-${country.toLowerCase()}-${visaType.toLowerCase()}`;
      const path = `owner/${applicationId}/${adapter}/official-page.png`;

      const { unmount } = render(
        <SubmissionEvidenceGallery
          applicationId={applicationId}
          result={{
            country,
            visaType,
            artifacts: { screenshots: [path] },
          }}
        />,
      );

      const expectedArtifactRoute =
        `/api/applications/${applicationId}/submission-artifact?path=${encodeURIComponent(path)}&inline=1`;
      expect(screen.getByRole("img", { name: "Official portal evidence screenshot" }))
        .toHaveAttribute("src", expectedArtifactRoute);
      expect(screen.getByRole("link", { name: "Official portal evidence screenshot" }))
        .toHaveAttribute("href", expectedArtifactRoute);

      unmount();
    },
  );

  it("never exposes a potentially cross-application storage path directly", () => {
    const potentiallyCrossApplicationPath = "owner/application-2/ID/payment-boundary.png";
    render(
      <SubmissionEvidenceGallery
        applicationId="application-1"
        result={{
          status: "stopped_at_pay",
          artifacts: { screenshots: [potentiallyCrossApplicationPath] },
          checkpointEvidence: [{
            kind: "pre_payment",
            screenshotStoragePath: potentiallyCrossApplicationPath,
          }],
        }}
      />,
    );

    const image = screen.getByRole("img", { name: "Official payment page screenshot" });
    expect(image).not.toHaveAttribute("src", potentiallyCrossApplicationPath);
    expect(image).toHaveAttribute(
      "src",
      `/api/applications/application-1/submission-artifact?path=${encodeURIComponent(potentiallyCrossApplicationPath)}&inline=1`,
    );
  });
});
