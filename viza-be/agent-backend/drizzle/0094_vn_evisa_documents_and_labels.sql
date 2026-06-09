-- Vietnam e-Visa document checklist and bilingual label refinements.
--
-- Official Vietnam e-Visa intake requires a passport data-page image and a
-- portrait photo. Keep travel itinerary optional for VIZA review context, but
-- do not block submission on generic fallback documents such as bank proof.

WITH vn_package AS (
  SELECT id
  FROM visa_packages
  WHERE lower(country) = 'vietnam'
    AND upper(visa_type) = 'VN_E_VISA'
  ORDER BY created_at DESC NULLS LAST
  LIMIT 1
),
requirements AS (
  SELECT
    id AS visa_package_id,
    'vietnam'::text AS country,
    'VN_E_VISA'::text AS visa_type,
    item.requirement_key,
    item.label_en,
    item.label_zh,
    item.description,
    item.required,
    item.sort_order,
    item.metadata
  FROM vn_package
  CROSS JOIN (
    VALUES
      (
        'passport_copy',
        'Passport data page image',
        '护照资料页图片',
        'Clear image of the passport bio-data page used for the Vietnam e-Visa application.',
        true,
        10,
        '{"document_type":"passport_copy","accept":[".jpg",".jpeg",".png",".webp"],"source":"official_vietnam_evisa_portal"}'::jsonb
      ),
      (
        'photo',
        'Portrait photo',
        '本人证件照片',
        'Recent portrait photo suitable for the Vietnam e-Visa portal upload.',
        true,
        20,
        '{"document_type":"photo","accept":[".jpg",".jpeg",".png"],"source":"official_vietnam_evisa_portal"}'::jsonb
      ),
      (
        'travel_itinerary',
        'Travel itinerary',
        '旅行行程（可选）',
        'Optional VIZA review aid. Vietnam official e-Visa intake does not require this upload by default.',
        false,
        30,
        '{"document_type":"travel_itinerary","accept":[".pdf",".doc",".docx",".json"],"source":"viza_optional_review"}'::jsonb
      )
  ) AS item(requirement_key, label_en, label_zh, description, required, sort_order, metadata)
)
INSERT INTO document_requirements (
  visa_package_id,
  country,
  visa_type,
  requirement_key,
  label_en,
  label_zh,
  description,
  required,
  sort_order,
  metadata,
  updated_at
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
  metadata,
  now()
FROM requirements
ON CONFLICT (visa_package_id, requirement_key) WHERE visa_package_id IS NOT NULL
DO UPDATE SET
  country = EXCLUDED.country,
  visa_type = EXCLUDED.visa_type,
  label_en = EXCLUDED.label_en,
  label_zh = EXCLUDED.label_zh,
  description = EXCLUDED.description,
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order,
  metadata = EXCLUDED.metadata,
  updated_at = now();

WITH labels(field_name, label_en, label_zh, placeholder_zh, helper_zh, helper_en) AS (
  VALUES
    ('surname', 'Surname (Last name)', '护照姓氏', '请填写护照上的姓氏', NULL, NULL),
    ('given_name', 'Middle and given name (First name)', '护照名字及中间名', '请填写护照上的名字及中间名', NULL, NULL),
    ('date_of_birth', 'Date of birth', '出生日期', '日/月/年', NULL, NULL),
    ('sex', 'Sex', '性别', NULL, NULL, NULL),
    ('nationality', 'Nationality', '国籍', '请选择护照国籍', NULL, NULL),
    ('identity_card_number', 'Identity card number', '身份证或本国身份号码（如有）', '如无可留空', NULL, NULL),
    ('email_address', 'Email', '用于接收越南电子签证通知的邮箱', '请填写可接收官方通知的邮箱', '官方查询和通知会使用该邮箱，请确保与最终提交到越南官方门户的邮箱一致。', 'The official portal uses this email for notices and status lookup. It must match the final official submission.'),
    ('re_enter_email_address', 'Re-enter Email', '再次输入邮箱', '请再次输入同一邮箱', '必须与上一项邮箱一致。', 'This must match the email above.'),
    ('religion', 'Religion', '宗教信仰', '如无宗教信仰，可填写 None', NULL, NULL),
    ('place_of_birth', 'Place of birth', '出生地', '请按护照或出生证明填写', NULL, NULL),
    ('has_multiple_nationalities', 'Have you ever held any other nationalities?', '是否还拥有或曾拥有其他国籍？', NULL, '如当前或过去拥有其他国籍，请选择“是”并补充国籍。', 'Select Yes if you currently hold or previously held another nationality.'),
    ('other_nationality', 'Other nationality', '其他国籍', '请选择其他国籍', NULL, NULL),
    ('has_violated_vietnam_laws', 'Have you violated Vietnamese laws/regulations?', '是否曾违反越南法律或法规？', NULL, '如曾在越南有违法、处罚、驱逐或类似记录，请选择“是”并说明。', 'Select Yes if you have any Vietnam law, penalty, removal, or similar record to declare.'),
    ('visa_type_requested', 'Type of visa requested', '申请单次或多次入境电子签证', NULL, NULL, NULL),
    ('visa_valid_from', 'Grant e-Visa valid from', '希望电子签证从哪一天开始生效？', '日/月/年', '越南电子签证有效期最多90天，请与行程日期保持一致。', 'Vietnam e-Visas can be valid for up to 90 days. Keep this aligned with your travel dates.'),
    ('visa_valid_to', 'Grant e-Visa valid to', '希望电子签证有效期到哪一天结束？', '日/月/年', '结束日期不能早于开始日期。', 'The end date must not be before the start date.'),
    ('passport_number', 'Passport number', '护照号码', '请填写护照号码', NULL, NULL),
    ('passport_issuing_authority', 'Issuing Authority/Place of issue', '签发机关/签发地点', '请填写签发机关或签发地点', NULL, NULL),
    ('passport_type', 'Passport type', '护照种类', NULL, NULL, NULL),
    ('passport_issue_date', 'Date of issue', '护照签发日期', '日/月/年', NULL, NULL),
    ('passport_expiry_date', 'Expiry date', '护照到期日期', '日/月/年', NULL, NULL),
    ('permanent_residential_address', 'Permanent residential address', '永久居住地址', '请填写长期居住地址', NULL, NULL),
    ('contact_address', 'Contact address', '当前联系地址', '请填写当前可联系地址', NULL, NULL),
    ('telephone_number', 'Telephone number', '联系电话', '请填写含国家/地区号的电话号码', NULL, NULL),
    ('emergency_contact_full_name', 'Emergency contact full name', '紧急联系人姓名', '请填写紧急联系人姓名', NULL, NULL),
    ('emergency_contact_current_address', 'Emergency contact current residential address', '紧急联系人当前住址', '请填写紧急联系人当前地址', NULL, NULL),
    ('emergency_contact_telephone', 'Emergency contact telephone number', '紧急联系人电话', '请填写紧急联系人电话', NULL, NULL),
    ('emergency_contact_relationship', 'Emergency contact relationship', '紧急联系人关系', '例如：父母、配偶、兄弟姐妹、朋友', NULL, NULL),
    ('occupation', 'Occupation', '职业', NULL, NULL, NULL),
    ('occupation_info', 'Current occupation details', '当前职业说明', '请说明当前职业或身份', NULL, NULL),
    ('company_or_school_name', 'Name of Company/Agency/School', '公司/机构/学校名称', '请填写公司、机构或学校名称', NULL, NULL),
    ('position_course', 'Position or course of study', '职位或课程', '请填写职位、职务或课程名称', NULL, NULL),
    ('company_address', 'Address of Company/Agency/School', '公司/机构/学校地址', '请填写公司、机构或学校地址', NULL, NULL),
    ('company_phone', 'Company/agency/school telephone number', '公司/机构/学校电话', '请填写公司、机构或学校电话', NULL, NULL),
    ('purpose_of_entry', 'Purpose of entry', '本次入境越南目的', NULL, NULL, NULL),
    ('intended_date_of_entry', 'Intended date of entry', '预计入境日期', '日/月/年', NULL, NULL),
    ('intended_length_of_stay', 'Intended length of stay in Viet Nam (days)', '预计在越南停留天数', '请填写1至90之间的天数', NULL, NULL),
    ('phone_in_vietnam', 'Phone number (in Viet Nam)', '越南境内电话号码', '如有越南联系电话请填写', NULL, NULL),
    ('residential_address_in_vietnam', 'Residential address in Viet Nam', '在越南拟停留地址', '请填写酒店、住址或邀请方地址', '可填写酒店、住宿、邀请方或预计停留地址。', 'Use your hotel, accommodation, host, or planned stay address in Viet Nam.'),
    ('intended_province_city', 'Intended province/city in Viet Nam', '在越南拟停留省/市', '请选择省或直辖市', NULL, NULL),
    ('intended_ward_commune', 'Intended ward/commune in Viet Nam', '在越南拟停留坊/社', '请在选择省/市后填写或选择坊/社', '官方门户可能根据省/市动态加载该选项；如无法确认，请保存为可核对的地址信息。', 'The official portal may load this dynamically after province/city selection.'),
    ('intended_border_gate_of_entry', 'Intended border gate of entry', '预计入境口岸', NULL, NULL, NULL),
    ('intended_border_gate_of_exit', 'Intended border gate of exit', '预计出境口岸', NULL, NULL, NULL),
    ('declaration_temporary_residence', 'I commit to declare temporary residence according to Vietnamese law', '是否承诺抵达后按越南法律申报临时居住？', NULL, '抵达越南后通常需要按当地规定完成住宿或临时居住申报。', 'After arrival, temporary residence/accommodation reporting may be required under local rules.'),
    ('visited_vietnam_in_last_year', 'Have you ever been to Viet Nam in the last 01 year?', '过去一年是否曾到访越南？', NULL, NULL, NULL),
    ('visited_vietnam_purpose_detail', 'Purpose of the last visit and date of arrival', '上次访问越南的目的和入境日期', '请写明上次到访目的和入境日期', NULL, NULL),
    ('has_relatives_in_vietnam', 'Do you have relatives currently residing in Viet Nam?', '是否有亲属目前居住在越南', NULL, NULL, NULL),
    ('relative_full_name_in_vn', 'Relative''s full name', '在越亲属姓名', '请填写在越亲属姓名', NULL, NULL),
    ('relative_date_of_birth', 'Relative''s date of birth', '在越亲属出生日期', '日/月/年', NULL, NULL),
    ('relative_nationality', 'Relative''s nationality', '在越亲属国籍', '请选择亲属国籍', NULL, NULL),
    ('relative_relationship', 'Relationship to the relative in Viet Nam', '与在越亲属的关系', '例如：父母、配偶、兄弟姐妹、叔伯、朋友', NULL, NULL),
    ('relative_address_in_vn', 'Relative''s address in Vietnam', '在越亲属地址', '请填写亲属在越南的地址', NULL, NULL),
    ('child_full_name', 'Full name (child under 14 on same passport)', '同一本护照上同行的14岁以下儿童姓名', '请填写同行儿童姓名', NULL, NULL),
    ('child_sex', 'Sex', '同行儿童性别', NULL, NULL, NULL),
    ('child_date_of_birth', 'Date of birth', '同行儿童出生日期', '日/月/年', NULL, NULL),
    ('intended_expenses_usd', 'Intended expenses (in USD)', '预计费用（美元）', '请填写预计美元金额', NULL, NULL),
    ('bought_travel_insurance', 'Have you bought travel insurance?', '是否已购买本次旅行保险？', NULL, NULL, NULL),
    ('expense_coverage', 'Who will cover the applicant''s trip expenses?', '谁承担申请人的旅行费用？', NULL, NULL, NULL),
    ('violation_of_vietnam_laws_details', 'Details of Vietnamese law/regulation violation', '请说明违反越南法律或法规的具体情况', '请如实说明时间、事项和处理结果', NULL, NULL),
    ('final_declaration', 'I hereby declare that the above statements are true, accurate, and complete, and I accept responsibility under Vietnamese law for any false declaration', '确认以上信息真实、准确、完整，并愿意对虚假申报承担责任', NULL, '提交前请确认所有答案与护照、行程和上传材料一致。', 'Before submitting, confirm every answer matches the passport, itinerary, and uploaded materials.')
)
UPDATE visa_form_fields AS field
SET
  label = labels.label_en,
  validation_rules =
    COALESCE(field.validation_rules, '{}'::jsonb)
    || jsonb_build_object(
      'label_zh', labels.label_zh,
      'label_en', labels.label_en,
      'official_label_en', labels.label_en,
      'placeholder_zh', labels.placeholder_zh,
      'placeholder_en', field.placeholder,
      'helper_zh', labels.helper_zh,
      'helper_en', labels.helper_en
    ),
  updated_at = now()
FROM labels
WHERE field.visa_type = 'VN_E_VISA'
  AND field.field_name = labels.field_name;
