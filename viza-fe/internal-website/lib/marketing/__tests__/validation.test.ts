import { describe, expect, it } from "vitest";
import { countHashtags, normalizeMarketingSlug, parseGeneratedPlatformContent, validateBlogDraft, validateSocialComposition } from "../validation";
import type { MarketingSocialCompositionInput } from "../contracts";

const videoUrl = "https://example.supabase.co/storage/v1/object/public/marketing-public-assets/video/short.mp4";

function short(overrides: Partial<MarketingSocialCompositionInput> = {}): MarketingSocialCompositionInput {
  return {
    title: "Short: ETIAS", brief: "ETIAS short", platforms: ["tiktok", "youtube"],
    platformContent: { tiktok: "ETIAS is not a visa. {url}", youtube: "ETIAS is not a visa. {url}" },
    videoUrl, videoLocale: "en", videoTitle: "ETIAS explained", reason: "Editorial review", ...overrides,
  };
}

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

  it("rejects scheduling on image channels that publish immediately", () => {
    expect(() => validateSocialComposition({
      title: "Travel guide", brief: "Promote the guide", platforms: ["instagram"],
      platformContent: { instagram: "Read the guide" }, mediaUrl: "https://example.com/cover.jpg",
      scheduledFor: "2026-10-01T10:00:00Z", reason: "Editorial review",
    })).toThrow(/publish when approved/);
  });

  it("accepts only plain, within-limit AI captions", () => {
    expect(parseGeneratedPlatformContent({ linkedin: "  Reviewed guide  " }, ["linkedin"])).toEqual({ linkedin: "Reviewed guide" });
    expect(() => parseGeneratedPlatformContent({ linkedin: { text: "Reviewed guide" } }, ["linkedin"])).toThrow(/invalid linkedin copy/);
    expect(() => parseGeneratedPlatformContent({ pinterest: "x".repeat(501) }, ["pinterest"])).toThrow(/500 characters/);
  });

  it("accepts a short with a language, a YouTube title and a schedule", () => {
    const clean = validateSocialComposition(short({ platforms: ["tiktok", "instagram", "youtube"], platformContent: { tiktok: "A", instagram: "B", youtube: "C" }, scheduledFor: "2026-12-01T10:00:00Z" }));
    expect(clean).toMatchObject({ videoUrl, videoLocale: "en", videoTitle: "ETIAS explained", scheduledFor: "2026-12-01T10:00:00.000Z" });
  });

  it("keeps shorts and image channels in separate compositions", () => {
    expect(() => validateSocialComposition(short({ platforms: ["tiktok", "pinterest"], platformContent: { tiktok: "A", pinterest: "B" } }))).toThrow(/TikTok, Instagram Reels and YouTube Shorts only; move pinterest/);
    expect(() => validateSocialComposition(short({ videoUrl: undefined }))).toThrow(/need a video/);
  });

  it("requires the spoken language and a valid YouTube title", () => {
    expect(() => validateSocialComposition(short({ videoLocale: undefined }))).toThrow(/language/);
    expect(() => validateSocialComposition(short({ videoTitle: " " }))).toThrow(/YouTube title is required/);
    expect(() => validateSocialComposition(short({ videoTitle: "x".repeat(101) }))).toThrow(/100 characters/);
    expect(() => validateSocialComposition(short({ videoTitle: "ETIAS <2026>" }))).toThrow(/< or >/);
    expect(validateSocialComposition(short({ platforms: ["tiktok"], platformContent: { tiktok: "A" }, videoTitle: undefined })).videoTitle).toBeUndefined();
  });

  it("enforces per-platform caption and hashtag limits", () => {
    expect(() => validateSocialComposition(short({ platformContent: { tiktok: "x".repeat(2_201), youtube: "ok" } }))).toThrow(/tiktok content must be 2200/);
    expect(() => validateSocialComposition(short({ platformContent: { tiktok: "ok", youtube: "x".repeat(5_001) } }))).toThrow(/youtube content must be 5000/);
    const tags = (count: number) => Array.from({ length: count }, (_, index) => `#tag${index}`).join(" ");
    expect(() => validateSocialComposition(short({ platformContent: { tiktok: "ok", youtube: `Visa news ${tags(16)}` } }))).toThrow(/at most 15 hashtags/);
    expect(() => validateSocialComposition(short({ platforms: ["instagram"], platformContent: { instagram: tags(31) } }))).toThrow(/at most 30 hashtags/);
    expect(countHashtags("#ETIAS and #Schengen, not a#tag or ##")).toBe(2);
  });

  it("refuses a short scheduled more than a year out", () => {
    const later = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000).toISOString();
    expect(() => validateSocialComposition(short({ scheduledFor: later }))).toThrow(/up to a year/);
  });
});
