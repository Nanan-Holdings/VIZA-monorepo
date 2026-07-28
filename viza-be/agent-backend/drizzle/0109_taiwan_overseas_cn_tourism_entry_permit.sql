-- Taiwan entry permit for PRC passport holders resident in Singapore. This is
-- not an arrival card and must remain separate from generic Taiwan visitor data.
INSERT INTO visa_packages (country, visa_type, name, description, metadata)
VALUES (
  'taiwan',
  'TW_OVERSEAS_CN_TOURISM_ENTRY_PERMIT',
  'Taiwan Overseas Chinese Mainland Tourist Entry Permit',
  'Online tourist entry permit for Chinese mainland passport holders resident in Singapore. Eligibility, evidence, official review, online payment, and electronic permit download follow Taiwan National Immigration Agency rules.',
  jsonb_build_object(
    'official_portal_url', 'https://coa.immigration.gov.tw/coa-frontend/overseas-foreign-china',
    'submission_provider', 'taiwan_overseas_cn_entry_permit_live',
    'form_seed', 'scripts/seed-tw-overseas-cn-tourism-entry-permit-form-fields.ts',
    'official_fee_twd', jsonb_build_object('single', 600, 'one_year_multiple', 1000)
  )
)
ON CONFLICT DO NOTHING;

UPDATE visa_packages
SET name = 'Taiwan Overseas Chinese Mainland Tourist Entry Permit',
    description = 'Online tourist entry permit for Chinese mainland passport holders resident in Singapore. Eligibility, evidence, official review, online payment, and electronic permit download follow Taiwan National Immigration Agency rules.',
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'official_portal_url', 'https://coa.immigration.gov.tw/coa-frontend/overseas-foreign-china',
      'submission_provider', 'taiwan_overseas_cn_entry_permit_live',
      'form_seed', 'scripts/seed-tw-overseas-cn-tourism-entry-permit-form-fields.ts',
      'official_fee_twd', jsonb_build_object('single', 600, 'one_year_multiple', 1000)
    ), updated_at = NOW()
WHERE country = 'taiwan' AND visa_type = 'TW_OVERSEAS_CN_TOURISM_ENTRY_PERMIT';

WITH package AS (
  SELECT id FROM visa_packages WHERE country = 'taiwan' AND visa_type = 'TW_OVERSEAS_CN_TOURISM_ENTRY_PERMIT' ORDER BY created_at ASC LIMIT 1
)
INSERT INTO document_requirements (visa_package_id, country, visa_type, requirement_key, label_en, label_zh, description, required, sort_order, metadata)
SELECT package.id, 'taiwan', 'TW_OVERSEAS_CN_TOURISM_ENTRY_PERMIT', r.requirement_key, r.label_en, r.label_zh, r.description, r.required, r.sort_order, r.metadata
FROM package CROSS JOIN (VALUES
 ('passport_bio_page','Mainland passport bio page','中国大陆护照资料页','Passport must have at least six months validity at application.',true,10,'{"document_type":"passport_copy","source":"taiwan_nia"}'::jsonb),
 ('recent_white_background_photo','Recent white-background photo','两年内白底证件照','Recent two-inch colour photo taken within two years.',true,20,'{"document_type":"photo","source":"taiwan_nia"}'::jsonb),
 ('singapore_residence_proof','Singapore residence proof','新加坡居留证明','Valid Singapore residence/pass evidence for the selected eligibility route.',true,30,'{"document_type":"residence_permit","source":"taiwan_nia"}'::jsonb),
 ('eligibility_evidence','Eligibility route evidence','资格路径证明','Student, PR, work, dependent-finance, or accompanying-family evidence according to the selected route.',true,40,'{"document_type":"eligibility_evidence","source":"taiwan_nia"}'::jsonb)
) AS r(requirement_key,label_en,label_zh,description,required,sort_order,metadata)
ON CONFLICT DO NOTHING;
