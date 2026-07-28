import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PassportOcrUpload } from "@/components/client/passport-ocr-upload";

vi.mock("next-intl", () => ({
  useLocale: () => "zh",
}));

vi.mock("@/app/client/documents/actions", () => ({
  confirmPassportOcrExtraction: vi.fn(),
}));

vi.mock("@/hooks/use-smooth-progress", () => ({
  useSmoothProgress: () => ({
    displayedProgress: 0,
    isVisuallyComplete: false,
  }),
}));

vi.mock("@/lib/document-upload-client", () => ({
  uploadApplicationDocumentFromClient: vi.fn(),
}));

describe("PassportOcrUpload", () => {
  it("shows Vietnam official image-only upload requirements", () => {
    render(
      <PassportOcrUpload
        applicationId="app_123"
        country="vietnam"
        visaType="VN_E_VISA"
      />,
    );

    expect(screen.getByText("JPG/JPEG")).toBeInTheDocument();
    expect(screen.getByText("PNG")).toBeInTheDocument();
    expect(screen.getByText("WebP")).toBeInTheDocument();
    expect(screen.getByText("最大 2 MB")).toBeInTheDocument();
    expect(screen.queryByText("PDF")).not.toBeInTheDocument();
    expect(screen.queryByText("最大 10 MB")).not.toBeInTheDocument();
  });
});
