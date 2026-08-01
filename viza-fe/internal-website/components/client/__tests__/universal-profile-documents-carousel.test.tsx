import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UniversalProfileDocumentsCarousel } from "../universal-profile-documents-carousel";

const { localeState } = vi.hoisted(() => ({ localeState: { value: "zh" } }));

vi.mock("next-intl", () => ({ useLocale: () => localeState.value }));

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
  beforeEach(() => {
    localeState.value = "zh";
  });

  it("shows every reusable document as a visible upload card", () => {
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
    expect(screen.getByRole("heading", { name: "支持材料" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "电子签名" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "证件照" })).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "下一页" })).not.toBeInTheDocument();
  });

  it("uses the shared two-column supporting-document panel", () => {
    const { container } = render(
      <UniversalProfileDocumentsCarousel
        applicationId="application-id"
        passport={emptyDocument}
        photo={emptyDocument}
        signature={emptyDocument}
        onPassportFieldsApplied={vi.fn()}
        onDocumentUploaded={vi.fn()}
      />,
    );

    const panel = screen.getByRole("region", { name: "支持材料" });
    expect(panel).toHaveClass("rounded-xl", "bg-white", "shadow-sm");
    expect(panel.querySelector(".grid")).toHaveClass("md:grid-cols-2");
    expect(container.querySelectorAll("article")).toHaveLength(3);
  });

  it("keeps privacy notes behind each AI help icon", () => {
    localeState.value = "en";
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

    const passportNote = "The file stays in your private document space and is used only for applications you choose.";
    const signatureNote = "Your signature stays in private storage and is attached to an application only when you choose to use it.";
    const portraitNote = "Forms will offer this photo first; you can still replace it for an application with different requirements.";

    expect(screen.queryByText(passportNote)).not.toBeInTheDocument();
    expect(screen.queryByText(signatureNote)).not.toBeInTheDocument();
    expect(screen.queryByText(portraitNote)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ask AI about Passport bio page" }));
    expect(screen.getByText(passportNote)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ask AI about E-signature" }));
    expect(screen.getByText(signatureNote)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ask AI about Passport-size photo" }));
    expect(screen.getByText(portraitNote)).toBeInTheDocument();
  });
});
