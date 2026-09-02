import { evaluateShowIf, isRequiredUnlessSatisfied, isRequiredWhenSatisfied } from "@/lib/form-utils";
import { normalizeBilingualFormField, resolveLocalizedFieldLabel } from "@/lib/bilingual-schema-contract";
import { getTaiwanEntryPermitExtraRequirements } from "@/lib/taiwan-entry-permit-document-requirements";
import { resolveVisaFormSchemaVisaType } from "@/lib/visa-form-schema-aliases";
import { getFormVisaType } from "@/lib/visa-destinations";
import {
  getCachedStaticVisaMetadata,
  PUBLIC_VISA_FORM_SCHEMA_CACHE_TTL_MS,
} from "@/lib/static-visa-metadata-cache";
import { dbRowToFormField, type VisaFormFieldDbRow, type VisaFormFieldRow, type WizardStep } from "@/types/visa-form-fields";

type QueryableClient = {
  from: (table: string) => any;
};

export type ApplicationCompletenessApplication = {
  id: string;
  applicant_id?: string | null;
  country: string | null;
  visa_type: string | null;
  visa_package_id?: string | null;
};

export type ApplicationCompletenessDocumentRequirement = {
  requirement_key?: string | null;
  key?: string | null;
  document_type?: string | null;
  documentType?: string | null;
  label_en?: string | null;
  labelEn?: string | null;
  label_zh?: string | null;
  labelZh?: string | null;
  description?: string | null;
  required?: boolean | null;
  sort_order?: number | null;
  sortOrder?: number | null;
  metadata?: Record<string, unknown> | null;
};

export type ApplicationCompletenessDocument = {
  requirement_key?: string | null;
  requirementKey?: string | null;
  document_type?: string | null;
  documentType?: string | null;
  status?: string | null;
};

export type ApplicationCompletenessMissingField = {
  fieldName: string;
  labelZh: string;
  labelEn: string;
  stepNumber: number;
  stepName: string;
  stepLabelZh: string;
};

export type ApplicationCompletenessMissingDocument = {
  requirementKey: string;
  documentType: string;
  labelZh: string;
  labelEn: string;
  description: string | null;
  required: boolean;
};

export type ApplicationCompletenessResult = {
  /** This result covers applicant answers and collected files only, not legal consent, official identity sessions, CAPTCHA, or payment readiness. */
  completionScope: "applicant_intake";
  complete: boolean;
  questionnaireComplete: boolean;
  documentCollectionComplete: boolean;
  missingInfoCount: number;
  missingDocumentCount: number;
  missingInfo: ApplicationCompletenessMissingField[];
  missingDocuments: ApplicationCompletenessMissingDocument[];
};

const READY_DOCUMENT_STATUSES = new Set([
  "uploaded",
  "pending_review",
  "approved",
  "accepted",
  "verified",
  "ready",
]);

const INCOMPLETE_DOCUMENT_STATUSES = new Set([
  "",
  "missing",
  "rejected",
  "failed",
  "needs_replacement",
]);

const TW_STEP_LABEL_ZH: Record<string, string> = {
  "delivery location": "递送地点",
  "photo & basic status": "照片与基本状态",
  "applicant identity": "申请人身份",
  "taiwan contact address": "在台联络地址",
  "other nationality": "其他国籍",
  "kinship information": "亲属状况",
  declaration: "申报事项",
};

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function hasAnswerValue(value: unknown): boolean {
  const text = normalizeText(value);
  return text.length > 0 && text !== "[]" && text !== "{}";
}

function hasCompleteFieldAnswer(field: VisaFormFieldRow, answers: Record<string, string>): boolean {
  const value = answers[field.fieldName];
  const rules = field.validationRules as {
    must_equal?: unknown;
    mustEqual?: unknown;
    mustBeTrue?: unknown;
  } | null;
  if (field.fieldType === "checkbox" && (field.required || rules?.mustBeTrue === true)) {
    return ["true", "yes", "1", "on"].includes(normalizeBoolean(value));
  }
  const expected = rules?.must_equal ?? rules?.mustEqual;
  if (typeof expected === "string" && expected.trim()) {
    return normalizeBoolean(value) === expected.trim().toLowerCase();
  }
  return hasAnswerValue(value);
}

function hasCjk(value: unknown): boolean {
  return /\p{Script=Han}/u.test(normalizeText(value));
}

function normalizeBoolean(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function isTaiwanEntryPermit(country?: string | null, visaType?: string | null): boolean {
  return (
    normalizeText(country).toLowerCase() === "taiwan" &&
    resolveVisaFormSchemaVisaType(getFormVisaType(visaType ?? ""), country) === "TW_ENTRY_PERMIT"
  );
}

function fieldRequiredForAnswers(
  field: VisaFormFieldRow,
  answers: Record<string, string>,
): boolean {
  if (isRequiredUnlessSatisfied(field, answers)) return false;
  const rules = field.validationRules as {
    must_equal?: unknown;
    mustEqual?: unknown;
    mustBeTrue?: unknown;
  } | null;
  return Boolean(
    field.required ||
    isRequiredWhenSatisfied(field, answers) ||
    rules?.mustBeTrue === true ||
    typeof (rules?.must_equal ?? rules?.mustEqual) === "string"
  );
}

function stepLabelZh(stepName: string | null | undefined): string {
  const normalized = normalizeText(stepName).toLowerCase();
  return TW_STEP_LABEL_ZH[normalized] ?? normalizeText(stepName) ?? "";
}

function findFieldContext(
  steps: WizardStep[],
  fieldName: string,
): { field: VisaFormFieldRow; step: WizardStep } | null {
  for (const step of steps) {
    const field = step.fields.find((candidate) => candidate.fieldName === fieldName);
    if (field) return { field, step };
  }
  return null;
}

function pushMissingField(
  output: ApplicationCompletenessMissingField[],
  steps: WizardStep[],
  fieldName: string,
  fallbackLabelZh: string,
  fallbackLabelEn = fallbackLabelZh,
) {
  if (output.some((item) => item.fieldName === fieldName)) return;
  const context = findFieldContext(steps, fieldName);
  const field = context?.field;
  const step = context?.step;
  output.push({
    fieldName,
    labelZh: field ? resolveLocalizedFieldLabel(field, "zh") || field.label || fallbackLabelZh : fallbackLabelZh,
    labelEn: field ? resolveLocalizedFieldLabel(field, "en") || field.label || fallbackLabelEn : fallbackLabelEn,
    stepNumber: step?.stepNumber ?? field?.stepNumber ?? 1,
    stepName: step?.stepName ?? field?.stepName ?? "",
    stepLabelZh: stepLabelZh(step?.stepName ?? field?.stepName) || step?.stepName || field?.stepName || "",
  });
}

function normalizeRequirement(
  row: ApplicationCompletenessDocumentRequirement,
): Required<Pick<ApplicationCompletenessMissingDocument, "requirementKey" | "documentType" | "labelZh" | "labelEn" | "description" | "required">> & {
  sortOrder: number;
  metadata: Record<string, unknown> | null;
} {
  const requirementKey = normalizeText(row.requirement_key ?? row.key);
  const documentType = normalizeText(
    row.document_type ?? row.documentType ?? row.metadata?.document_type,
  );
  const labelZh = normalizeText(row.label_zh ?? row.labelZh) || requirementKey || documentType;
  const labelEn = normalizeText(row.label_en ?? row.labelEn) || labelZh;
  return {
    requirementKey,
    documentType,
    labelZh,
    labelEn,
    description: normalizeText(row.description) || null,
    required: Boolean(row.required),
    sortOrder: Number(row.sort_order ?? row.sortOrder ?? 0),
    metadata: row.metadata ?? null,
  };
}

function filterRequirementsForAnswers(
  requirements: ApplicationCompletenessDocumentRequirement[],
  answers: Record<string, string>,
  country?: string | null,
  visaType?: string | null,
): ApplicationCompletenessDocumentRequirement[] {
  if (!isTaiwanEntryPermit(country, visaType)) return requirements;

  const eligibilityCategory = normalizeText(answers.eligibility_category);
  return requirements.filter((requirement) => {
    const key = normalizeText(requirement.requirement_key ?? requirement.key);
    if (key === "eligibility_supporting_document") return false;
    if (!key.startsWith("eligibility_supporting_document_")) return true;
    if (!eligibilityCategory) return false;
    return key === `eligibility_supporting_document_${eligibilityCategory}`;
  });
}

function mergeTaiwanEntryPermitRequirementsForAnswers(
  requirements: ApplicationCompletenessDocumentRequirement[],
  answers: Record<string, string>,
  country?: string | null,
  visaType?: string | null,
): ApplicationCompletenessDocumentRequirement[] {
  if (!isTaiwanEntryPermit(country, visaType)) return requirements;
  if (requirements.length === 0) return requirements;
  const hasEligibilityRequirement = requirements.some((requirement) => {
    const key = normalizeText(requirement.requirement_key ?? requirement.key);
    return key === "eligibility_supporting_document" || key.startsWith("eligibility_supporting_document_");
  });
  if (!hasEligibilityRequirement) return requirements;

  const canonicalRequirement = getTaiwanEntryPermitExtraRequirements(answers)
    .find((requirement) => requirement.key.startsWith("eligibility_supporting_document_"));
  if (!canonicalRequirement) return requirements;

  const merged = new Map<string, ApplicationCompletenessDocumentRequirement>();
  for (const requirement of requirements) {
    const key = normalizeText(requirement.requirement_key ?? requirement.key);
    if (key) merged.set(key, requirement);
  }

  const existing = merged.get(canonicalRequirement.key);
  merged.set(canonicalRequirement.key, {
    ...(existing ?? {}),
    requirement_key: canonicalRequirement.key,
    document_type: canonicalRequirement.documentType,
    label_en: canonicalRequirement.labelEn,
    label_zh: canonicalRequirement.labelZh,
    description: canonicalRequirement.description,
    required: canonicalRequirement.required,
    sort_order: existing?.sort_order ?? existing?.sortOrder ?? canonicalRequirement.sortOrder,
  });

  return Array.from(merged.values());
}

function requirementRequiredForAnswers(
  requirement: ReturnType<typeof normalizeRequirement>,
  answers: Record<string, string>,
  country?: string | null,
  visaType?: string | null,
): boolean {
  if (requirement.required) return true;
  const conditionField = normalizeText(requirement.metadata?.condition_field);
  const conditionValues = Array.isArray(requirement.metadata?.condition_values)
    ? requirement.metadata.condition_values
        .map((value) => normalizeBoolean(value))
        .filter(Boolean)
    : [];
  if (conditionField && conditionValues.length > 0) {
    return conditionValues.includes(normalizeBoolean(answers[conditionField]));
  }
  if (!isTaiwanEntryPermit(country, visaType)) return false;

  const key = requirement.requirementKey;
  const isEligibilityCategory4 = normalizeText(answers.eligibility_category) === "4";
  if (key === "mainland_id_card_scan") {
    if (isEligibilityCategory4) return true;
    return !["true", "yes", "1"].includes(normalizeBoolean(answers.mainland_id_number_not_applicable));
  }
  if (key === "other_nationality_passport_scan") {
    return ["yes", "true", "1"].includes(normalizeBoolean(answers.has_other_nationality_passport));
  }
  if (key === "hk_macau_id_scan") {
    return ["50", "51"].includes(normalizeText(answers.embassy_office));
  }
  return false;
}

function isTruthyAnswer(value: unknown): boolean {
  return ["true", "yes", "1", "y"].includes(normalizeBoolean(value));
}

function isTaiwanLivingStatus(value: unknown): boolean {
  const normalized = normalizeBoolean(value);
  return normalized === "1" || normalized === "living" || normalized === "alive" || normalized === "存";
}

function isTaiwanMainlandBirthplace(value: unknown): boolean {
  const normalized = normalizeBoolean(value);
  return normalized === "mainland" || normalized === "1" || normalized === "中國大陸" || normalized === "中国大陆";
}

function isTaiwanOtherBirthplace(value: unknown): boolean {
  const normalized = normalizeBoolean(value);
  return normalized === "other" || normalized === "5" || normalized === "其他";
}

function isSafeStudentSchoolName(value: unknown): boolean {
  const text = normalizeText(value);
  if (!hasAnswerValue(text)) return false;
  if (text.length < 2) return false;
  if (!/[\p{Script=Han}A-Za-z]/u.test(text)) return false;
  const normalized = text.toLowerCase();
  if (["学生", "學生", "student", "school", "none", "n/a", "na", "无", "無"].includes(normalized)) return false;
  return true;
}

function shouldSkipTaiwanStudentJobTitle(
  field: VisaFormFieldRow,
  answers: Record<string, string>,
  country?: string | null,
  visaType?: string | null,
): boolean {
  return (
    isTaiwanEntryPermit(country, visaType) &&
    field.fieldName === "job_title" &&
    normalizeText(answers.current_occupation) === "14"
  );
}

function addTaiwanEntryPermitCompletenessChecks(
  output: ApplicationCompletenessMissingField[],
  steps: WizardStep[],
  answers: Record<string, string>,
  country?: string | null,
  visaType?: string | null,
) {
  if (!isTaiwanEntryPermit(country, visaType)) return;

  const chineseName = normalizeText(answers.name_chinese);
  if (findFieldContext(steps, "name_chinese") && (!hasAnswerValue(chineseName) || !hasCjk(chineseName))) {
    pushMissingField(output, steps, "name_chinese", "中文姓名（繁体字）", "Chinese name in Traditional Chinese");
  }

  if (
    (findFieldContext(steps, "birth_place_mainland_region") || hasAnswerValue(answers.birth_place_is_mainland)) &&
    isTaiwanMainlandBirthplace(answers.birth_place_is_mainland) &&
    !hasAnswerValue(answers.birth_place_mainland_region)
  ) {
    pushMissingField(output, steps, "birth_place_mainland_region", "大陆出生省市/地区", "Mainland China birth province/city/region");
  }
  if (
    (findFieldContext(steps, "birth_place_other_country") || hasAnswerValue(answers.birth_place_is_mainland)) &&
    isTaiwanOtherBirthplace(answers.birth_place_is_mainland) &&
    !hasAnswerValue(answers.birth_place_other_country)
  ) {
    pushMissingField(output, steps, "birth_place_other_country", "出生国家/地区", "Country/region of birth");
  }

  for (const group of ["father", "mother"] as const) {
    if (!isTaiwanLivingStatus(answers[`kin_${group}_status`])) continue;
    const labelPrefix = group === "father" ? "父亲" : "母亲";
    for (const [suffix, label] of [
      ["name", "姓名"],
      ["date_of_birth", "生日"],
      ["phone", "电话"],
      ["occupation", "现职"],
      ["service_unit", "服务单位"],
      ["job_title", "职称"],
    ] as const) {
      const fieldName = `kin_${group}_${suffix}`;
      if (!hasAnswerValue(answers[fieldName])) {
        pushMissingField(output, steps, fieldName, `${labelPrefix} — ${label}`);
      }
    }
    if (!isTruthyAnswer(answers[`kin_${group}_current_address_same_as_overseas`]) && !hasAnswerValue(answers[`kin_${group}_current_address`])) {
      pushMissingField(output, steps, `kin_${group}_current_address`, `${labelPrefix} — 现住址`);
    }
  }

  if (normalizeText(answers.current_occupation) === "14" && !isSafeStudentSchoolName(answers.company_name)) {
    pushMissingField(output, steps, "company_name", "公司名称及单位全衔或学校名称", "Company, organization, or school name");
  }
}

function hasReadyDocument(
  requirement: ReturnType<typeof normalizeRequirement>,
  documents: ApplicationCompletenessDocument[],
): boolean {
  return documents.some((document) => {
    const requirementKey = normalizeText(document.requirement_key ?? document.requirementKey);
    const documentType = normalizeText(document.document_type ?? document.documentType);
    const status = normalizeBoolean(document.status);
    const matches =
      requirementKey === requirement.requirementKey ||
      documentType === requirement.documentType ||
      documentFamiliesOverlap(documentType, requirement.documentType);
    if (!matches) return false;
    if (INCOMPLETE_DOCUMENT_STATUSES.has(status)) return false;
    return READY_DOCUMENT_STATUSES.has(status) || status.length > 0;
  });
}

const DOCUMENT_TYPE_FAMILIES: ReadonlyArray<ReadonlySet<string>> = [
  new Set(["passport", "passport_copy", "passport_bio_page", "passport_scan"]),
  new Set(["photo", "personal_photo", "applicant_photo", "portrait_photo"]),
  new Set(["bank_statement", "six_month_bank_statement", "proof_of_funds"]),
  new Set([
    "travel_insurance",
    "health_insurance",
    "uae_health_insurance",
    "uae_health_coverage_evidence",
  ]),
  new Set(["return_ticket", "return_or_onward_ticket", "flight_booking"]),
  new Set(["national_identity_card", "national_identity_copy", "identity_card", "id_card"]),
];

function documentFamiliesOverlap(left: string, right: string): boolean {
  if (!left || !right) return false;
  return DOCUMENT_TYPE_FAMILIES.some((family) => family.has(left) && family.has(right));
}

export function computeApplicationCompleteness(input: {
  steps: WizardStep[];
  answers: Record<string, string>;
  requirements: ApplicationCompletenessDocumentRequirement[];
  documents: ApplicationCompletenessDocument[];
  country?: string | null;
  visaType?: string | null;
}): ApplicationCompletenessResult {
  const missingInfo: ApplicationCompletenessMissingField[] = [];

  for (const step of input.steps) {
    for (const field of step.fields) {
      if (!evaluateShowIf(field, input.answers, step.fields)) continue;
      if (shouldSkipTaiwanStudentJobTitle(field, input.answers, input.country, input.visaType)) continue;
      if (!fieldRequiredForAnswers(field, input.answers)) continue;
      if (hasCompleteFieldAnswer(field, input.answers)) continue;

      missingInfo.push({
        fieldName: field.fieldName,
        labelZh: resolveLocalizedFieldLabel(field, "zh") || field.label || field.fieldName,
        labelEn: resolveLocalizedFieldLabel(field, "en") || field.label || field.fieldName,
        stepNumber: step.stepNumber,
        stepName: step.stepName,
        stepLabelZh: stepLabelZh(step.stepName) || step.stepName || `Step ${step.stepNumber}`,
      });
    }
  }
  addTaiwanEntryPermitCompletenessChecks(
    missingInfo,
    input.steps,
    input.answers,
    input.country,
    input.visaType,
  );

  const normalizedRequirements = filterRequirementsForAnswers(
    mergeTaiwanEntryPermitRequirementsForAnswers(
      input.requirements,
      input.answers,
      input.country,
      input.visaType,
    ),
    input.answers,
    input.country,
    input.visaType,
  )
    .map(normalizeRequirement)
    .filter((requirement) => requirement.requirementKey || requirement.documentType)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const missingDocuments = normalizedRequirements
    .filter((requirement) => requirementRequiredForAnswers(requirement, input.answers, input.country, input.visaType))
    .filter((requirement) => !hasReadyDocument(requirement, input.documents))
    .map(({ sortOrder: _sortOrder, metadata: _metadata, ...requirement }) => requirement);

  const questionnaireComplete = missingInfo.length === 0;
  const documentCollectionComplete = missingDocuments.length === 0;
  return {
    completionScope: "applicant_intake",
    complete: questionnaireComplete && documentCollectionComplete,
    questionnaireComplete,
    documentCollectionComplete,
    missingInfoCount: missingInfo.length,
    missingDocumentCount: missingDocuments.length,
    missingInfo,
    missingDocuments,
  };
}

export async function loadApplicationCompleteness(input: {
  admin: QueryableClient;
  application: ApplicationCompletenessApplication;
}): Promise<ApplicationCompletenessResult> {
  const { admin, application } = input;
  const schemaVisaType = resolveVisaFormSchemaVisaType(
    getFormVisaType(application.visa_type ?? ""),
    application.country,
  );

  const [
    fieldRows,
    { data: answerRows, error: answerRowsError },
    { data: documentRows, error: documentRowsError },
    { data: universalDocumentRows, error: universalDocumentRowsError },
  ] = await Promise.all([
    getCachedStaticVisaMetadata<VisaFormFieldDbRow[]>(
      `visa-form-fields:v1:${schemaVisaType}`,
      async () => {
        const { data, error } = await admin
          .from("visa_form_fields")
          .select("*")
          .eq("visa_type", schemaVisaType)
          .order("step_number", { ascending: true })
          .order("display_order", { ascending: true });
        if (error) {
          throw new Error(`Visa form schema lookup failed: ${error.message}`);
        }
        return (data ?? []) as VisaFormFieldDbRow[];
      },
      {
        shouldCache: (rows) => rows.length > 0,
        ttlMs: PUBLIC_VISA_FORM_SCHEMA_CACHE_TTL_MS,
      },
    ),
    admin
      .from("visa_application_answers")
      .select("field_name, value_text")
      .eq("application_id", application.id),
    admin
      .from("application_documents")
      .select("requirement_key, document_type, status")
      .eq("application_id", application.id),
    application.applicant_id
      ? admin
          .from("universal_profile_documents")
          .select("document_type, status")
          .eq("applicant_id", application.applicant_id)
          .neq("status", "missing")
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (fieldRows.length === 0) {
    throw new Error(`Visa form schema is unavailable for ${schemaVisaType}`);
  }
  if (answerRowsError) throw new Error(`Application answer lookup failed: ${answerRowsError.message}`);
  if (documentRowsError) throw new Error(`Application document lookup failed: ${documentRowsError.message}`);
  if (universalDocumentRowsError) {
    throw new Error(`Universal document lookup failed: ${universalDocumentRowsError.message}`);
  }

  let requirements: ApplicationCompletenessDocumentRequirement[] = [];
  if (application.visa_package_id) {
    try {
      requirements = await getCachedStaticVisaMetadata<ApplicationCompletenessDocumentRequirement[]>(
        `document-requirements:v1:package:${application.visa_package_id}`,
        async () => {
          const { data, error } = await admin
            .from("document_requirements")
            .select("requirement_key, label_en, label_zh, description, required, sort_order, metadata")
            .eq("visa_package_id", application.visa_package_id)
            .order("sort_order", { ascending: true });
          if (error) throw new Error(error.message);
          return (data ?? []) as ApplicationCompletenessDocumentRequirement[];
        },
      );
    } catch {
      requirements = [];
    }
  }
  if (requirements.length === 0) {
    try {
      requirements = await getCachedStaticVisaMetadata<ApplicationCompletenessDocumentRequirement[]>(
        `document-requirements:v1:identity:${JSON.stringify([application.country ?? "", schemaVisaType])}`,
        async () => {
          const { data, error } = await admin
            .from("document_requirements")
            .select("requirement_key, label_en, label_zh, description, required, sort_order, metadata")
            .eq("country", application.country)
            .eq("visa_type", schemaVisaType)
            .order("sort_order", { ascending: true });
          if (error) throw new Error(error.message);
          return (data ?? []) as ApplicationCompletenessDocumentRequirement[];
        },
      );
    } catch {
      requirements = [];
    }
  }

  const stepMap = new Map<number, WizardStep>();
  for (const row of fieldRows) {
    const field = normalizeBilingualFormField(dbRowToFormField(row));
    const step = stepMap.get(field.stepNumber) ?? {
      stepNumber: field.stepNumber,
      stepName: field.stepName ?? `Step ${field.stepNumber}`,
      fields: [],
    };
    step.fields.push(field);
    stepMap.set(field.stepNumber, step);
  }

  const answers = Object.fromEntries(
    ((answerRows ?? []) as Array<{ field_name: string | null; value_text: string | null }>)
      .filter((row) => normalizeText(row.field_name))
      .map((row) => [normalizeText(row.field_name), row.value_text ?? ""]),
  );

  return computeApplicationCompleteness({
    steps: Array.from(stepMap.values()).sort((a, b) => a.stepNumber - b.stepNumber),
    answers,
    requirements,
    documents: [
      ...(documentRows ?? []),
      ...(universalDocumentRows ?? []),
    ] as ApplicationCompletenessDocument[],
    country: application.country,
    visaType: schemaVisaType,
  });
}
