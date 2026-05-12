import "server-only";

import {
  getCuratedCitiesForCountry,
  type CuratedCity,
} from "@/lib/travel/locations";

export type CountryOption = {
  value: string;
  label: string;
  labelEn: string;
  labelZh?: string;
  code: string;
  search?: string;
};

export type CityOption = {
  value: string;
  label: string;
  labelEn: string;
  labelZh?: string;
  search?: string;
};

type CountriesRepoItem = {
  cca2?: string;
  name?: {
    common?: string;
  };
  translations?: {
    zho?: {
      common?: string;
    };
  };
  altSpellings?: string[];
  capital?: string[];
};

type CountryMeta = {
  code: string;
  nameEn: string;
  nameZh?: string;
  altSpellings: string[];
  capitals: string[];
};

const COUNTRIES_SOURCE_URLS = [
  "https://raw.githubusercontent.com/mledoze/countries/master/countries.json",
  "https://cdn.jsdelivr.net/gh/mledoze/countries@master/countries.json",
];

let countriesPromise: Promise<CountryOption[]> | null = null;
let countryCodeLookupPromise: Promise<Map<string, string>> | null = null;
let countriesSourcePromise: Promise<CountriesRepoItem[]> | null = null;
let countriesByCodePromise: Promise<Map<string, CountryMeta>> | null = null;

function normalizeLookupKey(value: string): string {
  return value.trim().toLowerCase();
}

function buildSearchText(parts: Array<string | undefined>): string {
  const seen = new Set<string>();
  const tokens: string[] = [];

  for (const part of parts) {
    if (!part) continue;
    const token = part.trim();
    if (!token) continue;
    const key = normalizeLookupKey(token);
    if (seen.has(key)) continue;
    seen.add(key);
    tokens.push(token);
  }

  return tokens.join(" ");
}

function uniqueByValue<T extends { value: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    const key = normalizeLookupKey(item.value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}

async function fetchArrayFromSources<T>(urls: string[]): Promise<T[]> {
  let lastError: unknown = null;

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        cache: "force-cache",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const payload = (await response.json()) as unknown;
      if (!Array.isArray(payload)) {
        throw new Error("Invalid dataset format.");
      }

      return payload as T[];
    } catch (error) {
      lastError = error;
    }
  }

  const message =
    lastError instanceof Error ? lastError.message : "Unknown fetch error.";
  throw new Error(`Failed to load dataset from all sources. ${message}`);
}

async function fetchCountriesFromSource(): Promise<CountriesRepoItem[]> {
  if (!countriesSourcePromise) {
    countriesSourcePromise = fetchArrayFromSources<CountriesRepoItem>(
      COUNTRIES_SOURCE_URLS
    ).catch((error) => {
      countriesSourcePromise = null;
      throw error;
    });
  }

  return countriesSourcePromise;
}

function toCountryMeta(item: CountriesRepoItem): CountryMeta | null {
  const code = typeof item.cca2 === "string" ? item.cca2.trim() : "";
  const nameEn =
    typeof item.name?.common === "string" ? item.name.common.trim() : "";
  const nameZh =
    typeof item.translations?.zho?.common === "string"
      ? item.translations.zho.common.trim()
      : "";
  const altSpellings = Array.isArray(item.altSpellings)
    ? item.altSpellings
        .filter((alias): alias is string => typeof alias === "string")
        .map((alias) => alias.trim())
        .filter(Boolean)
    : [];
  const capitals = Array.isArray(item.capital)
    ? item.capital
        .filter((capital): capital is string => typeof capital === "string")
        .map((capital) => capital.trim())
        .filter(Boolean)
    : [];

  if (!code || !nameEn) return null;

  return {
    code,
    nameEn,
    nameZh: nameZh || undefined,
    altSpellings,
    capitals,
  };
}

export async function getCountryOptions(): Promise<CountryOption[]> {
  if (!countriesPromise) {
    countriesPromise = (async () => {
      const records = await fetchCountriesFromSource();
      const options: CountryOption[] = [];

      for (const item of records) {
        const meta = toCountryMeta(item);
        if (!meta) continue;

        const label = meta.nameZh
          ? `${meta.nameZh} (${meta.nameEn})`
          : meta.nameEn;
        const search = buildSearchText([
          meta.nameEn,
          meta.nameZh,
          meta.code,
          ...meta.altSpellings,
        ]);

        options.push({
          value: meta.nameEn,
          label,
          labelEn: meta.nameEn,
          labelZh: meta.nameZh,
          code: meta.code,
          search,
        });
      }

      options.sort((a, b) => a.labelEn.localeCompare(b.labelEn));
      return options;
    })().catch((error) => {
      countriesPromise = null;
      throw error;
    });
  }

  return countriesPromise;
}

async function getCountryCodeLookup(): Promise<Map<string, string>> {
  if (!countryCodeLookupPromise) {
    countryCodeLookupPromise = (async () => {
      const records = await fetchCountriesFromSource();
      const map = new Map<string, string>();

      for (const item of records) {
        const meta = toCountryMeta(item);
        if (!meta) continue;

        map.set(normalizeLookupKey(meta.nameEn), meta.code);
        map.set(normalizeLookupKey(meta.code), meta.code);

        if (meta.nameZh) {
          map.set(normalizeLookupKey(meta.nameZh), meta.code);
        }

        for (const alias of meta.altSpellings) {
          map.set(normalizeLookupKey(alias), meta.code);
        }
      }

      return map;
    })().catch((error) => {
      countryCodeLookupPromise = null;
      throw error;
    });
  }

  return countryCodeLookupPromise;
}

async function getCountriesByCode(): Promise<Map<string, CountryMeta>> {
  if (!countriesByCodePromise) {
    countriesByCodePromise = (async () => {
      const records = await fetchCountriesFromSource();
      const map = new Map<string, CountryMeta>();

      for (const item of records) {
        const meta = toCountryMeta(item);
        if (!meta) continue;
        map.set(meta.code, meta);
      }

      return map;
    })().catch((error) => {
      countriesByCodePromise = null;
      throw error;
    });
  }

  return countriesByCodePromise;
}

function resolveCountryCodeFromLookup(
  lookup: Map<string, string>,
  countryName: string
): string | null {
  const normalized = normalizeLookupKey(countryName);
  if (!normalized) return null;
  return lookup.get(normalized) ?? null;
}

function toCityOption(city: CuratedCity): CityOption {
  const labelEn = city.en.trim();
  const labelZh = city.zh?.trim();
  const label = labelZh ? `${labelZh} (${labelEn})` : labelEn;
  const search = buildSearchText([labelEn, labelZh, ...(city.aliases ?? [])]);

  return {
    value: labelEn,
    labelEn,
    labelZh: labelZh || undefined,
    label,
    search,
  };
}

function getCapitalCityOptions(country: CountryMeta): CityOption[] {
  return uniqueByValue(
    country.capitals.map((capital) => {
      const name = capital.trim();
      return {
        value: name,
        label: name,
        labelEn: name,
        search: name,
      } satisfies CityOption;
    })
  );
}

export async function getCitiesForCountries(
  countryNames: string[]
): Promise<Record<string, CityOption[]>> {
  const [lookup, countriesByCode] = await Promise.all([
    getCountryCodeLookup(),
    getCountriesByCode(),
  ]);

  const result: Record<string, CityOption[]> = {};

  for (const countryName of countryNames) {
    const code = resolveCountryCodeFromLookup(lookup, countryName);
    if (!code) {
      result[countryName] = [];
      continue;
    }

    const country = countriesByCode.get(code);
    if (!country) {
      result[countryName] = [];
      continue;
    }

    const curated = getCuratedCitiesForCountry(country.nameEn).map(toCityOption);
    const fallback = curated.length > 0 ? [] : getCapitalCityOptions(country);

    result[countryName] = uniqueByValue([...curated, ...fallback]).sort((a, b) =>
      a.labelEn.localeCompare(b.labelEn)
    );
  }

  return result;
}
