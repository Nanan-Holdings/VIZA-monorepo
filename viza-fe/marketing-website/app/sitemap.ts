import type { MetadataRoute } from "next";
import { locales, defaultLocale } from "@/i18n";
import { visaHref } from "@/lib/countries";
import { getPublishedCatalogue } from "@/lib/public-catalogue";
import { getMarketingBlogFeed } from "@/lib/marketing-blog";

/**
 * Static marketing routes + every launched visa country page (MKT-012).
 * Coming-soon (launched=false) countries are intentionally excluded.
 */
const STATIC_ROUTES = [
  "",
  "/about",
  "/product",
  "/apply",
  "/contact",
  "/careers",
  "/security",
  "/status",
  "/refunds",
  "/legal/privacy",
  "/legal/terms",
  "/blog",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://viza.it.com").replace(/\/$/, "");
  const now = new Date();

  const [published, blogFeeds] = await Promise.all([
    getPublishedCatalogue(),
    Promise.all(locales.map(async (locale) => ({ locale, result: await getMarketingBlogFeed(locale) }))),
  ]);
  const visaRoutes = published.map((c) => visaHref(c.slug));
  const routes = [...STATIC_ROUTES, ...visaRoutes];

  return locales.flatMap((locale) => {
    const feed = blogFeeds.find((entry) => entry.locale === locale)?.result;
    const blogPosts = feed?.status === "ok" ? feed.feed.posts : [];
    const baseRoutes = routes.map((route) => ({
      url: `${base}${locale === defaultLocale ? "" : `/${locale}`}${route || "/"}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: route === "" ? 1.0 : route.startsWith("/visa/") ? 0.8 : 0.7,
    }));
    const postRoutes = blogPosts.map((post) => ({
      url: `${base}${locale === defaultLocale ? "" : `/${locale}`}/blog/${post.slug}`,
      lastModified: new Date(post.publishedAt),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }));
    return [...baseRoutes, ...postRoutes];
  });
}
