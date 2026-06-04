import type { MetadataRoute } from "next";
import { locales, defaultLocale } from "@/i18n";
import { LAUNCHED_COUNTRIES, visaHref } from "@/lib/countries";

/**
 * Static marketing routes + every launched visa country page (MKT-012).
 * Coming-soon (launched=false) countries are intentionally excluded.
 */
const STATIC_ROUTES = [
  "",
  "/apply",
  "/contact",
  "/careers",
  "/security",
  "/status",
  "/refunds",
  "/legal/privacy",
  "/legal/terms",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://viza.com").replace(/\/$/, "");
  const now = new Date();

  const visaRoutes = LAUNCHED_COUNTRIES.map((c) => visaHref(c.slug));
  const routes = [...STATIC_ROUTES, ...visaRoutes];

  return locales.flatMap((locale) =>
    routes.map((route) => ({
      url: `${base}${locale === defaultLocale ? "" : `/${locale}`}${route || "/"}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: route === "" ? 1.0 : route.startsWith("/visa/") ? 0.8 : 0.7,
    })),
  );
}
