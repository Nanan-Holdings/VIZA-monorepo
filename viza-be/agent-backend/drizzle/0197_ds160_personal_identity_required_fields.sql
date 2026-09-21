-- Align DS-160 Personal Information 1 and 2 with CEAC's Next validation.
-- Native-alphabet full name, birth state/province, national ID, SSN, U.S.
-- taxpayer ID and active other-nationality passport controls are required;
-- existing validation_rules continue to permit explicit Does Not Apply values
-- where CEAC provides that checkbox. The passport number max length mirrors
-- the current CEAC control. Existing field IDs and applicant answers remain.

UPDATE public.visa_form_fields
SET
  required = TRUE,
  validation_rules = CASE field_name
    WHEN 'full_name_native_alphabet' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":100}'::jsonb
    WHEN 'other_surname' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":33}'::jsonb
    WHEN 'other_given_names' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":33}'::jsonb
    WHEN 'city_of_birth' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":20}'::jsonb
    WHEN 'state_of_birth' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":20}'::jsonb
    WHEN 'other_nationality_passport_number' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":20}'::jsonb
    WHEN 'national_id_number' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":20}'::jsonb
    WHEN 'us_taxpayer_id' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":20}'::jsonb
    ELSE validation_rules
  END,
  updated_at = now()
WHERE visa_type = 'DS160'
  AND field_name IN (
    'full_name_native_alphabet',
    'other_surname',
    'other_given_names',
    'city_of_birth',
    'state_of_birth',
    'other_nationality_has_passport',
    'other_nationality_passport_number',
    'national_id_number',
    'us_social_security_number',
    'us_taxpayer_id'
  );
