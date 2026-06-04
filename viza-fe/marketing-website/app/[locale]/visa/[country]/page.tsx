"use client";

import { useParams } from "next/navigation";
import VisaCountryTemplate from "@/components/VisaCountryTemplate";
import ComingSoon from "@/components/ComingSoon";
import { countryBySlug } from "@/lib/countries";

/**
 * Dynamic visa destination page (MKT-003/004/005).
 *
 * Resolves the slug against lib/countries.ts:
 *   - launched country → full data-driven VisaCountryTemplate (MKT-004)
 *   - known but unlaunched → ComingSoon (MKT-003)
 *   - unknown slug → ComingSoon fallback (no 404 — never dead-ends a CTA)
 *
 * Note: /visa/indonesia is served by its bespoke static page (that static
 * route wins over this dynamic segment); the other 15 launch slugs render
 * here (MKT-005).
 */
export default function VisaCountryPage() {
  const params = useParams();
  const slug = String(params.country ?? "");
  const country = countryBySlug(slug);

  if (!country) {
    return <ComingSoon name={slug.replace(/-/g, " ")} />;
  }
  if (!country.launched) {
    return <ComingSoon name={country.name} />;
  }
  return <VisaCountryTemplate country={country} />;
}
