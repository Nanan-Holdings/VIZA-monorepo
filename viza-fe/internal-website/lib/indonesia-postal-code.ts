export interface IndonesiaPostalLocation {
  postalCode: string;
  province: string;
  city: string;
  district: string;
  village: string;
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
