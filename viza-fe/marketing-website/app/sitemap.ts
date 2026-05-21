import type { MetadataRoute } from "next";
import { locales, defaultLocale } from "@/i18n";

const ROUTES = [
  "",
  "/apply",
  "/contact",
  "/careers",
  "/security",
  "/status",
  "/refunds",
  "/visa/indonesia",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://viza.com").replace(/\/$/, "");
  const now = new Date();

  return locales.flatMap((locale) =>
    ROUTES.map((route) => ({
      url: `${base}${locale === defaultLocale ? "" : `/${locale}`}${route || "/"}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: route === "" ? 1.0 : 0.7,
    })),
  );
}
