export const DS160_TRIP_PURPOSE_FIELD = "purpose_of_trip";
export const DS160_TRIP_PURPOSE_REPEAT_GROUP = "trip_purpose";

export interface Ds160TripPurposeDuplicateIssue {
  kind: "duplicate_category";
  category: string;
  firstRow: number;
  duplicateRow: number;
  fieldName: string;
}

function rowNumber(fieldName: string): number {
  const match = fieldName.match(/^purpose_of_trip__(\d+)$/);
  if (!match) return 1;
  const parsed = Number(match[1]);
  return Number.isSafeInteger(parsed) && parsed > 1 ? parsed : 1;
}

/**
 * Normalize the primary CEAC purpose category. CEAC's primary select uses
 * codes such as B, while saved labels may contain the same code in brackets.
 * B1/B2-like legacy values still belong to the single B category; the
 * subtype is selected in purpose_of_trip_specify and must not make a second
 * B row appear unique.
 */
export function normalizeDs160TripPurposeCategory(value: string | null | undefined): string {
  const trimmed = value?.trim().toUpperCase() ?? "";
  if (!trimmed) return "";

  const bracketCode = trimmed.match(/\(([^()]+)\)\s*$/)?.[1]?.trim();
  const candidate = bracketCode || trimmed;
  if (/^B(?:1|2)(?:[/-]B?2)?$/.test(candidate)) return "B";
  return candidate.replace(/\s+/g, " ");
}

function isTripPurposeKey(key: string): boolean {
  return key === DS160_TRIP_PURPOSE_FIELD || /^purpose_of_trip__\d+$/.test(key);
}

/**
 * Return an issue only for a row that duplicates an earlier primary category.
 * Keeping the issue row-specific lets inline validation point at the second
 * select while the shared helper can be reused by progress and review.
 */
export function getDs160TripPurposeDuplicateIssue(
  answers: Readonly<Record<string, string>>,
  valueKey = DS160_TRIP_PURPOSE_FIELD,
): Ds160TripPurposeDuplicateIssue | null {
  const currentCategory = normalizeDs160TripPurposeCategory(answers[valueKey]);
  if (!currentCategory) return null;
  const currentRow = rowNumber(valueKey);
  if (currentRow <= 1) return null;

  for (const [key, rawValue] of Object.entries(answers)) {
    if (!isTripPurposeKey(key) || rowNumber(key) >= currentRow) continue;
    if (normalizeDs160TripPurposeCategory(rawValue) !== currentCategory) continue;
    return {
      kind: "duplicate_category",
      category: currentCategory,
      firstRow: rowNumber(key),
      duplicateRow: currentRow,
      fieldName: valueKey,
    };
  }
  return null;
}

export function getDs160TripPurposeDuplicateMessage(
  issue: Ds160TripPurposeDuplicateIssue,
  isZh: boolean,
): string {
  if (isZh) {
    return `赴美目的类别不能重复（第 ${issue.duplicateRow} 项与第 ${issue.firstRow} 项相同）。请选择不同的类别。`;
  }
  return "Duplicated Purpose of Trip to the U.S. provided.";
}
