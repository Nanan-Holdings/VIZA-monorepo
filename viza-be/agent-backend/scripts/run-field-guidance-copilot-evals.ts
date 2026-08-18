/**
 * Exhaustive field guidance copilot evaluations.
 *
 * This script loads every row in visa_form_fields and exercises POST
 * /api/field-guidance with deterministic AI/RAG-free behavior by default.
 */

import supertest from "supertest";
import { getSupabaseClient } from "../src/db/supabase-client.js";

process.env.FIELD_GUIDANCE_EVAL_DISABLE_RETRIEVAL ??= "1";
if (process.env.FIELD_GUIDANCE_EVAL_USE_AI !== "1") {
  process.env.OPENAI_API_KEY = "";
}

type Locale = "zh" | "en";
type Severity = "ok" | "warning" | "error";
type FieldType =
  | "text"
  | "email"
  | "tel"
  | "number"
  | "select"
  | "multi_select"
  | "date"
  | "file"
  | "radio"
  | "checkbox"
  | "textarea"
  | "country";

interface DbFieldRow {
  id: string;
  visa_type: string;
  field_name: string;
  label: string;
  field_type: FieldType;
  required: boolean;
  step_number: number;
  step_name: string | null;
  display_order: number;
  placeholder: string | null;
  validation_rules: Record<string, unknown> | null;
  options: unknown | null;
  conditional_logic: Record<string, unknown> | null;
}

interface FieldOption {
  value: string;
  text: string;
}

interface ApiField {
  fieldName: string;
  label: string;
  fieldType: FieldType;
  required: boolean;
  stepName?: string | null;
  placeholder?: string | null;
  options?: Array<FieldOption | string> | null;
  validationRules?: Record<string, unknown> | null;
  conditionalLogic?: Record<string, unknown> | null;
}

interface GuidanceResponse {
  guidance?: {
    title?: string;
    summary?: string;
    examples?: string[];
    hints?: string[];
    officialWarnings?: string[];
    formatHints?: string[];
  };
  validation?: {
    severity?: Severity;
    messages?: string[];
  };
  reply?: string;
  sources?: Array<{ title?: string; url?: string | null; excerpt?: string }>;
  confidence?: "high" | "medium" | "low";
  aiUsed?: boolean;
  cached?: boolean;
  error?: string;
}

interface EvalCase {
  name: string;
  locale: Locale;
  field: DbFieldRow;
  answer: string;
  allAnswers: Record<string, string>;
  question?: string;
  expectedSeverity?: Exclude<Severity, "ok">;
  expectNoExamples?: boolean;
  expectedSummaryPattern?: RegExp;
  forbiddenGuidancePattern?: RegExp;
}

interface EvalFailure {
  caseName: string;
  visaType: string;
  fieldName: string;
  message: string;
  details?: unknown;
}

interface EvalCounters {
  totalCases: number;
  guidanceCases: number;
  invalidCases: number;
  crossFieldCases: number;
  countryAuditCases: number;
  fields: number;
  visaTypes: Record<string, number>;
}

const MARKDOWN_PATTERN = /```|`|\*\*|__|\[[^\]]+\]\([^)]+\)|(^|\s)#{1,6}\s/m;
const BAD_TEXT_PATTERN = /\bundefined\b|\bnull\b|<script\b|<\/?[a-z][\s\S]*>/i;
const CHOICE_FIELD_TYPES = new Set<FieldType>(["select", "multi_select", "country", "radio", "checkbox"]);
const MISLEADING_CHOICE_EXAMPLE_PATTERN = /请按护照、身份证明或官方文件上的原文填写|use the (?:exact )?wording (?:exactly )?as shown on your passport|use the exact wording from your official document/i;
const DATE_FORMAT_EXAMPLES: Readonly<Record<string, string>> = {
  "YYYY-MM-DD": "2026-09-15",
  "DD/MM/YYYY": "15/09/2026",
  "YYYY/MM/DD": "2026/09/15",
  "DD-MMM-YYYY": "15-SEP-2026",
  YYYYMMDD: "20260915",
  "MM-YYYY": "09-2026",
  "MM/YYYY": "09/2026",
  YYYY: "2026",
};
const CONCURRENCY = Number(process.env.FIELD_GUIDANCE_EVAL_CONCURRENCY ?? 16);
const SYNTHETIC_ONLY = process.env.FIELD_GUIDANCE_EVAL_SYNTHETIC_ONLY === "1";

function includesAnyText(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numericValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeOptions(value: unknown): Array<FieldOption | string> | null {
  if (!Array.isArray(value)) return null;
  const options = value
    .map((option) => {
      if (typeof option === "string") return option;
      if (!isRecord(option)) return null;
      const optionValue = stringValue(option.value);
      const optionText = stringValue(option.text) ?? optionValue;
      return optionValue ? { value: optionValue, text: optionText ?? optionValue } : null;
    })
    .filter((option): option is FieldOption | string => Boolean(option));

  return options.length > 0 ? options : null;
}

function boundedEvalOptions(value: unknown): Array<FieldOption | string> | null {
  const options = normalizeOptions(value);
  if (!options) return null;
  const bounded: Array<FieldOption | string> = [];
  let bytes = 2;
  for (const option of options.slice(0, 120)) {
    const nextBytes = JSON.stringify(option).length + 1;
    if (bounded.length > 0 && bytes + nextBytes > 320_000) break;
    bounded.push(option);
    bytes += nextBytes;
  }
  return bounded.length > 0 ? bounded : null;
}

function compactEvalRules(rules: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!rules) return null;
  const compact: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rules)) {
    if (["string", "number", "boolean"].includes(typeof value) || value === null) {
      compact[key] = value;
      continue;
    }
    if (Array.isArray(value) && value.length <= 40 && value.every((item) =>
      ["string", "number", "boolean"].includes(typeof item) || item === null)) {
      compact[key] = value;
    }
  }
  return compact;
}

function toApiField(field: DbFieldRow): ApiField {
  return {
    fieldName: field.field_name,
    label: field.label,
    fieldType: field.field_type,
    required: field.required,
    stepName: field.step_name,
    placeholder: field.placeholder,
    // The production Next.js proxy sends only a relevance-ranked option
    // context. Keep the exhaustive DB audit on the same bounded contract so a
    // single country-wide administrative list cannot exceed the API body cap.
    options: boundedEvalOptions(field.options),
    validationRules: compactEvalRules(field.validation_rules),
    conditionalLogic: field.conditional_logic,
  };
}

function firstOption(field: DbFieldRow): string | null {
  const options = normalizeOptions(field.options);
  if (!options?.length) return null;
  const first = options[0];
  return typeof first === "string" ? first : first.value || first.text;
}

function fieldText(field: DbFieldRow): string {
  return `${field.field_name} ${field.label} ${field.placeholder ?? ""}`.toLowerCase();
}

function sampleAnswer(field: DbFieldRow): string {
  const text = fieldText(field);
  const option = firstOption(field);

  if (CHOICE_FIELD_TYPES.has(field.field_type)) {
    return option ?? "yes";
  }
  if (field.field_type === "country") return "China";
  if (field.field_type === "file") return "uploaded-document.pdf";
  if (field.field_type === "date" || text.includes("date")) {
    if (text.includes("birth") || text.includes("dob")) return "15/03/1990";
    if (text.includes("issue")) return "01/01/2020";
    if (text.includes("expir") || text.includes("valid until")) return "01/01/2032";
    if (text.includes("arrival") || text.includes("entry")) return "01/06/2026";
    if (text.includes("depart") || text.includes("exit")) return "15/06/2026";
    return "01/06/2026";
  }
  if (text.includes("email")) return "applicant@example.com";
  if (text.includes("phone") || text.includes("telephone") || text.includes("mobile")) return "+65 8123 4567";
  if (text.includes("url") || text.includes("resume link")) {
    return "https://visas-immigration.service.gov.uk/forceResume/550e8400-e29b-41d4-a716-446655440000";
  }
  if (text.includes("passport") || text.includes("document number")) return "E12345678";
  if (text.includes("surname") || text.includes("family name")) return "ZHANG";
  if (text.includes("given") || text.includes("first name")) return "XIAOMING";
  if (field.field_type === "textarea") return "This is a concise supporting explanation for the application.";
  return "Sample answer";
}

function baseAnswers(field: DbFieldRow, answer: string): Record<string, string> {
  return {
    passport_issue_date: "01/01/2020",
    passport_issuance_date: "01/01/2020",
    passport_expiry_date: "01/01/2032",
    passport_expiration_date: "01/01/2032",
    arrival_date: "01/06/2026",
    intended_arrival_date: "01/06/2026",
    departure_date: "15/06/2026",
    intended_departure_date: "15/06/2026",
    current_nationality: "China",
    nationality_at_birth: "China",
    nationality_at_birth_different: "no",
    [field.field_name]: answer,
  };
}

function questionFor(locale: Locale): string {
  return locale === "zh"
    ? "这个字段应该怎么填？请给一个正确例子，不要使用Markdown。"
    : "How should I fill this field? Give one correct example without Markdown.";
}

function maxLength(field: DbFieldRow): number | null {
  return numericValue(field.validation_rules?.maxLength);
}

function hasPattern(field: DbFieldRow): boolean {
  return Boolean(stringValue(field.validation_rules?.pattern));
}

function invalidPatternAnswer(field: DbFieldRow): string | null {
  const pattern = stringValue(field.validation_rules?.pattern);
  if (!pattern) return null;
  try {
    const regex = new RegExp(pattern);
    return ["💥", "\n", "<invalid>", "###INVALID###"].find((candidate) => !regex.test(candidate)) ?? null;
  } catch {
    return null;
  }
}

function buildGuidanceCases(fields: DbFieldRow[]): EvalCase[] {
  return fields.flatMap((field) =>
    (["zh", "en"] as const).map((locale) => {
      const answer = sampleAnswer(field);
      return {
        name: `guidance:${locale}`,
        locale,
        field,
        answer,
        allAnswers: baseAnswers(field, answer),
        question: questionFor(locale),
      };
    }),
  );
}

function buildSyntheticPhotoFields(): DbFieldRow[] {
  const base = {
    id: "synthetic-photo-upload",
    field_name: "photo_upload",
    label: "签证照片 / Visa photo",
    field_type: "file" as const,
    required: true,
    step_number: 99,
    step_name: "Upload Photo",
    display_order: 1,
    placeholder: "JPG/JPEG passport-style photo",
    validation_rules: {
      documentType: "photo",
      format: "Official destination photo requirements",
      acceptedFileTypes: ["jpg", "jpeg", "png"],
    },
    options: null,
    conditional_logic: null,
  };

  return [
    { ...base, id: `${base.id}-us`, visa_type: "DS160" },
    { ...base, id: `${base.id}-indonesia`, visa_type: "B211A" },
    { ...base, id: `${base.id}-schengen`, visa_type: "EU_SCHENGEN_C_SHORT_STAY" },
  ];
}

function syntheticAuditField(input: {
  id: string;
  visaType: string;
  fieldName: string;
  label: string;
  fieldType: FieldType;
  options?: Array<FieldOption>;
  validationRules?: Record<string, unknown>;
  placeholder?: string;
}): DbFieldRow {
  return {
    id: input.id,
    visa_type: input.visaType,
    field_name: input.fieldName,
    label: input.label,
    field_type: input.fieldType,
    required: true,
    step_number: 99,
    step_name: "Country copilot audit",
    display_order: 1,
    placeholder: input.placeholder ?? null,
    validation_rules: input.validationRules ?? null,
    options: input.options ?? null,
    conditional_logic: null,
  };
}

function buildCountryCopilotAuditCases(): EvalCase[] {
  const yesNo = [{ value: "yes", text: "Yes" }, { value: "no", text: "No" }];
  const agree = [{ value: "yes", text: "I agree" }];
  const choiceFields = [
    syntheticAuditField({ id: "audit-id-c1", visaType: "ID_C1_TOURIST", fieldName: "information_true_declaration", label: "I declare that the information I provided is true.", fieldType: "checkbox", options: agree }),
    syntheticAuditField({ id: "audit-id-b1", visaType: "ID_B1_EVOA", fieldName: "billing_responsibility_declaration", label: "I understand that official payment must be completed.", fieldType: "checkbox", options: agree }),
    syntheticAuditField({ id: "audit-vn-evisa", visaType: "VN_E_VISA", fieldName: "final_declaration", label: "I declare that the above statements are true, accurate, and complete.", fieldType: "checkbox", options: agree }),
    syntheticAuditField({
      id: "audit-vn-prearrival",
      visaType: "VN_PREARRIVAL_DECLARATION",
      fieldName: "visa_information_acknowledgement",
      label: "I have read and understood this information.",
      fieldType: "checkbox",
      validationRules: {
        helper_zh: "请提供越南签证信息（如适用）；签证类型和签证编号必须与官方签证文件一致。",
        helper_en: "Provide the Vietnam visa details when applicable and match the official visa document.",
      },
    }),
    syntheticAuditField({ id: "audit-sg", visaType: "SG_ARRIVAL_CARD", fieldName: "has_health_symptoms", label: "Do you currently have any of the listed health symptoms?", fieldType: "radio", options: yesNo }),
    syntheticAuditField({ id: "audit-my", visaType: "MY_MDAC_ARRIVAL_CARD", fieldName: "purpose_of_travel", label: "Purpose of Travel", fieldType: "select", options: [{ value: "holiday", text: "Holiday/Sightseeing/Leisure" }] }),
    syntheticAuditField({ id: "audit-th", visaType: "TH_TDAC_ARRIVAL_CARD", fieldName: "transit_without_stay", label: "I am a transit passenger and will not stay in Thailand.", fieldType: "checkbox" }),
    syntheticAuditField({ id: "audit-ph", visaType: "PH_ETRAVEL_ARRIVAL_CARD", fieldName: "data_privacy_agreement", label: "I agree to the Data Privacy and Affidavit of Undertaking.", fieldType: "checkbox", options: agree }),
    syntheticAuditField({ id: "audit-tw", visaType: "TW_ENTRY_PERMIT", fieldName: "accepted_terms", label: "I have read and accept the following terms and conditions.", fieldType: "checkbox", options: agree }),
    syntheticAuditField({ id: "audit-us", visaType: "DS160", fieldName: "has_specific_travel_plans", label: "Have you made specific travel plans?", fieldType: "radio", options: yesNo }),
    syntheticAuditField({ id: "audit-fr", visaType: "EU_SCHENGEN_C_SHORT_STAY", fieldName: "directive_2004_38_acknowledged", label: "I acknowledge these rights under Directive 2004/38/EC.", fieldType: "radio", options: yesNo }),
    syntheticAuditField({ id: "audit-kr", visaType: "KR_C39_SHORT_TERM_VISIT", fieldName: "declaration_consent", label: "I declare that the statements in this application are true and correct.", fieldType: "checkbox", options: agree }),
  ];

  const choiceCases = choiceFields.flatMap((field) => (["zh", "en"] as const).map((locale) => ({
    name: `country-audit:${field.id}:${locale}`,
    locale,
    field,
    answer: sampleAnswer(field),
    allAnswers: baseAnswers(field, sampleAnswer(field)),
    expectNoExamples: true,
    expectedSummaryPattern: field.field_type === "checkbox"
      ? locale === "zh" ? /勾选|确认|声明|同意/ : /select|acknowledg|declaration|consent/i
      : locale === "zh" ? /选择|选项/ : /choos|option/i,
    forbiddenGuidancePattern: MISLEADING_CHOICE_EXAMPLE_PATTERN,
  })));

  const formatFields = [
    syntheticAuditField({ id: "audit-format-id", visaType: "ID_C1_TOURIST", fieldName: "passport_expiry_date", label: "Date of Expiry", fieldType: "date", validationRules: { format: "DD/MM/YYYY" } }),
    syntheticAuditField({ id: "audit-format-vn", visaType: "VN_E_VISA", fieldName: "visa_valid_from", label: "Grant e-Visa valid from", fieldType: "date", validationRules: { format: "DD/MM/YYYY" } }),
    syntheticAuditField({ id: "audit-format-sg", visaType: "SG_ARRIVAL_CARD", fieldName: "arrival_date", label: "Date of Arrival", fieldType: "date", validationRules: { format: "YYYY-MM-DD" } }),
    syntheticAuditField({ id: "audit-format-my", visaType: "MY_MDAC_ARRIVAL_CARD", fieldName: "arrival_date", label: "Date of Arrival in Malaysia", fieldType: "date", validationRules: { format: "YYYY-MM-DD" } }),
    syntheticAuditField({ id: "audit-format-th", visaType: "TH_TDAC_ARRIVAL_CARD", fieldName: "arrival_date", label: "Date of Arrival", fieldType: "date", validationRules: { format: "YYYY-MM-DD" } }),
    syntheticAuditField({ id: "audit-format-ph", visaType: "PH_ETRAVEL_ARRIVAL_CARD", fieldName: "flight_arrival_date", label: "Date of Arrival", fieldType: "date", validationRules: { canonical_format: "YYYY-MM-DD" } }),
    syntheticAuditField({ id: "audit-format-tw", visaType: "TW_ENTRY_PERMIT", fieldName: "intended_arrival_date", label: "Intended arrival date", fieldType: "date" }),
    syntheticAuditField({ id: "audit-format-us", visaType: "DS160", fieldName: "arrival_date", label: "Date of Arrival", fieldType: "date", validationRules: { format: "DD-MMM-YYYY" } }),
    syntheticAuditField({ id: "audit-format-us-year", visaType: "DS160", fieldName: "last_visa_issue_year", label: "Date Last Visa Was Issued (Year)", fieldType: "text", validationRules: { format: "DD-MMM-YYYY", pattern: "^[0-9]{4}$" } }),
    syntheticAuditField({ id: "audit-format-fr", visaType: "EU_SCHENGEN_C_SHORT_STAY", fieldName: "intended_arrival_date", label: "Intended date of arrival", fieldType: "date", validationRules: { format: "DD/MM/YYYY" } }),
    syntheticAuditField({ id: "audit-format-kr", visaType: "KR_C39_SHORT_TERM_VISIT", fieldName: "intended_entry_date", label: "Intended Date of Entry", fieldType: "date", validationRules: { format: "YYYY/MM/DD" } }),
    syntheticAuditField({ id: "audit-format-kr-arrival", visaType: "KR_E_ARRIVAL_CARD", fieldName: "arrival_date", label: "Date of Arrival", fieldType: "date", validationRules: { format: "YYYY-MM-DD" } }),
  ];
  const formatCases = formatFields.flatMap((field) => (["zh", "en"] as const).map((locale) => ({
    name: `country-format-audit:${field.id}:${locale}`,
    locale,
    field,
    answer: sampleAnswer(field),
    allAnswers: baseAnswers(field, sampleAnswer(field)),
  })));

  const semanticFields = [
    syntheticAuditField({ id: "audit-id-issuing-country", visaType: "ID_C1_TOURIST", fieldName: "passport_place_of_issue", label: "Issuing Country", fieldType: "country", validationRules: { source: "ISO3166-1" } }),
    syntheticAuditField({ id: "audit-vn-merged-issue", visaType: "VN_E_VISA", fieldName: "passport_issuing_authority", label: "Issuing Authority/Place of issue", fieldType: "text" }),
    syntheticAuditField({ id: "audit-ph-holder", visaType: "PH_ETRAVEL_ARRIVAL_CARD", fieldName: "passport_holder_type", label: "Nationality", fieldType: "radio", options: [{ value: "FILIPINO", text: "PHILIPPINE PASSPORT Holder" }, { value: "FOREIGNER", text: "FOREIGN PASSPORT Holder" }] }),
    syntheticAuditField({ id: "audit-tw-chinese-name", visaType: "TW_ENTRY_PERMIT", fieldName: "name_chinese", label: "中文姓名", fieldType: "text", validationRules: { script: "traditional_chinese" } }),
    syntheticAuditField({ id: "audit-fr-phone", visaType: "EU_SCHENGEN_C_SHORT_STAY", fieldName: "phone_number", label: "Telephone number (including country code)", fieldType: "text", placeholder: "e.g., +1 415 555 0199" }),
  ];
  const semanticCases = semanticFields.flatMap((field) => (["zh", "en"] as const).map((locale) => ({
    name: `country-semantic-audit:${field.id}:${locale}`,
    locale,
    field,
    answer: sampleAnswer(field),
    allAnswers: baseAnswers(field, sampleAnswer(field)),
    expectNoExamples: true,
    expectedSummaryPattern: field.id === "audit-id-issuing-country"
      ? locale === "zh" ? /国家|地区/ : /country|region/i
      : field.id === "audit-vn-merged-issue"
        ? locale === "zh" ? /签发机关.*签发地点|签发地点.*签发机关/ : /authority.*place|place.*authority/i
        : field.id === "audit-ph-holder"
          ? locale === "zh" ? /护照|旅行证件/ : /passport|travel-document/i
          : field.id === "audit-tw-chinese-name"
            ? locale === "zh" ? /中文姓名/ : /Chinese-script name/i
            : undefined,
  })));

  return [...choiceCases, ...formatCases, ...semanticCases];
}

function buildPhotoSpecificCases(fields: DbFieldRow[]): EvalCase[] {
  return fields.flatMap((field) => [
    {
      name: "photo:empty-required",
      locale: "zh" as const,
      field,
      answer: "",
      allAnswers: baseAnswers(field, ""),
      question: "照片应该怎么上传？不要使用Markdown。",
      expectedSeverity: "warning" as const,
    },
    {
      name: "photo:invalid-file-type",
      locale: "en" as const,
      field,
      answer: "visa-photo.pdf",
      allAnswers: baseAnswers(field, "visa-photo.pdf"),
      question: "Why is this photo upload wrong?",
      expectedSeverity: "error" as const,
    },
    {
      name: "photo:accepted-upload",
      locale: "en" as const,
      field,
      answer: "visa-photo.jpg",
      allAnswers: baseAnswers(field, "visa-photo.jpg"),
      question: "Is this photo field ready?",
    },
  ]);
}

function buildStandardIdentityFieldCases(): EvalCase[] {
  const field: DbFieldRow = {
    id: "synthetic-passport-issuing-authority",
    visa_type: "B211A",
    field_name: "passport_issuing_authority",
    label: "护照签发机关/签发地点",
    field_type: "text",
    required: true,
    step_number: 99,
    step_name: "Passport",
    display_order: 2,
    placeholder: "e.g., Government of Indonesia",
    validation_rules: { maxLength: 60 },
    options: null,
    conditional_logic: null,
  };

  return [
    {
      name: "standard:chinese-passport-issuing-authority-city-question",
      locale: "zh",
      field,
      answer: "",
      allAnswers: baseAnswers(field, ""),
      question: "我在重庆拿的护照 该填什么",
      expectedSeverity: "warning",
    },
  ];
}

function buildAddressOptionCopilotCases(): EvalCase[] {
  const field: DbFieldRow = {
    id: "synthetic-vietnam-ward-commune",
    visa_type: "evisa_tourism",
    field_name: "intended_ward_commune",
    label: "在越南拟停留坊/社",
    field_type: "select",
    required: true,
    step_number: 99,
    step_name: "Vietnam stay address",
    display_order: 3,
    placeholder: "Select ward/commune",
    validation_rules: null,
    options: [
      { value: "HAI_CHAU_WARD", text: "HAI CHAU WARD" },
      { value: "NGU_HANH_SON_WARD", text: "NGU HANH SON WARD" },
      { value: "SON_TRA_WARD", text: "SON TRA WARD" },
    ],
    conditional_logic: null,
  };

  return [
    {
      name: "address-option:vietnam-da-nang-ward-question",
      locale: "zh",
      field,
      answer: "",
      allAnswers: {
        ...baseAnswers(field, ""),
        intended_province_city: "DA NANG",
        intended_address: "19 Trường Sa, Ngũ Hành Sơn, Đà Nẵng 50000, Vietnam",
      },
      question: "19 Trường Sa, Ngũ Hành Sơn, Đà Nẵng 50000, Vietnam 这个地址应该选择哪一个选项",
      expectedSeverity: "warning",
    },
  ];
}

function buildInvalidCases(fields: DbFieldRow[]): EvalCase[] {
  const cases: EvalCase[] = [];

  for (const field of fields) {
    if (field.required) {
      cases.push({
        name: "invalid:required-empty",
        locale: "en",
        field,
        answer: "",
        allAnswers: baseAnswers(field, ""),
        question: "What is wrong with this answer?",
        expectedSeverity: "warning",
      });
    }

    const limit = maxLength(field);
    if (limit && limit > 0 && limit <= 2500) {
      const answer = "X".repeat(limit + 1);
      cases.push({
        name: "invalid:max-length",
        locale: "en",
        field,
        answer,
        allAnswers: baseAnswers(field, answer),
        question: "What is wrong with this answer?",
        expectedSeverity: "error",
      });
    }

    if (hasPattern(field)) {
      const answer = invalidPatternAnswer(field);
      if (answer) {
        cases.push({
          name: "invalid:pattern",
          locale: "en",
          field,
          answer,
          allAnswers: baseAnswers(field, answer),
          question: "What is wrong with this answer?",
          expectedSeverity: "error",
        });
      }
    }

    if (
      (field.field_type === "select" || field.field_type === "radio" || field.field_type === "checkbox") &&
      normalizeOptions(field.options)?.length
    ) {
      const answer = "__not_a_valid_option__";
      cases.push({
        name: "invalid:option-mismatch",
        locale: "en",
        field,
        answer,
        allAnswers: baseAnswers(field, answer),
        question: "What is wrong with this answer?",
        expectedSeverity: "error",
      });
    }

    if (field.field_type === "date") {
      const answer = "31/31/2026";
      cases.push({
        name: "invalid:date-format",
        locale: "en",
        field,
        answer,
        allAnswers: baseAnswers(field, answer),
        question: "What is wrong with this answer?",
        expectedSeverity: "error",
      });
    }
  }

  return cases;
}

function findField(fields: DbFieldRow[], candidates: string[]): DbFieldRow | null {
  return fields.find((field) => candidates.some((candidate) => field.field_name.toLowerCase().includes(candidate))) ?? null;
}

function buildCrossFieldCases(fields: DbFieldRow[]): EvalCase[] {
  const cases: EvalCase[] = [];
  const byVisaType = new Map<string, DbFieldRow[]>();
  for (const field of fields) {
    const existing = byVisaType.get(field.visa_type) ?? [];
    existing.push(field);
    byVisaType.set(field.visa_type, existing);
  }

  for (const visaFields of byVisaType.values()) {
    const expiryField = findField(visaFields, [
      "passport_expiry",
      "passport_expiration",
      "passport_date_of_expiry",
      "travel_document_expiry",
    ]);
    if (expiryField) {
      cases.push({
        name: "cross:passport-expiry-before-issue",
        locale: "en",
        field: expiryField,
        answer: "01/01/2020",
        allAnswers: {
          ...baseAnswers(expiryField, "01/01/2020"),
          passport_issue_date: "01/01/2030",
          passport_issuance_date: "01/01/2030",
          passport_expiry_date: "01/01/2020",
          passport_expiration_date: "01/01/2020",
        },
        question: "Why is this date wrong?",
        expectedSeverity: "error",
      });
    }

    const departureField = findField(visaFields, [
      "departure_date",
      "date_of_departure",
      "departure_from_origin_date",
      "intended_departure",
      "exit_date",
    ]);
    if (departureField) {
      cases.push({
        name: "cross:departure-before-arrival",
        locale: "en",
        field: departureField,
        answer: "01/06/2026",
        allAnswers: {
          ...baseAnswers(departureField, "01/06/2026"),
          arrival_date: "15/06/2026",
          expected_arrival_date: "15/06/2026",
          intended_arrival_date: "15/06/2026",
          departure_date: "01/06/2026",
          intended_departure_date: "01/06/2026",
          departure_from_origin_date: "01/06/2026",
        },
        question: "Why is this date wrong?",
        expectedSeverity: "error",
      });
    }

    const birthField = findField(visaFields, ["date_of_birth", "birth_date", "dob"]);
    if (birthField) {
      cases.push({
        name: "cross:dob-future",
        locale: "en",
        field: birthField,
        answer: "01/01/2099",
        allAnswers: baseAnswers(birthField, "01/01/2099"),
        question: "Why is this date wrong?",
        expectedSeverity: "error",
      });
    }

    if (expiryField) {
      cases.push({
        name: "cross:passport-expires-before-arrival",
        locale: "en",
        field: expiryField,
        answer: "01/01/2024",
        allAnswers: {
          ...baseAnswers(expiryField, "01/01/2024"),
          passport_expiry_date: "01/01/2024",
          passport_expiration_date: "01/01/2024",
          arrival_date: "01/06/2026",
          intended_arrival_date: "01/06/2026",
        },
        question: "Why is this expiry date wrong?",
        expectedSeverity: "error",
      });
    }

    const nationalityField = findField(visaFields, ["current_nationality", "nationality_at_birth"]);
    if (nationalityField) {
      cases.push({
        name: "cross:nationality-at-birth-conflict",
        locale: "en",
        field: nationalityField,
        answer: "China",
        allAnswers: {
          ...baseAnswers(nationalityField, "China"),
          current_nationality: "China",
          nationality_at_birth: "Singapore",
          nationality_at_birth_different: "no",
        },
        question: "Why might these nationality answers conflict?",
        expectedSeverity: "warning",
      });
    }
  }

  return cases;
}

function validateText(text: string | undefined, path: string, testCase: EvalCase, failures: EvalFailure[]): void {
  if (!text?.trim()) {
    failures.push({
      caseName: testCase.name,
      visaType: testCase.field.visa_type,
      fieldName: testCase.field.field_name,
      message: `${path} is empty`,
    });
    return;
  }

  if (MARKDOWN_PATTERN.test(text)) {
    failures.push({
      caseName: testCase.name,
      visaType: testCase.field.visa_type,
      fieldName: testCase.field.field_name,
      message: `${path} contains Markdown markers`,
      details: text.slice(0, 240),
    });
  }

  if (BAD_TEXT_PATTERN.test(text)) {
    failures.push({
      caseName: testCase.name,
      visaType: testCase.field.visa_type,
      fieldName: testCase.field.field_name,
      message: `${path} contains unsafe or placeholder text`,
      details: text.slice(0, 240),
    });
  }
}

function validateResponse(response: GuidanceResponse, testCase: EvalCase, failures: EvalFailure[]): void {
  const guidance = response.guidance;
  const validation = response.validation;

  if (!guidance || !validation) {
    failures.push({
      caseName: testCase.name,
      visaType: testCase.field.visa_type,
      fieldName: testCase.field.field_name,
      message: "Missing guidance or validation object",
      details: response,
    });
    return;
  }

  if (!["ok", "warning", "error"].includes(validation.severity ?? "")) {
    failures.push({
      caseName: testCase.name,
      visaType: testCase.field.visa_type,
      fieldName: testCase.field.field_name,
      message: "Invalid validation severity",
      details: validation,
    });
  }

  if (testCase.expectedSeverity && validation.severity === "ok") {
    failures.push({
      caseName: testCase.name,
      visaType: testCase.field.visa_type,
      fieldName: testCase.field.field_name,
      message: `Expected ${testCase.expectedSeverity} validation, got ok`,
      details: validation,
    });
  }

  if (!validation.messages?.length) {
    failures.push({
      caseName: testCase.name,
      visaType: testCase.field.visa_type,
      fieldName: testCase.field.field_name,
      message: "Validation has no messages",
    });
  }

  validateText(guidance.title, "guidance.title", testCase, failures);
  validateText(guidance.summary, "guidance.summary", testCase, failures);
  for (const [index, message] of (validation.messages ?? []).entries()) {
    validateText(message, `validation.messages[${index}]`, testCase, failures);
  }

  const listChecks: Array<[string, string[] | undefined]> = [
    ["guidance.examples", guidance.examples],
    ["guidance.hints", guidance.hints],
    ["guidance.officialWarnings", guidance.officialWarnings],
    ["guidance.formatHints", guidance.formatHints],
  ];
  for (const [path, values] of listChecks) {
    (values ?? []).forEach((value, index) => validateText(value, `${path}[${index}]`, testCase, failures));
  }

  if (CHOICE_FIELD_TYPES.has(testCase.field.field_type) && (guidance.examples?.length ?? 0) > 0) {
    failures.push({
      caseName: testCase.name,
      visaType: testCase.field.visa_type,
      fieldName: testCase.field.field_name,
      message: "Choice control guidance must not render text-entry examples",
      details: guidance.examples,
    });
  }

  const fieldTextValue = fieldText(testCase.field);
  const isExplicitYear = !CHOICE_FIELD_TYPES.has(testCase.field.field_type) && (
    /(?:^|_)year$/.test(testCase.field.field_name.toLowerCase()) ||
    /\(year\)|年份|仅年份/.test(testCase.field.label.toLowerCase())
  );
  const configuredDateFormat = stringValue(
    isExplicitYear
      ? "YYYY"
      : testCase.field.validation_rules?.format ?? testCase.field.validation_rules?.canonical_format,
  )?.toUpperCase();
  if (testCase.field.field_type === "date" || isExplicitYear) {
    const expectedExample = configuredDateFormat ? DATE_FORMAT_EXAMPLES[configuredDateFormat] : undefined;
    const actualExamples = guidance.examples ?? [];
    if (expectedExample && (actualExamples.length !== 1 || actualExamples[0] !== expectedExample)) {
      failures.push({
        caseName: testCase.name,
        visaType: testCase.field.visa_type,
        fieldName: testCase.field.field_name,
        message: `Date example must match declared format ${configuredDateFormat}`,
        details: actualExamples,
      });
    }
    if (!expectedExample && actualExamples.length > 0) {
      failures.push({
        caseName: testCase.name,
        visaType: testCase.field.visa_type,
        fieldName: testCase.field.field_name,
        message: "Date guidance must not guess an example when no supported format is declared",
        details: actualExamples,
      });
    }
  }

  const isEmailField = includesAnyText(fieldTextValue, ["email", "e-mail", "邮箱", "电子邮件"]);
  const mustAvoidApplicantValueExample = includesAnyText(fieldTextValue, [
    "phone", "telephone", "mobile", "street",
    "issuing authority", "issuing_authority", "place of issue", "place_of_issue",
    "name_chinese", "chinese name", "电话", "手机", "签发机关", "签发地点", "中文姓名",
  ]) || (!isEmailField && includesAnyText(fieldTextValue, ["address", "地址"]));
  if (mustAvoidApplicantValueExample && (guidance.examples?.length ?? 0) > 0) {
    failures.push({
      caseName: testCase.name,
      visaType: testCase.field.visa_type,
      fieldName: testCase.field.field_name,
      message: "Identity/contact/location guidance must not invent a country-specific applicant value",
      details: guidance.examples,
    });
  }

  if (testCase.expectNoExamples && (guidance.examples?.length ?? 0) > 0) {
    failures.push({
      caseName: testCase.name,
      visaType: testCase.field.visa_type,
      fieldName: testCase.field.field_name,
      message: "Expected no examples for audited choice control",
      details: guidance.examples,
    });
  }

  if (testCase.expectedSummaryPattern && !testCase.expectedSummaryPattern.test(guidance.summary ?? "")) {
    failures.push({
      caseName: testCase.name,
      visaType: testCase.field.visa_type,
      fieldName: testCase.field.field_name,
      message: "Guidance summary does not explain the audited control intuitively",
      details: guidance.summary,
    });
  }

  if (testCase.forbiddenGuidancePattern) {
    const combinedGuidance = JSON.stringify(guidance);
    if (testCase.forbiddenGuidancePattern.test(combinedGuidance)) {
      failures.push({
        caseName: testCase.name,
        visaType: testCase.field.visa_type,
        fieldName: testCase.field.field_name,
        message: "Guidance contains a text-entry instruction that is invalid for this choice control",
        details: combinedGuidance.slice(0, 500),
      });
    }
  }

  if (testCase.question) {
    validateText(response.reply, "reply", testCase, failures);
    const replyLength = response.reply?.length ?? 0;
    if (replyLength < 20 || replyLength > 1600) {
      failures.push({
        caseName: testCase.name,
        visaType: testCase.field.visa_type,
        fieldName: testCase.field.field_name,
        message: "Reply length is outside expected chat range",
        details: { replyLength, reply: response.reply?.slice(0, 240) },
      });
    }

    if (testCase.name === "standard:chinese-passport-issuing-authority-city-question") {
      const reply = response.reply ?? "";
      if (/重庆市公安局|Chongqing Public Security Bureau/i.test(reply)) {
        failures.push({
          caseName: testCase.name,
          visaType: testCase.field.visa_type,
          fieldName: testCase.field.field_name,
          message: "Reply incorrectly infers the issuing authority from the pickup city",
          details: reply.slice(0, 400),
        });
      }
      if (!/护照|passport|Authority|签发机关/.test(reply)) {
        failures.push({
          caseName: testCase.name,
          visaType: testCase.field.visa_type,
          fieldName: testCase.field.field_name,
          message: "Reply does not tell the user to use the passport authority text",
          details: reply.slice(0, 400),
        });
      }
    }

    if (testCase.name === "address-option:vietnam-da-nang-ward-question") {
      const reply = response.reply ?? "";
      if (!/NGU[_\s-]?HANH[_\s-]?SON|五行山|Ngũ Hành Sơn/i.test(reply)) {
        failures.push({
          caseName: testCase.name,
          visaType: testCase.field.visa_type,
          fieldName: testCase.field.field_name,
          message: "Reply does not select or prioritize the address-matching ward option",
          details: reply.slice(0, 400),
        });
      }
      if (!/选项|option|选择|select/i.test(reply)) {
        failures.push({
          caseName: testCase.name,
          visaType: testCase.field.visa_type,
          fieldName: testCase.field.field_name,
          message: "Reply does not answer the user's option-selection question directly",
          details: reply.slice(0, 400),
        });
      }
    }
  }

  if (!["high", "medium", "low"].includes(response.confidence ?? "")) {
    failures.push({
      caseName: testCase.name,
      visaType: testCase.field.visa_type,
      fieldName: testCase.field.field_name,
      message: "Invalid confidence value",
      details: response.confidence,
    });
  }
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  handler: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await handler(items[index] as T, index);
    }
  });
  await Promise.all(workers);
}

async function main(): Promise<void> {
  const { default: app } = await import("../src/app.js");
  const request = supertest(app);
  const supabase = getSupabaseClient();
  const selectedVisaTypes = (process.env.FIELD_GUIDANCE_EVAL_VISA_TYPES ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const dbFields: DbFieldRow[] = [];
  if (!SYNTHETIC_ONLY) {
    const pageSize = 1_000;
    for (let from = 0; ; from += pageSize) {
      let query = supabase
        .from("visa_form_fields")
        .select("id, visa_type, field_name, label, field_type, required, step_number, step_name, display_order, placeholder, validation_rules, options, conditional_logic")
        .order("visa_type", { ascending: true })
        .order("step_number", { ascending: true })
        .order("display_order", { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + pageSize - 1);

      if (selectedVisaTypes.length > 0) {
        query = query.in("visa_type", selectedVisaTypes);
      }

      const { data, error } = await query;
      if (error) throw new Error(`Failed to load visa_form_fields: ${error.message}`);

      const page = (data ?? []) as DbFieldRow[];
      dbFields.push(...page);
      if (page.length < pageSize) break;
    }
  }

  if (dbFields.length === 0 && !SYNTHETIC_ONLY) {
    throw new Error("No visa_form_fields rows found for evaluation.");
  }
  const photoFields = buildSyntheticPhotoFields();
  const fields = [...dbFields, ...photoFields];

  const counters: EvalCounters = {
    totalCases: 0,
    guidanceCases: 0,
    invalidCases: 0,
    crossFieldCases: 0,
    countryAuditCases: 0,
    fields: dbFields.length,
    visaTypes: {},
  };

  for (const field of fields) {
    counters.visaTypes[field.visa_type] = (counters.visaTypes[field.visa_type] ?? 0) + 1;
  }

  const guidanceCases = buildGuidanceCases(fields);
  const invalidCases = buildInvalidCases(fields);
  const crossFieldCases = SYNTHETIC_ONLY ? [] : buildCrossFieldCases(fields);
  const photoCases = buildPhotoSpecificCases(photoFields);
  const standardIdentityCases = buildStandardIdentityFieldCases();
  const addressOptionCases = buildAddressOptionCopilotCases();
  const countryAuditCases = buildCountryCopilotAuditCases();
  const cases = [
    ...guidanceCases,
    ...invalidCases,
    ...crossFieldCases,
    ...photoCases,
    ...standardIdentityCases,
    ...addressOptionCases,
    ...countryAuditCases,
  ];
  counters.guidanceCases = guidanceCases.length;
  counters.invalidCases = invalidCases.length + photoCases.length;
  counters.crossFieldCases = crossFieldCases.length;
  counters.countryAuditCases = countryAuditCases.length;
  counters.totalCases = cases.length;

  const failures: EvalFailure[] = [];

  await runWithConcurrency(cases, CONCURRENCY, async (testCase) => {
    const response = await request
      .post("/api/field-guidance")
      .send({
        visaType: testCase.field.visa_type,
        country: "Eval Country",
        locale: testCase.locale,
        field: toApiField(testCase.field),
        answer: testCase.answer,
        allAnswers: testCase.allAnswers,
        question: testCase.question,
      });

    if (response.status !== 200) {
      failures.push({
        caseName: testCase.name,
        visaType: testCase.field.visa_type,
        fieldName: testCase.field.field_name,
        message: `Expected HTTP 200, got ${response.status}`,
        details: response.body,
      });
      return;
    }

    validateResponse(response.body as GuidanceResponse, testCase, failures);
  });

  const report = {
    mode: {
      retrievalDisabled: process.env.FIELD_GUIDANCE_EVAL_DISABLE_RETRIEVAL === "1",
      aiEnabled: process.env.FIELD_GUIDANCE_EVAL_USE_AI === "1",
      concurrency: CONCURRENCY,
    },
    counters,
    failureCount: failures.length,
    failures: failures.slice(0, 25),
  };

  console.log(JSON.stringify(report, null, 2));

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
