import type { VisaFormFieldOption } from "@/types/visa-form-fields";
import staticOptions from "./official-static-options.json";

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

const sources = staticOptions.sources as Record<string, OfficialOption[] | undefined>;

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function optionFromOfficial(item: OfficialOption, source: string): VisaFormFieldOption | null {
  const code = stringValue(item.code);
  const rawValue = stringValue(item.value);
  const enValue =
    stringValue(item.en_value) ||
    stringValue(item.english_value) ||
    stringValue(item.name) ||
    code ||
    rawValue;
  const zhValue = stringValue(item.cn_value) || stringValue(item.vn_value) || stringValue(item.vietnam_value) || enValue;
  if (!code && !enValue) return null;

  const airport = stringValue(item.airport);
  const airline = stringValue(item.airline);
  const officialLabel = source === "flight" && airport ? `${enValue} - ${airport}` : enValue;
  const value = source === "flight"
    ? code || (airport ? `${enValue}_${airport}` : enValue)
    : code || rawValue || enValue;

  return {
    value,
    text: officialLabel,
    label_en: officialLabel,
    label_zh: source === "flight" ? officialLabel : zhValue,
    official_label: officialLabel,
    ...(airport ? { airport } : {}),
    ...(airline ? { airline } : {}),
  };
}

function issuePlaceMatchesVisaType(item: OfficialOption, visaType: string): boolean {
  if (!visaType) return true;
  const visaTypes = stringValue(item.visa_type)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return visaTypes.length === 0 || visaTypes.includes(visaType);
}

function deriveHotelProvinceOptions(items: OfficialOption[]): VisaFormFieldOption[] {
  const byCode = new Map<string, string>();
  for (const item of items) {
    const code = stringValue(item.province_city);
    if (!code || byCode.has(code)) continue;
    const label = stringValue(item.en_value).split(",").map((part) => part.trim()).filter(Boolean).at(-1) ?? code;
    byCode.set(code, label);
  }
  return Array.from(byCode.entries()).map(([code, label]) => ({
    value: code,
    text: label,
    label_en: label,
    label_zh: label,
    official_label: label,
  }));
}

function deriveHotelWardOptions(items: OfficialOption[], provinceCode: string): VisaFormFieldOption[] {
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
    text: label,
    label_en: label,
    label_zh: label,
    official_label: label,
  }));
}

export function getVnPrearrivalStaticOptions(source: string, parent = ""): VisaFormFieldOption[] | null {
  const normalizedSource = source.replace(/^prearrival_category:/, "");
  const hotelItems = sources.hotel ?? [];
  if (normalizedSource === "administrative_unit_level1") return deriveHotelProvinceOptions(hotelItems);
  if (normalizedSource === "administrative_unit_level2") return parent ? deriveHotelWardOptions(hotelItems, parent) : [];

  const rawItems = sources[normalizedSource];
  if (!rawItems) return null;
  const items = normalizedSource === "visa_issue_place"
    ? rawItems.filter((item) => issuePlaceMatchesVisaType(item, parent))
    : normalizedSource === "hotel" && parent
      ? rawItems.filter((item) => stringValue(item.ward) === parent || stringValue(item.province_city) === parent)
      : rawItems;
  return items.map((item) => optionFromOfficial(item, normalizedSource)).filter(Boolean) as VisaFormFieldOption[];
}
