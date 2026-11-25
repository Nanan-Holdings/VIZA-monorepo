"use client";

import VisaCountryTemplate from "@/components/VisaCountryTemplate";
import VisaDestinationPage from "@/components/VisaDestinationPage";
import type { CatalogueCountry } from "@/components/CatalogueProvider";
import type { CountryMeta } from "@/lib/countries";
import { isDestinationContent, type VisaContent } from "@/lib/visa-content/types";

/**
 * Data-driven visa destination page. Every launched country supplies a `DestinationContent`, which renders
 * on the Framer detail layout (components/VisaDestinationPage.tsx). Content in the older layout falls back
 * to the thin template.
 */
export default function VisaCountryRich({
  country,
  content,
}: {
  country: CountryMeta & Pick<CatalogueCountry, "pricing">;
  content: VisaContent;
}) {
  return isDestinationContent(content) ? (
    <VisaDestinationPage country={country} content={content} />
  ) : (
    <VisaCountryTemplate country={country} />
  );
}
