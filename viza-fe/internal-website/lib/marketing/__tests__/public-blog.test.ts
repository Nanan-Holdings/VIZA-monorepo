import { describe, expect, it } from "vitest";
import { toPublicBlogFeed, toPublicBlogPost } from "../public-blog";

const row = {
  id: "post-id", locale: "en", slug: "visa-guide", title: "Visa guide", excerpt: "Summary",
  body_markdown: "# Guide", cover_image_url: null, category: "Guides", author_name: "VIZA Editorial",
  seo_title: "Visa guide", seo_description: "Current guidance", published_at: "2026-08-29T00:00:00.000Z",
  updated_at: "2026-08-29T01:00:00.000Z", status: "published", metadata: { internal: "must not leak" },
};

describe("public blog mapping", () => {
  it("maps feed rows to the frozen public contract without internal fields", () => {
    const feed = toPublicBlogFeed([row], "2026-08-29T02:00:00.000Z");
    expect(feed.posts[0]).toEqual({ id: "post-id", locale: "en", slug: "visa-guide", title: "Visa guide", excerpt: "Summary", coverImageUrl: null, category: "Guides", authorName: "VIZA Editorial", publishedAt: "2026-08-29T00:00:00.000Z" });
    expect(feed).not.toHaveProperty("metadata");
  });

  it("maps detail rows to MarketingBlogPost", () => {
    expect(toPublicBlogPost(row)).toMatchObject({ slug: "visa-guide", bodyMarkdown: "# Guide", seoDescription: "Current guidance", updatedAt: "2026-08-29T01:00:00.000Z" });
  });
});
