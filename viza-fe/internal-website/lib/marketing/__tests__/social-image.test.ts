import { afterEach, describe, expect, it, vi } from "vitest";
import { brandedImage, ownCoverUrl } from "../social-image";

describe("social image logo stamp", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("stamps storage covers and hero photos through the app, not the marketing site", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.viza.it.com");
    const cover = "https://abc.supabase.co/storage/v1/object/public/marketing-assets/covers/a.png";
    expect(brandedImage(cover)).toBe(`https://app.viza.it.com/social-card?src=${encodeURIComponent(cover)}`);
    expect(brandedImage("https://viza.it.com/assets/heroes/japan.jpg")).toMatch(/^https:\/\/app\.viza\.it\.com\/social-card\?src=/);
  });

  it("refuses anything that is not our own cover", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
    expect(ownCoverUrl("https://abc.supabase.co/storage/v1/object/sign/private/a.png")).toBeNull();
    expect(ownCoverUrl("https://evil.example/assets/a.png")).toBeNull();
    expect(ownCoverUrl("https://viza.it.com/admin/a.png")).toBeNull();
    expect(ownCoverUrl("http://viza.it.com/assets/heroes/japan.jpg")).toBeNull();
    expect(brandedImage("https://images.example.com/news.jpg")).toBeNull();
  });
});
