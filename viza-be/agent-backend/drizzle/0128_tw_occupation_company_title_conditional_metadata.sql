-- Idempotent metadata-only correction for Taiwan occupation-dependent
-- company_name and job_title visibility/requiredness.
--
-- Scope:
--   * public.visa_form_fields rows where visa_type = 'TW_ENTRY_PERMIT'
--     and field_name IN ('company_name', 'job_title') only.
--   * Converts the fields from unconditional required to conditionally
--     visible/required based on the official current_occupation code:
--       student = 14, unemployed/job-seeking = 61, retired = 62.
--
-- User-confirmed local official-page evidence, 2026-08-04:
--   * current_occupation = 14 (學生): job_title hidden/not required;
--     company_name remains visible/required.
--   * current_occupation = 61 (待業): company_name and job_title both
--     hidden/not required.
--   * current_occupation = 62 (退休): company_name and job_title both
--     hidden/not required.
--   * Other current_occupation values: company_name and job_title remain
--     visible/required.
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
--   WHERE visa_type = 'TW_ENTRY_PERMIT'
--     AND field_name IN ('company_name', 'job_title')
--   ORDER BY field_name;
--
-- Post-flight verification SQL:
--   SELECT
--     field_name,
--     required = true AS required_default_ok,
--     CASE field_name
--       WHEN 'company_name' THEN validation_rules->>'required_when' = 'current_occupation not in [61,62]'
--       WHEN 'job_title' THEN validation_rules->>'required_when' = 'current_occupation not in [14,61,62]'
--       ELSE false
--     END AS required_when_ok,
--     CASE field_name
--       WHEN 'company_name' THEN conditional_logic->>'showIf' = 'current_occupation not in [61,62]'
--       WHEN 'job_title' THEN conditional_logic->>'showIf' = 'current_occupation not in [14,61,62]'
--       ELSE false
--     END AS show_if_ok
--   FROM public.visa_form_fields
--   WHERE visa_type = 'TW_ENTRY_PERMIT'
--     AND field_name IN ('company_name', 'job_title')
--   ORDER BY field_name;
--
-- Rollback SQL (metadata only, if explicitly authorized):
--   UPDATE public.visa_form_fields
--   SET conditional_logic = NULL,
--       validation_rules = jsonb_strip_nulls(validation_rules - 'required_when')
--   WHERE visa_type = 'TW_ENTRY_PERMIT'
--     AND field_name IN ('company_name', 'job_title');

WITH target_fields (
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
      'company_name',
      'Company name and full organization/unit name or school name',
      'text',
      true,
      2,
      'Applicant Identity',
      15,
      NULL::text,
      '{"required_when":"current_occupation not in [61,62]","note":"User-confirmed local official-page evidence: hidden/not required when current_occupation is 待業(61) or 退休(62); still visible/required for 學生(14) and ordinary occupations.","label_en":"Company name and full organization/unit name or school name","official_label_en":"Company name and full organization/unit name or school name"}'::jsonb,
      NULL::jsonb,
      '{"showIf":"current_occupation not in [61,62]"}'::jsonb
    ),
    (
      'TW_ENTRY_PERMIT',
      'job_title',
      'Job title',
      'text',
      true,
      2,
      'Applicant Identity',
      16,
      NULL::text,
      '{"required_when":"current_occupation not in [14,61,62]","note":"User-confirmed local official-page evidence: hidden/not required for 學生(14), 待業(61), and 退休(62); visible/required for ordinary occupations.","label_en":"Job title","official_label_en":"Job title"}'::jsonb,
      NULL::jsonb,
      '{"showIf":"current_occupation not in [14,61,62]"}'::jsonb
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
  FROM target_fields
  WHERE visa_type = 'TW_ENTRY_PERMIT'
    AND field_name IN ('company_name', 'job_title')
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
SELECT count(*) AS tw_occupation_company_title_metadata_rows_upserted
FROM upserted;
