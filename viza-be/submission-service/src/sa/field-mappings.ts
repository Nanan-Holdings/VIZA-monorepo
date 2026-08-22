/**
 * Saudi VisitSaudi application contract.
 *
 * The public eligibility controls are known, but authenticated application
 * selectors are intentionally not invented here. These keys mirror the
 * SA_E_VISA schema and are used to fail before account/browser work whenever
 * VIZA does not yet have a complete applicant payload.
 */

export const SA_REQUIRED_ANSWER_KEYS = [
  "nationality",
  "given_name",
  "father_name",
  "family_name",
  "gender",
  "date_of_birth",
  "country_of_birth",
  "city_of_birth",
  "religion",
  "marital_status",
  "profession",
  "applicant_is_minor",
  "passport_number",
  "passport_type",
  "passport_issuing_country",
  "passport_issue_place",
  "passport_issue_date",
  "passport_expiry_date",
  "residence_country",
  "residence_city",
  "residence_address",
  "visa_email",
  "phone_country_code",
  "phone_number",
  "has_whatsapp",
  "purpose_of_visit",
  "accommodation_type",
] as const;

export const SA_REQUIRED_DOCUMENT_KEYS = [
  "personal_photo",
  "passport_bio_page",
] as const;

export type SaAnswerKey = (typeof SA_REQUIRED_ANSWER_KEYS)[number];
export type SaDocumentKey = (typeof SA_REQUIRED_DOCUMENT_KEYS)[number];

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

/**
 * VisitSaudi's public eligibility control currently exposes one exact option:
 * `Regular Passport`. A missing or unsupported answer must never be defaulted.
 */
export function normalizeSaPassportType(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, " ");
  return ["regular", "regular passport", "ordinary", "ordinary passport"].includes(normalized)
    ? "regular"
    : "";
}

export function saOfficialPassportTypeLabel(value: string | undefined): string | null {
  return normalizeSaPassportType(value ?? "") === "regular"
    ? "Regular Passport"
    : null;
}

/** Preserve exact schema answers, accepting only established profile aliases. */
export function normalizeSaAnswers(input: Record<string, string>): Record<string, string> {
  const answers = { ...input };
  answers.given_name = first(input, ["given_name", "given_names", "first_name"]);
  answers.family_name = first(input, ["family_name", "surname", "last_name"]);
  const fatherName = first(input, ["father_name", "father_full_name"]);
  if (fatherName) answers.father_name = fatherName;
  answers.city_of_birth = first(input, ["city_of_birth", "place_of_birth", "birth_city"]);
  answers.passport_issue_place = first(input, [
    "passport_issue_place",
    "passport_place_of_issue",
    "passport_issuance_city",
    "place_of_issue",
  ]);
  answers.passport_type = normalizeSaPassportType(first(input, [
    "passport_type",
    "passport_document_type",
    "travel_document_type",
  ]));
  answers.residence_country = first(input, ["residence_country", "country_of_residence"]);
  answers.residence_city = first(input, ["residence_city", "residential_address_city"]);
  answers.residence_address = first(input, [
    "residence_address",
    "residential_address",
    "home_address",
  ]);
  answers.visa_email = first(input, ["visa_email", "email_address", "email"]);
  answers.phone_number = first(input, ["phone_number", "mobile_phone", "phone"]);
  answers.applicant_is_minor = normalizeYesNo(first(input, ["applicant_is_minor"]));
  answers.has_whatsapp = normalizeYesNo(first(input, ["has_whatsapp"]));
  return answers;
}

export function requiredSaAnswerKeys(answers: Record<string, string>): string[] {
  const normalized = normalizeSaAnswers(answers);
  const keys: string[] = [...SA_REQUIRED_ANSWER_KEYS];
  if (normalized.applicant_is_minor === "yes") {
    keys.push("guardian_full_name", "guardian_relationship");
  }
  if (normalized.has_whatsapp === "yes") {
    keys.push("whatsapp_country_code", "whatsapp_number");
  }
  if (normalized.accommodation_type === "hotel") {
    keys.push("hotel_name", "hotel_address", "hotel_city");
  } else if (normalized.accommodation_type === "residence") {
    keys.push("private_residence_address", "private_residence_city", "private_residence_name");
  }
  return keys;
}

export function missingRequired(answers: Record<string, string>): string[] {
  const normalized = normalizeSaAnswers(answers);
  return requiredSaAnswerKeys(normalized).filter((key) => !normalized[key]?.trim());
}

export function missingSaDocuments(documentKeys: Iterable<string>): SaDocumentKey[] {
  const present = new Set(Array.from(documentKeys, (key) => key.trim()));
  return SA_REQUIRED_DOCUMENT_KEYS.filter((key) => !present.has(key));
}

/** YYYY-MM-DD -> DD/MM/YYYY for authenticated VisitSaudi date controls. */
export function toSaDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}
