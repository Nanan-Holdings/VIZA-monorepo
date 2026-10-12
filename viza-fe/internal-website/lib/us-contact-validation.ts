/** Cross-field constraints observed on the CEAC DS-160 U.S. contact page. */

export type UsContactRelationshipIssueKind =
  | "both_unknown"
  | "organization_only_relationship"
  | "spouse_marital_status";

export interface UsContactRelationshipIssue {
  kind: UsContactRelationshipIssueKind;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function repeatSuffix(valueKey: string): string {
  return valueKey.match(/__\d+$/u)?.[0] ?? "";
}

function isUnknown(value: unknown): boolean {
  return text(value) === "DO_NOT_KNOW";
}

function normalized(value: unknown): string {
  return text(value)
    .toUpperCase()
    .replace(/[\s_-]+/gu, " ")
    .trim();
}

function relationshipIsSpouse(value: unknown): boolean {
  const candidate = normalized(value);
  return candidate === "S" || candidate === "SPOUSE";
}

function relationshipIsDisallowedForOrganizationOnly(value: unknown): boolean {
  const candidate = normalized(value);
  return new Set([
    "R",
    "RELATIVE",
    "OTHER RELATIVE",
    "PARENT",
    "CHILD",
    "C",
    "S",
    "SPOUSE",
    "F",
    "FRIEND",
  ]).has(candidate);
}

function maritalStatusAllowsSpouse(value: unknown): boolean {
  const candidate = normalized(value);
  return new Set([
    "M",
    "MARRIED",
    "C",
    "COMMON LAW",
    "COMMONLAW",
    "L",
    "LEGALLY SEPARATED",
    "LEGALLYSEPARATED",
  ]).has(candidate);
}

/**
 * Return the CEAC relationship issue for the concrete repeat instance.
 * `valueKey` lets legacy repeated schemas use the same helper without
 * changing the canonical field names.
 */
export function getUsContactRelationshipIssue(
  values: Record<string, string | undefined | null>,
  valueKey = "us_contact_relationship",
): UsContactRelationshipIssue | null {
  const suffix = repeatSuffix(valueKey);
  const surname = values[`us_contact_surname${suffix}`];
  const givenNames = values[`us_contact_given_names${suffix}`];
  const organization = values[`us_contact_organization${suffix}`];
  const relationship = values[valueKey] ?? values.us_contact_relationship;
  const maritalStatus = values[`marital_status${suffix}`] ?? values.marital_status;
  const nameUnknown = isUnknown(surname) && isUnknown(givenNames);
  const organizationUnknown = isUnknown(organization);

  if (nameUnknown && organizationUnknown) return { kind: "both_unknown" };
  if (nameUnknown && !organizationUnknown && relationshipIsDisallowedForOrganizationOnly(relationship)) {
    return { kind: "organization_only_relationship" };
  }
  if (!nameUnknown && organizationUnknown && relationshipIsSpouse(relationship) && !maritalStatusAllowsSpouse(maritalStatus)) {
    return { kind: "spouse_marital_status" };
  }
  return null;
}

export function getUsContactRelationshipIssueMessage(
  issue: UsContactRelationshipIssue,
  isZh: boolean,
): string {
  switch (issue.kind) {
    case "both_unknown":
      return isZh
        ? "美国联系人姓名和机构不能同时选择“不知道”，请至少提供其中一项。"
        : "The U.S. contact name and organization cannot both be unknown. Provide at least one.";
    case "organization_only_relationship":
      return isZh
        ? "仅提供机构名称时，关系不能选择亲属、配偶或朋友。请提供联系人姓名，或选择其他关系。"
        : "When only an organization is provided, the relationship cannot be Relative, Spouse, or Friend. Provide a contact name or choose another relationship.";
    case "spouse_marital_status":
      return isZh
        ? "选择“配偶”时，个人信息页的婚姻状况必须为已婚、同居或合法分居。"
        : "The Spouse relationship requires a marital status of Married, Common Law, or Legally Separated.";
  }
}

