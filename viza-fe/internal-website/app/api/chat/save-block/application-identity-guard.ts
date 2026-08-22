const IMMUTABLE_APPLICATION_IDENTITY_FIELDS = new Set([
  "id",
  "applicant_id",
  "group_id",
  "country",
  "visa_type",
  "visa_package_id",
]);

export function findApplicationIdentityFields(
  data: Record<string, unknown>,
): string[] {
  return Object.keys(data).filter((fieldName) =>
    IMMUTABLE_APPLICATION_IDENTITY_FIELDS.has(fieldName.toLowerCase()),
  );
}
