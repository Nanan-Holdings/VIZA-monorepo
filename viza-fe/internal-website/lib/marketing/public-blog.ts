import type { MarketingBlogFeed, MarketingBlogLocale, MarketingBlogPost } from "./contracts";
import { mapBlogPost, mapBlogSummary } from "./db";

export function toPublicBlogFeed(rows: unknown[], generatedAt = new Date().toISOString()): MarketingBlogFeed {
  return { posts: rows.map(mapBlogSummary), generatedAt };
}

export function toPublicBlogPost(row: unknown): MarketingBlogPost {
  return mapBlogPost(row);
}

export function publicBlogSelect(locale: MarketingBlogLocale) {
  return { locale, status: "published" as const };
}
