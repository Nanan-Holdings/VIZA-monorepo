import { describe, expect, it } from "vitest";
import { acceptedFileTypeLabels, describeAcceptedFileTypes } from "@/lib/documents/accept-hint";

describe("describeAcceptedFileTypes", () => {
  it("lists only the formats the input accepts", () => {
    expect(describeAcceptedFileTypes(".jpg,.jpeg,.png,.webp", true)).toBe("支持 JPG、PNG 和 WebP");
    expect(describeAcceptedFileTypes(".jpg,.jpeg,.png,.webp", false)).toBe("JPG, PNG or WebP");
  });

  it("says 'only' for a single format such as Indonesia's official PDF uploads", () => {
    expect(describeAcceptedFileTypes(".pdf,application/pdf", true)).toBe("仅支持 PDF");
    expect(describeAcceptedFileTypes(".pdf,application/pdf", false)).toBe("PDF only");
  });

  it("keeps the general default list", () => {
    expect(acceptedFileTypeLabels(".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx")).toEqual([
      "PDF", "JPG", "PNG", "WebP", "DOC", "DOCX",
    ]);
  });
});
