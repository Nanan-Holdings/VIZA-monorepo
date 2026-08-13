-- Idempotent metadata-only sync for Taiwan TW_ENTRY_PERMIT eligibility
-- category 3 document_requirements.
--
-- Scope:
--   * public.document_requirements rows where country = 'taiwan' and
--     visa_type = 'TW_ENTRY_PERMIT' only.
--   * Updates display labels/descriptions/required flags/metadata for the
--     six rows shown in the official eligibility-3 attachment table.
--   * Inserts missing rows for active Taiwan TW_ENTRY_PERMIT packages.
--   * Does not modify uploaded documents, application answers, storage paths,
--     users, payments, queues, OTP/CAPTCHA state, or any other country.
--
-- Official screenshot evidence, TW-B 2026-08-03:
--   * Red-star required rows:
--       mainland_travel_document
--       eligibility_supporting_document_3
--       mainland_id_card_scan
--   * Same-table situation-specific rows:
--       hk_macau_id_scan
--       other_supporting_document
--       other_nationality_passport_scan
--
-- Pre-flight verification SQL (read-only):
--   SELECT requirement_key, label_zh, required, sort_order, metadata
--   FROM public.document_requirements
--   WHERE country = 'taiwan'
--     AND visa_type = 'TW_ENTRY_PERMIT'
--     AND requirement_key IN (
--       'mainland_travel_document',
--       'eligibility_supporting_document',
--       'eligibility_supporting_document_3',
--       'hk_macau_id_scan',
--       'other_supporting_document',
--       'other_nationality_passport_scan',
--       'mainland_id_card_scan'
--     )
--   ORDER BY visa_package_id NULLS LAST, sort_order, requirement_key;
--
-- Expected affected logical keys:
--   mainland_travel_document, eligibility_supporting_document_3,
--   hk_macau_id_scan, other_supporting_document,
--   other_nationality_passport_scan, mainland_id_card_scan.
--
-- Post-flight verification SQL:
--   SELECT
--     requirement_key,
--     label_zh,
--     required,
--     metadata->>'applicability' AS applicability,
--     metadata->>'tw_source' AS tw_source
--   FROM public.document_requirements
--   WHERE country = 'taiwan'
--     AND visa_type = 'TW_ENTRY_PERMIT'
--     AND requirement_key IN (
--       'mainland_travel_document',
--       'eligibility_supporting_document_3',
--       'hk_macau_id_scan',
--       'other_supporting_document',
--       'other_nationality_passport_scan',
--       'mainland_id_card_scan'
--     )
--   ORDER BY visa_package_id NULLS LAST, sort_order, requirement_key;
--
-- Rollback SQL (metadata only, if explicitly authorized):
--   UPDATE public.document_requirements
--   SET metadata = COALESCE(metadata, '{}'::jsonb) - 'applicability' - 'tw_source' - 'tw_official_category' - 'required_when'
--   WHERE country = 'taiwan' AND visa_type = 'TW_ENTRY_PERMIT';

WITH active_tw_packages AS (
  SELECT id
  FROM public.visa_packages
  WHERE country = 'taiwan'
    AND visa_type = 'TW_ENTRY_PERMIT'
    AND COALESCE(is_active, true) = true
),
desired_rows AS (
  SELECT *
  FROM (VALUES
    (
      'mainland_travel_document',
      'Mainland travel document / HK-Macau non-permanent-resident travel document',
      '大陆地区所发尚余6个月以上效期之旅行证件或香港、澳门政府核发之非永久性居民旅行证件',
      '官网资格3附件表红星项目：大陆地区所发尚余6个月以上效期之旅行证件，或香港、澳门政府核发之非永久性居民旅行证件。',
      true,
      20,
      '{"applicability":"required","tw_source":"official_eligibility_3_attachment_screenshot_2026_08_03","tw_official_category":"3"}'::jsonb
    ),
    (
      'eligibility_supporting_document_3',
      'Supporting document — 1+ year residency with work proof',
      '有现住地出入境查验章戳之护照内页、工作签证及3个月内公司在职证明',
      '官网资格3附件表红星项目：须上传有现住地之出入境查验章戳之护照内页（证明旅居国外、香港或澳门一年以上）、工作签证（例如：签证、工作证或居留证）及3个月内公司在职证明。',
      true,
      32,
      '{"applicability":"required","tw_source":"official_eligibility_3_attachment_screenshot_2026_08_03","tw_official_category":"3"}'::jsonb
    ),
    (
      'hk_macau_id_scan',
      'Hong Kong/Macau resident ID and valid visa',
      '香港或澳门居民身份证（正、反面）及有效香港或澳门签证',
      '官网资格3附件表情形适用项目：旅居香港或澳门之申请人须附香港或澳门居民身份证（正、反面）及有效香港或澳门签证；11岁以下免附。',
      false,
      40,
      '{"applicability":"conditional","tw_source":"official_eligibility_3_attachment_screenshot_2026_08_03","tw_official_category":"3","required_when":"applicant resides in Hong Kong or Macau"}'::jsonb
    ),
    (
      'other_nationality_passport_scan',
      'Other-nationality passport/document scan',
      '具有他国国籍护（证）照文件',
      '官网资格3附件表情形适用项目：具有他国国籍护（证）照时上传。',
      false,
      50,
      '{"applicability":"conditional","tw_source":"official_eligibility_3_attachment_screenshot_2026_08_03","tw_official_category":"3","required_when":"has_other_nationality_passport is yes"}'::jsonb
    ),
    (
      'mainland_id_card_scan',
      'Mainland ID card (front + back)',
      '大陆身份证（正、反面）',
      '官网资格3附件表红星项目：大陆身份证正、反面。',
      true,
      60,
      '{"applicability":"required","tw_source":"official_eligibility_3_attachment_screenshot_2026_08_03","tw_official_category":"3","required_when":"eligibility_category is 3"}'::jsonb
    ),
    (
      'other_supporting_document',
      'Other supporting document',
      '其他相关证明文件',
      '官网资格3附件表情形适用项目：若无要求则免附；申请人如旅居日本，请上传3个月内住民票。',
      false,
      70,
      '{"applicability":"conditional","tw_source":"official_eligibility_3_attachment_screenshot_2026_08_03","tw_official_category":"3"}'::jsonb
    )
  ) AS rows(requirement_key, label_en, label_zh, description, required, sort_order, metadata)
),
package_desired_rows AS (
  SELECT
    pkg.id AS visa_package_id,
    'taiwan'::text AS country,
    'TW_ENTRY_PERMIT'::text AS visa_type,
    desired.requirement_key,
    desired.label_en,
    desired.label_zh,
    desired.description,
    desired.required,
    desired.sort_order,
    desired.metadata
  FROM active_tw_packages pkg
  CROSS JOIN desired_rows desired
),
upserted AS (
  INSERT INTO public.document_requirements (
    visa_package_id,
    country,
    visa_type,
    requirement_key,
    label_en,
    label_zh,
    description,
    required,
    sort_order,
    metadata
  )
  SELECT
    visa_package_id,
    country,
    visa_type,
    requirement_key,
    label_en,
    label_zh,
    description,
    required,
    sort_order,
    metadata
  FROM package_desired_rows
  ON CONFLICT (visa_package_id, requirement_key) WHERE visa_package_id IS NOT NULL
  DO UPDATE SET
    country = EXCLUDED.country,
    visa_type = EXCLUDED.visa_type,
    label_en = EXCLUDED.label_en,
    label_zh = EXCLUDED.label_zh,
    description = EXCLUDED.description,
    required = EXCLUDED.required,
    sort_order = EXCLUDED.sort_order,
    metadata = COALESCE(public.document_requirements.metadata, '{}'::jsonb) || EXCLUDED.metadata
  RETURNING requirement_key
)
SELECT
  requirement_key,
  count(*) AS affected_rows
FROM upserted
GROUP BY requirement_key
ORDER BY requirement_key;
