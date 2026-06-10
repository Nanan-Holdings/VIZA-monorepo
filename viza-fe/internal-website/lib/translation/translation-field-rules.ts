const NON_TRANSLATABLE_FIELD_PATTERNS = [
  /(?:^|_)(passport|document|confirmation|application)_?(?:no|num|number|id|code)(?:_|$)/i,
  /(?:^|_)(date|dob|expiry|expiration|issued_at|issue_date)(?:_|$)/i,
  /(?:^|_)(email|phone|telephone|mobile|wechat|url)(?:_|$)/i,
  /(?:^|_)(country_code|iso|iata|icao|currency|amount|price|fee)(?:_|$)/i,
  /(?:^|_)(payment|security)_?(?:answer|reference|ref|id)?(?:_|$)/i,
  /(?:^|_)(file|filename|file_name|upload)(?:_|$)/i,
  /(?:^|_)(surname|surnames|given_names?|family_name|first_name|last_name|middle_name|full_name|native_full_name)(?:_|$)/i,
  /\b(passport|document|confirmation|application)\s*(?:no|num|number|id|code)\b/i,
  /\b(email|phone|telephone|mobile|wechat|url|date|amount|price|fee|security answer|file name)\b/i,
  /\b(surname|given names|family name|first name|last name|middle name|full name)\b/i,
];

const NON_TRANSLATABLE_FIELD_TYPES = new Set([
  "checkbox",
  "country",
  "date",
  "datetime-local",
  "email",
  "file",
  "money",
  "number",
  "otp",
  "password",
  "radio",
  "select",
  "tel",
  "upload",
]);

function clean(value: string | null | undefined) {
  return value?.trim() ?? "";
}

export function isSupportedRealtimeTranslationFieldType(fieldType?: string | null) {
  const normalized = clean(fieldType).toLowerCase();
  if (!normalized) return true;
  return !NON_TRANSLATABLE_FIELD_TYPES.has(normalized);
}

export function shouldSkipTranslation(fieldId: string, text: string, fieldType?: string | null) {
  const normalizedFieldType = clean(fieldType).toLowerCase();
  if (normalizedFieldType && !isSupportedRealtimeTranslationFieldType(normalizedFieldType)) {
    return true;
  }

  const normalizedFieldId = clean(fieldId);
  if (normalizedFieldId && NON_TRANSLATABLE_FIELD_PATTERNS.some((pattern) => pattern.test(normalizedFieldId))) {
    return true;
  }

  const normalizedText = clean(text);
  if (!normalizedText) return true;

  if (/^[\d\s+().,/:#-]+$/.test(normalizedText)) return true;
  if (/^[A-Z]{2,3}$/.test(normalizedText)) return true;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedText)) return true;
  if (/^\+?[\d\s().-]{6,}$/.test(normalizedText)) return true;

  return false;
}
