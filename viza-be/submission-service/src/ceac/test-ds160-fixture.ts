/**
 * Shared DS-160 test fixture used by:
 *   - scripts/seed-test-ds160-applicant.ts  (writes to Supabase)
 *   - src/ceac/_e2e.ts                       (hardcoded fallback path)
 *
 * Keys match the DS-160 seed-script field names (see
 * agent-backend/scripts/seed-ds160-form-fields.ts). The orchestrator fills
 * only keys present in the per-page mapping; missing keys are skipped.
 */

export const TEST_DS160_ANSWERS: Record<string, string> = {
  // Personal Information 1
  consular_post: "BEJ",
  surname: "TESTER",
  given_names: "JOHN ALEX",
  full_name_native_alphabet: "N/A",
  sex: "male",
  marital_status: "single",
  date_of_birth: "1990-06-15",
  other_names_used: "no",
  has_telecode: "no",
  city_of_birth: "LONDON",
  state_of_birth: "ENGLAND",
  country_of_birth: "GRBR",

  // Personal Information 2
  nationality_country: "GRBR",
  other_nationality: "no",
  permanent_resident_other_country: "no",
  national_id_number_na: "Y",
  us_social_security_number_na: "Y",
  us_taxpayer_id_na: "Y",

  // Travel Information
  has_specific_plans: "no",
  purpose_of_trip: "B",
  purpose_of_trip_specify: "B1/B2",
  trip_payer_type: "self",
  intended_arrival_date: "2026-12-10",
  intended_length_of_stay: "14",
  intended_length_of_stay_value: "14",
  intended_length_of_stay_unit: "DAY(S)",
  us_address_street: "123 MAIN ST",
  us_address_city: "NEW YORK",
  us_address_state: "NY",
  us_address_zip: "10001",

  // Travel Companions
  has_companions: "no",

  // Previous US Travel
  has_been_in_us: "no",
  has_us_visa: "no",
  has_been_refused: "no",
  vwp_denial: "no",
  immigrant_petition_filed: "no",

  // Passport
  passport_document_type: "regular",
  passport_number: "123456789",
  passport_book_number_na: "Y",
  passport_issuance_city: "LONDON",
  passport_issuance_state: "ENGLAND",
  passport_issuance_country: "GRBR",
  passport_has_expiry: "yes",
  passport_issuing_country: "GRBR",
  passport_issuance_date: "2020-01-01",
  passport_expiration_date: "2030-01-01",
  lost_passport: "no",

  // US Contact
  us_contact_surname: "DOE",
  us_contact_given_names: "JOHN",
  us_contact_organization_na: "Y",
  us_contact_relationship: "FRIEND",
  us_contact_address_street1: "123 MAIN ST",
  us_contact_city: "NEW YORK",
  us_contact_state: "NY",
  us_contact_zip: "10001",
  us_contact_phone: "2125551234",
  us_contact_email: "host@example.com",

  // Family Relatives
  father_surname: "TESTER",
  father_given_names: "ROBERT",
  father_date_of_birth: "1960-01-01",
  father_in_us: "no",
  mother_surname: "TESTER",
  mother_given_names: "MARY",
  mother_date_of_birth: "1962-01-01",
  mother_in_us: "no",
  has_immediate_us_relatives: "no",
  has_other_us_relatives: "no",

  // Work / Education — Present
  primary_occupation: "retired",
  employer_name: "RETIRED",
  job_title: "RETIRED",

  // Work / Education — Previous
  has_previous_employer: "no",
  has_attended_education: "no",

  // Work / Education — Additional
  has_clan_tribe: "no",
  language_name: "ENGLISH",
  has_traveled_last_five_years: "no",
  has_belonged_to_organization: "no",
  has_specialized_skills: "no",
  has_served_military: "no",
  has_served_paramilitary: "no",

  // Security and Background Part 1
  has_communicable_disease: "no",
  has_physical_mental_disorder: "no",
  is_drug_abuser: "no",

  // Security and Background Part 2
  has_arrest_conviction: "no",
  has_violated_controlled_substance: "no",
  has_prostitution: "no",
  has_money_laundering: "no",
  has_human_trafficking: "no",
  has_aided_human_trafficking: "no",
  has_trafficking_beneficiary: "no",

  // Security and Background Part 3
  intend_illegal_activity: "no",
  intend_terrorist_activity: "no",
  has_provided_terrorist_support: "no",
  is_terrorist_member: "no",
  is_terrorist_family: "no",
  has_genocide: "no",
  has_torture: "no",
  has_extrajudicial_killings: "no",
  has_child_soldier: "no",
  has_religious_freedom_violation: "no",
  has_population_control: "no",
  has_coercive_transplant: "no",

  // Security and Background Part 4
  has_immigration_fraud: "no",
  has_removal_order: "no",

  // Security and Background Part 5
  has_withheld_child_custody: "no",
  has_voted_illegally: "no",
  has_renounced_citizenship: "no",

  // Contact (Address and Phone)
  home_address_line1: "10 DOWNING STREET",
  home_address_line2: "",
  home_address_city: "LONDON",
  home_address_state: "LONDON",
  home_address_postal: "SW1A2AA",
  home_address_country: "GRBR",
  mailing_same_as_home: "yes",
  primary_phone: "442079251234",
  mobile_phone_na: "Y",
  work_phone_na: "Y",
  has_other_phones: "no",
  email_address: "tester@example.com",
  has_other_emails: "no",
  has_social_media: "no",
  social_media_provider: "NONE",
  social_media_identifier: "N/A",
};

export const TEST_DS160_PROFILE = {
  surname: "TESTER",
  given_names: "JOHN ALEX",
  date_of_birth: "1990-06-15",
  passport_number: "123456789",
  email_address: "tester@example.com",
};
