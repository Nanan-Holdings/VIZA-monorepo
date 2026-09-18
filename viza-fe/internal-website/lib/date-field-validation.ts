import type { VisaFormFieldRow } from "@/types/visa-form-fields";

export const DO_NOT_KNOW_DATE_SENTINEL = "DO_NOT_KNOW";
export const DOES_NOT_APPLY_DATE_SENTINEL = "DOES_NOT_APPLY";

export type DateFieldValidationRules = {
  allow_do_not_know?: unknown;
  allow_unknown?: unknown;
  allow_does_not_apply?: unknown;
  has_does_not_apply?: unknown;
  allow_year_only?: unknown;
};

export type DateFieldValueState = "empty" | "valid" | "allowed_sentinel" | "year_only" | "invalid";

function buildStrictDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

/**
 * Parse the date formats accepted by the dynamic form. The fallback preserves
 * the existing browser Date parsing behaviour for schema-specific values.
 */
export function parseDateFieldValue(value?: string): Date | null {
  const trimmed = value?.trim();
  if (!trimmed || isDateSentinel(trimmed)) return null;

  const iso = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  const official = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  const chinese = trimmed.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);

  if (iso) return buildStrictDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  if (official) return buildStrictDate(Number(official[3]), Number(official[2]), Number(official[1]));
  if (chinese) return buildStrictDate(Number(chinese[1]), Number(chinese[2]), Number(chinese[3]));
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isDateSentinel(value: string | null | undefined): boolean {
  return value === DO_NOT_KNOW_DATE_SENTINEL || value === DOES_NOT_APPLY_DATE_SENTINEL;
}

export function isAllowedDateSentinel(
  value: string | null | undefined,
  rules: DateFieldValidationRules | null | undefined,
): boolean {
  if (value === DO_NOT_KNOW_DATE_SENTINEL) {
    return rules?.allow_do_not_know === true || rules?.allow_unknown === true;
  }
  if (value === DOES_NOT_APPLY_DATE_SENTINEL) {
    return rules?.allow_does_not_apply === true || rules?.has_does_not_apply === true;
  }
  return false;
}

export function getDateFieldValueState(
  value: string | null | undefined,
  rules: DateFieldValidationRules | null | undefined,
): DateFieldValueState {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "empty";
  if (isAllowedDateSentinel(trimmed, rules)) return "allowed_sentinel";
  if (/^\d{4}$/.test(trimmed)) {
    return rules?.allow_year_only === true ? "year_only" : "invalid";
  }
  return parseDateFieldValue(trimmed) ? "valid" : "invalid";
}

export function isDateFieldValueComplete(
  field: VisaFormFieldRow,
  value: string | null | undefined,
): boolean {
  if (field.fieldType !== "date") return true;
  const state = getDateFieldValueState(
    value,
    field.validationRules as DateFieldValidationRules | null,
  );
  return state === "valid" || state === "allowed_sentinel" || state === "year_only";
}
