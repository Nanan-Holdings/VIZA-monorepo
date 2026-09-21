-- Align the confirmed DS-160 Travel Information branches with CEAC Next.
-- This changes only confirmed required flags, text limits and the relationship
-- option set; conditional_logic, repeat-group membership, and existing Does
-- Not Apply rules are preserved.

UPDATE public.visa_form_fields
SET
  required = CASE field_name
    WHEN 'arrival_date' THEN TRUE
    WHEN 'arrival_city' THEN TRUE
    WHEN 'departure_date' THEN TRUE
    WHEN 'departure_city' THEN TRUE
    WHEN 'planned_location' THEN TRUE
    WHEN 'us_address_street1' THEN TRUE
    WHEN 'us_address_city' THEN TRUE
    WHEN 'us_address_state' THEN TRUE
    WHEN 'payer_surname' THEN TRUE
    WHEN 'payer_given_names' THEN TRUE
    WHEN 'payer_phone' THEN TRUE
    WHEN 'payer_email' THEN TRUE
    WHEN 'payer_relationship' THEN TRUE
    WHEN 'payer_address_same_as_home' THEN TRUE
    WHEN 'payer_address_street1' THEN TRUE
    WHEN 'payer_address_city' THEN TRUE
    WHEN 'payer_address_state' THEN TRUE
    WHEN 'payer_address_postal' THEN TRUE
    WHEN 'payer_address_country' THEN TRUE
    WHEN 'payer_org_name' THEN TRUE
    WHEN 'payer_org_phone' THEN TRUE
    WHEN 'payer_org_relationship' THEN TRUE
    WHEN 'payer_org_address_street1' THEN TRUE
    WHEN 'payer_org_address_city' THEN TRUE
    WHEN 'payer_org_address_state' THEN TRUE
    WHEN 'payer_org_address_postal' THEN TRUE
    WHEN 'payer_org_address_country' THEN TRUE
    WHEN 'companion_group_travel' THEN TRUE
    WHEN 'companion_group_name' THEN TRUE
    WHEN 'companion_surname' THEN TRUE
    WHEN 'companion_given_names' THEN TRUE
    WHEN 'companion_relationship' THEN TRUE
    ELSE required
  END,
  validation_rules = CASE field_name
    WHEN 'intended_length_of_stay_value' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":3}'::jsonb
    WHEN 'arrival_flight' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":20}'::jsonb
    WHEN 'arrival_city' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":20}'::jsonb
    WHEN 'departure_flight' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":20}'::jsonb
    WHEN 'departure_city' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":20}'::jsonb
    WHEN 'planned_location' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":40}'::jsonb
    WHEN 'us_address_street1' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":40}'::jsonb
    WHEN 'us_address_street2' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":40}'::jsonb
    WHEN 'us_address_city' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":20}'::jsonb
    WHEN 'us_address_zip' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":10}'::jsonb
    WHEN 'payer_surname' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":33}'::jsonb
    WHEN 'payer_given_names' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":33}'::jsonb
    WHEN 'payer_phone' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":15}'::jsonb
    WHEN 'payer_email' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":50}'::jsonb
    WHEN 'payer_address_street1' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":40}'::jsonb
    WHEN 'payer_address_street2' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":40}'::jsonb
    WHEN 'payer_address_city' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":20}'::jsonb
    WHEN 'payer_address_state' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":20}'::jsonb
    WHEN 'payer_address_postal' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":10}'::jsonb
    WHEN 'payer_org_name' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":33}'::jsonb
    WHEN 'payer_org_phone' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":15}'::jsonb
    WHEN 'payer_org_address_street1' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":40}'::jsonb
    WHEN 'payer_org_address_street2' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":40}'::jsonb
    WHEN 'payer_org_address_city' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":20}'::jsonb
    WHEN 'payer_org_address_state' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":20}'::jsonb
    WHEN 'payer_org_address_postal' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"maxLength":10}'::jsonb
    ELSE validation_rules
  END,
  options = CASE field_name
    WHEN 'companion_relationship' THEN
      '[{"value":"PARENT","text":"PARENT"},{"value":"SPOUSE","text":"SPOUSE"},{"value":"CHILD","text":"CHILD"},{"value":"OTHER RELATIVE","text":"OTHER RELATIVE"},{"value":"FRIEND","text":"FRIEND"},{"value":"BUSINESS ASSOCIATE","text":"BUSINESS ASSOCIATE"},{"value":"OTHER","text":"OTHER"}]'::jsonb
    ELSE options
  END,
  updated_at = now()
WHERE visa_type = 'DS160'
  AND field_name IN (
    'intended_length_of_stay_value',
    'arrival_date',
    'arrival_flight',
    'arrival_city',
    'departure_date',
    'departure_flight',
    'departure_city',
    'planned_location',
    'us_address_street1',
    'us_address_street2',
    'us_address_city',
    'us_address_state',
    'us_address_zip',
    'payer_surname',
    'payer_given_names',
    'payer_phone',
    'payer_email',
    'payer_relationship',
    'payer_address_same_as_home',
    'payer_address_street1',
    'payer_address_street2',
    'payer_address_city',
    'payer_address_state',
    'payer_address_postal',
    'payer_address_country',
    'payer_org_name',
    'payer_org_phone',
    'payer_org_relationship',
    'payer_org_address_street1',
    'payer_org_address_street2',
    'payer_org_address_city',
    'payer_org_address_state',
    'payer_org_address_postal',
    'payer_org_address_country',
    'companion_group_travel',
    'companion_group_name',
    'companion_surname',
    'companion_given_names',
    'companion_relationship'
  );
