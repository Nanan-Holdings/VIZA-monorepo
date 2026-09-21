import type { Ds160SeedField } from "./ds160-parity";
import { DS160_REPEAT_GROUP_CONTRACT_LIST } from "./ds160-repeat-contract";

/**
 * DS-160 Coverage Audit
 *
 * Compares the full DS-160 answer field set (from seed-ds160-form-fields)
 * against the simplified intake form coverage (hardcoded steps + applicant_profiles).
 *
 * Run: npx tsx src/ds160-coverage-audit.ts
 *
 * US-016: Produce a field-by-field DS-160 coverage audit against the simplified form
 */

// ═══════════════════════════════════════════════════════════════════════════════
// 1. FULL DS-160 FIELD SET (from seed-ds160-form-fields.ts)
//    Organised by step/section exactly as the CEAC form orders them.
// ═══════════════════════════════════════════════════════════════════════════════

interface DS160Field {
  fieldName: string;
  step: string;
  /** Where the field is covered from in the simplified form (null = not covered) */
  simplifiedSource: SimplifiedSource | null;
}

interface SimplifiedSource {
  /** Which simplified-form surface provides the data */
  origin: "profile" | "personalInfoStep" | "passportStep" | "travelInfoStep" | "application_table";
  /** The field name in the source surface */
  sourceField: string;
  /** Whether the mapping is lossy and needs restructuring */
  lossy: boolean;
  /** Description of the lossy mapping or transform needed */
  notes?: string;
}

type CoverageStatus = "covered" | "lossy" | "missing";

// Full DS-160 field list grouped by step
const DS160_FIELDS: DS160Field[] = [
  // ── Step 1-2: Personal Information ──────────────────────────────────────
  { fieldName: "surname", step: "Personal Information 1", simplifiedSource: { origin: "profile", sourceField: "full_name", lossy: true, notes: "full_name is unsplit — needs surname extraction" } },
  { fieldName: "given_names", step: "Personal Information 1", simplifiedSource: { origin: "profile", sourceField: "full_name", lossy: true, notes: "full_name is unsplit — needs given-name extraction" } },
  { fieldName: "full_name_native_alphabet", step: "Personal Information 1", simplifiedSource: null },
  { fieldName: "other_names_used", step: "Personal Information 1", simplifiedSource: null },
  { fieldName: "other_surname", step: "Personal Information 1", simplifiedSource: null },
  { fieldName: "other_given_names", step: "Personal Information 1", simplifiedSource: null },
  { fieldName: "other_name_type", step: "Personal Information 1", simplifiedSource: null },
  { fieldName: "has_telecode", step: "Personal Information 1", simplifiedSource: null },
  { fieldName: "telecode_surname", step: "Personal Information 1", simplifiedSource: null },
  { fieldName: "telecode_given_names", step: "Personal Information 1", simplifiedSource: null },
  { fieldName: "sex", step: "Personal Information 1", simplifiedSource: { origin: "personalInfoStep", sourceField: "gender", lossy: false, notes: "Direct map gender → sex" } },
  { fieldName: "marital_status", step: "Personal Information 1", simplifiedSource: null },
  { fieldName: "marital_status_other_explain", step: "Personal Information 1", simplifiedSource: null },
  { fieldName: "date_of_birth", step: "Personal Information 1", simplifiedSource: { origin: "personalInfoStep", sourceField: "dateOfBirth", lossy: false } },
  { fieldName: "city_of_birth", step: "Personal Information 1", simplifiedSource: { origin: "personalInfoStep", sourceField: "placeOfBirth", lossy: true, notes: "placeOfBirth is a single text field — needs city extraction" } },
  { fieldName: "state_of_birth", step: "Personal Information 1", simplifiedSource: { origin: "personalInfoStep", sourceField: "placeOfBirth", lossy: true, notes: "placeOfBirth is a single text field — needs state extraction" } },
  { fieldName: "country_of_birth", step: "Personal Information 1", simplifiedSource: null },
  { fieldName: "nationality_country", step: "Personal Information 2", simplifiedSource: { origin: "personalInfoStep", sourceField: "nationality", lossy: false } },
  { fieldName: "other_nationality", step: "Personal Information 2", simplifiedSource: null },
  { fieldName: "other_nationality_country", step: "Personal Information 2", simplifiedSource: null },
  { fieldName: "other_nationality_has_passport", step: "Personal Information 2", simplifiedSource: null },
  { fieldName: "other_nationality_passport_number", step: "Personal Information 2", simplifiedSource: null },
  { fieldName: "permanent_resident_other_country", step: "Personal Information 2", simplifiedSource: null },
  { fieldName: "other_permanent_resident_country", step: "Personal Information 2", simplifiedSource: null },
  { fieldName: "national_id_number", step: "Personal Information 2", simplifiedSource: null },
  { fieldName: "us_social_security_number", step: "Personal Information 2", simplifiedSource: null },
  { fieldName: "us_taxpayer_id", step: "Personal Information 2", simplifiedSource: null },

  // ── Step 3-4: Travel Information ────────────────────────────────────────
  { fieldName: "purpose_of_trip", step: "Travel Information", simplifiedSource: { origin: "travelInfoStep", sourceField: "purpose", lossy: true, notes: "Simplified purpose values (tourism|business|etc.) may not match CEAC coded values" } },
  { fieldName: "purpose_of_trip_specify", step: "Travel Information", simplifiedSource: null },
  { fieldName: "has_specific_plans", step: "Travel Information", simplifiedSource: null },
  { fieldName: "arrival_date_day", step: "Travel Information", simplifiedSource: { origin: "travelInfoStep", sourceField: "arrivalDate", lossy: true, notes: "arrivalDate is ISO string — needs day extraction" } },
  { fieldName: "arrival_date_month", step: "Travel Information", simplifiedSource: { origin: "travelInfoStep", sourceField: "arrivalDate", lossy: true, notes: "arrivalDate is ISO string — needs month extraction" } },
  { fieldName: "arrival_date_year", step: "Travel Information", simplifiedSource: { origin: "travelInfoStep", sourceField: "arrivalDate", lossy: true, notes: "arrivalDate is ISO string — needs year extraction" } },
  { fieldName: "arrival_flight", step: "Travel Information", simplifiedSource: null },
  { fieldName: "arrival_city", step: "Travel Information", simplifiedSource: null },
  { fieldName: "departure_date_day", step: "Travel Information", simplifiedSource: { origin: "travelInfoStep", sourceField: "departureDate", lossy: true, notes: "departureDate is ISO string — needs day extraction" } },
  { fieldName: "departure_date_month", step: "Travel Information", simplifiedSource: { origin: "travelInfoStep", sourceField: "departureDate", lossy: true, notes: "departureDate is ISO string — needs month extraction" } },
  { fieldName: "departure_date_year", step: "Travel Information", simplifiedSource: { origin: "travelInfoStep", sourceField: "departureDate", lossy: true, notes: "departureDate is ISO string — needs year extraction" } },
  { fieldName: "departure_flight", step: "Travel Information", simplifiedSource: null },
  { fieldName: "departure_city", step: "Travel Information", simplifiedSource: null },
  { fieldName: "planned_location", step: "Travel Information", simplifiedSource: null },
  { fieldName: "intended_arrival_date_day", step: "Travel Information", simplifiedSource: { origin: "travelInfoStep", sourceField: "arrivalDate", lossy: true, notes: "Duplicate of arrival_date — split needed" } },
  { fieldName: "intended_arrival_date_month", step: "Travel Information", simplifiedSource: { origin: "travelInfoStep", sourceField: "arrivalDate", lossy: true, notes: "Duplicate of arrival_date — split needed" } },
  { fieldName: "intended_arrival_date_year", step: "Travel Information", simplifiedSource: { origin: "travelInfoStep", sourceField: "arrivalDate", lossy: true, notes: "Duplicate of arrival_date — split needed" } },
  { fieldName: "intended_length_of_stay_value", step: "Travel Information", simplifiedSource: { origin: "travelInfoStep", sourceField: "departureDate", lossy: true, notes: "Can be derived from arrivalDate-departureDate difference" } },
  { fieldName: "intended_length_of_stay_unit", step: "Travel Information", simplifiedSource: null },
  { fieldName: "us_address_street1", step: "Travel Information", simplifiedSource: { origin: "travelInfoStep", sourceField: "accommodationAddress", lossy: true, notes: "accommodationAddress is unstructured — needs street extraction" } },
  { fieldName: "us_address_street2", step: "Travel Information", simplifiedSource: null },
  { fieldName: "us_address_city", step: "Travel Information", simplifiedSource: { origin: "travelInfoStep", sourceField: "accommodationAddress", lossy: true, notes: "accommodationAddress is unstructured — needs city extraction" } },
  { fieldName: "us_address_state", step: "Travel Information", simplifiedSource: null },
  { fieldName: "us_address_zip", step: "Travel Information", simplifiedSource: null },
  { fieldName: "trip_payer_type", step: "Travel Information", simplifiedSource: null },
  { fieldName: "payer_surname", step: "Travel Information", simplifiedSource: null },
  { fieldName: "payer_given_names", step: "Travel Information", simplifiedSource: null },
  { fieldName: "payer_phone", step: "Travel Information", simplifiedSource: null },
  { fieldName: "payer_email", step: "Travel Information", simplifiedSource: null },
  { fieldName: "payer_relationship", step: "Travel Information", simplifiedSource: null },
  { fieldName: "payer_address_same_as_home", step: "Travel Information", simplifiedSource: null },
  { fieldName: "payer_address_street1", step: "Travel Information", simplifiedSource: null },
  { fieldName: "payer_address_street2", step: "Travel Information", simplifiedSource: null },
  { fieldName: "payer_address_city", step: "Travel Information", simplifiedSource: null },
  { fieldName: "payer_address_state", step: "Travel Information", simplifiedSource: null },
  { fieldName: "payer_address_postal", step: "Travel Information", simplifiedSource: null },
  { fieldName: "payer_address_country", step: "Travel Information", simplifiedSource: null },
  { fieldName: "payer_org_name", step: "Travel Information", simplifiedSource: null },
  { fieldName: "payer_org_phone", step: "Travel Information", simplifiedSource: null },
  { fieldName: "payer_org_relationship", step: "Travel Information", simplifiedSource: null },
  { fieldName: "payer_org_address_street1", step: "Travel Information", simplifiedSource: null },
  { fieldName: "payer_org_address_street2", step: "Travel Information", simplifiedSource: null },
  { fieldName: "payer_org_address_city", step: "Travel Information", simplifiedSource: null },
  { fieldName: "payer_org_address_state", step: "Travel Information", simplifiedSource: null },
  { fieldName: "payer_org_address_postal", step: "Travel Information", simplifiedSource: null },
  { fieldName: "payer_org_address_country", step: "Travel Information", simplifiedSource: null },

  // ── Step 5: Travel Companions ───────────────────────────────────────────
  { fieldName: "has_companions", step: "Travel Companions", simplifiedSource: null },
  { fieldName: "companion_group_travel", step: "Travel Companions", simplifiedSource: null },
  { fieldName: "companion_group_name", step: "Travel Companions", simplifiedSource: null },
  { fieldName: "companion_surname", step: "Travel Companions", simplifiedSource: null },
  { fieldName: "companion_given_names", step: "Travel Companions", simplifiedSource: null },
  { fieldName: "companion_relationship", step: "Travel Companions", simplifiedSource: null },

  // ── Step 6: Previous US Travel ──────────────────────────────────────────
  { fieldName: "has_been_in_us", step: "Previous US Travel", simplifiedSource: null },
  { fieldName: "previous_visit_date_arrived", step: "Previous US Travel", simplifiedSource: null },
  { fieldName: "previous_visit_length_of_stay", step: "Previous US Travel", simplifiedSource: null },
  { fieldName: "previous_visit_length_of_stay_unit", step: "Previous US Travel", simplifiedSource: null },
  { fieldName: "has_us_drivers_license", step: "Previous US Travel", simplifiedSource: null },
  { fieldName: "us_drivers_license_number", step: "Previous US Travel", simplifiedSource: null },
  { fieldName: "us_drivers_license_state", step: "Previous US Travel", simplifiedSource: null },
  { fieldName: "has_us_visa", step: "Previous US Travel", simplifiedSource: null },
  { fieldName: "last_visa_issue_day", step: "Previous US Travel", simplifiedSource: null },
  { fieldName: "last_visa_issue_month", step: "Previous US Travel", simplifiedSource: null },
  { fieldName: "last_visa_issue_year", step: "Previous US Travel", simplifiedSource: null },
  { fieldName: "visa_number", step: "Previous US Travel", simplifiedSource: null },
  { fieldName: "visa_number_unknown", step: "Previous US Travel", simplifiedSource: null },
  { fieldName: "applying_same_visa_type", step: "Previous US Travel", simplifiedSource: null },
  { fieldName: "applying_same_country_of_issue_and_residence", step: "Previous US Travel", simplifiedSource: null },
  { fieldName: "has_been_ten_printed", step: "Previous US Travel", simplifiedSource: null },
  { fieldName: "visa_lost_or_stolen", step: "Previous US Travel", simplifiedSource: null },
  { fieldName: "year_visa_lost_or_stolen", step: "Previous US Travel", simplifiedSource: null },
  { fieldName: "visa_lost_or_stolen_explain", step: "Previous US Travel", simplifiedSource: null },
  { fieldName: "visa_cancelled_or_revoked", step: "Previous US Travel", simplifiedSource: null },
  { fieldName: "visa_cancelled_or_revoked_explain", step: "Previous US Travel", simplifiedSource: null },
  { fieldName: "has_been_refused", step: "Previous US Travel", simplifiedSource: null },
  { fieldName: "refusal_explain", step: "Previous US Travel", simplifiedSource: null },
  { fieldName: "immigrant_petition_filed", step: "Previous US Travel", simplifiedSource: null },
  { fieldName: "immigrant_petition_explain", step: "Previous US Travel", simplifiedSource: null },

  // ── Step 7: Address and Phone ───────────────────────────────────────────
  { fieldName: "home_address_line1", step: "Address and Phone", simplifiedSource: { origin: "personalInfoStep", sourceField: "address", lossy: true, notes: "address is a single text field — needs structured line1 extraction" } },
  { fieldName: "home_address_line2", step: "Address and Phone", simplifiedSource: null },
  { fieldName: "home_address_city", step: "Address and Phone", simplifiedSource: { origin: "personalInfoStep", sourceField: "address", lossy: true, notes: "address is unstructured — city cannot be reliably extracted" } },
  { fieldName: "home_address_state_province", step: "Address and Phone", simplifiedSource: null },
  { fieldName: "home_address_postal_code", step: "Address and Phone", simplifiedSource: null },
  { fieldName: "home_address_country", step: "Address and Phone", simplifiedSource: null },
  { fieldName: "mailing_same_as_home", step: "Address and Phone", simplifiedSource: null },
  { fieldName: "mailing_address_line1", step: "Address and Phone", simplifiedSource: null },
  { fieldName: "mailing_address_line2", step: "Address and Phone", simplifiedSource: null },
  { fieldName: "mailing_address_city", step: "Address and Phone", simplifiedSource: null },
  { fieldName: "mailing_address_state", step: "Address and Phone", simplifiedSource: null },
  { fieldName: "mailing_address_postal", step: "Address and Phone", simplifiedSource: null },
  { fieldName: "mailing_address_country", step: "Address and Phone", simplifiedSource: null },
  { fieldName: "primary_phone", step: "Address and Phone", simplifiedSource: { origin: "profile", sourceField: "phone", lossy: false } },
  { fieldName: "secondary_phone", step: "Address and Phone", simplifiedSource: null },
  { fieldName: "work_phone", step: "Address and Phone", simplifiedSource: null },
  { fieldName: "has_other_phones", step: "Address and Phone", simplifiedSource: null },
  { fieldName: "additional_phone", step: "Address and Phone", simplifiedSource: null },
  { fieldName: "email_address", step: "Address and Phone", simplifiedSource: { origin: "profile", sourceField: "email", lossy: false } },
  { fieldName: "has_other_emails", step: "Address and Phone", simplifiedSource: null },
  { fieldName: "additional_email", step: "Address and Phone", simplifiedSource: null },
  { fieldName: "social_media_platform", step: "Address and Phone", simplifiedSource: null },
  { fieldName: "social_media_handle", step: "Address and Phone", simplifiedSource: null },
  { fieldName: "has_other_social_media", step: "Address and Phone", simplifiedSource: null },
  { fieldName: "other_social_media_name", step: "Address and Phone", simplifiedSource: null },
  { fieldName: "other_social_media_identifier", step: "Address and Phone", simplifiedSource: null },

  // ── Step 8: Passport ───────────────────────────────────────────────────
  { fieldName: "passport_document_type", step: "Passport", simplifiedSource: null },
  { fieldName: "passport_document_type_explain", step: "Passport", simplifiedSource: null },
  { fieldName: "passport_number", step: "Passport", simplifiedSource: { origin: "passportStep", sourceField: "passportNumber", lossy: false } },
  { fieldName: "passport_book_number", step: "Passport", simplifiedSource: null },
  { fieldName: "passport_issuing_country", step: "Passport", simplifiedSource: { origin: "passportStep", sourceField: "issuingCountry", lossy: false } },
  { fieldName: "passport_issuance_city", step: "Passport", simplifiedSource: null },
  { fieldName: "passport_issuance_state", step: "Passport", simplifiedSource: null },
  { fieldName: "passport_issuance_country", step: "Passport", simplifiedSource: null },
  { fieldName: "passport_issuance_date", step: "Passport", simplifiedSource: { origin: "passportStep", sourceField: "issueDate", lossy: false } },
  { fieldName: "passport_expiration_date", step: "Passport", simplifiedSource: { origin: "passportStep", sourceField: "expiryDate", lossy: false } },
  { fieldName: "lost_passport", step: "Passport", simplifiedSource: null },
  { fieldName: "lost_passport_number", step: "Passport", simplifiedSource: null },
  { fieldName: "lost_passport_country", step: "Passport", simplifiedSource: null },
  { fieldName: "lost_passport_explain", step: "Passport", simplifiedSource: null },

  // ── Step 9: US Contact ─────────────────────────────────────────────────
  { fieldName: "us_contact_surname", step: "US Contact", simplifiedSource: null },
  { fieldName: "us_contact_given_names", step: "US Contact", simplifiedSource: null },
  { fieldName: "us_contact_organization", step: "US Contact", simplifiedSource: null },
  { fieldName: "us_contact_relationship", step: "US Contact", simplifiedSource: null },
  { fieldName: "us_contact_address_street1", step: "US Contact", simplifiedSource: null },
  { fieldName: "us_contact_address_street2", step: "US Contact", simplifiedSource: null },
  { fieldName: "us_contact_city", step: "US Contact", simplifiedSource: null },
  { fieldName: "us_contact_state", step: "US Contact", simplifiedSource: null },
  { fieldName: "us_contact_zip", step: "US Contact", simplifiedSource: null },
  { fieldName: "us_contact_phone", step: "US Contact", simplifiedSource: null },
  { fieldName: "us_contact_email", step: "US Contact", simplifiedSource: null },

  // ── Step 10: Family - Parents ──────────────────────────────────────────
  { fieldName: "father_surname", step: "Family: Parents", simplifiedSource: null },
  { fieldName: "father_given_names", step: "Family: Parents", simplifiedSource: null },
  { fieldName: "father_date_of_birth", step: "Family: Parents", simplifiedSource: null },
  { fieldName: "father_in_us", step: "Family: Parents", simplifiedSource: null },
  { fieldName: "father_us_status", step: "Family: Parents", simplifiedSource: null },
  { fieldName: "mother_surname", step: "Family: Parents", simplifiedSource: null },
  { fieldName: "mother_given_names", step: "Family: Parents", simplifiedSource: null },
  { fieldName: "mother_date_of_birth", step: "Family: Parents", simplifiedSource: null },
  { fieldName: "mother_in_us", step: "Family: Parents", simplifiedSource: null },
  { fieldName: "mother_us_status", step: "Family: Parents", simplifiedSource: null },
  { fieldName: "has_immediate_us_relatives", step: "Family: Parents", simplifiedSource: null },
  { fieldName: "us_relative_surname", step: "Family: Parents", simplifiedSource: null },
  { fieldName: "us_relative_given_names", step: "Family: Parents", simplifiedSource: null },
  { fieldName: "us_relative_relationship", step: "Family: Parents", simplifiedSource: null },
  { fieldName: "us_relative_status", step: "Family: Parents", simplifiedSource: null },
  { fieldName: "has_other_us_relatives", step: "Family: Parents", simplifiedSource: null },

  // ── Step 11: Family - Spouse/Partner ────────────────────────────────────
  { fieldName: "spouse_surname", step: "Family: Spouse", simplifiedSource: null },
  { fieldName: "spouse_given_names", step: "Family: Spouse", simplifiedSource: null },
  { fieldName: "spouse_date_of_birth", step: "Family: Spouse", simplifiedSource: null },
  { fieldName: "spouse_nationality", step: "Family: Spouse", simplifiedSource: null },
  { fieldName: "spouse_city_of_birth", step: "Family: Spouse", simplifiedSource: null },
  { fieldName: "spouse_country_of_birth", step: "Family: Spouse", simplifiedSource: null },
  { fieldName: "spouse_address_type", step: "Family: Spouse", simplifiedSource: null },
  { fieldName: "spouse_address_street1", step: "Family: Spouse", simplifiedSource: null },
  { fieldName: "spouse_address_street2", step: "Family: Spouse", simplifiedSource: null },
  { fieldName: "spouse_address_city", step: "Family: Spouse", simplifiedSource: null },
  { fieldName: "spouse_address_state", step: "Family: Spouse", simplifiedSource: null },
  { fieldName: "spouse_address_zip", step: "Family: Spouse", simplifiedSource: null },
  { fieldName: "spouse_address_country", step: "Family: Spouse", simplifiedSource: null },
  { fieldName: "partner_surname", step: "Family: Spouse", simplifiedSource: null },
  { fieldName: "partner_given_names", step: "Family: Spouse", simplifiedSource: null },
  { fieldName: "partner_date_of_birth", step: "Family: Spouse", simplifiedSource: null },
  { fieldName: "partner_nationality", step: "Family: Spouse", simplifiedSource: null },
  { fieldName: "partner_city_of_birth", step: "Family: Spouse", simplifiedSource: null },
  { fieldName: "partner_country_of_birth", step: "Family: Spouse", simplifiedSource: null },
  { fieldName: "partner_address_type", step: "Family: Spouse", simplifiedSource: null },
  { fieldName: "partner_address_street1", step: "Family: Spouse", simplifiedSource: null },
  { fieldName: "partner_address_street2", step: "Family: Spouse", simplifiedSource: null },
  { fieldName: "partner_address_city", step: "Family: Spouse", simplifiedSource: null },
  { fieldName: "partner_address_state", step: "Family: Spouse", simplifiedSource: null },
  { fieldName: "partner_address_zip", step: "Family: Spouse", simplifiedSource: null },
  { fieldName: "partner_address_country", step: "Family: Spouse", simplifiedSource: null },
  { fieldName: "deceased_spouse_surname", step: "Family: Spouse", simplifiedSource: null },
  { fieldName: "deceased_spouse_given_names", step: "Family: Spouse", simplifiedSource: null },
  { fieldName: "deceased_spouse_date_of_birth", step: "Family: Spouse", simplifiedSource: null },
  { fieldName: "deceased_spouse_nationality", step: "Family: Spouse", simplifiedSource: null },
  { fieldName: "deceased_spouse_city_of_birth", step: "Family: Spouse", simplifiedSource: null },
  { fieldName: "deceased_spouse_country_of_birth", step: "Family: Spouse", simplifiedSource: null },
  { fieldName: "number_of_former_spouses", step: "Family: Spouse", simplifiedSource: null },
  { fieldName: "former_spouse_surname", step: "Family: Spouse", simplifiedSource: null },
  { fieldName: "former_spouse_given_names", step: "Family: Spouse", simplifiedSource: null },
  { fieldName: "former_spouse_date_of_birth", step: "Family: Spouse", simplifiedSource: null },
  { fieldName: "former_spouse_nationality", step: "Family: Spouse", simplifiedSource: null },
  { fieldName: "former_spouse_city_of_birth", step: "Family: Spouse", simplifiedSource: null },
  { fieldName: "former_spouse_country_of_birth", step: "Family: Spouse", simplifiedSource: null },
  { fieldName: "former_spouse_date_of_marriage", step: "Family: Spouse", simplifiedSource: null },
  { fieldName: "former_spouse_date_marriage_ended", step: "Family: Spouse", simplifiedSource: null },
  { fieldName: "former_spouse_how_marriage_ended", step: "Family: Spouse", simplifiedSource: null },
  { fieldName: "former_spouse_country_marriage_terminated", step: "Family: Spouse", simplifiedSource: null },

  // ── Step 12-13: Work, Education, Training ──────────────────────────────
  { fieldName: "primary_occupation", step: "Work/Education", simplifiedSource: { origin: "personalInfoStep", sourceField: "occupation", lossy: true, notes: "Simplified text occupation may not match CEAC coded occupation values" } },
  { fieldName: "occupation_other_explain", step: "Work/Education", simplifiedSource: null },
  { fieldName: "not_employed_explain", step: "Work/Education", simplifiedSource: null },
  { fieldName: "employer_name", step: "Work/Education", simplifiedSource: null },
  { fieldName: "employer_address_line1", step: "Work/Education", simplifiedSource: null },
  { fieldName: "employer_address_line2", step: "Work/Education", simplifiedSource: null },
  { fieldName: "employer_city", step: "Work/Education", simplifiedSource: null },
  { fieldName: "employer_state_province", step: "Work/Education", simplifiedSource: null },
  { fieldName: "employer_postal_code", step: "Work/Education", simplifiedSource: null },
  { fieldName: "employer_country", step: "Work/Education", simplifiedSource: null },
  { fieldName: "employer_phone", step: "Work/Education", simplifiedSource: null },
  { fieldName: "job_title", step: "Work/Education", simplifiedSource: null },
  { fieldName: "employment_start_date", step: "Work/Education", simplifiedSource: null },
  { fieldName: "monthly_salary", step: "Work/Education", simplifiedSource: null },
  { fieldName: "job_duties", step: "Work/Education", simplifiedSource: null },
  { fieldName: "has_previous_employer", step: "Work/Education", simplifiedSource: null },
  { fieldName: "prev_employer_name", step: "Work/Education", simplifiedSource: null },
  { fieldName: "prev_employer_address_street1", step: "Work/Education", simplifiedSource: null },
  { fieldName: "prev_employer_address_street2", step: "Work/Education", simplifiedSource: null },
  { fieldName: "prev_employer_city", step: "Work/Education", simplifiedSource: null },
  { fieldName: "prev_employer_state", step: "Work/Education", simplifiedSource: null },
  { fieldName: "prev_employer_postal", step: "Work/Education", simplifiedSource: null },
  { fieldName: "prev_employer_country", step: "Work/Education", simplifiedSource: null },
  { fieldName: "prev_employer_phone", step: "Work/Education", simplifiedSource: null },
  { fieldName: "prev_job_title", step: "Work/Education", simplifiedSource: null },
  { fieldName: "prev_supervisor_surname", step: "Work/Education", simplifiedSource: null },
  { fieldName: "prev_supervisor_given_names", step: "Work/Education", simplifiedSource: null },
  { fieldName: "prev_employment_start_date", step: "Work/Education", simplifiedSource: null },
  { fieldName: "prev_employment_end_date", step: "Work/Education", simplifiedSource: null },
  { fieldName: "prev_job_duties", step: "Work/Education", simplifiedSource: null },
  { fieldName: "has_attended_education", step: "Work/Education", simplifiedSource: null },
  { fieldName: "education_institution_name", step: "Work/Education", simplifiedSource: null },
  { fieldName: "education_address_line1", step: "Work/Education", simplifiedSource: null },
  { fieldName: "education_address_line2", step: "Work/Education", simplifiedSource: null },
  { fieldName: "education_city", step: "Work/Education", simplifiedSource: null },
  { fieldName: "education_state_province", step: "Work/Education", simplifiedSource: null },
  { fieldName: "education_postal_code", step: "Work/Education", simplifiedSource: null },
  { fieldName: "education_country", step: "Work/Education", simplifiedSource: null },
  { fieldName: "education_course_of_study", step: "Work/Education", simplifiedSource: null },
  { fieldName: "education_start_date", step: "Work/Education", simplifiedSource: null },
  { fieldName: "education_end_date", step: "Work/Education", simplifiedSource: null },

  // ── Step 14-16: Work/Education Additional ──────────────────────────────
  { fieldName: "has_clan_tribe", step: "Work/Education: Additional", simplifiedSource: null },
  { fieldName: "clan_tribe_name", step: "Work/Education: Additional", simplifiedSource: null },
  { fieldName: "language_name", step: "Work/Education: Additional", simplifiedSource: null },
  { fieldName: "has_traveled_last_five_years", step: "Work/Education: Additional", simplifiedSource: null },
  { fieldName: "traveled_country", step: "Work/Education: Additional", simplifiedSource: null },
  { fieldName: "has_belonged_to_organization", step: "Work/Education: Additional", simplifiedSource: null },
  { fieldName: "organization_name", step: "Work/Education: Additional", simplifiedSource: null },
  { fieldName: "has_specialized_skills", step: "Work/Education: Additional", simplifiedSource: null },
  { fieldName: "specialized_skills_explain", step: "Work/Education: Additional", simplifiedSource: null },
  { fieldName: "has_served_military", step: "Work/Education: Additional", simplifiedSource: null },
  { fieldName: "military_country", step: "Work/Education: Additional", simplifiedSource: null },
  { fieldName: "military_branch", step: "Work/Education: Additional", simplifiedSource: null },
  { fieldName: "military_rank", step: "Work/Education: Additional", simplifiedSource: null },
  { fieldName: "military_specialty", step: "Work/Education: Additional", simplifiedSource: null },
  { fieldName: "military_date_from", step: "Work/Education: Additional", simplifiedSource: null },
  { fieldName: "military_date_to", step: "Work/Education: Additional", simplifiedSource: null },
  { fieldName: "has_served_paramilitary", step: "Work/Education: Additional", simplifiedSource: null },
  { fieldName: "paramilitary_explain", step: "Work/Education: Additional", simplifiedSource: null },

  // ── Steps 17-21: Security and Background (Parts 1-5) ───────────────────
  // Each generates a radio + explain pair. All missing from simplified form.
  ...([
    "has_communicable_disease", "has_physical_mental_disorder", "is_drug_abuser",
    "has_arrest_conviction", "has_violated_controlled_substance", "has_prostitution",
    "has_money_laundering", "has_human_trafficking", "has_aided_human_trafficking",
    "has_trafficking_beneficiary",
    "intend_espionage", "intend_terrorist_activity", "has_provided_terrorist_support",
    "is_terrorist_member", "is_terrorist_family",
    "has_genocide", "has_torture", "has_extrajudicial_killings", "has_child_soldier",
    "has_religious_freedom_violation", "has_population_control", "has_coercive_transplant",
    "has_immigration_fraud", "has_removal_order", "has_failed_to_attend_removal",
    "has_unlawful_presence",
    "has_withheld_child_custody", "has_voted_illegally", "has_renounced_citizenship",
  ] as const).flatMap((fn): DS160Field[] => [
    { fieldName: fn, step: "Security and Background", simplifiedSource: null },
    { fieldName: `${fn}_explain`, step: "Security and Background", simplifiedSource: null },
  ]),
];

// ═══════════════════════════════════════════════════════════════════════════════
// 2. AUDIT LOGIC
// ═══════════════════════════════════════════════════════════════════════════════

function getStatus(field: DS160Field): CoverageStatus {
  if (!field.simplifiedSource) return "missing";
  return field.simplifiedSource.lossy ? "lossy" : "covered";
}

function runAudit() {
  const total = DS160_FIELDS.length;
  const covered = DS160_FIELDS.filter((f) => getStatus(f) === "covered");
  const lossy = DS160_FIELDS.filter((f) => getStatus(f) === "lossy");
  const missing = DS160_FIELDS.filter((f) => getStatus(f) === "missing");

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  DS-160 COVERAGE AUDIT — Simplified Form vs DS-160 Answer Set");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log();
  console.log(`Total DS-160 fields:     ${total}`);
  console.log(`Covered (direct):        ${covered.length}  (${pct(covered.length, total)})`);
  console.log(`Covered (lossy):         ${lossy.length}  (${pct(lossy.length, total)})`);
  console.log(`Missing:                 ${missing.length}  (${pct(missing.length, total)})`);
  console.log();

  // Group by step
  const steps = [...new Set(DS160_FIELDS.map((f) => f.step))];

  for (const step of steps) {
    const stepFields = DS160_FIELDS.filter((f) => f.step === step);
    const stepCovered = stepFields.filter((f) => getStatus(f) === "covered").length;
    const stepLossy = stepFields.filter((f) => getStatus(f) === "lossy").length;
    const stepMissing = stepFields.filter((f) => getStatus(f) === "missing").length;

    console.log(`\n── ${step} (${stepFields.length} fields) ──`);
    console.log(`   Covered: ${stepCovered}  |  Lossy: ${stepLossy}  |  Missing: ${stepMissing}`);

    for (const field of stepFields) {
      const status = getStatus(field);
      const icon = status === "covered" ? "✅" : status === "lossy" ? "⚠️" : "❌";
      const source = field.simplifiedSource
        ? ` ← ${field.simplifiedSource.origin}.${field.simplifiedSource.sourceField}`
        : "";
      const notes = field.simplifiedSource?.notes ? ` (${field.simplifiedSource.notes})` : "";
      console.log(`   ${icon} ${field.fieldName}${source}${notes}`);
    }
  }

  // Summary of lossy mappings that need restructuring
  console.log("\n\n═══════════════════════════════════════════════════════════════");
  console.log("  LOSSY MAPPINGS — require restructuring in the simplified form");
  console.log("═══════════════════════════════════════════════════════════════\n");

  for (const field of lossy) {
    console.log(`  ${field.fieldName}`);
    console.log(`    Source: ${field.simplifiedSource!.origin}.${field.simplifiedSource!.sourceField}`);
    console.log(`    Issue:  ${field.simplifiedSource!.notes}`);
    console.log();
  }

  // Summary of key missing categories
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  MISSING FIELD CATEGORIES — must be added to simplified form");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const missingByStep: Record<string, number> = {};
  for (const field of missing) {
    missingByStep[field.step] = (missingByStep[field.step] ?? 0) + 1;
  }

  for (const [step, count] of Object.entries(missingByStep).sort(([, a], [, b]) => b - a)) {
    console.log(`  ${step}: ${count} fields missing`);
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  AUDIT COMPLETE");
  console.log("═══════════════════════════════════════════════════════════════");

  // Return structured data for programmatic consumption
  return {
    total,
    covered: covered.length,
    lossy: lossy.length,
    missing: missing.length,
    fields: DS160_FIELDS.map((f) => ({
      fieldName: f.fieldName,
      step: f.step,
      status: getStatus(f),
      source: f.simplifiedSource
        ? { origin: f.simplifiedSource.origin, field: f.simplifiedSource.sourceField }
        : null,
      lossyReason: f.simplifiedSource?.notes ?? null,
    })),
  };
}

function pct(n: number, total: number): string {
  return `${((n / total) * 100).toFixed(1)}%`;
}

// Run audit when executed directly.  Keep imports side-effect free so the
// machine-readable evidence builder can be consumed by tests and CI scripts.
if (typeof require !== "undefined" && require.main === module) runAudit();

export { DS160_FIELDS, runAudit };
export type { DS160Field, SimplifiedSource, CoverageStatus };

// ═══════════════════════════════════════════════════════════════════════════════
// 3. OFFICIAL EVIDENCE MANIFEST
//
// The legacy audit above measures the historical simplified-form mapping.  It
// is intentionally retained for existing callers.  The manifest below is a
// separate, fail-closed contract for answering the stronger question: has
// each current seed field, branch direction, and repeat control been observed
// on the official portal?  Internal mappings never populate this evidence.
// ═══════════════════════════════════════════════════════════════════════════════

export type Ds160EvidenceSourceKind =
  | "current_live_dom"
  | "official_published"
  | "historical_review";

export type Ds160EvidenceComparison = "match" | "mismatch" | "not_observed";

/**
 * The comparison made by the internal evidence manifest.  A structural
 * singleton such as a conditional explanation is deliberately distinct from
 * an observed repeat-row Add/Remove match.
 */
export type Ds160ContractComparison =
  | Ds160EvidenceComparison
  | "structure_not_applicable";

export type Ds160EvidenceValue =
  | string
  | readonly string[]
  | Readonly<Record<string, string>>
  | null;

/** A redacted, reviewer-supplied official observation. Never put applicant answers here. */
export interface Ds160OfficialEvidenceRecord {
  sourceKind: Ds160EvidenceSourceKind;
  sourceUrl: string | null;
  observedOn: string | null;
  expected: Ds160EvidenceValue;
  actual: Ds160EvidenceValue;
  comparison: Ds160EvidenceComparison;
  notes?: string | null;
}

export interface Ds160EvidenceSlot {
  /** Primary observation fields are explicit in the template; full history remains in evidence. */
  sourceKind: Ds160EvidenceSourceKind | null;
  sourceUrl: string | null;
  observedOn: string | null;
  expected: Ds160EvidenceValue;
  actual: Ds160EvidenceValue;
  /** Comparison against the internal seed/contract, not server-side proof. */
  contractComparison: Ds160ContractComparison | null;
  evidence: readonly Ds160OfficialEvidenceRecord[];
  /** A current live-DOM match was observed for this slot. */
  liveDomObserved: boolean;
  publishedEvidence: boolean;
  missingEvidence: readonly string[];
}

export interface Ds160FieldEvidenceEntry {
  fieldName: string;
  page: string;
  step: number;
  type: string;
  label: string;
  required: boolean;
  showIf: string | null;
  repeatGroup: string | null;
  evidence: Ds160EvidenceSlot;
}

export interface Ds160BranchEvidenceEntry {
  expression: string;
  fields: readonly string[];
  positive: Ds160EvidenceSlot;
  negative: Ds160EvidenceSlot;
  contractComparison: Ds160ContractComparison | null;
  missingEvidence: readonly string[];
}

export type Ds160RepeatStructure = "repeat" | "structure_not_applicable";

export interface Ds160RepeatEvidenceInput {
  rowAdded?: readonly Ds160OfficialEvidenceRecord[];
  rowDeleted?: readonly Ds160OfficialEvidenceRecord[];
  /** Override the inferred structure only for a repeat-contract extension. */
  structure?: Ds160RepeatStructure;
}

export interface Ds160RepeatEvidenceEntry {
  group: string;
  page: string;
  rowFieldKeys: readonly string[];
  activation: string | null;
  structure: Ds160RepeatStructure;
  rowAdded: Ds160EvidenceSlot;
  rowDeleted: Ds160EvidenceSlot;
  contractComparison: Ds160ContractComparison | null;
  missingEvidence: readonly string[];
}

export interface Ds160OfficialScopeGapInput {
  key: string;
  category: "field" | "branch" | "repeat_group" | "page_control" | "other";
  description: string;
  evidence?: readonly Ds160OfficialEvidenceRecord[];
}

export interface Ds160OfficialScopeGap extends Omit<Ds160OfficialScopeGapInput, "evidence"> {
  evidence: Ds160EvidenceSlot;
  missingEvidence: readonly string[];
}

export interface Ds160OfficialEvidenceInput {
  fields?: Readonly<Record<string, readonly Ds160OfficialEvidenceRecord[]>>;
  branches?: Readonly<Record<string, {
    positive?: readonly Ds160OfficialEvidenceRecord[];
    negative?: readonly Ds160OfficialEvidenceRecord[];
  }>>;
  repeats?: Readonly<Record<string, Ds160RepeatEvidenceInput>>;
  /** Explicit review of whether the current B1/B2 official scope has extra controls. */
  scopeReviewComplete?: boolean;
  /** Official controls found outside the current seed; never infer this list from mappings. */
  scopeGaps?: readonly Ds160OfficialScopeGapInput[];
}

export interface Ds160OfficialEvidenceManifest {
  schemaVersion: 1;
  generatedAt: string;
  scope: "ds160_b1_b2_current_seed_and_repeat_contract";
  officialParityVerified: boolean;
  scopeReviewComplete: boolean;
  scopeReviewMissing: readonly string[];
  counts: {
    fields: { total: number; liveDomObserved: number; publishedEvidence: number; missingEvidence: number };
    branches: {
      total: number;
      positiveLiveDomObserved: number;
      negativeLiveDomObserved: number;
      fullyLiveDomObserved: number;
      missingEvidence: number;
    };
    repeatGroups: {
      total: number;
      structureNotApplicable: number;
      rowAddedLiveDomObserved: number;
      rowDeletedLiveDomObserved: number;
      fullyLiveDomObserved: number;
      missingEvidence: number;
    };
    scopeGaps: { total: number; liveDomObserved: number; missingEvidence: number };
    evidenceSlots: {
      total: number;
      liveDomObserved: number;
      structureNotApplicable: number;
      missingEvidence: number;
    };
  };
  missingEvidence: readonly {
    kind: "field" | "branch_positive" | "branch_negative" | "repeat_row_added" | "repeat_row_deleted" | "scope_gap";
    key: string;
    missing: readonly string[];
  }[];
  fields: readonly Ds160FieldEvidenceEntry[];
  branches: readonly Ds160BranchEvidenceEntry[];
  repeatGroups: readonly Ds160RepeatEvidenceEntry[];
  scopeGaps: readonly Ds160OfficialScopeGap[];
}

const EVIDENCE_REQUIREMENTS = [
  "sourceUrl",
  "observedOn",
  "expected",
  "actual",
  "current_live_dom_match",
] as const;

function hasValue(value: Ds160EvidenceValue): boolean {
  if (value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return Object.keys(value).length > 0;
}

function isCurrentLiveMatch(record: Ds160OfficialEvidenceRecord): boolean {
  return (
    record.sourceKind === "current_live_dom" &&
    typeof record.sourceUrl === "string" &&
    record.sourceUrl.trim().length > 0 &&
    typeof record.observedOn === "string" &&
    record.observedOn.trim().length > 0 &&
    hasValue(record.expected) &&
    hasValue(record.actual) &&
    record.comparison === "match"
  );
}

function isPublishedEvidence(record: Ds160OfficialEvidenceRecord): boolean {
  return (
    record.sourceKind === "official_published" &&
    typeof record.sourceUrl === "string" &&
    record.sourceUrl.trim().length > 0 &&
    typeof record.observedOn === "string" &&
    record.observedOn.trim().length > 0 &&
    hasValue(record.expected) &&
    hasValue(record.actual) &&
    record.comparison === "match"
  );
}

function missingForEvidence(records: readonly Ds160OfficialEvidenceRecord[]): string[] {
  if (records.length === 0) return [...EVIDENCE_REQUIREMENTS];
  const missing: string[] = [];
  if (!records.some(record => typeof record.sourceUrl === "string" && record.sourceUrl.trim().length > 0)) {
    missing.push("sourceUrl");
  }
  if (!records.some(record => typeof record.observedOn === "string" && record.observedOn.trim().length > 0)) {
    missing.push("observedOn");
  }
  if (!records.some(record => hasValue(record.expected))) missing.push("expected");
  if (!records.some(record => hasValue(record.actual))) missing.push("actual");
  if (!records.some(isCurrentLiveMatch)) missing.push("current_live_dom_match");
  return missing;
}

const STRUCTURE_NOT_APPLICABLE_REPEAT_GROUPS = new Set([
  "visa_refused",
  "immigrant_petition",
]);

function contractComparisonForEvidence(
  evidence: readonly Ds160OfficialEvidenceRecord[],
): Ds160ContractComparison | null {
  if (evidence.some(record => record.comparison === "mismatch")) return "mismatch";
  return evidence.find(isCurrentLiveMatch)?.comparison ?? evidence[0]?.comparison ?? null;
}

function buildEvidenceSlot(
  records: readonly Ds160OfficialEvidenceRecord[] | undefined,
): Ds160EvidenceSlot {
  const evidence = records ?? [];
  const primary = evidence.find(isCurrentLiveMatch) ?? evidence[0] ?? null;
  const hasMismatch = evidence.some(record => record.comparison === "mismatch");
  const liveDomObserved = evidence.some(isCurrentLiveMatch) && !hasMismatch;
  return {
    sourceKind: primary?.sourceKind ?? null,
    sourceUrl: primary?.sourceUrl ?? null,
    observedOn: primary?.observedOn ?? null,
    expected: primary?.expected ?? null,
    actual: primary?.actual ?? null,
    contractComparison: contractComparisonForEvidence(evidence),
    evidence,
    liveDomObserved,
    publishedEvidence: evidence.some(isPublishedEvidence) && !hasMismatch,
    missingEvidence: [
      ...missingForEvidence(evidence),
      ...(hasMismatch ? ["no_mismatch"] : []),
    ],
  };
}

function buildStructureNotApplicableSlot(
  records: readonly Ds160OfficialEvidenceRecord[] | undefined,
): Ds160EvidenceSlot {
  const slot = buildEvidenceSlot(records);
  return {
    ...slot,
    // A singleton's DOM observation documents that Add/Remove is absent; it
    // must never be counted as an observed repeat-row operation.
    liveDomObserved: false,
    contractComparison:
      slot.contractComparison === "mismatch"
        ? "mismatch"
        : slot.evidence.length > 0
          ? "structure_not_applicable"
          : null,
  };
}

function combineContractComparisons(
  slots: readonly Ds160EvidenceSlot[],
): Ds160ContractComparison | null {
  if (slots.some(slot => slot.contractComparison === "mismatch")) return "mismatch";
  if (slots.every(slot => slot.contractComparison === "structure_not_applicable")) {
    return "structure_not_applicable";
  }
  if (slots.every(slot => slot.contractComparison === "match")) return "match";
  if (slots.some(slot => slot.contractComparison !== null)) return "not_observed";
  return null;
}

function addMissingEvidence(
  output: Array<{
    kind: "field" | "branch_positive" | "branch_negative" | "repeat_row_added" | "repeat_row_deleted" | "scope_gap";
    key: string;
    missing: readonly string[];
  }>,
  kind: "field" | "branch_positive" | "branch_negative" | "repeat_row_added" | "repeat_row_deleted" | "scope_gap",
  key: string,
  slot: Ds160EvidenceSlot,
): void {
  if (slot.missingEvidence.length > 0) output.push({ kind, key, missing: slot.missingEvidence });
}

/**
 * Build a complete, redacted official evidence manifest from seed metadata.
 * The default input is deliberately empty; no internal mapping or prior
 * applicant run can mark a field, branch, or repeat control as verified.
 */
export function buildDs160OfficialEvidenceManifest(
  fields: readonly Ds160SeedField[],
  input: Ds160OfficialEvidenceInput = {},
  generatedAt = new Date().toISOString(),
): Ds160OfficialEvidenceManifest {
  const evidenceMissing: Array<{
    kind: "field" | "branch_positive" | "branch_negative" | "repeat_row_added" | "repeat_row_deleted" | "scope_gap";
    key: string;
    missing: readonly string[];
  }> = [];

  const fieldEntries = fields.map(field => {
    const slot = buildEvidenceSlot(input.fields?.[field.name]);
    addMissingEvidence(evidenceMissing, "field", field.name, slot);
    return {
      fieldName: field.name,
      page: field.page,
      step: field.step,
      type: field.type,
      label: field.label,
      required: field.required,
      showIf: field.showIf ?? null,
      repeatGroup: field.repeatGroup ?? null,
      evidence: slot,
    };
  });

  const branchExpressions = [...new Set(fields.flatMap(field => field.showIf ? [field.showIf] : []))];
  const branchEntries = branchExpressions.map(expression => {
    const branchFields = fields.filter(field => field.showIf === expression).map(field => field.name);
    const supplied = input.branches?.[expression];
    const positive = buildEvidenceSlot(supplied?.positive);
    const negative = buildEvidenceSlot(supplied?.negative);
    addMissingEvidence(evidenceMissing, "branch_positive", expression, positive);
    addMissingEvidence(evidenceMissing, "branch_negative", expression, negative);
    return {
      expression,
      fields: branchFields,
      positive,
      negative,
      contractComparison: combineContractComparisons([positive, negative]),
      missingEvidence: [...positive.missingEvidence, ...negative.missingEvidence],
    };
  });

  const repeatEntries = DS160_REPEAT_GROUP_CONTRACT_LIST.map(contract => {
    const supplied = input.repeats?.[contract.group];
    const structure: Ds160RepeatStructure =
      STRUCTURE_NOT_APPLICABLE_REPEAT_GROUPS.has(contract.group)
        ? "structure_not_applicable"
        : supplied?.structure ?? "repeat";
    const buildRowSlot = structure === "structure_not_applicable"
      ? buildStructureNotApplicableSlot
      : buildEvidenceSlot;
    const rowAdded = buildRowSlot(supplied?.rowAdded);
    const rowDeleted = buildRowSlot(supplied?.rowDeleted);
    addMissingEvidence(evidenceMissing, "repeat_row_added", contract.group, rowAdded);
    addMissingEvidence(evidenceMissing, "repeat_row_deleted", contract.group, rowDeleted);
    return {
      group: contract.group,
      page: contract.page,
      rowFieldKeys: contract.rowFieldKeys,
      activation: contract.activation ?? null,
      structure,
      rowAdded,
      rowDeleted,
      contractComparison: combineContractComparisons([rowAdded, rowDeleted]),
      missingEvidence: [...rowAdded.missingEvidence, ...rowDeleted.missingEvidence],
    };
  });

  const scopeGaps = (input.scopeGaps ?? []).map(gap => {
    const evidence = buildEvidenceSlot(gap.evidence);
    addMissingEvidence(evidenceMissing, "scope_gap", gap.key, evidence);
    return {
      key: gap.key,
      category: gap.category,
      description: gap.description,
      evidence,
      missingEvidence: evidence.missingEvidence,
    };
  });

  const fieldLive = fieldEntries.filter(field => field.evidence.liveDomObserved).length;
  const fieldPublished = fieldEntries.filter(field => field.evidence.publishedEvidence).length;
  const positiveLive = branchEntries.filter(branch => branch.positive.liveDomObserved).length;
  const negativeLive = branchEntries.filter(branch => branch.negative.liveDomObserved).length;
  const branchFullyLive = branchEntries.filter(
    branch => branch.positive.liveDomObserved && branch.negative.liveDomObserved,
  ).length;
  const addedLive = repeatEntries.filter(
    group => group.structure === "repeat" && group.rowAdded.liveDomObserved,
  ).length;
  const deletedLive = repeatEntries.filter(
    group => group.structure === "repeat" && group.rowDeleted.liveDomObserved,
  ).length;
  const repeatFullyLive = repeatEntries.filter(
    group => group.structure === "repeat" && group.rowAdded.liveDomObserved && group.rowDeleted.liveDomObserved,
  ).length;
  const structureNotApplicable = repeatEntries.filter(
    group => group.structure === "structure_not_applicable",
  ).length;
  const scopeLive = scopeGaps.filter(gap => gap.evidence.liveDomObserved).length;
  const scopeReviewComplete = input.scopeReviewComplete === true;
  const scopeReviewMissing = scopeReviewComplete ? [] : ["scope_review_complete"];
  const evidenceSlotsTotal =
    fields.length +
    branchEntries.length * 2 +
    repeatEntries.length * 2 +
    scopeGaps.length;
  const evidenceSlotsLive = fieldLive + positiveLive + negativeLive + addedLive + deletedLive + scopeLive;
  const repeatStructureComplete = repeatEntries.every(group =>
    group.structure === "structure_not_applicable"
      ? group.contractComparison === "structure_not_applicable" && group.missingEvidence.length === 0
      : group.rowAdded.liveDomObserved && group.rowDeleted.liveDomObserved,
  );

  return {
    schemaVersion: 1,
    generatedAt,
    scope: "ds160_b1_b2_current_seed_and_repeat_contract",
    // This is the one global parity claim. Individual slots intentionally
    // expose only live-DOM observation and contract comparison; a DOM match is
    // never emitted as per-field server-side verification.
    officialParityVerified:
      scopeReviewComplete &&
      fieldLive === fieldEntries.length &&
      branchFullyLive === branchEntries.length &&
      repeatStructureComplete &&
      scopeLive === scopeGaps.length,
    scopeReviewComplete,
    scopeReviewMissing,
    counts: {
      fields: {
        total: fieldEntries.length,
        liveDomObserved: fieldLive,
        publishedEvidence: fieldPublished,
        missingEvidence: fieldEntries.filter(field => field.evidence.missingEvidence.length > 0).length,
      },
      branches: {
        total: branchEntries.length,
        positiveLiveDomObserved: positiveLive,
        negativeLiveDomObserved: negativeLive,
        fullyLiveDomObserved: branchFullyLive,
        missingEvidence: branchEntries.filter(branch => branch.missingEvidence.length > 0).length,
      },
      repeatGroups: {
        total: repeatEntries.length,
        structureNotApplicable,
        rowAddedLiveDomObserved: addedLive,
        rowDeletedLiveDomObserved: deletedLive,
        fullyLiveDomObserved: repeatFullyLive,
        missingEvidence: repeatEntries.filter(group => group.missingEvidence.length > 0).length,
      },
      scopeGaps: {
        total: scopeGaps.length,
        liveDomObserved: scopeLive,
        missingEvidence: scopeGaps.filter(gap => gap.missingEvidence.length > 0).length,
      },
      evidenceSlots: {
        total: evidenceSlotsTotal,
        liveDomObserved: evidenceSlotsLive,
        structureNotApplicable: structureNotApplicable * 2,
        missingEvidence: evidenceMissing.length,
      },
    },
    missingEvidence: evidenceMissing,
    fields: fieldEntries,
    branches: branchEntries,
    repeatGroups: repeatEntries,
    scopeGaps,
  };
}
