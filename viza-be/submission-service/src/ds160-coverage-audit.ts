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

// Run audit when executed directly
runAudit();

export { DS160_FIELDS, runAudit };
export type { DS160Field, SimplifiedSource, CoverageStatus };
