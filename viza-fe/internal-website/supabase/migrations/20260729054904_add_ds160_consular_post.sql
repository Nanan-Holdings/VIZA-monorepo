insert into public.visa_form_fields (
  visa_type, field_name, label, field_type, required, step_number, step_name,
  display_order, placeholder, validation_rules, options, conditional_logic, updated_at
)
values (
  'DS160',
  'consular_post',
  'Location where you will be submitting your application',
  'select',
  true,
  1,
  'Personal Information 1',
  0,
  null,
  jsonb_build_object(
    'label_en', 'Location where you will be submitting your application',
    'official_label_en', 'Location where you will be submitting your application',
    'label_zh', '您计划在哪个美国使领馆申请签证？',
    'official_source', 'CEAC DS-160 start-page location selector'
  ),
  jsonb_build_array(
    jsonb_build_object('value', 'BEJ', 'text', 'CHINA, BEIJING', 'label_en', 'CHINA, BEIJING', 'label_zh', '中国，北京（美国驻华大使馆）', 'official_label', 'CHINA, BEIJING'),
    jsonb_build_object('value', 'GUZ', 'text', 'CHINA, GUANGZHOU', 'label_en', 'CHINA, GUANGZHOU', 'label_zh', '中国，广州（美国驻广州总领事馆）', 'official_label', 'CHINA, GUANGZHOU'),
    jsonb_build_object('value', 'SHG', 'text', 'CHINA, SHANGHAI', 'label_en', 'CHINA, SHANGHAI', 'label_zh', '中国，上海（美国驻上海总领事馆）', 'official_label', 'CHINA, SHANGHAI'),
    jsonb_build_object('value', 'SNY', 'text', 'CHINA, SHENYANG', 'label_en', 'CHINA, SHENYANG', 'label_zh', '中国，沈阳（美国驻沈阳总领事馆）', 'official_label', 'CHINA, SHENYANG'),
    jsonb_build_object('value', 'WUH', 'text', 'CHINA, WUHAN', 'label_en', 'CHINA, WUHAN', 'label_zh', '中国，武汉（美国驻武汉总领事馆）', 'official_label', 'CHINA, WUHAN')
  ),
  null,
  now()
)
on conflict (visa_type, field_name)
do update set
  label = excluded.label,
  field_type = excluded.field_type,
  required = excluded.required,
  step_number = excluded.step_number,
  step_name = excluded.step_name,
  display_order = excluded.display_order,
  placeholder = excluded.placeholder,
  validation_rules = excluded.validation_rules,
  options = excluded.options,
  conditional_logic = excluded.conditional_logic,
  updated_at = excluded.updated_at;
