-- Make the Chinese side of active visa/arrival-card schemas read naturally.
-- Official English labels, option values, and submission mappings are unchanged.

WITH field_labels(visa_type, field_name, label_zh) AS (
  VALUES
    ('DS160', 'has_social_media', '过去五年内是否使用过任何社交媒体平台？'),
    ('DS160', 'passport_has_expiry', '您的护照是否有明确的到期日期？'),
    ('DS160', 'vwp_denial', '您是否曾被拒绝美国免签计划（ESTA）授权？'),
    ('EU_SCHENGEN_C_SHORT_STAY', 'atv_airside_only', '您是否会一直停留在申根机场的国际中转区内，不办理入境手续？'),
    ('EU_SCHENGEN_C_SHORT_STAY', 'atv_annex_iv_acknowledged', '我已了解机场过境签证（ATV）及申根区过境规定'),
    ('EU_SCHENGEN_C_SHORT_STAY', 'directive_2004_38_acknowledged', '我已确认本申请是否适用欧盟、欧洲经济区或瑞士公民家庭成员的自由流动规则'),
    ('EU_SCHENGEN_C_SHORT_STAY', 'event_invitation_letter_held', '您是否持有活动主办方出具的邀请函？'),
    ('EU_SCHENGEN_C_SHORT_STAY', 'has_national_id', '您是否有国民身份证号码？'),
    ('EU_SCHENGEN_C_SHORT_STAY', 'medical_costs_prepaid', '医疗费用是否已经预付，或已由医疗机构确认付款安排？'),
    ('EU_SCHENGEN_C_SHORT_STAY', 'study_acceptance_letter_held', '您是否持有学校或教育机构出具的录取/接收证明？'),
    ('EU_SCHENGEN_C_SHORT_STAY', 'transit_onward_ticket_held', '您是否持有已确认的续程机票？'),
    ('EU_SCHENGEN_C_SHORT_STAY', 'visits_french_overseas_territories', '您是否计划前往法国海外领地？'),
    ('JP_TOURIST', 'accommodation_phone', '住宿地点/接待方联系电话'),
    ('JP_TOURIST', 'employer_or_school_address', '雇主或学校地址'),
    ('JP_TOURIST', 'employer_or_school_name', '雇主或学校名称'),
    ('JP_TOURIST', 'employer_or_school_phone', '雇主或学校联系电话'),
    ('JP_TOURIST', 'has_inviter_in_japan', '您在日本是否有邀请人或担保人？'),
    ('JP_TOURIST', 'has_other_names_used', '您是否曾使用过其他姓名（如曾用名、笔名或别名）？'),
    ('JP_TOURIST', 'has_overstayed_japan', '您是否曾逾期停留，或曾在日本非法居留？'),
    ('JP_TOURIST', 'id_card_number', '本国身份证件号码（如适用）'),
    ('JP_TOURIST', 'inviter_date_of_birth', '邀请人出生日期'),
    ('JP_TOURIST', 'inviter_employer', '邀请人在日本的雇主名称及地址'),
    ('JP_TOURIST', 'inviter_full_name', '邀请人完整姓名'),
    ('JP_TOURIST', 'inviter_immigration_status', '邀请人在日本的居留身份（仅外国籍邀请人填写）'),
    ('JP_TOURIST', 'inviter_relationship_to_applicant', '邀请人与申请人的关系'),
    ('JP_TOURIST', 'inviter_sex', '邀请人性别'),
    ('JP_TOURIST', 'other_passport_country', '其他护照的签发国家/地区'),
    ('JP_TOURIST', 'prior_japan_visit_arrival_date', '上次赴日抵达日期'),
    ('JP_TOURIST', 'prior_japan_visit_departure_date', '上次赴日离境日期'),
    ('JP_TOURIST', 'prior_japan_visit_purpose', '上次赴日目的'),
    ('JP_TOURIST', 'purpose_of_visit', '本次赴日目的'),
    ('JP_TOURIST', 'remarks_special_circumstances', '备注或特殊情况（选填）'),
    ('JP_TOURIST', 'spouse_date_of_birth', '配偶出生日期'),
    ('JP_TOURIST', 'visited_japan_before', '您以前是否曾在日本停留？'),
    ('VN_E_VISA', 'has_relatives_in_vietnam', '您是否有亲属目前居住在越南？'),
    ('TW_ENTRY_PERMIT', 'accepted_terms', '我已阅读并同意以下条款与声明'),
    ('TW_ENTRY_PERMIT', 'birth_place_is_mainland', '您的出生地是否在中国大陆？'),
    ('TW_ENTRY_PERMIT', 'birth_place_mainland_region', '中国大陆出生省/市/地区'),
    ('TW_ENTRY_PERMIT', 'birth_place_other_country', '出生国家/地区'),
    ('TW_ENTRY_PERMIT', 'company_name', '任职单位、所属机构或就读学校全称'),
    ('TW_ENTRY_PERMIT', 'continent', '所在大洲'),
    ('TW_ENTRY_PERMIT', 'current_mainland_political_military_role', '您目前是否在中国大陆党政军机关、政治性组织或相关团体任职或具有成员身份？'),
    ('TW_ENTRY_PERMIT', 'current_role_detail', '目前任职的机关、组织或团体全称'),
    ('TW_ENTRY_PERMIT', 'eligibility_category', '申请资格类别'),
    ('TW_ENTRY_PERMIT', 'embassy_office', '受理驻外馆处/办事处'),
    ('TW_ENTRY_PERMIT', 'first_time_applying', '这是您首次在海外、香港或澳门申请赴台吗？'),
    ('TW_ENTRY_PERMIT', 'household_revoked', '中国大陆户籍当前状态'),
    ('TW_ENTRY_PERMIT', 'is_taiwanese_spouse', '您是否为台湾居民的配偶？'),
    ('TW_ENTRY_PERMIT', 'local_mobile_phone', '现居地手机号码（含国家/地区区号）'),
    ('TW_ENTRY_PERMIT', 'mainland_id_number', '中国大陆居民身份证号码'),
    ('TW_ENTRY_PERMIT', 'mainland_id_number_not_applicable', '没有中国大陆居民身份证号码'),
    ('TW_ENTRY_PERMIT', 'name_chinese', '中文姓名（繁体字）'),
    ('TW_ENTRY_PERMIT', 'name_english', '英文姓名（按护照填写大写字母）'),
    ('TW_ENTRY_PERMIT', 'never_held_mainland_political_military_role', '本人从未在中国大陆党政军机关、政治性组织或相关团体任职或具有成员身份'),
    ('TW_ENTRY_PERMIT', 'occupation_experience', '工作经历'),
    ('TW_ENTRY_PERMIT', 'other_nationality_country', '持有或曾持有的其他国籍'),
    ('TW_ENTRY_PERMIT', 'overseas_address', '香港、澳门或海外现居地址'),
    ('TW_ENTRY_PERMIT', 'overseas_residency_id_number', '海外居留身份证明号码（如永居证、居留卡或签证号码）'),
    ('TW_ENTRY_PERMIT', 'passport_expiry_date', '护照/旅行证件有效期至（公历）'),
    ('TW_ENTRY_PERMIT', 'passport_number', '护照或旅行证件号码'),
    ('TW_ENTRY_PERMIT', 'past_mainland_political_military_role', '您过去是否曾在中国大陆党政军机关、政治性组织或相关团体任职或具有成员身份？'),
    ('TW_ENTRY_PERMIT', 'past_role_detail', '过去任职的机关、组织或团体全称'),
    ('TW_ENTRY_PERMIT', 'permit_count', '申请入台许可的次数'),
    ('TW_ENTRY_PERMIT', 'permit_type', '申请的入台许可类型'),
    ('TW_ENTRY_PERMIT', 'traveling_with_parents', '您的父母是否与您一同赴台？'),
    ('TW_ENTRY_PERMIT', 'tw_contact_alley', '台湾地址—弄号（只填数字）'),
    ('TW_ENTRY_PERMIT', 'tw_contact_building_number', '台湾地址—门牌、楼层及房号（入住酒店可填酒店名称）'),
    ('TW_ENTRY_PERMIT', 'tw_contact_city', '台湾地址—县市'),
    ('TW_ENTRY_PERMIT', 'tw_contact_district', '台湾地址—区/乡/镇'),
    ('TW_ENTRY_PERMIT', 'tw_contact_lane', '台湾地址—巷号（只填数字）'),
    ('TW_ENTRY_PERMIT', 'tw_contact_mobile', '台湾联系人手机号码'),
    ('TW_ENTRY_PERMIT', 'tw_contact_mobile_not_applicable', '没有台湾联系人手机号码'),
    ('TW_ENTRY_PERMIT', 'tw_contact_neighborhood', '台湾地址—邻号（只填数字）'),
    ('TW_ENTRY_PERMIT', 'tw_contact_road', '台湾地址—街路及段'),
    ('TW_ENTRY_PERMIT', 'tw_contact_village', '台湾地址—村/里（选填）'),
    ('TW_ENTRY_PERMIT', 'tw_local_phone', '台湾市内电话号码')
)
UPDATE public.visa_form_fields AS field
SET validation_rules = COALESCE(field.validation_rules, '{}'::jsonb)
      || jsonb_build_object('label_zh', labels.label_zh),
    updated_at = now()
FROM field_labels AS labels
WHERE field.visa_type = labels.visa_type
  AND field.field_name = labels.field_name;

WITH people(person_key, person_label) AS (
  VALUES
    ('father', '父亲'),
    ('mother', '母亲'),
    ('spouse', '配偶'),
    ('child1', '第一名子女'),
    ('child2', '第二名子女')
), details(detail_key, detail_label) AS (
  VALUES
    ('current_address', '当前住址'),
    ('current_address_same_as_overseas', '当前住址是否与申请人的港澳或海外住址相同？'),
    ('date_of_birth', '出生日期'),
    ('job_title', '职务/职称'),
    ('name', '姓名'),
    ('occupation', '职业'),
    ('phone', '联系电话'),
    ('service_unit', '任职单位/所属机构'),
    ('status', '当前状况（在世、已故或离异）')
), kin_labels AS (
  SELECT
    format('kin_%s_%s', people.person_key, details.detail_key) AS field_name,
    people.person_label || '—' || details.detail_label AS label_zh
  FROM people
  CROSS JOIN details
)
UPDATE public.visa_form_fields AS field
SET validation_rules = COALESCE(field.validation_rules, '{}'::jsonb)
      || jsonb_build_object('label_zh', labels.label_zh),
    updated_at = now()
FROM kin_labels AS labels
WHERE field.visa_type = 'TW_ENTRY_PERMIT'
  AND field.field_name = labels.field_name;

WITH option_translations(source_text, label_zh) AS (
  VALUES
    ('nile cruise / ship', '尼罗河游轮/船舶'),
    ('teaching', '教育/教学'),
    ('trade; car and motorcycle repairs', '贸易及汽车、摩托车维修'),
    ('linggi', '林吉'),
    ('p pinang', '槟城'),
    ('pekenu', '贝克努'),
    ('pulau pinang', '槟城'),
    ('klia2 / klia2 terminal', '吉隆坡第二国际机场航站楼（KLIA2）'),
    ('sungai tujoh (brunei border, sarawak)', '双溪都九口岸（砂拉越—文莱边境）'),
    ('colds', '流鼻涕/感冒症状'),
    ('cough', '咳嗽'),
    ('diarrhea', '腹泻'),
    ('difficulty of breathing', '呼吸困难'),
    ('dizziness', '头晕'),
    ('fever', '发热'),
    ('headache', '头痛'),
    ('loss of appetite', '食欲不振'),
    ('loss of smell', '嗅觉丧失'),
    ('loss of taste', '味觉丧失'),
    ('muscle pain', '肌肉疼痛'),
    ('nausea', '恶心'),
    ('rashes, vesicles or blisters', '皮疹、水疱或疱疹'),
    ('sore throat', '咽喉痛'),
    ('vomiting', '呕吐'),
    ('weakness', '乏力'),
    ('jr.', '小（Jr.）'),
    ('ii', '第二代（II）'),
    ('iii', '第三代（III）'),
    ('iv', '第四代（IV）'),
    ('subic bay freeport', '苏比克湾自由港'),
    ('woodlands checkpoint (causeway / land)', '兀兰关卡（新柔长堤，陆路）'),
    ('tuas checkpoint (second link / land)', '大士关卡（第二通道，陆路）'),
    ('marina bay cruise centre (cruise)', '滨海湾邮轮中心（海路）'),
    ('nong khai (lao border, mittraphap bridge)', '廊开口岸（泰老友谊大桥）')
), translated_fields AS (
  SELECT
    field.id,
    jsonb_agg(
      CASE
        WHEN translations.label_zh IS NOT NULL
          THEN option_item || jsonb_build_object('label_zh', translations.label_zh)
        ELSE option_item
      END
      ORDER BY option_order
    ) AS translated_options
  FROM public.visa_form_fields AS field
  CROSS JOIN LATERAL jsonb_array_elements(field.options) WITH ORDINALITY
    AS option_rows(option_item, option_order)
  LEFT JOIN option_translations AS translations
    ON lower(COALESCE(
      option_item ->> 'label_en',
      option_item ->> 'text',
      option_item ->> 'value',
      ''
    )) = translations.source_text
  WHERE jsonb_typeof(field.options) = 'array'
  GROUP BY field.id
  HAVING bool_or(translations.label_zh IS NOT NULL)
)
UPDATE public.visa_form_fields AS field
SET options = translated.translated_options,
    updated_at = now()
FROM translated_fields AS translated
WHERE field.id = translated.id;
