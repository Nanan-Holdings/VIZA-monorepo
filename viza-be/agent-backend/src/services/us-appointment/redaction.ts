import type { JsonObject, JsonValue } from "./types.js";

const SENSITIVE_KEY_PATTERNS = [
  /passport/i,
  /ds.?160/i,
  /confirmation.*code/i,
  /confirmation.*number/i,
  /barcode/i,
  /card.*number/i,
  /^number$/i,
  /^pan$/i,
  /^cvv$/i,
  /^cvc$/i,
  /pin/i,
  /3ds/i,
  /three.*domain.*secure/i,
  /secret/i,
  /token/i,
  /^cookie$/i,
  /session/i,
  /authorization/i,
  /password/i,
  /credential/i,
  /captcha/i,
  /mfa/i,
  /otp/i,
  /verification.*code/i,
  /access.*key/i,
  /api.*key/i,
  /private.*key/i,
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isSensitiveKey(key: string): boolean {
  const normalizedKey = key.trim();
  if (normalizedKey.toLowerCase() === "last4") return false;
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(normalizedKey));
}

export function redactSensitivePayload(value: unknown): JsonValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitivePayload(item));
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (!isRecord(value)) {
    return String(value);
  }

  const redacted: JsonObject = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    redacted[key] = isSensitiveKey(key)
      ? "[REDACTED]"
      : redactSensitivePayload(nestedValue);
  }
  return redacted;
}

export function redactToObject(value: unknown): JsonObject {
  const redacted = redactSensitivePayload(value);
  return redacted && typeof redacted === "object" && !Array.isArray(redacted)
    ? redacted
    : { value: redacted };
}
