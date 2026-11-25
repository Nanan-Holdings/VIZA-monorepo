import type { MetadataRoute } from "next";
import { COUNTRIES, isPublished } from "@/lib/countries";
import { ENABLED_LOCALES, DEFAULT_LOCALE, LOCALE_HTML_LANG, buildLocalePath, type Locale } from "@/lib/locales";
import { getPublishedCatalogue } from "@/lib/public-catalogue";
import { getMarketingBlogFeed, type MarketingBlogSummary } from "@/lib/marketing-blog";
import { blogCategories } from "@/lib/blog-taxonomy";
import { SITE_URL } from "@/lib/seo/site";
import { GUIDES as ARRIVAL_GUIDES } from "@/lib/arrival-cards";
import { GUIDES } from "@/lib/guides";
import { isRedirectedBlogSlug } from "@/lib/seo/redirects";

export const revalidate = 300;

type Entry = MetadataRoute.Sitemap[number];

/**
 * Final, indexable, 200 URLs only. Left out on purpose:
 * /status, /events and /apply (noindex), and any locale's
 * blog until that locale has published posts.
 */
const STATIC_ROUTES = ["/", "/visa", "/about", "/product", "/contact", "/arrival-cards", "/guides", "/careers", "/security", "/legal/privacy", "/legal/terms", "/refunds", "/business-information"];

/** One sitemap row per locale in `locales`, each naming every sibling plus x-default. */
function rows(
  path: string,
  locales: readonly Locale[],
  extra: Partial<Entry> = {},
  alternatesFor: readonly Locale[] = locales,
): Entry[] {
  const languages: Record<string, string> = {};
  if (alternatesFor.length > 1) {
    for (const l of alternatesFor) languages[LOCALE_HTML_LANG[l]] = `${SITE_URL}${buildLocalePath(l, path)}`;
    const fallback = alternatesFor.includes(DEFAULT_LOCALE) ? DEFAULT_LOCALE : alternatesFor[0];
    languages["x-default"] = `${SITE_URL}${buildLocalePath(fallback, path)}`;
  }
  return locales.map((l) => ({
    url: `${SITE_URL}${buildLocalePath(l, path)}`,
    ...extra,
    ...(alternatesFor.length > 1 ? { alternates: { languages } } : {}),
  }));
}

const latest = (posts: MarketingBlogSummary[]) =>
  posts.length ? new Date(Math.max(...posts.map((p) => Date.parse(p.publishedAt)))) : undefined;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [published, feeds] = await Promise.all([
    getPublishedCatalogue(),
    Promise.all(ENABLED_LOCALES.map(async (locale) => ({ locale, result: await getMarketingBlogFeed(locale) }))),
  ]);
  const publishedAt = new Map(published.map((p) => [p.slug, p.publishedAt]));

  // Destinations come from lib/countries.ts (plus any extra published slug), not only the catalogue API.
  const slugs = [...COUNTRIES.filter(isPublished).map((c) => c.slug)];
  for (const entry of published) if (!slugs.includes(entry.slug)) slugs.push(entry.slug);

  const out: Entry[] = [];
  for (const route of STATIC_ROUTES) {
    out.push(...rows(route, ENABLED_LOCALES, { changeFrequency: "monthly", priority: route === "/" ? 1 : 0.6 }));
  }
  for (const guide of ARRIVAL_GUIDES) {
    out.push(...rows(`/arrival-cards/${guide.slug}`, ENABLED_LOCALES, { changeFrequency: "monthly", priority: 0.8, lastModified: new Date("2026-11-25") }));
  }
  for (const guide of GUIDES) {
    out.push(...rows(`/guides/${guide.slug}`, ENABLED_LOCALES, { changeFrequency: "monthly", priority: 0.8, lastModified: new Date(guide.modified) }));
  }
  for (const slug of slugs) {
    const stamp = publishedAt.get(slug);
    out.push(
      ...rows(`/visa/${slug}`, ENABLED_LOCALES, {
        changeFrequency: "monthly",
        priority: 0.8,
        ...(stamp ? { lastModified: new Date(stamp) } : {}),
      }),
    );
  }

  // Blog: a locale is listed once it has posts. Posts are per locale, so a post
  // only gets alternates when the same slug exists in another locale.
  const withPosts = feeds.flatMap(({ locale, result }) =>
    result.status === "ok" && result.feed.posts.length > 0 ? [{ locale, posts: result.feed.posts }] : [],
  );
  const blogLocales = withPosts.map((x) => x.locale);
  for (const { locale, posts } of withPosts) {
    out.push(
      ...rows("/blog", [locale], { changeFrequency: "weekly", priority: 0.7, lastModified: latest(posts) }, blogLocales),
    );
    for (const category of blogCategories(posts)) {
      out.push(...rows(`/blog/category/${category.slug}`, [locale], { changeFrequency: "weekly", priority: 0.5 }));
    }
    // Slugs that redirect (see lib/seo/redirects.ts) are not listed: the sitemap carries final 200 URLs only.
    for (const post of posts.filter((p) => !isRedirectedBlogSlug(p.slug))) {
      const siblings = withPosts
        .filter((x) => x.posts.some((p) => p.slug === post.slug))
        .map((x) => x.locale);
      out.push(
        ...rows(`/blog/${post.slug}`, [locale], { changeFrequency: "monthly", priority: 0.6, lastModified: new Date(post.publishedAt) }, siblings),
      );
    }
  }
  return out;
}
