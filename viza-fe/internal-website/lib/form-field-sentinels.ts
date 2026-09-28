import type { VisaFormFieldOption } from "@/types/visa-form-fields";

/**
 * Canonical sentinel answers used by official visa forms.
 *
 * A sentinel is a real answer only when the field metadata exposes the
 * corresponding official branch. Keeping this decision in one helper avoids
 * treating a stale `DOES_NOT_APPLY`/`DO_NOT_KNOW` value as ordinary text in
 * one completion path and as a valid answer in another.
 */
export const DO_NOT_KNOW_SENTINEL = "DO_NOT_KNOW" as const;
export const DOES_NOT_APPLY_SENTINEL = "DOES_NOT_APPLY" as const;

export type FormFieldSentinel =
  | typeof DO_NOT_KNOW_SENTINEL
  | typeof DOES_NOT_APPLY_SENTINEL;

export type FormFieldSentinelRules = {
  allow_do_not_know?: unknown;
  allow_unknown?: unknown;
  allow_does_not_apply?: unknown;
  has_does_not_apply?: unknown;
} | null | undefined;

export type FormFieldSentinelState = "none" | "allowed" | "unsupported";

export function getFormFieldSentinel(
  value: string | null | undefined,
): FormFieldSentinel | null {
  const trimmed = value?.trim().toUpperCase();
  if (trimmed === DO_NOT_KNOW_SENTINEL || trimmed === DOES_NOT_APPLY_SENTINEL) {
    return trimmed;
  }
  return null;
}

export function isAllowedFormFieldSentinel(
  sentinel: FormFieldSentinel,
  rules: FormFieldSentinelRules,
): boolean {
  if (sentinel === DO_NOT_KNOW_SENTINEL) {
    return rules?.allow_do_not_know === true || rules?.allow_unknown === true;
  }
  return rules?.allow_does_not_apply === true || rules?.has_does_not_apply === true;
}

export function getFormFieldSentinelState(
  value: string | null | undefined,
  rules: FormFieldSentinelRules,
  options?: readonly VisaFormFieldOption[] | null,
): FormFieldSentinelState {
  const sentinel = getFormFieldSentinel(value);
  if (!sentinel) return "none";
  // Some controls use a sentinel-like spelling as an ordinary official enum
  // (for example spouse_address_type = "do_not_know"). An exact declared
  // option follows normal enum validation; it does not require an NA checkbox.
  if (options?.some((option) => (typeof option === "string" ? option : option.value) === value?.trim())) {
    return "none";
  }
  return isAllowedFormFieldSentinel(sentinel, rules) ? "allowed" : "unsupported";
}

export function isUnsupportedFormFieldSentinel(
  value: string | null | undefined,
  rules: FormFieldSentinelRules,
): boolean {
  return getFormFieldSentinelState(value, rules) === "unsupported";
}
