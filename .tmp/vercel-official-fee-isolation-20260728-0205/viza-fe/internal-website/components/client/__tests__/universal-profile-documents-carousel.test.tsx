import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UniversalProfileDocumentsCarousel } from "../universal-profile-documents-carousel";

vi.mock("next-intl", () => ({ useLocale: () => "zh" }));

vi.mock("@/components/client/passport-ocr-upload", () => ({
  PassportOcrUpload: () => <div>护照上传内容</div>,
}));

const emptyDocument = {
  uploaded: false,
  fileName: null,
  status: null,
  updatedAt: null,
};

describe("UniversalProfileDocumentsCarousel", () => {
  it("shows one reusable document page at a time and supports numbered paging", () => {
    render(
      <UniversalProfileDocumentsCarousel
        applicationId="application-id"
        passport={emptyDocument}
        photo={emptyDocument}
        signature={emptyDocument}
        onPassportFieldsApplied={vi.fn()}
        onDocumentUploaded={vi.fn()}
      />,
    );

    expect(screen.getByText("护照上传内容")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "上传电子签名" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "2 电子签名" }));
    expect(screen.getByRole("heading", { name: "上传电子签名" })).toBeInTheDocument();
    expect(screen.queryByText("护照上传内容")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "下一页" }));
    expect(screen.getByRole("heading", { name: "上传证件照" })).toBeInTheDocument();
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
  });
});
