import { NextResponse } from "next/server";
import { countries } from "country-data-list";
import staticOptions from "@/lib/vn-prearrival/official-static-options.json";

export const dynamic = "force-dynamic";

const OFFICIAL_BASE = "https://prearrival.immigration.gov.vn/bio-management-service";
const FIND_ALL_SOURCES = new Set([
  "nationality",
  "country_code",
  "passport_type",
  "visa_type",
  "visa_issue_place",
  "purpose",
  "airport",
  "border_gate",
  "port",
  "flight",
  "hotel",
]);

type OfficialOption = {
  code?: unknown;
  value?: unknown;
  vn_value?: unknown;
  en_value?: unknown;
  vietnam_value?: unknown;
  english_value?: unknown;
  cn_value?: unknown;
  name?: unknown;
  airport?: unknown;
  airline?: unknown;
  visa_type?: unknown;
  ward?: unknown;
  province_city?: unknown;
};

type VisaFormOption = {
  value: string;
  text: string;
  label_en: string;
  label_zh: string;
  official_label: string;
  code?: string;
  airport?: string;
  airline?: string;
};

type CachedOfficialOptions = {
  expiresAt: number;
  promise?: Promise<OfficialOption[]>;
  items?: OfficialOption[];
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FLIGHT_CACHE_TTL_MS = 30 * 60 * 1000;
const officialOptionsCache = new Map<string, CachedOfficialOptions>();

const STATIC_OPTION_SOURCES = staticOptions.sources as Record<string, OfficialOption[] | undefined>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function officialItems(value: unknown): OfficialOption[] {
  if (Array.isArray(value)) return value as OfficialOption[];
  const record = asRecord(value);
  const data = record ? record.data : null;
  if (Array.isArray(data)) return data as OfficialOption[];
  const dataRecord = asRecord(data);
  if (Array.isArray(dataRecord?.content)) return dataRecord.content as OfficialOption[];
  if (Array.isArray(record?.content)) return record.content as OfficialOption[];
  return [];
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function zhRegionName(alpha2: string): string {
  try {
    return new Intl.DisplayNames(["zh-CN"], { type: "region" }).of(alpha2.toUpperCase()) ?? "";
  } catch {
    return "";
  }
}

function localCountryCodeOptions(): VisaFormOption[] {
  return countries.all.flatMap((country) => {
    const alpha2 = stringValue(country.alpha2);
    const name = stringValue(country.name);
    if (!alpha2 || !name || !Array.isArray(country.countryCallingCodes)) return [];
    return country.countryCallingCodes
      .filter((callingCode): callingCode is string => typeof callingCode === "string" && /^\+\d+$/.test(callingCode))
      .map((callingCode) => {
        const officialLabel = `${name} (${callingCode})`;
        const zhName = zhRegionName(alpha2) || name;
        return {
          value: callingCode,
          text: officialLabel,
          label_en: officialLabel,
          label_zh: `${zhName} (${callingCode})`,
          official_label: officialLabel,
          code: alpha2,
        };
      });
  });
}

function optionFromOfficial(item: OfficialOption, source: string): VisaFormOption | null {
  const code = stringValue(item.code);
  const rawValue = stringValue(item.value);
  const enValue =
    stringValue(item.en_value) ||
    stringValue(item.english_value) ||
    stringValue(item.name) ||
    code ||
    rawValue;
  const vnValue = stringValue(item.cn_value) || stringValue(item.vn_value) || stringValue(item.vietnam_value) || enValue;
  if (!code && !enValue) return null;

  const airport = stringValue(item.airport);
  const airline = stringValue(item.airline);
  const officialLabel = source === "flight" && airport
    ? `${enValue} - ${airport}`
    : enValue;
  const value = source === "country_code" && rawValue
    ? rawValue
    : source === "flight"
      ? code || (airport ? `${enValue}_${airport}` : enValue)
      : code || rawValue || enValue;
  const labelZh = source === "country_code"
    ? `${zhRegionName(code) || vnValue.replace(/\s*\(\+\d+\)\s*$/, "") || enValue} (${rawValue || value})`
    : vnValue;

  return {
    value,
    text: officialLabel,
    label_en: officialLabel,
    label_zh: labelZh,
    official_label: officialLabel,
    ...(code ? { code } : {}),
    ...(airport ? { airport } : {}),
    ...(airline ? { airline } : {}),
  };
}

async function fetchOfficialJson(path: string, init?: RequestInit): Promise<unknown> {
  const hasBody = init?.body !== undefined;
  const url = `${OFFICIAL_BASE}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      "Accept": "application/json, text/plain, */*",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      ...(hasBody ? {
        "Origin": "https://prearrival.immigration.gov.vn",
        "Referer": "https://prearrival.immigration.gov.vn/apps/submit-document",
      } : {}),
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (response.status === 401 && !hasBody) {
    const retry = await fetch(url, {
      headers: { "Accept": "application/json, text/plain, */*" },
      cache: "no-store",
    });
    if (retry.ok) return retry.json();
  }
  if (!response.ok) {
    throw new Error(`Official Vietnam Pre-Arrival category request failed with ${response.status}`);
  }
  return response.json();
}

async function loadOfficialItems(source: string): Promise<OfficialOption[]> {
  const staticItems = STATIC_OPTION_SOURCES[source];
  if (staticItems?.length) return staticItems;

  const cached = officialOptionsCache.get(source);
  const now = Date.now();
  if (cached?.items && cached.expiresAt > now) return cached.items;
  if (cached?.promise) return cached.promise;

  const ttl = source === "flight" ? FLIGHT_CACHE_TTL_MS : CACHE_TTL_MS;
  const promise = fetchOfficialJson(`/category/findAllActive/${source}`)
    .then((json) => officialItems(json))
    .then((items) => {
      officialOptionsCache.set(source, { items, expiresAt: Date.now() + ttl });
      return items;
    })
    .catch((error) => {
      officialOptionsCache.delete(source);
      throw error;
    });
  officialOptionsCache.set(source, { promise, expiresAt: now + ttl });
  return promise;
}

function issuePlaceMatchesVisaType(item: OfficialOption, parent: string): boolean {
  if (!parent) return true;
  const visaTypes = stringValue(item.visa_type)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return visaTypes.length === 0 || visaTypes.includes(parent);
}

function hotelLocationLabel(value: string, fallback: string): string {
  return value || fallback;
}

function deriveHotelProvinceOptions(items: OfficialOption[]): VisaFormOption[] {
  const byCode = new Map<string, string>();
  for (const item of items) {
    const code = stringValue(item.province_city);
    if (!code || byCode.has(code)) continue;
    const label = stringValue(item.en_value).split(",").map((part) => part.trim()).filter(Boolean).at(-1) ?? code;
    byCode.set(code, label);
  }
  return Array.from(byCode.entries()).map(([code, label]) => ({
    value: code,
    text: hotelLocationLabel(label, code),
    label_en: hotelLocationLabel(label, code),
    label_zh: hotelLocationLabel(label, code),
    official_label: hotelLocationLabel(label, code),
    code,
  }));
}

function deriveHotelWardOptions(items: OfficialOption[], provinceCode: string): VisaFormOption[] {
  const byCode = new Map<string, string>();
  for (const item of items) {
    if (provinceCode && stringValue(item.province_city) !== provinceCode) continue;
    const code = stringValue(item.ward);
    if (!code || byCode.has(code)) continue;
    const parts = stringValue(item.en_value).split(",").map((part) => part.trim()).filter(Boolean);
    const label = parts.length >= 2 ? parts[parts.length - 2] : code;
    byCode.set(code, label ?? code);
  }
  return Array.from(byCode.entries()).map(([code, label]) => ({
    value: code,
    text: hotelLocationLabel(label, code),
    label_en: hotelLocationLabel(label, code),
    label_zh: hotelLocationLabel(label, code),
    official_label: hotelLocationLabel(label, code),
    code,
  }));
}

async function loadFindAllOptions(source: string, parent = ""): Promise<VisaFormOption[]> {
  if (source === "country_code") return localCountryCodeOptions();
  const rawItems = await loadOfficialItems(source);
  const visaTypeFilteredItems = source === "visa_issue_place"
    ? rawItems.filter((item) => issuePlaceMatchesVisaType(item, parent))
    : rawItems;
  const items = source === "hotel" && parent
    ? visaTypeFilteredItems.filter((item) => stringValue(item.ward) === parent || stringValue(item.province_city) === parent)
    : visaTypeFilteredItems;
  return items.map((item) => optionFromOfficial(item, source)).filter(Boolean) as VisaFormOption[];
}

function filterOptionsByKeyword(options: VisaFormOption[], keyword: string): VisaFormOption[] {
  const query = keyword.trim().toLowerCase();
  if (!query) return options;
  return options
    .filter((option) =>
      [option.value, option.text, option.label_en, option.label_zh, option.official_label, option.code, option.airport, option.airline]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(query),
    )
    .sort((left, right) => {
      const rank = (option: VisaFormOption) => {
        const exactDialingCode = option.value.replace(/^\+/, "").toLowerCase() === query;
        if (exactDialingCode) return 0;
        const exact = [option.code, option.value, option.airport, option.airline]
          .filter(Boolean)
          .some((candidate) => candidate?.toLowerCase() === query);
        if (exact) return 1;
        const starts = [option.text, option.label_en, option.label_zh, option.official_label]
          .filter(Boolean)
          .some((candidate) => candidate?.toLowerCase().startsWith(query));
        return starts ? 2 : 3;
      };
      return rank(left) - rank(right);
    });
}

async function loadAdministrativeOptions(level: "level1" | "level2", parent: string, limit: number): Promise<VisaFormOption[]> {
  const hotels = await loadOfficialItems("hotel");
  const options = level === "level1"
    ? deriveHotelProvinceOptions(hotels)
    : deriveHotelWardOptions(hotels, parent);
  return options.slice(0, limit);
}

void Promise.allSettled(
  ["visa_issue_place", "hotel", "airport", "port", "visa_type", "purpose"].map((source) => loadOfficialItems(source)),
);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawSource = url.searchParams.get("source")?.trim() ?? "";
  const source = rawSource.replace(/^prearrival_category:/, "");
  const keyword = url.searchParams.get("keyword")?.trim() ?? "";
  const parent = url.searchParams.get("parent")?.trim() ?? "";
  const limitParam = Number.parseInt(url.searchParams.get("limit") ?? "50", 10);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 10000) : 50;

  try {
    let options: VisaFormOption[];
    if (source === "administrative_unit_level1") {
      options = filterOptionsByKeyword(await loadAdministrativeOptions("level1", "", 10000), keyword).slice(0, limit);
    } else if (source === "administrative_unit_level2") {
      options = parent ? filterOptionsByKeyword(await loadAdministrativeOptions("level2", parent, 10000), keyword).slice(0, limit) : [];
    } else if (FIND_ALL_SOURCES.has(source)) {
      options = filterOptionsByKeyword(await loadFindAllOptions(source, parent), keyword).slice(0, limit);
    } else {
      return NextResponse.json({ error: "Unsupported Vietnam Pre-Arrival option source", totalCount: 0, options: [] }, { status: 400 });
    }
    return NextResponse.json({ totalCount: options.length, options });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Vietnam Pre-Arrival option lookup failed";
    return NextResponse.json({ error: message, totalCount: 0, options: [] }, { status: 502 });
  }
}

export const __testables = {
  filterOptionsByKeyword,
  optionFromOfficial,
};
