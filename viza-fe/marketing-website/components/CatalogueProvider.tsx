"use client";

import { createContext, useContext, useMemo } from "react";
import { COUNTRIES, type CountryMeta } from "@/lib/countries";
import type { CataloguePricing, PublishedCatalogueEntry } from "@/lib/public-catalogue";

export interface CatalogueCountry extends CountryMeta {
  pricing: CataloguePricing | null;
  version: number | null;
  publishedAt: string | null;
}

interface CatalogueContextValue {
  countries: CatalogueCountry[];
  launchedCountries: CatalogueCountry[];
  countryBySlug: (slug: string) => CatalogueCountry | undefined;
}

const CatalogueContext = createContext<CatalogueContextValue | null>(null);

/** Neutral explore metadata for a published destination with no lib/countries.ts entry. */
const CATALOGUE_ONLY_DEFAULTS = {
  processingDays: 30,
  purposes: ["tourism", "business"],
  documentTier: "standard",
  validityDays: 90,
  popularity: 999,
} satisfies Pick<CountryMeta, "processingDays" | "purposes" | "documentTier" | "validityDays" | "popularity">;

export function CatalogueProvider({ entries, children }: { entries: PublishedCatalogueEntry[]; children: React.ReactNode }) {
  const value = useMemo<CatalogueContextValue>(() => {
    const published = new Map(entries.map((entry) => [entry.slug, entry]));
    const known = COUNTRIES.map<CatalogueCountry>((fallback) => {
      const entry = published.get(fallback.slug);
      if (!entry) return { ...fallback, pricing: null, version: null, publishedAt: null };
      // Published presentation data wins, but the explore filter/sort metadata is
      // only authored locally — spread the fallback first so it survives.
      return { ...fallback, ...entry, launched: true, pricing: entry.pricing, version: entry.version, publishedAt: entry.publishedAt };
    });
    const knownSlugs = new Set(known.map((country) => country.slug));
    const additional = entries
      .filter((entry) => !knownSlugs.has(entry.slug))
      .map<CatalogueCountry>((entry) => ({
        ...entry,
        launched: true,
        pricing: entry.pricing,
        // Explore filter/sort metadata is authored in lib/countries.ts. A destination
        // published without a local entry still has to be browsable, so fall back to
        // neutral values that never let it win a sort or get filtered out silently.
        ...CATALOGUE_ONLY_DEFAULTS,
      }));
    const countries = [...known, ...additional];
    const launchedCountries = countries.filter((country) => country.launched);
    const bySlug = new Map(countries.map((country) => [country.slug, country]));
    return { countries, launchedCountries, countryBySlug: (slug) => bySlug.get(slug) };
  }, [entries]);

  return <CatalogueContext.Provider value={value}>{children}</CatalogueContext.Provider>;
}

export function useCatalogue(): CatalogueContextValue {
  const value = useContext(CatalogueContext);
  if (!value) throw new Error("useCatalogue must be used inside CatalogueProvider");
  return value;
}
