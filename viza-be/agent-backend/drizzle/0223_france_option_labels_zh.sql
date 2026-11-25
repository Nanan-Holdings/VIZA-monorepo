-- Chinese labels for the France (Schengen C) form's choice options.
-- Most options only had English `text`, so the client derived Chinese from the
-- option value and sometimes got it wrong (civil_status "single" read "单次",
-- the number-of-entries wording). fv_business_segment J / M / OTH had
-- "????" from a mis-encoded earlier write.
-- Sets option.label_zh only (value, text and label_en are unchanged).
-- A field-specific label wins over the generic yes/no row ('*'). Idempotent.
WITH labels(field_name, value, zh) AS (VALUES
  ('*', 'yes', '是'),
  ('*', 'no', '否'),
  ('sex', 'male', '男'),
  ('sex', 'female', '女'),
  ('sex', 'other', '其他'),
  ('civil_status', 'single', '未婚'),
  ('civil_status', 'married', '已婚'),
  ('civil_status', 'registered_partnership', '登记伴侣关系'),
  ('civil_status', 'separated', '分居'),
  ('civil_status', 'divorced', '离婚'),
  ('civil_status', 'widowed', '丧偶'),
  ('civil_status', 'other', '其他'),
  ('travel_document_type', 'ordinary', '普通护照'),
  ('travel_document_type', 'diplomatic', '外交护照'),
  ('travel_document_type', 'service', '公务护照'),
  ('travel_document_type', 'official', '因公护照'),
  ('travel_document_type', 'special', '特殊护照'),
  ('travel_document_type', 'other', '其他旅行证件'),
  ('purpose_of_journey', 'tourism', '旅游'),
  ('purpose_of_journey', 'business', '商务'),
  ('purpose_of_journey', 'visiting_family_friends', '探亲访友'),
  ('purpose_of_journey', 'cultural', '文化'),
  ('purpose_of_journey', 'sports', '体育'),
  ('purpose_of_journey', 'official_visit', '官方访问'),
  ('purpose_of_journey', 'medical', '就医'),
  ('purpose_of_journey', 'study', '学习'),
  ('purpose_of_journey', 'airport_transit', '机场过境'),
  ('purpose_of_journey', 'other', '其他'),
  ('number_of_entries_requested', 'single', '一次入境'),
  ('number_of_entries_requested', 'two', '两次入境'),
  ('number_of_entries_requested', 'multiple', '多次入境'),
  ('accommodation_type', 'hotel', '酒店'),
  ('accommodation_type', 'rented', '租住的房屋或公寓'),
  ('accommodation_type', 'private_host', '住在亲友家'),
  ('accommodation_type', 'other', '其他'),
  ('cost_covered_by', 'self', '申请人本人'),
  ('cost_covered_by', 'sponsor', '担保人'),
  ('cost_covered_by', 'both', '本人和担保人共同承担'),
  ('sponsor_type', 'host', '邀请人'),
  ('sponsor_type', 'company', '公司'),
  ('sponsor_type', 'organisation', '机构或组织'),
  ('sponsor_type', 'other', '其他'),
  ('host_legal_status_schengen', 'citizen', '公民'),
  ('host_legal_status_schengen', 'permanent_resident', '永久居民'),
  ('host_legal_status_schengen', 'temporary_resident', '临时居民'),
  ('host_legal_status_schengen', 'other', '其他'),
  ('eu_family_relationship', 'spouse', '配偶'),
  ('eu_family_relationship', 'registered_partner', '登记伴侣'),
  ('eu_family_relationship', 'child', '子女'),
  ('eu_family_relationship', 'grandchild', '孙子女或外孙子女'),
  ('eu_family_relationship', 'dependent_ascendant', '受抚养的直系长辈'),
  ('eu_family_relationship', 'other_dependent', '其他受抚养人'),
  ('eu_family_travel_document_type', 'passport', '护照'),
  ('eu_family_travel_document_type', 'id_card', '身份证'),
  ('fv_business_segment', 'J', '信息和通信'),
  ('fv_business_segment', 'M', '专业、科学和技术活动'),
  ('fv_business_segment', 'OTH', '其他行业')
)
UPDATE public.visa_form_fields AS f
SET options = (
      SELECT jsonb_agg(
        CASE
          WHEN z.zh IS NULL THEN e.o
          ELSE e.o || jsonb_build_object('label_zh', z.zh)
        END
        ORDER BY e.ord
      )
      FROM jsonb_array_elements(f.options) WITH ORDINALITY AS e(o, ord)
      LEFT JOIN LATERAL (
        SELECT COALESCE(
          (SELECT l.zh FROM labels l WHERE l.field_name = f.field_name AND l.value = e.o->>'value'),
          (SELECT l.zh FROM labels l WHERE l.field_name = '*' AND l.value = e.o->>'value')
        ) AS zh
      ) AS z ON TRUE
    ),
    updated_at = NOW()
WHERE f.visa_type = 'EU_SCHENGEN_C_SHORT_STAY'
  AND jsonb_typeof(f.options) = 'array'
  AND jsonb_array_length(f.options) > 0
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(f.options) AS x(o)
    JOIN labels l ON l.value = x.o->>'value' AND l.field_name IN (f.field_name, '*')
    WHERE x.o->>'label_zh' IS DISTINCT FROM COALESCE(
      (SELECT l2.zh FROM labels l2 WHERE l2.field_name = f.field_name AND l2.value = x.o->>'value'),
      (SELECT l2.zh FROM labels l2 WHERE l2.field_name = '*' AND l2.value = x.o->>'value')
    )
  );
