import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const seedSource = readFileSync(
  new URL("../../scripts/seed-tw-entry-permit-form-fields.ts", import.meta.url),
  "utf8",
);

const migration0122Source = readFileSync(
  new URL("../../drizzle/0122_tw_entry_permit_document_requirements.sql", import.meta.url),
  "utf8",
);

const migration0003Source = readFileSync(
  new URL("../../drizzle/0003_visa_form_fields.sql", import.meta.url),
  "utf8",
);

const migration0006Source = readFileSync(
  new URL("../../drizzle/0006_visa_packages.sql", import.meta.url),
  "utf8",
);

const migration0123Source = readFileSync(
  new URL("../../drizzle/0123_tw_entry_permit_document_requirements_zh_and_eligibility_split.sql", import.meta.url),
  "utf8",
);

const migration0124Source = readFileSync(
  new URL("../../drizzle/0124_tw_entry_permit_form_fields_metadata_sync.sql", import.meta.url),
  "utf8",
);

const migration0125Source = readFileSync(
  new URL("../../drizzle/0125_tw_household_revoked_conditional_metadata.sql", import.meta.url),
  "utf8",
);

const migration0126Source = readFileSync(
  new URL("../../drizzle/0126_tw_eligibility_4_document_requirements.sql", import.meta.url),
  "utf8",
);

const migration0127Source = readFileSync(
  new URL("../../drizzle/0127_tw_eligibility_3_document_requirements.sql", import.meta.url),
  "utf8",
);

const migration0128Source = readFileSync(
  new URL("../../drizzle/0128_tw_occupation_company_title_conditional_metadata.sql", import.meta.url),
  "utf8",
);

const migration0130Source = readFileSync(
  new URL("../../drizzle/0130_tw_identity_birthplace_parent_student_metadata.sql", import.meta.url),
  "utf8",
);

const migration0131Source = readFileSync(
  new URL("../../drizzle/0131_tw_birth_place_mainland_region_options.sql", import.meta.url),
  "utf8",
);

const twApplySource = readFileSync(
  new URL("../../../submission-service/src/tw/apply.ts", import.meta.url),
  "utf8",
);

const twNormalizeSource = readFileSync(
  new URL("../../../submission-service/src/tw/normalize.ts", import.meta.url),
  "utf8",
);

const haltRunnersSource = readFileSync(
  new URL("../../../submission-service/src/queue/halt-runners.ts", import.meta.url),
  "utf8",
);

const dynamicFormFieldSource = readFileSync(
  new URL("../../../../viza-fe/internal-website/components/dynamic-form-field.tsx", import.meta.url),
  "utf8",
);

const documentsActionsSource = readFileSync(
  new URL("../../../../viza-fe/internal-website/app/client/documents/actions.ts", import.meta.url),
  "utf8",
);

const visaFormFieldsActionSource = readFileSync(
  new URL("../../../../viza-fe/internal-website/app/actions/visa-form-fields.ts", import.meta.url),
  "utf8",
);

const visaFormSchemaAliasesSource = readFileSync(
  new URL("../../../../viza-fe/internal-website/lib/visa-form-schema-aliases.ts", import.meta.url),
  "utf8",
);

type FieldContract = {
  key: string;
  fieldType: string;
  required: boolean;
  domName: string;
  canonicalValues?: string[];
  officialValues?: string[];
  optionConst?: string;
  requiredWhen?: string;
};

const YES_NO_VALUES = ["no", "yes"];

const FIELD_CONTRACTS: FieldContract[] = [
  { key: "continent", fieldType: "select", required: true, domName: "continent", canonicalValues: ["A", "B", "C", "D", "E"], officialValues: ["A", "B", "C", "D", "E"], optionConst: "CONTINENTS" },
  { key: "embassy_office", fieldType: "select", required: true, domName: "overseaOfficeId", canonicalValues: ["50", "51", "5A", "5C", "5F", "55", "56", "53", "52", "67", "57", "58", "66", "54"], optionConst: "EMBASSY_OFFICES" },
  { key: "first_time_applying", fieldType: "radio", required: true, domName: "applyCaseExtendTemp.firstApplyFlag", canonicalValues: YES_NO_VALUES, officialValues: ["N", "Y"], optionConst: "YES_NO" },
  { key: "permit_type", fieldType: "radio", required: true, domName: "traveller.applyVisa", canonicalValues: ["1", "2", "H"], officialValues: ["1", "2", "H"] },
  { key: "permit_count", fieldType: "select", required: true, domName: "traveller.applyCnt", canonicalValues: ["1", "2"], officialValues: ["1", "2"] },
  { key: "has_other_nationality_passport", fieldType: "radio", required: true, domName: "traveller.othPassportFlag", canonicalValues: YES_NO_VALUES, officialValues: ["N", "Y"], optionConst: "YES_NO" },
  { key: "household_revoked", fieldType: "radio", required: false, domName: "householdRevoked", canonicalValues: YES_NO_VALUES, officialValues: ["N", "Y"], requiredWhen: "eligibility_category === 2 && embassy_office in [50, 51]" },
  { key: "eligibility_category", fieldType: "radio", required: true, domName: "traveller.applyQualification", canonicalValues: ["1", "2", "3", "4"], officialValues: ["4", "5", "6", "9"], optionConst: "ELIGIBILITY_CATEGORIES" },
  { key: "name_chinese", fieldType: "text", required: true, domName: "traveller.chineseName" },
  { key: "name_english", fieldType: "text", required: true, domName: "traveller.englishName" },
  { key: "date_of_birth", fieldType: "date", required: true, domName: "traveller.birthDate" },
  { key: "passport_number", fieldType: "text", required: true, domName: "traveller.passportNo" },
  { key: "passport_expiry_date", fieldType: "date", required: true, domName: "traveller.passportExpiryDate" },
  { key: "gender", fieldType: "select", required: true, domName: "traveller.gender", canonicalValues: ["0", "1"], officialValues: ["0", "1"] },
  { key: "overseas_residency_id_number", fieldType: "text", required: true, domName: "traveller.overseaIdNo" },
  { key: "mainland_id_number_not_applicable", fieldType: "checkbox", required: false, domName: "traveller.noPersonIdFlag", canonicalValues: ["true", "false"], officialValues: ["checked", "unchecked"] },
  { key: "mainland_id_number", fieldType: "text", required: true, domName: "traveller.personId", requiredWhen: "mainland_id_number_not_applicable === false" },
  { key: "birth_place_is_mainland", fieldType: "select", required: true, domName: "traveller.birthPlaceCode", canonicalValues: ["mainland", "other"], officialValues: ["1", "5"] },
  { key: "birth_place_other_country", fieldType: "select", required: true, domName: "traveller.birthPlace1", optionConst: "NATIONALITY_OPTIONS", requiredWhen: "birth_place_is_mainland === other" },
  { key: "local_mobile_phone", fieldType: "text", required: true, domName: "traveller.xtel" },
  { key: "current_occupation", fieldType: "select", required: true, domName: "traveller.occupation", optionConst: "OCCUPATIONS" },
  { key: "occupation_experience", fieldType: "textarea", required: true, domName: "traveller.resume", requiredWhen: "current_occupation === 62" },
  { key: "company_name", fieldType: "text", required: true, domName: "careersInformations[0].unitTitle", requiredWhen: "current_occupation not in [61,62]" },
  { key: "job_title", fieldType: "text", required: true, domName: "careersInformations[0].workTitle", requiredWhen: "current_occupation not in [14,61,62]" },
  { key: "is_taiwanese_spouse", fieldType: "select", required: true, domName: "traveller.partnerOfTaiwan", canonicalValues: YES_NO_VALUES, officialValues: ["N", "Y"], optionConst: "YES_NO" },
  { key: "traveling_with_parents", fieldType: "select", required: false, domName: "traveller.accompanyMark", canonicalValues: YES_NO_VALUES, officialValues: ["N", "Y"], optionConst: "YES_NO" },
  { key: "overseas_address", fieldType: "textarea", required: true, domName: "traveller.address" },
  { key: "tw_contact_city", fieldType: "select", required: true, domName: "traveller.city", canonicalValues: Array.from({ length: 22 }, (_, index) => String(index + 1)), optionConst: "TW_CITIES" },
  { key: "tw_contact_district", fieldType: "select", required: false, domName: "traveller.township", requiredWhen: "taiwan_districts_by_city" },
  { key: "tw_contact_village", fieldType: "text", required: false, domName: "traveller.village" },
  { key: "tw_contact_neighborhood", fieldType: "text", required: false, domName: "traveller.neighborhood" },
  { key: "tw_contact_road", fieldType: "text", required: true, domName: "traveller.road" },
  { key: "tw_contact_lane", fieldType: "text", required: false, domName: "traveller.lane" },
  { key: "tw_contact_alley", fieldType: "text", required: false, domName: "traveller.alley" },
  { key: "tw_contact_building_number", fieldType: "text", required: true, domName: "traveller.number" },
  { key: "tw_local_phone", fieldType: "text", required: false, domName: "traveller.twTelNo", requiredWhen: "tw_contact_mobile_not_applicable === true" },
  { key: "tw_contact_mobile_not_applicable", fieldType: "checkbox", required: false, domName: "traveller.noTwMobileFlag", canonicalValues: ["true", "false"], officialValues: ["checked", "unchecked"] },
  { key: "tw_contact_mobile", fieldType: "text", required: true, domName: "traveller.twMobile", requiredWhen: "tw_contact_mobile_not_applicable === false" },
  { key: "other_nationality_country", fieldType: "select", required: true, domName: "coaExtraPassportInfo.othNation", optionConst: "NATIONALITY_OPTIONS", requiredWhen: "has_other_nationality_passport === yes" },
  { key: "other_passport_number", fieldType: "text", required: true, domName: "coaExtraPassportInfo.othPassportNo", requiredWhen: "has_other_nationality_passport === yes" },
  { key: "other_passport_expiry_date", fieldType: "date", required: true, domName: "coaExtraPassportInfo.othPassportExpiryDate", requiredWhen: "has_other_nationality_passport === yes" },
  { key: "past_mainland_political_military_role", fieldType: "checkbox", required: false, domName: "traveller.beenCnPartyJob", canonicalValues: ["true", "false"] },
  { key: "past_role_detail", fieldType: "text", required: true, domName: "traveller.beenCnPartyJobDesc", requiredWhen: "past_mainland_political_military_role === true" },
  { key: "current_mainland_political_military_role", fieldType: "checkbox", required: false, domName: "traveller.cnPartyJob", canonicalValues: ["true", "false"] },
  { key: "current_role_detail", fieldType: "text", required: true, domName: "traveller.cnPartyJobDesc", requiredWhen: "current_mainland_political_military_role === true" },
  { key: "never_held_mainland_political_military_role", fieldType: "checkbox", required: false, domName: "traveller.neverCnPartyJob", canonicalValues: ["true", "false"] },
  { key: "accepted_terms", fieldType: "checkbox", required: true, domName: "agree", canonicalValues: ["true"], officialValues: ["checked"] },
];

const KINSHIP_GROUPS = ["father", "mother", "spouse", "child1", "child2"] as const;
const KINSHIP_FIELDS = [
  ["status", "select", "deadMark", ["1", "2", "3"]],
  ["name", "text", "chineseName"],
  ["date_of_birth", "date", "birthDate"],
  ["phone", "text", "telNo"],
  ["occupation", "select", "occupation"],
  ["service_unit", "text", "unitTitle"],
  ["job_title", "text", "workTitle"],
  ["current_address_same_as_overseas", "checkbox", "同申請人海外地址"],
  ["current_address", "textarea", "address"],
] as const;

const DOCUMENT_CONTRACTS = [
  { key: "photo", required: true, sortOrder: 10, condition: "always", labelZh: "照片上传" },
  { key: "mainland_travel_document", required: true, sortOrder: 20, condition: "always", labelZh: "大陆地区所发尚余6个月以上效期之旅行证件或香港、澳门政府核发之非永久性居民旅行证件" },
  { key: "eligibility_supporting_document_1", required: true, sortOrder: 30, condition: "eligibility_category === 1", labelZh: "申请资格证明文件（留学生）" },
  { key: "eligibility_supporting_document_2", required: true, sortOrder: 31, condition: "eligibility_category === 2", labelZh: "申请资格证明文件（永久居留权）" },
  { key: "eligibility_supporting_document_3", required: true, sortOrder: 32, condition: "eligibility_category === 3", labelZh: "申请资格证明文件（工作证明）" },
  { key: "eligibility_supporting_document_4", required: true, sortOrder: 33, condition: "eligibility_category === 4", labelZh: "申请资格证明文件（依亲居留权）" },
  { key: "hk_macau_id_scan", required: false, sortOrder: 40, condition: 'embassy_office in ["50","51"]', labelZh: "香港或澳门居民身份证（正、反面）及有效香港或澳门签证" },
  { key: "other_nationality_passport_scan", required: false, sortOrder: 50, condition: 'has_other_nationality_passport === "yes"', labelZh: "持有他国国籍护照（证）文件" },
  { key: "mainland_id_card_scan", required: false, sortOrder: 60, condition: 'mainland_id_number_not_applicable !== "true"', labelZh: "大陆身份证（正、反面）" },
  { key: "other_supporting_document", required: false, sortOrder: 70, condition: "optional/applicable", labelZh: "其他相关证明文件" },
];

const PRODUCTION_DOCUMENT_REQUIREMENT_KEYS = DOCUMENT_CONTRACTS.map((contract) => contract.key);
const ELIGIBILITY_DOCUMENT_REQUIREMENT_KEYS = [
  "eligibility_supporting_document_1",
  "eligibility_supporting_document_2",
  "eligibility_supporting_document_3",
  "eligibility_supporting_document_4",
] as const;

function fieldSnippet(fieldName: string): string {
  const start = seedSource.indexOf(`field_name: "${fieldName}"`);
  expect(start, `${fieldName} missing from TW seed`).toBeGreaterThanOrEqual(0);
  const next = seedSource.indexOf("\n  { field_name:", start + 1);
  const spread = seedSource.indexOf("\n  ...kinshipFields", start + 1);
  const endCandidates = [next, spread].filter((index) => index > start);
  const end = endCandidates.length ? Math.min(...endCandidates) : seedSource.indexOf("\n];", start);
  return seedSource.slice(start, end);
}

function migration0124FieldSnippet(fieldName: string): string {
  const marker = `'TW_ENTRY_PERMIT', '${fieldName}'`;
  const start = migration0124Source.indexOf(marker);
  expect(start, `${fieldName} missing from 0124 TW form-field sync`).toBeGreaterThanOrEqual(0);
  const next = migration0124Source.indexOf("\n    ('TW_ENTRY_PERMIT',", start + marker.length);
  const end = next > start ? next : migration0124Source.indexOf("\n),\nupserted", start);
  return migration0124Source.slice(start, end);
}

function migration0130FieldSnippet(fieldName: string): string {
  const marker = `'TW_ENTRY_PERMIT',\n      '${fieldName}'`;
  const start = migration0130Source.indexOf(marker);
  expect(start, `${fieldName} missing from 0130 TW metadata sync`).toBeGreaterThanOrEqual(0);
  const next = migration0130Source.indexOf("\n    ),\n    (", start + marker.length);
  const end = next > start ? next : migration0130Source.indexOf("\n    )\n),\nupserted", start);
  return migration0130Source.slice(start, end);
}

function expectFieldShape(contract: FieldContract): void {
  const snippet = fieldSnippet(contract.key);
  expect(snippet, `${contract.key} field type`).toContain(`field_type: "${contract.fieldType}"`);
  expect(snippet, `${contract.key} required flag`).toContain(`required: ${contract.required}`);
  if (contract.requiredWhen) {
    expect(snippet, `${contract.key} conditional logic`).toContain(contract.requiredWhen);
  }
  for (const value of contract.canonicalValues ?? []) {
    if (contract.optionConst) continue;
    if (contract.fieldType === "checkbox") continue;
    expect(snippet, `${contract.key} option ${value}`).toContain(`value: "${value}"`);
  }
}

function constBlock(name: string): string {
  const match = seedSource.match(new RegExp(`const ${name}[\\s\\S]*?= \\[([\\s\\S]*?)\\n\\];`));
  expect(match, `${name} option list missing`).not.toBeNull();
  return match?.[1] ?? "";
}

function valuesFromConst(name: string): string[] {
  return Array.from(constBlock(name).matchAll(/value:\s*"([^"]+)"/g), (match) => match[1]);
}

function textForConstValue(name: string, value: string): string {
  const pattern = new RegExp(`value:\\s*"${value}"[\\s\\S]*?text:\\s*"([^"]+)"`);
  const match = constBlock(name).match(pattern);
  expect(match, `${name} option ${value} missing`).not.toBeNull();
  return match?.[1] ?? "";
}

function mainlandBirthplaceOptionsFromSeed(): Array<Record<string, string>> {
  const match = seedSource.match(/const BIRTH_PLACE_MAINLAND_OPTIONS = \[([\s\S]*?)\n\]\.map/);
  expect(match, "BIRTH_PLACE_MAINLAND_OPTIONS labels missing").not.toBeNull();
  return Array.from(match?.[1].matchAll(/"([^"]+)"/g) ?? [], (labelMatch) => {
    const label = labelMatch[1];
    return { value: label, text: label, label_zh: label, official_label: label };
  });
}

function mainlandBirthplaceOptionsFromMigration0131(): Array<Record<string, string>> {
  const match = migration0131Source.match(/options = '(\[[\s\S]*?\])'::jsonb/);
  expect(match, "0131 options JSON missing").not.toBeNull();
  return JSON.parse(match?.[1] ?? "[]") as Array<Record<string, string>>;
}

function expectRunnerDomMapping(contract: FieldContract): void {
  if (contract.key === "household_revoked") {
    expect(twApplySource).toContain("isTwHouseholdRevokedRequiredFromAnswers(a)");
    expect(twApplySource).toContain('twPickRadioByValueStrict(page, "household_revoked", "householdRevoked"');
    return;
  }
  if (contract.key.startsWith("past_") || contract.key.startsWith("current_") || contract.key === "never_held_mainland_political_military_role") {
    expect(twApplySource, `${contract.key} DOM ${contract.domName}`).toContain(`"${contract.domName}"`);
    return;
  }
  expect(twApplySource, `${contract.key} DOM ${contract.domName}`).toContain(`${contract.key}: "${contract.domName}"`);
}

function expectMigrationUpdate(key: string, labelZh: string, required: boolean): void {
  const source = migration0122Source + "\n" + migration0123Source;
    expect(source).toMatch(new RegExp(`requirement_key = '${key}'|\\('${key}',`));
  expect(source).toContain(labelZh);
  if (migration0122Source.includes(`('${key}',`)) {
    expect(migration0122Source).toContain(`'${key}'`);
    expect(migration0122Source).toContain(required ? "true" : "false");
  }
}

function expect0123EligibilityInsertRow(
  key: (typeof ELIGIBILITY_DOCUMENT_REQUIREMENT_KEYS)[number],
  labelZh: string,
  required: boolean,
  sortOrder: number,
): void {
  const escapedLabel = labelZh.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  expect(migration0123Source).toMatch(
    new RegExp(`\\('${key}',\\s*'[^']+',\\s*'${escapedLabel}',\\s*'[^']+',\\s*${required},\\s*${sortOrder}\\)`),
  );
}

describe("Taiwan entry permit schema contract", () => {
  test("locks every VIZA answer key to field type, canonical value family, official DOM name, and required condition", () => {
    for (const contract of FIELD_CONTRACTS) {
      expectFieldShape(contract);
      expectRunnerDomMapping(contract);
    }

    for (const [optionConst, expectedValues] of [
      ["CONTINENTS", ["A", "B", "C", "D", "E"]],
      ["EMBASSY_OFFICES", ["50", "51", "5A", "5C", "5F", "55", "56", "53", "52", "67", "57", "58", "66", "54", "6A", "6B", "60", "61", "62", "64", "65", "70", "GP", "72", "63", "71", "73", "74"]],
      ["ELIGIBILITY_CATEGORIES", ["1", "2", "3", "4"]],
      ["KINSHIP_STATUS", ["1", "2", "3"]],
    ] as const) {
      expect(valuesFromConst(optionConst)).toEqual(expectedValues);
    }
    expect(seedSource).toContain("const BIRTH_PLACE_MAINLAND_OPTIONS = [");
    expect(seedSource).toContain('"湖南", "湖北", "四川", "上海"');
    expect(seedSource).toContain('"寧夏回族自治區", "內蒙古自治區", "新疆維吾爾自治區"');
    expect(seedSource).toContain('"西康", "西藏自治區", "福建", "廣東"');
    expect(valuesFromConst("OCCUPATIONS")).toEqual(expect.arrayContaining(["15", "16", "17", "62"]));
    expect(valuesFromConst("OCCUPATIONS")).toHaveLength(new Set(valuesFromConst("OCCUPATIONS")).size);
  });

  test("locks official enum translations that differ from VIZA canonical values", () => {
    expect(twApplySource).toContain('a.first_time_applying === "yes" ? "Y" : "N"');
    expect(twApplySource).toContain('a.has_other_nationality_passport === "yes" ? "Y" : "N"');
    expect(twApplySource).toContain("const householdRevokedValue = a.household_revoked === \"yes\"");
    expect(twApplySource).toContain("a.household_revoked === \"no\"");
    expect(twApplySource).toContain("isTwHouseholdRevokedRequiredFromAnswers(a)");
    expect(twApplySource).toContain('a.is_taiwanese_spouse === "yes" ? "Y" : "N"');
    expect(twApplySource).toContain('a.traveling_with_parents === "yes" ? "Y" : "N"');
    expect(twApplySource).toContain('const ELIGIBILITY_VALUE_FIX: Record<string, string> = {');
    expect(twApplySource).toContain('"1": "4"');
    expect(twApplySource).toContain('"2": "5"');
    expect(twApplySource).toContain('"3": "6"');
    expect(twApplySource).toContain('"4": "9"');
    expect(twApplySource).toContain('const BIRTH_PLACE_VALUE_FIX: Record<string, string> = { mainland: "1", other: "5" }');
    expect(twNormalizeSource).toContain('const ELIGIBILITY_CATEGORIES = new Set(["1", "2", "3", "4"])');
    expect(twNormalizeSource).toContain('const BIRTH_PLACE = new Set(["mainland", "other"])');
  });

  test("covers every dynamic condition that changes form fields before CAPTCHA", () => {
    for (const [fieldName, condition] of [
      ["birth_place_mainland_region", "birth_place_is_mainland === mainland"],
      ["mainland_id_number", "mainland_id_number_not_applicable === false"],
      ["birth_place_other_country", "birth_place_is_mainland === other"],
      ["occupation_experience", "current_occupation === 62"],
      ["company_name", "current_occupation not in [61,62]"],
      ["job_title", "current_occupation not in [14,61,62]"],
      ["tw_contact_mobile", "tw_contact_mobile_not_applicable === false"],
      ["other_nationality_country", "has_other_nationality_passport === yes"],
      ["other_passport_number", "has_other_nationality_passport === yes"],
      ["other_passport_expiry_date", "has_other_nationality_passport === yes"],
      ["past_role_detail", "past_mainland_political_military_role === true"],
      ["current_role_detail", "current_mainland_political_military_role === true"],
    ] as const) {
      expect(fieldSnippet(fieldName), `${fieldName} conditional`).toContain(condition);
    }

    expect(twNormalizeSource).toContain('if (birthPlace === "mainland")');
    expect(twNormalizeSource).toContain('requireEnum(a.birth_place_mainland_region, "birth_place_mainland_region", BIRTH_PLACE_MAINLAND_REGIONS)');
    expect(twNormalizeSource).toContain('requireStr(a.birth_place_other_country, "birth_place_other_country")');
    expect(twNormalizeSource).toContain('if (out.has_other_nationality_passport === "yes")');
    expect(twNormalizeSource).toContain('if (pastRole === "true")');
    expect(twNormalizeSource).toContain('if (currentRole === "true")');
    expect(twNormalizeSource).toContain('if (noMainlandId !== "true")');
    expect(twNormalizeSource).toContain('if (noTwMobile !== "true")');
  });

  test("locks the official place-of-birth branch contract and special identity codes", () => {
    expect(fieldSnippet("birth_place_is_mainland")).toContain('field_type: "select"');
    expect(fieldSnippet("birth_place_is_mainland")).toContain('official_dom_name: "traveller.birthPlaceCode"');
    expect(fieldSnippet("birth_place_is_mainland")).toContain('official_values: { mainland: "1", other: "5" }');
    expect(fieldSnippet("birth_place_is_mainland")).toContain('source: "BIRTH_PLACE_MAINLAND_OPTIONS"');
    expect(fieldSnippet("birth_place_is_mainland")).toContain('source: "NATIONALITY_OPTIONS"');

    expect(fieldSnippet("birth_place_mainland_region")).toContain('official_dom_name: "traveller.birthPlace1"');
    expect(fieldSnippet("birth_place_mainland_region")).toContain('source: "BIRTH_PLACE_MAINLAND_OPTIONS"');
    expect(fieldSnippet("birth_place_mainland_region")).toContain("birth_place_is_mainland === mainland");
    expect(fieldSnippet("birth_place_mainland_region")).toContain('required_when: "birth_place_is_mainland === mainland"');
    expect(fieldSnippet("birth_place_other_country")).toContain('official_dom_name: "traveller.birthPlace1"');
    expect(fieldSnippet("birth_place_other_country")).toContain('source: "NATIONALITY_OPTIONS"');
    expect(fieldSnippet("birth_place_other_country")).toContain("Do not replace Taiwan official numeric values with ISO alpha codes");

    expect(valuesFromConst("NATIONALITY_OPTIONS")).toEqual(expect.arrayContaining(["994", "995", "996", "997", "999"]));
    expect(textForConstValue("NATIONALITY_OPTIONS", "994")).toBe("無國籍-依1954年無國籍人士公約");
    expect(textForConstValue("NATIONALITY_OPTIONS", "995")).toBe("難民-依1954年難民公約所定義");
    expect(textForConstValue("NATIONALITY_OPTIONS", "996")).toBe("難民-非依1954年難民公約所定義");
    expect(textForConstValue("NATIONALITY_OPTIONS", "997")).toBe("無國籍-不屬於代碼994、995及996者");
    expect(textForConstValue("NATIONALITY_OPTIONS", "999")).toBe("無國籍");
  });

  test("locks live-audited Taiwan labels and required decisions in the seed contract", () => {
    expect(fieldSnippet("passport_number")).toContain("Passport / HK visa identity document / Macau travel document / mainland travel document number");
    expect(fieldSnippet("passport_expiry_date")).toContain("Passport / travel document validity expiry date (Gregorian calendar)");
    expect(fieldSnippet("overseas_residency_id_number")).toContain("Overseas Chinese residency identity number");
    expect(fieldSnippet("occupation_experience")).toContain("only supports the official retirement prompt");
    expect(fieldSnippet("company_name")).toContain("required: true");
    expect(fieldSnippet("company_name")).toContain("current_occupation not in [61,62]");
    expect(fieldSnippet("company_name")).toContain('student_school_name_required_when: "current_occupation === 14"');
    expect(fieldSnippet("company_name")).toContain('accepted_scripts_when_student: ["traditional_chinese", "english"]');
    expect(fieldSnippet("job_title")).toContain("required: true");
    expect(fieldSnippet("job_title")).toContain("current_occupation not in [14,61,62]");
    expect(valuesFromConst("OCCUPATIONS")).toEqual(expect.arrayContaining(["14", "61", "62"]));
    expect(seedSource).toContain('{ value: "14", text: "Student", label_zh: "学生" }');
    expect(seedSource).toContain('{ value: "61", text: "Unemployed / job-seeking", label_zh: "待业" }');
    expect(seedSource).toContain('{ value: "62", text: "Retired", label_zh: "退休" }');
    expect(fieldSnippet("tw_contact_road")).toContain("Street or road section");
    expect(fieldSnippet("tw_contact_building_number")).toContain("House number / floor / room number");
    expect(fieldSnippet("other_passport_number")).toContain("Other country's passport/document number");
    expect(fieldSnippet("past_mainland_political_military_role")).toContain("politically affiliated organ/organization/group");
    expect(fieldSnippet("never_held_mainland_political_military_role")).toContain("Applicant has never held such");

    expect(seedSource).toContain('const isParent = group === "father" || group === "mother"');
    expect(seedSource).toContain("const statusRequired = isParent ? true : requiredGroup");
    expect(seedSource).toContain("field_name: `kin_${group}_status`");
    expect(seedSource).toContain("required: statusRequired");
    expect(seedSource).toContain("field_name: `kin_${group}_name`");
    expect(seedSource).toContain("field_name: `kin_${group}_date_of_birth`");
    expect(seedSource).toContain("field_name: `kin_${group}_phone`");
    expect(seedSource).toContain("field_name: `kin_${group}_current_address`");
    expect(seedSource).toContain('label: `${labelZh} — Name`, field_type: "text", required: isParent');
    expect(seedSource).toContain('label: `${labelZh} — Date of birth`, field_type: "date", required: isParent');
    expect(seedSource).toContain('label: `${labelZh} — Phone`, field_type: "text", required: isParent');
    expect(seedSource).toContain('label: `${labelZh} — Occupation`, field_type: "select", required: isParent');
    expect(seedSource).toContain('label: `${labelZh} — Current address`, field_type: "textarea", required: isParent');
    expect(seedSource).toContain('const parentLivingCondition = `kin_${group}_status === 1`');
    expect(seedSource).toContain('const parentAddressCondition = `${parentLivingCondition} && kin_${group}_current_address_same_as_overseas === false`');
    expect(seedSource).toContain('const parentServiceUnitTitleCondition = `${parentLivingCondition} && kin_${group}_occupation not in [15,16,17]`');
    expect(seedSource).toContain('required_when: parentLivingCondition');
    expect(seedSource).toContain('required_when: parentAddressCondition');
    expect(seedSource).toContain('required_when: parentServiceUnitTitleCondition');
    expect(seedSource).toContain('occupation_codes_not_required: ["15", "16", "17"]');
    expect(seedSource).toContain('retired_code_requires_prior_detail: "62"');
  });

  test("covers name normalization, dates, address fields, and all kinship field families", () => {
    expect(fieldSnippet("name_chinese")).toContain('official_dom_name: "traveller.chineseName"');
    expect(fieldSnippet("name_chinese")).toContain("requires_traditional_chinese_name: true");
    expect(fieldSnippet("name_chinese")).toContain("disallow_latin_only: true");
    expect(fieldSnippet("name_chinese")).toContain("disallow_latin_replacement: true");
    expect(fieldSnippet("name_chinese")).toContain("real Chinese name in Traditional Chinese characters");
    expect(dynamicFormFieldSource).toContain('const isTwUppercaseNameField = field.fieldName === "name_english"');
    expect(dynamicFormFieldSource).toContain("nextValue = nextValue.toUpperCase()");
    expect(dynamicFormFieldSource).toContain('const isTwChineseNameField = field.fieldName === "name_chinese"');
    expect(dynamicFormFieldSource).toContain("convertSimplifiedToTraditional(value)");
    expect(twNormalizeSource).toContain('requireStr(a.name_english, "name_english").toUpperCase()');
    expect(twNormalizeSource).toContain("toIsoDate");
    expect(twApplySource).toContain("twFillDateByName");

    for (const group of KINSHIP_GROUPS) {
      expect(seedSource).toContain(`...kinshipFields("${group}"`);
      for (const [suffix, fieldType, domName, values] of KINSHIP_FIELDS) {
        expect(seedSource).toContain(`kin_${"${group}"}_${suffix}`);
        expect(seedSource).toContain(`field_type: "${fieldType}"`);
        if (domName.startsWith("同")) {
          expect(twApplySource).toContain(domName);
        } else {
          expect(twApplySource).toContain(`${suffix}: "${domName}"`);
        }
        for (const value of values ?? []) {
          expect(seedSource).toContain(`value: "${value}"`);
        }
      }
    }
    expect(twApplySource).toContain("father: 0");
    expect(twApplySource).toContain("mother: 1");
    expect(twApplySource).toContain("spouse: 2");
    expect(twApplySource).toContain("child1: 3");
    expect(twApplySource).toContain("child2: 4");
  });

  test("keeps file uploads out of visa_form_fields and locks document_requirements after 0123", () => {
    for (const fileField of [
      "photo",
      "photo_upload",
      "mainland_travel_document",
      "eligibility_supporting_document",
      "hk_macau_id_scan",
      "other_nationality_passport_scan",
      "mainland_id_card_scan",
      "other_supporting_document",
    ]) {
      expect(seedSource, `${fileField} should not be a visa_form_fields row`).not.toContain(`field_name: "${fileField}"`);
    }

    expect(migration0123Source).toContain("DELETE FROM document_requirements");
    expect(migration0123Source).toContain("requirement_key = 'eligibility_supporting_document'");
    for (const requirement of DOCUMENT_CONTRACTS) {
      expectMigrationUpdate(requirement.key, requirement.labelZh, requirement.required);
      expect(migration0122Source + migration0123Source).toContain(String(requirement.sortOrder));
    }
    expect(migration0123Source).toContain("eligibility_supporting_document_1");
    expect(migration0123Source).toContain("eligibility_supporting_document_2");
    expect(migration0123Source).toContain("eligibility_supporting_document_3");
    expect(migration0123Source).toContain("eligibility_supporting_document_4");
    expect(documentsActionsSource).toContain("`eligibility_supporting_document_${eligibilityCategory}`");
  });

  test("locks the production document_requirements contract to exactly 10 Taiwan rows", () => {
    expect(PRODUCTION_DOCUMENT_REQUIREMENT_KEYS).toHaveLength(10);
    expect(new Set(PRODUCTION_DOCUMENT_REQUIREMENT_KEYS).size).toBe(10);
    expect(PRODUCTION_DOCUMENT_REQUIREMENT_KEYS).toEqual([
      "photo",
      "mainland_travel_document",
      ...ELIGIBILITY_DOCUMENT_REQUIREMENT_KEYS,
      "hk_macau_id_scan",
      "other_nationality_passport_scan",
      "mainland_id_card_scan",
      "other_supporting_document",
    ]);

    expect(migration0123Source).toContain("requirement_key = 'eligibility_supporting_document'");
    expect(migration0123Source).toContain("DELETE FROM document_requirements");
    expectMigrationUpdate("photo", "照片上传", true);
    expectMigrationUpdate(
      "mainland_travel_document",
      "大陆地区所发尚余6个月以上效期之旅行证件或香港、澳门政府核发之非永久性居民旅行证件",
      true,
    );
    expectMigrationUpdate("hk_macau_id_scan", "香港或澳门居民身份证（正、反面）及有效香港或澳门签证", false);
    expectMigrationUpdate("other_nationality_passport_scan", "持有他国国籍护照（证）文件", false);
    expectMigrationUpdate("mainland_id_card_scan", "大陆身份证（正、反面）", false);
    expectMigrationUpdate("other_supporting_document", "其他相关证明文件", false);

    for (const requirement of DOCUMENT_CONTRACTS) {
      expect(migration0122Source + migration0123Source).toContain(String(requirement.sortOrder));
      expect(migration0122Source + migration0123Source).toContain(requirement.labelZh);
    }
    expect0123EligibilityInsertRow("eligibility_supporting_document_1", "申请资格证明文件（留学生）", true, 30);
    expect0123EligibilityInsertRow("eligibility_supporting_document_2", "申请资格证明文件（永久居留权）", true, 31);
    expect0123EligibilityInsertRow("eligibility_supporting_document_3", "申请资格证明文件（工作证明）", true, 32);
    expect0123EligibilityInsertRow("eligibility_supporting_document_4", "申请资格证明文件（依亲居留权）", true, 33);

    expect(haltRunnersSource).not.toContain('requiredDocMissing("eligibility_supporting_document"');
    expect(haltRunnersSource).not.toContain('documentPaths.get("eligibility_supporting_document")');
    expect(documentsActionsSource).not.toContain('requirement.key === "eligibility_supporting_document"');
  });

  test("locks runner-required material conditions for CAPTCHA-bound automation", () => {
    expect(haltRunnersSource).toContain('requiredDocMissing("photo", true)');
    expect(haltRunnersSource).toContain('const eligibilityDocKey = `eligibility_supporting_document_${answers.eligibility_category}`');
    expect(haltRunnersSource).toContain('requiredDocMissing("mainland_travel_document", true)');
    expect(haltRunnersSource).toContain("requiredDocMissing(eligibilityDocKey, true)");
    expect(haltRunnersSource).toContain('requiredDocMissing("hk_macau_id_scan", HK_MACAU_EMBASSY_OFFICE_VALUES.has(answers.embassy_office))');
    expect(haltRunnersSource).toContain('requiredDocMissing("other_nationality_passport_scan", answers.has_other_nationality_passport === "yes")');
    expect(haltRunnersSource).toContain('answers.eligibility_category === "4" || answers.mainland_id_number_not_applicable !== "true"');
    expect(twApplySource).toContain("MAINLAND_TRAVEL_DOCUMENT_DESCRIPTION");
    expect(twApplySource).toContain("ELIGIBILITY_PROOF_DESCRIPTION");
    expect(twApplySource).toContain("HK_MACAU_ID_DESCRIPTION");
    expect(twApplySource).toContain("OTHER_NATIONALITY_PASSPORT_DOC_DESCRIPTION");
    expect(twApplySource).toContain("MAINLAND_ID_CARD_DOC_DESCRIPTION");
    expect(twApplySource).toContain("OTHER_SUPPORTING_DOC_DESCRIPTION");
    expect(twApplySource).toContain('a.eligibility_category === "4" || a.mainland_id_number_not_applicable !== "true"');
  });

  test("prepares an idempotent eligibility 4 document requirement sync without touching applicant data", () => {
    expect(migration0126Source).toContain("country = 'taiwan'");
    expect(migration0126Source).toContain("visa_type = 'TW_ENTRY_PERMIT'");
    expect(migration0126Source).toContain("ON CONFLICT (visa_package_id, requirement_key)");
    expect(migration0126Source).not.toMatch(/UPDATE\\s+public\\.application_documents/i);
    expect(migration0126Source).not.toMatch(/UPDATE\\s+public\\.visa_application_answers/i);
    expect(migration0126Source).not.toMatch(/DELETE\\s+FROM/i);
    expect(migration0126Source).toContain("mainland_travel_document");
    expect(migration0126Source).toContain("eligibility_supporting_document_4");
    expect(migration0126Source).toContain("mainland_id_card_scan");
    expect(migration0126Source).toContain("hk_macau_id_scan");
    expect(migration0126Source).toContain("other_nationality_passport_scan");
    expect(migration0126Source).toContain("other_supporting_document");
    expect(migration0126Source).toContain("official_eligibility_4_attachment_screenshot_2026_08_03");
    expect(migration0126Source).toContain("大陆身份证（正、反面）");
    expect(migration0126Source).toContain("若无要求则免附；申请人如旅居日本，请上传3个月内住民票");
  });

  test("prepares an idempotent eligibility 3 document requirement sync from the official attachment table", () => {
    expect(migration0127Source).toContain("country = 'taiwan'");
    expect(migration0127Source).toContain("visa_type = 'TW_ENTRY_PERMIT'");
    expect(migration0127Source).toContain("ON CONFLICT (visa_package_id, requirement_key)");
    expect(migration0127Source).not.toMatch(/UPDATE\s+public\.application_documents/i);
    expect(migration0127Source).not.toMatch(/UPDATE\s+public\.visa_application_answers/i);
    expect(migration0127Source).not.toMatch(/DELETE\s+FROM/i);
    expect(migration0127Source).not.toMatch(/\(\s*'eligibility_supporting_document'\s*,/);

    expect(migration0127Source).toContain("mainland_travel_document");
    expect(migration0127Source).toContain("eligibility_supporting_document_3");
    expect(migration0127Source).toContain("mainland_id_card_scan");
    expect(migration0127Source).toContain("hk_macau_id_scan");
    expect(migration0127Source).toContain("other_nationality_passport_scan");
    expect(migration0127Source).toContain("other_supporting_document");
    expect(migration0127Source).toContain("official_eligibility_3_attachment_screenshot_2026_08_03");

    expect(migration0127Source).toContain("有现住地出入境查验章戳之护照内页、工作签证及3个月内公司在职证明");
    expect(migration0127Source).toContain("旅居香港或澳门之申请人须附香港或澳门居民身份证");
    expect(migration0127Source).toContain("若无要求则免附；申请人如旅居日本，请上传3个月内住民票");
    expect(migration0127Source).toContain("大陆身份证（正、反面）");
    expect(migration0127Source).toContain('"required_when":"eligibility_category is 3"');
  });

  test("locks the Taiwan long-form data/API contract so form steps cannot silently resolve empty", () => {
    expect(migration0122Source).toContain("WHERE vp.country = 'taiwan' AND vp.visa_type = 'TW_ENTRY_PERMIT'");
    expect(migration0123Source).toContain("WHERE vp.country = 'taiwan' AND vp.visa_type = 'TW_ENTRY_PERMIT'");
    expect(migration0003Source).toContain('CREATE POLICY "visa_form_fields_read" ON "visa_form_fields"');
    expect(migration0003Source).toContain("FOR SELECT USING (true)");
    expect(migration0006Source).toContain('CREATE POLICY "visa_packages_select" ON visa_packages');
    expect(migration0006Source).toContain("FOR SELECT TO authenticated");

    const fieldRows = Array.from(seedSource.matchAll(/field_name:\s*"([^"]+)"/g), (match) => match[1]);
    expect(fieldRows.length).toBeGreaterThanOrEqual(40);
    expect(fieldRows.slice(0, 2)).toEqual(["continent", "embassy_office"]);
    expect(fieldRows).toContain("household_revoked");
    expect(seedSource).toContain('...kinshipFields("father", "Father (父)", 5, false, 1)');
    expect(seedSource).toContain('...kinshipFields("mother", "Mother (母)", 5, false, 20)');
    expect(seedSource).toContain('...kinshipFields("spouse", "Spouse (配偶)", 5, false, 40)');
    expect(seedSource).toContain('...kinshipFields("child1", "Child 1 (子女)", 5, false, 60)');
    expect(seedSource).toContain('...kinshipFields("child2", "Child 2 (子女)", 5, false, 80)');

    expect(visaFormFieldsActionSource).toContain('const schemaVisaType = resolveVisaFormSchemaVisaType(visaType, options.country)');
    expect(visaFormFieldsActionSource).toContain('.from("visa_form_fields")');
    expect(visaFormFieldsActionSource).toContain('.eq("visa_type", schemaVisaType)');
    expect(visaFormFieldsActionSource).toContain('.order("step_number", { ascending: true })');
    expect(visaFormFieldsActionSource).toContain('.order("display_order", { ascending: true })');
    expect(visaFormFieldsActionSource).not.toContain('.eq("country"');

    expect(visaFormSchemaAliasesSource).not.toContain("TW_ENTRY_PERMIT");
    expect(visaFormSchemaAliasesSource).toContain("return visaType");
  });

  test("prepares a safe idempotent production metadata sync for stale Taiwan form fields", () => {
    expect(migration0124Source).toContain("ON CONFLICT (visa_type, field_name) DO UPDATE SET");
    expect(migration0124Source).toContain("WHERE visa_type = 'TW_ENTRY_PERMIT'");
    expect(migration0124Source).toContain("Inserts household_revoked if it is still missing.");
    expect(migration0124Source).not.toContain("DELETE FROM");
    expect(migration0124Source).not.toContain("visa_application_answers");
    expect(migration0124Source).not.toContain("application_documents");
    expect(migration0124Source).not.toContain("document_requirements");
    expect(migration0124Source).not.toContain("'B211A'");

    const syncedFields = Array.from(
      migration0124Source.matchAll(/\('TW_ENTRY_PERMIT', '([^']+)'/g),
      (match) => match[1],
    );
    expect(syncedFields).toHaveLength(28);
    expect(new Set(syncedFields).size).toBe(syncedFields.length);

    for (const fieldName of [
      "household_revoked",
      "tw_contact_district",
      "tw_local_phone",
      "mainland_id_number",
      "company_name",
      "job_title",
      "kin_father_status",
      "kin_mother_status",
    ]) {
      expect(syncedFields).toContain(fieldName);
    }

    expect(migration0124FieldSnippet("household_revoked")).toContain("'radio', true");
    expect(migration0124FieldSnippet("tw_contact_district")).toContain("'select', false");
    expect(migration0124FieldSnippet("tw_contact_district")).toContain('"dependent_options_key":"taiwan_districts_by_city"');
    expect(migration0124FieldSnippet("tw_local_phone")).toContain('"required_when":"tw_contact_mobile_not_applicable === true"');
    expect(migration0124FieldSnippet("mainland_id_number")).toContain("'text', true");
    expect(migration0124FieldSnippet("company_name")).toContain("'text', true");
    expect(migration0124FieldSnippet("job_title")).toContain("'text', true");
    expect(migration0124FieldSnippet("kin_father_status")).toContain("'select', true");
    expect(migration0124FieldSnippet("kin_mother_status")).toContain("'select', true");
  });

  test("prepares household_revoked conditional metadata correction after live DOM recheck", () => {
    expect(migration0125Source).toContain("ON CONFLICT (visa_type, field_name) DO UPDATE SET");
    expect(migration0125Source).toContain("WHERE visa_type = 'TW_ENTRY_PERMIT'");
    expect(migration0125Source).toContain("field_name = 'household_revoked'");
    expect(migration0125Source).toContain("eligibility_category === 2 && embassy_office in [50, 51]");
    expect(migration0125Source).not.toContain("DELETE FROM");
    expect(migration0125Source).not.toContain("visa_application_answers");
    expect(migration0125Source).not.toContain("application_documents");
    expect(migration0125Source).not.toContain("runner_job");
    expect(migration0125Source).not.toContain("'B211A'");
    expect(migration0125Source).toContain("'radio',\n      false");
    expect(seedSource).toContain('required_when: "eligibility_category === 2 && embassy_office in [50, 51]"');
    expect(seedSource).toContain('conditional_logic: { showIf: "eligibility_category === 2 && embassy_office in [50, 51]" }');
  });

  test("prepares occupation-dependent company/title metadata correction without touching applicant data", () => {
    expect(migration0128Source).toContain("ON CONFLICT (visa_type, field_name) DO UPDATE SET");
    expect(migration0128Source).toContain("WHERE visa_type = 'TW_ENTRY_PERMIT'");
    expect(migration0128Source).toContain("field_name IN ('company_name', 'job_title')");
    expect(migration0128Source).toContain("student = 14");
    expect(migration0128Source).toContain("unemployed/job-seeking = 61");
    expect(migration0128Source).toContain("retired = 62");
    expect(migration0128Source).not.toContain("DELETE FROM");
    expect(migration0128Source).not.toMatch(/UPDATE\s+public\.visa_application_answers/i);
    expect(migration0128Source).not.toMatch(/UPDATE\s+public\.application_documents/i);
    expect(migration0128Source).not.toMatch(/INSERT\s+INTO\s+public\.runner_job/i);
    expect(migration0128Source).not.toContain("'B211A'");
    expect(migration0128Source).toContain("current_occupation not in [61,62]");
    expect(migration0128Source).toContain("current_occupation not in [14,61,62]");
    expect(seedSource).toContain('conditional_logic: { showIf: "current_occupation not in [61,62]" }');
    expect(seedSource).toContain('conditional_logic: { showIf: "current_occupation not in [14,61,62]" }');
  });

  test("prepares identity, mainland birthplace, parent, and student metadata sync without touching non-metadata tables", () => {
    expect(migration0130Source).toContain("ON CONFLICT (visa_type, field_name) DO UPDATE SET");
    expect(migration0130Source).toContain("WHERE visa_type = 'TW_ENTRY_PERMIT'");
    expect(migration0130Source).toContain("tw_identity_birthplace_parent_student_metadata_rows_upserted");
    expect(migration0130Source).not.toContain("DELETE FROM");
    expect(migration0130Source).not.toMatch(/UPDATE\s+public\.visa_application_answers/i);
    expect(migration0130Source).not.toMatch(/UPDATE\s+public\.application_documents/i);
    expect(migration0130Source).not.toMatch(/INSERT\s+INTO\s+public\.runner_job/i);
    expect(migration0130Source).not.toContain("document_requirements");
    expect(migration0130Source).not.toContain("'B211A'");
    expect(migration0130Source).toContain("Pre-flight verification SQL");
    expect(migration0130Source).toContain("Post-flight verification SQL");
    expect(migration0130Source).toContain("Rollback SQL");

    const syncedFields = Array.from(
      migration0130Source.matchAll(/'TW_ENTRY_PERMIT',\n\s+'([^']+)'/g),
      (match) => match[1],
    );
    expect(syncedFields).toHaveLength(19);
    expect(new Set(syncedFields).size).toBe(syncedFields.length);
    expect(syncedFields).toEqual([
      "name_chinese",
      "birth_place_mainland_region",
      "company_name",
      "kin_father_name",
      "kin_father_date_of_birth",
      "kin_father_phone",
      "kin_father_occupation",
      "kin_father_service_unit",
      "kin_father_job_title",
      "kin_father_current_address_same_as_overseas",
      "kin_father_current_address",
      "kin_mother_name",
      "kin_mother_date_of_birth",
      "kin_mother_phone",
      "kin_mother_occupation",
      "kin_mother_service_unit",
      "kin_mother_job_title",
      "kin_mother_current_address_same_as_overseas",
      "kin_mother_current_address",
    ]);

    expect(migration0130FieldSnippet("name_chinese")).toContain('"requires_traditional_chinese_name":true');
    expect(migration0130FieldSnippet("name_chinese")).toContain('"disallow_latin_only":true');
    expect(migration0130FieldSnippet("name_chinese")).toContain('"disallow_latin_replacement":true');
    expect(migration0130FieldSnippet("birth_place_mainland_region")).toContain('"required_when":"birth_place_is_mainland === mainland"');
    expect(migration0130FieldSnippet("birth_place_mainland_region")).toContain('"showIf":"birth_place_is_mainland === mainland"');
    expect(migration0130FieldSnippet("company_name")).toContain('"student_school_name_required_when":"current_occupation === 14"');
    expect(migration0130FieldSnippet("company_name")).toContain('"accepted_scripts_when_student":["traditional_chinese","english"]');
    expect(migration0130FieldSnippet("company_name")).toContain('"required_when":"current_occupation not in [61,62]"');

    for (const parent of ["father", "mother"] as const) {
      for (const suffix of ["name", "date_of_birth", "phone", "occupation"] as const) {
        expect(migration0130FieldSnippet(`kin_${parent}_${suffix}`)).toContain(
          `"required_when":"kin_${parent}_status === 1"`,
        );
        expect(migration0130FieldSnippet(`kin_${parent}_${suffix}`)).toContain(
          `"showIf":"kin_${parent}_status === 1"`,
        );
      }
      for (const suffix of ["service_unit", "job_title"] as const) {
        expect(migration0130FieldSnippet(`kin_${parent}_${suffix}`)).toContain(
          `"required_when":"kin_${parent}_status === 1 && kin_${parent}_occupation not in [15,16,17]"`,
        );
        expect(migration0130FieldSnippet(`kin_${parent}_${suffix}`)).toContain(
          '"occupation_codes_not_required":["15","16","17"]',
        );
        expect(migration0130FieldSnippet(`kin_${parent}_${suffix}`)).toContain('"retired_code_requires_prior_detail":"62"');
      }
      expect(migration0130FieldSnippet(`kin_${parent}_current_address_same_as_overseas`)).toContain(
        `"showIf":"kin_${parent}_status === 1"`,
      );
      expect(migration0130FieldSnippet(`kin_${parent}_current_address`)).toContain(
        `"required_when":"kin_${parent}_status === 1 && kin_${parent}_current_address_same_as_overseas === false"`,
      );
    }
  });

  test("prepares mainland birthplace option backfill from the seed canonical set only", () => {
    const seedOptions = mainlandBirthplaceOptionsFromSeed();
    const migrationOptions = mainlandBirthplaceOptionsFromMigration0131();

    expect(migration0131Source).toContain("UPDATE public.visa_form_fields");
    expect(migration0131Source).toContain("visa_type = 'TW_ENTRY_PERMIT'");
    expect(migration0131Source).toContain("field_name = 'birth_place_mainland_region'");
    expect(migration0131Source).not.toContain("INSERT INTO");
    expect(migration0131Source).not.toContain("DELETE FROM");
    expect(migration0131Source).not.toMatch(/UPDATE\s+public\.visa_application_answers/i);
    expect(migration0131Source).not.toMatch(/UPDATE\s+public\.application_documents/i);
    expect(migration0131Source).not.toMatch(/INSERT\s+INTO\s+public\.runner_job/i);
    expect(migration0131Source).not.toContain("document_requirements");

    expect(seedOptions).toHaveLength(49);
    expect(migrationOptions).toEqual(seedOptions);
    expect(migrationOptions).toContainEqual({
      value: "北京",
      text: "北京",
      label_zh: "北京",
      official_label: "北京",
    });
    expect(migrationOptions.map((option) => option.value)).toHaveLength(
      new Set(migrationOptions.map((option) => option.value)).size,
    );
    expect(fieldSnippet("birth_place_mainland_region")).toContain('official_dom_name: "traveller.birthPlace1"');
    expect(fieldSnippet("birth_place_mainland_region")).toContain('source: "BIRTH_PLACE_MAINLAND_OPTIONS"');
  });
});
