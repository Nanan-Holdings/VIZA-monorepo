-- Idempotent metadata-only sync for Taiwan TW_ENTRY_PERMIT eligibility
-- category 4 document_requirements.
--
-- Scope:
--   * public.document_requirements rows where country = 'taiwan' and
--     visa_type = 'TW_ENTRY_PERMIT' only.
--   * Updates display labels/descriptions/required flags/metadata for the
--     six rows shown in the official eligibility-4 attachment table.
--   * Inserts missing rows for active Taiwan TW_ENTRY_PERMIT packages.
--   * Does not modify uploaded documents, application answers, storage paths,
--     users, payments, queues, OTP/CAPTCHA state, or any other country.
--
-- Official screenshot evidence, TW-C 2026-08-03:
--   * Red-star required rows:
--       mainland_travel_document
--       eligibility_supporting_document_4
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
--       'eligibility_supporting_document_4',
--       'hk_macau_id_scan',
--       'other_supporting_document',
--       'other_nationality_passport_scan',
--       'mainland_id_card_scan'
--     )
--   ORDER BY visa_package_id NULLS LAST, sort_order, requirement_key;
--
-- Expected affected logical keys:
--   mainland_travel_document, eligibility_supporting_document_4,
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
--       'eligibility_supporting_document_4',
--       'hk_macau_id_scan',
--       'other_supporting_document',
--       'other_nationality_passport_scan',
--       'mainland_id_card_scan'
--     )
--   ORDER BY visa_package_id NULLS LAST, sort_order, requirement_key;
--
-- Rollback SQL (metadata only, if explicitly authorized):
--   UPDATE public.document_requirements
--   SET metadata = COALESCE(metadata, '{}'::jsonb) - 'applicability' - 'tw_source' - 'tw_official_category'
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
      '官网资格4附件表红星项目：大陆地区旅行证件须尚余6个月以上效期；如为香港、澳门政府核发之非永久性居民旅行证件，也可上传。',
      true,
      20,
      '{"applicability":"required","tw_source":"official_eligibility_4_attachment_screenshot_2026_08_03","tw_official_category":"4"}'::jsonb
    ),
    (
      'eligibility_supporting_document_4',
      'Supporting document — dependent residency and financial proof',
      '现住地依亲居留权证明及等值新台币十万元以上存款证明',
      '官网资格4附件表红星项目：须上传现住地依亲居留权证明，以及金融机构一个月内出具、存款期间达一个月以上、等值新台币十万元以上之存款证明。',
      true,
      33,
      '{"applicability":"required","tw_source":"official_eligibility_4_attachment_screenshot_2026_08_03","tw_official_category":"4"}'::jsonb
    ),
    (
      'hk_macau_id_scan',
      'Hong Kong/Macau resident ID and valid visa',
      '香港或澳门居民身份证（正、反面）及有效香港或澳门签证',
      '官网资格4附件表情形适用项目：旅居香港或澳门之申请人须附；11岁以下免附。',
      false,
      40,
      '{"applicability":"conditional","tw_source":"official_eligibility_4_attachment_screenshot_2026_08_03","tw_official_category":"4","required_when":"embassy_office in [50, 51]"}'::jsonb
    ),
    (
      'other_nationality_passport_scan',
      'Other-nationality passport/document scan',
      '具有他国国籍护（证）照文件',
      '官网资格4附件表情形适用项目：具有他国国籍护（证）照时上传。',
      false,
      50,
      '{"applicability":"conditional","tw_source":"official_eligibility_4_attachment_screenshot_2026_08_03","tw_official_category":"4","required_when":"has_other_nationality_passport is yes"}'::jsonb
    ),
    (
      'mainland_id_card_scan',
      'Mainland ID card (front + back)',
      '大陆身份证（正、反面）',
      '官网资格4附件表红星项目：大陆身份证正、反面。',
      true,
      60,
      '{"applicability":"required","tw_source":"official_eligibility_4_attachment_screenshot_2026_08_03","tw_official_category":"4","required_when":"eligibility_category is 4"}'::jsonb
    ),
    (
      'other_supporting_document',
      'Other supporting document',
      '其他相关证明文件',
      '官网资格4附件表情形适用项目：若无要求则免附；申请人如旅居日本，请上传3个月内住民票。',
      false,
      70,
      '{"applicability":"conditional","tw_source":"official_eligibility_4_attachment_screenshot_2026_08_03","tw_official_category":"4"}'::jsonb
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
