import { NextResponse } from "next/server";
import { countries } from "country-data-list";
import { getClientSession } from "@/lib/client-session";
import {
  ensureFlyMachineStarted,
  waitForHttpReady,
} from "@/lib/fly-machine-wake.server";
import { createClient } from "@/lib/supabase/server";
import staticOptions from "@/lib/vn-prearrival/official-static-options.json";
import { getVnPrearrivalAdministrativeOptions } from "@/lib/vn-prearrival/administrative-options";
import {
  formatVnPrearrivalOfficialFlightLabel,
  formatVnPrearrivalPortalFlightLabel,
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
  official_value?: string;
  portal_label?: string;
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
const officialOptionsCache = new Map<string, CachedOfficialOptions>();
const OFFICIAL_DEVICE_ID = crypto.randomUUID();

const STATIC_OPTION_SOURCES = staticOptions.sources as Record<string, OfficialOption[] | undefined>;
const COUNTRY_ALPHA2_BY_ALPHA3 = new Map(
  countries.all.flatMap((country) => {
    const alpha2 = stringValue(country.alpha2);
    const alpha3 = stringValue(country.alpha3);
    return alpha2 && alpha3 ? [[alpha3.toUpperCase(), alpha2.toUpperCase()] as const] : [];
  }),
);

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

function zhRegionNameFromOfficialCode(code: string): string {
  const normalizedCode = code.trim().toUpperCase();
  const alpha2 = normalizedCode.length === 2
    ? normalizedCode
    : COUNTRY_ALPHA2_BY_ALPHA3.get(normalizedCode) ?? "";
  return alpha2 ? zhRegionName(alpha2) : "";
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
  const officialValue = source === "flight"
    ? stringValue(item.vn_value) || stringValue(item.vietnam_value) || enValue
    : "";
  const officialLabel = source === "flight"
    ? formatVnPrearrivalOfficialFlightLabel(officialValue, airport)
    : enValue;
  const portalLabel = source === "flight"
    ? formatVnPrearrivalPortalFlightLabel(officialValue, airport)
    : officialLabel;
  const value = source === "country_code" && rawValue
    ? rawValue
    : source === "flight"
      ? code || (airport ? `${enValue}_${airport}` : enValue)
      : code || rawValue || enValue;
  const labelZh = source === "flight"
    ? officialLabel
    : source === "country_code"
      ? `${zhRegionNameFromOfficialCode(code) || vnValue.replace(/\s*\(\+\d+\)\s*$/, "") || enValue} (${rawValue || value})`
      : source === "nationality"
        ? zhRegionNameFromOfficialCode(code) || vnValue
        : vnValue;

  return {
    value,
    text: officialLabel,
    label_en: officialLabel,
    label_zh: labelZh,
    official_label: officialLabel,
    ...(officialValue ? { official_value: officialValue } : {}),
    ...(portalLabel ? { portal_label: portalLabel } : {}),
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
      "Accept-Language": "en",
      "device-id": OFFICIAL_DEVICE_ID,
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

  const ttl = CACHE_TTL_MS;
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

type FlightSearchPage = {
  items: VisaFormOption[];
  totalCount: number;
  hasMore: boolean;
  catalogSource: "official_live" | "bundled_snapshot";
  fetchedAt?: string;
  selectedExists: boolean | null;
  selectedOption: VisaFormOption | null;
};

function officialFlightSearchBody(keyword: string, page: number, size: number) {
  return {
    keyword: normalizeOfficialFlightSearch(keyword),
    filters: {},
    page,
    size,
    sorts: [{ key: "code", asc: true }],
  };
}

function officialPageRecord(value: unknown): Record<string, unknown> | null {
  const record = asRecord(value);
  const data = record ? record.data : null;
  return asRecord(data) ?? record;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function pageFromOfficialSearch(value: unknown, page: number, size: number): FlightSearchPage {
  const record = officialPageRecord(value);
  const items = officialItems(value)
    .map((item) => optionFromOfficial(item, "flight"))
    .filter(Boolean) as VisaFormOption[];
  const totalCount = numberValue(record?.totalElements)
    ?? numberValue(record?.totalCount)
    ?? numberValue(record?.total)
    ?? (page * size + items.length);
  const last = typeof record?.last === "boolean" ? record.last : null;
  return {
    items,
    totalCount,
    hasMore: last === null ? (page * size + items.length < totalCount) : !last,
    catalogSource: "official_live",
    selectedExists: null,
    selectedOption: null,
  };
}

function officialFlightMatchesKeyword(item: OfficialOption, keyword: string): boolean {
  if (!keyword) return true;
  const haystack = [
    item.code,
    item.vn_value,
    item.vietnam_value,
    item.en_value,
    item.english_value,
    item.airport,
    item.airline,
  ]
    .map(stringValue)
    .join(" ")
    .replace(/\s+/g, "")
    .toLowerCase();
  return haystack.includes(keyword.toLowerCase());
}

function fallbackFlightSearch(
  keyword: string,
  page: number,
  size: number,
  selectedValue = "",
): FlightSearchPage {
  const query = normalizeOfficialFlightSearch(keyword);
  const rawItems = [...(STATIC_OPTION_SOURCES.flight ?? [])]
    .filter((item) => officialFlightMatchesKeyword(item, query));
  const mappedItems = rawItems
    .map((item) => optionFromOfficial(item, "flight"))
    .filter(Boolean) as VisaFormOption[];
  const result = paginateOptions(mappedItems, page, size);
  const selectedOption = selectedValue && selectedValue.toLowerCase() !== "other"
    ? (STATIC_OPTION_SOURCES.flight ?? [])
        .map((item) => optionFromOfficial(item, "flight"))
        .find((option) => option?.value === selectedValue) ?? null
    : null;
  return {
    ...result,
    catalogSource: "bundled_snapshot",
    selectedExists: selectedValue
      ? selectedValue.toLowerCase() === "other" || selectedOption !== null
      : null,
    selectedOption,
  };
}

type RunnerFlightCatalogResponse = {
  catalogSource?: unknown;
  fetchedAt?: unknown;
  items?: unknown;
  totalCount?: unknown;
  page?: unknown;
  size?: unknown;
  hasMore?: unknown;
  selectedExists?: unknown;
  selectedItem?: unknown;
};

function flightCatalogServiceConfig(): {
  baseUrl: string;
  url: string;
  headers: Record<string, string>;
  wakePool: boolean;
} | null {
  const localUrl = process.env.SUBMISSION_SERVICE_LOCAL_URL?.trim();
  if (localUrl) {
    const baseUrl = localUrl.replace(/\/+$/u, "");
    return {
      baseUrl,
      url: `${baseUrl}/local/vn-prearrival/flight-catalog`,
      headers: { "Content-Type": "application/json" },
      wakePool: false,
    };
  }
  const token = (
    process.env.SUBMISSION_QUEUE_INTERNAL_TOKEN ??
    process.env.VIETNAM_CARD_SESSION_INTERNAL_TOKEN
  )?.trim();
  if (!token) return null;
  const configuredUrl = process.env.RUNNER_POOL_SUBMISSION_SERVICE_URL?.trim();
  const defaultProductionUrl = process.env.NODE_ENV === "production"
    ? `https://${process.env.FLY_RUNNER_POOL_APP?.trim() || "viza-runner-pool"}.fly.dev`
    : "";
  const baseUrl = configuredUrl || defaultProductionUrl;
  if (!baseUrl) return null;
  const normalizedBaseUrl = baseUrl.replace(/\/+$/u, "");
  return {
    baseUrl: normalizedBaseUrl,
    url: `${normalizedBaseUrl}/internal/vn-prearrival/flight-catalog`,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    wakePool: true,
  };
}

async function ensureFlightCatalogServiceReady(
  config: NonNullable<ReturnType<typeof flightCatalogServiceConfig>>,
  refresh: boolean,
  dependencies: {
    startPool?: typeof ensureFlyMachineStarted;
    waitForReady?: typeof waitForHttpReady;
  } = {},
): Promise<boolean> {
  if (!refresh || !config.wakePool) return true;
  const startPool = dependencies.startPool ?? ensureFlyMachineStarted;
  const waitForReady = dependencies.waitForReady ?? waitForHttpReady;
  const wake = await startPool("pool");
  if (!wake.ok) {
    console.warn(`[vn-prearrival] flight_catalog_pool_wake_failed reason=${wake.reason}`);
    return false;
  }
  if (wake.state === "already_running") return true;
  const readiness = await waitForReady(`${config.baseUrl}/health`, {
    timeoutMs: 15_000,
    requestTimeoutMs: 4_000,
  });
  if (!readiness.ok) {
    console.warn(
      `[vn-prearrival] flight_catalog_pool_readiness_failed attempts=${readiness.attempts}`,
    );
  }
  return readiness.ok;
}

async function loadRunnerFlightCatalogPage(input: {
  keyword: string;
  page: number;
  size: number;
  refresh: boolean;
  selectedValue: string;
}): Promise<FlightSearchPage | null> {
  const config = flightCatalogServiceConfig();
  if (!config) return null;
  try {
    if (!(await ensureFlightCatalogServiceReady(config, input.refresh))) return null;
    const response = await fetch(config.url, {
      method: "POST",
      headers: config.headers,
      body: JSON.stringify(input),
      cache: "no-store",
      signal: AbortSignal.timeout(280_000),
    });
    if (!response.ok) {
      console.warn(`[vn-prearrival] flight_catalog_runner_failed status=${response.status}`);
      return null;
    }
    const payload = await response.json() as RunnerFlightCatalogResponse;
    if (payload.catalogSource !== "official_live" || !Array.isArray(payload.items)) return null;
    const items = (payload.items as OfficialOption[])
      .map((item) => optionFromOfficial(item, "flight"))
      .filter(Boolean) as VisaFormOption[];
    const selectedItem = asRecord(payload.selectedItem) as OfficialOption | null;
    return {
      items,
      totalCount: numberValue(payload.totalCount) ?? items.length,
      hasMore: payload.hasMore === true,
      catalogSource: "official_live",
      ...(typeof payload.fetchedAt === "string" ? { fetchedAt: payload.fetchedAt } : {}),
      selectedExists: typeof payload.selectedExists === "boolean" ? payload.selectedExists : null,
      selectedOption: selectedItem ? optionFromOfficial(selectedItem, "flight") : null,
    };
  } catch {
    return null;
  }
}

async function loadOfficialFlightOptions(
  keyword: string,
  page: number,
  size: number,
  input: { refresh: boolean; selectedValue: string },
): Promise<FlightSearchPage> {
  const runnerPage = await loadRunnerFlightCatalogPage({
    keyword,
    page,
    size,
    refresh: input.refresh,
    selectedValue: input.selectedValue,
  });
  if (runnerPage) return runnerPage;
  const body = officialFlightSearchBody(keyword, page, size);
  try {
    const json = await fetchOfficialJson("/category/searchCategory/flight", {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return pageFromOfficialSearch(json, page, size);
  } catch {
    // The official search requires a CAPTCHA-backed portal session. Keep the
    // UI usable with the bundled official snapshot while preserving the
    // portal's exact normalization, code order, and pagination contract.
    return fallbackFlightSearch(keyword, page, size, input.selectedValue);
  }
}

async function hasAuthenticatedApplicant(): Promise<boolean> {
  try {
    if (await getClientSession()) return true;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return Boolean(user);
  } catch {
    return false;
  }
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
  ["visa_issue_place", "hotel", "airport", "port", "visa_type", "purpose"].map((source) => loadOfficialItems(source)),
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
  const refresh = url.searchParams.get("refresh") === "1";
  const selectedValue = url.searchParams.get("selected")?.trim() ?? "";

  if (source === "flight" && refresh && !(await hasAuthenticatedApplicant())) {
    return NextResponse.json({ error: "Not authenticated", totalCount: 0, options: [] }, { status: 401 });
  }

  try {
    let options: VisaFormOption[];
    if (source === "flight") {
      const result = await loadOfficialFlightOptions(keyword, page, size, { refresh, selectedValue });
      return NextResponse.json({
        totalCount: result.totalCount,
        page,
        size,
        hasMore: result.hasMore,
        catalogSource: result.catalogSource,
        ...(result.fetchedAt ? { fetchedAt: result.fetchedAt } : {}),
        selectedExists: result.selectedExists,
        selectedOption: result.selectedOption,
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
  fallbackFlightSearch,
  normalizeOfficialFlightSearch,
  officialFlightSearchBody,
  optionFromOfficial,
  pageFromOfficialSearch,
  paginateOptions,
  flightCatalogServiceConfig,
  ensureFlightCatalogServiceReady,
  zhRegionNameFromOfficialCode,
};
