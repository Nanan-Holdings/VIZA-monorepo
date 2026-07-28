/**
 * Canonical applicant answer-field keys (POR-002).
 *
 * Single source for the field-key strings shared between the portal wizards
 * (this app) and the submission-service runners' field-mappings
 * (viza-be/submission-service/src/<cc>/field-mappings.ts + the shared
 * standard-evisa core). The two packages don't share a workspace, so these
 * constants are the documented contract — keep them in sync with the runner
 * mappings. Using the constants (instead of string literals) in wizard
 * configs prevents per-country drift.
 */
export const CANONICAL = {
  SURNAME: "surname",
  GIVEN_NAMES: "given_names",
  SEX: "sex",
  DATE_OF_BIRTH: "date_of_birth",
  PLACE_OF_BIRTH_CITY: "place_of_birth_city",
  NATIONALITY: "nationality",
  PASSPORT_NUMBER: "passport_number",
  PASSPORT_ISSUING_COUNTRY: "passport_issuing_country",
  PASSPORT_EXPIRY_DATE: "passport_expiry_date",
  EMAIL: "email",
  PHONE: "phone",
  HOME_ADDRESS: "home_address",
  INTENDED_ARRIVAL_DATE: "intended_arrival_date",
  INTENDED_DEPARTURE_DATE: "intended_departure_date",
  PURPOSE_OF_VISIT: "purpose_of_visit",
  OCCUPATION: "occupation",
} as const;

export type CanonicalFieldKey = (typeof CANONICAL)[keyof typeof CANONICAL];

/** The full set, for parity assertions against runner field-mappings. */
export const CANONICAL_FIELD_KEYS: readonly string[] = Object.values(CANONICAL);
