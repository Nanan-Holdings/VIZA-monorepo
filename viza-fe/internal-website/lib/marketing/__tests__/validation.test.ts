import { describe, expect, it } from "vitest";
import { normalizeMarketingSlug, validateBlogDraft, validateSocialComposition } from "../validation";

describe("marketing validation", () => {
  it("normalizes a title into a stable ASCII slug", () => {
    expect(normalizeMarketingSlug("  Singapore Visa: 2026 Guide!  ")).toBe("singapore-visa-2026-guide");
  });

  it("rejects unsafe blog slugs", () => {
    expect(() => validateBlogDraft({ locale: "en", slug: "../secret", title: "Title", excerpt: "Excerpt", bodyMarkdown: "Body", authorName: "VIZA", reason: "Editorial update" })).toThrow(/Slug/);
  });

  it("requires platform copy and HTTPS destinations", () => {
    expect(() => validateSocialComposition({ title: "Launch", brief: "Brief", destinationUrl: "http://example.com", platforms: ["x"], platformContent: { x: "Copy" }, reason: "Campaign" })).toThrow(/HTTPS/);
    expect(() => validateSocialComposition({ title: "Launch", brief: "Brief", platforms: ["x"], platformContent: {}, reason: "Campaign" })).toThrow(/Content is required/);
  });
});
