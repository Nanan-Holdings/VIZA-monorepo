import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { TH_TDAC_FORM_FIELDS } from "../../scripts/th-tdac/form-fields";
import {
  TDAC_OFFICIAL_DISTRICTS_BY_PROVINCE,
  TDAC_OFFICIAL_PROVINCE_LABELS,
  TDAC_OFFICIAL_SUBDISTRICTS_BY_PROVINCE_DISTRICT,
  TDAC_OFFICIAL_TRANSPORT_LABELS_BY_MODE,
} from "../../scripts/th-tdac/tdac-official-dropdowns.generated";
import {
  TDAC_BOARDED_COUNTRY_OPTIONS,
  TDAC_COUNTRY_HEALTH_RULES,
  TDAC_DISTRICT_OPTIONS_BY_PROVINCE,
  TDAC_NATIONALITY_OPTIONS,
  TDAC_RESIDENCE_COUNTRY_OPTIONS,
  TDAC_RESIDENCE_REGION_OPTIONS_BY_COUNTRY,
  TDAC_SUBDISTRICT_OPTIONS_BY_DISTRICT,
  TDAC_PROVINCE_OPTIONS,
  TDAC_VISITED_COUNTRY_OPTIONS,
  TDAC_YELLOW_FEVER_COUNTRY_CODES,
  TDAC_YELLOW_FEVER_SHOW_IF,
} from "../../scripts/th-tdac/official-options";

const administrativeTranslations = JSON.parse(
  readFileSync(
    new URL("../../scripts/th-tdac/administrative-translations.zh.json", import.meta.url),
    "utf8",
  ),
) as {
  _meta?: {
    province_count?: number;
    district_count?: number;
    subdistrict_count?: number;
  };
  provinces?: Record<string, string>;
  districts?: Record<string, string>;
  subdistricts?: Record<string, string>;
};

const seedSource = readFileSync(
  new URL("../../scripts/th-tdac/form-fields.ts", import.meta.url),
  "utf8",
);

const tdacTestOptionKey = (value: string): string => value
  .trim()
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "");

const expectChineseLabel = (label: string, officialLabel: string): void => {
  expect(label, officialLabel).toMatch(/[\u3400-\u9fff]/);
  expect(label, officialLabel).not.toMatch(/[A-Za-z]/);
};

function fieldNames(): Set<string> {
  return new Set(TH_TDAC_FORM_FIELDS.map((field) => field.field_name));
}

function field(name: string) {
  return TH_TDAC_FORM_FIELDS.find((item) => item.field_name === name);
}

describe("Thailand TDAC arrival-card schema seed", () => {
  test("matches official TDAC field inventory", () => {
    const names = fieldNames();

    expect(seedSource).toContain('TH_TDAC_VISA_TYPE = "TH_TDAC_ARRIVAL_CARD"');
    for (const name of [
      "family_name",
      "first_name",
      "middle_name",
      "passport_number",
      "nationality",
      "date_of_birth",
      "gender",
      "occupation",
      "visa_number",
      "country_territory_of_residence",
      "city_state_of_residence",
      "phone_country_code",
      "phone_number",
      "email_address",
      "arrival_date",
      "country_boarded",
      "purpose_of_travel",
      "purpose_of_travel_other",
      "arrival_mode_of_travel",
      "arrival_mode_of_transport",
      "arrival_transport_other",
      "arrival_transport_number",
      "departure_date",
      "departure_mode_of_travel",
      "departure_mode_of_transport",
      "departure_transport_other",
      "departure_transport_number",
      "is_transit_traveler",
      "accommodation_type",
      "accommodation_type_other",
      "province",
      "district",
      "sub_district",
      "postcode",
      "address_in_thailand",
      "countries_visited_last_14_days",
      "yellow_fever_vaccination_certificate",
      "yellow_fever_vaccination_date",
      "health_symptoms_last_14_days",
      "health_symptoms_other",
    ]) {
      expect(names.has(name), name).toBe(true);
    }
  });

  test("removes non-official legacy health fields", () => {
    const names = fieldNames();

    for (const name of [
      "has_health_symptoms",
      "health_declaration",
      "recent_country_visit_history",
      "yellow_fever_risk_visit",
    ]) {
      expect(names.has(name), name).toBe(false);
    }
  });

  test("classifies every official country option and the exact 42 yellow-fever countries", () => {
    expect(TDAC_COUNTRY_HEALTH_RULES).toHaveLength(TDAC_VISITED_COUNTRY_OPTIONS.length);
    expect(new Set(TDAC_COUNTRY_HEALTH_RULES.map((rule) => rule.countryCode))).toEqual(
      new Set(TDAC_VISITED_COUNTRY_OPTIONS.map((country) => country.value)),
    );
    expect(TDAC_COUNTRY_HEALTH_RULES.every(
      (rule) => rule.additionalQuestions === "none" || rule.additionalQuestions === "yellow_fever",
    )).toBe(true);
    expect(TDAC_YELLOW_FEVER_COUNTRY_CODES).toHaveLength(42);
    expect(TDAC_COUNTRY_HEALTH_RULES.filter(
      (rule) => rule.additionalQuestions === "yellow_fever",
    ).map((rule) => rule.countryCode).sort()).toEqual([...TDAC_YELLOW_FEVER_COUNTRY_CODES].sort());
  });

  test("uses the exact field-specific official TDAC country contracts", () => {
    expect(TDAC_NATIONALITY_OPTIONS).toHaveLength(259);
    expect(TDAC_BOARDED_COUNTRY_OPTIONS).toHaveLength(259);
    expect(TDAC_RESIDENCE_COUNTRY_OPTIONS).toHaveLength(260);
    expect(TDAC_VISITED_COUNTRY_OPTIONS).toHaveLength(260);

    for (const options of [
      TDAC_NATIONALITY_OPTIONS,
      TDAC_BOARDED_COUNTRY_OPTIONS,
      TDAC_RESIDENCE_COUNTRY_OPTIONS,
      TDAC_VISITED_COUNTRY_OPTIONS,
    ]) {
      expect(new Set(options.map((item) => item.value)).size).toBe(options.length);
      expect(options.some((item) => item.value === "ATA")).toBe(false);
    }

    expect(TDAC_NATIONALITY_OPTIONS.some((item) => item.value === "THA")).toBe(false);
    expect(TDAC_BOARDED_COUNTRY_OPTIONS.some((item) => item.value === "THA")).toBe(false);
    expect(TDAC_RESIDENCE_COUNTRY_OPTIONS.some((item) => item.value === "THA")).toBe(true);
    expect(TDAC_VISITED_COUNTRY_OPTIONS.some((item) => item.value === "THA")).toBe(true);

    for (const code of ["ANT", "GBN", "N02", "PCI", "RKS", "SCT", "UNO", "XKX", "XXA", "XXB", "XXC", "XXX"]) {
      expect(TDAC_BOARDED_COUNTRY_OPTIONS.some((item) => item.value === code), code).toBe(true);
    }

    expect(field("nationality")?.options).toBe(TDAC_NATIONALITY_OPTIONS);
    expect(field("country_territory_of_residence")?.options).toBe(TDAC_RESIDENCE_COUNTRY_OPTIONS);
    expect(field("country_boarded")?.options).toBe(TDAC_BOARDED_COUNTRY_OPTIONS);
    expect(field("countries_visited_last_14_days")?.options).toBe(TDAC_VISITED_COUNTRY_OPTIONS);
  });

  test("covers every official residence and Thailand administrative dropdown branch", () => {
    expect(Object.keys(TDAC_RESIDENCE_REGION_OPTIONS_BY_COUNTRY)).toHaveLength(260);
    expect(Object.keys(TDAC_DISTRICT_OPTIONS_BY_PROVINCE)).toHaveLength(77);
    expect(Object.values(TDAC_DISTRICT_OPTIONS_BY_PROVINCE).flat()).toHaveLength(927);
    expect(Object.keys(TDAC_SUBDISTRICT_OPTIONS_BY_DISTRICT)).toHaveLength(927);

    const ayutthayaBangSai = TDAC_DISTRICT_OPTIONS_BY_PROVINCE.phra_nakhon_si_ayutthaya
      ?.filter((item) => item.official_label.toUpperCase() === "BANG SAI");
    expect(ayutthayaBangSai).toHaveLength(2);
    expect(ayutthayaBangSai?.map((item) => item.label_en).sort()).toEqual([
      "BANG SAI (13190)",
      "BANG SAI (13270)",
    ]);
    for (const district of ayutthayaBangSai ?? []) {
      expect(TDAC_SUBDISTRICT_OPTIONS_BY_DISTRICT[district.value]?.length).toBeGreaterThan(0);
    }
  });

  test("covers every Thai administrative option with Chinese-only labels", () => {
    const provinceOptions = TDAC_PROVINCE_OPTIONS;
    const districtOptions = Object.values(TDAC_DISTRICT_OPTIONS_BY_PROVINCE).flat();
    const subdistrictOptions = Object.values(TDAC_SUBDISTRICT_OPTIONS_BY_DISTRICT).flat();

    expect(provinceOptions).toHaveLength(77);
    expect(districtOptions).toHaveLength(927);
    expect(subdistrictOptions).toHaveLength(7_439);
    expect(administrativeTranslations._meta).toMatchObject({
      province_count: 77,
      district_count: 927,
      subdistrict_count: 7_439,
    });
    expect(Object.keys(administrativeTranslations.provinces ?? {})).toHaveLength(77);
    expect(Object.keys(administrativeTranslations.districts ?? {})).toHaveLength(927);
    expect(Object.keys(administrativeTranslations.subdistricts ?? {})).toHaveLength(7_439);

    for (const item of provinceOptions) {
      expectChineseLabel(item.label_zh, item.official_label);
      expect(item.label_zh).not.toBe(item.label_en);
      expect(item.official_label).toBe(item.label_en);
    }
    for (const item of [...districtOptions, ...subdistrictOptions]) {
      expectChineseLabel(item.label_zh, item.official_label);
      expect(item.label_zh).not.toBe(item.label_en);
      expect(item.official_label).toBe(
        item.label_en.includes(" (") ? item.label_en.split(" (")[0] : item.label_en,
      );
    }

    expect(Object.keys(administrativeTranslations.districts ?? {}).every(
      (key) => key.split("::").length >= 2,
    )).toBe(true);
    expect(Object.keys(administrativeTranslations.subdistricts ?? {}).every(
      (key) => key.split("::").length >= 3,
    )).toBe(true);
  });

  test("preserves official Thai administrative values and English contracts", () => {
    for (const [province, rawDistricts] of Object.entries(TDAC_OFFICIAL_DISTRICTS_BY_PROVINCE)) {
      const provinceKey = tdacTestOptionKey(province);
      const options = TDAC_DISTRICT_OPTIONS_BY_PROVINCE[provinceKey] ?? [];
      const counts = new Map<string, number>();
      for (const district of rawDistricts) {
        const normalized = district.label.toUpperCase();
        counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
      }
      const seen = new Map<string, number>();
      rawDistricts.forEach((district, index) => {
        const item = options[index];
        const normalized = district.label.toUpperCase();
        const occurrence = (seen.get(normalized) ?? 0) + 1;
        seen.set(normalized, occurrence);
        expect(item.official_label).toBe(district.label);
        expect(item.label_en).toBe(
          counts.get(normalized)! > 1 && district.postcode
            ? `${district.label} (${district.postcode})`
            : district.label,
        );
        expect(item.value).toBe([
          provinceKey,
          tdacTestOptionKey(district.label),
          ...(counts.get(normalized)! > 1 ? [district.postcode ?? "no_postcode"] : []),
        ].join("|"));
        expect(occurrence).toBeGreaterThan(0);
      });
    }

    for (const [provinceDistrict, rawSubdistricts] of Object.entries(
      TDAC_OFFICIAL_SUBDISTRICTS_BY_PROVINCE_DISTRICT,
    )) {
      const [province = "", district = "", postcode] = provinceDistrict.split("::");
      const districtValue = [
        tdacTestOptionKey(province),
        tdacTestOptionKey(district),
        ...(postcode ? [postcode] : []),
      ].join("|");
      const options = TDAC_SUBDISTRICT_OPTIONS_BY_DISTRICT[districtValue] ?? [];
      rawSubdistricts.forEach((subdistrict, index) => {
        const item = options[index];
        expect(item.official_label).toBe(subdistrict);
        expect(item.label_en).toBe(subdistrict);
        expect(item.value).toBe(`${districtValue}|${tdacTestOptionKey(subdistrict)}`);
      });
    }
  });

  test("uses standard Chinese names for NAKHON NAYOK districts", () => {
    expect(TDAC_DISTRICT_OPTIONS_BY_PROVINCE.nakhon_nayok).toEqual([
      expect.objectContaining({
        official_label: "BAN NA",
        label_en: "BAN NA",
        label_zh: "班纳县",
      }),
      expect.objectContaining({
        official_label: "MUEANG NAKHON NAYOK",
        label_en: "MUEANG NAKHON NAYOK",
        label_zh: "那空那育府直辖县",
      }),
      expect.objectContaining({
        official_label: "ONGKHARAK",
        label_en: "ONGKHARAK",
        label_zh: "翁卡叻县",
      }),
      expect.objectContaining({
        official_label: "PAK PHLI",
        label_en: "PAK PHLI",
        label_zh: "北披县",
      }),
    ]);
  });

  test("localizes all official Anguilla and Hong Kong residence regions", () => {
    expect(TDAC_RESIDENCE_REGION_OPTIONS_BY_COUNTRY.AIA).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          official_label: "STONEY GROUND",
          label_en: "STONEY GROUND",
          label_zh: "斯托尼格朗德",
        }),
        expect.objectContaining({
          official_label: "THE VALLEY",
          label_en: "THE VALLEY",
          label_zh: "瓦利",
        }),
      ]),
    );
    expect(TDAC_RESIDENCE_REGION_OPTIONS_BY_COUNTRY.HKG).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          official_label: "CENTRAL AND WESTERN",
          label_en: "CENTRAL AND WESTERN",
          label_zh: "中西区",
        }),
        expect.objectContaining({
          official_label: "KWAI TSING",
          label_en: "KWAI TSING",
          label_zh: "葵青区",
        }),
      ]),
    );

    for (const countryCode of ["AIA", "HKG"]) {
      const options = TDAC_RESIDENCE_REGION_OPTIONS_BY_COUNTRY[countryCode] ?? [];
      expect(options.length).toBeGreaterThan(0);
      expect(
        options.filter((item) => item.label_zh === item.label_en),
        `${countryCode} should not expose untranslated English labels in the Chinese UI`,
      ).toEqual([]);
    }
  });

  test("provides Chinese-only display labels for every official residence region", () => {
    const allOptions = Object.values(
      TDAC_RESIDENCE_REGION_OPTIONS_BY_COUNTRY,
    ).flat();
    expect(allOptions).toHaveLength(5_091);

    for (const option of allOptions) {
      expect(option.label_zh, option.official_label).toMatch(/[\u3400-\u9fff]/);
      expect(option.label_zh, option.official_label).not.toMatch(/[A-Za-z]/);
      expect(option.label_zh).not.toBe(option.label_en);
      expect(option.official_label).toBe(option.label_en);
    }
  });

  test("shows official health questions for risk countries selected in any TDAC trigger field", () => {
    expect(field("yellow_fever_vaccination_certificate")?.conditional_logic).toMatchObject({
      showIf: TDAC_YELLOW_FEVER_SHOW_IF,
    });
    expect(TDAC_YELLOW_FEVER_SHOW_IF).toContain(
      "countries_visited_last_14_days contains_any",
    );
    expect(TDAC_YELLOW_FEVER_SHOW_IF).toContain("country_boarded in");
    expect(TDAC_YELLOW_FEVER_SHOW_IF).toContain("nationality in");
    expect(field("yellow_fever_vaccination_date")?.conditional_logic?.showIf).toContain(
      "yellow_fever_vaccination_certificate === yes",
    );
    expect(field("health_symptoms_other")?.conditional_logic?.showIf).toContain(
      "health_symptoms_last_14_days contains_any [other]",
    );
  });

  test("keeps official conditional dropdown structure", () => {
    expect(field("gender")?.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "undefined", label_zh: "未定义", label_en: "UNDEFINED" }),
      ]),
    );
    expect(field("arrival_mode_of_transport")?.validation_rules?.dependent_options).toMatchObject({
      air: expect.any(Array),
      land: [
        expect.objectContaining({ value: "car", label_zh: "汽车", label_en: "CAR" }),
        expect.objectContaining({ value: "train", label_zh: "火车", label_en: "TRAIN" }),
        expect.objectContaining({ value: "others", label_zh: "其他（请说明）", label_en: "OTHERS (PLEASE SPECIFY)" }),
      ],
      sea: expect.any(Array),
    });
    expect(field("departure_mode_of_transport")?.validation_rules?.dependent_options).toMatchObject({
      air: expect.any(Array),
      land: expect.any(Array),
      sea: expect.any(Array),
    });
    expect(field("district")?.validation_rules).toMatchObject({ dependent_on: "province" });
    expect(field("sub_district")?.validation_rules).toMatchObject({ dependent_on: "district" });
    expect(field("countries_visited_last_14_days")?.field_type).toBe("multi_select");
    expect(field("city_state_of_residence")?.field_type).toBe("select");
    expect(field("city_state_of_residence")?.validation_rules).toMatchObject({
      dependent_on: "country_territory_of_residence",
    });
    expect(field("nationality")?.options?.length).toBeGreaterThan(200);
    expect(field("province")?.options?.length).toBe(77);
    expect(field("address_in_thailand")?.validation_rules).toMatchObject({ maxLength: 215 });
  });

  test("matches official province, transport, and health dropdown order exactly", () => {
    expect(field("province")?.options?.map((item) => item.official_label)).toEqual(
      TDAC_OFFICIAL_PROVINCE_LABELS,
    );
    const arrivalTransport = field("arrival_mode_of_transport")?.validation_rules
      ?.dependent_options as Record<string, Array<{ official_label: string }>>;
    expect(arrivalTransport.air.map((item) => item.official_label)).toEqual(
      TDAC_OFFICIAL_TRANSPORT_LABELS_BY_MODE.AIR,
    );
    expect(arrivalTransport.land.map((item) => item.official_label)).toEqual(
      TDAC_OFFICIAL_TRANSPORT_LABELS_BY_MODE.LAND,
    );
    expect(arrivalTransport.sea.map((item) => item.official_label)).toEqual(
      TDAC_OFFICIAL_TRANSPORT_LABELS_BY_MODE.SEA,
    );
    expect(field("health_symptoms_last_14_days")?.options?.map((item) => item.official_label)).toEqual([
      "Diarrhea",
      "Vomiting",
      "Abdominal pain",
      "Fever",
      "Rash",
      "Headache",
      "Sore throat",
      "Jaundice",
      "Cough or shortness of breath",
      "Enlarge lymph glands or tender lumps",
      "No Symptom",
      "Other (Please Specify)",
    ]);
  });

  test("matches the current official purpose dropdown exactly", () => {
    expect(field("purpose_of_travel")?.options).toEqual([
      expect.objectContaining({ value: "holiday", label_en: "HOLIDAY" }),
      expect.objectContaining({ value: "meeting", label_en: "MEETING" }),
      expect.objectContaining({ value: "sports", label_en: "SPORTS" }),
      expect.objectContaining({ value: "business", label_en: "BUSINESS" }),
      expect.objectContaining({ value: "incentive", label_en: "INCENTIVE" }),
      expect.objectContaining({ value: "medical_wellness", label_en: "MEDICAL & WELLNESS" }),
      expect.objectContaining({ value: "education", label_en: "EDUCATION" }),
      expect.objectContaining({ value: "convention", label_en: "CONVENTION" }),
      expect.objectContaining({ value: "employment", label_en: "EMPLOYMENT" }),
      expect.objectContaining({ value: "exhibition", label_en: "EXHIBITION" }),
      expect.objectContaining({ value: "others", label_en: "OTHERS (PLEASE SPECIFY)" }),
    ]);
    expect(field("purpose_of_travel")?.options).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "transit" }),
        expect.objectContaining({ value: "return_resident" }),
      ]),
    );
  });

  test("uses Chinese step titles in the seeded TDAC wizard", () => {
    expect(new Set(TH_TDAC_FORM_FIELDS.map((item) => item.step_name))).toEqual(
      new Set(["旅客信息", "抵达和离境信息", "住宿信息", "健康申报"]),
    );
  });

  test("requires accommodation fields only for non-transit travellers", () => {
    for (const name of ["accommodation_type", "province", "address_in_thailand"]) {
      expect(field(name)?.required, name).toBe(true);
      expect(field(name)?.conditional_logic, name).toMatchObject({ showIf: "is_transit_traveler !== yes" });
    }

    for (const name of ["district", "sub_district", "postcode"]) {
      expect(field(name)?.required, name).toBe(false);
      expect(field(name)?.conditional_logic, name).toMatchObject({ showIf: "is_transit_traveler !== yes" });
    }

    expect(field("accommodation_type_other")?.conditional_logic).toMatchObject({
      showIf: "is_transit_traveler !== yes && accommodation_type === others",
    });
    expect(field("is_transit_traveler")?.validation_rules).toMatchObject({
      auto_when_arrival_departure_same_day: true,
      locked_unless_arrival_departure_same_day: true,
    });
  });
});
