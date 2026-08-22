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

export function CatalogueProvider({ entries, children }: { entries: PublishedCatalogueEntry[]; children: React.ReactNode }) {
  const value = useMemo<CatalogueContextValue>(() => {
    const published = new Map(entries.map((entry) => [entry.slug, entry]));
    const known = COUNTRIES.map<CatalogueCountry>((fallback) => {
      const entry = published.get(fallback.slug);
      if (!entry) return { ...fallback, launched: false, pricing: null, version: null, publishedAt: null };
      return { ...entry, launched: true, pricing: entry.pricing, version: entry.version, publishedAt: entry.publishedAt };
    });
    const knownSlugs = new Set(known.map((country) => country.slug));
    const additional = entries
      .filter((entry) => !knownSlugs.has(entry.slug))
      .map<CatalogueCountry>((entry) => ({ ...entry, launched: true, pricing: entry.pricing }));
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
