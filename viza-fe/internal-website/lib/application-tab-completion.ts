import type { DocumentCenterData } from "@/app/client/documents/actions";
import {
  evaluateShowIf,
  isRequiredUnlessSatisfied,
  isRequiredWhenSatisfied,
} from "@/lib/form-utils";
import {
  getInvalidCanadaTrvFields,
  getMissingCanadaTrvExternalGates,
  isCanadaTrvApplication,
} from "@/lib/canada-trv-completion";
import type { VisaFormFieldRow, WizardStep } from "@/types/visa-form-fields";

export interface ApplicationStepRef {
  id: number;
  name: string;
  sourceName?: string;
}

export interface MissingApplicationField {
  stepId: number;
  stepName: string;
  fieldName: string;
  label: string;
  labelZh?: string;
  reason: "required" | "invalid" | "external_gate" | "ceac_required";
}

export interface TabCompletionResult {
  completedStepIds: number[];
  missingFields: MissingApplicationField[];
}

interface ComputeAllTabCompletionInput {
  dbSteps: WizardStep[];
  effectiveSteps: ApplicationStepRef[];
  answers: Record<string, string>;
  documentCenterData: DocumentCenterData | null;
  documentsLoaded?: boolean;
  submittedAt?: string | null;
  submissionResultStatus?: string | null;
  country?: string | null;
  visaType?: string | null;
  applicationConsentPresent?: boolean;
  applicationSignaturePresent?: boolean;
  canadaPortalTermsConsentPresent?: boolean;
  documentStepId: number;
  reviewStepId: number;
  teamStepId: number;
  confirmationStepId: number;
  /** Confirmation exists only for a verified official success. */
  showConfirmationStep?: boolean;
  showDocumentStep?: boolean;
  showTeamStep: boolean;
  now?: Date;
}

const LT24_VALUES = new Set(["less_than_24_hours", "less than 24 hours", "h"]);
const TERMINAL_SUBMISSION_STATUSES = new Set([
  "submitted",
  "submitted_mock",
  "completed",
  "unsupported",
  "action_required",
  "needs_user_action",
  "stopped_at_pay",
  "stopped_at_review",
  "form_ready_for_agency",
  "failed",
  "timed_out",
]);
const READY_DOCUMENT_STATUSES = new Set([
  "uploaded",
  "pending_review",
  "approved",
  "accepted",
  "verified",
  "ready",
]);

function text(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function hasValue(value: string | null | undefined): boolean {
  const v = text(value);
  return v.length > 0 && v !== "[]" && v !== "{}";
}

function isAcceptedCheckboxValue(value: string | null | undefined): boolean {
  return ["true", "yes", "1", "on"].includes(normalizeAnswer(value));
}

function normalizeAnswer(value: string | null | undefined): string {
  return text(value).toLowerCase();
}

function getChineseFieldLabel(field: VisaFormFieldRow): string | undefined {
  const labelZh = field.validationRules?.label_zh;
  return typeof labelZh === "string" && labelZh.trim() ? labelZh.trim() : undefined;
}

function isJapanVisitJapanWebApplication(
  country?: string | null,
  visaType?: string | null,
): boolean {
  const normalizedCountry = normalizeAnswer(country).replace(/[\s-]+/g, "_");
  const normalizedVisaType = normalizeAnswer(visaType).replace(/[\s-]+/g, "_");
  return (
    (normalizedCountry === "japan" || normalizedCountry === "jp") &&
    normalizedVisaType === "jp_visit_japan_web"
  );
}

const JP_VJW_MINIMUM_TEXT_LENGTHS = {
  residence_country: 2,
  accommodation_name: 2,
  accommodation_prefecture: 2,
  accommodation_city: 2,
  accommodation_address: 3,
} as const;

const JP_VJW_FLIGHT_NUMBER_PATTERN = /^\d{1,8}$/;

export function getApplicationFieldErrorMessage(
  field: MissingApplicationField,
  options: {
    country?: string | null;
    visaType?: string | null;
    isZh: boolean;
  },
): string {
  if (isJapanVisitJapanWebApplication(options.country, options.visaType)) {
    const japanMessages = options.isZh
      ? {
          residence_country: "请输入有效的居住国家或地区。",
          accommodation_name: "请输入完整的日本住宿名称（英文）。",
          accommodation_prefecture: "请选择日本住宿所在的都道府县。",
          accommodation_city: "请选择日本住宿所在的市区町村。",
          accommodation_address: "请输入完整的日本住宿町名、丁目和门牌号（英文），至少 3 个字符。",
          flight_number: "航班号仅填写 1–8 位数字（例如 SQ111 填写 111），并确认所选航空公司与实际航班一致。",
        }
      : {
          residence_country: "Enter a valid country or region of residence.",
          accommodation_name: "Enter the full name of your accommodation in Japan in English.",
          accommodation_prefecture: "Select the prefecture of your accommodation in Japan.",
          accommodation_city: "Select the city, ward, town, or village of your accommodation in Japan.",
          accommodation_address: "Enter the complete town, block, and building number of your accommodation in Japan in English (at least 3 characters).",
          flight_number: "Enter only the 1–8 digit numeric part of the flight number (for SQ111, enter 111), and confirm the selected airline matches your flight.",
        };
    const japanMessage = japanMessages[field.fieldName as keyof typeof japanMessages];
    if (japanMessage) return japanMessage;
  }

  if (field.reason === "invalid") {
    const label = options.isZh ? field.labelZh ?? field.label : field.label;
    return options.isZh
      ? `请检查“${label}”的格式或内容。`
      : `Check the format or content of “${label}”.`;
  }
  const label = options.isZh ? field.labelZh ?? field.label : field.label;
  return options.isZh
    ? `请填写“${label}”。`
    : `Complete “${label}”.`;
}

function getInvalidJapanVisitJapanWebFields(
  dbSteps: WizardStep[],
  answers: Record<string, string>,
): Array<{ stepIndex: number; field: VisaFormFieldRow }> {
  const fields = dbSteps.flatMap((step, stepIndex) =>
    step.fields.map((field) => ({ stepIndex, field })),
  );
  return fields.filter(({ field }) => {
    if (field.fieldName === "flight_number") {
      const value = text(answers[field.fieldName]);
      return value.length > 0 && !JP_VJW_FLIGHT_NUMBER_PATTERN.test(value);
    }
    const minimum = JP_VJW_MINIMUM_TEXT_LENGTHS[
      field.fieldName as keyof typeof JP_VJW_MINIMUM_TEXT_LENGTHS
    ];
    if (minimum === undefined) return false;
    const value = text(answers[field.fieldName]);
    return value.length > 0 && value.length < minimum;
  });
}

function withDerivedTdacTransitAnswer(
  answers: Record<string, string>,
  visaType?: string | null,
): Record<string, string> {
  if (normalizeAnswer(visaType) !== "th_tdac_arrival_card") return answers;
  const arrivalDate = text(answers.arrival_date);
  const departureDate = text(answers.departure_date);
  if (!arrivalDate || !departureDate) return answers;
  return {
    ...answers,
    is_transit_traveler: arrivalDate === departureDate ? "yes" : "",
  };
}

export function isUsDs160(country?: string | null, visaType?: string | null): boolean {
  const normalizedCountry = normalizeAnswer(country).replace(/[\s-]+/g, "_");
  const normalizedVisa = normalizeAnswer(visaType).replace(/[\s-]+/g, "_");
  return (
    normalizedCountry === "us" ||
    normalizedCountry === "usa" ||
    normalizedCountry === "united_states" ||
    normalizedVisa === "ds160" ||
    normalizedVisa === "b1_b2" ||
    normalizedVisa === "us_b1_b2"
  );
}

function getRepeatGroup(field: VisaFormFieldRow): string | null {
  const rules = field.validationRules as { repeat_group?: string } | null;
  return typeof rules?.repeat_group === "string" ? rules.repeat_group : null;
}

function getMaxItems(field: VisaFormFieldRow): number | null {
  const rules = field.validationRules as { max_items?: number } | null;
  return typeof rules?.max_items === "number" && rules.max_items > 0 ? rules.max_items : null;
}

function instanceKey(fieldName: string, index: number): string {
  return index === 0 ? fieldName : `${fieldName}__${index + 1}`;
}

function requiredExpectedAnswer(field: VisaFormFieldRow): string | null {
  const rules = field.validationRules as {
    must_equal?: unknown;
    mustEqual?: unknown;
  } | null;
  const expected = rules?.must_equal ?? rules?.mustEqual;
  return typeof expected === "string" && expected.trim()
    ? expected.trim().toLowerCase()
    : null;
}

function ruleRequiresAcceptance(field: VisaFormFieldRow): boolean {
  const rules = field.validationRules as { mustBeTrue?: unknown } | null;
  return rules?.mustBeTrue === true || requiredExpectedAnswer(field) !== null;
}

const HISTORICAL_DATE_CONTEXT = /(^|_)(birth|born|issue|issued|previous|prior|history|historical|past|last_visit)(_|$)/;
const TRAVEL_ARRIVAL_DATE_CONTEXT = /(^|_)(arrival|entry)(_|$)/;

/**
 * Returns true only for dates that describe the upcoming trip's arrival or
 * entry. Schemas can opt out with `allow_past_date`; otherwise canonical
 * arrival aliases are recognized across country packages. Historical travel,
 * birth, and document-issue dates are deliberately excluded.
 */
export function isUpcomingTravelDateField(field: VisaFormFieldRow): boolean {
  if (field.fieldType !== "date") return false;
  const rules = field.validationRules as {
    min_date?: unknown;
    not_before_today?: unknown;
    allow_past_date?: unknown;
    official_key?: unknown;
    date_role?: unknown;
  } | null;
  if (rules?.allow_past_date === true) return false;
  if (rules?.min_date === "today" || rules?.not_before_today === true) return true;
  if (rules?.date_role === "arrival" || rules?.date_role === "entry") return true;

  const fieldName = field.fieldName.trim().toLowerCase();
  const officialKey = typeof rules?.official_key === "string"
    ? rules.official_key.trim().toLowerCase()
    : "";
  if (HISTORICAL_DATE_CONTEXT.test(fieldName)) return false;
  return TRAVEL_ARRIVAL_DATE_CONTEXT.test(fieldName) ||
    officialKey === "arrival_date" ||
    officialKey === "entry_date";
}

function isoCalendarDate(value: Date): string {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

export function isPastUpcomingTravelDate(
  field: VisaFormFieldRow,
  value: string | null | undefined,
  now: Date = new Date(),
): boolean {
  const normalized = text(value);
  return isUpcomingTravelDateField(field) &&
    /^\d{4}-\d{2}-\d{2}$/.test(normalized) &&
    normalized < isoCalendarDate(now);
}

export function isVisibleDynamicFieldRequired(
  field: VisaFormFieldRow,
  values: Record<string, string>,
  fields: VisaFormFieldRow[],
): boolean {
  if (isRequiredUnlessSatisfied(field, values)) return false;
  if (!field.required && !isRequiredWhenSatisfied(field, values) && !ruleRequiresAcceptance(field)) return false;
  return evaluateShowIf(field, values, fields);
}

function getAtLeastOneOf(field: VisaFormFieldRow): string[] {
  const value = field.validationRules?.at_least_one_of;
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function isAllowedChoiceValue(field: VisaFormFieldRow, value: string | null | undefined): boolean {
  if (!hasValue(value)) return false;
  if (
    !field.options?.length ||
    field.validationRules?.remote_search === true ||
    typeof field.validationRules?.official_options_source === "string" ||
    typeof field.validationRules?.dynamic_option_source === "string" ||
    !["select", "radio", "country"].includes(field.fieldType)
  ) return true;
  return field.options.some((option) => (
    typeof option === "string" ? option : option.value
  ) === value);
}

function isFieldComplete(
  field: VisaFormFieldRow,
  values: Record<string, string>,
  now: Date = new Date(),
): boolean {
  if (field.fieldType === "checkbox" && (field.required || ruleRequiresAcceptance(field))) {
    return isAcceptedCheckboxValue(values[field.fieldName]);
  }
  const expected = requiredExpectedAnswer(field);
  if (expected !== null) return normalizeAnswer(values[field.fieldName]) === expected;
  const group = getRepeatGroup(field);
  if (!group) {
    const value = text(values[field.fieldName]);
    if (!hasValue(value)) return false;
    if (isPastUpcomingTravelDate(field, value, now)) return false;
    return isAllowedChoiceValue(field, value);
  }

  const count = getMaxItems(field) ?? 1;
  for (let index = 0; index < count; index += 1) {
    if (isAllowedChoiceValue(field, values[instanceKey(field.fieldName, index)])) return true;
  }
  return false;
}

function missingForDynamicStep(
  step: WizardStep,
  stepId: number,
  stepName: string,
  answers: Record<string, string>,
  now: Date = new Date(),
) {
  const missing: MissingApplicationField[] = [];
  for (const field of step.fields) {
    if (!isVisibleDynamicFieldRequired(field, answers, step.fields)) continue;
    if (isFieldComplete(field, answers, now)) continue;
    missing.push({
      stepId,
      stepName,
      fieldName: field.fieldName,
      label: field.label || field.fieldName,
      labelZh: getChineseFieldLabel(field),
      reason: hasValue(answers[field.fieldName]) ? "invalid" : "required",
    });
  }

  // Some official forms express an OR requirement as a group of individually
  // optional fields. Treat the visible group as required at final review too;
  // otherwise the inline validator and the submit validator disagree.
  const visitedGroups = new Set<string>();
  for (const field of step.fields) {
    const group = getAtLeastOneOf(field);
    if (group.length === 0 || !evaluateShowIf(field, answers, step.fields)) continue;
    const groupKey = [...group].sort().join("|");
    if (visitedGroups.has(groupKey)) continue;
    visitedGroups.add(groupKey);
    const visibleMembers = group
      .map((fieldName) => step.fields.find((candidate) => candidate.fieldName === fieldName))
      .filter((candidate): candidate is VisaFormFieldRow => Boolean(candidate))
      .filter((candidate) => evaluateShowIf(candidate, answers, step.fields));
    if (visibleMembers.length === 0 || group.some((fieldName) => hasValue(answers[fieldName]))) continue;
    const first = visibleMembers[0];
    missing.push({
      stepId,
      stepName,
      fieldName: first.fieldName,
      label: first.label || first.fieldName,
      labelZh: getChineseFieldLabel(first),
      reason: "required",
    });
  }

  return missing;
}

/**
 * Deterministic, UI-independent missing-field calculation used by both the
 * application wizard and the form-filling assistant. Conditional and
 * required-unless rules are evaluated against the complete answer snapshot.
 */
export function getMissingDynamicFormFields(
  dbSteps: WizardStep[],
  answers: Record<string, string>,
  options: { country?: string | null; visaType?: string | null; now?: Date } = {},
): MissingApplicationField[] {
  const missing = dbSteps.flatMap((step, index) =>
    missingForDynamicStep(step, index, step.stepName, answers, options.now),
  );
  if (isCanadaTrvApplication(options.country, options.visaType)) {
    missing.push(...getInvalidCanadaTrvFields(dbSteps, answers).map(({ stepIndex, field }) => ({
      stepId: stepIndex,
      stepName: dbSteps[stepIndex]?.stepName ?? `Step ${stepIndex + 1}`,
      fieldName: field.fieldName,
      label: field.label || field.fieldName,
      labelZh: getChineseFieldLabel(field),
      reason: "invalid" as const,
    })));
  }
  if (isJapanVisitJapanWebApplication(options.country, options.visaType)) {
    missing.push(...getInvalidJapanVisitJapanWebFields(dbSteps, answers).map(({ stepIndex, field }) => ({
      stepId: stepIndex,
      stepName: dbSteps[stepIndex]?.stepName ?? `Step ${stepIndex + 1}`,
      fieldName: field.fieldName,
      label: field.label || field.fieldName,
      labelZh: getChineseFieldLabel(field),
      reason: "invalid" as const,
    })));
  }
  return missing;
}

function pushMissing(
  output: MissingApplicationField[],
  fieldByName: Map<string, { field: VisaFormFieldRow; step: WizardStep; stepId: number }>,
  fallbackStepId: number,
  fallbackStepName: string,
  fieldName: string,
  label: string,
) {
  const match = fieldByName.get(fieldName);
  output.push({
    stepId: match?.stepId ?? fallbackStepId,
    stepName: match?.step.stepName ?? fallbackStepName,
    fieldName,
    label: match?.field.label ?? label,
    reason: "ceac_required",
  });
}

export function getDs160CeacMissingFields(
  dbSteps: WizardStep[],
  stepIdsByIndex: number[],
  answers: Record<string, string>,
): MissingApplicationField[] {
  const fieldByName = new Map<string, { field: VisaFormFieldRow; step: WizardStep; stepId: number }>();
  dbSteps.forEach((step, index) => {
    const stepId = stepIdsByIndex[index] ?? index;
    for (const field of step.fields) fieldByName.set(field.fieldName, { field, step, stepId });
  });

  const travelStep = dbSteps.find((step) => /travel information/i.test(step.stepName)) ?? dbSteps[2];
  const travelStepId = travelStep ? (stepIdsByIndex[dbSteps.indexOf(travelStep)] ?? 2) : 2;
  const travelStepName = travelStep?.stepName ?? "Travel Information";
  const missing: MissingApplicationField[] = [];
  const specificPlans = normalizeAnswer(answers.has_specific_travel_plans || answers.has_specific_plans);

  if ((specificPlans === "no" || specificPlans === "n") && !hasValue(answers.intended_arrival_date)) {
    pushMissing(missing, fieldByName, travelStepId, travelStepName, "intended_arrival_date", "Intended Date of Arrival in U.S.");
  }

  const stayUnit = normalizeAnswer(answers.intended_length_of_stay_unit);
  if ((specificPlans === "no" || specificPlans === "n") && !hasValue(answers.intended_length_of_stay_unit)) {
    pushMissing(missing, fieldByName, travelStepId, travelStepName, "intended_length_of_stay_unit", "Intended Length of Stay in U.S. (Unit)");
  }

  if (
    (specificPlans === "no" || specificPlans === "n") &&
    !LT24_VALUES.has(stayUnit) &&
    !hasValue(answers.intended_length_of_stay_value) &&
    !hasValue(answers.intended_length_of_stay)
  ) {
    pushMissing(missing, fieldByName, travelStepId, travelStepName, "intended_length_of_stay_value", "Intended Length of Stay in U.S. (Value)");
  }

  if ((specificPlans === "yes" || specificPlans === "y") && !hasValue(answers.arrival_date)) {
    pushMissing(missing, fieldByName, travelStepId, travelStepName, "arrival_date", "Date of Arrival in U.S.");
  }

  if (normalizeAnswer(answers.purpose_of_trip) === "b" && !hasValue(answers.purpose_of_trip_specify)) {
    pushMissing(missing, fieldByName, travelStepId, travelStepName, "purpose_of_trip_specify", "Specify");
  }

  return missing;
}

export function getRequiredDocumentProgress(data: DocumentCenterData | null): {
  completed: number;
  total: number;
} {
  // A visible document step whose checklist has not loaded is still an
  // unresolved readiness gate. Count one pending item so the application can
  // never briefly or permanently claim 100% while document readiness is
  // unknown.
  if (!data) return { completed: 0, total: 1 };
  const required = data.requirements.filter((requirement) => requirement.required);
  const missingKeys = new Set(getMissingRequiredDocumentRequirementKeys(data));
  const completed = required.filter((requirement) => !missingKeys.has(requirement.key)).length;
  return { completed, total: required.length };
}

export function getMissingRequiredDocumentRequirementKeys(
  data: DocumentCenterData | null,
): string[] {
  if (!data) return [];
  return data.requirements
    .filter((requirement) => requirement.required)
    .filter((requirement) => !data.documents.some((document) => {
      const matchesRequirement =
        document.requirementKey === requirement.key ||
        document.documentType === requirement.documentType;
      if (!matchesRequirement) return false;
      return READY_DOCUMENT_STATUSES.has(normalizeAnswer(document.status));
    }))
    .map((requirement) => requirement.key);
}

function documentsComplete(data: DocumentCenterData | null): boolean {
  const progress = getRequiredDocumentProgress(data);
  return progress.completed === progress.total;
}

function findStepName(steps: ApplicationStepRef[], stepId: number, fallback: string): string {
  return steps.find((step) => step.id === stepId)?.name ?? fallback;
}

export function getContiguousCompletedCount(steps: ApplicationStepRef[], completedStepIds: Iterable<number>): number {
  const completed = new Set(completedStepIds);
  let count = 0;
  for (const step of steps) {
    if (!completed.has(step.id)) break;
    count += 1;
  }
  return count;
}

export function computeAllTabCompletion(input: ComputeAllTabCompletionInput): TabCompletionResult {
  const completed = new Set<number>();
  const missingFields: MissingApplicationField[] = [];
  const dynamicStepIds = input.dbSteps.map((_, index) => index);
  const showDocumentStep = input.showDocumentStep ?? true;
  const documentsLoaded = input.documentsLoaded ?? true;
  const documentStepComplete = !showDocumentStep || documentsComplete(input.documentCenterData);
  const completionAnswers = withDerivedTdacTransitAnswer(input.answers, input.visaType);

  input.dbSteps.forEach((step, index) => {
    const stepId = dynamicStepIds[index] ?? index;
    const stepName = input.effectiveSteps.find((candidate) => candidate.id === stepId)?.name ?? step.stepName;
    const missing = missingForDynamicStep(step, stepId, stepName, completionAnswers, input.now);
    missingFields.push(...missing);
    if (missing.length === 0) completed.add(stepId);
  });

  if (isCanadaTrvApplication(input.country, input.visaType)) {
    const invalidFields = getInvalidCanadaTrvFields(input.dbSteps, completionAnswers)
      .map(({ stepIndex, field }) => {
        const stepId = dynamicStepIds[stepIndex] ?? stepIndex;
        return {
          stepId,
          stepName: input.effectiveSteps.find((candidate) => candidate.id === stepId)?.name ??
            input.dbSteps[stepIndex]?.stepName ?? `Step ${stepIndex + 1}`,
          fieldName: field.fieldName,
          label: field.label || field.fieldName,
          labelZh: getChineseFieldLabel(field),
          reason: "invalid" as const,
        };
      });
    missingFields.push(...invalidFields);
    for (const item of invalidFields) completed.delete(item.stepId);

    const gateLabels = {
      canada_application_consent: "Application consent",
      canada_application_signature: "Application signature",
      canada_ircc_portal_terms_consent: "IRCC Portal terms authorization",
    } as const;
    missingFields.push(...getMissingCanadaTrvExternalGates({
      applicationConsentPresent: input.applicationConsentPresent,
      applicationSignaturePresent: input.applicationSignaturePresent,
      portalTermsConsentPresent: input.canadaPortalTermsConsentPresent,
    }).map((fieldName) => ({
      stepId: input.reviewStepId,
      stepName: findStepName(input.effectiveSteps, input.reviewStepId, "Review Application"),
      fieldName,
      label: gateLabels[fieldName],
      reason: "external_gate" as const,
    })));
  }

  if (isJapanVisitJapanWebApplication(input.country, input.visaType)) {
    const invalidFields = getInvalidJapanVisitJapanWebFields(input.dbSteps, completionAnswers)
      .map(({ stepIndex, field }) => {
        const stepId = dynamicStepIds[stepIndex] ?? stepIndex;
        return {
          stepId,
          stepName: input.effectiveSteps.find((candidate) => candidate.id === stepId)?.name ??
            input.dbSteps[stepIndex]?.stepName ?? `Step ${stepIndex + 1}`,
          fieldName: field.fieldName,
          label: field.label || field.fieldName,
          labelZh: getChineseFieldLabel(field),
          reason: "invalid" as const,
        };
      });
    missingFields.push(...invalidFields);
    for (const item of invalidFields) completed.delete(item.stepId);
  }

  const ds160Missing = isUsDs160(input.country, input.visaType)
    ? getDs160CeacMissingFields(input.dbSteps, dynamicStepIds, completionAnswers)
    : [];
  missingFields.push(...ds160Missing);
  for (const item of ds160Missing) completed.delete(item.stepId);

  if (showDocumentStep) {
    if (documentStepComplete) {
      completed.add(input.documentStepId);
    } else if (documentsLoaded) {
      missingFields.push({
        stepId: input.documentStepId,
        stepName: findStepName(input.effectiveSteps, input.documentStepId, "Supporting Documents"),
        fieldName: "supporting_documents",
        label: "Required supporting documents",
        reason: "required",
      });
    }
  }
  const priorStepsReady = missingFields.length === 0 && documentStepComplete;
  if (input.dbSteps.length > 0 && priorStepsReady) completed.add(input.reviewStepId);
  if (input.showTeamStep && priorStepsReady) completed.add(input.teamStepId);
  if (
    input.showConfirmationStep !== false &&
    (input.submittedAt || TERMINAL_SUBMISSION_STATUSES.has(input.submissionResultStatus ?? ""))
  ) {
    completed.add(input.confirmationStepId);
  }

  const dedupedMissing = Array.from(
    missingFields
      .reduce((acc, item) => acc.set(`${item.stepId}:${item.fieldName}`, item), new Map<string, MissingApplicationField>())
      .values(),
  );

  return {
    completedStepIds: Array.from(completed).sort((a, b) => a - b),
    missingFields: dedupedMissing,
  };
}
