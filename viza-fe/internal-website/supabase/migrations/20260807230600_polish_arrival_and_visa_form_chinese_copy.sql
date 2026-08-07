-- Replace literal or source-language Chinese copy in active arrival-card and
-- visa schemas. Official English labels, stored values, and submission
-- mappings remain unchanged.

WITH field_copy(visa_type, field_name, label_zh, helper_zh) AS (
  VALUES
    ('MY_MDAC_ARRIVAL_CARD', 'full_name', '护照上的姓名', NULL),
    ('MY_MDAC_ARRIVAL_CARD', 'email_address', '电子邮箱地址', NULL),
    ('MY_MDAC_ARRIVAL_CARD', 'transport_number', '航班号/车辆或船舶编号', NULL),
    ('MY_MDAC_ARRIVAL_CARD', 'last_embarkation_country', '抵达马来西亚前最后出发的国家/地区', NULL),
    ('MY_MDAC_ARRIVAL_CARD', 'state', '州/联邦直辖区', NULL),
    ('SG_ARRIVAL_CARD', 'last_city_or_port_before_singapore', '抵达新加坡前最后出发的城市/港口', NULL),
    ('SG_ARRIVAL_CARD', 'next_city_or_port_after_singapore', '离开新加坡后下船/抵达的下一城市/港口', NULL),
    ('SG_ARRIVAL_CARD', 'accommodation_unit_number', '单元号', NULL),
    ('TH_TDAC_ARRIVAL_CARD', 'country_boarded', '出发国家/地区', NULL),
    ('TH_TDAC_ARRIVAL_CARD', 'arrival_transport_number', '抵达航班号/车辆或船舶编号', NULL),
    ('TH_TDAC_ARRIVAL_CARD', 'departure_transport_number', '离境航班号/车辆或船舶编号', NULL),
    ('TH_TDAC_ARRIVAL_CARD', 'province', '府（省级行政区）', NULL),
    ('TH_TDAC_ARRIVAL_CARD', 'district', '县/区（Amphoe）', NULL),
    ('TH_TDAC_ARRIVAL_CARD', 'sub_district', '分区/乡（Tambon）', NULL),
    ('TH_TDAC_ARRIVAL_CARD', 'yellow_fever_vaccination_date', '黄热病疫苗接种日期', '官网还会要求上传黄热病预防接种证书。'),
    ('VN_PREARRIVAL_DECLARATION', 'surname', '姓氏（按护照）', NULL),
    ('VN_PREARRIVAL_DECLARATION', 'given_name', '名字（按护照）', NULL),
    ('VN_PREARRIVAL_DECLARATION', 'visa_information_acknowledgement', '我已阅读并理解此信息', '请提供越南签证信息（如适用）。所选签证类型决定允许入境的期限；请填写签证编号，以便在机场使用该服务。'),
    ('VN_PREARRIVAL_DECLARATION', 'visa_type', '签证类型/入境目的', NULL),
    ('VN_PREARRIVAL_DECLARATION', 'visa_number', '签证号码/编号', NULL),
    ('VN_PREARRIVAL_DECLARATION', 'custom_flight_number', '手动填写航班号', '仅当官方航班列表中找不到您的航班时填写。'),
    ('VN_PREARRIVAL_DECLARATION', 'vehicle_identification_number', '车辆/船舶识别编号', NULL),
    ('VN_PREARRIVAL_DECLARATION', 'other_accommodation_address', '其他住宿地址', '仅当官方酒店列表中找不到您的住宿地址时填写。'),
    ('VN_PREARRIVAL_DECLARATION', 'final_declaration', '我确认以上信息真实、准确且完整', NULL),
    ('VN_E_VISA', 'given_name', '护照上的名字及中间名', NULL),
    ('VN_E_VISA', 'visa_valid_to', '电子签证有效期至哪一天？', NULL),
    ('VN_E_VISA', 'passport_issuing_authority', '护照签发机关/地点', NULL),
    ('VN_E_VISA', 'passport_type', '护照类型', NULL),
    ('VN_E_VISA', 'position_course', '职位/学习课程', NULL),
    ('VN_E_VISA', 'has_relatives_in_vietnam', '您是否有亲属目前居住在越南？', NULL),
    ('VN_E_VISA', 'intended_ward_commune', '在越南拟停留坊/社', '官方门户可能会根据省/市动态加载此选项；如无法确认，请先保留可供核对的地址信息。'),
    ('KR_C39_SHORT_TERM_VISIT', 'inviter_address', '邀请人在韩国的地址', NULL),
    ('KR_C39_SHORT_TERM_VISIT', 'invitation_company_business_registration_no', '营业登记号码', NULL),
    ('KR_C39_SHORT_TERM_VISIT', 'invitation_company_name', '邀请公司名称', NULL),
    ('KR_C39_SHORT_TERM_VISIT', 'cost_payer_support_type', '资助内容', NULL)
)
UPDATE public.visa_form_fields AS field
SET validation_rules = COALESCE(field.validation_rules, '{}'::jsonb)
      || jsonb_build_object('label_zh', copy.label_zh)
      || CASE
           WHEN copy.helper_zh IS NULL THEN '{}'::jsonb
           ELSE jsonb_build_object('helper_zh', copy.helper_zh)
         END,
    updated_at = now()
FROM field_copy AS copy
WHERE field.visa_type = copy.visa_type
  AND field.field_name = copy.field_name;

WITH option_copy(visa_type, field_name, option_value, label_zh) AS (
  VALUES
    ('MY_MDAC_ARRIVAL_CARD', 'accommodation_type', '01', '酒店/汽车旅馆/休闲旅舍'),
    ('VN_PREARRIVAL_DECLARATION', 'visa_type', 'MMT', '按国籍适用的默认免签政策'),
    ('VN_PREARRIVAL_DECLARATION', 'visa_type', 'ABTC', 'APEC商务旅行卡（ABTC）'),
    ('KR_C39_SHORT_TERM_VISIT', 'employment_status', 'employed', '在职人员'),
    ('KR_C39_SHORT_TERM_VISIT', 'purpose_of_visit', 'medical_tourism', '医疗旅游'),
    ('KR_C39_SHORT_TERM_VISIT', 'purpose_of_visit', 'overseas_korean_visit', '海外同胞短期/长期访问'),
    ('KR_C39_SHORT_TERM_VISIT', 'korea_address_mode', 'address_not_found', '未找到地址'),
    ('EU_SCHENGEN_C_SHORT_STAY', 'employment_sector', 'Q', '医疗卫生和社会工作')
), rewritten AS (
  SELECT
    field.id,
    jsonb_agg(
      CASE
        WHEN copy.label_zh IS NULL THEN option_item
        ELSE option_item || jsonb_build_object('label_zh', copy.label_zh)
      END
      ORDER BY option_order
    ) AS options
  FROM public.visa_form_fields AS field
  CROSS JOIN LATERAL jsonb_array_elements(field.options) WITH ORDINALITY
    AS option_rows(option_item, option_order)
  LEFT JOIN option_copy AS copy
    ON copy.visa_type = field.visa_type
   AND copy.field_name = field.field_name
   AND copy.option_value = option_item ->> 'value'
  WHERE EXISTS (
    SELECT 1
    FROM option_copy AS expected
    WHERE expected.visa_type = field.visa_type
      AND expected.field_name = field.field_name
  )
  GROUP BY field.id
  HAVING bool_or(copy.label_zh IS NOT NULL)
)
UPDATE public.visa_form_fields AS field
SET options = rewritten.options,
    updated_at = now()
FROM rewritten
WHERE field.id = rewritten.id;
