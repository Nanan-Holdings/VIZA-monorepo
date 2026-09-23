import { describe, expect, it } from "vitest";
import { validateMarketingAsset } from "../assets";

describe("marketing asset validation", () => {
  it("accepts bounded raster images", () => {
    expect(validateMarketingAsset({ kind: "image", mimeType: "image/webp", size: 100 }).extension).toBe("webp");
  });

  it("rejects SVG and oversized images", () => {
    expect(() => validateMarketingAsset({ kind: "image", mimeType: "image/svg+xml", size: 100 })).toThrow("Unsupported image type");
    expect(() => validateMarketingAsset({ kind: "image", mimeType: "image/png", size: 8 * 1024 * 1024 + 1 })).toThrow("8MB");
  });

  it("accepts bounded social documents", () => {
    expect(validateMarketingAsset({ kind: "document", mimeType: "application/pdf", size: 1024 }).extension).toBe("pdf");
  });
});
