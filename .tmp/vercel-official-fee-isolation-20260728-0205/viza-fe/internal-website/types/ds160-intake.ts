/**
 * DS-160 Complete Intake Schema
 *
 * This type represents the full set of fields the simplified intake form
 * must be capable of collecting, covering the entire DS-160 answer schema.
 *
 * Fields are grouped by DS-160 section. The hardcoded intake steps
 * (PersonalInfoStep, PassportStep, TravelInfoStep) cover core fields directly.
 * Remaining fields are collected via the dynamic form system (visa_form_fields).
 *
 * All field names align with the DS-160 answer keys used by the CEAC autofill
 * worker in submission-service/src/ds160-form-mappings.ts and the seed script
 * in agent-backend/scripts/seed-ds160-form-fields.ts.
 *
 * US-017: Expand the simplified intake schema to cover the full DS-160 answer set
 */

// ═══════════════════════════════════════════════════════════════════════════════
// HARDCODED STEP DATA — collected by PersonalInfoStep, PassportStep, TravelInfoStep
// These use DS-160-safe field structures with no lossy mappings.
// ═══════════════════════════════════════════════════════════════════════════════

/** PersonalInfoStep — DS-160 Personal Information (Pages 1–2) */
export interface DS160PersonalInfoData {
  surname: string;
  givenNames: string;
  fullNameNativeAlphabet: string;
  sex: string;
  maritalStatus: string;
  dateOfBirth: string;
  cityOfBirth: string;
  stateOfBirth: string;
  countryOfBirth: string;
  nationality: string;
}

/** PassportStep — DS-160 Passport Information */
export interface DS160PassportData {
  passportDocumentType: string;
  passportNumber: string;
  passportBookNumber: string;
  passportIssuingCountry: string;
  passportIssuanceCity: string;
  passportIssuanceDate: string;
  passportExpirationDate: string;
}

/** TravelInfoStep — DS-160 Travel Information */
export interface DS160TravelData {
  purposeOfTrip: string;
  arrivalDate: string;
  departureDate: string;
  arrivalCity: string;
  accommodationName: string;
  usAddressStreet1: string;
  usAddressCity: string;
  usAddressState: string;
  usAddressZip: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DYNAMIC FORM DATA — collected via visa_form_fields + DynamicStepForm
// Stored as key-value pairs in visa_application_answers.
// Types below document the expected shape; actual storage is Record<string, string>.
// ═══════════════════════════════════════════════════════════════════════════════

/** Address and Phone section fields */
export interface DS160AddressPhoneFields {
  home_address_line1: string;
  home_address_line2: string;
  home_address_city: string;
  home_address_state_province: string;
  home_address_postal_code: string;
  home_address_country: string;
  primary_phone: string;
  secondary_phone: string;
  work_phone: string;
  email_address: string;
  social_media_platform: string;
  social_media_handle: string;
}

/** US Contact section fields */
export interface DS160USContactFields {
  us_contact_surname: string;
  us_contact_given_names: string;
  us_contact_organization: string;
  us_contact_relationship: string;
  us_contact_address_street1: string;
  us_contact_city: string;
  us_contact_state: string;
  us_contact_zip: string;
  us_contact_phone: string;
  us_contact_email: string;
}

/** Family: Parents section fields */
export interface DS160FamilyParentsFields {
  father_surname: string;
  father_given_names: string;
  father_date_of_birth: string;
  father_in_us: string;
  father_us_status: string;
  mother_surname: string;
  mother_given_names: string;
  mother_date_of_birth: string;
  mother_in_us: string;
  mother_us_status: string;
  has_immediate_us_relatives: string;
}

/** Family: Spouse section fields */
export interface DS160FamilySpouseFields {
  spouse_surname: string;
  spouse_given_names: string;
  spouse_date_of_birth: string;
  spouse_nationality: string;
  spouse_city_of_birth: string;
  spouse_country_of_birth: string;
  spouse_address_type: string;
}

/** Work/Education section fields */
export interface DS160WorkEducationFields {
  primary_occupation: string;
  employer_name: string;
  employer_address_line1: string;
  employer_city: string;
  employer_country: string;
  employer_phone: string;
  job_title: string;
  employment_start_date: string;
  monthly_salary: string;
  job_duties: string;
  has_attended_education: string;
  education_institution_name: string;
  education_course_of_study: string;
}

/** Previous US Travel section fields */
export interface DS160PreviousTravelFields {
  has_been_in_us: string;
  has_us_visa: string;
  has_been_refused: string;
  immigrant_petition_filed: string;
}

/** Security and Background — 29 yes/no questions, each with an _explain counterpart */
export interface DS160SecurityFields {
  [key: `has_${string}` | `is_${string}` | `intend_${string}`]: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMBINED INTAKE — the union of hardcoded + dynamic fields
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * The complete DS-160 intake dataset.
 *
 * - `personal`, `passport`, `travel` come from hardcoded step components
 * - `dynamicAnswers` is a flat Record<string, string> covering all remaining
 *   DS-160 fields (address, family, work, security, etc.) collected via the
 *   dynamic form system and stored in visa_application_answers.
 */
export interface DS160CompleteIntake {
  personal: DS160PersonalInfoData;
  passport: DS160PassportData;
  travel: DS160TravelData;
  dynamicAnswers: Record<string, string>;
}

/**
 * Maps hardcoded step fields to their DS-160 answer key equivalents.
 * Used by the normalization layer (US-018) to flatten the intake into
 * a single Record<string, string> keyed by DS-160 field names.
 */
export const HARDCODED_TO_DS160_MAP: Record<string, string> = {
  // Personal
  "personal.surname": "surname",
  "personal.givenNames": "given_names",
  "personal.fullNameNativeAlphabet": "full_name_native_alphabet",
  "personal.sex": "sex",
  "personal.maritalStatus": "marital_status",
  "personal.dateOfBirth": "date_of_birth",
  "personal.cityOfBirth": "city_of_birth",
  "personal.stateOfBirth": "state_of_birth",
  "personal.countryOfBirth": "country_of_birth",
  "personal.nationality": "nationality_country",
  // Passport
  "passport.passportDocumentType": "passport_document_type",
  "passport.passportNumber": "passport_number",
  "passport.passportBookNumber": "passport_book_number",
  "passport.passportIssuingCountry": "passport_issuing_country",
  "passport.passportIssuanceCity": "passport_issuance_city",
  "passport.passportIssuanceDate": "passport_issuance_date",
  "passport.passportExpirationDate": "passport_expiration_date",
  // Travel
  "travel.purposeOfTrip": "purpose_of_trip",
  "travel.arrivalDate": "intended_arrival_date",
  "travel.departureDate": "departure_date",
  "travel.arrivalCity": "arrival_city",
  "travel.accommodationName": "planned_location",
  "travel.usAddressStreet1": "us_address_street1",
  "travel.usAddressCity": "us_address_city",
  "travel.usAddressState": "us_address_state",
  "travel.usAddressZip": "us_address_zip",
};
