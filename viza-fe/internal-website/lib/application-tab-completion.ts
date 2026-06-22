import type { DocumentCenterData } from "@/app/client/documents/actions";
import { evaluateShowIf, isRequiredUnlessSatisfied } from "@/lib/form-utils";
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
  reason: "required" | "ceac_required";
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
  documentStepId: number;
  reviewStepId: number;
  teamStepId: number;
  confirmationStepId: number;
  showDocumentStep?: boolean;
  showTeamStep: boolean;
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

function text(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function hasValue(value: string | null | undefined): boolean {
  const v = text(value);
  return v.length > 0 && v !== "[]" && v !== "{}";
}

function normalizeAnswer(value: string | null | undefined): string {
  return text(value).toLowerCase();
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
  return index === 0 ? fieldName : `${fieldName}__${index}`;
}

function isVisibleRequiredField(field: VisaFormFieldRow, values: Record<string, string>, fields: VisaFormFieldRow[]) {
  if (!field.required) return false;
  if (isRequiredUnlessSatisfied(field, values)) return false;
  return evaluateShowIf(field, values, fields);
}

function isFieldComplete(field: VisaFormFieldRow, values: Record<string, string>): boolean {
  const group = getRepeatGroup(field);
  if (!group) return hasValue(values[field.fieldName]);

  const count = getMaxItems(field) ?? 1;
  for (let index = 0; index < count; index += 1) {
    if (hasValue(values[instanceKey(field.fieldName, index)])) return true;
  }
  return false;
}

function missingForDynamicStep(step: WizardStep, stepId: number, stepName: string, answers: Record<string, string>) {
  const missing: MissingApplicationField[] = [];
  for (const field of step.fields) {
    if (!isVisibleRequiredField(field, answers, step.fields)) continue;
    if (isFieldComplete(field, answers)) continue;
    missing.push({
      stepId,
      stepName,
      fieldName: field.fieldName,
      label: field.label || field.fieldName,
      reason: "required",
    });
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

function documentsComplete(data: DocumentCenterData | null): boolean {
  if (!data) return false;
  const required = data.requirements.filter((requirement) => requirement.required);
  if (required.length === 0) return true;
  return required.every((requirement) =>
    data.documents.some((document) => {
      const matchesRequirement =
        document.requirementKey === requirement.key ||
        document.documentType === requirement.documentType;
      if (!matchesRequirement) return false;
      return !["missing", "rejected", "failed"].includes(normalizeAnswer(document.status));
    })
  );
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

  input.dbSteps.forEach((step, index) => {
    const stepId = dynamicStepIds[index] ?? index;
    const stepName = input.effectiveSteps.find((candidate) => candidate.id === stepId)?.name ?? step.stepName;
    const missing = missingForDynamicStep(step, stepId, stepName, input.answers);
    missingFields.push(...missing);
    if (missing.length === 0) completed.add(stepId);
  });

  const ds160Missing = isUsDs160(input.country, input.visaType)
    ? getDs160CeacMissingFields(input.dbSteps, dynamicStepIds, input.answers)
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
  if (input.submittedAt || TERMINAL_SUBMISSION_STATUSES.has(input.submissionResultStatus ?? "")) {
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
