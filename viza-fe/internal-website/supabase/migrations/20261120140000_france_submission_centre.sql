-- France-Visas step 1 asks for the "City of submission" (the TLScontact
-- centre where the applicant files). The France form never collected it, so
-- the worker could not fill step 1. Add a required select with the 15
-- mainland-China TLScontact centres, after the overseas-territories question
-- in step 7. The worker matches the chosen city against the live France-Visas
-- dropdown. Idempotent.

INSERT INTO public.visa_form_fields (
  visa_type, field_name, label, field_type, required, step_number, step_name,
  display_order, placeholder, validation_rules, options, conditional_logic
)
SELECT
  'EU_SCHENGEN_C_SHORT_STAY',
  'submission_centre',
  'City of submission',
  'select',
  TRUE,
  f.step_number,
  f.step_name,
  f.display_order + 1,
  NULL,
  '{"label_zh":"递交签证申请的城市（TLScontact 签证中心）","helper_zh":"选择您将前往递交材料、采集指纹的 TLScontact 法国签证中心所在城市。","official":true}'::JSONB,
  '[{"text":"Beijing","value":"beijing","label_en":"Beijing","label_zh":"北京"},{"text":"Guangzhou","value":"guangzhou","label_en":"Guangzhou","label_zh":"广州"},{"text":"Chengdu","value":"chengdu","label_en":"Chengdu","label_zh":"成都"},{"text":"Shanghai","value":"shanghai","label_en":"Shanghai","label_zh":"上海"},{"text":"Shenyang","value":"shenyang","label_en":"Shenyang","label_zh":"沈阳"},{"text":"Wuhan","value":"wuhan","label_en":"Wuhan","label_zh":"武汉"},{"text":"Jinan","value":"jinan","label_en":"Jinan","label_zh":"济南"},{"text":"Chongqing","value":"chongqing","label_en":"Chongqing","label_zh":"重庆"},{"text":"Shenzhen","value":"shenzhen","label_en":"Shenzhen","label_zh":"深圳"},{"text":"Changsha","value":"changsha","label_en":"Changsha","label_zh":"长沙"},{"text":"Hangzhou","value":"hangzhou","label_en":"Hangzhou","label_zh":"杭州"},{"text":"Kunming","value":"kunming","label_en":"Kunming","label_zh":"昆明"},{"text":"Xi''an","value":"xian","label_en":"Xi''an","label_zh":"西安"},{"text":"Nanjing","value":"nanjing","label_en":"Nanjing","label_zh":"南京"},{"text":"Fuzhou","value":"fuzhou","label_en":"Fuzhou","label_zh":"福州"}]'::JSONB,
  NULL
FROM public.visa_form_fields f
WHERE f.visa_type = 'EU_SCHENGEN_C_SHORT_STAY'
  AND f.field_name = 'visits_french_overseas_territories'
  AND NOT EXISTS (
    SELECT 1 FROM public.visa_form_fields
    WHERE visa_type = 'EU_SCHENGEN_C_SHORT_STAY' AND field_name = 'submission_centre'
  );
