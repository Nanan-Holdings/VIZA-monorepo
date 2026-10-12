import type { MarketingBlogSummary } from "./marketing-blog";

export interface BlogCategory {
  name: string;
  slug: string;
  count: number;
}

export function categorySlug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");
}

export function blogCategories(posts: readonly MarketingBlogSummary[]): BlogCategory[] {
  const categories = new Map<string, BlogCategory>();
  for (const post of posts) {
    const name = post.category?.trim();
    if (!name) continue;
    const slug = categorySlug(name);
    // Unslugifiable labels stay as plain text rather than creating a broken hub.
    if (!slug) continue;
    const existing = categories.get(slug);
    if (existing) existing.count += 1;
    else categories.set(slug, { name, slug, count: 1 });
  }
  return [...categories.values()].sort((a, b) => a.name.localeCompare(b.name));
}
