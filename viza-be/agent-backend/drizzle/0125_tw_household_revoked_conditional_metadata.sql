-- Idempotent metadata-only correction for Taiwan household_revoked.
--
-- Scope:
--   * public.visa_form_fields row where visa_type = 'TW_ENTRY_PERMIT'
--     and field_name = 'household_revoked' only.
--   * Converts the field from unconditional required to conditional
--     show/required:
--       eligibility_category === 2 AND embassy_office in [50, 51]
--
-- Official DOM evidence:
--   * name="householdRevoked" inside #household-revoked-div.
--   * Official script shows the div only when traveller.applyQualification
--     is "5" and overseaOfficeId is "50" or "51".
--   * VIZA maps eligibility_category "2" to official qualification "5";
--     embassy_office "50"/"51" are Hong Kong/Macau offices.
--
-- Safety:
--   * No DELETE statements.
--   * Does not touch application answers, documents, queues, packages, users,
--     payments, runner state, OTP, CAPTCHA, cookies, or uploaded files.
--   * Existing field id and created_at are preserved by ON CONFLICT.
--
-- Pre-flight verification SQL (read-only):
--   SELECT visa_type, field_name, required, validation_rules, conditional_logic
--   FROM public.visa_form_fields
--   WHERE visa_type = 'TW_ENTRY_PERMIT' AND field_name = 'household_revoked';
--
-- Post-flight verification SQL:
--   SELECT
--     required = false AS required_is_conditional,
--     validation_rules->>'required_when' = 'eligibility_category === 2 && embassy_office in [50, 51]' AS required_when_ok,
--     conditional_logic->>'showIf' = 'eligibility_category === 2 && embassy_office in [50, 51]' AS show_if_ok
--   FROM public.visa_form_fields
--   WHERE visa_type = 'TW_ENTRY_PERMIT' AND field_name = 'household_revoked';
--
-- Rollback SQL (metadata only, if explicitly authorized):
--   UPDATE public.visa_form_fields
--   SET required = true,
--       conditional_logic = NULL,
--       validation_rules = jsonb_strip_nulls(validation_rules - 'required_when')
--   WHERE visa_type = 'TW_ENTRY_PERMIT' AND field_name = 'household_revoked';

WITH target_field (
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
) AS (
  VALUES
    (
      'TW_ENTRY_PERMIT',
      'household_revoked',
      'Current mainland household registration status',
      'radio',
      false,
      1,
      'Photo & Basic Status',
      5,
      NULL::text,
      '{"required_when":"eligibility_category === 2 && embassy_office in [50, 51]","official_dom_name":"householdRevoked","official_values":{"no":"N","yes":"Y"},"note":"Official DOM hides #household-revoked-div unless applyQualification=5 (VIZA eligibility_category=2) and overseaOfficeId is 50/51 (HK/Macau office).","label_en":"Current mainland household registration status","official_label_en":"Current mainland household registration status"}'::jsonb,
      '[{"value":"no","text":"Not revoked, or revoked but have not yet obtained a Hong Kong/Macau passport","label_zh":"未注销户口登记，或已注销户口登记但尚未取得香港、澳门护照","official_label":"未註銷戶口登記/已註銷戶口登記，但尚未取得香港、澳門護照","label_en":"Not revoked, or revoked but have not yet obtained a Hong Kong/Macau passport"},{"value":"yes","text":"Revoked","label_zh":"已注销户口登记","official_label":"已註銷戶口登記","label_en":"Revoked"}]'::jsonb,
      '{"showIf":"eligibility_category === 2 && embassy_office in [50, 51]"}'::jsonb
    )
),
upserted AS (
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
  SELECT
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
  FROM target_field
  WHERE visa_type = 'TW_ENTRY_PERMIT'
    AND field_name = 'household_revoked'
  ON CONFLICT (visa_type, field_name) DO UPDATE SET
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
    updated_at = now()
  RETURNING field_name
)
SELECT count(*) AS tw_household_revoked_metadata_rows_upserted
FROM upserted;
