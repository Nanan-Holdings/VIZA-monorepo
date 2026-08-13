-- Taiwan TW_ENTRY_PERMIT: restore Mainland China birthplace branch options.
--
-- Production finding (read-only, 2026-08-13):
--   visa_form_fields.options is NULL for TW_ENTRY_PERMIT /
--   birth_place_mainland_region, even though the seed's
--   BIRTH_PLACE_MAINLAND_OPTIONS contains the full canonical option list.
--
-- Pre-flight verification SQL:
--   SELECT field_name, jsonb_typeof(options) AS options_type,
--          CASE WHEN jsonb_typeof(options) = 'array' THEN jsonb_array_length(options) END AS options_count
--   FROM public.visa_form_fields
--   WHERE visa_type = 'TW_ENTRY_PERMIT'
--     AND field_name = 'birth_place_mainland_region';
--
-- Post-flight verification SQL:
--   SELECT field_name, jsonb_array_length(options) AS options_count,
--          options @> '[{"value":"北京","text":"北京"}]'::jsonb AS includes_beijing
--   FROM public.visa_form_fields
--   WHERE visa_type = 'TW_ENTRY_PERMIT'
--     AND field_name = 'birth_place_mainland_region';

UPDATE public.visa_form_fields
SET
  options = '[{"value":"湖南","text":"湖南","label_zh":"湖南","official_label":"湖南"},{"value":"湖北","text":"湖北","label_zh":"湖北","official_label":"湖北"},{"value":"四川","text":"四川","label_zh":"四川","official_label":"四川"},{"value":"上海","text":"上海","label_zh":"上海","official_label":"上海"},{"value":"南京","text":"南京","label_zh":"南京","official_label":"南京"},{"value":"漢口","text":"漢口","label_zh":"漢口","official_label":"漢口"},{"value":"重慶","text":"重慶","label_zh":"重慶","official_label":"重慶"},{"value":"山東","text":"山東","label_zh":"山東","official_label":"山東"},{"value":"山西","text":"山西","label_zh":"山西","official_label":"山西"},{"value":"河南","text":"河南","label_zh":"河南","official_label":"河南"},{"value":"河北","text":"河北","label_zh":"河北","official_label":"河北"},{"value":"陝西","text":"陝西","label_zh":"陝西","official_label":"陝西"},{"value":"甘肅","text":"甘肅","label_zh":"甘肅","official_label":"甘肅"},{"value":"青島","text":"青島","label_zh":"青島","official_label":"青島"},{"value":"天津","text":"天津","label_zh":"天津","official_label":"天津"},{"value":"北京","text":"北京","label_zh":"北京","official_label":"北京"},{"value":"西安","text":"西安","label_zh":"西安","official_label":"西安"},{"value":"遼寧","text":"遼寧","label_zh":"遼寧","official_label":"遼寧"},{"value":"遼北","text":"遼北","label_zh":"遼北","official_label":"遼北"},{"value":"安東","text":"安東","label_zh":"安東","official_label":"安東"},{"value":"吉林","text":"吉林","label_zh":"吉林","official_label":"吉林"},{"value":"松江","text":"松江","label_zh":"松江","official_label":"松江"},{"value":"合江","text":"合江","label_zh":"合江","official_label":"合江"},{"value":"嫩江","text":"嫩江","label_zh":"嫩江","official_label":"嫩江"},{"value":"黑龍江","text":"黑龍江","label_zh":"黑龍江","official_label":"黑龍江"},{"value":"興安","text":"興安","label_zh":"興安","official_label":"興安"},{"value":"大連","text":"大連","label_zh":"大連","official_label":"大連"},{"value":"瀋陽","text":"瀋陽","label_zh":"瀋陽","official_label":"瀋陽"},{"value":"哈爾濱","text":"哈爾濱","label_zh":"哈爾濱","official_label":"哈爾濱"},{"value":"熱河","text":"熱河","label_zh":"熱河","official_label":"熱河"},{"value":"察哈爾","text":"察哈爾","label_zh":"察哈爾","official_label":"察哈爾"},{"value":"綏遠","text":"綏遠","label_zh":"綏遠","official_label":"綏遠"},{"value":"寧夏回族自治區","text":"寧夏回族自治區","label_zh":"寧夏回族自治區","official_label":"寧夏回族自治區"},{"value":"內蒙古自治區","text":"內蒙古自治區","label_zh":"內蒙古自治區","official_label":"內蒙古自治區"},{"value":"新疆維吾爾自治區","text":"新疆維吾爾自治區","label_zh":"新疆維吾爾自治區","official_label":"新疆維吾爾自治區"},{"value":"青海","text":"青海","label_zh":"青海","official_label":"青海"},{"value":"西康","text":"西康","label_zh":"西康","official_label":"西康"},{"value":"西藏自治區","text":"西藏自治區","label_zh":"西藏自治區","official_label":"西藏自治區"},{"value":"福建","text":"福建","label_zh":"福建","official_label":"福建"},{"value":"廣東","text":"廣東","label_zh":"廣東","official_label":"廣東"},{"value":"廣西壯族自治區","text":"廣西壯族自治區","label_zh":"廣西壯族自治區","official_label":"廣西壯族自治區"},{"value":"雲南","text":"雲南","label_zh":"雲南","official_label":"雲南"},{"value":"貴州","text":"貴州","label_zh":"貴州","official_label":"貴州"},{"value":"海南","text":"海南","label_zh":"海南","official_label":"海南"},{"value":"廣州","text":"廣州","label_zh":"廣州","official_label":"廣州"},{"value":"江蘇","text":"江蘇","label_zh":"江蘇","official_label":"江蘇"},{"value":"浙江","text":"浙江","label_zh":"浙江","official_label":"浙江"},{"value":"安徽","text":"安徽","label_zh":"安徽","official_label":"安徽"},{"value":"江西","text":"江西","label_zh":"江西","official_label":"江西"}]'::jsonb,
  updated_at = now()
WHERE visa_type = 'TW_ENTRY_PERMIT'
  AND field_name = 'birth_place_mainland_region';
