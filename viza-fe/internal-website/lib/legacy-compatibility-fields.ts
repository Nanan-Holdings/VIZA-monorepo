import type { VisaFormFieldRow } from "@/types/visa-form-fields";

/**
 * Fields marked this way are retained for persisted-answer and runner
 * compatibility only. They are not applicant-facing questions. Callers must
 * keep the complete field list when hydrating or saving a step so old answer
 * keys remain available to the server-side canonical alias bridge.
 */
export function isLegacyCompatibilityOnlyField(
  field: Pick<VisaFormFieldRow, "validationRules">,
): boolean {
  return field.validationRules?.legacy_compatibility_only === true;
}
