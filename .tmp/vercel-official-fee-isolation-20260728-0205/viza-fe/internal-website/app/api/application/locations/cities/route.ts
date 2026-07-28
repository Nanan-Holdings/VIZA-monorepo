type CityDatasetRecord = {
  id?: number | string;
  name?: string;
  state_code?: string;
  country_code?: string;
  native?: string | null;
  population?: number | null;
  translations?: Record<string, string | undefined>;
};

type CityOptionResponse = {
  code: string;
  zh: string;
  en: string;
};

const CITY_CACHE_TTL_MS = 1000 * 60 * 60 * 24;
const cityCache = new Map<string, { expiresAt: number; options: CityOptionResponse[] }>();

function normalizeCountryCode(value: string | null): string | null {
  const normalized = value?.trim().toUpperCase();
  return normalized && /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}

function normalizeRegionCode(value: string | null): string | null {
  const normalized = value?.trim().toUpperCase();
  return normalized || null;
}

function citySourceUrls(countryCode: string): string[] {
  return [
    `https://raw.githubusercontent.com/dr5hn/countries-states-cities-database/master/contributions/cities/${countryCode}.json`,
    `https://cdn.jsdelivr.net/gh/dr5hn/countries-states-cities-database@master/contributions/cities/${countryCode}.json`,
  ];
}

async function fetchCityDataset(countryCode: string): Promise<CityDatasetRecord[]> {
  let lastError: unknown = null;

  for (const url of citySourceUrls(countryCode)) {
    try {
      const response = await fetch(url, {
        next: { revalidate: 60 * 60 * 24 },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as unknown;
      if (!Array.isArray(payload)) {
        throw new Error("City dataset is not an array.");
      }

      return payload as CityDatasetRecord[];
    } catch (error) {
      lastError = error;
    }
  }

  const message = lastError instanceof Error ? lastError.message : "Unknown error";
  throw new Error(`Unable to load city dataset for ${countryCode}: ${message}`);
}

function normalizeLookup(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function cityNameZh(record: CityDatasetRecord): string | null {
  return (
    record.translations?.["zh-CN"]?.trim() ||
    record.translations?.zh?.trim() ||
    record.native?.trim() ||
    null
  );
}

function toCityOption(record: CityDatasetRecord, index: number): CityOptionResponse | null {
  const en = record.name?.trim();
  if (!en) return null;

  return {
    code: String(record.id ?? `${record.country_code ?? "XX"}-${record.state_code ?? "NA"}-${index}`),
    zh: cityNameZh(record) ?? en,
    en,
  };
}

function uniqueCities(options: CityOptionResponse[]): CityOptionResponse[] {
  const seen = new Set<string>();
  const result: CityOptionResponse[] = [];

  for (const option of options) {
    const key = `${normalizeLookup(option.zh)}:${normalizeLookup(option.en)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(option);
  }

  return result;
}

async function getCityOptions(countryCode: string, regionCode: string | null): Promise<CityOptionResponse[]> {
  const cacheKey = `${countryCode}:${regionCode ?? "ALL"}`;
  const cached = cityCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.options;

  const records = await fetchCityDataset(countryCode);
  const options = uniqueCities(
    records
      .filter((record) => record.country_code?.toUpperCase() === countryCode)
      .filter((record) => !regionCode || record.state_code?.toUpperCase() === regionCode)
      .map(toCityOption)
      .filter((option): option is CityOptionResponse => option !== null),
  ).sort((a, b) => a.en.localeCompare(b.en));

  cityCache.set(cacheKey, {
    expiresAt: Date.now() + CITY_CACHE_TTL_MS,
    options,
  });

  return options;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const countryCode = normalizeCountryCode(searchParams.get("countryCode"));
  const regionCode = normalizeRegionCode(searchParams.get("regionCode"));

  if (!countryCode) {
    return Response.json({ error: "countryCode must be a two-letter ISO code." }, { status: 400 });
  }

  try {
    const options = await getCityOptions(countryCode, regionCode);
    return Response.json({
      source: "dr5hn/countries-states-cities-database",
      countryCode,
      regionCode,
      options,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load cities.";
    return Response.json({ error: message, options: [] }, { status: 502 });
  }
}
