export const PH_ETRAVEL_OFFICIAL_API_BASE = "https://ws.etravel.gov.ph";

export const PH_RESIDENCE_CASCADE_CONTRACT = {
  evidenceDate: "2026-08-15",
  optionIdentity: "official_code",
  displayIdentity: "official_name_with_optional_chinese_projection",
  observedProvinceCount: 85,
  regionSource: "selected_province.region_code",
  requiredForPhilippineResidence: [
    "country_code",
    "region_code",
    "province_code",
    "municipality_code",
    "barangay_code",
    "street",
  ],
  optional: ["street_two"],
  foreignResidenceFields: ["country_code", "street", "street_two"],
} as const;

export type PhResidenceLevel = "province" | "municipality" | "barangay";

export type PhResidenceOfficialOption = {
  level: PhResidenceLevel;
  value: string;
  submitValue: string;
  officialCode: string;
  officialLabel: string;
  label_en: string;
  label_zh: string;
  text: string;
  metadata: {
    correspondenceCode: string | null;
    regionCode: string;
    provinceCode: string | null;
    municipalityCode: string | null;
    subMunicipalityCode: string | null;
    zipCode: string | null;
    isSub: number | null;
  };
};

export type PhResidenceAnswers = {
  country_code: string;
  region_code: string;
  province_code: string;
  municipality_code: string;
  barangay_code: string;
  street: string;
  street_two: string;
};

/**
 * The dynamic schema keeps product-facing field names while the official
 * residence API uses flat keys. This map is the only allowed bridge.
 */
export const PH_RESIDENCE_FORM_FIELD_MAP = {
  country_code: "country_of_residence",
  region_code: "residence_region_code",
  province_code: "residence_province_code",
  municipality_code: "residence_municipality_code",
  barangay_code: "residence_barangay_code",
  street: "residence_address_line1",
  street_two: "residence_address_line2",
} as const;

export type PhResidenceFormValues = Record<string, string | undefined>;

export type PhResidenceCascadeChange =
  | { field: "country_code"; value: string }
  | { field: "province_code"; option: PhResidenceOfficialOption | null }
  | { field: "municipality_code"; option: PhResidenceOfficialOption | null }
  | { field: "barangay_code"; option: PhResidenceOfficialOption | null };

export type PhResidenceMissingItem = {
  canonicalKey:
    | "residence.country_code"
    | "residence.province_code"
    | "residence.municipality_code"
    | "residence.barangay_code"
    | "residence.address_line1";
  officialKey:
    | "country_code"
    | "province_code"
    | "municipality_code"
    | "barangay_code"
    | "street";
  fieldName:
    | "country_of_residence"
    | "residence_province_code"
    | "residence_municipality_code"
    | "residence_barangay_code"
    | "residence_address_line1";
  label: { en: string; zh: string };
  focusTarget: {
    stepNumber: 2;
    section: "Traveller Information";
    fieldName: string;
    anchor: string;
  };
};

type UnknownRecord = Record<string, unknown>;

const LEVEL_PATHS: Record<PhResidenceLevel, string> = {
  province: "/api/v1/common/provinces",
  municipality: "/api/v1/common/municipalities",
  barangay: "/api/v1/common/barangays",
};

const EMPTY_ANSWERS: PhResidenceAnswers = {
  country_code: "",
  region_code: "",
  province_code: "",
  municipality_code: "",
  barangay_code: "",
  street: "",
  street_two: "",
};

const MISSING_FIELD_CONTRACT: Record<
  PhResidenceMissingItem["officialKey"],
  Omit<PhResidenceMissingItem, "officialKey">
> = {
  country_code: {
    canonicalKey: "residence.country_code",
    fieldName: "country_of_residence",
    label: { en: "Permanent country of residence", zh: "永久居住国家/地区" },
    focusTarget: {
      stepNumber: 2,
      section: "Traveller Information",
      fieldName: "country_of_residence",
      anchor: "field-country_of_residence",
    },
  },
  province_code: {
    canonicalKey: "residence.province_code",
    fieldName: "residence_province_code",
    label: { en: "State/Province", zh: "州/省" },
    focusTarget: {
      stepNumber: 2,
      section: "Traveller Information",
      fieldName: "residence_province_code",
      anchor: "field-residence_province_code",
    },
  },
  municipality_code: {
    canonicalKey: "residence.municipality_code",
    fieldName: "residence_municipality_code",
    label: { en: "City/Municipality", zh: "城市/市镇" },
    focusTarget: {
      stepNumber: 2,
      section: "Traveller Information",
      fieldName: "residence_municipality_code",
      anchor: "field-residence_municipality_code",
    },
  },
  barangay_code: {
    canonicalKey: "residence.barangay_code",
    fieldName: "residence_barangay_code",
    label: { en: "Barangay", zh: "Barangay（村/社区）" },
    focusTarget: {
      stepNumber: 2,
      section: "Traveller Information",
      fieldName: "residence_barangay_code",
      anchor: "field-residence_barangay_code",
    },
  },
  street: {
    canonicalKey: "residence.address_line1",
    fieldName: "residence_address_line1",
    label: { en: "House No./Building/Street", zh: "门牌号/楼宇/街道" },
    focusTarget: {
      stepNumber: 2,
      section: "Traveller Information",
      fieldName: "residence_address_line1",
      anchor: "field-residence_address_line1",
    },
  },
};

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function nullableString(value: unknown): string | null {
  const cleaned = cleanString(value);
  return cleaned || null;
}

function opaqueOfficialCode(value: unknown, field: string): string {
  const code = cleanString(value);
  if (!code || code.length > 40 || !/^[A-Za-z0-9_-]+$/.test(code)) {
    throw new Error(`Invalid official PH residence ${field}`);
  }
  return code;
}

function officialName(value: unknown): string {
  const name = cleanString(value);
  if (!name) throw new Error("Invalid official PH residence name");
  return name;
}

function readOfficialRows(payload: unknown): UnknownRecord[] {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid official PH residence response");
  }
  const data = (payload as { data?: unknown }).data;
  const rows = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { data?: unknown }).data)
      ? (data as { data: unknown[] }).data
      : null;
  if (!rows) {
    throw new Error("Invalid official PH residence response data");
  }
  return rows.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new Error("Invalid official PH residence option row");
    }
    return row as UnknownRecord;
  });
}

function localizedDisplayLabel(
  officialLabel: string,
  chineseLabel: string | undefined
): { labelZh: string; text: string } {
  const localized = chineseLabel?.trim();
  if (!localized || localized === officialLabel) {
    return { labelZh: officialLabel, text: officialLabel };
  }
  return {
    labelZh: localized,
    text: `${localized} / ${officialLabel}`,
  };
}

export function buildPhResidenceOfficialRequest(
  level: PhResidenceLevel,
  parentCode?: string | null
): URL {
  const url = new URL(LEVEL_PATHS[level], PH_ETRAVEL_OFFICIAL_API_BASE);
  url.searchParams.set("paginate", "0");
  url.searchParams.set("order_by", "name");
  url.searchParams.set("status_by", "asc");

  if (level === "municipality") {
    url.searchParams.set(
      "province_code",
      opaqueOfficialCode(parentCode, "province_code")
    );
  }
  if (level === "barangay") {
    url.searchParams.set(
      "municipality_code",
      opaqueOfficialCode(parentCode, "municipality_code")
    );
  }
  return url;
}

/**
 * Parses the current official eTravel response. Names are display-only; the
 * exact official code is the sole saved and submitted value.
 */
export function parsePhResidenceOfficialOptions(
  level: PhResidenceLevel,
  payload: unknown,
  input: {
    parentCode?: string | null;
    chineseLabelsByCode?: Readonly<Record<string, string>>;
  } = {}
): PhResidenceOfficialOption[] {
  const parentCode =
    level === "province"
      ? null
      : opaqueOfficialCode(
          input.parentCode,
          level === "municipality" ? "province_code" : "municipality_code"
        );
  const seen = new Set<string>();

  return readOfficialRows(payload).map((row) => {
    const officialCode = opaqueOfficialCode(row.code, "code");
    if (seen.has(officialCode)) {
      throw new Error(`Duplicate official PH residence code: ${officialCode}`);
    }
    seen.add(officialCode);

    const officialLabel = officialName(row.name);
    const regionCode = opaqueOfficialCode(row.region_code, "region_code");
    const provinceCode = nullableString(row.province_code);
    const municipalityCode = nullableString(row.municipality_code);
    if (level === "municipality" && provinceCode !== parentCode) {
      throw new Error("Official municipality does not match selected province");
    }
    if (level === "barangay" && municipalityCode !== parentCode) {
      throw new Error("Official barangay does not match selected municipality");
    }

    const display = localizedDisplayLabel(
      officialLabel,
      input.chineseLabelsByCode?.[officialCode]
    );
    return {
      level,
      value: officialCode,
      submitValue: officialCode,
      officialCode,
      officialLabel,
      label_en: officialLabel,
      label_zh: display.labelZh,
      text: display.text,
      metadata: {
        correspondenceCode: nullableString(row.correspondence_code),
        regionCode,
        provinceCode,
        municipalityCode,
        subMunicipalityCode: nullableString(row.sub_municipality_code),
        zipCode: nullableString(row.zip_code),
        isSub: typeof row.is_sub === "number" ? row.is_sub : null,
      },
    };
  });
}

function requireOptionLevel(
  option: PhResidenceOfficialOption,
  expected: PhResidenceLevel
): void {
  if (option.level !== expected || option.value !== option.officialCode) {
    throw new Error(`Expected official ${expected} option`);
  }
}

export function applyPhResidenceCascadeChange(
  current: Partial<PhResidenceAnswers>,
  change: PhResidenceCascadeChange
): { values: PhResidenceAnswers; clearedFieldNames: string[] } {
  const values = { ...EMPTY_ANSWERS, ...current };
  const cleared = new Set<string>();
  const clear = (fields: Array<keyof PhResidenceAnswers>) => {
    for (const field of fields) {
      if (values[field]) cleared.add(field);
      values[field] = "";
    }
  };

  if (change.field === "country_code") {
    const nextCountry = change.value.trim().toUpperCase();
    if (values.country_code.trim().toUpperCase() !== nextCountry) {
      clear([
        "region_code",
        "province_code",
        "municipality_code",
        "barangay_code",
        "street",
        "street_two",
      ]);
    }
    values.country_code = nextCountry;
  }

  if (change.field === "province_code") {
    const nextCode = change.option?.officialCode ?? "";
    if (values.province_code !== nextCode) {
      clear(["municipality_code", "barangay_code"]);
    }
    if (!change.option) {
      clear(["region_code"]);
      values.province_code = "";
    } else {
      requireOptionLevel(change.option, "province");
      values.province_code = change.option.officialCode;
      values.region_code = change.option.metadata.regionCode;
    }
  }

  if (change.field === "municipality_code") {
    const nextCode = change.option?.officialCode ?? "";
    if (values.municipality_code !== nextCode) clear(["barangay_code"]);
    if (!change.option) {
      values.municipality_code = "";
    } else {
      requireOptionLevel(change.option, "municipality");
      if (change.option.metadata.provinceCode !== values.province_code) {
        throw new Error("Municipality does not belong to selected province");
      }
      values.municipality_code = change.option.officialCode;
    }
  }

  if (change.field === "barangay_code") {
    if (!change.option) {
      values.barangay_code = "";
    } else {
      requireOptionLevel(change.option, "barangay");
      if (
        change.option.metadata.municipalityCode !== values.municipality_code
      ) {
        throw new Error("Barangay does not belong to selected municipality");
      }
      values.barangay_code = change.option.officialCode;
    }
  }

  return { values, clearedFieldNames: [...cleared] };
}

export function readPhResidenceFormValues(
  formValues: Readonly<PhResidenceFormValues>
): Partial<PhResidenceAnswers> {
  return Object.fromEntries(
    Object.entries(PH_RESIDENCE_FORM_FIELD_MAP).map(([officialKey, fieldName]) => [
      officialKey,
      formValues[fieldName] ?? "",
    ])
  ) as Partial<PhResidenceAnswers>;
}

/**
 * Applies the official cascade to product field names without changing
 * unrelated dynamic-form answers. Region remains derived, never selectable.
 */
export function applyPhResidenceCascadeFormChange(
  formValues: Readonly<PhResidenceFormValues>,
  change: PhResidenceCascadeChange
): { values: PhResidenceFormValues; clearedFieldNames: string[] } {
  const result = applyPhResidenceCascadeChange(
    readPhResidenceFormValues(formValues),
    change
  );
  const values: PhResidenceFormValues = { ...formValues };
  const clearedFieldNames = result.clearedFieldNames.map(
    (officialKey) =>
      PH_RESIDENCE_FORM_FIELD_MAP[officialKey as keyof PhResidenceAnswers]
  );

  for (const [officialKey, fieldName] of Object.entries(
    PH_RESIDENCE_FORM_FIELD_MAP
  ) as Array<[keyof PhResidenceAnswers, string]>) {
    values[fieldName] = result.values[officialKey];
  }

  return { values, clearedFieldNames };
}

function missingItem(
  officialKey: PhResidenceMissingItem["officialKey"]
): PhResidenceMissingItem {
  return { officialKey, ...MISSING_FIELD_CONTRACT[officialKey] };
}

export function getPhResidenceMissingItems(
  answers: Partial<PhResidenceAnswers>
): PhResidenceMissingItem[] {
  const countryCode = answers.country_code?.trim().toUpperCase() ?? "";
  if (!countryCode) return [missingItem("country_code")];

  const missing: PhResidenceMissingItem[] = [];
  if (countryCode === "PH") {
    if (!answers.province_code?.trim() || !answers.region_code?.trim())
      missing.push(missingItem("province_code"));
    if (!answers.municipality_code?.trim()) {
      missing.push(missingItem("municipality_code"));
    }
    if (!answers.barangay_code?.trim())
      missing.push(missingItem("barangay_code"));
  }
  if (!answers.street?.trim()) missing.push(missingItem("street"));
  return missing;
}

export function isPhResidenceComplete(
  answers: Partial<PhResidenceAnswers>
): boolean {
  return getPhResidenceMissingItems(answers).length === 0;
}
