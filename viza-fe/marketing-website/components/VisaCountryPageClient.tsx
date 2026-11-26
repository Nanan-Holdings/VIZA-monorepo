"use client";

import { useParams } from "next/navigation";
import VisaCountryRich from "@/components/VisaCountryRich";
import VisaCountryTemplate from "@/components/VisaCountryTemplate";
import ComingSoon from "@/components/ComingSoon";
import { useCatalogue } from "@/components/CatalogueProvider";
import type { VisaContent } from "@/lib/visa-content/types";

/**
 * Client rendering for a validated public visa destination route. The content is resolved on the server for the
 * request locale (page.tsx) and passed in, so the client bundle never carries every destination in every language.
 */
export default function VisaCountryPageClient({ content }: { content?: VisaContent }) {
  const params = useParams();
  const slug = String(params.country ?? "");
  const { countryBySlug } = useCatalogue();
  const country = countryBySlug(slug);

  if (!country) return <ComingSoon name={slug.replace(/-/g, " ")} />;
  if (!country.launched && !country.consultOnly) return <ComingSoon name={country.name} />;

  return content
    ? <VisaCountryRich country={country} content={content} />
    : <VisaCountryTemplate country={country} />;
}
