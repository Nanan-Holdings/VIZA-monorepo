"use client";

import { useParams } from "next/navigation";
import { useLocale } from "next-intl";
import VisaCountryRich from "@/components/VisaCountryRich";
import VisaCountryTemplate from "@/components/VisaCountryTemplate";
import ComingSoon from "@/components/ComingSoon";
import { countryBySlug } from "@/lib/countries";
import { contentBySlug } from "@/lib/visa-content";

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
 */
export default function VisaCountryPage() {
  const params = useParams();
  const locale = useLocale();
  const slug = String(params.country ?? "");
  const country = countryBySlug(slug);

  if (!country) {
    return <ComingSoon name={slug.replace(/-/g, " ")} />;
  }
  if (!country.launched) {
    return <ComingSoon name={country.name} />;
  }

  const content = contentBySlug(slug, locale);
  if (content) {
    return <VisaCountryRich country={country} content={content} />;
  }
  return <VisaCountryTemplate country={country} />;
}
