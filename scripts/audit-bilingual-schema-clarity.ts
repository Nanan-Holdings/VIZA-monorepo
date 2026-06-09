import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import ts from "../viza-fe/internal-website/node_modules/typescript/lib/typescript.js";
import {
  isChineseOnlyText,
  isEnglishOnlyText,
  isVagueChineseLabel,
  normalizeBilingualFormField,
  resolveLocalizedFieldLabel,
  resolveLocalizedPlaceholder,
  resolveOptionDisplayLabel,
} from "../viza-fe/internal-website/lib/bilingual-schema-contract.ts";
import { getChineseLabel } from "../viza-fe/internal-website/lib/ds160-translations.ts";
import { getRagVisitorIntakeSteps } from "../viza-fe/internal-website/lib/rag-visitor-intake-form.ts";
import type { VisaFormFieldOption, VisaFormFieldRow, WizardStep } from "../viza-fe/internal-website/types/visa-form-fields.ts";

type Severity = "blocking" | "warning" | "info";
type PassFail = "pass" | "fail";

interface ExtractedRow {
  visa_type?: string;
  field_name?: string;
  label?: string;
  field_type?: string;
  required?: boolean;
  step_number?: number;
  step_name?: string | null;
  display_order?: number;
  placeholder?: string | null;
  validation_rules?: Record<string, unknown> | null;
  options?: unknown;
  conditional_logic?: Record<string, unknown> | null;
}

interface SchemaSource {
  sourceFile: string;
  schema: string;
  country: string;
  fields: VisaFormFieldRow[];
}

interface AdjacentSchemaSource {
  sourceFile: string;
  purpose: string;
  coverage: string;
}

interface AuditIssue {
  country: string;
  schema: string;
  section: string;
  field_id: string;
  field_type: string;
  current_label_zh: string;
  current_label_en: string;
  issue_type: string;
  severity: Severity;
  suggested_label_zh: string;
  suggested_helper_zh: string;
  suggested_label_en: string;
  pass_fail: PassFail;
}

interface FieldResult {
  country: string;
  schema: string;
  section: string;
  field_id: string;
  field_type: string;
  label_zh: string;
  label_en: string;
  option_count: number;
  issues: AuditIssue[];
  pass_fail: PassFail;
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BACKEND_SCRIPT_DIR = path.join(ROOT, "viza-be", "agent-backend", "scripts");
const REPORT_JSON = path.join(ROOT, "bilingual-schema-audit-report.json");
const REPORT_MD = path.join(ROOT, "bilingual-schema-audit-report.md");

const FIELD_TYPES_WITH_OPTIONS = new Set(["select", "radio", "checkbox"]);
const TEXTUAL_FIELD_TYPES = new Set(["text", "textarea", "select", "country", "date"]);
const COMPLEX_FIELD_NAME_PATTERN = /(declaration|consent|awareness|undertaking|criminal|refusal|refused|denied|visa_history|security|background)/i;

const VISA_TYPE_COUNTRY: Record<string, string> = {
  AE_TOURIST_VISA: "united_arab_emirates",
  AU_VISITOR_600: "australia",
  B211A: "indonesia",
  CA_TRV: "canada",
  DS160: "us",
  EG_E_VISA: "egypt",
  EU_SCHENGEN_C_SHORT_STAY: "schengen",
  HK_VISIT_VISA: "hong_kong",
  ID_C1_TOURIST: "indonesia",
  IN_E_VISA: "india",
  JP_TOURIST: "japan",
  KH_TOURIST_E_VISA: "cambodia",
  KR_C39_SHORT_TERM_VISIT: "south_korea",
  LA_TOURIST_E_VISA: "laos",
  LK_ETA: "sri_lanka",
  MO_VISIT_VISA: "macau",
  MV_IMUGA: "maldives",
  MY_TOURIST_E_VISA: "malaysia",
  NZ_VISITOR_VISA: "new_zealand",
  PH_TEMPORARY_VISITOR_VISA: "philippines",
  RU_E_VISA: "russia",
  SG_VISITOR_VISA: "singapore",
  TH_TOURIST_E_VISA: "thailand",
  TR_E_VISA: "turkey",
  UK_STANDARD_VISITOR: "uk",
  VN_E_VISA: "vietnam",
  ZA_VISITOR_VISA: "south_africa",
  RAG_VISITOR_INTAKE_FALLBACK: "future_country_registry_fallback",
  UNIVERSAL_PROFILE: "universal_profile",
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function normalizePathForReport(filePath: string): string {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function discoverAdjacentSchemaSources(): AdjacentSchemaSource[] {
  const sources: AdjacentSchemaSource[] = [];
  const seen = new Set<string>();

  const add = (relativePath: string, purpose: string, coverage: string) => {
    const normalized = relativePath.replace(/\\/g, "/");
    const absolute = path.join(ROOT, normalized);
    if (!fs.existsSync(absolute) || seen.has(normalized)) return;
    seen.add(normalized);
    sources.push({ sourceFile: normalized, purpose, coverage });
  };

  const addDirectoryFiles = (relativeDir: string, fileName: string, purpose: string, coverage: string) => {
    const absoluteDir = path.join(ROOT, relativeDir);
    if (!fs.existsSync(absoluteDir)) return;
    for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      add(path.join(relativeDir, entry.name, fileName), purpose, coverage);
    }
  };

  add("viza-fe/internal-website/components/dynamic-step-form.tsx", "dynamic_form_renderer", "two-column form labels, options, validation hints, and Ask AI trigger payloads");
  add("viza-fe/internal-website/components/dynamic-form-field.tsx", "dynamic_field_renderer", "date/country/select/radio/input display for localized labels and options");
  add("viza-fe/internal-website/components/application-steps/dynamic-review-step.tsx", "dynamic_review_renderer", "bilingual review labels and enum value display");
  add("viza-fe/internal-website/components/application-steps/bilingual-review-panel.tsx", "dynamic_review_panel", "review column rendering for Chinese and English sides");
  add("viza-fe/internal-website/components/application-steps/review-step.tsx", "legacy_review_renderer", "legacy validation and review rows");
  add("viza-fe/internal-website/app/api/field-guidance/route.ts", "ai_help_text", "field guidance labels, examples, option labels, and local fallback text");
  add("viza-fe/internal-website/app/actions/visa-form-fields.ts", "schema_loader", "Supabase visa_form_fields loader and bilingual normalization boundary");
  add("viza-fe/internal-website/lib/bilingual-schema-contract.ts", "bilingual_contract", "curated labels, helpers, placeholders, option labels, and resolver functions");
  add("viza-fe/internal-website/lib/ds160-translations.ts", "legacy_translation_map", "legacy DS-160 label/option/placeholder fallback translations");
  add("viza-fe/internal-website/lib/rag-visitor-intake-form.ts", "future_country_registry_fallback", "RAG visitor intake fallback schema");
  add("viza-fe/internal-website/lib/forms/about-me-questions.ts", "shared_profile_questions", "profile/question-set source adjacent to form prefill");
  add("viza-fe/internal-website/app/actions/question-sets.ts", "question_set_loader", "question_field DB loader for future registry question sets");
  add("viza-fe/internal-website/messages/en.json", "locale_messages_en", "simplified wizard English labels and review copy");
  add("viza-fe/internal-website/messages/zh.json", "locale_messages_zh", "simplified wizard Chinese labels and review copy");
  add("knowledge-base/scraped-form-fields.json", "scraped_schema_fragment", "Indonesia B211A scraped form fields");
  add("vietnam-visa-helper-v1/content.js", "vietnam_helper_artifact", "Vietnam helper extension source used as historical schema evidence");
  add("vietnam-visa-helper-v1/content-v2-1.js", "vietnam_helper_artifact", "Vietnam helper extension alternate content script");

  addDirectoryFiles(
    path.join("viza-fe", "internal-website", "components", "client", "wizards"),
    "config.ts",
    "simplified_wizard_config",
    "country simplified-form fields, options, declaration items, payload keys, and review rows",
  );

  const journeyDir = path.join(ROOT, "viza-fe", "internal-website", "lib", "client", "visa-journeys");
  if (fs.existsSync(journeyDir)) {
    for (const entry of fs.readdirSync(journeyDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".ts")) {
        add(path.join("viza-fe", "internal-website", "lib", "client", "visa-journeys", entry.name), "country_registry", "country/visa journey registry metadata");
      }
    }
  }

  return sources.sort((a, b) => a.sourceFile.localeCompare(b.sourceFile));
}

function optionCount(options: VisaFormFieldOption[] | null): number {
  return Array.isArray(options) ? options.length : 0;
}

function getRuleText(field: VisaFormFieldRow, keys: string[]): string {
  const rules = field.validationRules;
  if (!rules) return "";
  for (const key of keys) {
    const value = rules[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function toFieldRow(row: ExtractedRow, index: number, fallbackVisaType: string, sourceFile: string): VisaFormFieldRow {
  const fieldName = clean(row.field_name) || `unnamed_${index + 1}`;
  return {
    id: `${normalizePathForReport(sourceFile)}:${fieldName}`,
    visaType: clean(row.visa_type) || fallbackVisaType,
    fieldName,
    label: clean(row.label) || fieldName,
    fieldType: (clean(row.field_type) || "text") as VisaFormFieldRow["fieldType"],
    required: Boolean(row.required),
    stepNumber: typeof row.step_number === "number" ? row.step_number : 0,
    stepName: clean(row.step_name) || null,
    displayOrder: typeof row.display_order === "number" ? row.display_order : index + 1,
    placeholder: clean(row.placeholder) || null,
    validationRules: row.validation_rules ?? null,
    options: Array.isArray(row.options) ? row.options as VisaFormFieldOption[] : null,
    conditionalLogic: row.conditional_logic ?? null,
  };
}

function preprocessSeedSource(source: string, scriptDir: string): string {
  return source
    .replace(/^import[\s\S]*?;\s*/gm, "")
    .replace(
      /const __filename[\s\S]*?const __dirname = path\.dirname\(__filename\);\s*/m,
      `const __dirname = ${JSON.stringify(scriptDir)};\n`,
    )
    .replace(/dotenv\.config\([^\n]*\);\s*/g, "")
    .replace(/const supabase = createClient\([^\n]*\);\s*/g, "const supabase = null;\n")
    .replace(/\r?\nseed\(\)\.catch\([\s\S]*?\);\s*$/, "");
}

function extractRowsFromSeedScript(filePath: string): SchemaSource | null {
  const source = fs.readFileSync(filePath, "utf8");
  const scriptDir = path.dirname(filePath);
  const preprocessed = `${preprocessSeedSource(source, scriptDir)}
const __auditVisaType = typeof VISA_TYPE !== "undefined" ? VISA_TYPE : "DS160";
const __auditFields = typeof FIELDS !== "undefined" && Array.isArray(FIELDS) ? FIELDS : [];
globalThis.__auditResult = {
  visaType: __auditVisaType,
  fields: __auditFields.map((f, idx) => ({
    visa_type: __auditVisaType,
    field_name: f.field_name,
    label: f.label,
    field_type: f.field_type,
    required: f.required,
    step_number: f.step_number,
    step_name: f.step_name,
    display_order: f.display_order ?? idx + 1,
    placeholder: f.placeholder ?? null,
    validation_rules: typeof withFieldMetadata === "function" ? withFieldMetadata(f) : (f.validation_rules ?? null),
    options: Array.isArray(f.options)
      ? f.options.map((option) => typeof localizeOption === "function" ? localizeOption(option) : option)
      : null,
    conditional_logic: f.conditional_logic ?? null,
  })),
};`;

  const transpiled = ts.transpileModule(preprocessed, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  const context = vm.createContext({
    console: {
      log: () => undefined,
      error: () => undefined,
      warn: () => undefined,
    },
    process: {
      env: {
        NEXT_PUBLIC_SUPABASE_URL: "https://audit.local",
        SUPABASE_SERVICE_ROLE_KEY: "audit-key",
      },
      exit: (code?: number) => {
        throw new Error(`Unexpected process.exit(${code ?? 0}) while auditing ${filePath}`);
      },
      stdout: { write: () => undefined },
    },
    globalThis: {},
    setTimeout,
    clearTimeout,
  });

  vm.runInContext(transpiled, context, { filename: filePath, timeout: 5000 });
  const result = (context.globalThis as { __auditResult?: { visaType?: string; fields?: ExtractedRow[] } }).__auditResult;
  if (!result?.fields?.length) return null;

  const visaType = clean(result.visaType) || "UNKNOWN";
  const fields = result.fields.map((row, index) => normalizeBilingualFormField(toFieldRow(row, index, visaType, filePath)));
  return {
    sourceFile: normalizePathForReport(filePath),
    schema: visaType,
    country: VISA_TYPE_COUNTRY[visaType] ?? visaType.toLowerCase(),
    fields,
  };
}

function loadB211aScrapedSchema(): SchemaSource | null {
  const filePath = path.join(ROOT, "knowledge-base", "scraped-form-fields.json");
  if (!fs.existsSync(filePath)) return null;

  const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as { fields?: ExtractedRow[] };
  const rows = raw.fields ?? [];
  const fields = rows.map((row, index) => normalizeBilingualFormField(toFieldRow({
    ...row,
    visa_type: "B211A",
    conditional_logic: row.conditional_logic
      ? { description: String(row.conditional_logic) }
      : null,
  }, index, "B211A", filePath)));

  return {
    sourceFile: normalizePathForReport(filePath),
    schema: "B211A",
    country: "indonesia",
    fields,
  };
}

function loadRagFallbackSchema(): SchemaSource {
  const sourceFile = "viza-fe/internal-website/lib/rag-visitor-intake-form.ts";
  const steps = getRagVisitorIntakeSteps("RAG_VISITOR_INTAKE_FALLBACK");
  const fields = steps
    .flatMap((step) => step.fields)
    .map((field) => normalizeBilingualFormField(field));

  return {
    sourceFile,
    schema: "RAG_VISITOR_INTAKE_FALLBACK",
    country: "future_country_registry_fallback",
    fields,
  };
}

function universalProfileFields(): VisaFormFieldRow[] {
  const source = "viza-fe/internal-website/components/application-steps/frequent-traveler-profile-fields.tsx";
  const field = (
    fieldName: string,
    label: string,
    fieldType: VisaFormFieldRow["fieldType"] = "text",
    required = false,
    options: VisaFormFieldOption[] | null = null,
  ): VisaFormFieldRow => normalizeBilingualFormField({
    id: `${source}:${fieldName}`,
    visaType: "UNIVERSAL_PROFILE",
    fieldName,
    label,
    fieldType,
    required,
    stepNumber: 1,
    stepName: "Universal Profile",
    displayOrder: 1,
    placeholder: null,
    validationRules: null,
    options,
    conditionalLogic: null,
  });

  return [
    field("surname", "Surname", "text", true),
    field("given_names", "Given names", "text", true),
    field("date_of_birth", "Date of birth", "date", true),
    field("birth_country", "Country of birth", "country", true),
    field("birth_province_or_state", "State/province of birth", "text"),
    field("birth_city", "City of birth", "text"),
    field("gender", "Gender", "select", true, [
      { value: "M", text: "Male" },
      { value: "F", text: "Female" },
    ]),
    field("nationality", "Nationality", "country", true),
    field("occupation", "Occupation", "text"),
    field("passport_number", "Passport number", "text", true),
    field("passport_issue_date", "Passport issue date", "date"),
    field("passport_expiry_date", "Passport expiry date", "date", true),
    field("passport_issuing_country", "Passport issuing country", "country"),
    field("passport_issuing_authority", "Passport issuing authority", "text"),
    field("email", "Email address", "text", true),
    field("phone", "Phone number", "text"),
    field("address", "Residential address", "textarea"),
  ];
}

function loadUniversalProfileSchema(): SchemaSource {
  return {
    sourceFile: "viza-fe/internal-website/components/application-steps/frequent-traveler-profile-fields.tsx",
    schema: "UNIVERSAL_PROFILE",
    country: "universal_profile",
    fields: universalProfileFields(),
  };
}

function loadSchemaSources(): SchemaSource[] {
  const sources: SchemaSource[] = [];
  const seedFiles = fs.readdirSync(BACKEND_SCRIPT_DIR)
    .filter((name) => /^seed-.*-form-fields\.ts$/.test(name))
    .filter((name) => name !== "seed-visa-form-fields.ts")
    .sort();

  for (const name of seedFiles) {
    const extracted = extractRowsFromSeedScript(path.join(BACKEND_SCRIPT_DIR, name));
    if (extracted) sources.push(extracted);
  }

  const b211a = loadB211aScrapedSchema();
  if (b211a) sources.push(b211a);
  sources.push(loadRagFallbackSchema());
  sources.push(loadUniversalProfileSchema());
  return sources;
}

function isImportantField(field: VisaFormFieldRow): boolean {
  return field.required || COMPLEX_FIELD_NAME_PATTERN.test(field.fieldName) || COMPLEX_FIELD_NAME_PATTERN.test(field.label);
}

function hasDependentOptions(field: VisaFormFieldRow): boolean {
  const rules = field.validationRules as {
    dataSource?: unknown;
    dependent_on?: unknown;
    live_control?: unknown;
    option_source?: unknown;
    options_source?: unknown;
    source?: unknown;
  } | null;
  return Boolean(
    rules?.dependent_on ||
      rules?.live_control === "dependent_select" ||
      rules?.source ||
      rules?.option_source ||
      rules?.options_source ||
      rules?.dataSource,
  );
}

function auditField(source: SchemaSource, field: VisaFormFieldRow): FieldResult {
  const labelZh = resolveLocalizedFieldLabel(field, "zh");
  const labelEn = resolveLocalizedFieldLabel(field, "en");
  const helperZh = getRuleText(field, ["helper_zh", "zh_helper"]);
  const placeholderZh = resolveLocalizedPlaceholder(field, "zh");
  const placeholderEn = resolveLocalizedPlaceholder(field, "en");
  const issues: AuditIssue[] = [];

  const addIssue = (
    issueType: string,
    severity: Severity,
    currentZh = labelZh,
    currentEn = labelEn,
    suggestedZh = labelZh,
    suggestedHelper = helperZh,
    suggestedEn = labelEn,
  ) => {
    issues.push({
      country: source.country,
      schema: source.schema,
      section: field.stepName ?? `Step ${field.stepNumber}`,
      field_id: field.fieldName,
      field_type: field.fieldType,
      current_label_zh: currentZh,
      current_label_en: currentEn,
      issue_type: issueType,
      severity,
      suggested_label_zh: suggestedZh,
      suggested_helper_zh: suggestedHelper,
      suggested_label_en: suggestedEn,
      pass_fail: severity === "blocking" ? "fail" : "pass",
    });
  };

  if (!field.fieldName.trim()) addIssue("missing_field_id", "blocking");
  if (!labelZh) addIssue("missing_label_zh", "blocking");
  if (!labelEn) addIssue("missing_label_en", "blocking");
  if (isEnglishOnlyText(labelZh)) addIssue("label_zh_english_only", "blocking");
  if (isChineseOnlyText(labelEn)) addIssue("label_en_chinese_only", "blocking");
  if (isImportantField(field) && isVagueChineseLabel(labelZh)) addIssue("vague_required_label_zh", "blocking");
  if (labelEn.length < 2) addIssue("label_en_not_meaningful", "blocking");

  const legacyLabelZh = getChineseLabel(field.label, field.fieldName);
  if ((isEnglishOnlyText(legacyLabelZh) || isVagueChineseLabel(legacyLabelZh)) && legacyLabelZh !== labelZh) {
    addIssue("legacy_runtime_label_fixed_by_contract", "info", legacyLabelZh);
  }

  if (needsDeclarationHelper(field) && !helperZh) {
    addIssue("complex_field_missing_helper_zh", field.required ? "blocking" : "warning");
  }

  if (TEXTUAL_FIELD_TYPES.has(field.fieldType) && !placeholderZh) {
    addIssue("placeholder_zh_missing", "warning");
  }
  if (TEXTUAL_FIELD_TYPES.has(field.fieldType) && !placeholderEn) {
    addIssue("placeholder_en_missing", "warning");
  }

  if (FIELD_TYPES_WITH_OPTIONS.has(field.fieldType)) {
    if (
      field.fieldType !== "checkbox" &&
      (!field.options || field.options.length === 0) &&
      !hasDependentOptions(field)
    ) {
      addIssue("option_list_missing", "warning");
    }

    for (const option of field.options ?? []) {
      const value = typeof option === "string" ? option : option.value;
      const optionZh = resolveOptionDisplayLabel(field.options, value, "zh") ?? "";
      const optionEn = resolveOptionDisplayLabel(field.options, value, "en") ?? "";
      if (!optionZh) addIssue("option_label_zh_missing", "blocking");
      if (!optionEn) addIssue("option_label_en_missing", "blocking");
      if (isEnglishOnlyText(optionZh)) addIssue("option_label_zh_english_only", "blocking", optionZh, optionEn);
      if (isChineseOnlyText(optionEn)) addIssue("option_label_en_chinese_only", "blocking", optionZh, optionEn);
    }
  }

  if (!resolveLocalizedFieldLabel(field, "zh") || !resolveLocalizedFieldLabel(field, "en")) {
    addIssue("review_label_resolution_failed", "blocking");
  }

  return {
    country: source.country,
    schema: source.schema,
    section: field.stepName ?? `Step ${field.stepNumber}`,
    field_id: field.fieldName,
    field_type: field.fieldType,
    label_zh: labelZh,
    label_en: labelEn,
    option_count: optionCount(field.options),
    issues,
    pass_fail: issues.some((issue) => issue.severity === "blocking") ? "fail" : "pass",
  };
}

function needsDeclarationHelper(field: VisaFormFieldRow): boolean {
  return (
    COMPLEX_FIELD_NAME_PATTERN.test(field.fieldName) ||
    field.label.length > 140 ||
    /I am aware|I declare|I undertake|consent/i.test(field.label)
  );
}

function escapeMd(value: unknown): string {
  return clean(value).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function writeReports(
  sources: SchemaSource[],
  adjacentSources: AdjacentSchemaSource[],
  results: FieldResult[],
  issues: AuditIssue[],
) {
  const blocking = issues.filter((issue) => issue.severity === "blocking");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  const info = issues.filter((issue) => issue.severity === "info");
  const optionTotal = results.reduce((sum, field) => sum + field.option_count, 0);

  const payload = {
    generatedAt: new Date().toISOString(),
    summary: {
      schemaFilesScanned: sources.length + adjacentSources.length,
      fieldSchemaSourcesScanned: sources.length,
      adjacentSchemaFilesScanned: adjacentSources.length,
      countriesFormsScanned: Array.from(new Set(sources.map((source) => `${source.country}:${source.schema}`))).sort(),
      fieldsAudited: results.length,
      dropdownRadioOptionsAudited: optionTotal,
      blockingIssues: blocking.length,
      warnings: warnings.length,
      info: info.length,
      pass: blocking.length === 0,
    },
    schemaFiles: sources.map((source) => ({
      sourceFile: source.sourceFile,
      country: source.country,
      schema: source.schema,
      fields: source.fields.length,
    })),
    adjacentSchemaFiles: adjacentSources,
    fields: results,
    issues,
  };

  fs.writeFileSync(REPORT_JSON, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const md: string[] = [];
  md.push("# Bilingual Schema Clarity Audit");
  md.push("");
  md.push(`Generated: ${payload.generatedAt}`);
  md.push("");
  md.push("## Summary");
  md.push("");
  md.push(`- Schema files scanned: ${payload.summary.schemaFilesScanned}`);
  md.push(`- Field schema sources scanned: ${sources.length}`);
  md.push(`- Adjacent schema/rendering files listed: ${adjacentSources.length}`);
  md.push(`- Countries/forms scanned: ${payload.summary.countriesFormsScanned.length}`);
  md.push(`- Fields audited: ${results.length}`);
  md.push(`- Dropdown/radio/checkbox options audited: ${optionTotal}`);
  md.push(`- Blocking issues: ${blocking.length}`);
  md.push(`- Warnings: ${warnings.length}`);
  md.push(`- Info findings: ${info.length}`);
  md.push("");
  md.push("## Schema Files");
  md.push("");
  md.push("| source | country | schema | fields |");
  md.push("| --- | --- | --- | ---: |");
  for (const source of payload.schemaFiles) {
    md.push(`| ${escapeMd(source.sourceFile)} | ${escapeMd(source.country)} | ${escapeMd(source.schema)} | ${source.fields} |`);
  }
  md.push("");
  md.push("## Adjacent Schema And Rendering Sources");
  md.push("");
  md.push("| source | purpose | coverage |");
  md.push("| --- | --- | --- |");
  for (const source of payload.adjacentSchemaFiles) {
    md.push(`| ${escapeMd(source.sourceFile)} | ${escapeMd(source.purpose)} | ${escapeMd(source.coverage)} |`);
  }
  md.push("");
  md.push("## Issues");
  md.push("");
  if (issues.length === 0) {
    md.push("No issues found.");
  } else {
    md.push("| country | schema | section | field_id | field_type | current_label_zh | current_label_en | issue_type | severity | suggested_label_zh | suggested_helper_zh | suggested_label_en | pass_fail |");
    md.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
    for (const issue of issues) {
      md.push([
        issue.country,
        issue.schema,
        issue.section,
        issue.field_id,
        issue.field_type,
        issue.current_label_zh,
        issue.current_label_en,
        issue.issue_type,
        issue.severity,
        issue.suggested_label_zh,
        issue.suggested_helper_zh,
        issue.suggested_label_en,
        issue.pass_fail,
      ].map(escapeMd).join(" | ").replace(/^/, "| ").replace(/$/, " |"));
    }
  }
  md.push("");
  md.push("## Field Pass Matrix");
  md.push("");
  md.push("| country | schema | section | field_id | field_type | label_zh | label_en | options | pass_fail |");
  md.push("| --- | --- | --- | --- | --- | --- | --- | ---: | --- |");
  for (const result of results) {
    md.push([
      result.country,
      result.schema,
      result.section,
      result.field_id,
      result.field_type,
      result.label_zh,
      result.label_en,
      String(result.option_count),
      result.pass_fail,
    ].map(escapeMd).join(" | ").replace(/^/, "| ").replace(/$/, " |"));
  }
  md.push("");

  fs.writeFileSync(REPORT_MD, `${md.join("\n")}\n`, "utf8");
}

function main() {
  const sources = loadSchemaSources();
  const adjacentSources = discoverAdjacentSchemaSources();
  const results = sources.flatMap((source) => source.fields.map((field) => auditField(source, field)));
  const issues = results.flatMap((result) => result.issues);
  writeReports(sources, adjacentSources, results, issues);

  const blocking = issues.filter((issue) => issue.severity === "blocking");
  const optionTotal = results.reduce((sum, field) => sum + field.option_count, 0);
  console.log(`Audited ${results.length} fields and ${optionTotal} options across ${sources.length} field schema sources.`);
  console.log(`Listed ${adjacentSources.length} adjacent schema/rendering sources.`);
  console.log(`Reports written: ${normalizePathForReport(REPORT_JSON)}, ${normalizePathForReport(REPORT_MD)}`);
  console.log(`Blocking issues: ${blocking.length}`);

  if (blocking.length > 0) {
    process.exitCode = 1;
  }
}

main();
