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
  extraRequiredFields?: FieldRequirement[];
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
    notes: "Runner is designed to halt before pay/submit; email-PDF capture remains deferred.",
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

function readRequirementValue(
  application: CountrySubmissionApplication,
  requirement: FieldRequirement,
): string | null {
  const [scope, field] = requirement.key.split(".");
  if (scope === "profile" && field) {
    const profile = application.profile as Record<string, string | null | undefined>;
    const value = profile[field];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }
  if (scope === "trip" && field) {
    const trip = application.trip as Record<string, string | null | undefined>;
    const value = trip[field];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }
  return readAnswer(application, requirement.key);
}

function validateRequiredFields(
  application: CountrySubmissionApplication,
  requiredFields: FieldRequirement[],
): ValidationResult {
  const issues = requiredFields
    .filter((field) => field.required && !readRequirementValue(application, field))
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
): Record<string, string> {
  const answers = application.answers ?? {};
  const countryPrefix = normalizeToken(application.countryCode);
  const visaPrefix = normalizeToken(application.visaType);
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(answers)) {
    if (!value) continue;
    const normalizedKey = normalizeToken(key);
    if (
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

function buildDryRunConfirmation(countryCode: string, applicationId: string): string {
  const compactId = applicationId.replace(/[^a-z0-9]/gi, "").slice(0, 12).toUpperCase();
  return `MOCK-${countryCode}-${compactId || "APPLICATION"}`;
}

function createProvider(config: ProviderConfig): CountrySubmissionProvider {
  const requiredFields = [
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
        countrySpecific: buildCountrySpecificPayload(application),
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
        confirmationNumber: buildDryRunConfirmation(config.countryCode, payload.applicationId),
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
