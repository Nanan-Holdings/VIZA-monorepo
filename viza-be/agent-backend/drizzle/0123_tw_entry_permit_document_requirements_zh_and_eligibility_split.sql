-- Follow-up to 0122_tw_entry_permit_document_requirements.sql, fixing two
-- real problems found during live testing:
--
-- 1. label_zh/description on every row from 0122 were Traditional Chinese
--    (e.g. "照片上傳", "大陸地區所發尚餘..."), inconsistent with the rest of
--    the site's Simplified-Chinese zh locale. `description` was also
--    English-only, which document-center-client.tsx's getRequirementDescription()
--    only shows in the EN interface (it picks zh vs en per-row by detecting
--    CJK characters in the `description` column itself) — so Chinese-locale
--    applicants were seeing no description text at all under most of these
--    documents. Both are fixed here: label_zh converted to Simplified, and
--    description rewritten in Simplified Chinese so it actually renders for
--    Taiwan's Chinese-only applicant base.
--
-- 2. 'eligibility_supporting_document' was a single row whose description
--    listed all 4 possible eligibility_category outcomes at once (student /
--    permanent residency / work / dependent residency), so every applicant
--    saw all 4 requirements lumped together regardless of which category
--    they actually picked earlier in the form. Split into 4 rows
--    (eligibility_supporting_document_1..4, matching the seed's
--    ELIGIBILITY_CATEGORIES values 1-4) so each applicant only sees the one
--    relevant to their answer — the frontend filters to the matching row in
--    applyTwEligibilityDocumentFilter() (app/client/documents/actions.ts),
--    and viza-be/submission-service/src/queue/halt-runners.ts resolves the
--    matching key from answers.eligibility_category at automation time.

-- 1. Simplified-Chinese label_zh + description fixes for the 6 unsplit rows.

UPDATE document_requirements
SET label_zh = '照片上传',
    description = '近期2寸彩色证件照，白底。请勿使用手机自拍或翻拍照片。'
WHERE country = 'taiwan' AND visa_type = 'TW_ENTRY_PERMIT' AND requirement_key = 'photo';

UPDATE document_requirements
SET label_zh = '大陆地区所发尚余6个月以上效期之旅行证件或香港、澳门政府核发之非永久性居民旅行证件',
    description = '大陆核发、有效期6个月以上的旅行证件，或港澳政府核发的非永久性居民旅行证件。所有资格类别均须提供。'
WHERE country = 'taiwan' AND visa_type = 'TW_ENTRY_PERMIT' AND requirement_key = 'mainland_travel_document';

UPDATE document_requirements
SET label_zh = '香港或澳门居民身份证（正、反面）及有效香港或澳门签证',
    description = '仅当您通过香港或澳门受理单位申请时需要（未满11岁者免附）。'
WHERE country = 'taiwan' AND visa_type = 'TW_ENTRY_PERMIT' AND requirement_key = 'hk_macau_id_scan';

UPDATE document_requirements
SET label_zh = '持有他国国籍护照（证）文件',
    description = '仅当您持有其他国籍护照时需要（即上一步"是否持有其他国籍护照"选择了"是"）。'
WHERE country = 'taiwan' AND visa_type = 'TW_ENTRY_PERMIT' AND requirement_key = 'other_nationality_passport_scan';

UPDATE document_requirements
SET label_zh = '大陆身份证（正、反面）',
    description = '仅当您持有大陆身份证号码时需要（即未勾选"无大陆身份证号码"）。'
WHERE country = 'taiwan' AND visa_type = 'TW_ENTRY_PERMIT' AND requirement_key = 'mainland_id_card_scan';

UPDATE document_requirements
SET label_zh = '其他相关证明文件',
    description = '如适用才需上传，例如居住在日本者可上传3个月内的住民票。'
WHERE country = 'taiwan' AND visa_type = 'TW_ENTRY_PERMIT' AND requirement_key = 'other_supporting_document';

-- 2. Remove the old lumped-together row and insert 4 category-specific ones.

DELETE FROM document_requirements
WHERE country = 'taiwan' AND visa_type = 'TW_ENTRY_PERMIT' AND requirement_key = 'eligibility_supporting_document';

INSERT INTO document_requirements (visa_package_id, country, visa_type, requirement_key, label_en, label_zh, description, required, sort_order)
SELECT
  vp.id,
  'taiwan',
  'TW_ENTRY_PERMIT',
  r.requirement_key,
  r.label_en,
  r.label_zh,
  r.description,
  r.required,
  r.sort_order
FROM visa_packages vp
CROSS JOIN (VALUES
  ('eligibility_supporting_document_1', 'Supporting document — student status', '申请资格证明文件（留学生）', '有效学生签证（或再入国签证），以及学校核发3个月内的在学证明。', true, 30),
  ('eligibility_supporting_document_2', 'Supporting document — permanent residency', '申请资格证明文件（永久居留权）', '当地永久居留权证明。', true, 31),
  ('eligibility_supporting_document_3', 'Supporting document — 1+ year residency with work proof', '申请资格证明文件（工作证明）', '出入境查验章戳护照内页、工作签证，以及3个月内的公司在职证明。', true, 32),
  ('eligibility_supporting_document_4', 'Supporting document — dependent residency', '申请资格证明文件（依亲居留权）', '现住地依亲居留权证明，以及新台币10万元以上、一个月内开立且存满一个月的存款证明。', true, 33)
) AS r(requirement_key, label_en, label_zh, description, required, sort_order)
WHERE vp.country = 'taiwan' AND vp.visa_type = 'TW_ENTRY_PERMIT'
ON CONFLICT (visa_package_id, requirement_key) WHERE visa_package_id IS NOT NULL DO NOTHING;
