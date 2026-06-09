import type { GenericSubmissionResult } from "../submission-result";
import type {
  CountrySubmissionApplication,
  CountrySubmissionProvider,
  FieldCategory,
  FieldRequirement,
  ImplementationStatus,
  SubmissionPayload,
  SubmitOptions,
  ValidationResult,
} from "./types";

interface ProviderConfig {
  countryCode: string;
  countryAliases: string[];
  displayName: string;
  supportedVisaTypes: string[];
  implementationStatus: ImplementationStatus;
  dryRunAvailable: boolean;
  sandboxAvailable: boolean;
  realSubmitAvailable: boolean;
  routeStatus: CountrySubmissionProvider["routeStatus"];
  serviceFiles?: string[];
  schemaFiles?: string[];
  mapperFiles?: string[];
  automationFiles?: string[];
  notes: string;
  requiredFields?: FieldRequirement[];
  extraRequiredFields?: FieldRequirement[];
  includeAllAnswersInPayload?: boolean;
  dryRunConfirmationPrefix?: string;
}

const SCHEMA_VERSION = "2026-06-05.base";

const COMMON_REQUIRED_FIELDS: FieldRequirement[] = [
  { key: "profile.fullName", label: "Full name", category: "personal", required: true },
  { key: "profile.dateOfBirth", label: "Date of birth", category: "personal", required: true },
  { key: "profile.gender", label: "Gender", category: "personal", required: true },
  { key: "profile.nationality", label: "Nationality", category: "personal", required: true },
  { key: "profile.passportNumber", label: "Passport number", category: "passport", required: true },
  { key: "profile.passportIssueDate", label: "Passport issue date", category: "passport", required: true },
  { key: "profile.passportExpiryDate", label: "Passport expiry date", category: "passport", required: true },
  { key: "profile.email", label: "Email", category: "contact", required: true },
  { key: "profile.phone", label: "Phone", category: "contact", required: true },
  { key: "profile.address", label: "Address", category: "contact", required: true },
  { key: "profile.occupation", label: "Occupation", category: "personal", required: true },
  { key: "trip.arrivalDate", label: "Arrival date", category: "trip", required: true },
  { key: "trip.departureDate", label: "Departure date", category: "trip", required: true },
  { key: "trip.purpose", label: "Purpose of travel", category: "trip", required: true },
  { key: "trip.accommodationName", label: "Accommodation", category: "trip", required: true },
];

const COMMON_OPTIONAL_FIELDS: FieldRequirement[] = [
  { key: "profile.employerOrSchool", label: "Employer or school", category: "personal", required: false },
  { key: "trip.destinationCity", label: "Destination city", category: "trip", required: false },
  { key: "trip.funding", label: "Funding", category: "trip", required: false },
  { key: "trip.budget", label: "Travel budget", category: "trip", required: false },
  { key: "has_criminal_record", label: "Criminal or security history", category: "security", required: false },
  { key: "previous_visa_refusal", label: "Previous visa refusal", category: "security", required: false },
  { key: "overstay_history", label: "Previous overstay", category: "security", required: false },
];

const US_DS160_REQUIRED_FIELDS: FieldRequirement[] = [
  ...COMMON_REQUIRED_FIELDS.filter((field) => !field.key.startsWith("trip.")),
  ...COMMON_OPTIONAL_FIELDS,
  { key: "answers.has_specific_travel_plans", label: "Specific travel plans", category: "trip", required: true },
  { key: "answers.purpose_of_trip", label: "Purpose of trip", category: "trip", required: true },
  {
    key: "answers.purpose_of_trip_specify",
    label: "Purpose of trip specify",
    category: "trip",
    required: true,
    condition: { key: "answers.purpose_of_trip", equals: "B" },
  },
  {
    key: "answers.arrival_date",
    label: "Arrival date",
    category: "trip",
    required: true,
    condition: { key: "answers.has_specific_travel_plans", equals: "yes" },
  },
  {
    key: "answers.intended_arrival_date",
    label: "Intended arrival date",
    category: "trip",
    required: true,
    condition: { key: "answers.has_specific_travel_plans", equals: "no" },
  },
  {
    key: "answers.intended_length_of_stay_value",
    label: "Intended length of stay",
    category: "trip",
    required: true,
    condition: { key: "answers.has_specific_travel_plans", equals: "no" },
  },
  {
    key: "answers.intended_length_of_stay_unit",
    label: "Intended length of stay unit",
    category: "trip",
    required: true,
    condition: { key: "answers.has_specific_travel_plans", equals: "no" },
  },
];

function vnField(
  key: string,
  label: string,
  category: FieldCategory,
  condition?: FieldRequirement["condition"],
): FieldRequirement {
  return { key: `answers.${key}`, label, category, required: true, condition };
}

const WHEN_MULTIPLE_NATIONALITIES = {
  key: "answers.has_multiple_nationalities",
  equals: "yes",
};
const WHEN_VIOLATED_VIETNAM_LAWS = {
  key: "answers.has_violated_vietnam_laws",
  equals: "yes",
};
const WHEN_VISITED_VIETNAM_LAST_YEAR = {
  key: "answers.visited_vietnam_in_last_year",
  equals: "yes",
};
const WHEN_HAS_RELATIVES_IN_VIETNAM = {
  key: "answers.has_relatives_in_vietnam",
  equals: "yes",
};

const VN_REQUIRED_FIELDS: FieldRequirement[] = [
  vnField("surname", "Surname", "personal"),
  vnField("given_name", "Middle and given name", "personal"),
  vnField("date_of_birth", "Date of birth", "personal"),
  vnField("sex", "Sex", "personal"),
  vnField("nationality", "Nationality", "personal"),
  vnField("email_address", "Email", "contact"),
  vnField("re_enter_email_address", "Re-enter email", "contact"),
  vnField("religion", "Religion", "personal"),
  vnField("place_of_birth", "Place of birth", "personal"),
  vnField("has_multiple_nationalities", "Other nationalities declaration", "security"),
  vnField("other_nationality", "Other nationality", "personal", WHEN_MULTIPLE_NATIONALITIES),
  vnField("has_violated_vietnam_laws", "Vietnam law violation declaration", "security"),
  vnField("violation_of_vietnam_laws_details", "Vietnam law violation details", "security", WHEN_VIOLATED_VIETNAM_LAWS),
  vnField("visa_type_requested", "Type of visa requested", "trip"),
  vnField("visa_valid_from", "E-visa valid from", "trip"),
  vnField("visa_valid_to", "E-visa valid to", "trip"),
  vnField("passport_number", "Passport number", "passport"),
  vnField("passport_type", "Passport type", "passport"),
  vnField("passport_issue_date", "Passport issue date", "passport"),
  vnField("passport_expiry_date", "Passport expiry date", "passport"),
  vnField("permanent_residential_address", "Permanent residential address", "contact"),
  vnField("contact_address", "Contact address", "contact"),
  vnField("telephone_number", "Telephone number", "contact"),
  vnField("emergency_contact_full_name", "Emergency contact full name", "contact"),
  vnField("emergency_contact_current_address", "Emergency contact address", "contact"),
  vnField("emergency_contact_telephone", "Emergency contact telephone", "contact"),
  vnField("emergency_contact_relationship", "Emergency contact relationship", "contact"),
  vnField("purpose_of_entry", "Purpose of entry", "trip"),
  vnField("intended_date_of_entry", "Intended date of entry", "trip"),
  vnField("intended_length_of_stay", "Intended length of stay", "trip"),
  vnField("residential_address_in_vietnam", "Residential address in Viet Nam", "trip"),
  vnField("intended_province_city", "Province/city", "trip"),
  vnField("intended_ward_commune", "Ward/commune", "trip"),
  vnField("intended_border_gate_of_entry", "Intended border gate of entry", "trip"),
  vnField("intended_border_gate_of_exit", "Intended border gate of exit", "trip"),
  vnField("declaration_temporary_residence", "Temporary residence declaration", "trip"),
  vnField("visited_vietnam_in_last_year", "Previous Viet Nam visit declaration", "trip"),
  vnField("visited_vietnam_purpose_detail", "Previous Viet Nam visit details", "trip", WHEN_VISITED_VIETNAM_LAST_YEAR),
  vnField("has_relatives_in_vietnam", "Relatives in Viet Nam declaration", "trip"),
  vnField("relative_full_name_in_vn", "Relative full name", "trip", WHEN_HAS_RELATIVES_IN_VIETNAM),
  vnField("relative_date_of_birth", "Relative date of birth", "trip", WHEN_HAS_RELATIVES_IN_VIETNAM),
  vnField("relative_nationality", "Relative nationality", "trip", WHEN_HAS_RELATIVES_IN_VIETNAM),
  vnField("relative_relationship", "Relative relationship", "trip", WHEN_HAS_RELATIVES_IN_VIETNAM),
  vnField("relative_address_in_vn", "Relative address", "trip", WHEN_HAS_RELATIVES_IN_VIETNAM),
  vnField("final_declaration", "Final declaration", "security"),
];

const CONFIGS: ProviderConfig[] = [
  {
    countryCode: "US",
    countryAliases: ["us", "usa", "united_states", "united states", "united_states_of_america"],
    displayName: "United States DS-160",
    supportedVisaTypes: ["DS160", "B1_B2", "US_B1_B2"],
    implementationStatus: "implemented",
    dryRunAvailable: true,
    sandboxAvailable: false,
    realSubmitAvailable: true,
    routeStatus: "submission_queue_dispatched",
    serviceFiles: ["src/ceac/**"],
    schemaFiles: ["src/ds160-form-mappings.ts", "../agent-backend/scripts/seed-ds160-form-fields.ts"],
    mapperFiles: ["src/ds160-derive-answers.ts"],
    automationFiles: ["src/ceac/orchestrator.ts", "src/index.ts"],
    requiredFields: US_DS160_REQUIRED_FIELDS,
    includeAllAnswersInPayload: true,
    dryRunConfirmationPrefix: "DRYRUN-DS160",
    notes: "Primary reference flow. Runner stops at CEAC sign-and-submit handoff.",
  },
  {
    countryCode: "SCHENGEN",
    countryAliases: [
      "fr",
      "france",
      "european_union",
      "schengen",
      "germany",
      "italy",
      "spain",
      "netherlands",
      "switzerland",
    ],
    displayName: "Schengen short-stay / France-Visas",
    supportedVisaTypes: ["EU_SCHENGEN_C_SHORT_STAY", "SCHENGEN_C"],
    implementationStatus: "implemented",
    dryRunAvailable: true,
    sandboxAvailable: false,
    realSubmitAvailable: true,
    routeStatus: "submission_queue_dispatched",
    serviceFiles: ["src/france-visas/**"],
    schemaFiles: ["../agent-backend/scripts/seed-eu-schengen-c-short-stay-form-fields.ts"],
    mapperFiles: ["src/france-visas/field-mappings.ts", "src/france-visas/normalize.ts"],
    automationFiles: ["src/france-visas/run.ts", "src/index.ts"],
    notes: "Primary reference flow for France. Other Schengen destinations currently share the visa type but not a destination-specific VFS runner.",
  },
  {
    countryCode: "AU",
    countryAliases: ["au", "australia"],
    displayName: "Australia Visitor 600",
    supportedVisaTypes: ["AU_VISITOR_600"],
    implementationStatus: "partial",
    dryRunAvailable: true,
    sandboxAvailable: false,
    realSubmitAvailable: false,
    routeStatus: "submission_queue_dispatched",
    serviceFiles: ["src/au-visitor/**"],
    schemaFiles: ["../agent-backend/scripts/seed-au-visitor-600-form-fields.ts"],
    mapperFiles: ["src/au-visitor/normalize.ts", "src/au-visitor/selectors.ts"],
    automationFiles: ["src/au-visitor/run.ts", "src/au-visitor/orchestrator.ts"],
    notes: "Walks ImmiAccount to Review and stops before applicant-controlled submit.",
  },
  {
    countryCode: "VN",
    countryAliases: ["vn", "vietnam"],
    displayName: "Vietnam e-Visa",
    supportedVisaTypes: ["VN_E_VISA"],
    implementationStatus: "partial",
    dryRunAvailable: true,
    sandboxAvailable: false,
    realSubmitAvailable: false,
    routeStatus: "submission_queue_dispatched",
    serviceFiles: ["src/vietnam/**"],
    schemaFiles: ["../agent-backend/scripts/seed-vn-e-visa-form-fields.ts"],
    mapperFiles: ["src/vietnam/field-mappings.ts"],
    automationFiles: ["src/vietnam/run.ts"],
    requiredFields: [
      ...COMMON_REQUIRED_FIELDS,
      ...COMMON_OPTIONAL_FIELDS,
      ...VN_REQUIRED_FIELDS,
    ],
    includeAllAnswersInPayload: true,
    dryRunConfirmationPrefix: "DRYRUN-VIETNAM",
    notes: "Dry-run validates the VN_E_VISA answer schema and runner is designed to halt before pay/submit; email-PDF capture remains deferred.",
  },
  {
    countryCode: "UK",
    countryAliases: ["uk", "gb", "united_kingdom", "united kingdom"],
    displayName: "UK Standard Visitor",
    supportedVisaTypes: ["UK_STANDARD_VISITOR"],
    implementationStatus: "partial",
    dryRunAvailable: true,
    sandboxAvailable: false,
    realSubmitAvailable: false,
    routeStatus: "submission_queue_dispatched",
    serviceFiles: ["src/uk/**"],
    schemaFiles: ["../agent-backend/scripts/seed-uk-standard-visitor-form-fields.ts"],
    mapperFiles: ["src/uk/field-mappings.ts"],
    automationFiles: ["src/uk/orchestrator.ts", "src/uk/resume.ts"],
    notes: "Pre-auth/resume scaffold only; post-auth selectors are not fully mapped.",
  },
  {
    countryCode: "ID",
    countryAliases: ["id", "indonesia"],
    displayName: "Indonesia e-Visa",
    supportedVisaTypes: ["B211A", "ID_C1_TOURIST"],
    implementationStatus: "dry_run_only",
    dryRunAvailable: true,
    sandboxAvailable: false,
    realSubmitAvailable: false,
    routeStatus: "frontend_only",
    serviceFiles: ["src/form-mappings.ts"],
    schemaFiles: ["../agent-backend/scripts/seed-id-c1-tourist-form-fields.ts"],
    mapperFiles: ["src/form-mappings.ts"],
    automationFiles: [],
    notes: "Legacy default filler existed but clicked final submit; now dry-run/unsupported unless explicitly enabled.",
  },
  {
    countryCode: "EG",
    countryAliases: ["eg", "egypt"],
    displayName: "Egypt e-Visa",
    supportedVisaTypes: ["EG_E_VISA"],
    implementationStatus: "blocked",
    dryRunAvailable: true,
    sandboxAvailable: false,
    realSubmitAvailable: false,
    routeStatus: "frontend_only",
    serviceFiles: ["src/egypt/form-recon.ts"],
    schemaFiles: ["../agent-backend/scripts/seed-eg-e-visa-form-fields.ts"],
    mapperFiles: [],
    automationFiles: ["src/egypt/form-recon.ts"],
    notes: "Wizard exists; authenticated automation is blocked on preregistered portal account/recon.",
  },
  {
    countryCode: "JP",
    countryAliases: ["jp", "japan"],
    displayName: "Japan tourist paper form",
    supportedVisaTypes: ["JP_TOURIST"],
    implementationStatus: "dry_run_only",
    dryRunAvailable: true,
    sandboxAvailable: false,
    realSubmitAvailable: false,
    routeStatus: "frontend_only",
    serviceFiles: [],
    schemaFiles: ["../agent-backend/scripts/seed-jp-tourist-form-fields.ts"],
    mapperFiles: [],
    automationFiles: [],
    notes: "No online submission portal in scope; frontend renders MOFA Form A PDF.",
  },
  {
    countryCode: "IT_VFS_CN",
    countryAliases: ["it_vfs_cn", "italy-vfs-cn"],
    displayName: "Italy VFS China corridor",
    supportedVisaTypes: ["EU_SCHENGEN_C_SHORT_STAY"],
    implementationStatus: "blocked",
    dryRunAvailable: true,
    sandboxAvailable: false,
    realSubmitAvailable: false,
    routeStatus: "module_only",
    serviceFiles: ["src/italy-vfs-cn/**"],
    schemaFiles: ["../agent-backend/scripts/seed-eu-schengen-c-short-stay-form-fields.ts"],
    mapperFiles: ["src/italy-vfs-cn/selectors.ts", "src/italy-vfs-cn/normalize.ts"],
    automationFiles: ["scripts/walk-italy-vfs-cn.ts"],
    notes: "Selector and normalization layer exists; orchestrator blocked on credentials and PDF source.",
  },
  {
    countryCode: "CA",
    countryAliases: ["ca", "canada"],
    displayName: "Canada TRV",
    supportedVisaTypes: ["CA_TRV"],
    implementationStatus: "not_started",
    dryRunAvailable: true,
    sandboxAvailable: false,
    realSubmitAvailable: false,
    routeStatus: "package_catalog_only",
    schemaFiles: ["../agent-backend/scripts/seed-ca-trv-form-fields.ts"],
    notes: "Package and schema seed exist; no submission-service runner.",
  },
  {
    countryCode: "KR",
    countryAliases: ["kr", "south_korea", "korea"],
    displayName: "Korea C-3-9",
    supportedVisaTypes: ["KR_C39_SHORT_TERM_VISIT"],
    implementationStatus: "not_started",
    dryRunAvailable: true,
    sandboxAvailable: false,
    realSubmitAvailable: false,
    routeStatus: "package_catalog_only",
    schemaFiles: ["../agent-backend/scripts/seed-kr-c39-short-term-visit-form-fields.ts"],
    notes: "Package and schema seed exist; no submission-service runner.",
  },
  {
    countryCode: "AE",
    countryAliases: ["ae", "uae", "united_arab_emirates"],
    displayName: "UAE tourist visa",
    supportedVisaTypes: ["AE_TOURIST_VISA"],
    implementationStatus: "not_started",
    dryRunAvailable: true,
    sandboxAvailable: false,
    realSubmitAvailable: false,
    routeStatus: "package_catalog_only",
    schemaFiles: ["../agent-backend/scripts/seed-ae-tourist-visa-form-fields.ts"],
    notes: "Package and schema seed exist; no submission-service runner.",
  },
  {
    countryCode: "SG",
    countryAliases: ["sg", "singapore"],
    displayName: "Singapore visitor visa",
    supportedVisaTypes: ["SG_VISITOR_VISA"],
    implementationStatus: "not_started",
    dryRunAvailable: true,
    sandboxAvailable: false,
    realSubmitAvailable: false,
    routeStatus: "package_catalog_only",
    schemaFiles: ["../agent-backend/scripts/seed-sg-visitor-visa-form-fields.ts"],
    notes: "Package and schema seed exist; no submission-service runner.",
  },
  {
    countryCode: "IN",
    countryAliases: ["in", "india"],
    displayName: "India e-Visa",
    supportedVisaTypes: ["IN_E_VISA"],
    implementationStatus: "partial",
    dryRunAvailable: true,
    sandboxAvailable: false,
    realSubmitAvailable: false,
    routeStatus: "module_only",
    serviceFiles: ["src/in/**"],
    schemaFiles: ["../agent-backend/scripts/seed-in-e-visa-form-fields.ts"],
    mapperFiles: ["src/in/selectors.ts"],
    automationFiles: ["src/in/runner.ts", "scripts/in-smoke.ts"],
    notes: "Scaffold/smoke module exists but is not dispatched by the main worker.",
  },
  {
    countryCode: "LK",
    countryAliases: ["lk", "sri_lanka"],
    displayName: "Sri Lanka ETA",
    supportedVisaTypes: ["LK_ETA"],
    implementationStatus: "partial",
    dryRunAvailable: true,
    sandboxAvailable: false,
    realSubmitAvailable: false,
    routeStatus: "module_only",
    serviceFiles: ["src/lk/**"],
    schemaFiles: ["../agent-backend/scripts/seed-lk-eta-form-fields.ts"],
    mapperFiles: ["src/lk/selectors.ts"],
    automationFiles: ["src/lk/runner.ts", "scripts/lk-smoke.ts"],
    notes: "Scaffold/smoke module exists but is not dispatched by the main worker.",
  },
  {
    countryCode: "KH",
    countryAliases: ["kh", "cambodia"],
    displayName: "Cambodia e-Visa",
    supportedVisaTypes: ["KH_TOURIST_E_VISA"],
    implementationStatus: "partial",
    dryRunAvailable: true,
    sandboxAvailable: false,
    realSubmitAvailable: false,
    routeStatus: "module_only",
    serviceFiles: ["src/kh/**"],
    schemaFiles: ["../agent-backend/scripts/seed-kh-e-visa-form-fields.ts"],
    mapperFiles: ["src/kh/selectors.ts"],
    automationFiles: ["src/kh/runner.ts", "scripts/kh-smoke.ts"],
    notes: "Scaffold/smoke module exists but is not dispatched by the main worker.",
  },
  {
    countryCode: "LA",
    countryAliases: ["la", "laos"],
    displayName: "Laos e-Visa",
    supportedVisaTypes: ["LA_TOURIST_E_VISA"],
    implementationStatus: "partial",
    dryRunAvailable: true,
    sandboxAvailable: false,
    realSubmitAvailable: false,
    routeStatus: "module_only",
    serviceFiles: ["src/la/**"],
    schemaFiles: ["../agent-backend/scripts/seed-la-e-visa-form-fields.ts"],
    mapperFiles: ["src/la/selectors.ts"],
    automationFiles: ["src/la/runner.ts", "scripts/la-smoke.ts"],
    notes: "Scaffold/smoke module exists but is not dispatched by the main worker.",
  },
  {
    countryCode: "ZA",
    countryAliases: ["za", "south_africa"],
    displayName: "South Africa visitor visa",
    supportedVisaTypes: ["ZA_VISITOR_VISA"],
    implementationStatus: "partial",
    dryRunAvailable: true,
    sandboxAvailable: false,
    realSubmitAvailable: false,
    routeStatus: "module_only",
    serviceFiles: ["src/za/**"],
    schemaFiles: ["../agent-backend/scripts/seed-za-visitor-visa-form-fields.ts"],
    mapperFiles: ["src/za/selectors.ts"],
    automationFiles: ["src/za/runner.ts", "scripts/za-smoke.ts"],
    notes: "Scaffold/smoke module exists but is not dispatched by the main worker.",
  },
  ...[
    ["TH", "Thailand tourist e-Visa", "TH_TOURIST_E_VISA", "thailand", "seed-th-tourist-e-visa-form-fields.ts"],
    ["MY", "Malaysia tourist eVisa", "MY_TOURIST_E_VISA", "malaysia", "seed-my-tourist-e-visa-form-fields.ts"],
    ["HK", "Hong Kong visit visa", "HK_VISIT_VISA", "hong_kong", "seed-hk-visit-visa-form-fields.ts"],
    ["MO", "Macau visit visa", "MO_VISIT_VISA", "macau", "seed-mo-visit-visa-form-fields.ts"],
    ["NZ", "New Zealand visitor visa", "NZ_VISITOR_VISA", "new_zealand", "seed-nz-visitor-visa-form-fields.ts"],
    ["RU", "Russia unified e-Visa", "RU_E_VISA", "russia", "seed-ru-e-visa-form-fields.ts"],
    ["TR", "Turkiye tourist e-Visa", "TR_E_VISA", "turkey", "seed-tr-e-visa-form-fields.ts"],
    ["MV", "Maldives IMUGA", "MV_IMUGA", "maldives", "seed-mv-imuga-form-fields.ts"],
    ["PH", "Philippines temporary visitor visa", "PH_TEMPORARY_VISITOR_VISA", "philippines", "seed-ph-temporary-visitor-visa-form-fields.ts"],
  ].map(([countryCode, displayName, visaType, alias, seedFile]) => ({
    countryCode,
    countryAliases: [countryCode.toLowerCase(), alias],
    displayName,
    supportedVisaTypes: [visaType],
    implementationStatus: "not_started" as ImplementationStatus,
    dryRunAvailable: true,
    sandboxAvailable: false,
    realSubmitAvailable: false,
    routeStatus: "package_catalog_only" as const,
    schemaFiles: [`../agent-backend/scripts/${seedFile}`],
    notes: "Package and schema seed exist; no submission-service runner.",
  })),
];

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function readAnswer(application: CountrySubmissionApplication, key: string): string | null {
  const value = application.answers?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeRequirementValue(value: string): string {
  const normalized = normalizeToken(value);
  if (["1", "true", "on", "agree", "i_agree", "y"].includes(normalized)) return "yes";
  if (["0", "false", "off", "disagree", "n"].includes(normalized)) return "no";
  return normalized;
}

function readStringValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function readValueByKey(application: CountrySubmissionApplication, key: string): string | null {
  const [scope, ...path] = key.split(".");
  const field = path.join(".");
  if (scope === "profile" && field) {
    const profile = application.profile as Record<string, unknown>;
    return readStringValue(profile[field]);
  }
  if (scope === "trip" && field) {
    const trip = application.trip as Record<string, unknown>;
    return readStringValue(trip[field]);
  }
  if ((scope === "answers" || scope === "answer") && field) {
    return readAnswer(application, field);
  }
  if (scope === "metadata" && path.length > 0) {
    let current: unknown = application.metadata;
    for (const segment of path) {
      if (!current || typeof current !== "object") return null;
      current = (current as Record<string, unknown>)[segment];
    }
    return readStringValue(current);
  }
  return readAnswer(application, key);
}

function readRequirementValue(
  application: CountrySubmissionApplication,
  requirement: FieldRequirement,
): string | null {
  return readValueByKey(application, requirement.key);
}

function shouldValidateRequirement(
  application: CountrySubmissionApplication,
  requirement: FieldRequirement,
): boolean {
  if (!requirement.condition) return true;
  const actual = readValueByKey(application, requirement.condition.key);
  return actual
    ? normalizeRequirementValue(actual) === normalizeRequirementValue(requirement.condition.equals)
    : false;
}

function validateRequiredFields(
  application: CountrySubmissionApplication,
  requiredFields: FieldRequirement[],
): ValidationResult {
  const issues = requiredFields
    .filter((field) => field.required && shouldValidateRequirement(application, field))
    .filter((field) => !readRequirementValue(application, field))
    .map((field) => ({
      field: field.key,
      category: field.category as FieldCategory,
      message: `${field.label} is required for ${application.visaType}`,
    }));

  return {
    ok: issues.length === 0,
    issues,
    missingRequiredFields: issues.map((issue) => issue.field),
  };
}

function buildCountrySpecificPayload(
  application: CountrySubmissionApplication,
  includeAllAnswers = false,
): Record<string, string> {
  const answers = application.answers ?? {};
  const countryPrefix = normalizeToken(application.countryCode);
  const visaPrefix = normalizeToken(application.visaType);
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(answers)) {
    if (!value) continue;
    const normalizedKey = normalizeToken(key);
    if (
      includeAllAnswers ||
      normalizedKey.startsWith(`${countryPrefix}_`) ||
      normalizedKey.startsWith(`${visaPrefix}_`) ||
      normalizedKey.includes("criminal") ||
      normalizedKey.includes("overstay") ||
      normalizedKey.includes("refused_visa")
    ) {
      output[key] = value;
    }
  }
  return output;
}

function idempotencyKeyFor(
  application: CountrySubmissionApplication,
  provider: Pick<CountrySubmissionProvider, "countryCode">,
  explicitKey?: string,
): string {
  if (explicitKey?.trim()) return explicitKey.trim();
  return [
    "dry-run",
    provider.countryCode,
    application.visaType,
    application.applicationId,
  ].join(":");
}

function buildDryRunConfirmation(
  countryCode: string,
  applicationId: string,
  prefix?: string,
): string {
  const compactId = applicationId.replace(/[^a-z0-9]/gi, "").slice(0, 12).toUpperCase();
  const timestampedPrefixes = new Set(["DRYRUN-DS160", "DRYRUN-VIETNAM"]);
  const timestamp = prefix && timestampedPrefixes.has(prefix)
    ? `-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`
    : "";
  return `${prefix ?? `MOCK-${countryCode}`}-${compactId || "APPLICATION"}${timestamp}`;
}

function createProvider(config: ProviderConfig): CountrySubmissionProvider {
  const requiredFields = config.requiredFields ?? [
    ...COMMON_REQUIRED_FIELDS,
    ...COMMON_OPTIONAL_FIELDS,
    ...(config.extraRequiredFields ?? []),
  ];

  return {
    countryCode: config.countryCode,
    displayName: config.displayName,
    supportedVisaTypes: config.supportedVisaTypes,
    requiredFields,
    schemaVersion: SCHEMA_VERSION,
    implementationStatus: config.implementationStatus,
    dryRunAvailable: config.dryRunAvailable,
    sandboxAvailable: config.sandboxAvailable,
    realSubmitAvailable: config.realSubmitAvailable,
    routeStatus: config.routeStatus,
    serviceFiles: config.serviceFiles ?? [],
    schemaFiles: config.schemaFiles ?? [],
    mapperFiles: config.mapperFiles ?? [],
    automationFiles: config.automationFiles ?? [],
    notes: config.notes,
    validate(application) {
      return validateRequiredFields(application, requiredFields);
    },
    mapToSubmissionPayload(application, options = { dryRun: true }) {
      return {
        payloadVersion: SCHEMA_VERSION,
        countryCode: config.countryCode,
        visaType: application.visaType,
        applicationId: application.applicationId,
        dryRun: options.dryRun,
        idempotencyKey: idempotencyKeyFor(application, { countryCode: config.countryCode }, options.idempotencyKey),
        personal: application.profile,
        trip: {
          ...application.trip,
          destinationCountry: application.trip.destinationCountry ?? config.displayName,
        },
        countrySpecific: buildCountrySpecificPayload(application, config.includeAllAnswersInPayload),
        metadata: {
          ...(application.metadata ?? {}),
          implementationStatus: config.implementationStatus,
          routeStatus: config.routeStatus,
        },
      };
    },
    async submit(payload, options) {
      if (!options.dryRun || !config.dryRunAvailable) {
        return buildUnsupportedSubmissionResult(
          payload.applicationId,
          config.countryCode,
          payload.visaType,
          config.implementationStatus,
        );
      }
      return {
        country: "GENERIC",
        targetCountry: config.countryCode,
        visaType: payload.visaType,
        status: "submitted_mock",
        mode: "dry_run",
        applicationId: payload.applicationId,
        confirmationNumber: buildDryRunConfirmation(
          config.countryCode,
          payload.applicationId,
          config.dryRunConfirmationPrefix,
        ),
        implementationStatus: config.implementationStatus,
        message: `Dry-run submission completed for ${config.displayName}. Real external submission was not performed.`,
      };
    },
  };
}

const PROVIDERS = CONFIGS.map(createProvider);

export function listCountrySubmissionProviders(): CountrySubmissionProvider[] {
  return [...PROVIDERS];
}

export function getCountrySubmissionProvider(
  countryOrCode: string | null | undefined,
  visaType?: string | null,
): CountrySubmissionProvider | null {
  const normalizedCountry = countryOrCode ? normalizeToken(countryOrCode) : null;
  const normalizedVisa = visaType ? normalizeToken(visaType) : null;

  if (normalizedCountry && normalizedVisa) {
    const match = CONFIGS.find(
      (config) =>
        config.countryAliases.map(normalizeToken).includes(normalizedCountry) &&
        config.supportedVisaTypes.map(normalizeToken).includes(normalizedVisa),
    );
    if (match) return PROVIDERS[CONFIGS.indexOf(match)] ?? null;
  }

  if (normalizedVisa) {
    const match = CONFIGS.find((config) =>
      config.supportedVisaTypes.map(normalizeToken).includes(normalizedVisa),
    );
    if (match) return PROVIDERS[CONFIGS.indexOf(match)] ?? null;
  }

  if (normalizedCountry) {
    const match = CONFIGS.find((config) =>
      config.countryAliases.map(normalizeToken).includes(normalizedCountry),
    );
    if (match) return PROVIDERS[CONFIGS.indexOf(match)] ?? null;
  }

  return null;
}

export function buildUnsupportedSubmissionResult(
  applicationId: string,
  targetCountry: string,
  visaType: string,
  implementationStatus: ImplementationStatus = "not_started",
  message = "Submission for this country is not implemented yet.",
): GenericSubmissionResult {
  return {
    country: "GENERIC",
    targetCountry,
    visaType,
    status: "unsupported",
    mode: "dry_run",
    applicationId,
    implementationStatus,
    message,
  };
}

export async function runDryRunSubmission(
  application: CountrySubmissionApplication,
  options: SubmitOptions = { dryRun: true },
): Promise<GenericSubmissionResult> {
  const provider = getCountrySubmissionProvider(application.countryCode, application.visaType);
  if (!provider) {
    return buildUnsupportedSubmissionResult(
      application.applicationId,
      application.countryCode,
      application.visaType,
    );
  }

  const validation = provider.validate(application);
  if (!validation.ok) {
    return {
      country: "GENERIC",
      targetCountry: provider.countryCode,
      visaType: application.visaType,
      status: "unsupported",
      mode: "dry_run",
      applicationId: application.applicationId,
      implementationStatus: provider.implementationStatus,
      message: `Dry-run validation failed: ${validation.missingRequiredFields.join(", ")}`,
    };
  }

  const payload: SubmissionPayload = provider.mapToSubmissionPayload(application, options);
  return provider.submit(payload, options);
}
