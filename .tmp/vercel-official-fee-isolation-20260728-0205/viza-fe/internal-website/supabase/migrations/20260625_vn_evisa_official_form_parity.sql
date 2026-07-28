-- Vietnam e-Visa official portal form parity.
--
-- Adds conditional questions/tables and validation metadata observed on the
-- current official Vietnam e-Visa portal so VIZA collects the same required
-- data before the submission-service runner reaches the official checkpoint.

UPDATE visa_form_fields
SET validation_rules = COALESCE(validation_rules, '{}'::jsonb) || '{"allow_year_only":true}'::jsonb,
    updated_at = now()
WHERE visa_type = 'VN_E_VISA'
  AND field_name = 'date_of_birth';

UPDATE visa_form_fields
SET validation_rules = COALESCE(validation_rules, '{}'::jsonb) || '{"min_date":"today"}'::jsonb,
    updated_at = now()
WHERE visa_type = 'VN_E_VISA'
  AND field_name = 'visa_valid_from';

UPDATE visa_form_fields
SET validation_rules = COALESCE(validation_rules, '{}'::jsonb) || '{"not_before_field":"visa_valid_from"}'::jsonb,
    updated_at = now()
WHERE visa_type = 'VN_E_VISA'
  AND field_name = 'visa_valid_to';

UPDATE visa_form_fields
SET validation_rules = COALESCE(validation_rules, '{}'::jsonb)
    || '{"dependent_on":"intended_province_city","dependent_options_key":"vietnam_wards_by_province"}'::jsonb,
    options = '[]'::jsonb,
    updated_at = now()
WHERE visa_type = 'VN_E_VISA'
  AND field_name = 'intended_ward_commune';

UPDATE visa_form_fields
SET label = 'Do you have multiple nationalities?',
    validation_rules = COALESCE(validation_rules, '{}'::jsonb)
      || '{"label_zh":"是否拥有多个国籍？","helper_zh":"如拥有多个国籍，请选择“是”并逐项补充。","helper_en":"Select Yes if you currently hold more than one nationality."}'::jsonb,
    display_order = 17,
    updated_at = now()
WHERE visa_type = 'VN_E_VISA'
  AND field_name = 'has_multiple_nationalities';

UPDATE visa_form_fields
SET display_order = 18,
    validation_rules = (COALESCE(validation_rules, '{}'::jsonb) - 'block_group')
      || '{"repeatable":true,"repeat_group":"multiple_nationalities","max_items":5,"label_zh":"其他国籍"}'::jsonb,
    conditional_logic = '{"showIf":"has_multiple_nationalities === yes"}'::jsonb,
    updated_at = now()
WHERE visa_type = 'VN_E_VISA'
  AND field_name = 'other_nationality';

UPDATE visa_form_fields
SET display_order = 19,
    updated_at = now()
WHERE visa_type = 'VN_E_VISA'
  AND field_name = 'has_violated_vietnam_laws';

UPDATE visa_form_fields
SET required = false,
    conditional_logic = '{"showIf":"has_violated_vietnam_laws === legacy_textarea"}'::jsonb,
    validation_rules = COALESCE(validation_rules, '{}'::jsonb)
      || '{"label_zh":"越南违法记录说明（旧字段）"}'::jsonb,
    updated_at = now()
WHERE visa_type = 'VN_E_VISA'
  AND field_name = 'violation_of_vietnam_laws_details';

UPDATE visa_form_fields
SET display_order = 5,
    updated_at = now()
WHERE visa_type = 'VN_E_VISA'
  AND field_name = 'passport_issue_date';

UPDATE visa_form_fields
SET display_order = 6,
    updated_at = now()
WHERE visa_type = 'VN_E_VISA'
  AND field_name = 'passport_expiry_date';

UPDATE visa_form_fields
SET display_order = 16,
    updated_at = now()
WHERE visa_type = 'VN_E_VISA'
  AND field_name = 'visited_vietnam_in_last_year';

UPDATE visa_form_fields
SET required = false,
    conditional_logic = '{"showIf":"visited_vietnam_in_last_year === legacy_textarea"}'::jsonb,
    validation_rules = COALESCE(validation_rules, '{}'::jsonb)
      || '{"label_zh":"过去一年访问越南说明（旧字段）"}'::jsonb,
    updated_at = now()
WHERE visa_type = 'VN_E_VISA'
  AND field_name = 'visited_vietnam_purpose_detail';

UPDATE visa_form_fields
SET display_order = 20,
    updated_at = now()
WHERE visa_type = 'VN_E_VISA'
  AND field_name = 'has_relatives_in_vietnam';

UPDATE visa_form_fields
SET display_order = CASE field_name
      WHEN 'relative_full_name' THEN 21
      WHEN 'relative_date_of_birth' THEN 22
      WHEN 'relative_nationality' THEN 23
      WHEN 'relative_relationship' THEN 24
      WHEN 'relative_residential_address' THEN 25
      ELSE display_order
    END,
    validation_rules = (COALESCE(validation_rules, '{}'::jsonb) - 'block_group')
      || '{"repeatable":true,"repeat_group":"relatives_in_vietnam","max_items":5}'::jsonb,
    conditional_logic = '{"showIf":"has_relatives_in_vietnam === yes"}'::jsonb,
    updated_at = now()
WHERE visa_type = 'VN_E_VISA'
  AND field_name IN (
    'relative_full_name',
    'relative_date_of_birth',
    'relative_nationality',
    'relative_relationship',
    'relative_residential_address'
  );

UPDATE visa_form_fields
SET display_order = CASE field_name
      WHEN 'bought_travel_insurance' THEN 2
      WHEN 'expense_coverage' THEN 4
      ELSE display_order
    END,
    updated_at = now()
WHERE visa_type = 'VN_E_VISA'
  AND field_name IN ('bought_travel_insurance', 'expense_coverage');

WITH fields(field_name, label, field_type, required, step_number, step_name, display_order, placeholder, validation_rules, options, conditional_logic) AS (
  VALUES
    (
      'has_other_passports_used_for_vietnam',
      'Have you ever used any other passports to enter into Viet Nam?',
      'radio',
      true,
      1,
      'Personal Information',
      11,
      NULL,
      '{"label_zh":"是否曾使用其他护照进入越南？","helper_zh":"如曾使用其他护照入境越南，请选择“是”并补充护照信息。"}'::jsonb,
      '[{"value":"yes","text":"Yes","label_zh":"是","label_en":"Yes"},{"value":"no","text":"No","label_zh":"否","label_en":"No"}]'::jsonb,
      NULL
    ),
    (
      'other_vietnam_passport_number',
      'Passport',
      'text',
      true,
      1,
      'Personal Information',
      12,
      'Enter passport',
      '{"label_zh":"曾用于入境越南的其他护照号码","repeatable":true,"repeat_group":"other_passports_used_for_vietnam","max_items":5,"maxLength":9}'::jsonb,
      NULL,
      '{"showIf":"has_other_passports_used_for_vietnam === yes"}'::jsonb
    ),
    (
      'other_vietnam_passport_full_name',
      'Full name',
      'text',
      true,
      1,
      'Personal Information',
      13,
      'Enter full name',
      '{"label_zh":"其他护照上的姓名","repeatable":true,"repeat_group":"other_passports_used_for_vietnam","max_items":5,"maxLength":120}'::jsonb,
      NULL,
      '{"showIf":"has_other_passports_used_for_vietnam === yes"}'::jsonb
    ),
    (
      'other_vietnam_passport_date_of_birth',
      'Date of birth',
      'date',
      true,
      1,
      'Personal Information',
      14,
      'DD/MM/YYYY',
      '{"label_zh":"出生日期","repeatable":true,"repeat_group":"other_passports_used_for_vietnam","max_items":5,"allow_year_only":true}'::jsonb,
      NULL,
      '{"showIf":"has_other_passports_used_for_vietnam === yes"}'::jsonb
    ),
    (
      'other_vietnam_passport_nationality',
      'Nationality',
      'country',
      true,
      1,
      'Personal Information',
      15,
      'Choose nationality',
      '{"label_zh":"国籍","repeatable":true,"repeat_group":"other_passports_used_for_vietnam","max_items":5,"source":"ISO3166-1"}'::jsonb,
      NULL,
      '{"showIf":"has_other_passports_used_for_vietnam === yes"}'::jsonb
    ),
    (
      'vietnam_law_violation_act',
      'Act of violation',
      'text',
      true,
      1,
      'Personal Information',
      20,
      'Enter act of violation',
      '{"label_zh":"违法行为","repeatable":true,"repeat_group":"vietnam_law_violations","max_items":5,"maxLength":200}'::jsonb,
      NULL,
      '{"showIf":"has_violated_vietnam_laws === yes"}'::jsonb
    ),
    (
      'vietnam_law_violation_time',
      'Time of violation',
      'date',
      true,
      1,
      'Personal Information',
      21,
      'DD/MM/YYYY',
      '{"label_zh":"违法时间","repeatable":true,"repeat_group":"vietnam_law_violations","max_items":5}'::jsonb,
      NULL,
      '{"showIf":"has_violated_vietnam_laws === yes"}'::jsonb
    ),
    (
      'vietnam_law_violation_sanction',
      'Form of sanction',
      'text',
      true,
      1,
      'Personal Information',
      22,
      'Enter form of sanction',
      '{"label_zh":"处罚形式","repeatable":true,"repeat_group":"vietnam_law_violations","max_items":5,"maxLength":200}'::jsonb,
      NULL,
      '{"showIf":"has_violated_vietnam_laws === yes"}'::jsonb
    ),
    (
      'vietnam_law_violation_authority',
      'Authority imposed sanction',
      'text',
      true,
      1,
      'Personal Information',
      23,
      'Enter authority imposed sanction',
      '{"label_zh":"作出处罚的机关","repeatable":true,"repeat_group":"vietnam_law_violations","max_items":5,"maxLength":200}'::jsonb,
      NULL,
      '{"showIf":"has_violated_vietnam_laws === yes"}'::jsonb
    ),
    (
      'passport_type_other_specify',
      'If “Others”, please specify',
      'text',
      true,
      3,
      'Passport Information',
      4,
      'Enter specify others type',
      '{"label_zh":"如选择“其他”，请说明","maxLength":120}'::jsonb,
      NULL,
      '{"showIf":"passport_type === other"}'::jsonb
    ),
    (
      'has_contact_in_vietnam',
      'Agency/Organization/Individual that the applicant plans to contact when enter into Viet Nam?',
      'radio',
      true,
      6,
      'Trip Information',
      11,
      NULL,
      '{"label_zh":"入境越南后计划联系的机构、组织或个人？"}'::jsonb,
      '[{"value":"yes","text":"Yes","label_zh":"是","label_en":"Yes"},{"value":"no","text":"No","label_zh":"否","label_en":"No"}]'::jsonb,
      NULL
    ),
    (
      'contact_hosting_organization_name',
      'Name of hosting organization',
      'text',
      true,
      6,
      'Trip Information',
      12,
      'Enter name of hosting organization',
      '{"label_zh":"接待机构/组织/个人名称","repeatable":true,"repeat_group":"vietnam_contacts","max_items":5,"maxLength":200}'::jsonb,
      NULL,
      '{"showIf":"has_contact_in_vietnam === yes"}'::jsonb
    ),
    (
      'contact_hosting_organization_phone',
      'Telephone number',
      'text',
      true,
      6,
      'Trip Information',
      13,
      'Enter telephone number',
      '{"label_zh":"联系电话","repeatable":true,"repeat_group":"vietnam_contacts","max_items":5,"maxLength":40}'::jsonb,
      NULL,
      '{"showIf":"has_contact_in_vietnam === yes"}'::jsonb
    ),
    (
      'contact_hosting_organization_address',
      'Address',
      'text',
      true,
      6,
      'Trip Information',
      14,
      'Enter address',
      '{"label_zh":"地址","repeatable":true,"repeat_group":"vietnam_contacts","max_items":5,"maxLength":300}'::jsonb,
      NULL,
      '{"showIf":"has_contact_in_vietnam === yes"}'::jsonb
    ),
    (
      'contact_hosting_organization_purpose',
      'Purpose',
      'text',
      true,
      6,
      'Trip Information',
      15,
      'Enter purpose',
      '{"label_zh":"联系目的","repeatable":true,"repeat_group":"vietnam_contacts","max_items":5,"maxLength":200}'::jsonb,
      NULL,
      '{"showIf":"has_contact_in_vietnam === yes"}'::jsonb
    ),
    (
      'visited_vietnam_from_date',
      'From date',
      'date',
      true,
      6,
      'Trip Information',
      17,
      'DD/MM/YYYY',
      '{"label_zh":"上次赴越开始日期","repeatable":true,"repeat_group":"visited_vietnam_last_year","max_items":5}'::jsonb,
      NULL,
      '{"showIf":"visited_vietnam_in_last_year === yes"}'::jsonb
    ),
    (
      'visited_vietnam_to_date',
      'To date',
      'date',
      true,
      6,
      'Trip Information',
      18,
      'DD/MM/YYYY',
      '{"label_zh":"上次赴越结束日期","repeatable":true,"repeat_group":"visited_vietnam_last_year","max_items":5,"not_before_field":"visited_vietnam_from_date"}'::jsonb,
      NULL,
      '{"showIf":"visited_vietnam_in_last_year === yes"}'::jsonb
    ),
    (
      'visited_vietnam_trip_purpose',
      'Purpose of trip',
      'text',
      true,
      6,
      'Trip Information',
      19,
      'Enter purpose',
      '{"label_zh":"上次赴越目的","repeatable":true,"repeat_group":"visited_vietnam_last_year","max_items":5,"maxLength":200}'::jsonb,
      NULL,
      '{"showIf":"visited_vietnam_in_last_year === yes"}'::jsonb
    ),
    (
      'accompanying_child_portrait_photo',
      'Portrait photography',
      'file',
      true,
      7,
      'Accompanying Children',
      4,
      'Upload portrait photo',
      '{"label_zh":"同行儿童证件照片","repeatable":true,"repeat_group":"accompanying_children","max_items":10,"accept":[".jpg",".jpeg",".png"],"helper_zh":"官方表单要求每名同行儿童上传照片。"}'::jsonb,
      NULL,
      '{"showIf":"has_accompanying_children === yes"}'::jsonb
    ),
    (
      'travel_insurance_specify',
      'Specify',
      'text',
      true,
      8,
      'Travel Expenses and Insurance',
      3,
      'Enter specify',
      '{"label_zh":"保险说明","maxLength":200}'::jsonb,
      NULL,
      '{"showIf":"bought_travel_insurance === yes"}'::jsonb
    ),
    (
      'expense_payment_method',
      'Payment method',
      'select',
      true,
      8,
      'Travel Expenses and Insurance',
      5,
      'Choose one',
      '{"label_zh":"付款方式","live_dom_id":"basic_kpbhHinhThuc"}'::jsonb,
      '[{"value":"cash","text":"Cash","label_zh":"现金","label_en":"Cash"},{"value":"credit_card","text":"Credit card","label_zh":"信用卡","label_en":"Credit card"},{"value":"travellers_cheques","text":"Traveller''s cheques","label_zh":"旅行支票","label_en":"Traveller''s cheques"}]'::jsonb,
      '{"showIf":"expense_coverage === personal || expense_coverage === company"}'::jsonb
    ),
    (
      'expense_company_name',
      'Name of Company/Agency',
      'text',
      true,
      8,
      'Travel Expenses and Insurance',
      6,
      'Enter name of Company/Agency',
      '{"label_zh":"承担费用的公司/机构名称","maxLength":200}'::jsonb,
      NULL,
      '{"showIf":"expense_coverage === company"}'::jsonb
    ),
    (
      'expense_company_address',
      'Address',
      'text',
      true,
      8,
      'Travel Expenses and Insurance',
      7,
      'Enter address',
      '{"label_zh":"公司/机构地址","maxLength":300}'::jsonb,
      NULL,
      '{"showIf":"expense_coverage === company"}'::jsonb
    ),
    (
      'expense_company_telephone',
      'Telephone number',
      'text',
      true,
      8,
      'Travel Expenses and Insurance',
      8,
      'Enter telephone number',
      '{"label_zh":"公司/机构电话","maxLength":40}'::jsonb,
      NULL,
      '{"showIf":"expense_coverage === company"}'::jsonb
    )
)
INSERT INTO visa_form_fields (
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
  conditional_logic,
  created_at,
  updated_at
)
SELECT
  'VN_E_VISA',
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
  conditional_logic,
  now(),
  now()
FROM fields
ON CONFLICT (visa_type, field_name)
DO UPDATE SET
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
  updated_at = now();
