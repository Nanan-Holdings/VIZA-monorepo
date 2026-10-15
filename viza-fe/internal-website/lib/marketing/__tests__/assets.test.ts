import { describe, expect, it } from "vitest";
import { marketingAssetPath, validateMarketingAsset } from "../assets";

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

  it("accepts MP4 shorts up to the bucket limit and nothing else", () => {
    expect(validateMarketingAsset({ kind: "video", mimeType: "video/mp4", size: 5_848_100 }).extension).toBe("mp4");
    expect(() => validateMarketingAsset({ kind: "video", mimeType: "video/quicktime", size: 1024 })).toThrow("Unsupported video type");
    expect(() => validateMarketingAsset({ kind: "video", mimeType: "video/mp4", size: 50 * 1024 * 1024 + 1 })).toThrow("50MB");
    expect(() => validateMarketingAsset({ kind: "audio", mimeType: "audio/mpeg", size: 1024 })).toThrow("Unsupported asset kind");
  });

  it("files assets by kind, month and uploader", () => {
    expect(marketingAssetPath("video", "user-1", "abc", "mp4", new Date("2026-10-16T00:00:00Z"))).toBe("video/2026/10/user-1/abc.mp4");
  });
});
