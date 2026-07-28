import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type AuditRecord = {
  url?: unknown;
  body?: {
    data?: unknown;
  };
};

type OfficialSelectItem = {
  code?: unknown;
  value?: unknown;
};

type OfficialCountry = {
  code: string;
  label: string;
  phoneCode?: string;
};

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const TARGET = join(SCRIPT_DIR, "tdac-official-dropdowns.generated.ts");

function auditLabel(url: unknown): string | null {
  if (typeof url !== "string") return null;
  const marker = "#audit=";
  const markerIndex = url.indexOf(marker);
  return markerIndex >= 0
    ? decodeURIComponent(url.slice(markerIndex + marker.length))
    : null;
}

function selectItems(record: AuditRecord | undefined): OfficialSelectItem[] {
  const data = record?.body?.data;
  return Array.isArray(data)
    ? data.filter((item): item is OfficialSelectItem =>
        Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function splitCountryLabel(value: string): { code: string; label: string } {
  const match = value.match(/^([^:]+)\s*:\s*(.+)$/);
  if (!match) {
    throw new Error(`Invalid official TDAC country option: ${value}`);
  }
  return {
    code: match[1]?.trim().toUpperCase() ?? "",
    label: match[2]?.trim() ?? "",
  };
}

function countries(items: OfficialSelectItem[], includePhoneCode: boolean): OfficialCountry[] {
  return items.map((item) => {
    const { code, label } = splitCountryLabel(text(item.value));
    const phoneCode = text(item.code);
    return {
      code,
      label,
      ...(includePhoneCode && phoneCode ? { phoneCode } : {}),
    };
  });
}

function labels(items: OfficialSelectItem[]): string[] {
  return items.map((item) => text(item.value)).filter(Boolean);
}

function uniqueByCode(values: OfficialCountry[], label: string): void {
  const codes = values.map((item) => item.code);
  if (new Set(codes).size !== codes.length) {
    throw new Error(`Duplicate TDAC ${label} code detected`);
  }
}

function expectCount(actual: number, expected: number, label: string): void {
  if (actual !== expected) {
    throw new Error(`TDAC ${label} count drifted: expected ${expected}, received ${actual}`);
  }
}

function main(): void {
  const auditPath = process.argv[2]?.trim();
  if (!auditPath) {
    throw new Error(
      "Usage: tsx scripts/th-tdac/generate-residence-region-map.ts <official-api.jsonl>",
    );
  }

  const recordsByLabel = new Map<string, AuditRecord>();
  for (const line of readFileSync(resolve(auditPath), "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const record = JSON.parse(line) as AuditRecord;
    const label = auditLabel(record.url);
    if (label) recordsByLabel.set(label, record);
  }

  const nationalityOptions = countries(
    selectItems(recordsByLabel.get("nationalities-all")),
    false,
  );
  const boardedCountryOptions = countries(
    selectItems(recordsByLabel.get("countries-all")),
    false,
  );
  const residenceCountryOptions = countries(
    selectItems(recordsByLabel.get("countries-with-phone-all")),
    true,
  );
  const visitedCountryOptions = countries(
    selectItems(recordsByLabel.get("ddc-countries-all")),
    true,
  );
  const provinceOptions = labels(selectItems(recordsByLabel.get("provinces-all")));
  const transportOptionsByMode = {
    AIR: labels(selectItems(recordsByLabel.get("transport-air"))),
    LAND: labels(selectItems(recordsByLabel.get("transport-land"))),
    SEA: labels(selectItems(recordsByLabel.get("transport-sea"))),
  };

  expectCount(nationalityOptions.length, 259, "nationality options");
  expectCount(boardedCountryOptions.length, 259, "boarded-country options");
  expectCount(residenceCountryOptions.length, 260, "residence-country options");
  expectCount(visitedCountryOptions.length, 260, "health-country options");
  expectCount(provinceOptions.length, 77, "province options");
  uniqueByCode(nationalityOptions, "nationality");
  uniqueByCode(boardedCountryOptions, "boarded-country");
  uniqueByCode(residenceCountryOptions, "residence-country");
  uniqueByCode(visitedCountryOptions, "health-country");

  if (boardedCountryOptions.some((item) => item.code === "ATA" || item.code === "THA")) {
    throw new Error("TDAC boarded-country options must exclude ATA and THA");
  }
  if (
    !residenceCountryOptions.some((item) => item.code === "THA") ||
    !visitedCountryOptions.some((item) => item.code === "THA")
  ) {
    throw new Error("TDAC residence and health country options must include THA");
  }

  const residenceRegionsByCountry: Record<string, string[]> = {};
  for (const country of residenceCountryOptions) {
    const record = recordsByLabel.get(`residence-${country.code}`);
    if (!record) {
      throw new Error(`Missing TDAC residence-region audit for ${country.code}`);
    }
    residenceRegionsByCountry[country.code] = labels(selectItems(record));
  }

  const districtsByProvince: Record<string, Array<{ label: string; postcode?: string }>> = {};
  const subdistrictsByProvinceDistrict: Record<string, string[]> = {};
  let districtCount = 0;
  for (const province of provinceOptions) {
    const districtRecord = recordsByLabel.get(`districts-${province}`);
    if (!districtRecord) {
      throw new Error(`Missing TDAC district audit for ${province}`);
    }
    const districtItems = selectItems(districtRecord);
    const districtLabelCounts = new Map<string, number>();
    for (const district of districtItems) {
      const label = text(district.value).toUpperCase();
      districtLabelCounts.set(label, (districtLabelCounts.get(label) ?? 0) + 1);
    }
    districtsByProvince[province] = districtItems.map((district) => {
      const label = text(district.value);
      const postcode = text(district.code);
      return {
        label,
        ...(postcode ? { postcode } : {}),
      };
    });
    districtCount += districtItems.length;

    for (const district of districtItems) {
      const districtLabel = text(district.value);
      const postcode = text(district.code);
      const duplicateLabel = (districtLabelCounts.get(districtLabel.toUpperCase()) ?? 0) > 1;
      const discriminator = duplicateLabel ? `::${postcode || "NO-POSTCODE"}` : "";
      const key = `${province}::${districtLabel}${discriminator}`;
      const subdistrictRecord = recordsByLabel.get(
        `subdistricts-${province.toUpperCase()}-${districtLabel.toUpperCase()}${
          duplicateLabel ? `-${postcode || "NO-POSTCODE"}` : ""
        }`,
      );
      if (!subdistrictRecord) {
        throw new Error(`Missing TDAC subdistrict audit for ${key}`);
      }
      subdistrictsByProvinceDistrict[key] = labels(selectItems(subdistrictRecord));
    }
  }

  expectCount(
    Object.keys(subdistrictsByProvinceDistrict).length,
    districtCount,
    "district/subdistrict contracts",
  );

  const fileBody = `// Generated from a read-only official TDAC portal audit.
// Do not edit by hand. Regenerate with scripts/th-tdac/generate-residence-region-map.ts.

export interface TdacOfficialCountryEntry {
  code: string;
  label: string;
  phoneCode?: string;
}

export const TDAC_OFFICIAL_NATIONALITY_ENTRIES: TdacOfficialCountryEntry[] = ${JSON.stringify(nationalityOptions, null, 2)};

export const TDAC_OFFICIAL_BOARDED_COUNTRY_ENTRIES: TdacOfficialCountryEntry[] = ${JSON.stringify(boardedCountryOptions, null, 2)};

export const TDAC_OFFICIAL_RESIDENCE_COUNTRY_ENTRIES: TdacOfficialCountryEntry[] = ${JSON.stringify(residenceCountryOptions, null, 2)};

export const TDAC_OFFICIAL_VISITED_COUNTRY_ENTRIES: TdacOfficialCountryEntry[] = ${JSON.stringify(visitedCountryOptions, null, 2)};

export const TDAC_OFFICIAL_PROVINCE_LABELS: string[] = ${JSON.stringify(provinceOptions, null, 2)};

export const TDAC_OFFICIAL_TRANSPORT_LABELS_BY_MODE: Record<"AIR" | "LAND" | "SEA", string[]> = ${JSON.stringify(transportOptionsByMode, null, 2)};

export const TDAC_OFFICIAL_RESIDENCE_REGIONS_BY_COUNTRY: Record<string, string[]> = ${JSON.stringify(residenceRegionsByCountry, null, 2)};

export const TDAC_OFFICIAL_DISTRICTS_BY_PROVINCE: Record<string, Array<{ label: string; postcode?: string }>> = ${JSON.stringify(districtsByProvince, null, 2)};

export const TDAC_OFFICIAL_SUBDISTRICTS_BY_PROVINCE_DISTRICT: Record<string, string[]> = ${JSON.stringify(subdistrictsByProvinceDistrict, null, 2)};
`;

  writeFileSync(TARGET, fileBody, "utf8");
  console.log(
    `Generated TDAC official dropdown snapshot: ${nationalityOptions.length} nationalities, ` +
      `${residenceCountryOptions.length} residence countries, ${provinceOptions.length} provinces, ` +
      `${districtCount} districts -> ${TARGET}`,
  );
}

main();
