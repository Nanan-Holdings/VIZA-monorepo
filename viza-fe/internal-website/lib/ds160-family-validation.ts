/** Cross-field constraints observed on the CEAC DS-160 immediate-relative page. */

export type Ds160ImmediateRelativeRelationshipIssueKind = "spouse_marital_status";

export interface Ds160ImmediateRelativeRelationshipIssue {
  kind: Ds160ImmediateRelativeRelationshipIssueKind;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function repeatSuffix(valueKey: string): string {
  return valueKey.match(/__\d+$/u)?.[0] ?? "";
}

function normalized(value: unknown): string {
  return text(value)
    .normalize("NFKC")
    .toUpperCase()
    .replace(/[\s_-]+/gu, " ")
    .trim();
}

function relationshipIsSpouse(value: unknown): boolean {
  const candidate = normalized(value);
  return candidate === "S" || candidate === "SPOUSE";
}

function maritalStatusAllowsImmediateRelativeSpouse(value: unknown): boolean {
  const candidate = normalized(value);
  // CEAC's immediate-relative page accepts MARRIED and LEGALLY SEPARATED.
  // COMMON LAW is accepted by the separate U.S. contact rule, but live CEAC
  // rejects it for this repeat group.
  return new Set([
    "M",
    "MARRIED",
    "L",
    "LEGALLY SEPARATED",
    "LEGALLYSEPARATED",
  ]).has(candidate);
}

/**
 * Return the CEAC immediate-relative relationship issue for one repeat row.
 * `valueKey` may include a `__N` suffix; the applicant marital status remains
 * a page-level answer and is therefore read from the unsuffixed key.
 */
export function getDs160ImmediateRelativeRelationshipIssue(
  values: Record<string, string | undefined | null>,
  valueKey = "us_relative_relationship",
): Ds160ImmediateRelativeRelationshipIssue | null {
  const suffix = repeatSuffix(valueKey);
  const relationship = values[valueKey] ?? values[`us_relative_relationship${suffix}`] ?? values.us_relative_relationship;
  if (!relationshipIsSpouse(relationship)) return null;

  const maritalStatus = values.marital_status;
  return maritalStatusAllowsImmediateRelativeSpouse(maritalStatus)
    ? null
    : { kind: "spouse_marital_status" };
}

export function getDs160ImmediateRelativeRelationshipIssueMessage(
  issue: Ds160ImmediateRelativeRelationshipIssue,
  isZh: boolean,
): string {
  if (issue.kind === "spouse_marital_status") {
    return isZh
      ? "选择“配偶”作为美国直系亲属关系时，婚姻状况必须为已婚或合法分居。"
      : "The immediate-relative Spouse relationship requires a marital status of Married or Legally Separated.";
  }
  return isZh ? "美国直系亲属关系不符合官网要求。" : "The immediate-relative relationship is not compatible with the selected marital status.";
}
