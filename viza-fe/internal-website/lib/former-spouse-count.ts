/**
 * DS-160 former-spouse repeat-group contract.
 *
 * CEAC asks for the number of former spouses before rendering the repeated
 * rows. Keep this check independent from the schema seed so the form, tab
 * progress, assistant validation, and final review all fail closed in the
 * same way when a draft has a stale row count.
 */

export const FORMER_SPOUSE_COUNT_FIELD = "number_of_former_spouses";
export const FORMER_SPOUSE_REPEAT_GROUP = "former_spouses";

const FORMER_SPOUSE_ROW_FIELDS = [
  "former_spouse_surname",
  "former_spouse_given_names",
  "former_spouse_date_of_birth",
  "former_spouse_nationality",
  "former_spouse_city_of_birth",
  "former_spouse_country_of_birth",
  "former_spouse_date_of_marriage",
  "former_spouse_date_marriage_ended",
  "former_spouse_how_marriage_ended",
  "former_spouse_country_marriage_terminated",
] as const;

export type FormerSpouseCountIssueKind = "required" | "mismatch";

export interface FormerSpouseCountIssue {
  kind: FormerSpouseCountIssueKind;
  declaredCount: number | null;
  populatedRowCount: number;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

/** Parse the canonical numeric answer without accepting decimals or signs. */
export function parseFormerSpouseDeclaredCount(value: unknown): number | null {
  const normalized = text(value);
  if (!/^\d{1,2}$/u.test(normalized)) return null;
  const count = Number(normalized);
  return count >= 1 && count <= 99 ? count : null;
}

function rowIndexForAnswerKey(key: string, fieldName: string): number | null {
  if (key === fieldName) return 1;
  const match = new RegExp(`^${fieldName}__(\\d+)$`, "u").exec(key);
  if (!match) return null;
  const index = Number(match[1]);
  return Number.isInteger(index) && index >= 2 ? index : null;
}

/**
 * Count rows with at least one canonical answer. Bilingual `_zh`/`_en`
 * mirrors are intentionally ignored; they are not additional CEAC rows.
 */
export function getFormerSpousePopulatedRowCount(
  answers: Record<string, string | undefined | null>,
): number {
  let highestRow = 0;
  for (const fieldName of FORMER_SPOUSE_ROW_FIELDS) {
    for (const [key, value] of Object.entries(answers)) {
      const rowIndex = rowIndexForAnswerKey(key, fieldName);
      if (rowIndex === null || !text(value)) continue;
      highestRow = Math.max(highestRow, rowIndex);
    }
  }
  return highestRow;
}

/** Return the one cross-field issue that should block the former-spouse step. */
export function getFormerSpouseCountIssue(
  answers: Record<string, string | undefined | null>,
): FormerSpouseCountIssue | null {
  const rawCount = text(answers[FORMER_SPOUSE_COUNT_FIELD]);
  const populatedRowCount = getFormerSpousePopulatedRowCount(answers);
  if (!rawCount) {
    return {
      kind: "required",
      declaredCount: null,
      populatedRowCount,
    };
  }

  const declaredCount = parseFormerSpouseDeclaredCount(rawCount);
  if (declaredCount === null || declaredCount === populatedRowCount) return null;
  return {
    kind: "mismatch",
    declaredCount,
    populatedRowCount,
  };
}

/**
 * A blank/invalid declaration must leave only the base row available. Once a
 * valid count is selected, the repeat control may grow up to that declaration.
 * `configuredMax` remains the schema's own safety ceiling for malformed or
 * legacy drafts (the current DS-160 seed exposes five choices).
 */
export function getFormerSpouseRepeatLimit(
  answers: Record<string, string | undefined | null>,
  configuredMax: number,
): number {
  const declaredCount = parseFormerSpouseDeclaredCount(answers[FORMER_SPOUSE_COUNT_FIELD]);
  if (declaredCount === null) return 1;
  return Math.min(Math.max(1, configuredMax), declaredCount);
}

export function getFormerSpouseCountValidationMessage(
  issue: FormerSpouseCountIssue,
  isZh: boolean,
): string {
  if (issue.kind === "required") {
    return isZh ? "请选择前任配偶人数。" : "Select the number of former spouses.";
  }
  return isZh
    ? `声明的前任配偶人数为 ${issue.declaredCount}，但已填写 ${issue.populatedRowCount} 位。请使两者一致。`
    : `The declared number of former spouses is ${issue.declaredCount}, but ${issue.populatedRowCount} entries are filled. Make the counts match.`;
}

