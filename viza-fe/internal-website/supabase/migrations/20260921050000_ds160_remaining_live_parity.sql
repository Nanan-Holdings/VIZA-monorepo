-- Align the remaining proven DS-160 Passport, Family, U.S. Contact,
-- Work/Education, Additional Work, Security, source-list, age-gate and repeat
-- metadata with the live CEAC validation contract. Existing applicant answers,
-- branch expressions, and legacy passport-state clearing behavior are preserved.

-- Publish the CEAC ESTA explanation field when an older catalog does not yet
-- contain it. The conflict path only reconciles this field's metadata and
-- never touches applicant answer rows.
INSERT INTO public.visa_form_fields (
  visa_type,
  field_name,
  label,
  field_type,
  required,
  step_number,
  step_name,
  display_order,
  placeholder,
  validation_rules,
  options,
  conditional_logic
)
VALUES (
  'DS160',
  'vwp_denial_explain',
  'Please explain',
  'textarea',
  TRUE,
  5,
  'Previous U.S. Travel',
  25,
  NULL,
  '{"maxLength":4000,"nationality_gate":"CEAC_ESTA","label_zh":"请解释","label_en":"Please explain","official_label_en":"Please explain"}'::jsonb,
  NULL,
  '{"showIf":"vwp_denial === yes"}'::jsonb
)
ON CONFLICT (visa_type, field_name) DO UPDATE
SET
  label = EXCLUDED.label,
  field_type = EXCLUDED.field_type,
  required = EXCLUDED.required,
  step_number = EXCLUDED.step_number,
  step_name = EXCLUDED.step_name,
  display_order = EXCLUDED.display_order,
  placeholder = EXCLUDED.placeholder,
  validation_rules = EXCLUDED.validation_rules,
  options = EXCLUDED.options,
  conditional_logic = EXCLUDED.conditional_logic,
  updated_at = now();

UPDATE public.visa_form_fields
SET
  required = CASE field_name
    WHEN 'passport_book_number' THEN TRUE
    WHEN 'passport_issuance_city' THEN TRUE
    WHEN 'lost_passport_number' THEN TRUE
    WHEN 'lost_passport_country' THEN TRUE
    WHEN 'lost_passport_explain' THEN TRUE
    WHEN 'partner_surname' THEN TRUE
    WHEN 'partner_given_names' THEN TRUE
    WHEN 'partner_date_of_birth' THEN TRUE
    WHEN 'partner_nationality' THEN TRUE
    WHEN 'partner_city_of_birth' THEN TRUE
    WHEN 'partner_country_of_birth' THEN TRUE
    WHEN 'partner_address_type' THEN TRUE
    WHEN 'partner_address_street1' THEN TRUE
    WHEN 'partner_address_city' THEN TRUE
    WHEN 'partner_address_state' THEN TRUE
    WHEN 'partner_address_zip' THEN TRUE
    WHEN 'partner_address_country' THEN TRUE
    WHEN 'deceased_spouse_surname' THEN TRUE
    WHEN 'deceased_spouse_given_names' THEN TRUE
    WHEN 'deceased_spouse_date_of_birth' THEN TRUE
    WHEN 'deceased_spouse_nationality' THEN TRUE
    WHEN 'deceased_spouse_city_of_birth' THEN TRUE
    WHEN 'deceased_spouse_country_of_birth' THEN TRUE
    WHEN 'number_of_former_spouses' THEN TRUE
    WHEN 'former_spouse_surname' THEN TRUE
    WHEN 'former_spouse_given_names' THEN TRUE
    WHEN 'former_spouse_date_of_birth' THEN TRUE
    WHEN 'former_spouse_nationality' THEN TRUE
    WHEN 'former_spouse_city_of_birth' THEN TRUE
    WHEN 'former_spouse_country_of_birth' THEN TRUE
    WHEN 'former_spouse_date_of_marriage' THEN TRUE
    WHEN 'former_spouse_date_marriage_ended' THEN TRUE
    WHEN 'former_spouse_how_marriage_ended' THEN TRUE
    WHEN 'former_spouse_country_marriage_terminated' THEN TRUE
    WHEN 'us_contact_surname' THEN TRUE
    WHEN 'us_contact_given_names' THEN TRUE
    WHEN 'us_contact_organization' THEN TRUE
    WHEN 'us_contact_address_street1' THEN TRUE
    WHEN 'us_contact_city' THEN TRUE
    WHEN 'us_contact_phone' THEN TRUE
    WHEN 'us_contact_email' THEN TRUE
    WHEN 'us_contact_zip' THEN FALSE
    WHEN 'us_relative_surname' THEN TRUE
    WHEN 'us_relative_given_names' THEN TRUE
    WHEN 'us_relative_relationship' THEN TRUE
    WHEN 'us_relative_status' THEN TRUE
    WHEN 'vwp_denial_explain' THEN TRUE
    WHEN 'occupation_other_explain' THEN TRUE
    WHEN 'employer_name' THEN TRUE
    WHEN 'employer_address_line1' THEN TRUE
    WHEN 'employer_city' THEN TRUE
    WHEN 'employer_state_province' THEN TRUE
    WHEN 'employer_postal_code' THEN TRUE
    WHEN 'employer_country' THEN TRUE
    WHEN 'employer_phone' THEN TRUE
    WHEN 'employment_start_date' THEN TRUE
    WHEN 'job_duties' THEN TRUE
    WHEN 'prev_employer_name' THEN TRUE
    WHEN 'prev_employer_address_street1' THEN TRUE
    WHEN 'prev_employer_city' THEN TRUE
    WHEN 'prev_employer_state' THEN TRUE
    WHEN 'prev_employer_postal' THEN TRUE
    WHEN 'prev_employer_country' THEN TRUE
    WHEN 'prev_employer_phone' THEN TRUE
    WHEN 'prev_job_title' THEN TRUE
    WHEN 'prev_supervisor_surname' THEN TRUE
    WHEN 'prev_supervisor_given_names' THEN TRUE
    WHEN 'prev_employment_start_date' THEN TRUE
    WHEN 'prev_employment_end_date' THEN TRUE
    WHEN 'prev_job_duties' THEN TRUE
    WHEN 'education_institution_name' THEN TRUE
    WHEN 'education_address_line1' THEN TRUE
    WHEN 'education_city' THEN TRUE
    WHEN 'education_state_province' THEN TRUE
    WHEN 'education_postal_code' THEN TRUE
    WHEN 'education_country' THEN TRUE
    WHEN 'education_course_of_study' THEN TRUE
    WHEN 'education_start_date' THEN TRUE
    WHEN 'education_end_date' THEN TRUE
    WHEN 'clan_tribe_name' THEN TRUE
    WHEN 'traveled_country' THEN TRUE
    WHEN 'organization_name' THEN TRUE
    WHEN 'specialized_skills_explain' THEN TRUE
    WHEN 'military_country' THEN TRUE
    WHEN 'military_branch' THEN TRUE
    WHEN 'military_rank' THEN TRUE
    WHEN 'military_specialty' THEN TRUE
    WHEN 'military_date_from' THEN TRUE
    WHEN 'military_date_to' THEN TRUE
    WHEN 'paramilitary_explain' THEN TRUE
    ELSE required
  END,
  step_number = CASE field_name
    WHEN 'father_in_us' THEN 9
    WHEN 'mother_in_us' THEN 9
    ELSE step_number
  END,
  step_name = CASE field_name
    WHEN 'father_in_us' THEN 'Family Information: Relatives'
    WHEN 'mother_in_us' THEN 'Family Information: Relatives'
    ELSE step_name
  END,
  label = CASE field_name
    WHEN 'vwp_denial' THEN 'Have you ever been denied travel authorization by the Department of Homeland Security through the Electronic System for Travel Authorization (ESTA)?'
    ELSE label
  END,
  display_order = CASE field_name
    WHEN 'father_in_us' THEN 4
    WHEN 'mother_in_us' THEN 9
    WHEN 'vwp_denial' THEN 24
    WHEN 'vwp_denial_explain' THEN 25
    WHEN 'immigrant_petition_filed' THEN 26
    WHEN 'immigrant_petition_explain' THEN 27
    ELSE display_order
  END,
  validation_rules = CASE field_name
    WHEN 'date_of_birth' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"minimum_age":14,"minimum_date_precision":"day"}'::jsonb
    WHEN 'country_of_birth' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"source":"CEAC_BIRTH_COUNTRIES"}'::jsonb
    WHEN 'nationality_country' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"source":"CEAC_NATIONALITIES"}'::jsonb
    WHEN 'other_nationality_country' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"source":"CEAC_OTHER_NATIONALITIES"}'::jsonb
    WHEN 'other_permanent_resident_country' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"source":"CEAC_GEOGRAPHY"}'::jsonb
    WHEN 'us_address_state' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"source":"CEAC_US_STATES"}'::jsonb
    WHEN 'us_drivers_license_state' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"source":"CEAC_US_STATES"}'::jsonb
    WHEN 'payer_address_country' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"source":"CEAC_GEOGRAPHY"}'::jsonb
    WHEN 'payer_org_address_country' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"source":"CEAC_GEOGRAPHY"}'::jsonb
    WHEN 'home_address_country' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"source":"CEAC_GEOGRAPHY"}'::jsonb
    WHEN 'mailing_address_country' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"source":"CEAC_GEOGRAPHY"}'::jsonb
    WHEN 'marital_status_other_explain' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":4000}'::jsonb
    WHEN 'passport_document_type_explain' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":4000}'::jsonb
    WHEN 'passport_book_number' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"has_does_not_apply":true,"maxLength":20}'::jsonb
    WHEN 'passport_issuing_country' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"source":"CEAC_PASSPORT_ISSUERS"}'::jsonb
    WHEN 'passport_issuance_city' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":25}'::jsonb
    WHEN 'passport_issuance_state' THEN
      (COALESCE(validation_rules, '{}'::jsonb) - 'has_does_not_apply' - 'does_not_apply_label') || '{"maxLength":25}'::jsonb
    WHEN 'passport_issuance_country' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"source":"CEAC_GEOGRAPHY"}'::jsonb
    WHEN 'lost_passport_number' THEN
      (COALESCE(validation_rules, '{}'::jsonb) - 'max_items') || '{"maxLength":20}'::jsonb
    WHEN 'lost_passport_country' THEN
      (COALESCE(validation_rules, '{}'::jsonb) - 'max_items') || '{"source":"CEAC_PASSPORT_ISSUERS"}'::jsonb
    WHEN 'lost_passport_explain' THEN
      (COALESCE(validation_rules, '{}'::jsonb) - 'max_items') || '{"maxLength":4000}'::jsonb
    WHEN 'partner_surname' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":33}'::jsonb
    WHEN 'partner_given_names' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":33}'::jsonb
    WHEN 'partner_date_of_birth' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"minimum_date_precision":"year"}'::jsonb
    WHEN 'partner_nationality' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"source":"CEAC_FAMILY_NATIONALITIES"}'::jsonb
    WHEN 'partner_city_of_birth' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"allow_do_not_know":true,"maxLength":20}'::jsonb
    WHEN 'partner_country_of_birth' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"source":"CEAC_BIRTH_COUNTRIES"}'::jsonb
    WHEN 'partner_address_street1' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":40}'::jsonb
    WHEN 'partner_address_street2' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":40}'::jsonb
    WHEN 'partner_address_city' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":20}'::jsonb
    WHEN 'partner_address_state' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"allow_does_not_apply":true,"maxLength":20}'::jsonb
    WHEN 'partner_address_zip' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"allow_does_not_apply":true,"maxLength":10}'::jsonb
    WHEN 'partner_address_country' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"source":"CEAC_GEOGRAPHY"}'::jsonb
    WHEN 'spouse_nationality' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"source":"CEAC_FAMILY_NATIONALITIES"}'::jsonb
    WHEN 'spouse_country_of_birth' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"source":"CEAC_BIRTH_COUNTRIES"}'::jsonb
    WHEN 'spouse_address_country' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"source":"CEAC_GEOGRAPHY"}'::jsonb
    WHEN 'deceased_spouse_surname' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":33}'::jsonb
    WHEN 'deceased_spouse_given_names' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":33}'::jsonb
    WHEN 'deceased_spouse_date_of_birth' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"minimum_date_precision":"year"}'::jsonb
    WHEN 'deceased_spouse_nationality' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"source":"CEAC_FAMILY_NATIONALITIES"}'::jsonb
    WHEN 'deceased_spouse_city_of_birth' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"allow_do_not_know":true,"maxLength":20}'::jsonb
    WHEN 'deceased_spouse_country_of_birth' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"source":"CEAC_BIRTH_COUNTRIES"}'::jsonb
    WHEN 'former_spouse_surname' THEN (COALESCE(validation_rules, '{}'::jsonb) - 'max_items') || '{"maxLength":33}'::jsonb
    WHEN 'former_spouse_given_names' THEN (COALESCE(validation_rules, '{}'::jsonb) - 'max_items') || '{"maxLength":33}'::jsonb
    WHEN 'former_spouse_date_of_birth' THEN (COALESCE(validation_rules, '{}'::jsonb) - 'max_items') || '{"minimum_date_precision":"year"}'::jsonb
    WHEN 'former_spouse_nationality' THEN (COALESCE(validation_rules, '{}'::jsonb) - 'max_items') || '{"source":"CEAC_FAMILY_NATIONALITIES"}'::jsonb
    WHEN 'former_spouse_city_of_birth' THEN (COALESCE(validation_rules, '{}'::jsonb) - 'max_items') || '{"allow_do_not_know":true,"maxLength":20}'::jsonb
    WHEN 'former_spouse_country_of_birth' THEN (COALESCE(validation_rules, '{}'::jsonb) - 'max_items') || '{"source":"CEAC_BIRTH_COUNTRIES"}'::jsonb
    WHEN 'former_spouse_date_of_marriage' THEN (COALESCE(validation_rules, '{}'::jsonb) - 'max_items') || '{"minimum_date_precision":"day"}'::jsonb
    WHEN 'former_spouse_date_marriage_ended' THEN (COALESCE(validation_rules, '{}'::jsonb) - 'max_items') || '{"minimum_date_precision":"day"}'::jsonb
    WHEN 'former_spouse_how_marriage_ended' THEN (COALESCE(validation_rules, '{}'::jsonb) - 'max_items') || '{"maxLength":4000}'::jsonb
    WHEN 'former_spouse_country_marriage_terminated' THEN (COALESCE(validation_rules, '{}'::jsonb) - 'max_items') || '{"source":"CEAC_GEOGRAPHY"}'::jsonb
    WHEN 'us_contact_surname' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":33}'::jsonb
    WHEN 'us_contact_given_names' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":33}'::jsonb
    WHEN 'us_contact_organization' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":33}'::jsonb
    WHEN 'us_contact_address_street1' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":40}'::jsonb
    WHEN 'us_contact_address_street2' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":40}'::jsonb
    WHEN 'us_contact_city' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":20}'::jsonb
    WHEN 'us_contact_state' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"source":"CEAC_US_STATES"}'::jsonb
    WHEN 'us_contact_zip' THEN (COALESCE(validation_rules, '{}'::jsonb) - 'pattern') || '{"maxLength":10}'::jsonb
    WHEN 'us_contact_phone' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":15}'::jsonb
    WHEN 'us_contact_email' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"format":"email","allow_does_not_apply":true,"maxLength":50}'::jsonb
    WHEN 'occupation_other_explain' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":4000}'::jsonb
    WHEN 'employer_name' THEN (COALESCE(validation_rules, '{}'::jsonb) - 'has_does_not_apply' - 'does_not_apply_label') || '{"maxLength":75}'::jsonb
    WHEN 'employer_address_line1' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":40}'::jsonb
    WHEN 'employer_address_line2' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":40}'::jsonb
    WHEN 'employer_city' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":20}'::jsonb
    WHEN 'employer_state_province' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"has_does_not_apply":true,"maxLength":20}'::jsonb
    WHEN 'employer_postal_code' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"has_does_not_apply":true,"maxLength":10}'::jsonb
    WHEN 'employer_country' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"source":"CEAC_GEOGRAPHY"}'::jsonb
    WHEN 'employer_phone' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":15}'::jsonb
    WHEN 'employment_start_date' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"minimum_date_precision":"year"}'::jsonb
    WHEN 'monthly_salary' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"has_does_not_apply":true,"maxLength":15}'::jsonb
    WHEN 'job_duties' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":4000}'::jsonb
    WHEN 'prev_employer_name' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":75,"max_items":2}'::jsonb
    WHEN 'prev_employer_address_street1' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":40,"max_items":2}'::jsonb
    WHEN 'prev_employer_address_street2' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":40,"max_items":2}'::jsonb
    WHEN 'prev_employer_city' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":20,"max_items":2}'::jsonb
    WHEN 'prev_employer_state' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"has_does_not_apply":true,"maxLength":20,"max_items":2}'::jsonb
    WHEN 'prev_employer_postal' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"has_does_not_apply":true,"maxLength":10,"max_items":2}'::jsonb
    WHEN 'prev_employer_country' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"source":"CEAC_GEOGRAPHY","max_items":2}'::jsonb
    WHEN 'prev_employer_phone' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":15,"max_items":2}'::jsonb
    WHEN 'prev_job_title' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":75,"max_items":2}'::jsonb
    WHEN 'prev_supervisor_surname' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"allow_do_not_know":true,"maxLength":33,"max_items":2}'::jsonb
    WHEN 'prev_supervisor_given_names' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"allow_do_not_know":true,"maxLength":33,"max_items":2}'::jsonb
    WHEN 'prev_employment_start_date' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"minimum_date_precision":"year","max_items":2}'::jsonb
    WHEN 'prev_employment_end_date' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"minimum_date_precision":"year","max_items":2}'::jsonb
    WHEN 'prev_job_duties' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":4000,"max_items":2}'::jsonb
    WHEN 'education_institution_name' THEN (COALESCE(validation_rules, '{}'::jsonb) - 'max_items') || '{"maxLength":75}'::jsonb
    WHEN 'education_address_line1' THEN (COALESCE(validation_rules, '{}'::jsonb) - 'max_items') || '{"maxLength":40}'::jsonb
    WHEN 'education_address_line2' THEN (COALESCE(validation_rules, '{}'::jsonb) - 'max_items') || '{"maxLength":40}'::jsonb
    WHEN 'education_city' THEN (COALESCE(validation_rules, '{}'::jsonb) - 'max_items') || '{"maxLength":20}'::jsonb
    WHEN 'education_state_province' THEN (COALESCE(validation_rules, '{}'::jsonb) - 'max_items') || '{"has_does_not_apply":true,"maxLength":20}'::jsonb
    WHEN 'education_postal_code' THEN (COALESCE(validation_rules, '{}'::jsonb) - 'max_items') || '{"has_does_not_apply":true,"maxLength":10}'::jsonb
    WHEN 'education_country' THEN (COALESCE(validation_rules, '{}'::jsonb) - 'max_items') || '{"source":"CEAC_GEOGRAPHY"}'::jsonb
    WHEN 'education_course_of_study' THEN (COALESCE(validation_rules, '{}'::jsonb) - 'max_items') || '{"maxLength":66}'::jsonb
    WHEN 'education_start_date' THEN (COALESCE(validation_rules, '{}'::jsonb) - 'max_items') || '{"minimum_date_precision":"month"}'::jsonb
    WHEN 'education_end_date' THEN (COALESCE(validation_rules, '{}'::jsonb) - 'max_items') || '{"minimum_date_precision":"month"}'::jsonb
    WHEN 'clan_tribe_name' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":80}'::jsonb
    WHEN 'language_name' THEN (COALESCE(validation_rules, '{}'::jsonb) - 'max_items') || '{"maxLength":66}'::jsonb
    WHEN 'traveled_country' THEN (COALESCE(validation_rules, '{}'::jsonb) - 'max_items') || '{"source":"CEAC_GEOGRAPHY"}'::jsonb
    WHEN 'organization_name' THEN (COALESCE(validation_rules, '{}'::jsonb) - 'max_items') || '{"maxLength":66}'::jsonb
    WHEN 'specialized_skills_explain' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":4000}'::jsonb
    WHEN 'military_country' THEN (COALESCE(validation_rules, '{}'::jsonb) - 'max_items') || '{"source":"CEAC_FAMILY_NATIONALITIES"}'::jsonb
    WHEN 'military_branch' THEN (COALESCE(validation_rules, '{}'::jsonb) - 'max_items') || '{"maxLength":40}'::jsonb
    WHEN 'military_rank' THEN (COALESCE(validation_rules, '{}'::jsonb) - 'max_items') || '{"maxLength":40}'::jsonb
    WHEN 'military_specialty' THEN (COALESCE(validation_rules, '{}'::jsonb) - 'max_items') || '{"maxLength":40}'::jsonb
    WHEN 'military_date_from' THEN (COALESCE(validation_rules, '{}'::jsonb) - 'max_items') || '{"minimum_date_precision":"month"}'::jsonb
    WHEN 'military_date_to' THEN (COALESCE(validation_rules, '{}'::jsonb) - 'max_items') || '{"minimum_date_precision":"month"}'::jsonb
    WHEN 'paramilitary_explain' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":4000}'::jsonb
    WHEN 'refusal_explain' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"max_items":1}'::jsonb
    WHEN 'immigrant_petition_explain' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"max_items":1}'::jsonb
    WHEN 'has_communicable_disease_explain' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":4000}'::jsonb
    WHEN 'has_physical_mental_disorder_explain' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":4000}'::jsonb
    WHEN 'is_drug_abuser_explain' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":4000}'::jsonb
    WHEN 'has_arrest_conviction_explain' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":4000}'::jsonb
    WHEN 'has_violated_controlled_substance_explain' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":4000}'::jsonb
    WHEN 'has_prostitution_explain' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":4000}'::jsonb
    WHEN 'has_money_laundering_explain' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":4000}'::jsonb
    WHEN 'has_human_trafficking_explain' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":4000}'::jsonb
    WHEN 'has_aided_human_trafficking_explain' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":4000}'::jsonb
    WHEN 'has_trafficking_beneficiary_explain' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":4000}'::jsonb
    WHEN 'intend_illegal_activity_explain' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":4000}'::jsonb
    WHEN 'intend_terrorist_activity_explain' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":4000}'::jsonb
    WHEN 'has_provided_terrorist_support_explain' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":4000}'::jsonb
    WHEN 'is_terrorist_member_explain' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":4000}'::jsonb
    WHEN 'is_terrorist_family_explain' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":4000}'::jsonb
    WHEN 'has_genocide_explain' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":4000}'::jsonb
    WHEN 'has_torture_explain' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":4000}'::jsonb
    WHEN 'has_extrajudicial_killings_explain' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":4000}'::jsonb
    WHEN 'has_child_soldier_explain' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":4000}'::jsonb
    WHEN 'has_religious_freedom_violation_explain' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":4000}'::jsonb
    WHEN 'has_population_control_explain' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":4000}'::jsonb
    WHEN 'has_coercive_transplant_explain' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":4000}'::jsonb
    WHEN 'has_immigration_fraud_explain' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":4000}'::jsonb
    WHEN 'has_removal_order_explain' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":4000}'::jsonb
    WHEN 'has_withheld_child_custody_explain' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":4000}'::jsonb
    WHEN 'has_voted_illegally_explain' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":4000}'::jsonb
    WHEN 'has_renounced_citizenship_explain' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":4000}'::jsonb
    WHEN 'ds160_preparer_surname' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"has_does_not_apply":true,"maxLength":33}'::jsonb
    WHEN 'ds160_preparer_given_names' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":33}'::jsonb
    WHEN 'ds160_preparer_organization_name' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":33}'::jsonb
    WHEN 'ds160_preparer_street1' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":40}'::jsonb
    WHEN 'ds160_preparer_street2' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":40}'::jsonb
    WHEN 'ds160_preparer_city' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":20}'::jsonb
    WHEN 'ds160_preparer_state_province' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":20}'::jsonb
    WHEN 'ds160_preparer_postal_code' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":10}'::jsonb
    WHEN 'ds160_preparer_country' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"source":"CEAC_GEOGRAPHY"}'::jsonb
    WHEN 'ds160_preparer_relationship' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":75}'::jsonb
    WHEN 'mobile_phone' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"legacy_compatibility_only":true}'::jsonb
    WHEN 'has_social_media' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"legacy_compatibility_only":true}'::jsonb
    WHEN 'social_media_provider' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"legacy_compatibility_only":true}'::jsonb
    WHEN 'social_media_identifier' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"legacy_compatibility_only":true}'::jsonb
    WHEN 'passport_has_expiry' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"legacy_compatibility_only":true}'::jsonb
    WHEN 'vwp_denial' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"label_en":"Have you ever been denied travel authorization by the Department of Homeland Security through the Electronic System for Travel Authorization (ESTA)?","official_label_en":"Have you ever been denied travel authorization by the Department of Homeland Security through the Electronic System for Travel Authorization (ESTA)?","nationality_gate":"CEAC_ESTA"}'::jsonb
    WHEN 'vwp_denial_explain' THEN COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":4000,"nationality_gate":"CEAC_ESTA"}'::jsonb
    ELSE validation_rules
  END,
  conditional_logic = CASE field_name
    WHEN 'social_media_platform' THEN NULL
    WHEN 'social_media_handle' THEN '{"showIf":"social_media_platform !== NONE && social_media_platform !== null"}'::jsonb
    WHEN 'vwp_denial' THEN NULL
    WHEN 'vwp_denial_explain' THEN '{"showIf":"vwp_denial === yes"}'::jsonb
    WHEN 'father_in_us' THEN '{"showIf":"father_surname !== DO_NOT_KNOW || father_given_names !== DO_NOT_KNOW"}'::jsonb
    WHEN 'mother_in_us' THEN '{"showIf":"mother_surname !== DO_NOT_KNOW || mother_given_names !== DO_NOT_KNOW"}'::jsonb
    WHEN 'us_relative_surname' THEN '{"showIf":"has_immediate_us_relatives === yes"}'::jsonb
    WHEN 'us_relative_given_names' THEN '{"showIf":"has_immediate_us_relatives === yes"}'::jsonb
    WHEN 'us_relative_relationship' THEN '{"showIf":"has_immediate_us_relatives === yes"}'::jsonb
    WHEN 'us_relative_status' THEN '{"showIf":"has_immediate_us_relatives === yes"}'::jsonb
    WHEN 'has_other_us_relatives' THEN '{"showIf":"has_immediate_us_relatives === no"}'::jsonb
    WHEN 'us_contact_surname' THEN '{"showIf":"has_specific_plans !== no || intended_length_of_stay_unit !== H"}'::jsonb
    WHEN 'us_contact_given_names' THEN '{"showIf":"has_specific_plans !== no || intended_length_of_stay_unit !== H"}'::jsonb
    WHEN 'us_contact_organization' THEN '{"showIf":"has_specific_plans !== no || intended_length_of_stay_unit !== H"}'::jsonb
    WHEN 'us_contact_relationship' THEN '{"showIf":"has_specific_plans !== no || intended_length_of_stay_unit !== H"}'::jsonb
    WHEN 'us_contact_address_street1' THEN '{"showIf":"has_specific_plans !== no && us_contact_relationship !== _empty || intended_length_of_stay_unit !== H && us_contact_relationship !== _empty"}'::jsonb
    WHEN 'us_contact_address_street2' THEN '{"showIf":"has_specific_plans !== no && us_contact_relationship !== _empty || intended_length_of_stay_unit !== H && us_contact_relationship !== _empty"}'::jsonb
    WHEN 'us_contact_city' THEN '{"showIf":"has_specific_plans !== no && us_contact_relationship !== _empty || intended_length_of_stay_unit !== H && us_contact_relationship !== _empty"}'::jsonb
    WHEN 'us_contact_state' THEN '{"showIf":"has_specific_plans !== no && us_contact_relationship !== _empty || intended_length_of_stay_unit !== H && us_contact_relationship !== _empty"}'::jsonb
    WHEN 'us_contact_zip' THEN '{"showIf":"has_specific_plans !== no && us_contact_relationship !== _empty || intended_length_of_stay_unit !== H && us_contact_relationship !== _empty"}'::jsonb
    WHEN 'us_contact_phone' THEN '{"showIf":"has_specific_plans !== no && us_contact_relationship !== _empty || intended_length_of_stay_unit !== H && us_contact_relationship !== _empty"}'::jsonb
    WHEN 'us_contact_email' THEN '{"showIf":"has_specific_plans !== no && us_contact_relationship !== _empty || intended_length_of_stay_unit !== H && us_contact_relationship !== _empty"}'::jsonb
    ELSE conditional_logic
  END,
  options = CASE field_name
    WHEN 'number_of_former_spouses' THEN '[{"value":"1","text":"1"},{"value":"2","text":"2"}]'::jsonb
    ELSE options
  END,
  updated_at = now()
WHERE visa_type = 'DS160'
  AND field_name IN (
    'date_of_birth', 'country_of_birth', 'nationality_country', 'other_nationality_country',
    'other_permanent_resident_country', 'us_address_state', 'us_drivers_license_state',
    'payer_address_country', 'payer_org_address_country', 'home_address_country',
    'mailing_address_country', 'marital_status_other_explain', 'passport_document_type_explain',
    'passport_book_number', 'passport_issuing_country', 'passport_issuance_city',
    'passport_issuance_state', 'passport_issuance_country', 'lost_passport_number',
    'lost_passport_country', 'lost_passport_explain', 'partner_surname',
    'spouse_nationality', 'spouse_country_of_birth', 'spouse_address_country',
    'partner_given_names', 'partner_date_of_birth', 'partner_nationality',
    'partner_city_of_birth', 'partner_country_of_birth', 'partner_address_street1',
    'partner_address_street2', 'partner_address_city', 'partner_address_state',
    'partner_address_zip', 'partner_address_country', 'deceased_spouse_surname',
    'deceased_spouse_given_names', 'deceased_spouse_date_of_birth',
    'deceased_spouse_nationality', 'deceased_spouse_city_of_birth',
    'deceased_spouse_country_of_birth', 'number_of_former_spouses',
    'former_spouse_surname', 'former_spouse_given_names', 'former_spouse_date_of_birth',
    'former_spouse_nationality', 'former_spouse_city_of_birth',
    'former_spouse_country_of_birth', 'former_spouse_date_of_marriage',
    'former_spouse_date_marriage_ended', 'former_spouse_how_marriage_ended',
    'former_spouse_country_marriage_terminated', 'us_contact_surname',
    'us_contact_given_names', 'us_contact_organization', 'us_contact_address_street1',
    'us_contact_address_street2', 'us_contact_city', 'us_contact_state',
    'us_contact_zip', 'us_contact_phone', 'us_contact_email',
    'us_relative_surname', 'us_relative_given_names', 'us_relative_relationship',
    'us_relative_status', 'has_other_us_relatives', 'father_in_us', 'mother_in_us',
    'vwp_denial', 'vwp_denial_explain', 'social_media_platform', 'social_media_handle',
    'mobile_phone', 'has_social_media', 'social_media_provider',
    'social_media_identifier', 'passport_has_expiry',
    'occupation_other_explain', 'employer_name', 'employer_address_line1',
    'employer_address_line2', 'employer_city', 'employer_state_province',
    'employer_postal_code', 'employer_country', 'employer_phone',
    'employment_start_date', 'monthly_salary', 'job_duties', 'prev_employer_name',
    'prev_employer_address_street1', 'prev_employer_address_street2', 'prev_employer_city',
    'prev_employer_state', 'prev_employer_postal', 'prev_employer_country',
    'prev_employer_phone', 'prev_job_title', 'prev_supervisor_surname',
    'prev_supervisor_given_names', 'prev_employment_start_date', 'prev_employment_end_date',
    'prev_job_duties', 'education_institution_name', 'education_address_line1',
    'education_address_line2', 'education_city', 'education_state_province',
    'education_postal_code', 'education_country', 'education_course_of_study',
    'education_start_date', 'education_end_date', 'clan_tribe_name', 'language_name',
    'traveled_country', 'organization_name', 'specialized_skills_explain',
    'military_country', 'military_branch', 'military_rank', 'military_specialty',
    'military_date_from', 'military_date_to', 'paramilitary_explain',
    'refusal_explain', 'immigrant_petition_explain', 'has_communicable_disease_explain',
    'has_physical_mental_disorder_explain', 'is_drug_abuser_explain',
    'has_arrest_conviction_explain', 'has_violated_controlled_substance_explain',
    'has_prostitution_explain', 'has_money_laundering_explain', 'has_human_trafficking_explain',
    'has_aided_human_trafficking_explain', 'has_trafficking_beneficiary_explain',
    'intend_illegal_activity_explain', 'intend_terrorist_activity_explain',
    'has_provided_terrorist_support_explain', 'is_terrorist_member_explain',
    'is_terrorist_family_explain', 'has_genocide_explain', 'has_torture_explain',
    'has_extrajudicial_killings_explain', 'has_child_soldier_explain',
    'has_religious_freedom_violation_explain', 'has_population_control_explain',
    'has_coercive_transplant_explain', 'has_immigration_fraud_explain',
    'has_removal_order_explain', 'has_withheld_child_custody_explain',
    'has_voted_illegally_explain', 'has_renounced_citizenship_explain',
    'ds160_preparer_surname', 'ds160_preparer_given_names',
    'ds160_preparer_organization_name', 'ds160_preparer_street1',
    'ds160_preparer_street2', 'ds160_preparer_city',
    'ds160_preparer_state_province', 'ds160_preparer_postal_code',
    'ds160_preparer_country', 'ds160_preparer_relationship'
  );

-- Keep the persisted evidence label aligned with the current live Sign and
-- Submit DOM capture. Requiredness remains intentionally unclaimed because
-- the synthetic audit draft cannot activate CEAC's final Sign action.
UPDATE public.visa_form_fields
SET validation_rules = COALESCE(validation_rules, '{}'::jsonb) ||
  '{"official_source":"CEAC DS-160 Sign and Submit live DOM capture 2026-09-21 (field labels, NA controls and max lengths; server requiredness not independently verified)"}'::jsonb,
  updated_at = now()
WHERE visa_type = 'DS160'
  AND field_name IN (
    'ds160_preparer_assistance', 'ds160_preparer_surname',
    'ds160_preparer_given_names', 'ds160_preparer_organization_name',
    'ds160_preparer_street1', 'ds160_preparer_street2', 'ds160_preparer_city',
    'ds160_preparer_state_province', 'ds160_preparer_postal_code',
    'ds160_preparer_country', 'ds160_preparer_relationship'
  );

-- Preserve the official applicant-page order: U.S. contact, family relatives,
-- then the selected spouse/partner branch. Existing answer rows are retained.
UPDATE public.visa_form_fields
SET step_number = CASE field_name
    WHEN 'us_contact_surname' THEN 8
    WHEN 'us_contact_given_names' THEN 8
    WHEN 'us_contact_organization' THEN 8
    WHEN 'us_contact_relationship' THEN 8
    WHEN 'us_contact_address_street1' THEN 8
    WHEN 'us_contact_address_street2' THEN 8
    WHEN 'us_contact_city' THEN 8
    WHEN 'us_contact_state' THEN 8
    WHEN 'us_contact_zip' THEN 8
    WHEN 'us_contact_phone' THEN 8
    WHEN 'us_contact_email' THEN 8
    WHEN 'father_surname' THEN 9
    WHEN 'father_given_names' THEN 9
    WHEN 'father_date_of_birth' THEN 9
    WHEN 'mother_surname' THEN 9
    WHEN 'mother_given_names' THEN 9
    WHEN 'mother_date_of_birth' THEN 9
    WHEN 'has_immediate_us_relatives' THEN 9
    WHEN 'us_relative_surname' THEN 9
    WHEN 'us_relative_given_names' THEN 9
    WHEN 'us_relative_relationship' THEN 9
    WHEN 'us_relative_status' THEN 9
    WHEN 'has_other_us_relatives' THEN 9
    WHEN 'father_in_us' THEN 9
    WHEN 'mother_in_us' THEN 9
    WHEN 'spouse_surname' THEN 10
    WHEN 'spouse_given_names' THEN 10
    WHEN 'spouse_date_of_birth' THEN 10
    WHEN 'spouse_nationality' THEN 10
    WHEN 'spouse_city_of_birth' THEN 10
    WHEN 'spouse_country_of_birth' THEN 10
    WHEN 'spouse_address_type' THEN 10
    WHEN 'spouse_address_street1' THEN 10
    WHEN 'spouse_address_street2' THEN 10
    WHEN 'spouse_address_city' THEN 10
    WHEN 'spouse_address_state' THEN 10
    WHEN 'spouse_address_zip' THEN 10
    WHEN 'spouse_address_country' THEN 10
    WHEN 'partner_surname' THEN 10
    WHEN 'partner_given_names' THEN 10
    WHEN 'partner_date_of_birth' THEN 10
    WHEN 'partner_nationality' THEN 10
    WHEN 'partner_city_of_birth' THEN 10
    WHEN 'partner_country_of_birth' THEN 10
    WHEN 'partner_address_type' THEN 10
    WHEN 'partner_address_street1' THEN 10
    WHEN 'partner_address_street2' THEN 10
    WHEN 'partner_address_city' THEN 10
    WHEN 'partner_address_state' THEN 10
    WHEN 'partner_address_zip' THEN 10
    WHEN 'partner_address_country' THEN 10
    WHEN 'deceased_spouse_surname' THEN 10
    WHEN 'deceased_spouse_given_names' THEN 10
    WHEN 'deceased_spouse_date_of_birth' THEN 10
    WHEN 'deceased_spouse_nationality' THEN 10
    WHEN 'deceased_spouse_city_of_birth' THEN 10
    WHEN 'deceased_spouse_country_of_birth' THEN 10
    WHEN 'number_of_former_spouses' THEN 10
    WHEN 'former_spouse_surname' THEN 10
    WHEN 'former_spouse_given_names' THEN 10
    WHEN 'former_spouse_date_of_birth' THEN 10
    WHEN 'former_spouse_nationality' THEN 10
    WHEN 'former_spouse_city_of_birth' THEN 10
    WHEN 'former_spouse_country_of_birth' THEN 10
    WHEN 'former_spouse_date_of_marriage' THEN 10
    WHEN 'former_spouse_date_marriage_ended' THEN 10
    WHEN 'former_spouse_how_marriage_ended' THEN 10
    WHEN 'former_spouse_country_marriage_terminated' THEN 10
    ELSE step_number
  END,
  updated_at = now()
WHERE visa_type = 'DS160'
  AND field_name IN (
    'us_contact_surname', 'us_contact_given_names', 'us_contact_organization',
    'us_contact_relationship', 'us_contact_address_street1', 'us_contact_address_street2',
    'us_contact_city', 'us_contact_state', 'us_contact_zip', 'us_contact_phone',
    'us_contact_email', 'father_surname', 'father_given_names', 'father_date_of_birth',
    'mother_surname', 'mother_given_names', 'mother_date_of_birth',
    'has_immediate_us_relatives', 'us_relative_surname', 'us_relative_given_names',
    'us_relative_relationship', 'us_relative_status', 'has_other_us_relatives',
    'father_in_us', 'mother_in_us', 'spouse_surname', 'spouse_given_names',
    'spouse_date_of_birth', 'spouse_nationality', 'spouse_city_of_birth',
    'spouse_country_of_birth', 'spouse_address_type', 'spouse_address_street1',
    'spouse_address_street2', 'spouse_address_city', 'spouse_address_state',
    'spouse_address_zip', 'spouse_address_country', 'partner_surname',
    'partner_given_names', 'partner_date_of_birth', 'partner_nationality',
    'partner_city_of_birth', 'partner_country_of_birth', 'partner_address_type',
    'partner_address_street1', 'partner_address_street2', 'partner_address_city',
    'partner_address_state', 'partner_address_zip', 'partner_address_country',
    'deceased_spouse_surname', 'deceased_spouse_given_names',
    'deceased_spouse_date_of_birth', 'deceased_spouse_nationality',
    'deceased_spouse_city_of_birth', 'deceased_spouse_country_of_birth',
    'number_of_former_spouses', 'former_spouse_surname', 'former_spouse_given_names',
    'former_spouse_date_of_birth', 'former_spouse_nationality',
    'former_spouse_city_of_birth', 'former_spouse_country_of_birth',
    'former_spouse_date_of_marriage', 'former_spouse_date_marriage_ended',
    'former_spouse_how_marriage_ended', 'former_spouse_country_marriage_terminated'
  );

-- These repeat groups expose Add/Remove controls, but the live walk did not
-- establish a fixed upper bound. Preserve the group and row-count validation;
-- remove legacy max_items caps so the UI does not stop at an invented limit.
UPDATE public.visa_form_fields
SET validation_rules = COALESCE(validation_rules, '{}'::jsonb) - 'max_items'
WHERE visa_type = 'DS160'
  AND field_name IN (
    'arrival_date', 'arrival_flight', 'arrival_city', 'departure_date',
    'departure_flight', 'departure_city', 'us_drivers_license_number',
    'us_drivers_license_state', 'lost_passport_number', 'lost_passport_country',
    'lost_passport_explain', 'us_relative_surname', 'us_relative_given_names',
    'us_relative_relationship', 'us_relative_status', 'former_spouse_surname',
    'former_spouse_given_names', 'former_spouse_date_of_birth',
    'former_spouse_nationality', 'former_spouse_city_of_birth',
    'former_spouse_country_of_birth', 'former_spouse_date_of_marriage',
    'former_spouse_date_marriage_ended', 'former_spouse_how_marriage_ended',
    'former_spouse_country_marriage_terminated', 'education_institution_name',
    'education_address_line1', 'education_address_line2', 'education_city',
    'education_state_province', 'education_postal_code', 'education_country',
    'education_course_of_study', 'education_start_date', 'education_end_date',
    'organization_name'
  );

-- The CEAC start-page location selector exposes all 217 official posts.
UPDATE public.visa_form_fields
SET options = '[{"value":"TIA","text":"ALBANIA, TIRANA","label_zh":"阿尔巴尼亚，地拉那","label_en":"ALBANIA, TIRANA","official_label":"ALBANIA, TIRANA"},{"value":"ALG","text":"ALGERIA, ALGIERS","label_zh":"阿尔及利亚，阿尔及尔","label_en":"ALGERIA, ALGIERS","official_label":"ALGERIA, ALGIERS"},{"value":"LUA","text":"ANGOLA, LUANDA","label_zh":"安哥拉，罗安达","label_en":"ANGOLA, LUANDA","official_label":"ANGOLA, LUANDA"},{"value":"BNS","text":"ARGENTINA, BUENOS AIRES","label_zh":"阿根廷，布宜诺斯艾利斯","label_en":"ARGENTINA, BUENOS AIRES","official_label":"ARGENTINA, BUENOS AIRES"},{"value":"YRV","text":"ARMENIA, YEREVAN","label_zh":"亚美尼亚，埃里温","label_en":"ARMENIA, YEREVAN","official_label":"ARMENIA, YEREVAN"},{"value":"MLB","text":"AUSTRALIA, MELBOURNE","label_zh":"澳大利亚，墨尔本","label_en":"AUSTRALIA, MELBOURNE","official_label":"AUSTRALIA, MELBOURNE"},{"value":"PRT","text":"AUSTRALIA, PERTH","label_zh":"澳大利亚，珀斯","label_en":"AUSTRALIA, PERTH","official_label":"AUSTRALIA, PERTH"},{"value":"SYD","text":"AUSTRALIA, SYDNEY","label_zh":"澳大利亚，悉尼","label_en":"AUSTRALIA, SYDNEY","official_label":"AUSTRALIA, SYDNEY"},{"value":"VNN","text":"AUSTRIA, VIENNA","label_zh":"奥地利，维也纳","label_en":"AUSTRIA, VIENNA","official_label":"AUSTRIA, VIENNA"},{"value":"BKU","text":"AZERBAIJAN, BAKU","label_zh":"阿塞拜疆，巴库","label_en":"AZERBAIJAN, BAKU","official_label":"AZERBAIJAN, BAKU"},{"value":"NSS","text":"BAHAMAS, NASSAU","label_zh":"巴哈马，拿骚","label_en":"BAHAMAS, NASSAU","official_label":"BAHAMAS, NASSAU"},{"value":"MNA","text":"BAHRAIN, MANAMA","label_zh":"巴林，麦纳麦","label_en":"BAHRAIN, MANAMA","official_label":"BAHRAIN, MANAMA"},{"value":"DHK","text":"BANGLADESH, DHAKA","label_zh":"孟加拉国，达卡","label_en":"BANGLADESH, DHAKA","official_label":"BANGLADESH, DHAKA"},{"value":"BGN","text":"BARBADOS, BRIDGETOWN","label_zh":"巴巴多斯，布里奇敦","label_en":"BARBADOS, BRIDGETOWN","official_label":"BARBADOS, BRIDGETOWN"},{"value":"BRS","text":"BELGIUM, BRUSSELS","label_zh":"比利时，布鲁塞尔","label_en":"BELGIUM, BRUSSELS","official_label":"BELGIUM, BRUSSELS"},{"value":"BLZ","text":"BELIZE, BELMOPAN","label_zh":"伯利兹，贝尔莫潘","label_en":"BELIZE, BELMOPAN","official_label":"BELIZE, BELMOPAN"},{"value":"COT","text":"BENIN, COTONOU","label_zh":"贝宁，科托努","label_en":"BENIN, COTONOU","official_label":"BENIN, COTONOU"},{"value":"HML","text":"BERMUDA, HAMILTON","label_zh":"百慕大，汉密尔顿","label_en":"BERMUDA, HAMILTON","official_label":"BERMUDA, HAMILTON"},{"value":"LPZ","text":"BOLIVIA, LA PAZ","label_zh":"玻利维亚，拉巴斯","label_en":"BOLIVIA, LA PAZ","official_label":"BOLIVIA, LA PAZ"},{"value":"SAR","text":"BOSNIA-HERZEGOVINA, SARAJEVO","label_zh":"波斯尼亚和黑塞哥维那，萨拉热窝","label_en":"BOSNIA-HERZEGOVINA, SARAJEVO","official_label":"BOSNIA-HERZEGOVINA, SARAJEVO"},{"value":"GAB","text":"BOTSWANA, GABORONE","label_zh":"博茨瓦纳，哈博罗内","label_en":"BOTSWANA, GABORONE","official_label":"BOTSWANA, GABORONE"},{"value":"BRA","text":"BRAZIL, BRASILIA","label_zh":"巴西，巴西利亚","label_en":"BRAZIL, BRASILIA","official_label":"BRAZIL, BRASILIA"},{"value":"PTA","text":"BRAZIL, PORTO ALEGRE","label_zh":"巴西，阿雷格里港","label_en":"BRAZIL, PORTO ALEGRE","official_label":"BRAZIL, PORTO ALEGRE"},{"value":"RCF","text":"BRAZIL, RECIFE","label_zh":"巴西，累西腓","label_en":"BRAZIL, RECIFE","official_label":"BRAZIL, RECIFE"},{"value":"RDJ","text":"BRAZIL, RIO DE JANEIRO","label_zh":"巴西，里约热内卢","label_en":"BRAZIL, RIO DE JANEIRO","official_label":"BRAZIL, RIO DE JANEIRO"},{"value":"SPL","text":"BRAZIL, SAO PAULO","label_zh":"巴西，圣保罗","label_en":"BRAZIL, SAO PAULO","official_label":"BRAZIL, SAO PAULO"},{"value":"BSB","text":"BRUNEI, BANDAR SERI BEGAWAN","label_zh":"文莱，斯里巴加湾","label_en":"BRUNEI, BANDAR SERI BEGAWAN","official_label":"BRUNEI, BANDAR SERI BEGAWAN"},{"value":"SOF","text":"BULGARIA, SOFIA","label_zh":"保加利亚，索非亚","label_en":"BULGARIA, SOFIA","official_label":"BULGARIA, SOFIA"},{"value":"OUG","text":"BURKINA FASO, OUAGADOUGOU","label_zh":"布基纳法索，瓦加杜古","label_en":"BURKINA FASO, OUAGADOUGOU","official_label":"BURKINA FASO, OUAGADOUGOU"},{"value":"RNG","text":"BURMA, RANGOON","label_zh":"缅甸，仰光","label_en":"BURMA, RANGOON","official_label":"BURMA, RANGOON"},{"value":"BUJ","text":"BURUNDI, BUJUMBURA","label_zh":"布隆迪，布琼布拉","label_en":"BURUNDI, BUJUMBURA","official_label":"BURUNDI, BUJUMBURA"},{"value":"PIA","text":"CABO VERDE, PRAIA","label_zh":"佛得角，普拉亚","label_en":"CABO VERDE, PRAIA","official_label":"CABO VERDE, PRAIA"},{"value":"PHP","text":"CAMBODIA, PHNOM PENH","label_zh":"柬埔寨，金边","label_en":"CAMBODIA, PHNOM PENH","official_label":"CAMBODIA, PHNOM PENH"},{"value":"YDE","text":"CAMEROON, YAOUNDE","label_zh":"喀麦隆，雅温得","label_en":"CAMEROON, YAOUNDE","official_label":"CAMEROON, YAOUNDE"},{"value":"CLG","text":"CANADA, CALGARY","label_zh":"加拿大，卡尔加里","label_en":"CANADA, CALGARY","official_label":"CANADA, CALGARY"},{"value":"HLF","text":"CANADA, HALIFAX","label_zh":"加拿大，哈利法克斯","label_en":"CANADA, HALIFAX","official_label":"CANADA, HALIFAX"},{"value":"MTL","text":"CANADA, MONTREAL","label_zh":"加拿大，蒙特利尔","label_en":"CANADA, MONTREAL","official_label":"CANADA, MONTREAL"},{"value":"OTT","text":"CANADA, OTTAWA","label_zh":"加拿大，渥太华","label_en":"CANADA, OTTAWA","official_label":"CANADA, OTTAWA"},{"value":"QBC","text":"CANADA, QUEBEC","label_zh":"加拿大，魁北克","label_en":"CANADA, QUEBEC","official_label":"CANADA, QUEBEC"},{"value":"TRT","text":"CANADA, TORONTO","label_zh":"加拿大，多伦多","label_en":"CANADA, TORONTO","official_label":"CANADA, TORONTO"},{"value":"VAC","text":"CANADA, VANCOUVER","label_zh":"加拿大，温哥华","label_en":"CANADA, VANCOUVER","official_label":"CANADA, VANCOUVER"},{"value":"NDJ","text":"CHAD, N`DJAMENA","label_zh":"乍得，恩贾梅纳","label_en":"CHAD, N`DJAMENA","official_label":"CHAD, N`DJAMENA"},{"value":"SNT","text":"CHILE, SANTIAGO","label_zh":"智利，圣地亚哥","label_en":"CHILE, SANTIAGO","official_label":"CHILE, SANTIAGO"},{"value":"BEJ","text":"CHINA, BEIJING","label_zh":"中国，北京","label_en":"CHINA, BEIJING","official_label":"CHINA, BEIJING"},{"value":"GUZ","text":"CHINA, GUANGZHOU","label_zh":"中国，广州","label_en":"CHINA, GUANGZHOU","official_label":"CHINA, GUANGZHOU"},{"value":"SHG","text":"CHINA, SHANGHAI","label_zh":"中国，上海","label_en":"CHINA, SHANGHAI","official_label":"CHINA, SHANGHAI"},{"value":"SNY","text":"CHINA, SHENYANG","label_zh":"中国，沈阳","label_en":"CHINA, SHENYANG","official_label":"CHINA, SHENYANG"},{"value":"WUH","text":"CHINA, WUHAN","label_zh":"中国，武汉","label_en":"CHINA, WUHAN","official_label":"CHINA, WUHAN"},{"value":"BGT","text":"COLOMBIA, BOGOTA","label_zh":"哥伦比亚，波哥大","label_en":"COLOMBIA, BOGOTA","official_label":"COLOMBIA, BOGOTA"},{"value":"BRZ","text":"CONGO, BRAZZAVILLE","label_zh":"刚果，布拉柴维尔","label_en":"CONGO, BRAZZAVILLE","official_label":"CONGO, BRAZZAVILLE"},{"value":"KIN","text":"CONGO, KINSHASA","label_zh":"刚果，金沙萨","label_en":"CONGO, KINSHASA","official_label":"CONGO, KINSHASA"},{"value":"SNJ","text":"COSTA RICA, SAN JOSE","label_zh":"哥斯达黎加，圣何塞","label_en":"COSTA RICA, SAN JOSE","official_label":"COSTA RICA, SAN JOSE"},{"value":"ABJ","text":"COTE D`IVORIE, ABIDJAN","label_zh":"科特迪瓦，阿比让","label_en":"COTE D`IVORIE, ABIDJAN","official_label":"COTE D`IVORIE, ABIDJAN"},{"value":"ZGB","text":"CROATIA, ZAGREB","label_zh":"克罗地亚，萨格勒布","label_en":"CROATIA, ZAGREB","official_label":"CROATIA, ZAGREB"},{"value":"HAV","text":"CUBA, HAVANA","label_zh":"古巴，哈瓦那","label_en":"CUBA, HAVANA","official_label":"CUBA, HAVANA"},{"value":"CRC","text":"CURACAO, CURACAO","label_zh":"库拉索，库拉索","label_en":"CURACAO, CURACAO","official_label":"CURACAO, CURACAO"},{"value":"NCS","text":"CYPRUS, NICOSIA","label_zh":"塞浦路斯，尼科西亚","label_en":"CYPRUS, NICOSIA","official_label":"CYPRUS, NICOSIA"},{"value":"PRG","text":"CZECH REPUBLIC, PRAGUE","label_zh":"捷克共和国，布拉格","label_en":"CZECH REPUBLIC, PRAGUE","official_label":"CZECH REPUBLIC, PRAGUE"},{"value":"CPN","text":"DENMARK, COPENHAGEN","label_zh":"丹麦，哥本哈根","label_en":"DENMARK, COPENHAGEN","official_label":"DENMARK, COPENHAGEN"},{"value":"DJI","text":"DJIBOUTI, DJIBOUTI","label_zh":"吉布提，吉布提","label_en":"DJIBOUTI, DJIBOUTI","official_label":"DJIBOUTI, DJIBOUTI"},{"value":"SDO","text":"DOMINICAN REPUBLIC, SANTO DOMINGO","label_zh":"多米尼加共和国，圣多明各","label_en":"DOMINICAN REPUBLIC, SANTO DOMINGO","official_label":"DOMINICAN REPUBLIC, SANTO DOMINGO"},{"value":"GYQ","text":"ECUADOR, GUAYAQUIL","label_zh":"厄瓜多尔，瓜亚基尔","label_en":"ECUADOR, GUAYAQUIL","official_label":"ECUADOR, GUAYAQUIL"},{"value":"QTO","text":"ECUADOR, QUITO","label_zh":"厄瓜多尔，基多","label_en":"ECUADOR, QUITO","official_label":"ECUADOR, QUITO"},{"value":"CRO","text":"EGYPT, CAIRO","label_zh":"埃及，开罗","label_en":"EGYPT, CAIRO","official_label":"EGYPT, CAIRO"},{"value":"SNS","text":"EL SALVADOR, SAN SALVADOR","label_zh":"萨尔瓦多，圣萨尔瓦多","label_en":"EL SALVADOR, SAN SALVADOR","official_label":"EL SALVADOR, SAN SALVADOR"},{"value":"LND","text":"ENGLAND, LONDON","label_zh":"英格兰，伦敦","label_en":"ENGLAND, LONDON","official_label":"ENGLAND, LONDON"},{"value":"MBO","text":"EQUATORIAL GUINEA, MALABO","label_zh":"赤道几内亚，马拉博","label_en":"EQUATORIAL GUINEA, MALABO","official_label":"EQUATORIAL GUINEA, MALABO"},{"value":"ASM","text":"ERITREA, ASMARA","label_zh":"厄立特里亚，阿斯马拉","label_en":"ERITREA, ASMARA","official_label":"ERITREA, ASMARA"},{"value":"TAL","text":"ESTONIA, TALLINN","label_zh":"爱沙尼亚，塔林","label_en":"ESTONIA, TALLINN","official_label":"ESTONIA, TALLINN"},{"value":"MBA","text":"ESWATINI, MBABANE","label_zh":"斯威士兰，姆巴巴内","label_en":"ESWATINI, MBABANE","official_label":"ESWATINI, MBABANE"},{"value":"ADD","text":"ETHIOPIA, ADDIS ABABA","label_zh":"埃塞俄比亚，亚的斯亚贝巴","label_en":"ETHIOPIA, ADDIS ABABA","official_label":"ETHIOPIA, ADDIS ABABA"},{"value":"SUV","text":"FIJI, SUVA","label_zh":"斐济，苏瓦","label_en":"FIJI, SUVA","official_label":"FIJI, SUVA"},{"value":"HLS","text":"FINLAND, HELSINKI","label_zh":"芬兰，赫尔辛基","label_en":"FINLAND, HELSINKI","official_label":"FINLAND, HELSINKI"},{"value":"PRS","text":"FRANCE, PARIS","label_zh":"法国，巴黎","label_en":"FRANCE, PARIS","official_label":"FRANCE, PARIS"},{"value":"LIB","text":"GABON, LIBREVILLE","label_zh":"加蓬，利伯维尔","label_en":"GABON, LIBREVILLE","official_label":"GABON, LIBREVILLE"},{"value":"BAN","text":"GAMBIA, BANJUL","label_zh":"冈比亚，班珠尔","label_en":"GAMBIA, BANJUL","official_label":"GAMBIA, BANJUL"},{"value":"TBL","text":"GEORGIA, TBILISI","label_zh":"格鲁吉亚，第比利斯","label_en":"GEORGIA, TBILISI","official_label":"GEORGIA, TBILISI"},{"value":"BRL","text":"GERMANY, BERLIN","label_zh":"德国，柏林","label_en":"GERMANY, BERLIN","official_label":"GERMANY, BERLIN"},{"value":"FRN","text":"GERMANY, FRANKFURT","label_zh":"德国，法兰克福","label_en":"GERMANY, FRANKFURT","official_label":"GERMANY, FRANKFURT"},{"value":"MUN","text":"GERMANY, MUNICH","label_zh":"德国，慕尼黑","label_en":"GERMANY, MUNICH","official_label":"GERMANY, MUNICH"},{"value":"ACC","text":"GHANA, ACCRA","label_zh":"加纳，阿克拉","label_en":"GHANA, ACCRA","official_label":"GHANA, ACCRA"},{"value":"ATH","text":"GREECE, ATHENS","label_zh":"希腊，雅典","label_en":"GREECE, ATHENS","official_label":"GREECE, ATHENS"},{"value":"GTM","text":"GUATEMALA, GUATEMALA CITY","label_zh":"危地马拉，危地马拉城","label_en":"GUATEMALA, GUATEMALA CITY","official_label":"GUATEMALA, GUATEMALA CITY"},{"value":"CRY","text":"GUINEA, CONAKRY","label_zh":"几内亚，科纳克里","label_en":"GUINEA, CONAKRY","official_label":"GUINEA, CONAKRY"},{"value":"GEO","text":"GUYANA, GEORGETOWN","label_zh":"圭亚那，乔治敦","label_en":"GUYANA, GEORGETOWN","official_label":"GUYANA, GEORGETOWN"},{"value":"PTP","text":"HAITI, PORT-AU-PRINCE","label_zh":"海地，太子港","label_en":"HAITI, PORT-AU-PRINCE","official_label":"HAITI, PORT-AU-PRINCE"},{"value":"TGG","text":"HONDURAS, TEGUCIGALPA","label_zh":"洪都拉斯，特古西加尔巴","label_en":"HONDURAS, TEGUCIGALPA","official_label":"HONDURAS, TEGUCIGALPA"},{"value":"HNK","text":"HONG KONG","label_zh":"中国香港，香港","label_en":"HONG KONG","official_label":"HONG KONG"},{"value":"BDP","text":"HUNGARY, BUDAPEST","label_zh":"匈牙利，布达佩斯","label_en":"HUNGARY, BUDAPEST","official_label":"HUNGARY, BUDAPEST"},{"value":"RKJ","text":"ICELAND, REYKJAVIK","label_zh":"冰岛，雷克雅未克","label_en":"ICELAND, REYKJAVIK","official_label":"ICELAND, REYKJAVIK"},{"value":"MDR","text":"INDIA, CHENNAI","label_zh":"印度，金奈","label_en":"INDIA, CHENNAI","official_label":"INDIA, CHENNAI"},{"value":"HYD","text":"INDIA, HYDERABAD","label_zh":"印度，海得拉巴","label_en":"INDIA, HYDERABAD","official_label":"INDIA, HYDERABAD"},{"value":"CLC","text":"INDIA, KOLKATA","label_zh":"印度，加尔各答","label_en":"INDIA, KOLKATA","official_label":"INDIA, KOLKATA"},{"value":"BMB","text":"INDIA, MUMBAI","label_zh":"印度，孟买","label_en":"INDIA, MUMBAI","official_label":"INDIA, MUMBAI"},{"value":"NWD","text":"INDIA, NEW DELHI","label_zh":"印度，新德里","label_en":"INDIA, NEW DELHI","official_label":"INDIA, NEW DELHI"},{"value":"JAK","text":"INDONESIA, JAKARTA","label_zh":"印度尼西亚，雅加达","label_en":"INDONESIA, JAKARTA","official_label":"INDONESIA, JAKARTA"},{"value":"SRB","text":"INDONESIA, SURABAYA","label_zh":"印度尼西亚，泗水","label_en":"INDONESIA, SURABAYA","official_label":"INDONESIA, SURABAYA"},{"value":"BGH","text":"IRAQ, BAGHDAD","label_zh":"伊拉克，巴格达","label_en":"IRAQ, BAGHDAD","official_label":"IRAQ, BAGHDAD"},{"value":"ERB","text":"IRAQ, ERBIL","label_zh":"伊拉克，埃尔比勒","label_en":"IRAQ, ERBIL","official_label":"IRAQ, ERBIL"},{"value":"DBL","text":"IRELAND, DUBLIN","label_zh":"爱尔兰，都柏林","label_en":"IRELAND, DUBLIN","official_label":"IRELAND, DUBLIN"},{"value":"TLV","text":"ISRAEL, TEL AVIV","label_zh":"以色列，特拉维夫","label_en":"ISRAEL, TEL AVIV","official_label":"ISRAEL, TEL AVIV"},{"value":"FLR","text":"ITALY, FLORENCE","label_zh":"意大利，佛罗伦萨","label_en":"ITALY, FLORENCE","official_label":"ITALY, FLORENCE"},{"value":"MLN","text":"ITALY, MILAN","label_zh":"意大利，米兰","label_en":"ITALY, MILAN","official_label":"ITALY, MILAN"},{"value":"NPL","text":"ITALY, NAPLES","label_zh":"意大利，那不勒斯","label_en":"ITALY, NAPLES","official_label":"ITALY, NAPLES"},{"value":"RME","text":"ITALY, ROME","label_zh":"意大利，罗马","label_en":"ITALY, ROME","official_label":"ITALY, ROME"},{"value":"KNG","text":"JAMAICA, KINGSTON","label_zh":"牙买加，金斯敦","label_en":"JAMAICA, KINGSTON","official_label":"JAMAICA, KINGSTON"},{"value":"NHA","text":"JAPAN, NAHA","label_zh":"日本，那霸","label_en":"JAPAN, NAHA","official_label":"JAPAN, NAHA"},{"value":"KBO","text":"JAPAN, OSAKA/FUKUOKA","label_zh":"日本，大阪/福冈","label_en":"JAPAN, OSAKA/FUKUOKA","official_label":"JAPAN, OSAKA/FUKUOKA"},{"value":"TKY","text":"JAPAN, TOKYO/SAPPORO","label_zh":"日本，东京/札幌","label_en":"JAPAN, TOKYO/SAPPORO","official_label":"JAPAN, TOKYO/SAPPORO"},{"value":"JRS","text":"JERUSALEM","label_zh":"耶路撒冷，耶路撒冷","label_en":"JERUSALEM","official_label":"JERUSALEM"},{"value":"AMM","text":"JORDAN, AMMAN","label_zh":"约旦，安曼","label_en":"JORDAN, AMMAN","official_label":"JORDAN, AMMAN"},{"value":"ATA","text":"KAZAKHSTAN, ALMATY","label_zh":"哈萨克斯坦，阿拉木图","label_en":"KAZAKHSTAN, ALMATY","official_label":"KAZAKHSTAN, ALMATY"},{"value":"AST","text":"KAZAKHSTAN, ASTANA","label_zh":"哈萨克斯坦，阿斯塔纳","label_en":"KAZAKHSTAN, ASTANA","official_label":"KAZAKHSTAN, ASTANA"},{"value":"NRB","text":"KENYA, NAIROBI","label_zh":"肯尼亚，内罗毕","label_en":"KENYA, NAIROBI","official_label":"KENYA, NAIROBI"},{"value":"PRI","text":"KOSOVO, PRISTINA","label_zh":"科索沃，普里什蒂纳","label_en":"KOSOVO, PRISTINA","official_label":"KOSOVO, PRISTINA"},{"value":"KWT","text":"KUWAIT, KUWAIT CITY","label_zh":"科威特，科威特城","label_en":"KUWAIT, KUWAIT CITY","official_label":"KUWAIT, KUWAIT CITY"},{"value":"BKK","text":"KYRGYZSTAN, BISHKEK","label_zh":"吉尔吉斯斯坦，比什凯克","label_en":"KYRGYZSTAN, BISHKEK","official_label":"KYRGYZSTAN, BISHKEK"},{"value":"VNT","text":"LAOS, VIENTIANE","label_zh":"老挝，万象","label_en":"LAOS, VIENTIANE","official_label":"LAOS, VIENTIANE"},{"value":"RGA","text":"LATVIA, RIGA","label_zh":"拉脱维亚，里加","label_en":"LATVIA, RIGA","official_label":"LATVIA, RIGA"},{"value":"BRT","text":"LEBANON, BEIRUT","label_zh":"黎巴嫩，贝鲁特","label_en":"LEBANON, BEIRUT","official_label":"LEBANON, BEIRUT"},{"value":"MAS","text":"LESOTHO, MASERU","label_zh":"莱索托，马塞卢","label_en":"LESOTHO, MASERU","official_label":"LESOTHO, MASERU"},{"value":"MRV","text":"LIBERIA, MONROVIA","label_zh":"利比里亚，蒙罗维亚","label_en":"LIBERIA, MONROVIA","official_label":"LIBERIA, MONROVIA"},{"value":"VIL","text":"LITHUANIA, VILNIUS","label_zh":"立陶宛，维尔纽斯","label_en":"LITHUANIA, VILNIUS","official_label":"LITHUANIA, VILNIUS"},{"value":"LXM","text":"LUXEMBOURG, LUXEMBOURG","label_zh":"卢森堡，卢森堡","label_en":"LUXEMBOURG, LUXEMBOURG","official_label":"LUXEMBOURG, LUXEMBOURG"},{"value":"ANT","text":"MADAGASCAR, ANTANANARIVO","label_zh":"马达加斯加，塔那那利佛","label_en":"MADAGASCAR, ANTANANARIVO","official_label":"MADAGASCAR, ANTANANARIVO"},{"value":"LIL","text":"MALAWI, LILONGWE","label_zh":"马拉维，利隆圭","label_en":"MALAWI, LILONGWE","official_label":"MALAWI, LILONGWE"},{"value":"KLL","text":"MALAYSIA, KUALA LUMPUR","label_zh":"马来西亚，吉隆坡","label_en":"MALAYSIA, KUALA LUMPUR","official_label":"MALAYSIA, KUALA LUMPUR"},{"value":"BAM","text":"MALI, BAMAKO","label_zh":"马里，巴马科","label_en":"MALI, BAMAKO","official_label":"MALI, BAMAKO"},{"value":"VLL","text":"MALTA, VALLETTA","label_zh":"马耳他，瓦莱塔","label_en":"MALTA, VALLETTA","official_label":"MALTA, VALLETTA"},{"value":"MAJ","text":"MARSHALL ISLANDS, MAJURO","label_zh":"马绍尔群岛，马朱罗","label_en":"MARSHALL ISLANDS, MAJURO","official_label":"MARSHALL ISLANDS, MAJURO"},{"value":"NUK","text":"MAURITANIA, NOUAKCHOTT","label_zh":"毛里塔尼亚，努瓦克肖特","label_en":"MAURITANIA, NOUAKCHOTT","official_label":"MAURITANIA, NOUAKCHOTT"},{"value":"PTL","text":"MAURITIUS, PORT LOUIS","label_zh":"毛里求斯，路易港","label_en":"MAURITIUS, PORT LOUIS","official_label":"MAURITIUS, PORT LOUIS"},{"value":"CDJ","text":"MEXICO, CIUDAD JUAREZ","label_zh":"墨西哥，华雷斯城","label_en":"MEXICO, CIUDAD JUAREZ","official_label":"MEXICO, CIUDAD JUAREZ"},{"value":"GDL","text":"MEXICO, GUADALAJARA","label_zh":"墨西哥，瓜达拉哈拉","label_en":"MEXICO, GUADALAJARA","official_label":"MEXICO, GUADALAJARA"},{"value":"HER","text":"MEXICO, HERMOSILLO","label_zh":"墨西哥，埃莫西约","label_en":"MEXICO, HERMOSILLO","official_label":"MEXICO, HERMOSILLO"},{"value":"MTM","text":"MEXICO, MATAMOROS","label_zh":"墨西哥，马塔莫罗斯","label_en":"MEXICO, MATAMOROS","official_label":"MEXICO, MATAMOROS"},{"value":"MER","text":"MEXICO, MERIDA","label_zh":"墨西哥，梅里达","label_en":"MEXICO, MERIDA","official_label":"MEXICO, MERIDA"},{"value":"MEX","text":"MEXICO, MEXICO CITY","label_zh":"墨西哥，墨西哥城","label_en":"MEXICO, MEXICO CITY","official_label":"MEXICO, MEXICO CITY"},{"value":"MTR","text":"MEXICO, MONTERREY","label_zh":"墨西哥，蒙特雷","label_en":"MEXICO, MONTERREY","official_label":"MEXICO, MONTERREY"},{"value":"NGL","text":"MEXICO, NOGALES","label_zh":"墨西哥，诺加莱斯","label_en":"MEXICO, NOGALES","official_label":"MEXICO, NOGALES"},{"value":"NVL","text":"MEXICO, NUEVO LAREDO","label_zh":"墨西哥，新拉雷多","label_en":"MEXICO, NUEVO LAREDO","official_label":"MEXICO, NUEVO LAREDO"},{"value":"TJT","text":"MEXICO, TIJUANA","label_zh":"墨西哥，蒂华纳","label_en":"MEXICO, TIJUANA","official_label":"MEXICO, TIJUANA"},{"value":"KOL","text":"MICRONESIA, KOLONIA","label_zh":"密克罗尼西亚，科洛尼亚","label_en":"MICRONESIA, KOLONIA","official_label":"MICRONESIA, KOLONIA"},{"value":"CHS","text":"MOLDOVA, CHISINAU","label_zh":"摩尔多瓦，基希讷乌","label_en":"MOLDOVA, CHISINAU","official_label":"MOLDOVA, CHISINAU"},{"value":"ULN","text":"MONGOLIA, ULAANBAATAR","label_zh":"蒙古，乌兰巴托","label_en":"MONGOLIA, ULAANBAATAR","official_label":"MONGOLIA, ULAANBAATAR"},{"value":"POD","text":"MONTENEGRO, PODGORICA","label_zh":"黑山，波德戈里察","label_en":"MONTENEGRO, PODGORICA","official_label":"MONTENEGRO, PODGORICA"},{"value":"CSB","text":"MOROCCO, CASABLANCA","label_zh":"摩洛哥，卡萨布兰卡","label_en":"MOROCCO, CASABLANCA","official_label":"MOROCCO, CASABLANCA"},{"value":"MAP","text":"MOZAMBIQUE, MAPUTO","label_zh":"莫桑比克，马普托","label_en":"MOZAMBIQUE, MAPUTO","official_label":"MOZAMBIQUE, MAPUTO"},{"value":"WHK","text":"NAMIBIA, WINDHOEK","label_zh":"纳米比亚，温得和克","label_en":"NAMIBIA, WINDHOEK","official_label":"NAMIBIA, WINDHOEK"},{"value":"KDU","text":"NEPAL, KATHMANDU","label_zh":"尼泊尔，加德满都","label_en":"NEPAL, KATHMANDU","official_label":"NEPAL, KATHMANDU"},{"value":"AMS","text":"NETHERLANDS, AMSTERDAM","label_zh":"荷兰，阿姆斯特丹","label_en":"NETHERLANDS, AMSTERDAM","official_label":"NETHERLANDS, AMSTERDAM"},{"value":"ACK","text":"NEW ZEALAND, AUCKLAND","label_zh":"新西兰，奥克兰","label_en":"NEW ZEALAND, AUCKLAND","official_label":"NEW ZEALAND, AUCKLAND"},{"value":"MNG","text":"NICARAGUA, MANAGUA","label_zh":"尼加拉瓜，马那瓜","label_en":"NICARAGUA, MANAGUA","official_label":"NICARAGUA, MANAGUA"},{"value":"NMY","text":"NIGER, NIAMEY","label_zh":"尼日尔，尼亚美","label_en":"NIGER, NIAMEY","official_label":"NIGER, NIAMEY"},{"value":"ABU","text":"NIGERIA, ABUJA","label_zh":"尼日利亚，阿布贾","label_en":"NIGERIA, ABUJA","official_label":"NIGERIA, ABUJA"},{"value":"LGS","text":"NIGERIA, LAGOS","label_zh":"尼日利亚，拉各斯","label_en":"NIGERIA, LAGOS","official_label":"NIGERIA, LAGOS"},{"value":"SKO","text":"NORTH MACEDONIA, SKOPJE","label_zh":"北马其顿，斯科普里","label_en":"NORTH MACEDONIA, SKOPJE","official_label":"NORTH MACEDONIA, SKOPJE"},{"value":"BLF","text":"NORTHERN IRELAND, BELFAST","label_zh":"北爱尔兰，贝尔法斯特","label_en":"NORTHERN IRELAND, BELFAST","official_label":"NORTHERN IRELAND, BELFAST"},{"value":"OSL","text":"NORWAY, OSLO","label_zh":"挪威，奥斯陆","label_en":"NORWAY, OSLO","official_label":"NORWAY, OSLO"},{"value":"MST","text":"OMAN, MUSCAT","label_zh":"阿曼，马斯喀特","label_en":"OMAN, MUSCAT","official_label":"OMAN, MUSCAT"},{"value":"ISL","text":"PAKISTAN, ISLAMABAD","label_zh":"巴基斯坦，伊斯兰堡","label_en":"PAKISTAN, ISLAMABAD","official_label":"PAKISTAN, ISLAMABAD"},{"value":"KRC","text":"PAKISTAN, KARACHI","label_zh":"巴基斯坦，卡拉奇","label_en":"PAKISTAN, KARACHI","official_label":"PAKISTAN, KARACHI"},{"value":"KOR","text":"PALAU, KOROR","label_zh":"帕劳，科罗尔","label_en":"PALAU, KOROR","official_label":"PALAU, KOROR"},{"value":"PNM","text":"PANAMA, PANAMA CITY","label_zh":"巴拿马，巴拿马城","label_en":"PANAMA, PANAMA CITY","official_label":"PANAMA, PANAMA CITY"},{"value":"PTM","text":"PAPUA NEW GUINEA, PORT MORESBY","label_zh":"巴布亚新几内亚，莫尔兹比港","label_en":"PAPUA NEW GUINEA, PORT MORESBY","official_label":"PAPUA NEW GUINEA, PORT MORESBY"},{"value":"ASN","text":"PARAGUAY, ASUNCION","label_zh":"巴拉圭，亚松森","label_en":"PARAGUAY, ASUNCION","official_label":"PARAGUAY, ASUNCION"},{"value":"LMA","text":"PERU, LIMA","label_zh":"秘鲁，利马","label_en":"PERU, LIMA","official_label":"PERU, LIMA"},{"value":"MNL","text":"PHILIPPINES, MANILA","label_zh":"菲律宾，马尼拉","label_en":"PHILIPPINES, MANILA","official_label":"PHILIPPINES, MANILA"},{"value":"KRK","text":"POLAND, KRAKOW","label_zh":"波兰，克拉科夫","label_en":"POLAND, KRAKOW","official_label":"POLAND, KRAKOW"},{"value":"WRW","text":"POLAND, WARSAW","label_zh":"波兰，华沙","label_en":"POLAND, WARSAW","official_label":"POLAND, WARSAW"},{"value":"LSB","text":"PORTUGAL, LISBON","label_zh":"葡萄牙，里斯本","label_en":"PORTUGAL, LISBON","official_label":"PORTUGAL, LISBON"},{"value":"DOH","text":"QATAR, DOHA","label_zh":"卡塔尔，多哈","label_en":"QATAR, DOHA","official_label":"QATAR, DOHA"},{"value":"BCH","text":"ROMANIA, BUCHAREST","label_zh":"罗马尼亚，布加勒斯特","label_en":"ROMANIA, BUCHAREST","official_label":"ROMANIA, BUCHAREST"},{"value":"MOS","text":"RUSSIA, MOSCOW","label_zh":"俄罗斯，莫斯科","label_en":"RUSSIA, MOSCOW","official_label":"RUSSIA, MOSCOW"},{"value":"KGL","text":"RWANDA, KIGALI","label_zh":"卢旺达，基加利","label_en":"RWANDA, KIGALI","official_label":"RWANDA, KIGALI"},{"value":"APA","text":"SAMOA, APIA","label_zh":"萨摩亚，阿皮亚","label_en":"SAMOA, APIA","official_label":"SAMOA, APIA"},{"value":"DHR","text":"SAUDI ARABIA, DHAHRAN","label_zh":"沙特阿拉伯，宰赫兰","label_en":"SAUDI ARABIA, DHAHRAN","official_label":"SAUDI ARABIA, DHAHRAN"},{"value":"JDD","text":"SAUDI ARABIA, JEDDAH","label_zh":"沙特阿拉伯，吉达","label_en":"SAUDI ARABIA, JEDDAH","official_label":"SAUDI ARABIA, JEDDAH"},{"value":"RID","text":"SAUDI ARABIA, RIYADH","label_zh":"沙特阿拉伯，利雅得","label_en":"SAUDI ARABIA, RIYADH","official_label":"SAUDI ARABIA, RIYADH"},{"value":"DKR","text":"SENEGAL, DAKAR","label_zh":"塞内加尔，达喀尔","label_en":"SENEGAL, DAKAR","official_label":"SENEGAL, DAKAR"},{"value":"BLG","text":"SERBIA, BELGRADE","label_zh":"塞尔维亚，贝尔格莱德","label_en":"SERBIA, BELGRADE","official_label":"SERBIA, BELGRADE"},{"value":"FTN","text":"SIERRA LEONE, FREETOWN","label_zh":"塞拉利昂，弗里敦","label_en":"SIERRA LEONE, FREETOWN","official_label":"SIERRA LEONE, FREETOWN"},{"value":"SGP","text":"SINGAPORE, SINGAPORE","label_zh":"新加坡，新加坡","label_en":"SINGAPORE, SINGAPORE","official_label":"SINGAPORE, SINGAPORE"},{"value":"BTS","text":"SLOVAKIA, BRATISLAVA","label_zh":"斯洛伐克，布拉迪斯拉发","label_en":"SLOVAKIA, BRATISLAVA","official_label":"SLOVAKIA, BRATISLAVA"},{"value":"LJU","text":"SLOVENIA, LJUBLJANA","label_zh":"斯洛文尼亚，卢布尔雅那","label_en":"SLOVENIA, LJUBLJANA","official_label":"SLOVENIA, LJUBLJANA"},{"value":"CPT","text":"SOUTH AFRICA, CAPE TOWN","label_zh":"南非，开普敦","label_en":"SOUTH AFRICA, CAPE TOWN","official_label":"SOUTH AFRICA, CAPE TOWN"},{"value":"DRB","text":"SOUTH AFRICA, DURBAN","label_zh":"南非，德班","label_en":"SOUTH AFRICA, DURBAN","official_label":"SOUTH AFRICA, DURBAN"},{"value":"JHN","text":"SOUTH AFRICA, JOHANNESBURG","label_zh":"南非，约翰内斯堡","label_en":"SOUTH AFRICA, JOHANNESBURG","official_label":"SOUTH AFRICA, JOHANNESBURG"},{"value":"SEO","text":"SOUTH KOREA, SEOUL","label_zh":"韩国，首尔","label_en":"SOUTH KOREA, SEOUL","official_label":"SOUTH KOREA, SEOUL"},{"value":"JBA","text":"SOUTH SUDAN, JUBA","label_zh":"南苏丹，朱巴","label_en":"SOUTH SUDAN, JUBA","official_label":"SOUTH SUDAN, JUBA"},{"value":"MDD","text":"SPAIN, MADRID","label_zh":"西班牙，马德里","label_en":"SPAIN, MADRID","official_label":"SPAIN, MADRID"},{"value":"CLM","text":"SRI LANKA, COLOMBO","label_zh":"斯里兰卡，科伦坡","label_en":"SRI LANKA, COLOMBO","official_label":"SRI LANKA, COLOMBO"},{"value":"PRM","text":"SURINAME, PARAMARIBO","label_zh":"苏里南，帕拉马里博","label_en":"SURINAME, PARAMARIBO","official_label":"SURINAME, PARAMARIBO"},{"value":"STK","text":"SWEDEN, STOCKHOLM","label_zh":"瑞典，斯德哥尔摩","label_en":"SWEDEN, STOCKHOLM","official_label":"SWEDEN, STOCKHOLM"},{"value":"BEN","text":"SWITZERLAND, BERN","label_zh":"瑞士，伯尔尼","label_en":"SWITZERLAND, BERN","official_label":"SWITZERLAND, BERN"},{"value":"TAI","text":"TAIWAN, TAIPEI","label_zh":"台湾，台北","label_en":"TAIWAN, TAIPEI","official_label":"TAIWAN, TAIPEI"},{"value":"DHB","text":"TAJIKISTAN, DUSHANBE","label_zh":"塔吉克斯坦，杜尚别","label_en":"TAJIKISTAN, DUSHANBE","official_label":"TAJIKISTAN, DUSHANBE"},{"value":"DRS","text":"TANZANIA, DAR ES SALAAM","label_zh":"坦桑尼亚，达累斯萨拉姆","label_en":"TANZANIA, DAR ES SALAAM","official_label":"TANZANIA, DAR ES SALAAM"},{"value":"BNK","text":"THAILAND, BANGKOK","label_zh":"泰国，曼谷","label_en":"THAILAND, BANGKOK","official_label":"THAILAND, BANGKOK"},{"value":"CHN","text":"THAILAND, CHIANG MAI","label_zh":"泰国，清迈","label_en":"THAILAND, CHIANG MAI","official_label":"THAILAND, CHIANG MAI"},{"value":"DIL","text":"TIMOR LESTE, DILI","label_zh":"东帝汶，帝力","label_en":"TIMOR LESTE, DILI","official_label":"TIMOR LESTE, DILI"},{"value":"LOM","text":"TOGO, LOME","label_zh":"多哥，洛美","label_en":"TOGO, LOME","official_label":"TOGO, LOME"},{"value":"PTS","text":"TRINIDAD, PORT OF SPAIN","label_zh":"特立尼达和多巴哥，西班牙港","label_en":"TRINIDAD, PORT OF SPAIN","official_label":"TRINIDAD, PORT OF SPAIN"},{"value":"TNS","text":"TUNISIA, TUNIS","label_zh":"突尼斯，突尼斯","label_en":"TUNISIA, TUNIS","official_label":"TUNISIA, TUNIS"},{"value":"ANK","text":"TURKEY, ANKARA","label_zh":"土耳其，安卡拉","label_en":"TURKEY, ANKARA","official_label":"TURKEY, ANKARA"},{"value":"IST","text":"TURKEY, ISTANBUL","label_zh":"土耳其，伊斯坦布尔","label_en":"TURKEY, ISTANBUL","official_label":"TURKEY, ISTANBUL"},{"value":"AKD","text":"TURKMENISTAN, ASHGABAT","label_zh":"土库曼斯坦，阿什哈巴德","label_en":"TURKMENISTAN, ASHGABAT","official_label":"TURKMENISTAN, ASHGABAT"},{"value":"KMP","text":"UGANDA, KAMPALA","label_zh":"乌干达，坎帕拉","label_en":"UGANDA, KAMPALA","official_label":"UGANDA, KAMPALA"},{"value":"KEV","text":"UKRAINE, KYIV","label_zh":"乌克兰，基辅","label_en":"UKRAINE, KYIV","official_label":"UKRAINE, KYIV"},{"value":"ABD","text":"UNITED ARAB EMIRATES, ABU DHABI","label_zh":"阿拉伯联合酋长国，阿布扎比","label_en":"UNITED ARAB EMIRATES, ABU DHABI","official_label":"UNITED ARAB EMIRATES, ABU DHABI"},{"value":"DUB","text":"UNITED ARAB EMIRATES, DUBAI","label_zh":"阿拉伯联合酋长国，迪拜","label_en":"UNITED ARAB EMIRATES, DUBAI","official_label":"UNITED ARAB EMIRATES, DUBAI"},{"value":"MTV","text":"URUGUAY, MONTEVIDEO","label_zh":"乌拉圭，蒙得维的亚","label_en":"URUGUAY, MONTEVIDEO","official_label":"URUGUAY, MONTEVIDEO"},{"value":"THT","text":"UZBEKISTAN, TASHKENT","label_zh":"乌兹别克斯坦，塔什干","label_en":"UZBEKISTAN, TASHKENT","official_label":"UZBEKISTAN, TASHKENT"},{"value":"HAN","text":"VIETNAM, HANOI","label_zh":"越南，河内","label_en":"VIETNAM, HANOI","official_label":"VIETNAM, HANOI"},{"value":"HCM","text":"VIETNAM, HO CHI MINH CITY","label_zh":"越南，胡志明市","label_en":"VIETNAM, HO CHI MINH CITY","official_label":"VIETNAM, HO CHI MINH CITY"},{"value":"LUS","text":"ZAMBIA, LUSAKA","label_zh":"赞比亚，卢萨卡","label_en":"ZAMBIA, LUSAKA","official_label":"ZAMBIA, LUSAKA"},{"value":"HRE","text":"ZIMBABWE, HARARE","label_zh":"津巴布韦，哈拉雷","label_en":"ZIMBABWE, HARARE","official_label":"ZIMBABWE, HARARE"}]'::jsonb,
    updated_at = now()
WHERE visa_type = 'DS160'
  AND field_name = 'consular_post';
