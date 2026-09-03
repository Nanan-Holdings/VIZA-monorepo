import "server-only";
import type { Locale } from "@/i18n";

export interface MarketingBlogSummary {
  id: string;
  locale: Locale;
  slug: string;
  title: string;
  excerpt: string;
  coverImageUrl: string | null;
  category: string | null;
  authorName: string;
  publishedAt: string;
}

export interface MarketingBlogPost extends MarketingBlogSummary {
  bodyMarkdown: string;
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: string;
}

export interface MarketingBlogFeed {
  posts: MarketingBlogSummary[];
  generatedAt: string;
}

export type MarketingBlogFeedResult =
  | { status: "ok"; feed: MarketingBlogFeed }
  | { status: "unavailable" };

export type MarketingBlogPostResult =
  | { status: "ok"; post: MarketingBlogPost }
  | { status: "not-found" }
  | { status: "unavailable" };

const BLOG_PATH = "/api/public/marketing/blog";
const FETCH_TIMEOUT_MS = 4_000;

function portalOrigin(): string | null {
  const value = process.env.NEXT_PUBLIC_PORTAL_URL;
  if (!value) return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isSafeImageUrl(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== "string" || value.length === 0) return false;
  if (value.startsWith("/")) return !value.startsWith("//");

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function validSummary(value: unknown): value is MarketingBlogSummary {
  if (!isRecord(value)) return false;
  return typeof value.id === "string"
    && (value.locale === "en" || value.locale === "zh-CN")
    && typeof value.slug === "string"
    && value.slug.length > 0
    && typeof value.title === "string"
    && value.title.length > 0
    && typeof value.excerpt === "string"
    && isSafeImageUrl(value.coverImageUrl)
    && isNullableString(value.category)
    && typeof value.authorName === "string"
    && value.authorName.length > 0
    && isTimestamp(value.publishedAt);
}

function validPost(value: unknown): value is MarketingBlogPost {
  if (!validSummary(value)) return false;
  const detail = value as unknown as Record<string, unknown>;
  return typeof detail.bodyMarkdown === "string"
    && isNullableString(detail.seoTitle)
    && isNullableString(detail.seoDescription)
    && isTimestamp(detail.updatedAt);
}

function blogUrl(origin: string, path: string, locale: Locale): string {
  const url = new URL(path, origin);
  url.searchParams.set("locale", locale);
  return url.toString();
}

async function fetchBlog(url: string): Promise<Response> {
  return fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
}

export async function getMarketingBlogFeed(locale: Locale): Promise<MarketingBlogFeedResult> {
  const origin = portalOrigin();
  if (!origin) return { status: "unavailable" };

  try {
    const response = await fetchBlog(blogUrl(origin, BLOG_PATH, locale));
    if (!response.ok) return { status: "unavailable" };

    const body: unknown = await response.json();
    if (!isRecord(body) || !Array.isArray(body.posts) || !isTimestamp(body.generatedAt)) {
      return { status: "unavailable" };
    }

    if (!body.posts.every(validSummary) || body.posts.some((post) => post.locale !== locale)) {
      return { status: "unavailable" };
    }

    return {
      status: "ok",
      feed: { posts: body.posts, generatedAt: body.generatedAt },
    };
  } catch {
    return { status: "unavailable" };
  }
}

export async function getMarketingBlogPost(
  slug: string,
  locale: Locale,
): Promise<MarketingBlogPostResult> {
  const origin = portalOrigin();
  if (!origin) return { status: "unavailable" };

  try {
    const path = `${BLOG_PATH}/${encodeURIComponent(slug)}`;
    const response = await fetchBlog(blogUrl(origin, path, locale));
    if (response.status === 404) return { status: "not-found" };
    if (!response.ok) return { status: "unavailable" };

    const body: unknown = await response.json();
    if (!validPost(body) || body.locale !== locale || body.slug !== slug) {
      return { status: "unavailable" };
    }

    return { status: "ok", post: body };
  } catch {
    return { status: "unavailable" };
  }
}
