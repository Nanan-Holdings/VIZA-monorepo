import type { VisaFormFieldRow, WizardStep } from "@/types/visa-form-fields";

export const UNIVERSAL_PROFILE_CATEGORIES = [
  "identity",
  "contact",
  "travel_documents",
  "family",
  "work_education",
  "immigration_history",
  "background",
] as const;

export type UniversalProfileCategory = (typeof UNIVERSAL_PROFILE_CATEGORIES)[number];

export interface UniversalProfileAnswerRecord {
  canonicalKey: string;
  value: string;
  valueZh?: string | null;
  valueEn?: string | null;
  labelZh?: string | null;
  labelEn?: string | null;
  fieldType?: VisaFormFieldRow["fieldType"] | null;
  category?: UniversalProfileCategory | null;
  sourceApplicationId?: string | null;
  sourceVisaType?: string | null;
  sourceFieldName?: string | null;
  updatedAt?: string | null;
}

export interface UniversalProfileFieldDefinition extends VisaFormFieldRow {
  canonicalKey: string;
  category: UniversalProfileCategory;
  sourceVisaTypes: string[];
}

const CANONICAL_ALIASES: Record<string, string> = {
  last_name: "surname",
  family_name: "surname",
  first_name: "given_names",
  given_name: "given_names",
  givennames: "given_names",
  given_names_en: "given_names",
  family_name_en: "surname",
  full_name_native_alphabet: "full_name_native_alphabet",
  dob: "date_of_birth",
  birth_date: "date_of_birth",
  city_of_birth: "place_of_birth",
  birth_city: "place_of_birth",
  place_of_birth_city: "place_of_birth",
  town_of_birth: "place_of_birth",
  state_of_birth: "birth_province_or_state",
  birth_state: "birth_province_or_state",
  birth_province: "birth_province_or_state",
  place_of_birth_province: "birth_province_or_state",
  state_or_province_of_birth: "birth_province_or_state",
  country_of_birth: "birth_country",
  place_of_birth_country: "birth_country",
  sex: "gender",
  nationality_country: "nationality",
  country_of_nationality: "nationality",
  current_nationality: "nationality",
  marital_status: "civil_status",
  current_profession: "occupation",
  current_occupation: "occupation",
  primary_occupation: "occupation",
  home_address: "address",
  residential_address: "address",
  home_address_line1: "address",
  home_address_line_1: "address",
  home_address_line2: "address_line_2",
  home_address_line_2: "address_line_2",
  residence_country: "residence_country",
  country_of_residence: "residence_country",
  country_territory_of_residence: "residence_country",
  home_country: "residence_country",
  home_address_country: "residence_country",
  residential_address_country: "residence_country",
  residence_state: "residence_state",
  residence_province: "residence_state",
  residence_province_or_state: "residence_state",
  home_address_state: "residence_state",
  home_address_state_province: "residence_state",
  residential_address_state: "residence_state",
  residence_city: "residence_city",
  home_address_city: "residence_city",
  residential_address_city: "residence_city",
  postcode: "residence_postal_code",
  post_code: "residence_postal_code",
  postal_code: "residence_postal_code",
  home_address_postcode: "residence_postal_code",
  home_address_postal_code: "residence_postal_code",
  residential_address_postcode: "residence_postal_code",
  passport_no: "passport_number",
  passportnumber: "passport_number",
  travel_document_number: "passport_number",
  passport_document_type: "travel_document_type",
  passport_issue_date: "passport_issue_date",
  passport_issuance_date: "passport_issue_date",
  travel_document_issue_date: "passport_issue_date",
  date_of_issue: "passport_issue_date",
  passport_date_of_issue: "passport_issue_date",
  passport_expiry_date: "passport_expiry_date",
  passport_expiration_date: "passport_expiry_date",
  travel_document_expiry_date: "passport_expiry_date",
  valid_until: "passport_expiry_date",
  passport_date_of_expiry: "passport_expiry_date",
  passport_issuance_country: "passport_issuing_country",
  passport_country: "passport_issuing_country",
  passport_country_of_issue: "passport_issuing_country",
  travel_document_issuing_country: "passport_issuing_country",
  issued_by_country: "passport_issuing_country",
  passport_issuance_city: "passport_place_of_issue",
  place_of_issue: "passport_place_of_issue",
  other_passport_no: "other_passport_number",
  other_passport_expiry: "other_passport_expiry_date",
  spouse_dob: "spouse_date_of_birth",
  kin_spouse_date_of_birth: "spouse_date_of_birth",
  kin_father_date_of_birth: "father_date_of_birth",
  kin_mother_date_of_birth: "mother_date_of_birth",
  mobile_number: "phone",
  email_address: "email",
  primary_phone: "phone",
  phone_number: "phone",
  primary_phone_number: "phone",
  mobile_phone: "phone",
  telephone_number: "phone",
  wechat_id: "wechat",
  employer_address: "employer_address",
  employer_address_line1: "employer_address",
  employer_address_line_1: "employer_address",
  job_start_date: "employment_start_date",
  current_job_start_date: "employment_start_date",
  monthly_salary: "monthly_income",
  salary_per_month: "monthly_income",
  school_name: "education_institution_name",
  current_school_name: "education_institution_name",
  educational_establishment_name: "education_institution_name",
};

const OUTPUT_COMPATIBILITY_ALIASES: Record<string, string[]> = {
  full_name: ["fullName", "applicant_full_name"],
  given_names: ["givenNames"],
  passport_number: ["passportNumber"],
};

const APPLICATION_SPECIFIC_PATTERN = new RegExp([
  "(?:^|_)(?:purpose|intended|planned|expected|requested)(?:_|$)",
  "(?:^|_)(?:visit|stay|trip|journey|itinerary|destination)(?:_|$)",
  "(?:^|_)(?:expense|expenses|cost|funding|funder|payer|paying|means)(?:_|$)",
  "(?:^|_)(?:event|ceremony|treatment|transit|onward|booking)(?:_|$)",
  "(?:^|_)(?:application|embassy|consulate|office|permit|stream)(?:_|$)",
  "purpose_(?:of_)?(?:journey|trip|visit)",
  "(?:^|_)(?:arrival|departure|entry|exit|flight|airline|port|border)(?:_|$)",
  "(?:^|_)(?:trip|journey|itinerary|destination)(?:_|$)",
  "intended_(?:stay|arrival|departure|travel)",
  "length_of_stay",
  "duration_of_stay",
  "accommodation",
  "(?:^|_)(?:hotel|host|inviting|invitation|sponsor|payer)(?:_|$)",
  "means_(?:of_)?support",
  "cost_(?:covered|of_trip)",
  "travel_medical_insurance",
  "number_of_entries",
  "member_state",
  "schengen_day",
  "place_of_application",
  "declaration",
  "acknowledg",
  "consent",
  "signature",
  "additional_information",
  "visits_french_overseas",
  "filler_",
  "us_contact_",
  "business_(?:company|contact|invitation)",
].join("|"), "i");

const HISTORY_EXCEPTION_PATTERN = /(?:previous|prior|history|has_been|last_visa|visa_lost|visa_cancelled|visa_revoked|refus|drivers_license|immigrant_petition|former_spouse|lost_passport)/i;
const SENSITIVE_EPHEMERAL_PATTERN = /(?:password|otp|cvv|card_number|payment|captcha|session|token|secret)/i;
const NON_APPLICANT_SUBJECT_PATTERN = /(?:^|_)(?:accompanying|dependant|inviter|inviting|sponsor|assistant|agent|authorised_recipient|parental_authority|eu_family|emergency_contact|medical_facility|organ_donor|tour_operator|filler)(?:_|$)/i;

function normalizeFieldName(fieldName: string) {
  return fieldName.trim().replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[^a-zA-Z0-9_]+/g, "_").toLowerCase();
}

export function splitUniversalProfileRepeatKey(fieldName: string) {
  const normalized = normalizeFieldName(fieldName);
  const repeatMatch = normalized.match(/^(.*)(__\d+)$/);
  return repeatMatch
    ? { baseKey: repeatMatch[1], repeatSuffix: repeatMatch[2] }
    : { baseKey: normalized, repeatSuffix: "" };
}

export function canonicalizeUniversalProfileFieldName(fieldName: string) {
  const { baseKey, repeatSuffix } = splitUniversalProfileRepeatKey(fieldName);
  return `${CANONICAL_ALIASES[baseKey] ?? baseKey}${repeatSuffix}`;
}

export function getUniversalProfileFieldAliases(canonicalKey: string) {
  const { baseKey, repeatSuffix } = splitUniversalProfileRepeatKey(canonicalKey);
  const aliases = Object.entries(CANONICAL_ALIASES)
    .filter(([, canonical]) => canonical === baseKey)
    .map(([alias]) => `${alias}${repeatSuffix}`);
  const compatibilityAliases = (OUTPUT_COMPATIBILITY_ALIASES[baseKey] ?? [])
    .map((alias) => `${alias}${repeatSuffix}`);
  return Array.from(new Set([`${baseKey}${repeatSuffix}`, ...aliases, ...compatibilityAliases]));
}

export function getUniversalProfileCategory(
  fieldName: string,
  stepName = "",
): UniversalProfileCategory {
  const searchable = `${canonicalizeUniversalProfileFieldName(fieldName)} ${stepName}`.toLowerCase();
  if (/(passport|travel_document|national_id|identity document)/.test(searchable)) return "travel_documents";
  if (/(father|mother|parent|spouse|partner|marital|civil_status|family|guardian|relative)/.test(searchable)) return "family";
  if (/(occupation|employ|job|salary|income|school|education|university|college|study|training|language|military)/.test(searchable)) return "work_education";
  if (/(previous|prior|history|visa_|refus|immigrant|permanent_resident|travelled|visited|lost_passport)/.test(searchable)) return "immigration_history";
  if (/(security|criminal|disease|health|arrest|violation|traffick|terror|background)/.test(searchable)) return "background";
  if (/(address|phone|email|wechat|social_media|contact|residence|postal|postcode)/.test(searchable)) return "contact";
  return "identity";
}

export function isReusableUniversalProfileField(
  field: Pick<VisaFormFieldRow, "fieldName" | "fieldType" | "stepName">,
) {
  const normalized = normalizeFieldName(field.fieldName);
  if (!normalized || normalized.startsWith("__")) return false;
  if (field.fieldType === "file") return false;
  if (SENSITIVE_EPHEMERAL_PATTERN.test(normalized)) return false;
  if (NON_APPLICANT_SUBJECT_PATTERN.test(normalized)) return false;
  if (APPLICATION_SPECIFIC_PATTERN.test(normalized) && !HISTORY_EXCEPTION_PATTERN.test(normalized)) return false;
  return true;
}

function fieldQuality(field: VisaFormFieldRow) {
  let score = field.required ? 4 : 0;
  if (field.options?.length) score += 2;
  if (field.validationRules) score += 1;
  if (field.label && field.label !== field.fieldName) score += 1;
  return score;
}

export function buildUniversalProfileFieldDefinitions(steps: WizardStep[]) {
  const definitions = new Map<string, UniversalProfileFieldDefinition>();

  for (const step of steps) {
    for (const field of step.fields) {
      if (!isReusableUniversalProfileField(field)) continue;
      const canonicalKey = canonicalizeUniversalProfileFieldName(field.fieldName);
      const existing = definitions.get(canonicalKey);
      const sourceVisaTypes = Array.from(new Set([
        ...(existing?.sourceVisaTypes ?? []),
        field.visaType,
      ].filter(Boolean)));
      const candidate: UniversalProfileFieldDefinition = {
        ...field,
        fieldName: canonicalKey,
        canonicalKey,
        category: getUniversalProfileCategory(canonicalKey, step.stepName),
        stepName: step.stepName,
        sourceVisaTypes,
      };

      if (!existing || fieldQuality(candidate) > fieldQuality(existing)) {
        definitions.set(canonicalKey, candidate);
      } else {
        definitions.set(canonicalKey, { ...existing, sourceVisaTypes });
      }
    }
  }

  return Array.from(definitions.values());
}

export function buildReusableAnswerPatch(records: UniversalProfileAnswerRecord[]) {
  const patch: Record<string, string> = {};
  for (const record of records) {
    const value = record.value.trim();
    if (!value) continue;
    for (const alias of getUniversalProfileFieldAliases(record.canonicalKey)) {
      patch[alias] = value;
      if (record.valueZh?.trim()) patch[`${alias}_zh`] = record.valueZh.trim();
      if (record.valueEn?.trim()) patch[`${alias}_en`] = record.valueEn.trim();
    }
  }
  return patch;
}
