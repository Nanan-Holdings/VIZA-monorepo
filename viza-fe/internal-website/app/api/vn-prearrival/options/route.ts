import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const OFFICIAL_BASE = "https://prearrival.immigration.gov.vn/bio-management-service";
const SEARCH_SOURCES = new Set(["flight", "hotel"]);
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
]);

type OfficialOption = {
  code?: unknown;
  value?: unknown;
  vn_value?: unknown;
  en_value?: unknown;
  name?: unknown;
  airport?: unknown;
  airline?: unknown;
};

type VisaFormOption = {
  value: string;
  text: string;
  label_en: string;
  label_zh: string;
  official_label: string;
  airport?: string;
  airline?: string;
};

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

function optionFromOfficial(item: OfficialOption, source: string): VisaFormOption | null {
  const code = stringValue(item.code) || stringValue(item.value);
  const enValue = stringValue(item.en_value) || stringValue(item.name) || code;
  const vnValue = stringValue(item.vn_value) || enValue;
  if (!code && !enValue) return null;

  const airport = stringValue(item.airport);
  const airline = stringValue(item.airline);
  const officialLabel = source === "flight" && airport
    ? `${enValue} - ${airport}`
    : enValue;
  const value = source === "flight" && airport
    ? `${enValue}_${airport}`
    : code || enValue;

  return {
    value,
    text: officialLabel,
    label_en: officialLabel,
    label_zh: vnValue,
    official_label: officialLabel,
    ...(airport ? { airport } : {}),
    ...(airline ? { airline } : {}),
  };
}

async function fetchOfficialJson(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`${OFFICIAL_BASE}${path}`, {
    ...init,
    headers: {
      "Accept": "application/json, text/plain, */*",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Official Vietnam Pre-Arrival category request failed with ${response.status}`);
  }
  return response.json();
}

async function loadSearchOptions(source: string, keyword: string, limit: number): Promise<VisaFormOption[]> {
  const body = {
    keyword,
    filters: {},
    page: 0,
    size: limit,
    sorts: [{ key: "code", asc: true }],
  };
  const json = await fetchOfficialJson(`/category/searchCategory/${source}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return officialItems(json).map((item) => optionFromOfficial(item, source)).filter(Boolean) as VisaFormOption[];
}

async function loadFindAllOptions(source: string): Promise<VisaFormOption[]> {
  const json = await fetchOfficialJson(`/category/findAllActive/${source}`);
  return officialItems(json).map((item) => optionFromOfficial(item, source)).filter(Boolean) as VisaFormOption[];
}

async function loadAdministrativeOptions(level: "level1" | "level2", parent: string, limit: number): Promise<VisaFormOption[]> {
  const endpoint = level === "level1"
    ? "/category/categoryByCodeAndQueryCache/administrative_unit/findAllLevel1"
    : "/category/categoryByCodeAndQueryCache/administrative_unit/findAllLevel2WithCode";
  const json = await fetchOfficialJson(endpoint, {
    method: "POST",
    body: JSON.stringify(level === "level1" ? {} : { code: parent }),
  });
  return (officialItems(json).map((item) => optionFromOfficial(item, "administrative_unit")).filter(Boolean) as VisaFormOption[])
    .slice(0, limit);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawSource = url.searchParams.get("source")?.trim() ?? "";
  const source = rawSource.replace(/^prearrival_category:/, "");
  const keyword = url.searchParams.get("keyword")?.trim() ?? "";
  const parent = url.searchParams.get("parent")?.trim() ?? "";
  const limitParam = Number.parseInt(url.searchParams.get("limit") ?? "50", 10);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 50;

  try {
    let options: VisaFormOption[];
    if (SEARCH_SOURCES.has(source)) {
      options = await loadSearchOptions(source, keyword, limit);
    } else if (source === "administrative_unit_level1") {
      options = await loadAdministrativeOptions("level1", "", limit);
    } else if (source === "administrative_unit_level2") {
      options = parent ? await loadAdministrativeOptions("level2", parent, limit) : [];
    } else if (FIND_ALL_SOURCES.has(source)) {
      options = (await loadFindAllOptions(source)).slice(0, limit);
    } else {
      return NextResponse.json({ error: "Unsupported Vietnam Pre-Arrival option source", totalCount: 0, options: [] }, { status: 400 });
    }
    return NextResponse.json({ totalCount: options.length, options });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Vietnam Pre-Arrival option lookup failed";
    return NextResponse.json({ error: message, totalCount: 0, options: [] }, { status: 502 });
  }
}
