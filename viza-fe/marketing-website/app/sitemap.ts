import type { MetadataRoute } from "next";
import { locales } from "@/i18n";
import { COUNTRIES, visaHref } from "@/lib/countries";
import { contentBySlug } from "@/lib/visa-content";
import { getPublishedCatalogue } from "@/lib/public-catalogue";
import { getMarketingBlogFeed } from "@/lib/marketing-blog";
import { blogCategories, categorySlug } from "@/lib/blog-taxonomy";
import { absoluteUrl, languageAlternates, localePath } from "@/lib/seo";

export const revalidate = 300;

/**
 * Every indexable canonical URL, nothing else (MKT-012):
 * - final URLs only: English unprefixed, Chinese under /zh-CN (never "/zh-CN/",
 *   which 308s), no /about (there is no such page), no noindex routes (/events);
 * - each bilingual route lists its en / zh / x-default alternates;
 * - lastmod only where a real content date exists (articles), not build time;
 * - visa pages come from the reviewed destination list plus anything newly
 *   published, so a catalogue API outage cannot drop the money pages.
 */
const STATIC_ROUTES = [
  "",
  "/product",
  "/apply",
  "/contact",
  "/careers",
  "/security",
  "/status",
  "/legal/privacy",
  "/legal/terms",
  "/blog",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [published, blogFeeds] = await Promise.all([
    getPublishedCatalogue(),
    Promise.all(locales.map(async (locale) => ({ locale, result: await getMarketingBlogFeed(locale) }))),
  ]);

  const visaSlugs = new Set([
    ...COUNTRIES.filter((country) => country.launched && contentBySlug(country.slug)).map((country) => country.slug),
    ...published.map((entry) => entry.slug),
  ]);
  visaSlugs.delete("viza-test");
  const visaRoutes = [...visaSlugs].map(visaHref);

  const bilingual = (route: string, priority: number): MetadataRoute.Sitemap =>
    locales.map((locale) => ({
      url: absoluteUrl(localePath(locale, route)),
      changeFrequency: "weekly" as const,
      priority,
      alternates: { languages: languageAlternates(route) },
    }));

  const staticEntries = STATIC_ROUTES.flatMap((route) =>
    bilingual(route, route === "" ? 1.0 : route === "/apply" || route === "/blog" ? 0.7 : 0.5),
  );
  const visaEntries = visaRoutes.flatMap((route) => bilingual(route, 0.9));

  const blogEntries = locales.flatMap((locale) => {
    const feed = blogFeeds.find((entry) => entry.locale === locale)?.result;
    const posts = feed?.status === "ok" ? feed.feed.posts : [];
    const postEntries = posts.map((post) => ({
      url: absoluteUrl(localePath(locale, `/blog/${post.slug}`)),
      lastModified: new Date(post.publishedAt),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }));
    const categoryEntries = blogCategories(posts).map((category) => {
      const latest = posts
        .filter((post) => post.category && categorySlug(post.category) === category.slug)
        .reduce((max, post) => Math.max(max, Date.parse(post.publishedAt)), 0);
      return {
        url: absoluteUrl(localePath(locale, `/blog/category/${category.slug}`)),
        ...(latest ? { lastModified: new Date(latest) } : {}),
        changeFrequency: "weekly" as const,
        priority: 0.5,
      };
    });
    return [...categoryEntries, ...postEntries];
  });

  return [...staticEntries, ...visaEntries, ...blogEntries];
}
