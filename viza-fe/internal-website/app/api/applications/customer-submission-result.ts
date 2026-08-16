const UK_PRIVATE_RESULT_FIELDS = new Set([
  "credentials",
  "generatedPassword",
  "generatedPasswordCipher",
  "password",
  "passwordCipher",
  "portalUrl",
  "portalUsername",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Builds the browser-safe projection of a durable submission result.
 * UK portal credentials and force-resume URLs are runner-only data and must
 * never cross the customer status API boundary, even as ciphertext.
 */
export function sanitizeCustomerSubmissionResult(result: unknown): unknown {
  if (!isRecord(result) || result.country !== "UK") return result;

  return Object.fromEntries(
    Object.entries(result).filter(([key]) => !UK_PRIVATE_RESULT_FIELDS.has(key)),
  );
}
