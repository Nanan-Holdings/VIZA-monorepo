"use client";

import { useParams } from "next/navigation";
import { useLocale } from "next-intl";
import VisaCountryRich from "@/components/VisaCountryRich";
import VisaCountryTemplate from "@/components/VisaCountryTemplate";
import ComingSoon from "@/components/ComingSoon";
import { useCatalogue } from "@/components/CatalogueProvider";
import { contentBySlug } from "@/lib/visa-content";

/**
 * Interactive catalogue resolution for a visa detail route. Metadata and
 * indexability are resolved by the server page so search crawlers receive
 * destination-specific SEO tags before the client catalogue hydrates.
 */
export default function VisaCountryPageClient() {
  const params = useParams();
  const locale = useLocale();
  const slug = String(params.country ?? "");
  const { countryBySlug } = useCatalogue();
  const country = countryBySlug(slug);

  if (!country) return <ComingSoon name={slug.replace(/-/g, " ")} />;
  if (!country.launched) return <ComingSoon name={country.name} />;

  const content = contentBySlug(slug, locale);
  return content ? <VisaCountryRich country={country} content={content} /> : <VisaCountryTemplate country={country} />;
}
