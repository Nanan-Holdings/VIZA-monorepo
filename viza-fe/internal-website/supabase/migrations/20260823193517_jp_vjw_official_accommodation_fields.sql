-- Align the DB-driven Japan VJW intake with the current official planned-entry
-- accommodation page. The official form requires prefecture, city/ward/town,
-- address and a 10-15 digit Japan contact number before review.

UPDATE public.visa_form_fields
SET
  display_order = CASE field_name
    WHEN 'accommodation_postal_code' THEN 9
    WHEN 'accommodation_address' THEN 12
    WHEN 'accommodation_name' THEN 13
    WHEN 'accommodation_phone' THEN 14
    ELSE display_order
  END,
  validation_rules = CASE field_name
    WHEN 'accommodation_postal_code' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"label_zh":"日本邮政编码","official":true,"pattern":"^[0-9]{3}-?[0-9]{4}$","official_control":"postalCode","helper_zh":"请输入 7 位日本邮政编码；VIZA 会在官网核对并尝试自动填写都道府县和城市。"}'::jsonb
    WHEN 'accommodation_address' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"label_zh":"日本住宿町名、丁目和门牌号（英文）","official":true,"maxLength":45,"official_control":"address","helper_zh":"这里只填写町名、丁目和门牌号；都道府县与市区町村请填写在上方对应项目。"}'::jsonb
    WHEN 'accommodation_name' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"label_zh":"酒店或住宿名称（英文）","official":true,"maxLength":100,"official_control":"placeOfStay"}'::jsonb
    WHEN 'accommodation_phone' THEN
      COALESCE(validation_rules, '{}'::jsonb) || '{"label_zh":"日本境内可联系的住宿电话","official":true,"pattern":"^[0-9]{10,15}$","minLength":10,"maxLength":15,"official_control":"telephoneNumberInJapan","helper_zh":"只填写 10 至 15 位数字，不含加号、空格或连字符。","specific_error_zh":"住宿电话必须为 10 至 15 位数字。"}'::jsonb
    ELSE validation_rules
  END,
  updated_at = now()
WHERE visa_type = 'JP_VISIT_JAPAN_WEB'
  AND field_name IN (
    'accommodation_postal_code',
    'accommodation_address',
    'accommodation_name',
    'accommodation_phone'
  );

INSERT INTO public.visa_form_fields (
  visa_type, field_name, label, field_type, required, step_number, step_name,
  display_order, placeholder, validation_rules, options, conditional_logic,
  updated_at
)
VALUES
  (
    'JP_VISIT_JAPAN_WEB', 'accommodation_prefecture',
    'Prefecture of Accommodation in Japan', 'text', true, 2,
    'Arrival and Stay', 10, null,
    '{"label_zh":"日本住宿所在都道府县（英文）","label_en":"Prefecture of Accommodation in Japan","official_label_en":"Prefecture of Accommodation in Japan","official":true,"maxLength":80,"official_control":"prefecture","helper_zh":"请填写住宿地址所在都道府县的英文名称，例如 TOKYO、OSAKA。"}'::jsonb,
    null, null, now()
  ),
  (
    'JP_VISIT_JAPAN_WEB', 'accommodation_city',
    'City/Ward/Town of Accommodation in Japan', 'text', true, 2,
    'Arrival and Stay', 11, null,
    '{"label_zh":"日本住宿所在市区町村（英文）","label_en":"City/Ward/Town of Accommodation in Japan","official_label_en":"City/Ward/Town of Accommodation in Japan","official":true,"maxLength":45,"official_control":"city","helper_zh":"请填写官网地址列表使用的英文市区町村名称，例如 SHINJUKU KU。"}'::jsonb,
    null, null, now()
  )
ON CONFLICT (visa_type, field_name) DO UPDATE
SET
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
