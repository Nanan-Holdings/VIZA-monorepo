import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PassportOcrUpload } from "@/components/client/passport-ocr-upload";
import { uploadApplicationDocumentFromClient } from "@/lib/document-upload-client";

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

    expect(screen.getByText(/JPG\/JPEG, PNG, WebP · 最大 2 MB/)).toBeInTheDocument();
    expect(screen.queryByText("PDF")).not.toBeInTheDocument();
    expect(screen.queryByText("最大 10 MB")).not.toBeInTheDocument();
  });

  it("keeps the OCR failure visible after the uploaded prop refreshes", async () => {
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:passport"),
      revokeObjectURL: vi.fn(),
    });
    vi.mocked(uploadApplicationDocumentFromClient).mockResolvedValue({
      ok: true,
      storagePath: "passport/test.jpg",
      filename: "passport.jpg",
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({
        success: false,
        error: { code: "provider_unavailable" },
      }),
    }));
    const { rerender } = render(
      <PassportOcrUpload applicationId="app_123" />,
    );
    const input = screen.getAllByLabelText("上传护照资料页")
      .find((element) => element instanceof HTMLInputElement)!;
    fireEvent.change(input, {
      target: { files: [new File(["passport"], "passport.jpg", { type: "image/jpeg" })] },
    });
    await waitFor(() => expect(screen.getByText(/OCR 服务暂时不可用/)).toBeInTheDocument());

    rerender(
      <PassportOcrUpload applicationId="app_123" initialUploaded initialFileName="passport.jpg" />,
    );
    expect(screen.getByText(/OCR 服务暂时不可用/)).toBeInTheDocument();
  });
});
