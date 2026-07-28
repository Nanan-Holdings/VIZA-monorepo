export interface IndonesiaPostalLocation {
  postalCode: string;
  province: string;
  city: string;
  district: string;
  village: string;
}

export interface IndonesiaAccommodationAddressCheck {
  status: "valid" | "invalid" | "indeterminate";
  messageZh?: string;
  messageEn?: string;
}

const FOREIGN_COUNTRY_MARKERS = [
  "china", "中国", "singapore", "新加坡", "malaysia", "马来西亚", "thailand", "泰国",
  "vietnam", "越南", "japan", "日本", "korea", "韩国", "india", "印度", "australia", "澳大利亚",
  "united states", "usa", "美国", "united kingdom", "英国",
];

function normalizedAddress(value: string) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

export function assessIndonesiaAccommodationAddress(
  address: string,
  location: IndonesiaPostalLocation,
): IndonesiaAccommodationAddressCheck {
  const normalized = normalizedAddress(address);
  if (!normalized) return { status: "indeterminate" };

  if (FOREIGN_COUNTRY_MARKERS.some((marker) => normalized.includes(marker))) {
    return {
      status: "invalid",
      messageZh: "该住宿地址看起来不在印度尼西亚。请填写印尼境内的酒店或住宿地址。",
      messageEn: "This accommodation address appears to be outside Indonesia. Enter the Indonesian hotel or accommodation address.",
    };
  }

  const locationNames = [location.village, location.district, location.city, location.province]
    .map(normalizedAddress)
    .filter((name) => name.length >= 3);
  if (locationNames.some((name) => normalized.includes(name))) return { status: "valid" };

  return { status: "indeterminate" };
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(record: UnknownRecord, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function normalizeIndonesiaPostalCode(value: string | null | undefined): string | null {
  const digits = value?.replace(/\D/g, "") ?? "";
  return /^\d{5}$/.test(digits) ? digits : null;
}

export function parseIndonesiaPostalDirectoryResponse(
  payload: unknown,
  postalCode: string,
): IndonesiaPostalLocation | null {
  if (!isRecord(payload) || !isRecord(payload.data) || !Array.isArray(payload.data.postalCodes)) {
    return null;
  }

  for (const candidate of payload.data.postalCodes) {
    if (!isRecord(candidate) || readText(candidate, "code") !== postalCode) continue;

    const village = isRecord(candidate.village) ? readText(candidate.village, "name") : null;
    const district = isRecord(candidate.district) ? readText(candidate.district, "name") : null;
    const city = isRecord(candidate.city) ? readText(candidate.city, "name") : null;
    const province = isRecord(candidate.province) ? readText(candidate.province, "name") : null;
    if (village && district && city && province) {
      return { postalCode, province, city, district, village };
    }
  }

  return null;
}
