/** Exact answer/document contract for ICP transaction 783. */

export const AE_REQUIRED_ANSWER_KEYS = [
  "full_name",
  "current_nationality",
  "profession",
  "gender",
  "date_of_birth",
  "country_of_birth",
  "place_of_birth",
  "religion",
  "marital_status",
  "education_level",
  "passport_number",
  "passport_type",
  "passport_issue_place",
  "passport_issuing_country",
  "passport_issue_date",
  "passport_expiry_date",
  "email_address",
  "residence_country",
  "residential_address_outside_uae",
  "phone_outside_uae",
  "uae_emirate",
  "uae_city",
  "uae_area",
  "uae_detailed_address",
  "has_uae_mobile",
  "transaction_reason",
] as const;

export const AE_REQUIRED_DOCUMENT_KEYS = [
  "passport_bio_page",
  "personal_photo",
  "six_month_bank_statement",
  "uae_health_coverage_evidence",
  "return_or_onward_ticket",
] as const;

export const AE_CONDITIONAL_DOCUMENT_KEYS = [
  "uae_accommodation_evidence",
  "national_identity_copy",
] as const;

export type AeDocumentKey =
  | (typeof AE_REQUIRED_DOCUMENT_KEYS)[number]
  | (typeof AE_CONDITIONAL_DOCUMENT_KEYS)[number];

export const AE_DOCUMENT_EVIDENCE_METADATA_KEY = "ae_transaction_783_evidence_review";

export const AE_DOCUMENT_EVIDENCE_RULES = {
  six_month_bank_statement: {
    monthsCovered: 6,
    minimumMonthlyBalanceUsdEquivalent: 4_000,
    official: true,
    stamped: true,
    signed: true,
    colored: true,
  },
  uae_health_coverage_evidence: {
    issuerCountry: "United Arab Emirates",
    minimumValidityDays: 180,
  },
} as const;

export interface AeBankStatementEvidenceFacts {
  status?: string | null;
  reviewedAt?: string | null;
  documentUpdatedAt?: string | null;
  monthsCovered?: number | null;
  minimumMonthlyBalanceUsdEquivalent?: number | null;
  official?: boolean | null;
  stamped?: boolean | null;
  signed?: boolean | null;
  colored?: boolean | null;
}

export interface AeHealthCoverageEvidenceFacts {
  status?: string | null;
  reviewedAt?: string | null;
  documentUpdatedAt?: string | null;
  issuerCountry?: string | null;
  validityDays?: number | null;
}

export interface AeDocumentEvidenceFacts {
  sixMonthBankStatement?: AeBankStatementEvidenceFacts;
  uaeHealthCoverageEvidence?: AeHealthCoverageEvidenceFacts;
}

function hasVerifiedStatus(status: string | null | undefined): boolean {
  return status?.trim().toLowerCase() === "validated";
}

function hasValidReviewTimestamp(value: string | null | undefined): boolean {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= Date.now() + 5 * 60_000;
}

function reviewCoversCurrentDocument(
  reviewedAt: string | null | undefined,
  documentUpdatedAt: string | null | undefined,
): boolean {
  if (!hasValidReviewTimestamp(reviewedAt) || !documentUpdatedAt) return false;
  const updated = Date.parse(documentUpdatedAt);
  if (!Number.isFinite(updated) || updated > Date.now() + 5 * 60_000) return false;
  return Date.parse(reviewedAt as string) === updated;
}

/**
 * Content-level blockers for evidence whose official validity cannot be
 * established from a file path or upload status alone.
 */
export function aeDocumentEvidenceReviewBlockers(facts: AeDocumentEvidenceFacts): string[] {
  const blockers: string[] = [];
  const bank = facts.sixMonthBankStatement;
  const bankRules = AE_DOCUMENT_EVIDENCE_RULES.six_month_bank_statement;
  if (!hasVerifiedStatus(bank?.status)) blockers.push("six_month_bank_statement:validated_status");
  if (!hasValidReviewTimestamp(bank?.reviewedAt)) blockers.push("six_month_bank_statement:reviewed_at");
  if (!reviewCoversCurrentDocument(bank?.reviewedAt, bank?.documentUpdatedAt)) {
    blockers.push("six_month_bank_statement:current_document_review");
  }
  if ((bank?.monthsCovered ?? 0) < bankRules.monthsCovered) {
    blockers.push("six_month_bank_statement:months_covered");
  }
  if (
    (bank?.minimumMonthlyBalanceUsdEquivalent ?? 0) <
    bankRules.minimumMonthlyBalanceUsdEquivalent
  ) {
    blockers.push("six_month_bank_statement:minimum_monthly_balance");
  }
  if (bank?.official !== true) blockers.push("six_month_bank_statement:official");
  if (bank?.stamped !== true) blockers.push("six_month_bank_statement:stamped");
  if (bank?.signed !== true) blockers.push("six_month_bank_statement:signed");
  if (bank?.colored !== true) blockers.push("six_month_bank_statement:colored");

  const insurance = facts.uaeHealthCoverageEvidence;
  const insuranceRules = AE_DOCUMENT_EVIDENCE_RULES.uae_health_coverage_evidence;
  if (!hasVerifiedStatus(insurance?.status)) {
    blockers.push("uae_health_coverage_evidence:validated_status");
  }
  if (!hasValidReviewTimestamp(insurance?.reviewedAt)) {
    blockers.push("uae_health_coverage_evidence:reviewed_at");
  }
  if (!reviewCoversCurrentDocument(insurance?.reviewedAt, insurance?.documentUpdatedAt)) {
    blockers.push("uae_health_coverage_evidence:current_document_review");
  }
  if (insurance?.issuerCountry?.trim().toLowerCase() !== insuranceRules.issuerCountry.toLowerCase()) {
    blockers.push("uae_health_coverage_evidence:issuer_country");
  }
  if ((insurance?.validityDays ?? 0) < insuranceRules.minimumValidityDays) {
    blockers.push("uae_health_coverage_evidence:validity_days");
  }
  return blockers;
}

function first(answers: Record<string, string>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = answers[key]?.trim();
    if (value) return value;
  }
  return "";
}

function normalizeYesNo(value: string): string {
  if (/^(?:yes|true|1|y)$/i.test(value.trim())) return "yes";
  if (/^(?:no|false|0|n)$/i.test(value.trim())) return "no";
  return value.trim().toLowerCase();
}

export function normalizeAeAnswers(input: Record<string, string>): Record<string, string> {
  const answers = { ...input };
  answers.full_name = first(input, ["full_name", "applicant_full_name", "fullName"]);
  answers.current_nationality = first(input, [
    "current_nationality",
    "nationality",
    "country_of_nationality",
  ]);
  answers.place_of_birth = first(input, ["place_of_birth", "city_of_birth", "birth_city"]);
  answers.passport_issue_place = first(input, [
    "passport_issue_place",
    "passport_place_of_issue",
    "passport_issuance_city",
    "place_of_issue",
  ]);
  answers.email_address = first(input, ["email_address", "email"]);
  answers.residence_country = first(input, ["residence_country", "country_of_residence"]);
  answers.residential_address_outside_uae = first(input, [
    "residential_address_outside_uae",
    "residential_address",
    "home_address",
  ]);
  answers.phone_outside_uae = first(input, ["phone_outside_uae", "phone_number", "phone"]);
  answers.has_uae_mobile = normalizeYesNo(first(input, ["has_uae_mobile"]));
  return answers;
}

export function requiredAeAnswerKeys(answers: Record<string, string>): string[] {
  const normalized = normalizeAeAnswers(answers);
  return normalized.has_uae_mobile === "yes"
    ? [...AE_REQUIRED_ANSWER_KEYS, "uae_mobile_number"]
    : [...AE_REQUIRED_ANSWER_KEYS];
}

export function aeMissingRequired(answers: Record<string, string>): string[] {
  const normalized = normalizeAeAnswers(answers);
  return requiredAeAnswerKeys(normalized).filter((key) => !normalized[key]?.trim());
}

export function requiredAeDocumentKeys(
  _nationality: string,
  liveRequestedKeys: Iterable<string> = [],
): AeDocumentKey[] {
  const requested = new Set(Array.from(liveRequestedKeys));
  const keys: AeDocumentKey[] = [...AE_REQUIRED_DOCUMENT_KEYS];
  for (const key of AE_CONDITIONAL_DOCUMENT_KEYS) {
    if (requested.has(key)) keys.push(key);
  }
  return keys;
}

export function missingAeDocuments(
  documentKeys: Iterable<string>,
  nationality: string,
  liveRequestedKeys: Iterable<string> = [],
): AeDocumentKey[] {
  const present = new Set(Array.from(documentKeys, (key) => key.trim()));
  return requiredAeDocumentKeys(nationality, liveRequestedKeys).filter((key) => !present.has(key));
}
