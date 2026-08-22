import { evaluateShowIf } from "@/lib/form-utils";
import type { VisaFormFieldOption, VisaFormFieldRow, WizardStep } from "@/types/visa-form-fields";

export const CANADA_IRCC_PORTAL_TERMS_CONSENT = {
  type: "canada_ircc_portal_terms",
  version: "2026-05-13",
} as const;

function text(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function optionValue(option: VisaFormFieldOption): string {
  return typeof option === "string" ? option : option.value;
}

function isRealIsoDate(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

export function isCanadaTrvApplication(
  country?: string | null,
  visaType?: string | null,
): boolean {
  return text(country).toLowerCase() === "canada" &&
    text(visaType).toUpperCase() === "CA_TRV";
}

export function isCanadaTrvFieldValueValid(
  field: VisaFormFieldRow,
  value: string,
  answers: Record<string, string>,
): boolean {
  const normalized = text(value);
  if (!normalized) return true;
  if (field.fieldType === "checkbox") {
    return ["true", "yes", "1", "on"].includes(normalized.toLowerCase());
  }
  if (field.options?.length) {
    const allowed = new Set(field.options.map(optionValue));
    if (!allowed.has(normalized)) return false;
  }

  const rules = field.validationRules ?? {};
  if (typeof rules.maxLength === "number" && normalized.length > rules.maxLength) {
    return false;
  }
  if (typeof rules.pattern === "string") {
    try {
      if (!new RegExp(rules.pattern).test(normalized)) return false;
    } catch {
      return false;
    }
  }
  if (rules.format === "YYYY-MM-DD" && !isRealIsoDate(normalized)) return false;
  if (rules.format === "MM-YYYY" && !/^(0[1-9]|1[0-2])-\d{4}$/.test(normalized)) {
    return false;
  }
  if (
    field.fieldName === "intended_stay_to" &&
    isRealIsoDate(text(answers.intended_stay_from)) &&
    isRealIsoDate(normalized) &&
    normalized < text(answers.intended_stay_from)
  ) {
    return false;
  }
  return true;
}

function repeatCount(field: VisaFormFieldRow): number {
  const maxItems = field.validationRules?.max_items;
  return typeof maxItems === "number" && maxItems > 0 ? maxItems : 1;
}

export function getInvalidCanadaTrvFields(
  steps: WizardStep[],
  answers: Record<string, string>,
): Array<{ stepIndex: number; field: VisaFormFieldRow }> {
  const invalid: Array<{ stepIndex: number; field: VisaFormFieldRow }> = [];
  steps.forEach((step, stepIndex) => {
    for (const field of step.fields) {
      if (!evaluateShowIf(field, answers, step.fields)) continue;
      const repeatGroup = field.validationRules?.repeat_group;
      const keys = repeatGroup
        ? Array.from({ length: repeatCount(field) }, (_, index) =>
            index === 0 ? field.fieldName : `${field.fieldName}__${index}`)
        : [field.fieldName];
      if (keys.some((key) => {
        const value = text(answers[key]);
        return value && !isCanadaTrvFieldValueValid(field, value, answers);
      })) {
        invalid.push({ stepIndex, field });
      }
    }
  });
  return invalid;
}

export type CanadaTrvExternalGate =
  | "canada_application_consent"
  | "canada_application_signature"
  | "canada_ircc_portal_terms_consent";

export function getMissingCanadaTrvExternalGates(input: {
  applicationConsentPresent?: boolean;
  applicationSignaturePresent?: boolean;
  portalTermsConsentPresent?: boolean;
}): CanadaTrvExternalGate[] {
  const missing: CanadaTrvExternalGate[] = [];
  if (!input.applicationConsentPresent) {
    missing.push("canada_application_consent");
  }
  if (!input.applicationSignaturePresent) {
    missing.push("canada_application_signature");
  }
  if (!input.portalTermsConsentPresent) {
    missing.push("canada_ircc_portal_terms_consent");
  }
  return missing;
}
