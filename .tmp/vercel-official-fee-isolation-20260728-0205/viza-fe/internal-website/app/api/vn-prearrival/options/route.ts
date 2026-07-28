import { NextResponse } from "next/server";
import { countries } from "country-data-list";
import staticOptions from "@/lib/vn-prearrival/official-static-options.json";
import { getVnPrearrivalAdministrativeOptions } from "@/lib/vn-prearrival/administrative-options";
import {
  formatVnPrearrivalOfficialFlightLabel,
  getVnPrearrivalStaticOptions,
} from "@/lib/vn-prearrival/static-options";

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
  province_city?: string;
  ward?: string;
  searchText?: string;
};

type CachedOfficialOptions = {
  expiresAt: number;
  promise?: Promise<OfficialOption[]>;
  items?: OfficialOption[];
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FLIGHT_CACHE_TTL_MS = 5 * 60 * 1000;
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
  const provinceCity = stringValue(item.province_city);
  const ward = stringValue(item.ward);
  const officialLabel = source === "flight"
    ? formatVnPrearrivalOfficialFlightLabel(enValue, airport)
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
    ...(provinceCity ? { province_city: provinceCity } : {}),
    ...(ward ? { ward } : {}),
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
  if (source !== "flight" && staticItems?.length) return staticItems;

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
      if (staticItems?.length) {
        officialOptionsCache.set(source, {
          items: staticItems,
          expiresAt: Date.now() + ttl,
        });
        return staticItems;
      }
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

async function loadFindAllOptions(source: string, parent = ""): Promise<VisaFormOption[]> {
  if (source === "country_code") return localCountryCodeOptions();
  const rawItems = await loadOfficialItems(source);
  const visaTypeFilteredItems = source === "visa_issue_place"
    ? rawItems.filter((item) => issuePlaceMatchesVisaType(item, parent))
    : rawItems;
  const items = source === "hotel" && parent
    ? visaTypeFilteredItems.filter((item) => stringValue(item.ward) === parent)
    : visaTypeFilteredItems;
  return items.map((item) => optionFromOfficial(item, source)).filter(Boolean) as VisaFormOption[];
}

function normalizeOfficialFlightSearch(keyword: string): string {
  const compact = keyword.replace(/\s+/g, "");
  const match = /^([A-Za-z]{2})(\d+)$/.exec(compact);
  if (!match) return compact;
  const [, airline, digits] = match;
  return digits.length === 3 ? `${airline}${digits.padStart(4, "0")}` : `${airline}${digits}`;
}

async function loadOfficialFlightOptions(keyword: string): Promise<VisaFormOption[]> {
  const query = normalizeOfficialFlightSearch(keyword).toLowerCase();
  const rawItems = await loadOfficialItems("flight");
  const matchedItems = query
    ? rawItems.filter((item) =>
        [
          stringValue(item.code),
          stringValue(item.en_value),
          stringValue(item.english_value),
          stringValue(item.vn_value),
          stringValue(item.airport),
          stringValue(item.airline),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query),
      )
    : rawItems;
  return matchedItems
    .sort((left, right) => stringValue(left.code).localeCompare(stringValue(right.code), "en"))
    .map((item) => optionFromOfficial(item, "flight"))
    .filter(Boolean) as VisaFormOption[];
}

function paginateOptions<T>(
  options: T[],
  page: number,
  size: number,
): { items: T[]; totalCount: number; hasMore: boolean } {
  const safePage = Math.max(0, page);
  const safeSize = Math.max(1, size);
  const start = safePage * safeSize;
  const items = options.slice(start, start + safeSize);
  return {
    items,
    totalCount: options.length,
    hasMore: start + items.length < options.length,
  };
}

function filterOptionsByKeyword(options: VisaFormOption[], keyword: string): VisaFormOption[] {
  const normalizeSearchText = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/Đ/g, "D")
      .replace(/đ/g, "d")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  const query = normalizeSearchText(keyword);
  if (!query) return options;
  return options
    .filter((option) =>
      normalizeSearchText(
        [option.value, option.text, option.label_en, option.label_zh, option.official_label, option.code, option.airport, option.airline, option.searchText]
          .filter(Boolean)
          .join(" "),
      ).includes(query),
    )
    .sort((left, right) => {
      const rank = (option: VisaFormOption) => {
        const exactDialingCode = normalizeSearchText(option.value.replace(/^\+/, "")) === query;
        if (exactDialingCode) return 0;
        const exact = [option.code, option.value, option.airport, option.airline]
          .filter(Boolean)
          .some((candidate) => normalizeSearchText(candidate ?? "") === query);
        if (exact) return 1;
        const starts = [option.text, option.label_en, option.label_zh, option.official_label]
          .filter(Boolean)
          .some((candidate) => normalizeSearchText(candidate ?? "").startsWith(query));
        return starts ? 2 : 3;
      };
      return rank(left) - rank(right);
    });
}

function filterHotelOptionsByHierarchy(
  options: VisaFormOption[],
  parentWard: string,
  provinceCity: string,
  keyword: string,
): VisaFormOption[] {
  if (keyword.trim()) return filterOptionsByKeyword(options, keyword);

  const exactWardOptions = parentWard
    ? options.filter((option) => option.ward === parentWard)
    : [];
  if (exactWardOptions.length > 0) return exactWardOptions;

  return provinceCity
    ? options.filter((option) => option.province_city === provinceCity)
    : [];
}

void Promise.allSettled(
  ["visa_issue_place", "hotel", "airport", "port", "visa_type", "purpose", "flight"].map((source) => loadOfficialItems(source)),
);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawSource = url.searchParams.get("source")?.trim() ?? "";
  const source = rawSource.replace(/^prearrival_category:/, "");
  const keyword = url.searchParams.get("keyword")?.trim() ?? "";
  const parent = url.searchParams.get("parent")?.trim() ?? "";
  const province = url.searchParams.get("province")?.trim() ?? "";
  const limitParam = Number.parseInt(url.searchParams.get("limit") ?? "50", 10);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 10000) : 50;
  const pageParam = Number.parseInt(url.searchParams.get("page") ?? "0", 10);
  const page = Number.isFinite(pageParam) ? Math.max(pageParam, 0) : 0;
  const sizeParam = Number.parseInt(url.searchParams.get("size") ?? "10", 10);
  const size = Number.isFinite(sizeParam) ? Math.min(Math.max(sizeParam, 1), 100) : 10;

  try {
    let options: VisaFormOption[];
    if (source === "flight") {
      const result = paginateOptions(await loadOfficialFlightOptions(keyword), page, size);
      return NextResponse.json({
        totalCount: result.totalCount,
        page,
        size,
        hasMore: result.hasMore,
        options: result.items,
      });
    } else if (source === "hotel") {
      const allHotels = getVnPrearrivalStaticOptions("hotel") as VisaFormOption[] | null;
      options = filterHotelOptionsByHierarchy(allHotels ?? [], parent, province, keyword).slice(0, limit);
    } else {
      const localOfficialOptions = getVnPrearrivalStaticOptions(source, parent);
      if (localOfficialOptions !== null) {
        options = filterOptionsByKeyword(localOfficialOptions as VisaFormOption[], keyword).slice(0, limit);
      } else if (source === "administrative_unit_level1") {
        options = filterOptionsByKeyword(getVnPrearrivalAdministrativeOptions("level1"), keyword).slice(0, limit);
      } else if (source === "administrative_unit_level2") {
        options = parent
          ? filterOptionsByKeyword(getVnPrearrivalAdministrativeOptions("level2", parent), keyword).slice(0, limit)
          : [];
      } else if (FIND_ALL_SOURCES.has(source)) {
        options = filterOptionsByKeyword(await loadFindAllOptions(source, parent), keyword).slice(0, limit);
      } else {
        return NextResponse.json({ error: "Unsupported Vietnam Pre-Arrival option source", totalCount: 0, options: [] }, { status: 400 });
      }
    }
    return NextResponse.json({ totalCount: options.length, options });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Vietnam Pre-Arrival option lookup failed";
    return NextResponse.json({ error: message, totalCount: 0, options: [] }, { status: 502 });
  }
}

export const __testables = {
  filterHotelOptionsByHierarchy,
  filterOptionsByKeyword,
  normalizeOfficialFlightSearch,
  optionFromOfficial,
  paginateOptions,
};
