const INVALID_KOREA_ISSUE_NUMBER_VALUES = new Set([
  "country",
  "country/region",
  "nationality",
  "gender",
  "male",
  "female",
  "date",
  "issue",
  "issue number",
  "reference",
  "unknown",
  "null",
  "undefined",
  "n/a",
  "na",
]);

/**
 * Return the official Korea e-Arrival Card issue number only when the value
 * looks like an identifier. The portal result has historically been capable
 * of returning a table-label value (for example, "country") when the result
 * page was not populated correctly. Such a value must never be presented as
 * a successful official reference.
 */
export function normalizeKoreaIssueNumber(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/gu, " ");
  if (normalized.length < 6 || normalized.length > 64) return null;

  const comparisonValue = normalized.toLocaleLowerCase("en-US");
  if (INVALID_KOREA_ISSUE_NUMBER_VALUES.has(comparisonValue)) return null;

  // Keep this in parity with the runner's official-result parser: the portal
  // returns an ASCII alphanumeric token with optional hyphens, not prose or a
  // copied result-table label.
  if (!/^[A-Z0-9][A-Z0-9-]{5,63}$/iu.test(normalized)) return null;
  if (!/\d/u.test(normalized)) return null;
  return normalized;
}
