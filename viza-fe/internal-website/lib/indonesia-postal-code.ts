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

function addressMatchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/\b(?:kabupaten|kab\.?|kecamatan|kec\.?|kota|adm\.?)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scorePostalLocationForAddress(address: string, location: IndonesiaPostalLocation): number {
  const normalized = addressMatchText(address);
  if (!normalized) return 0;
  const includes = (value: string) => {
    const candidate = addressMatchText(value);
    return candidate.length >= 3 && ` ${normalized} `.includes(` ${candidate} `);
  };
  const normalizedVillage = addressMatchText(location.village);
  const villageDuplicatesParent = [location.district, location.city, location.province]
    .some((value) => addressMatchText(value) === normalizedVillage);
  return (
    (!villageDuplicatesParent && includes(location.village) ? 16 : 0)
    + (includes(location.district) ? 8 : 0)
    + (includes(location.city) ? 4 : 0)
    + (includes(location.province) ? 2 : 0)
  );
}

export function selectBestIndonesiaPostalLocation(
  locations: IndonesiaPostalLocation[],
  address = "",
): IndonesiaPostalLocation | null {
  if (locations.length <= 1 || !address.trim()) return locations[0] ?? null;
  return locations
    .map((location, index) => ({ location, index, score: scorePostalLocationForAddress(address, location) }))
    .sort((left, right) => right.score - left.score || left.index - right.index)[0]?.location ?? null;
}

export function normalizeIndonesiaPostalCode(value: string | null | undefined): string | null {
  const digits = value?.replace(/\D/g, "") ?? "";
  return /^\d{5}$/.test(digits) ? digits : null;
}

export function parseIndonesiaPostalDirectoryResponse(
  payload: unknown,
  postalCode: string,
  address = "",
): IndonesiaPostalLocation | null {
  if (!isRecord(payload) || !isRecord(payload.data) || !Array.isArray(payload.data.postalCodes)) {
    return null;
  }

  const matches: IndonesiaPostalLocation[] = [];
  for (const candidate of payload.data.postalCodes) {
    if (!isRecord(candidate) || readText(candidate, "code") !== postalCode) continue;

    const village = isRecord(candidate.village) ? readText(candidate.village, "name") : null;
    const district = isRecord(candidate.district) ? readText(candidate.district, "name") : null;
    const city = isRecord(candidate.city) ? readText(candidate.city, "name") : null;
    const province = isRecord(candidate.province) ? readText(candidate.province, "name") : null;
    if (village && district && city && province) {
      matches.push({ postalCode, province, city, district, village });
    }
  }

  return selectBestIndonesiaPostalLocation(matches, address);
}
