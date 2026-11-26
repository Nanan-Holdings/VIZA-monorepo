import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import VisaCountryPageClient from "@/components/VisaCountryPageClient";
import { locales } from "@/i18n";
import { COUNTRIES, isPublished, type CountryMeta } from "@/lib/countries";
import { getPublishedCatalogue } from "@/lib/public-catalogue";
import { loadVisaContent } from "@/lib/visa-content";
import { destinationDescription, destinationTitle } from "@/lib/seo/titles";
import { loadSeoCopy } from "@/lib/seo/seo-copy";
import { pageMetadata } from "@/lib/seo/metadata";

/**
 * Dynamic visa destination page.
 *
 * The slug is resolved on the server against lib/countries.ts and the published
 * catalogue:
 *   - launched country: rendered (rich content, or the thin template fallback)
 *   - known but not launched: coming-soon page, noindex
 *   - unknown slug: a real 404
 *
 * generateStaticParams prebuilds every launched destination in every enabled locale.
 */
export const dynamicParams = true;

export function generateStaticParams() {
  return locales.flatMap((locale) =>
    COUNTRIES.filter(isPublished).map((c) => ({ locale, country: c.slug })),
  );
}

async function resolveCountry(slug: string): Promise<{ country: CountryMeta; launched: boolean } | null> {
  if (slug === "viza-test") return null;
  const known = COUNTRIES.find((c) => c.slug === slug);
  const published = (await getPublishedCatalogue()).find((entry) => entry.slug === slug);
  if (!known && !published) return null;
  const base = known ?? published!;
  return { country: base as CountryMeta, launched: Boolean((known && isPublished(known)) || published) };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; country: string }>;
}): Promise<Metadata> {
  const { locale, country: slug } = await params;
  const resolved = await resolveCountry(slug);
  if (!resolved) return { robots: { index: false, follow: false } };
  const { country, launched } = resolved;
  const tc = await getTranslations({ locale, namespace: "countries" });
  const name = tc.has(country.slug) ? tc(country.slug) : country.name;
  const copy = await loadSeoCopy(locale);
  return pageMetadata({
    title: destinationTitle(country, name, locale, copy),
    description: destinationDescription(country, name, locale, copy),
    path: `/visa/${country.slug}`,
    locale,
    ogKey: `visa-${country.slug}`,
    noindex: !launched,
  });
}

export default async function VisaCountryPage({
  params,
}: {
  params: Promise<{ locale: string; country: string }>;
}) {
  const { locale, country: slug } = await params;
  setRequestLocale(locale);
  if (!(await resolveCountry(slug))) notFound();
  return <VisaCountryPageClient content={await loadVisaContent(slug, locale)} />;
}
