export type PhEtravelResidenceLevel = "province" | "municipality" | "barangay";

export interface PhEtravelCanonicalOption {
  code: string;
  label: string | null;
}

export interface PhEtravelResidenceAddress {
  country: PhEtravelCanonicalOption;
  regionCode: string | null;
  province: PhEtravelCanonicalOption | null;
  municipality: PhEtravelCanonicalOption | null;
  barangay: PhEtravelCanonicalOption | null;
  line1: string;
  line2: string | null;
  isPhilippines: boolean;
}

export interface PhEtravelResidenceAction {
  kind: "select" | "fill";
  fieldName: "country_code" | "province_code" | "municipality_code" | "barangay_code" | "street" | "street_two";
  code?: string;
  label?: string | null;
  value?: string;
  dependsOn?: string;
}

export class PhEtravelResidenceValidationError extends Error {
  readonly code = "ph_etravel_residence_action_required" as const;

  constructor(message: string, readonly missingFields: string[]) {
    super(message);
    this.name = "PhEtravelResidenceValidationError";
  }
}

export const PH_ETRAVEL_RESIDENCE_API_BASE = "https://ws.etravel.gov.ph";

interface PhEtravelOfficialResidenceRow {
  code?: unknown;
  name?: unknown;
  region_code?: unknown;
  province_code?: unknown;
  municipality_code?: unknown;
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function first(values: unknown[]): string {
  for (const value of values) {
    const normalized = clean(value);
    if (normalized) return normalized;
  }
  return "";
}

function isPhilippinesCountry(value: string): boolean {
  return /^(?:PH|PHL|PHILIPPINES)$/i.test(value);
}

function canonicalOption(codeValues: unknown[], labelValues: unknown[]): PhEtravelCanonicalOption | null {
  const code = first(codeValues);
  if (!code) return null;
  return { code, label: first(labelValues) || null };
}

export function normalizePhEtravelResidenceAddress(
  answers: Record<string, string>,
  fallbackAddress?: string | null,
): PhEtravelResidenceAddress {
  const countryCode = first([
    answers.residence_country_code,
    answers.country_of_residence,
    answers.country_code,
  ]);
  const countryLabel = first([
    answers.residence_country_name,
    answers.country_of_residence_name,
    answers.country_name,
  ]);
  const isPhilippines = isPhilippinesCountry(countryCode) || isPhilippinesCountry(countryLabel);
  const line1 = first([
    answers.residence_address_line1,
    answers.street,
    answers.residential_address,
    answers.home_address,
    answers.home_address_line1,
    answers.address,
    fallbackAddress,
  ]);
  const line2 = first([
    answers.residence_address_line2,
    answers.street_two,
    answers.home_address_line2,
  ]) || null;

  const missing: string[] = [];
  if (!countryCode || isPhilippines && !/^(?:PH|PHL)$/i.test(countryCode)) {
    missing.push("residence.country_code");
  }
  if (!line1) missing.push("residence.address_line1");

  const province = canonicalOption(
    [answers.residence_province_code, answers.province_code],
    [answers.residence_province_name, answers.province_name, answers.residence_province_label],
  );
  const municipality = canonicalOption(
    [answers.residence_municipality_code, answers.municipality_code],
    [answers.residence_municipality_name, answers.municipality_name, answers.residence_municipality_label],
  );
  const barangay = canonicalOption(
    [answers.residence_barangay_code, answers.barangay_code],
    [answers.residence_barangay_name, answers.barangay_name, answers.residence_barangay_label],
  );
  const regionCode = first([answers.residence_region_code, answers.region_code]) || null;

  if (isPhilippines) {
    if (!regionCode) missing.push("residence.region_code");
    if (!province) missing.push("residence.province_code");
    if (!municipality) missing.push("residence.municipality_code");
    if (!barangay) missing.push("residence.barangay_code");
  }

  if (missing.length > 0) {
    throw new PhEtravelResidenceValidationError(
      "Philippines eTravel residence address is incomplete; canonical official address values are required.",
      missing,
    );
  }

  return {
    country: { code: countryCode, label: countryLabel || null },
    regionCode: isPhilippines ? regionCode : null,
    province: isPhilippines ? province : null,
    municipality: isPhilippines ? municipality : null,
    barangay: isPhilippines ? barangay : null,
    line1,
    line2,
    isPhilippines,
  };
}

function rowsFromResponse(value: unknown): PhEtravelOfficialResidenceRow[] {
  if (Array.isArray(value)) return value as PhEtravelOfficialResidenceRow[];
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.data)) return record.data as PhEtravelOfficialResidenceRow[];
  if (record.data && typeof record.data === "object") {
    const nested = record.data as Record<string, unknown>;
    if (Array.isArray(nested.data)) return nested.data as PhEtravelOfficialResidenceRow[];
  }
  return [];
}

async function fetchOfficialRows(
  url: string,
  fetchImpl: typeof fetch,
  field: string,
): Promise<PhEtravelOfficialResidenceRow[]> {
  const response = await fetchImpl(url, { headers: { accept: "application/json" } }).catch(() => null);
  if (!response?.ok) {
    throw new PhEtravelResidenceValidationError(
      `Official eTravel residence options are unavailable for ${field}.`,
      [field],
    );
  }
  return rowsFromResponse(await response.json());
}

function exactOfficialRow(
  rows: PhEtravelOfficialResidenceRow[],
  code: string,
  field: string,
): PhEtravelOfficialResidenceRow {
  const row = rows.find((candidate) => clean(candidate.code) === code);
  if (!row || !clean(row.name)) {
    throw new PhEtravelResidenceValidationError(
      `Official eTravel did not return the selected canonical code for ${field}.`,
      [field],
    );
  }
  return row;
}

export async function resolvePhEtravelOfficialResidenceHierarchy(
  residence: PhEtravelResidenceAddress,
  fetchImpl: typeof fetch = fetch,
): Promise<PhEtravelResidenceAddress> {
  if (!residence.isPhilippines) return residence;
  if (!residence.province || !residence.municipality || !residence.barangay) {
    throw new PhEtravelResidenceValidationError(
      "Philippine residence codes are incomplete.",
      ["residence.province_code", "residence.municipality_code", "residence.barangay_code"],
    );
  }

  const commonQuery = "paginate=0&order_by=name&status_by=asc";
  const provinceRows = await fetchOfficialRows(
    `${PH_ETRAVEL_RESIDENCE_API_BASE}/api/v1/common/provinces?${commonQuery}&region_code=${encodeURIComponent(residence.regionCode ?? "")}`,
    fetchImpl,
    "residence.province_code",
  );
  const province = exactOfficialRow(provinceRows, residence.province.code, "residence.province_code");
  const officialRegionCode = clean(province.region_code);
  if (!officialRegionCode || residence.regionCode && residence.regionCode !== officialRegionCode) {
    throw new PhEtravelResidenceValidationError(
      "Official province region code does not match the stored residence hierarchy.",
      ["residence.region_code"],
    );
  }

  const municipalityRows = await fetchOfficialRows(
    `${PH_ETRAVEL_RESIDENCE_API_BASE}/api/v1/common/municipalities?${commonQuery}&province_code=${encodeURIComponent(residence.province.code)}`,
    fetchImpl,
    "residence.municipality_code",
  );
  const municipality = exactOfficialRow(
    municipalityRows,
    residence.municipality.code,
    "residence.municipality_code",
  );
  if (clean(municipality.province_code) !== residence.province.code) {
    throw new PhEtravelResidenceValidationError(
      "Official municipality does not belong to the selected province.",
      ["residence.municipality_code"],
    );
  }

  const barangayRows = await fetchOfficialRows(
    `${PH_ETRAVEL_RESIDENCE_API_BASE}/api/v1/common/barangays?${commonQuery}&municipality_code=${encodeURIComponent(residence.municipality.code)}`,
    fetchImpl,
    "residence.barangay_code",
  );
  const barangay = exactOfficialRow(barangayRows, residence.barangay.code, "residence.barangay_code");
  if (clean(barangay.municipality_code) !== residence.municipality.code) {
    throw new PhEtravelResidenceValidationError(
      "Official barangay does not belong to the selected municipality.",
      ["residence.barangay_code"],
    );
  }

  return {
    ...residence,
    regionCode: officialRegionCode,
    province: { code: residence.province.code, label: clean(province.name) },
    municipality: { code: residence.municipality.code, label: clean(municipality.name) },
    barangay: { code: residence.barangay.code, label: clean(barangay.name) },
  };
}

export function buildPhEtravelResidenceActionPlan(
  residence: PhEtravelResidenceAddress,
): PhEtravelResidenceAction[] {
  const actions: PhEtravelResidenceAction[] = [
    {
      kind: "select",
      fieldName: "country_code",
      code: residence.country.code,
      label: residence.country.label,
    },
  ];

  if (residence.isPhilippines) {
    if (!residence.province || !residence.municipality || !residence.barangay || !residence.regionCode) {
      throw new PhEtravelResidenceValidationError(
        "Philippine residence hierarchy must be complete before browser actions are planned.",
        ["residence.region_code", "residence.province_code", "residence.municipality_code", "residence.barangay_code"],
      );
    }
    actions.push(
      {
        kind: "select",
        fieldName: "province_code",
        code: residence.province.code,
        label: residence.province.label,
        dependsOn: residence.regionCode,
      },
      {
        kind: "select",
        fieldName: "municipality_code",
        code: residence.municipality.code,
        label: residence.municipality.label,
        dependsOn: residence.province.code,
      },
      {
        kind: "select",
        fieldName: "barangay_code",
        code: residence.barangay.code,
        label: residence.barangay.label,
        dependsOn: residence.municipality.code,
      },
    );
  }

  actions.push({ kind: "fill", fieldName: "street", value: residence.line1 });
  if (residence.line2) actions.push({ kind: "fill", fieldName: "street_two", value: residence.line2 });
  return actions;
}
