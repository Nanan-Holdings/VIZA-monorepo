/**
 * Seed script: visa_form_fields for Korea C-3-9 Short-Term General Visa.
 *
 * Field definitions mirror Korean Annex 17 (별지 제17호서식) "사증발급신청서 /
 * VISA APPLICATION FORM", revision 2022.2.7. The form is the legally-defined
 * application template under the Enforcement Rules of the Immigration
 * Control Act and is identical for all C-3-x sub-categories — the
 * sub-category code is recorded in field 2.2 only. Source:
 * https://www.visa.go.kr/downfile/VisaapplicationForm_EN.pdf (bilingual
 * KR/EN, 5 pages, 12 sections).
 *
 * Scope: C-3-9 Short-Term General Visit (≤90 days, multi-purpose,
 * single-entry) intended for mainland-China (PRC) residents who submit
 * through the local Korea Visa Application Center (KVAC.com.cn-operated)
 * since visa.go.kr self-service is not directly accessible to PRC
 * residents. The schema is form-content only — submission to KVAC happens
 * out-of-band (paper / counter intake), so there is no submission
 * automation target. Other Tourism-eligible nationalities can also use
 * this schema; their submission channel (visa.go.kr self-service or
 * embassy direct) is tracked in the gap report rather than the schema.
 *
 * Document uploads (photo 35x45mm, signature, hukou, employment cert,
 * bank statement, etc.) are intentionally out of schema per playbook §5.6
 * — they live in application_documents.
 *
 * Run: npx tsx scripts/seed-kr-c39-short-term-visit-form-fields.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const VISA_TYPE = "KR_C39_SHORT_TERM_VISIT";

interface FieldDef {
  field_name: string;
  label: string;
  field_type: string;
  required: boolean;
  step_number: number;
  step_name: string;
  display_order: number;
  placeholder?: string;
  validation_rules?: Record<string, unknown>;
  options?: Array<{ value: string; text: string }>;
  conditional_logic?: Record<string, unknown>;
}

const YES_NO = [
  { value: "yes", text: "Yes" },
  { value: "no", text: "No" },
];

// ── Reusable gate constants ────────────────────────────────────────────────
const HAS_USED_OTHER_NAMES = "has_used_other_names === yes";
const IS_DUAL_NATIONAL = "is_dual_national === yes";
const PASSPORT_TYPE_OTHER = "passport_type === other";
const HAS_OTHER_PASSPORT = "has_other_passport === yes";
const OTHER_PASSPORT_TYPE_OTHER = "other_passport_type === other";
const HAS_DIFFERENT_RESIDENTIAL_ADDRESS = "current_address_same_as_home === no";
const IS_MARRIED = "marital_status === married";
const HAS_CHILDREN = "has_children === yes";
const EDUCATION_OTHER = "highest_education === other";
// 7.2 employer block hides for unemployed / retired (Annex 17 §7 instruction)
const IS_EMPLOYED_OR_STUDYING = "employment_status not in [unemployed, retired]";
const EMPLOYMENT_STATUS_OTHER = "employment_status === other";
const PURPOSE_OTHER = "purpose_of_visit === other";
const TRAVELLED_TO_KOREA_5Y = "travelled_to_korea_5y === yes";
const TRAVELLED_OUTSIDE_5Y = "travelled_outside_5y === yes";
const HAS_FAMILY_IN_KOREA = "has_family_in_korea === yes";
const TRAVELLING_WITH_FAMILY = "travelling_with_family === yes";
const HAS_INVITER = "has_inviter === yes";
const RECEIVED_FORM_ASSISTANCE = "received_form_assistance === yes";

// ── Enum option tables ─────────────────────────────────────────────────────

const SEX_OPTIONS = [
  { value: "male", text: "Male" },
  { value: "female", text: "Female" },
];

// Annex 17 §3.1
const PASSPORT_TYPE_OPTIONS = [
  { value: "diplomatic", text: "Diplomatic" },
  { value: "official", text: "Official" },
  { value: "regular", text: "Regular" },
  { value: "other", text: "Other" },
];

// Annex 17 §2.1 — locked to short_term for KR_C39_SHORT_TERM_VISIT, but the
// option list is preserved so future long-stay packages can reuse this seed
// shape.
const PERIOD_OF_STAY_OPTIONS = [
  { value: "short_term", text: "Short-term (≤ 90 days)" },
  { value: "long_term", text: "Long-term (> 90 days)" },
];

// Annex 17 §5.1 (no Widowed option in 2022.2.7 revision)
const MARITAL_STATUS_OPTIONS = [
  { value: "married", text: "Married" },
  { value: "divorced", text: "Divorced" },
  { value: "single", text: "Single" },
];

// Annex 17 §6.1
const HIGHEST_EDUCATION_OPTIONS = [
  { value: "masters_or_doctoral", text: "Master's / Doctoral" },
  { value: "bachelors", text: "Bachelor's" },
  { value: "high_school", text: "High School" },
  { value: "other", text: "Other" },
];

// Annex 17 §7.1
const EMPLOYMENT_STATUS_OPTIONS = [
  { value: "entrepreneur", text: "Entrepreneur" },
  { value: "self_employed", text: "Self-Employed" },
  { value: "employed", text: "Employed" },
  { value: "civil_servant", text: "Civil Servant" },
  { value: "student", text: "Student" },
  { value: "retired", text: "Retired" },
  { value: "unemployed", text: "Unemployed" },
  { value: "other", text: "Other" },
];

// Annex 17 §8.1 — official form is multi-checkbox ("check all that apply").
// Rendered as single-select in v1 (DynamicStepForm does not yet render
// multi-checkbox arrays); flagged as v1.1 renderer extension in
// docs/korea-visa-gap-report.md.
const PURPOSE_OF_VISIT_OPTIONS = [
  { value: "tourism_transit", text: "Tourism / Transit" },
  { value: "meeting_conference", text: "Meeting / Conference" },
  { value: "medical_tourism", text: "Medical Tourism" },
  { value: "business_trip", text: "Business Trip" },
  { value: "study_training", text: "Study / Training" },
  { value: "work", text: "Work" },
  { value: "trade_investment_ict", text: "Trade / Investment / Intra-Company Transfer" },
  { value: "visiting_family_relatives_friends", text: "Visiting Family / Relatives / Friends" },
  { value: "marriage_migrant", text: "Marriage Migrant" },
  { value: "diplomatic_official", text: "Diplomatic / Official" },
  { value: "other", text: "Other" },
];

// Section 2.2 — locked to C-3-9 for this package. Single option.
const STATUS_OF_STAY_OPTIONS = [
  { value: "C-3-9", text: "C-3-9 (Short-Term General)" },
];

const FIELDS: FieldDef[] = [
  // ═════════════════════════════════════════════════════════════════════════
  // STEP 1: Personal Details  (Annex-17 §1)
  // ═════════════════════════════════════════════════════════════════════════
  { field_name: "family_name_en", label: "Family name (in passport, block letters)", field_type: "text", required: true, step_number: 1, step_name: "Personal Details", display_order: 1, placeholder: "As shown in passport", validation_rules: { maxLength: 50, inline_group: "applicant_name" } },
  { field_name: "given_names_en", label: "Given names (in passport, block letters)", field_type: "text", required: true, step_number: 1, step_name: "Personal Details", display_order: 2, placeholder: "As shown in passport", validation_rules: { maxLength: 80, inline_group: "applicant_name" } },
  { field_name: "name_in_chinese_characters", label: "Name in Chinese characters / 漢字姓名", field_type: "text", required: true, step_number: 1, step_name: "Personal Details", display_order: 3, placeholder: "Required for PRC applicants", validation_rules: { maxLength: 30 } },
  { field_name: "sex", label: "Sex", field_type: "radio", required: true, step_number: 1, step_name: "Personal Details", display_order: 4, options: SEX_OPTIONS },
  { field_name: "date_of_birth", label: "Date of birth", field_type: "date", required: true, step_number: 1, step_name: "Personal Details", display_order: 5, placeholder: "YYYY/MM/DD", validation_rules: { format: "YYYY/MM/DD" } },
  { field_name: "nationality", label: "Nationality", field_type: "country", required: true, step_number: 1, step_name: "Personal Details", display_order: 6, validation_rules: { source: "ISO3166-1" } },
  { field_name: "country_of_birth", label: "Country of birth", field_type: "country", required: true, step_number: 1, step_name: "Personal Details", display_order: 7, validation_rules: { source: "ISO3166-1" } },
  { field_name: "national_identity_no", label: "National Identity No.", field_type: "text", required: true, step_number: 1, step_name: "Personal Details", display_order: 8, placeholder: "PRC residents: 18-digit ID", validation_rules: { maxLength: 30 } },
  { field_name: "has_used_other_names", label: "Have you ever used other names to enter or depart Korea?", field_type: "radio", required: true, step_number: 1, step_name: "Personal Details", display_order: 9, options: YES_NO },
  { field_name: "other_family_name", label: "Other family name", field_type: "text", required: true, step_number: 1, step_name: "Personal Details", display_order: 10, conditional_logic: { showIf: HAS_USED_OTHER_NAMES }, validation_rules: { maxLength: 50, inline_group: "other_name", block_group: "other_names" } },
  { field_name: "other_given_name", label: "Other given name", field_type: "text", required: true, step_number: 1, step_name: "Personal Details", display_order: 11, conditional_logic: { showIf: HAS_USED_OTHER_NAMES }, validation_rules: { maxLength: 80, inline_group: "other_name", block_group: "other_names" } },
  { field_name: "is_dual_national", label: "Are you a citizen of more than one country?", field_type: "radio", required: true, step_number: 1, step_name: "Personal Details", display_order: 12, options: YES_NO },
  { field_name: "other_nationalities", label: "List the other countries of citizenship", field_type: "text", required: true, step_number: 1, step_name: "Personal Details", display_order: 13, conditional_logic: { showIf: IS_DUAL_NATIONAL }, placeholder: "e.g. Hong Kong SAR, Macao SAR", validation_rules: { maxLength: 200 } },

  // ═════════════════════════════════════════════════════════════════════════
  // STEP 2: Visa Category & Passport  (Annex-17 §2 + §3)
  // §2 is hard-locked to short_term + C-3-9 for this package.
  // ═════════════════════════════════════════════════════════════════════════
  { field_name: "period_of_stay", label: "Period of Stay", field_type: "radio", required: true, step_number: 2, step_name: "Visa Category & Passport", display_order: 1, options: PERIOD_OF_STAY_OPTIONS, validation_rules: { locked_value: "short_term" } },
  { field_name: "status_of_stay", label: "Status of Stay", field_type: "select", required: true, step_number: 2, step_name: "Visa Category & Passport", display_order: 2, options: STATUS_OF_STAY_OPTIONS, validation_rules: { locked_value: "C-3-9" } },
  { field_name: "passport_type", label: "Passport type", field_type: "radio", required: true, step_number: 2, step_name: "Visa Category & Passport", display_order: 3, options: PASSPORT_TYPE_OPTIONS },
  { field_name: "passport_type_other", label: "Passport type — Other (please specify)", field_type: "text", required: true, step_number: 2, step_name: "Visa Category & Passport", display_order: 4, conditional_logic: { showIf: PASSPORT_TYPE_OTHER }, validation_rules: { maxLength: 80 } },
  { field_name: "passport_no", label: "Passport number", field_type: "text", required: true, step_number: 2, step_name: "Visa Category & Passport", display_order: 5, placeholder: "As shown in passport", validation_rules: { maxLength: 20 } },
  { field_name: "passport_country", label: "Country of passport", field_type: "country", required: true, step_number: 2, step_name: "Visa Category & Passport", display_order: 6, validation_rules: { source: "ISO3166-1" } },
  { field_name: "passport_place_of_issue", label: "Place of issue", field_type: "text", required: true, step_number: 2, step_name: "Visa Category & Passport", display_order: 7, validation_rules: { maxLength: 80 } },
  { field_name: "passport_date_of_issue", label: "Date of issue", field_type: "date", required: true, step_number: 2, step_name: "Visa Category & Passport", display_order: 8, placeholder: "YYYY/MM/DD", validation_rules: { format: "YYYY/MM/DD", inline_group: "passport_dates" } },
  { field_name: "passport_date_of_expiry", label: "Date of expiry", field_type: "date", required: true, step_number: 2, step_name: "Visa Category & Passport", display_order: 9, placeholder: "YYYY/MM/DD", validation_rules: { format: "YYYY/MM/DD", inline_group: "passport_dates" } },
  { field_name: "has_other_passport", label: "Do you currently hold any other valid passport?", field_type: "radio", required: true, step_number: 2, step_name: "Visa Category & Passport", display_order: 10, options: YES_NO },
  { field_name: "other_passport_type", label: "Other passport — type", field_type: "radio", required: true, step_number: 2, step_name: "Visa Category & Passport", display_order: 11, conditional_logic: { showIf: HAS_OTHER_PASSPORT }, options: PASSPORT_TYPE_OPTIONS, validation_rules: { block_group: "other_passport" } },
  { field_name: "other_passport_type_other", label: "Other passport — type other (please specify)", field_type: "text", required: true, step_number: 2, step_name: "Visa Category & Passport", display_order: 12, conditional_logic: { showIf: `${HAS_OTHER_PASSPORT} && ${OTHER_PASSPORT_TYPE_OTHER}` }, validation_rules: { maxLength: 80, block_group: "other_passport" } },
  { field_name: "other_passport_no", label: "Other passport — number", field_type: "text", required: true, step_number: 2, step_name: "Visa Category & Passport", display_order: 13, conditional_logic: { showIf: HAS_OTHER_PASSPORT }, validation_rules: { maxLength: 20, block_group: "other_passport" } },
  { field_name: "other_passport_country", label: "Other passport — country of passport", field_type: "country", required: true, step_number: 2, step_name: "Visa Category & Passport", display_order: 14, conditional_logic: { showIf: HAS_OTHER_PASSPORT }, validation_rules: { source: "ISO3166-1", block_group: "other_passport" } },
  { field_name: "other_passport_expiry", label: "Other passport — date of expiry", field_type: "date", required: true, step_number: 2, step_name: "Visa Category & Passport", display_order: 15, conditional_logic: { showIf: HAS_OTHER_PASSPORT }, placeholder: "YYYY/MM/DD", validation_rules: { format: "YYYY/MM/DD", block_group: "other_passport" } },

  // ═════════════════════════════════════════════════════════════════════════
  // STEP 3: Contact & Emergency Contact  (Annex-17 §4)
  // ═════════════════════════════════════════════════════════════════════════
  { field_name: "home_country_address", label: "Home country address", field_type: "textarea", required: true, step_number: 3, step_name: "Contact & Emergency Contact", display_order: 1, validation_rules: { maxLength: 300 } },
  { field_name: "current_address_same_as_home", label: "Is your current residential address the same as your home country address?", field_type: "radio", required: true, step_number: 3, step_name: "Contact & Emergency Contact", display_order: 2, options: YES_NO },
  { field_name: "current_residential_address", label: "Current residential address (if different from home)", field_type: "textarea", required: true, step_number: 3, step_name: "Contact & Emergency Contact", display_order: 3, conditional_logic: { showIf: HAS_DIFFERENT_RESIDENTIAL_ADDRESS }, validation_rules: { maxLength: 300 } },
  { field_name: "cell_phone", label: "Cell phone (mobile)", field_type: "text", required: true, step_number: 3, step_name: "Contact & Emergency Contact", display_order: 4, placeholder: "Including country code", validation_rules: { maxLength: 30, inline_group: "phones" } },
  { field_name: "telephone", label: "Telephone (landline)", field_type: "text", required: false, step_number: 3, step_name: "Contact & Emergency Contact", display_order: 5, placeholder: "Including country code", validation_rules: { maxLength: 30, inline_group: "phones" } },
  { field_name: "email", label: "Email address", field_type: "text", required: true, step_number: 3, step_name: "Contact & Emergency Contact", display_order: 6, placeholder: "name@example.com", validation_rules: { maxLength: 120, pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$" } },
  { field_name: "emergency_full_name", label: "Emergency contact — full name", field_type: "text", required: true, step_number: 3, step_name: "Contact & Emergency Contact", display_order: 7, validation_rules: { maxLength: 120, block_group: "emergency_contact" } },
  { field_name: "emergency_country_of_residence", label: "Emergency contact — country of residence", field_type: "country", required: true, step_number: 3, step_name: "Contact & Emergency Contact", display_order: 8, validation_rules: { source: "ISO3166-1", block_group: "emergency_contact" } },
  { field_name: "emergency_telephone", label: "Emergency contact — telephone", field_type: "text", required: true, step_number: 3, step_name: "Contact & Emergency Contact", display_order: 9, placeholder: "Including country code", validation_rules: { maxLength: 30, block_group: "emergency_contact" } },
  { field_name: "emergency_relationship", label: "Emergency contact — relationship to applicant", field_type: "text", required: true, step_number: 3, step_name: "Contact & Emergency Contact", display_order: 10, placeholder: "e.g. parent, spouse, sibling", validation_rules: { maxLength: 60, block_group: "emergency_contact" } },

  // ═════════════════════════════════════════════════════════════════════════
  // STEP 4: Marital & Family  (Annex-17 §5)
  // ═════════════════════════════════════════════════════════════════════════
  { field_name: "marital_status", label: "Current marital status", field_type: "radio", required: true, step_number: 4, step_name: "Marital & Family", display_order: 1, options: MARITAL_STATUS_OPTIONS },
  { field_name: "spouse_family_name_en", label: "Spouse — family name (English)", field_type: "text", required: true, step_number: 4, step_name: "Marital & Family", display_order: 2, conditional_logic: { showIf: IS_MARRIED }, validation_rules: { maxLength: 50, inline_group: "spouse_name", block_group: "spouse" } },
  { field_name: "spouse_given_names_en", label: "Spouse — given names (English)", field_type: "text", required: true, step_number: 4, step_name: "Marital & Family", display_order: 3, conditional_logic: { showIf: IS_MARRIED }, validation_rules: { maxLength: 80, inline_group: "spouse_name", block_group: "spouse" } },
  { field_name: "spouse_dob", label: "Spouse — date of birth", field_type: "date", required: true, step_number: 4, step_name: "Marital & Family", display_order: 4, conditional_logic: { showIf: IS_MARRIED }, placeholder: "YYYY/MM/DD", validation_rules: { format: "YYYY/MM/DD", block_group: "spouse" } },
  { field_name: "spouse_nationality", label: "Spouse — nationality", field_type: "country", required: true, step_number: 4, step_name: "Marital & Family", display_order: 5, conditional_logic: { showIf: IS_MARRIED }, validation_rules: { source: "ISO3166-1", block_group: "spouse" } },
  { field_name: "spouse_address", label: "Spouse — residential address", field_type: "textarea", required: true, step_number: 4, step_name: "Marital & Family", display_order: 6, conditional_logic: { showIf: IS_MARRIED }, validation_rules: { maxLength: 300, block_group: "spouse" } },
  { field_name: "spouse_contact_no", label: "Spouse — contact number", field_type: "text", required: true, step_number: 4, step_name: "Marital & Family", display_order: 7, conditional_logic: { showIf: IS_MARRIED }, placeholder: "Including country code", validation_rules: { maxLength: 30, block_group: "spouse" } },
  { field_name: "has_children", label: "Do you have any children?", field_type: "radio", required: true, step_number: 4, step_name: "Marital & Family", display_order: 8, options: YES_NO },
  { field_name: "number_of_children", label: "Number of children", field_type: "text", required: true, step_number: 4, step_name: "Marital & Family", display_order: 9, conditional_logic: { showIf: HAS_CHILDREN }, placeholder: "e.g. 2", validation_rules: { pattern: "^[0-9]{1,2}$" } },

  // ═════════════════════════════════════════════════════════════════════════
  // STEP 5: Education & Employment  (Annex-17 §6 + §7)
  // ═════════════════════════════════════════════════════════════════════════
  { field_name: "highest_education", label: "Highest education completed", field_type: "radio", required: true, step_number: 5, step_name: "Education & Employment", display_order: 1, options: HIGHEST_EDUCATION_OPTIONS },
  { field_name: "highest_education_other", label: "Highest education — Other (please specify)", field_type: "text", required: true, step_number: 5, step_name: "Education & Employment", display_order: 2, conditional_logic: { showIf: EDUCATION_OTHER }, validation_rules: { maxLength: 120 } },
  { field_name: "school_name", label: "Name of school (most recent)", field_type: "text", required: true, step_number: 5, step_name: "Education & Employment", display_order: 3, validation_rules: { maxLength: 120, block_group: "school" } },
  { field_name: "school_location", label: "School location (city / province / country)", field_type: "text", required: true, step_number: 5, step_name: "Education & Employment", display_order: 4, validation_rules: { maxLength: 200, block_group: "school" } },
  { field_name: "employment_status", label: "Current occupation / employment status", field_type: "radio", required: true, step_number: 5, step_name: "Education & Employment", display_order: 5, options: EMPLOYMENT_STATUS_OPTIONS },
  { field_name: "employment_status_other", label: "Employment status — Other (please specify)", field_type: "text", required: true, step_number: 5, step_name: "Education & Employment", display_order: 6, conditional_logic: { showIf: EMPLOYMENT_STATUS_OTHER }, validation_rules: { maxLength: 120 } },
  { field_name: "employer_name", label: "Company / institution / school name", field_type: "text", required: true, step_number: 5, step_name: "Education & Employment", display_order: 7, conditional_logic: { showIf: IS_EMPLOYED_OR_STUDYING }, validation_rules: { maxLength: 120, block_group: "employer" } },
  { field_name: "employer_position", label: "Position / course", field_type: "text", required: true, step_number: 5, step_name: "Education & Employment", display_order: 8, conditional_logic: { showIf: IS_EMPLOYED_OR_STUDYING }, validation_rules: { maxLength: 80, block_group: "employer" } },
  { field_name: "employer_address", label: "Company / institution / school address", field_type: "textarea", required: true, step_number: 5, step_name: "Education & Employment", display_order: 9, conditional_logic: { showIf: IS_EMPLOYED_OR_STUDYING }, validation_rules: { maxLength: 300, block_group: "employer" } },
  { field_name: "employer_telephone", label: "Company / institution / school telephone", field_type: "text", required: true, step_number: 5, step_name: "Education & Employment", display_order: 10, conditional_logic: { showIf: IS_EMPLOYED_OR_STUDYING }, placeholder: "Including country code", validation_rules: { maxLength: 30, block_group: "employer" } },

  // ═════════════════════════════════════════════════════════════════════════
  // STEP 6: Trip & Visit  (Annex-17 §8.1–8.5)
  // ═════════════════════════════════════════════════════════════════════════
  { field_name: "purpose_of_visit", label: "Purpose of visit to Korea", field_type: "select", required: true, step_number: 6, step_name: "Trip & Visit", display_order: 1, options: PURPOSE_OF_VISIT_OPTIONS, placeholder: "C-3-9 typically: Tourism / Transit or Visiting Family / Relatives / Friends" },
  { field_name: "purpose_of_visit_other", label: "Purpose of visit — Other (please specify)", field_type: "text", required: true, step_number: 6, step_name: "Trip & Visit", display_order: 2, conditional_logic: { showIf: PURPOSE_OTHER }, validation_rules: { maxLength: 200 } },
  { field_name: "intended_period_of_stay", label: "Intended period of stay (days)", field_type: "text", required: true, step_number: 6, step_name: "Trip & Visit", display_order: 3, placeholder: "Maximum 90 for C-3-9", validation_rules: { pattern: "^(?:[1-9]|[1-8][0-9]|90)$" } },
  { field_name: "intended_date_of_entry", label: "Intended date of entry into Korea", field_type: "date", required: true, step_number: 6, step_name: "Trip & Visit", display_order: 4, placeholder: "YYYY/MM/DD", validation_rules: { format: "YYYY/MM/DD" } },
  { field_name: "address_in_korea", label: "Address in Korea (incl. hotels)", field_type: "textarea", required: true, step_number: 6, step_name: "Trip & Visit", display_order: 5, validation_rules: { maxLength: 300 } },
  { field_name: "contact_in_korea", label: "Contact number in Korea", field_type: "text", required: true, step_number: 6, step_name: "Trip & Visit", display_order: 6, placeholder: "Including country code +82", validation_rules: { maxLength: 30 } },

  // ═════════════════════════════════════════════════════════════════════════
  // STEP 7: Travel History & Family in/with Korea  (Annex-17 §8.6–8.9)
  // ═════════════════════════════════════════════════════════════════════════
  { field_name: "travelled_to_korea_5y", label: "Have you travelled to Korea in the last 5 years?", field_type: "radio", required: true, step_number: 7, step_name: "Travel History & Family", display_order: 1, options: YES_NO },
  { field_name: "korea_visit_count", label: "Number of times visited Korea (last 5 years)", field_type: "text", required: true, step_number: 7, step_name: "Travel History & Family", display_order: 2, conditional_logic: { showIf: TRAVELLED_TO_KOREA_5Y }, placeholder: "e.g. 3", validation_rules: { pattern: "^[0-9]{1,2}$" } },
  { field_name: "korea_visit_purpose", label: "Prior Korea visit — purpose", field_type: "text", required: true, step_number: 7, step_name: "Travel History & Family", display_order: 3, conditional_logic: { showIf: TRAVELLED_TO_KOREA_5Y }, validation_rules: { maxLength: 120, repeatable: true, repeat_group: "korea_visits", max_items: 10 } },
  { field_name: "korea_visit_start_date", label: "Prior Korea visit — period start", field_type: "date", required: true, step_number: 7, step_name: "Travel History & Family", display_order: 4, conditional_logic: { showIf: TRAVELLED_TO_KOREA_5Y }, placeholder: "YYYY/MM/DD", validation_rules: { format: "YYYY/MM/DD", repeatable: true, repeat_group: "korea_visits", inline_group: "korea_visit_dates" } },
  { field_name: "korea_visit_end_date", label: "Prior Korea visit — period end", field_type: "date", required: true, step_number: 7, step_name: "Travel History & Family", display_order: 5, conditional_logic: { showIf: TRAVELLED_TO_KOREA_5Y }, placeholder: "YYYY/MM/DD", validation_rules: { format: "YYYY/MM/DD", repeatable: true, repeat_group: "korea_visits", inline_group: "korea_visit_dates" } },
  { field_name: "travelled_outside_5y", label: "Have you travelled outside your country of residence (excl. Korea) in the last 5 years?", field_type: "radio", required: true, step_number: 7, step_name: "Travel History & Family", display_order: 6, options: YES_NO },
  { field_name: "foreign_trip_country", label: "Foreign trip — country", field_type: "country", required: true, step_number: 7, step_name: "Travel History & Family", display_order: 7, conditional_logic: { showIf: TRAVELLED_OUTSIDE_5Y }, validation_rules: { source: "ISO3166-1", repeatable: true, repeat_group: "foreign_trips_5y", max_items: 10 } },
  { field_name: "foreign_trip_purpose", label: "Foreign trip — purpose", field_type: "text", required: true, step_number: 7, step_name: "Travel History & Family", display_order: 8, conditional_logic: { showIf: TRAVELLED_OUTSIDE_5Y }, validation_rules: { maxLength: 120, repeatable: true, repeat_group: "foreign_trips_5y" } },
  { field_name: "foreign_trip_start_date", label: "Foreign trip — period start", field_type: "date", required: true, step_number: 7, step_name: "Travel History & Family", display_order: 9, conditional_logic: { showIf: TRAVELLED_OUTSIDE_5Y }, placeholder: "YYYY/MM/DD", validation_rules: { format: "YYYY/MM/DD", repeatable: true, repeat_group: "foreign_trips_5y", inline_group: "foreign_trip_dates" } },
  { field_name: "foreign_trip_end_date", label: "Foreign trip — period end", field_type: "date", required: true, step_number: 7, step_name: "Travel History & Family", display_order: 10, conditional_logic: { showIf: TRAVELLED_OUTSIDE_5Y }, placeholder: "YYYY/MM/DD", validation_rules: { format: "YYYY/MM/DD", repeatable: true, repeat_group: "foreign_trips_5y", inline_group: "foreign_trip_dates" } },
  { field_name: "has_family_in_korea", label: "Do you have any family members currently staying in Korea?", field_type: "radio", required: true, step_number: 7, step_name: "Travel History & Family", display_order: 11, options: YES_NO, placeholder: "Spouse, children, parents, siblings" },
  { field_name: "family_in_korea_full_name", label: "Family in Korea — full name (English)", field_type: "text", required: true, step_number: 7, step_name: "Travel History & Family", display_order: 12, conditional_logic: { showIf: HAS_FAMILY_IN_KOREA }, validation_rules: { maxLength: 120, repeatable: true, repeat_group: "family_in_korea", max_items: 10 } },
  { field_name: "family_in_korea_dob", label: "Family in Korea — date of birth", field_type: "date", required: true, step_number: 7, step_name: "Travel History & Family", display_order: 13, conditional_logic: { showIf: HAS_FAMILY_IN_KOREA }, placeholder: "YYYY/MM/DD", validation_rules: { format: "YYYY/MM/DD", repeatable: true, repeat_group: "family_in_korea" } },
  { field_name: "family_in_korea_nationality", label: "Family in Korea — nationality", field_type: "country", required: true, step_number: 7, step_name: "Travel History & Family", display_order: 14, conditional_logic: { showIf: HAS_FAMILY_IN_KOREA }, validation_rules: { source: "ISO3166-1", repeatable: true, repeat_group: "family_in_korea" } },
  { field_name: "family_in_korea_relationship", label: "Family in Korea — relationship to applicant", field_type: "text", required: true, step_number: 7, step_name: "Travel History & Family", display_order: 15, conditional_logic: { showIf: HAS_FAMILY_IN_KOREA }, placeholder: "e.g. spouse, parent, sibling, child", validation_rules: { maxLength: 60, repeatable: true, repeat_group: "family_in_korea" } },
  { field_name: "travelling_with_family", label: "Are you travelling to Korea with any family members?", field_type: "radio", required: true, step_number: 7, step_name: "Travel History & Family", display_order: 16, options: YES_NO },
  { field_name: "family_with_full_name", label: "Travelling-with family — full name (English)", field_type: "text", required: true, step_number: 7, step_name: "Travel History & Family", display_order: 17, conditional_logic: { showIf: TRAVELLING_WITH_FAMILY }, validation_rules: { maxLength: 120, repeatable: true, repeat_group: "family_travelling_with", max_items: 10 } },
  { field_name: "family_with_dob", label: "Travelling-with family — date of birth", field_type: "date", required: true, step_number: 7, step_name: "Travel History & Family", display_order: 18, conditional_logic: { showIf: TRAVELLING_WITH_FAMILY }, placeholder: "YYYY/MM/DD", validation_rules: { format: "YYYY/MM/DD", repeatable: true, repeat_group: "family_travelling_with" } },
  { field_name: "family_with_nationality", label: "Travelling-with family — nationality", field_type: "country", required: true, step_number: 7, step_name: "Travel History & Family", display_order: 19, conditional_logic: { showIf: TRAVELLING_WITH_FAMILY }, validation_rules: { source: "ISO3166-1", repeatable: true, repeat_group: "family_travelling_with" } },
  { field_name: "family_with_relationship", label: "Travelling-with family — relationship to applicant", field_type: "text", required: true, step_number: 7, step_name: "Travel History & Family", display_order: 20, conditional_logic: { showIf: TRAVELLING_WITH_FAMILY }, placeholder: "e.g. spouse, parent, sibling, child", validation_rules: { maxLength: 60, repeatable: true, repeat_group: "family_travelling_with" } },

  // ═════════════════════════════════════════════════════════════════════════
  // STEP 8: Invitation, Funding, Form Assistance & Declaration  (Annex-17 §9–§12)
  // Annex-17 §12.3 (applicant signature) is intentionally out of schema —
  // the form is paper-signed at KVAC. Photo §1.0 is also out of schema (file
  // upload via application_documents).
  // ═════════════════════════════════════════════════════════════════════════
  { field_name: "has_inviter", label: "Is anyone inviting you to Korea?", field_type: "radio", required: true, step_number: 8, step_name: "Invitation, Funding & Declaration", display_order: 1, options: YES_NO, placeholder: "Korean national, foreign resident in Korea, company, or institute" },
  { field_name: "inviter_name", label: "Inviter — name (person or organisation)", field_type: "text", required: true, step_number: 8, step_name: "Invitation, Funding & Declaration", display_order: 2, conditional_logic: { showIf: HAS_INVITER }, validation_rules: { maxLength: 120, block_group: "inviter" } },
  { field_name: "inviter_dob_or_brn", label: "Inviter — date of birth or business registration number", field_type: "text", required: true, step_number: 8, step_name: "Invitation, Funding & Declaration", display_order: 3, conditional_logic: { showIf: HAS_INVITER }, placeholder: "YYYY/MM/DD or 10-digit BRN", validation_rules: { maxLength: 30, block_group: "inviter" } },
  { field_name: "inviter_relationship", label: "Inviter — relationship to applicant", field_type: "text", required: true, step_number: 8, step_name: "Invitation, Funding & Declaration", display_order: 4, conditional_logic: { showIf: HAS_INVITER }, placeholder: "e.g. friend, business partner, relative", validation_rules: { maxLength: 80, block_group: "inviter" } },
  { field_name: "inviter_address", label: "Inviter — address in Korea", field_type: "textarea", required: true, step_number: 8, step_name: "Invitation, Funding & Declaration", display_order: 5, conditional_logic: { showIf: HAS_INVITER }, validation_rules: { maxLength: 300, block_group: "inviter" } },
  { field_name: "inviter_phone", label: "Inviter — phone number", field_type: "text", required: true, step_number: 8, step_name: "Invitation, Funding & Declaration", display_order: 6, conditional_logic: { showIf: HAS_INVITER }, placeholder: "Including country code +82", validation_rules: { maxLength: 30, block_group: "inviter" } },
  { field_name: "estimated_travel_costs_usd", label: "Estimated travel costs (USD)", field_type: "text", required: true, step_number: 8, step_name: "Invitation, Funding & Declaration", display_order: 7, placeholder: "e.g. 3000", validation_rules: { pattern: "^[0-9]{1,8}$" } },
  { field_name: "payer_name", label: "Payer — name (person or organisation)", field_type: "text", required: true, step_number: 8, step_name: "Invitation, Funding & Declaration", display_order: 8, validation_rules: { maxLength: 120, block_group: "payer" } },
  { field_name: "payer_relationship", label: "Payer — relationship to applicant", field_type: "text", required: true, step_number: 8, step_name: "Invitation, Funding & Declaration", display_order: 9, placeholder: "e.g. self, employer, parent", validation_rules: { maxLength: 80, block_group: "payer" } },
  { field_name: "payer_support_type", label: "Payer — type of support", field_type: "text", required: true, step_number: 8, step_name: "Invitation, Funding & Declaration", display_order: 10, placeholder: "e.g. cash, accommodation, all-in", validation_rules: { maxLength: 120, block_group: "payer" } },
  { field_name: "payer_contact", label: "Payer — contact number", field_type: "text", required: true, step_number: 8, step_name: "Invitation, Funding & Declaration", display_order: 11, placeholder: "Including country code", validation_rules: { maxLength: 30, block_group: "payer" } },
  { field_name: "received_form_assistance", label: "Did you receive assistance completing this application?", field_type: "radio", required: true, step_number: 8, step_name: "Invitation, Funding & Declaration", display_order: 12, options: YES_NO },
  { field_name: "assistant_full_name", label: "Assistant — full name", field_type: "text", required: true, step_number: 8, step_name: "Invitation, Funding & Declaration", display_order: 13, conditional_logic: { showIf: RECEIVED_FORM_ASSISTANCE }, validation_rules: { maxLength: 120, block_group: "assistant" } },
  { field_name: "assistant_dob", label: "Assistant — date of birth", field_type: "date", required: true, step_number: 8, step_name: "Invitation, Funding & Declaration", display_order: 14, conditional_logic: { showIf: RECEIVED_FORM_ASSISTANCE }, placeholder: "YYYY/MM/DD", validation_rules: { format: "YYYY/MM/DD", block_group: "assistant" } },
  { field_name: "assistant_telephone", label: "Assistant — telephone", field_type: "text", required: true, step_number: 8, step_name: "Invitation, Funding & Declaration", display_order: 15, conditional_logic: { showIf: RECEIVED_FORM_ASSISTANCE }, placeholder: "Including country code", validation_rules: { maxLength: 30, block_group: "assistant" } },
  { field_name: "assistant_relationship", label: "Assistant — relationship to applicant", field_type: "text", required: true, step_number: 8, step_name: "Invitation, Funding & Declaration", display_order: 16, conditional_logic: { showIf: RECEIVED_FORM_ASSISTANCE }, placeholder: "e.g. agent, family, friend", validation_rules: { maxLength: 80, block_group: "assistant" } },
  { field_name: "application_date", label: "Date of application", field_type: "date", required: true, step_number: 8, step_name: "Invitation, Funding & Declaration", display_order: 17, placeholder: "YYYY/MM/DD", validation_rules: { format: "YYYY/MM/DD" } },
  { field_name: "declaration_consent", label: "I declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Republic of Korea.", field_type: "checkbox", required: true, step_number: 8, step_name: "Invitation, Funding & Declaration", display_order: 18, options: [{ value: "yes", text: "I agree" }] },
];

// ─── Seed Runner ──────────────────────────────────────────────────────────

async function seed() {
  console.log(`Seeding ${FIELDS.length} fields for visa_type="${VISA_TYPE}"...\n`);

  const { error: delError } = await supabase
    .from("visa_form_fields")
    .delete()
    .eq("visa_type", VISA_TYPE);
  if (delError) {
    console.error(`Error deleting existing ${VISA_TYPE} fields:`, delError.message);
  } else {
    console.log(`Cleared existing ${VISA_TYPE} fields`);
  }

  const rows = FIELDS.map((f) => ({
    visa_type: VISA_TYPE,
    field_name: f.field_name,
    label: f.label,
    field_type: f.field_type,
    required: f.required,
    step_number: f.step_number,
    step_name: f.step_name,
    display_order: f.display_order,
    placeholder: f.placeholder ?? null,
    validation_rules: f.validation_rules ?? null,
    options: f.options ?? null,
    conditional_logic: f.conditional_logic ?? null,
  }));

  const BATCH = 20;
  let total = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { data, error } = await supabase
      .from("visa_form_fields")
      .insert(batch)
      .select("id");
    if (error) {
      console.error(`Batch ${Math.floor(i / BATCH) + 1} error:`, error.message);
    } else {
      total += data?.length ?? 0;
      process.stdout.write(`Batch ${Math.floor(i / BATCH) + 1}: ${data?.length ?? 0} inserted\n`);
    }
  }
  console.log(`\nDone: ${total} rows seeded (${FIELDS.length} defined)`);
}

seed().catch((err) => { console.error(err); process.exit(1); });
