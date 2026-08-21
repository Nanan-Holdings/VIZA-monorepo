const PRIVATE_RESULT_FIELDS = new Set(
  [
    "credentials",
    "generatedPassword",
    "generatedPasswordCipher",
    "password",
    "passwordCipher",
    "portalUsername",
    "securityAnswer",
    "securityAnswerCipher",
    "otp",
    "otpCode",
    "oneTimePassword",
    "totp",
    "secret",
    "secretKey",
    "token",
    "accessToken",
    "sessionToken",
    "privateToken",
    "cvv",
    "cardNumber",
    "pan",
    "expiry",
    "holderName",
    "paymentCard",
  ].map((field) => field.toLowerCase()),
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Builds the browser-safe projection of a durable submission result.
 * UK portal credentials and force-resume URLs are runner-only data and must
 * never cross the customer status API boundary, even as ciphertext.
 */
export function sanitizeCustomerSubmissionResult(result: unknown): unknown {
  if (!isRecord(result)) return result;

  const stripPortalUrl = result.country === "UK";

  const sanitize = (value: unknown, removePortalUrl: boolean): [unknown, boolean] => {
    if (Array.isArray(value)) {
      let changed = false;
      const next = value.map((item) => {
        const [sanitized, itemChanged] = sanitize(item, removePortalUrl);
        changed ||= itemChanged;
        return sanitized;
      });
      return [changed ? next : value, changed];
    }
    if (!isRecord(value)) return [value, false];

    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      const normalizedKey = key.trim().toLowerCase();
      if (
        PRIVATE_RESULT_FIELDS.has(normalizedKey) ||
        (removePortalUrl && normalizedKey === "portalurl")
      ) {
        changed = true;
        continue;
      }
      const [sanitized, childChanged] = sanitize(child, removePortalUrl);
      changed ||= childChanged;
      next[key] = sanitized;
    }
    return [changed ? next : value, changed];
  };

  return sanitize(result, stripPortalUrl)[0];
}
