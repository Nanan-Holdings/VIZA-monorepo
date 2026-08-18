export const KOREA_REQUIRED_SCHEMA_FIELD_NAMES = [
  "surname",
  "given_name",
  "arrival_mode",
  "departure_mode",
  "purpose_of_entry",
  "stay_postal_code",
  "declaration_confirmed",
] as const;

const KOREA_FORBIDDEN_SCHEMA_FIELD_PATTERNS = [
  /email/u,
  /payer/u,
  /payment|billing|card|fee/u,
  /security|background|criminal|terror|espionage|sabotage|narcotics|trafficking/u,
  /visa/u,
];

/**
 * Korea e-Arrival Card must never fall back to a generic hardcoded visa
 * wizard or accept another country's non-empty schema. A completed schema
 * load is usable only when its required Korea fingerprint is present and
 * generic email/payer/security/visa/payment fields are absent.
 */
export function isKoreaArrivalCardSchemaUnavailable(input: {
  isKoreaArrivalCard: boolean;
  schemaLoadComplete: boolean;
  schemaFieldNames: readonly string[];
}): boolean {
  if (!input.isKoreaArrivalCard || !input.schemaLoadComplete) return false;

  const fieldNames = input.schemaFieldNames
    .map((fieldName) => fieldName.trim().toLowerCase())
    .filter(Boolean);
  const fieldNameSet = new Set(fieldNames);
  const missingRequiredField = KOREA_REQUIRED_SCHEMA_FIELD_NAMES.some(
    (fieldName) => !fieldNameSet.has(fieldName),
  );
  const containsForbiddenField = fieldNames.some((fieldName) =>
    KOREA_FORBIDDEN_SCHEMA_FIELD_PATTERNS.some((pattern) => pattern.test(fieldName)),
  );

  return missingRequiredField || containsForbiddenField;
}
