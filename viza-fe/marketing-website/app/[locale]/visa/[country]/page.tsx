import { notFound } from "next/navigation";
import VisaCountryPageClient from "@/components/VisaCountryPageClient";

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
export default async function VisaCountryPage({ params }: { params: Promise<{ country: string }> }) {
  const { country } = await params;
  if (country === "viza-test") notFound();

  return <VisaCountryPageClient />;
}
