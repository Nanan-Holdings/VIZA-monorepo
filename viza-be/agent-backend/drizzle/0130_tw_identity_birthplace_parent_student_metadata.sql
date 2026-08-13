-- Idempotent metadata-only correction for Taiwan identity, birthplace,
-- parent details, and student school-name contracts.
--
-- Scope:
--   * public.visa_form_fields rows where visa_type = 'TW_ENTRY_PERMIT'
--     and field_name is one of the target fields below only.
--   * Synchronizes:
--       - name_chinese validation metadata.
--       - birth_place_mainland_region mainland branch required metadata.
--       - father/mother details required when status is 存 (code 1).
--       - father/mother address required when status is 存 and same-address
--         helper is not selected.
--       - father/mother service unit/title required for living parents except
--         自由業(15), 其他業(16), 無(17); 退休(62) still requires prior detail.
--       - company_name student school-name metadata for current_occupation=14.
--
-- Safety:
--   * No DELETE statements.
--   * Does not touch application answers, documents, queues, packages, users,
--     payments, runner state, OTP, CAPTCHA, cookies, or uploaded files.
--   * Existing field id and created_at are preserved by ON CONFLICT.
--
-- Pre-flight verification SQL (read-only):
--   SELECT field_name, required, validation_rules, conditional_logic
--   FROM public.visa_form_fields
--   WHERE visa_type = 'TW_ENTRY_PERMIT'
--     AND field_name IN (
--       'name_chinese',
--       'birth_place_mainland_region',
--       'company_name',
--       'kin_father_name',
--       'kin_father_date_of_birth',
--       'kin_father_phone',
--       'kin_father_occupation',
--       'kin_father_service_unit',
--       'kin_father_job_title',
--       'kin_father_current_address_same_as_overseas',
--       'kin_father_current_address',
--       'kin_mother_name',
--       'kin_mother_date_of_birth',
--       'kin_mother_phone',
--       'kin_mother_occupation',
--       'kin_mother_service_unit',
--       'kin_mother_job_title',
--       'kin_mother_current_address_same_as_overseas',
--       'kin_mother_current_address'
--     )
--   ORDER BY step_number, display_order, field_name;
--
-- Post-flight verification SQL:
--   SELECT
--     bool_and(visa_type = 'TW_ENTRY_PERMIT') AS only_tw_entry_permit,
--     count(*) = 19 AS target_row_count,
--     bool_or(field_name = 'name_chinese'
--       AND validation_rules->>'requires_traditional_chinese_name' = 'true'
--       AND validation_rules->>'disallow_latin_only' = 'true'
--       AND validation_rules->>'disallow_latin_replacement' = 'true') AS name_chinese_ok,
--     bool_or(field_name = 'birth_place_mainland_region'
--       AND validation_rules->>'required_when' = 'birth_place_is_mainland === mainland'
--       AND conditional_logic->>'showIf' = 'birth_place_is_mainland === mainland') AS mainland_birthplace_ok,
--     bool_or(field_name = 'company_name'
--       AND validation_rules->>'student_school_name_required_when' = 'current_occupation === 14'
--       AND validation_rules->'accepted_scripts_when_student' ? 'traditional_chinese'
--       AND validation_rules->'accepted_scripts_when_student' ? 'english') AS student_school_ok,
--     bool_and(
--       CASE
--         WHEN field_name IN (
--           'kin_father_name','kin_father_date_of_birth','kin_father_phone','kin_father_occupation'
--         ) THEN validation_rules->>'required_when' = 'kin_father_status === 1'
--         WHEN field_name IN (
--           'kin_mother_name','kin_mother_date_of_birth','kin_mother_phone','kin_mother_occupation'
--         ) THEN validation_rules->>'required_when' = 'kin_mother_status === 1'
--         WHEN field_name = 'kin_father_current_address'
--           THEN validation_rules->>'required_when' = 'kin_father_status === 1 && kin_father_current_address_same_as_overseas === false'
--         WHEN field_name = 'kin_mother_current_address'
--           THEN validation_rules->>'required_when' = 'kin_mother_status === 1 && kin_mother_current_address_same_as_overseas === false'
--         WHEN field_name IN ('kin_father_service_unit','kin_father_job_title')
--           THEN validation_rules->>'required_when' = 'kin_father_status === 1 && kin_father_occupation not in [15,16,17]'
--         WHEN field_name IN ('kin_mother_service_unit','kin_mother_job_title')
--           THEN validation_rules->>'required_when' = 'kin_mother_status === 1 && kin_mother_occupation not in [15,16,17]'
--         ELSE true
--       END
--     ) AS parent_conditions_ok
--   FROM public.visa_form_fields
--   WHERE visa_type = 'TW_ENTRY_PERMIT'
--     AND field_name IN (
--       'name_chinese',
--       'birth_place_mainland_region',
--       'company_name',
--       'kin_father_name',
--       'kin_father_date_of_birth',
--       'kin_father_phone',
--       'kin_father_occupation',
--       'kin_father_service_unit',
--       'kin_father_job_title',
--       'kin_father_current_address_same_as_overseas',
--       'kin_father_current_address',
--       'kin_mother_name',
--       'kin_mother_date_of_birth',
--       'kin_mother_phone',
--       'kin_mother_occupation',
--       'kin_mother_service_unit',
--       'kin_mother_job_title',
--       'kin_mother_current_address_same_as_overseas',
--       'kin_mother_current_address'
--     );
--
-- Rollback SQL (metadata only, if explicitly authorized):
--   UPDATE public.visa_form_fields
--   SET validation_rules = jsonb_strip_nulls(
--         validation_rules
--         - 'requires_traditional_chinese_name'
--         - 'disallow_latin_only'
--         - 'disallow_latin_replacement'
--         - 'student_school_name_required_when'
--         - 'accepted_scripts_when_student'
--         - 'occupation_codes_not_required'
--         - 'retired_code_requires_prior_detail'
--         - 'required_when'
--       ),
--       conditional_logic = CASE
--         WHEN field_name IN ('birth_place_mainland_region', 'company_name') THEN conditional_logic
--         ELSE NULL
--       END
--   WHERE visa_type = 'TW_ENTRY_PERMIT'
--     AND field_name IN (
--       'name_chinese',
--       'birth_place_mainland_region',
--       'company_name',
--       'kin_father_name',
--       'kin_father_date_of_birth',
--       'kin_father_phone',
--       'kin_father_occupation',
--       'kin_father_service_unit',
--       'kin_father_job_title',
--       'kin_father_current_address_same_as_overseas',
--       'kin_father_current_address',
--       'kin_mother_name',
--       'kin_mother_date_of_birth',
--       'kin_mother_phone',
--       'kin_mother_occupation',
--       'kin_mother_service_unit',
--       'kin_mother_job_title',
--       'kin_mother_current_address_same_as_overseas',
--       'kin_mother_current_address'
--     );

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
      'name_chinese',
      'Name in Chinese (traditional characters)',
      'text',
      true,
      2,
      'Applicant Identity',
      1,
      NULL::text,
      '{"official_dom_name":"traveller.chineseName","requires_traditional_chinese_name":true,"disallow_latin_only":true,"disallow_latin_replacement":true,"note":"Official field requires the applicant''s real Chinese name in Traditional Chinese characters; a non-empty Latin placeholder or passport English name is not acceptable.","label_en":"Name in Chinese (traditional characters)","official_label_en":"Name in Chinese (traditional characters)"}'::jsonb,
      NULL::jsonb,
      NULL::jsonb
    ),
    (
      'TW_ENTRY_PERMIT',
      'birth_place_mainland_region',
      'Mainland China birth province/city/region',
      'select',
      true,
      2,
      'Applicant Identity',
      11,
      NULL::text,
      '{"required_when":"birth_place_is_mainland === mainland","official_dom_name":"traveller.birthPlace1","branch_for":"birth_place_is_mainland === mainland","source":"BIRTH_PLACE_MAINLAND_OPTIONS","note":"Required second-level province/city/region select when birth_place_is_mainland is 中國大陸.","label_en":"Mainland China birth province/city/region","official_label_en":"Mainland China birth province/city/region"}'::jsonb,
      NULL::jsonb,
      '{"showIf":"birth_place_is_mainland === mainland"}'::jsonb
    ),
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
      '{"required_when":"current_occupation not in [61,62]","student_school_name_required_when":"current_occupation === 14","accepted_scripts_when_student":["traditional_chinese","english"],"note":"When current_occupation is 學生(14), this field remains required and must be the official full school name in Traditional Chinese or English; do not use an informal abbreviation.","label_en":"Company name and full organization/unit name or school name","official_label_en":"Company name and full organization/unit name or school name"}'::jsonb,
      NULL::jsonb,
      '{"showIf":"current_occupation not in [61,62]"}'::jsonb
    ),
    (
      'TW_ENTRY_PERMIT',
      'kin_father_name',
      'Father (父) — Name',
      'text',
      true,
      5,
      'Kinship Information',
      2,
      NULL::text,
      '{"block_group":"kin_father","required_when":"kin_father_status === 1","note":"Official screenshot evidence: Father (父) name is required when existence/status is 存.","label_en":"Father (父) — Name","official_label_en":"Father (父) — Name"}'::jsonb,
      NULL::jsonb,
      '{"showIf":"kin_father_status === 1"}'::jsonb
    ),
    (
      'TW_ENTRY_PERMIT',
      'kin_father_date_of_birth',
      'Father (父) — Date of birth',
      'date',
      true,
      5,
      'Kinship Information',
      3,
      NULL::text,
      '{"block_group":"kin_father","required_when":"kin_father_status === 1","note":"Official screenshot evidence: Father (父) date of birth is required when existence/status is 存.","label_en":"Father (父) — Date of birth","official_label_en":"Father (父) — Date of birth"}'::jsonb,
      NULL::jsonb,
      '{"showIf":"kin_father_status === 1"}'::jsonb
    ),
    (
      'TW_ENTRY_PERMIT',
      'kin_father_phone',
      'Father (父) — Phone',
      'text',
      true,
      5,
      'Kinship Information',
      4,
      NULL::text,
      '{"block_group":"kin_father","required_when":"kin_father_status === 1","note":"Official screenshot evidence: Father (父) phone is required when existence/status is 存.","label_en":"Father (父) — Phone","official_label_en":"Father (父) — Phone"}'::jsonb,
      NULL::jsonb,
      '{"showIf":"kin_father_status === 1"}'::jsonb
    ),
    (
      'TW_ENTRY_PERMIT',
      'kin_father_occupation',
      'Father (父) — Occupation',
      'select',
      true,
      5,
      'Kinship Information',
      5,
      NULL::text,
      '{"block_group":"kin_father","required_when":"kin_father_status === 1","note":"Official screenshot evidence: Father (父) occupation is required when existence/status is 存.","label_en":"Father (父) — Occupation","official_label_en":"Father (父) — Occupation"}'::jsonb,
      NULL::jsonb,
      '{"showIf":"kin_father_status === 1"}'::jsonb
    ),
    (
      'TW_ENTRY_PERMIT',
      'kin_father_service_unit',
      'Father (父) — Employer / unit',
      'text',
      true,
      5,
      'Kinship Information',
      6,
      'Required for employed occupations and retired-before unit; not required for Freelance/Other/None',
      '{"block_group":"kin_father","required_when":"kin_father_status === 1 && kin_father_occupation not in [15,16,17]","occupation_codes_not_required":["15","16","17"],"retired_code_requires_prior_detail":"62","note":"For parents marked 存, official occupation codes 自由業(15)、其他業(16)、無(17) do not require unit/title detail; 退休(62) requires retired-before unit/title.","label_en":"Father (父) — Employer / unit","official_label_en":"Father (父) — Employer / unit","placeholder_en":"Required for employed occupations and retired-before unit; not required for Freelance/Other/None"}'::jsonb,
      NULL::jsonb,
      '{"showIf":"kin_father_status === 1 && kin_father_occupation not in [15,16,17]"}'::jsonb
    ),
    (
      'TW_ENTRY_PERMIT',
      'kin_father_job_title',
      'Father (父) — Job title',
      'text',
      true,
      5,
      'Kinship Information',
      7,
      NULL::text,
      '{"block_group":"kin_father","required_when":"kin_father_status === 1 && kin_father_occupation not in [15,16,17]","occupation_codes_not_required":["15","16","17"],"retired_code_requires_prior_detail":"62","note":"For parents marked 存, official occupation codes 自由業(15)、其他業(16)、無(17) do not require unit/title detail; 退休(62) requires retired-before unit/title.","label_en":"Father (父) — Job title","official_label_en":"Father (父) — Job title"}'::jsonb,
      NULL::jsonb,
      '{"showIf":"kin_father_status === 1 && kin_father_occupation not in [15,16,17]"}'::jsonb
    ),
    (
      'TW_ENTRY_PERMIT',
      'kin_father_current_address_same_as_overseas',
      'Father (父) — Current address same as applicant''s overseas address',
      'checkbox',
      false,
      5,
      'Kinship Information',
      8,
      NULL::text,
      '{"block_group":"kin_father","note":"Mirrors the portal''s 同申請人海外地址 quick-fill button; current address is otherwise required when father status is 存.","label_en":"Father (父) — Current address same as applicant''s overseas address","official_label_en":"Father (父) — Current address same as applicant''s overseas address"}'::jsonb,
      NULL::jsonb,
      '{"showIf":"kin_father_status === 1"}'::jsonb
    ),
    (
      'TW_ENTRY_PERMIT',
      'kin_father_current_address',
      'Father (父) — Current address',
      'textarea',
      true,
      5,
      'Kinship Information',
      9,
      NULL::text,
      '{"block_group":"kin_father","required_when":"kin_father_status === 1 && kin_father_current_address_same_as_overseas === false","note":"Official screenshot evidence: parent current address is required when existence/status is 存, unless the same-as-applicant address helper is used.","label_en":"Father (父) — Current address","official_label_en":"Father (父) — Current address"}'::jsonb,
      NULL::jsonb,
      '{"showIf":"kin_father_status === 1 && kin_father_current_address_same_as_overseas === false"}'::jsonb
    ),
    (
      'TW_ENTRY_PERMIT',
      'kin_mother_name',
      'Mother (母) — Name',
      'text',
      true,
      5,
      'Kinship Information',
      21,
      NULL::text,
      '{"block_group":"kin_mother","required_when":"kin_mother_status === 1","note":"Official screenshot evidence: Mother (母) name is required when existence/status is 存.","label_en":"Mother (母) — Name","official_label_en":"Mother (母) — Name"}'::jsonb,
      NULL::jsonb,
      '{"showIf":"kin_mother_status === 1"}'::jsonb
    ),
    (
      'TW_ENTRY_PERMIT',
      'kin_mother_date_of_birth',
      'Mother (母) — Date of birth',
      'date',
      true,
      5,
      'Kinship Information',
      22,
      NULL::text,
      '{"block_group":"kin_mother","required_when":"kin_mother_status === 1","note":"Official screenshot evidence: Mother (母) date of birth is required when existence/status is 存.","label_en":"Mother (母) — Date of birth","official_label_en":"Mother (母) — Date of birth"}'::jsonb,
      NULL::jsonb,
      '{"showIf":"kin_mother_status === 1"}'::jsonb
    ),
    (
      'TW_ENTRY_PERMIT',
      'kin_mother_phone',
      'Mother (母) — Phone',
      'text',
      true,
      5,
      'Kinship Information',
      23,
      NULL::text,
      '{"block_group":"kin_mother","required_when":"kin_mother_status === 1","note":"Official screenshot evidence: Mother (母) phone is required when existence/status is 存.","label_en":"Mother (母) — Phone","official_label_en":"Mother (母) — Phone"}'::jsonb,
      NULL::jsonb,
      '{"showIf":"kin_mother_status === 1"}'::jsonb
    ),
    (
      'TW_ENTRY_PERMIT',
      'kin_mother_occupation',
      'Mother (母) — Occupation',
      'select',
      true,
      5,
      'Kinship Information',
      24,
      NULL::text,
      '{"block_group":"kin_mother","required_when":"kin_mother_status === 1","note":"Official screenshot evidence: Mother (母) occupation is required when existence/status is 存.","label_en":"Mother (母) — Occupation","official_label_en":"Mother (母) — Occupation"}'::jsonb,
      NULL::jsonb,
      '{"showIf":"kin_mother_status === 1"}'::jsonb
    ),
    (
      'TW_ENTRY_PERMIT',
      'kin_mother_service_unit',
      'Mother (母) — Employer / unit',
      'text',
      true,
      5,
      'Kinship Information',
      25,
      'Required for employed occupations and retired-before unit; not required for Freelance/Other/None',
      '{"block_group":"kin_mother","required_when":"kin_mother_status === 1 && kin_mother_occupation not in [15,16,17]","occupation_codes_not_required":["15","16","17"],"retired_code_requires_prior_detail":"62","note":"For parents marked 存, official occupation codes 自由業(15)、其他業(16)、無(17) do not require unit/title detail; 退休(62) requires retired-before unit/title.","label_en":"Mother (母) — Employer / unit","official_label_en":"Mother (母) — Employer / unit","placeholder_en":"Required for employed occupations and retired-before unit; not required for Freelance/Other/None"}'::jsonb,
      NULL::jsonb,
      '{"showIf":"kin_mother_status === 1 && kin_mother_occupation not in [15,16,17]"}'::jsonb
    ),
    (
      'TW_ENTRY_PERMIT',
      'kin_mother_job_title',
      'Mother (母) — Job title',
      'text',
      true,
      5,
      'Kinship Information',
      26,
      NULL::text,
      '{"block_group":"kin_mother","required_when":"kin_mother_status === 1 && kin_mother_occupation not in [15,16,17]","occupation_codes_not_required":["15","16","17"],"retired_code_requires_prior_detail":"62","note":"For parents marked 存, official occupation codes 自由業(15)、其他業(16)、無(17) do not require unit/title detail; 退休(62) requires retired-before unit/title.","label_en":"Mother (母) — Job title","official_label_en":"Mother (母) — Job title"}'::jsonb,
      NULL::jsonb,
      '{"showIf":"kin_mother_status === 1 && kin_mother_occupation not in [15,16,17]"}'::jsonb
    ),
    (
      'TW_ENTRY_PERMIT',
      'kin_mother_current_address_same_as_overseas',
      'Mother (母) — Current address same as applicant''s overseas address',
      'checkbox',
      false,
      5,
      'Kinship Information',
      27,
      NULL::text,
      '{"block_group":"kin_mother","note":"Mirrors the portal''s 同申請人海外地址 quick-fill button; current address is otherwise required when mother status is 存.","label_en":"Mother (母) — Current address same as applicant''s overseas address","official_label_en":"Mother (母) — Current address same as applicant''s overseas address"}'::jsonb,
      NULL::jsonb,
      '{"showIf":"kin_mother_status === 1"}'::jsonb
    ),
    (
      'TW_ENTRY_PERMIT',
      'kin_mother_current_address',
      'Mother (母) — Current address',
      'textarea',
      true,
      5,
      'Kinship Information',
      28,
      NULL::text,
      '{"block_group":"kin_mother","required_when":"kin_mother_status === 1 && kin_mother_current_address_same_as_overseas === false","note":"Official screenshot evidence: parent current address is required when existence/status is 存, unless the same-as-applicant address helper is used.","label_en":"Mother (母) — Current address","official_label_en":"Mother (母) — Current address"}'::jsonb,
      NULL::jsonb,
      '{"showIf":"kin_mother_status === 1 && kin_mother_current_address_same_as_overseas === false"}'::jsonb
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
    AND field_name IN (
      'name_chinese',
      'birth_place_mainland_region',
      'company_name',
      'kin_father_name',
      'kin_father_date_of_birth',
      'kin_father_phone',
      'kin_father_occupation',
      'kin_father_service_unit',
      'kin_father_job_title',
      'kin_father_current_address_same_as_overseas',
      'kin_father_current_address',
      'kin_mother_name',
      'kin_mother_date_of_birth',
      'kin_mother_phone',
      'kin_mother_occupation',
      'kin_mother_service_unit',
      'kin_mother_job_title',
      'kin_mother_current_address_same_as_overseas',
      'kin_mother_current_address'
    )
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
SELECT count(*) AS tw_identity_birthplace_parent_student_metadata_rows_upserted
FROM upserted;
