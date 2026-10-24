import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import VisaCountryPageClient from "@/components/VisaCountryPageClient";
import { COUNTRIES } from "@/lib/countries";
import { getPublishedCatalogue } from "@/lib/public-catalogue";
import { pageMetadata } from "@/lib/seo";

/**
 * Dynamic visa destination page (MKT-003/004/005).
 *
 * Resolves the slug against lib/countries.ts + lib/visa-content:
 *   - launched country with rich content → VisaCountryRich (MKT-004)
 *   - launched country without content yet → thin VisaCountryTemplate fallback
 *   - known but unlaunched → ComingSoon (MKT-003)
 *   - unknown slug → ComingSoon fallback (no 404 — never dead-ends a CTA)
 *
 * Every country (including Indonesia) now renders here from data — there is no
 * bespoke per-country page.
 *
 * Metadata: keyword-led title and description per destination from
 * `seo.visa.<slug>` (see docs/seo/keyword-map.md). Coming-soon and unknown
 * slugs still render, so CTAs never dead-end, but they are noindex so they
 * cannot be indexed as thin soft-404 pages.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; country: string }>;
}): Promise<Metadata> {
  const { locale, country: slug } = await params;
  const path = `/visa/${slug}`;
  const [t, tCountries, published] = await Promise.all([
    getTranslations({ locale, namespace: "seo" }),
    getTranslations({ locale, namespace: "countries" }),
    getPublishedCatalogue(),
  ]);
  const known = COUNTRIES.find((country) => country.slug === slug);
  const extra = published.find((entry) => entry.slug === slug);
  const name = tCountries.has(slug) ? tCountries(slug) : known?.name ?? extra?.name ?? slug.replace(/-/g, " ");

  if (!(known?.launched || extra)) {
    return pageMetadata({
      locale,
      path,
      title: t("visaComingSoon.title", { country: name }),
      description: t("visaComingSoon.description", { country: name }),
      noindex: true,
    });
  }

  const hasCopy = t.has(`visa.${slug}.title`);
  // 1200x630 crops of the destination heroes (public/og/visa/<slug>.jpg);
  // a destination published later without one falls back to the default card.
  const image = known
    ? { url: `/og/visa/${slug}.jpg`, width: 1200, height: 630, alt: name }
    : undefined;

  return pageMetadata({
    locale,
    path,
    title: hasCopy ? t(`visa.${slug}.title`) : t("visaFallback.title", { country: name }),
    description: hasCopy ? t(`visa.${slug}.description`) : t("visaFallback.description", { country: name }),
    image,
  });
}

export default async function VisaCountryPage({ params }: { params: Promise<{ country: string }> }) {
  const { country } = await params;
  if (country === "viza-test") notFound();

  return <VisaCountryPageClient />;
}
