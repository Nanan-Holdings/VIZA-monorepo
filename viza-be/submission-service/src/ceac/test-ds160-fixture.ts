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
  surname: "TESTER",
  given_names: "JOHN ALEX",
  full_name_native_alphabet: "N/A",
  sex: "M",
  marital_status: "S",
  date_of_birth_day: "15",
  date_of_birth_month: "JUN",
  date_of_birth_year: "1990",
  has_other_names: "N",
  has_telecode: "N",
  city_of_birth: "LONDON",
  state_of_birth: "ENGLAND",
  country_of_birth: "GRBR",

  // Personal Information 2
  nationality_country: "GRBR",
  other_nationality: "N",
  permanent_resident_other_country: "N",
  national_id_number_na: "Y",
  us_social_security_number_na: "Y",
  us_taxpayer_id_na: "Y",

  // Travel Information
  has_specific_travel_plans: "N",
  purpose_of_trip: "B",
  purpose_of_trip_specify: "B1-B2",
  who_is_paying: "S",
  intended_arrival_date_day: "10",
  intended_arrival_date_month: "DEC",
  intended_arrival_date_year: "2026",
  intended_length_of_stay: "14",
  intended_length_of_stay_unit: "D",
  us_address_street: "123 MAIN ST",
  us_address_city: "NEW YORK",
  us_address_state: "NY",
  us_address_zip: "10001",

  // Travel Companions
  has_companions: "N",

  // Previous US Travel
  has_been_in_us: "N",
  has_us_visa: "N",
  has_been_refused: "N",
  vwp_denial: "N",
  immigrant_petition_filed: "N",

  // Passport
  passport_document_type: "R",
  passport_number: "123456789",
  passport_book_number_na: "Y",
  passport_issuance_city: "LONDON",
  passport_issuance_state: "ENGLAND",
  passport_issuance_country: "GRBR",
  passport_has_expiry: "Y",
  passport_issuing_country: "GRBR",
  passport_issue_day: "01",
  passport_issue_month: "01",
  passport_issue_year: "2020",
  passport_expiry_day: "01",
  passport_expiry_month: "01",
  passport_expiry_year: "2030",
  passport_lost_or_stolen: "N",

  // US Contact
  us_contact_surname: "DOE",
  us_contact_given_names: "JOHN",
  us_contact_organization_na: "Y",
  us_contact_relationship: "H",
  us_contact_address_street1: "123 MAIN ST",
  us_contact_city: "NEW YORK",
  us_contact_state: "NY",
  us_contact_zip: "10001",
  us_contact_phone: "2125551234",
  us_contact_email: "host@example.com",

  // Family Relatives
  father_surname: "TESTER",
  father_given_names: "ROBERT",
  father_dob_day: "01",
  father_dob_month: "JAN",
  father_dob_year: "1960",
  father_in_us: "N",
  mother_surname: "TESTER",
  mother_given_names: "MARY",
  mother_dob_day: "01",
  mother_dob_month: "JAN",
  mother_dob_year: "1962",
  mother_in_us: "N",
  has_immediate_us_relatives: "N",
  has_other_us_relatives: "N",

  // Work / Education — Present
  primary_occupation: "RT",
  employer_name: "RETIRED",
  job_title: "RETIRED",

  // Work / Education — Previous
  has_previous_employer: "N",
  has_other_education: "N",

  // Work / Education — Additional
  has_clan_tribe: "N",
  language_name: "ENGLISH",
  has_countries_visited: "N",
  has_organization: "N",
  has_specialized_skills: "N",
  has_served_military: "N",
  has_served_insurgent: "N",

  // Security and Background Part 1
  has_communicable_disease: "N",
  has_physical_mental_disorder: "N",
  is_drug_abuser: "N",

  // Security and Background Part 2
  has_arrest_conviction: "N",
  has_violated_controlled_substance: "N",
  has_prostitution: "N",
  has_money_laundering: "N",
  has_human_trafficking: "N",
  has_aided_human_trafficking: "N",
  has_trafficking_beneficiary: "N",

  // Security and Background Part 3
  intend_illegal_activity: "N",
  intend_terrorist_activity: "N",
  has_provided_terrorist_support: "N",
  is_terrorist_member: "N",
  is_terrorist_family: "N",
  has_genocide: "N",
  has_torture: "N",
  has_extrajudicial_killings: "N",
  has_child_soldier: "N",
  has_religious_freedom_violation: "N",
  has_population_control: "N",
  has_coercive_transplant: "N",

  // Security and Background Part 4
  has_immigration_fraud: "N",
  has_removal_order: "N",

  // Security and Background Part 5
  has_withheld_child_custody: "N",
  has_voted_illegally: "N",
  has_renounced_citizenship: "N",

  // Contact (Address and Phone)
  home_address_line1: "10 DOWNING STREET",
  home_address_line2: "",
  home_address_city: "LONDON",
  home_address_state: "LONDON",
  home_address_postal: "SW1A2AA",
  home_address_country: "GRBR",
  mailing_same_as_home: "Y",
  primary_phone: "442079251234",
  mobile_phone_na: "Y",
  work_phone_na: "Y",
  has_other_phone: "N",
  email_address: "tester@example.com",
  has_other_email: "N",
  has_social_media: "N",
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
