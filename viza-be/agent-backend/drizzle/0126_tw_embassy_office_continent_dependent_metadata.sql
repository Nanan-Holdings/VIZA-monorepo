-- Idempotent metadata-only correction for Taiwan delivery-location embassy offices.
--
-- Scope:
--   * public.visa_form_fields row where visa_type = 'TW_ENTRY_PERMIT'
--     and field_name = 'embassy_office' only.
--   * Mirrors the official portal behavior: selecting continent repopulates
--     the overseaOfficeId office list.
--
-- Official DOM evidence:
--   * select name="continent" values: A/B/C/D/E.
--   * select name="overseaOfficeId" options were captured from the live
--     official dropdown after selecting each continent on 2026-08-03.
--
-- Safety:
--   * No DELETE statements.
--   * Does not touch application answers, documents, queues, packages, users,
--     payments, runner state, OTP, CAPTCHA, cookies, or uploaded files.
--   * Existing field id and created_at are preserved by ON CONFLICT.
--
-- Pre-flight verification SQL (read-only):
--   SELECT visa_type, field_name, options, validation_rules
--   FROM public.visa_form_fields
--   WHERE visa_type = 'TW_ENTRY_PERMIT' AND field_name = 'embassy_office';
--
-- Post-flight verification SQL:
--   SELECT
--     jsonb_array_length(options) = 28 AS option_count_ok,
--     validation_rules->>'dependent_on' = 'continent' AS dependent_on_ok,
--     jsonb_array_length(validation_rules #> '{dependent_options,A}') = 14 AS asia_count_ok,
--     jsonb_array_length(validation_rules #> '{dependent_options,B}') = 8 AS americas_count_ok,
--     jsonb_array_length(validation_rules #> '{dependent_options,C}') = 3 AS europe_count_ok,
--     jsonb_array_length(validation_rules #> '{dependent_options,D}') = 1 AS africa_count_ok,
--     jsonb_array_length(validation_rules #> '{dependent_options,E}') = 2 AS oceania_count_ok
--   FROM public.visa_form_fields
--   WHERE visa_type = 'TW_ENTRY_PERMIT' AND field_name = 'embassy_office';
--
-- Rollback SQL (metadata only, if explicitly authorized):
--   UPDATE public.visa_form_fields
--   SET validation_rules = jsonb_strip_nulls(validation_rules - 'dependent_on' - 'dependent_options' - 'official_dom_name'),
--       options = (
--         SELECT jsonb_agg(option)
--         FROM jsonb_array_elements(options) AS option
--         WHERE option->>'value' IN ('50','51','5A','5C','5F','55','56','53','52','67','57','58','66','54')
--       )
--   WHERE visa_type = 'TW_ENTRY_PERMIT' AND field_name = 'embassy_office';

WITH embassy_office_metadata (
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
  conditional_logic
) AS (
  VALUES
    (
      'TW_ENTRY_PERMIT',
      'embassy_office',
      'Receiving embassy/office',
      'select',
      true,
      0,
      'Delivery Location',
      2,
      NULL::text,
      '{
        "dependent_on": "continent",
        "official_dom_name": "overseaOfficeId",
        "note": "Official portal repopulates overseaOfficeId options when continent changes; values captured from the live dropdown on 2026-08-03.",
        "dependent_options": {
          "A": [
            {"value":"50","text":"Taipei Economic and Cultural Office / Hong Kong Office","label_zh":"台北经济文化办事处／香港办事处","label_en":"Taipei Economic and Cultural Office / Hong Kong Office","official_label":"台北經濟文化辦事處／香港辦事處"},
            {"value":"51","text":"Taipei Economic and Cultural Office / Macau Office","label_zh":"台北经济文化办事处／澳门办事处","label_en":"Taipei Economic and Cultural Office / Macau Office","official_label":"台北經濟文化辦事處／澳門辦事處"},
            {"value":"5A","text":"Taipei Economic and Cultural Representative Office (Tokyo)","label_zh":"台北驻日经济文化代表处(东京)","label_en":"Taipei Economic and Cultural Representative Office (Tokyo)","official_label":"台北駐日經濟文化代表處(東京)"},
            {"value":"5C","text":"Taipei Economic and Cultural Office in Osaka","label_zh":"台北驻大阪经济文化办事处","label_en":"Taipei Economic and Cultural Office in Osaka","official_label":"台北駐大阪經濟文化辦事處"},
            {"value":"5F","text":"Taipei Mission in Korea","label_zh":"驻韩国台北代表处","label_en":"Taipei Mission in Korea","official_label":"駐韓國台北代表處"},
            {"value":"55","text":"Taipei Economic and Cultural Office in Malaysia","label_zh":"驻马来西亚台北经济文化办事处","label_en":"Taipei Economic and Cultural Office in Malaysia","official_label":"駐馬來西亞台北經濟文化辦事處"},
            {"value":"56","text":"Taipei Economic and Cultural Office in the Philippines","label_zh":"驻菲律宾台北经济文化办事处","label_en":"Taipei Economic and Cultural Office in the Philippines","official_label":"駐菲律賓台北經濟文化辦事處"},
            {"value":"53","text":"Taipei Representative Office in Singapore","label_zh":"驻新加坡台北代表处","label_en":"Taipei Representative Office in Singapore","official_label":"駐新加坡台北代表處"},
            {"value":"52","text":"Taipei Economic and Cultural Office in Thailand","label_zh":"驻泰国台北经济文化办事处","label_en":"Taipei Economic and Cultural Office in Thailand","official_label":"駐泰國台北經濟文化辦事處"},
            {"value":"67","text":"Taipei Economic and Cultural Office (Hanoi)","label_zh":"驻越南代表处(河内)","label_en":"Taipei Economic and Cultural Office (Hanoi)","official_label":"駐越南代表處(河內)"},
            {"value":"57","text":"Taipei Economic and Cultural Office in Ho Chi Minh City","label_zh":"驻胡志明市台北经济文化办事处","label_en":"Taipei Economic and Cultural Office in Ho Chi Minh City","official_label":"駐胡志明市台北經濟文化辦事處"},
            {"value":"58","text":"Taipei Economic and Cultural Office in Myanmar","label_zh":"驻缅甸代表处","label_en":"Taipei Economic and Cultural Office in Myanmar","official_label":"駐緬甸代表處"},
            {"value":"66","text":"Taipei Economic and Cultural Center in India","label_zh":"驻印度代表处","label_en":"Taipei Economic and Cultural Center in India","official_label":"駐印度代表處"},
            {"value":"54","text":"Taipei Economic and Trade Office in Indonesia","label_zh":"驻印尼台北经济贸易代表处","label_en":"Taipei Economic and Trade Office in Indonesia","official_label":"駐印尼台北經濟貿易代表處"}
          ],
          "B": [
            {"value":"6A","text":"Taipei Economic and Cultural Office in Vancouver","label_zh":"驻温哥华台北经济文化办事处","label_en":"Taipei Economic and Cultural Office in Vancouver","official_label":"駐溫哥華台北經濟文化辦事處"},
            {"value":"6B","text":"Taipei Economic and Cultural Office in Toronto","label_zh":"驻多伦多台北经济文化办事处","label_en":"Taipei Economic and Cultural Office in Toronto","official_label":"駐多倫多台北經濟文化辦事處"},
            {"value":"60","text":"Taipei Economic and Cultural Office in New York","label_zh":"驻纽约台北经济文化办事处","label_en":"Taipei Economic and Cultural Office in New York","official_label":"駐紐約台北經濟文化辦事處"},
            {"value":"61","text":"Taipei Economic and Cultural Office in Los Angeles","label_zh":"驻洛杉矶台北经济文化办事处","label_en":"Taipei Economic and Cultural Office in Los Angeles","official_label":"駐洛杉磯台北經濟文化辦事處"},
            {"value":"62","text":"Taipei Economic and Cultural Office in San Francisco","label_zh":"驻旧金山台北经济文化办事处","label_en":"Taipei Economic and Cultural Office in San Francisco","official_label":"駐舊金山台北經濟文化辦事處"},
            {"value":"64","text":"Taipei Economic and Cultural Representative Office in the United States (Washington, DC)","label_zh":"驻美国台北经济文化代表处(华盛顿特区)","label_en":"Taipei Economic and Cultural Representative Office in the United States (Washington, DC)","official_label":"駐美國台北經濟文化代表處(華盛頓特區)"},
            {"value":"65","text":"Taipei Economic and Cultural Office in Miami","label_zh":"驻迈阿密台北经济文化办事处","label_en":"Taipei Economic and Cultural Office in Miami","official_label":"駐邁阿密台北經濟文化辦事處"},
            {"value":"70","text":"Embassy of the Republic of China (Taiwan) in Paraguay","label_zh":"驻巴拉圭共和国大使馆","label_en":"Embassy of the Republic of China (Taiwan) in Paraguay","official_label":"駐巴拉圭共和國大使館"}
          ],
          "C": [
            {"value":"GP","text":"Taipei Representative Office in the EU and Belgium","label_zh":"驻欧盟兼驻比利时代表处","label_en":"Taipei Representative Office in the EU and Belgium","official_label":"駐歐盟兼駐比利時代表處"},
            {"value":"72","text":"Taipei Representative Office in France","label_zh":"驻法国台北代表处","label_en":"Taipei Representative Office in France","official_label":"駐法國台北代表處"},
            {"value":"63","text":"Taipei Representative Office in the United Kingdom","label_zh":"驻英国台北代表处","label_en":"Taipei Representative Office in the United Kingdom","official_label":"駐英國台北代表處"}
          ],
          "D": [
            {"value":"71","text":"Taipei Liaison Office in the Republic of South Africa","label_zh":"驻南非共和国台北联络代表处","label_en":"Taipei Liaison Office in the Republic of South Africa","official_label":"駐南非共和國台北聯絡代表處"}
          ],
          "E": [
            {"value":"73","text":"Taipei Economic and Cultural Office in Sydney","label_zh":"驻雪梨台北经济文化办事处","label_en":"Taipei Economic and Cultural Office in Sydney","official_label":"駐雪梨台北經濟文化辦事處"},
            {"value":"74","text":"Taipei Economic and Cultural Office in Auckland","label_zh":"驻奥克兰台北经济文化办事处","label_en":"Taipei Economic and Cultural Office in Auckland","official_label":"駐奧克蘭台北經濟文化辦事處"}
          ]
        },
        "label_en": "Receiving embassy/office",
        "official_label_en": "Receiving embassy/office"
      }'::jsonb,
      '[
        {"value":"50","text":"Taipei Economic and Cultural Office / Hong Kong Office","label_zh":"台北经济文化办事处／香港办事处","label_en":"Taipei Economic and Cultural Office / Hong Kong Office","official_label":"台北經濟文化辦事處／香港辦事處"},
        {"value":"51","text":"Taipei Economic and Cultural Office / Macau Office","label_zh":"台北经济文化办事处／澳门办事处","label_en":"Taipei Economic and Cultural Office / Macau Office","official_label":"台北經濟文化辦事處／澳門辦事處"},
        {"value":"5A","text":"Taipei Economic and Cultural Representative Office (Tokyo)","label_zh":"台北驻日经济文化代表处(东京)","label_en":"Taipei Economic and Cultural Representative Office (Tokyo)","official_label":"台北駐日經濟文化代表處(東京)"},
        {"value":"5C","text":"Taipei Economic and Cultural Office in Osaka","label_zh":"台北驻大阪经济文化办事处","label_en":"Taipei Economic and Cultural Office in Osaka","official_label":"台北駐大阪經濟文化辦事處"},
        {"value":"5F","text":"Taipei Mission in Korea","label_zh":"驻韩国台北代表处","label_en":"Taipei Mission in Korea","official_label":"駐韓國台北代表處"},
        {"value":"55","text":"Taipei Economic and Cultural Office in Malaysia","label_zh":"驻马来西亚台北经济文化办事处","label_en":"Taipei Economic and Cultural Office in Malaysia","official_label":"駐馬來西亞台北經濟文化辦事處"},
        {"value":"56","text":"Taipei Economic and Cultural Office in the Philippines","label_zh":"驻菲律宾台北经济文化办事处","label_en":"Taipei Economic and Cultural Office in the Philippines","official_label":"駐菲律賓台北經濟文化辦事處"},
        {"value":"53","text":"Taipei Representative Office in Singapore","label_zh":"驻新加坡台北代表处","label_en":"Taipei Representative Office in Singapore","official_label":"駐新加坡台北代表處"},
        {"value":"52","text":"Taipei Economic and Cultural Office in Thailand","label_zh":"驻泰国台北经济文化办事处","label_en":"Taipei Economic and Cultural Office in Thailand","official_label":"駐泰國台北經濟文化辦事處"},
        {"value":"67","text":"Taipei Economic and Cultural Office (Hanoi)","label_zh":"驻越南代表处(河内)","label_en":"Taipei Economic and Cultural Office (Hanoi)","official_label":"駐越南代表處(河內)"},
        {"value":"57","text":"Taipei Economic and Cultural Office in Ho Chi Minh City","label_zh":"驻胡志明市台北经济文化办事处","label_en":"Taipei Economic and Cultural Office in Ho Chi Minh City","official_label":"駐胡志明市台北經濟文化辦事處"},
        {"value":"58","text":"Taipei Economic and Cultural Office in Myanmar","label_zh":"驻缅甸代表处","label_en":"Taipei Economic and Cultural Office in Myanmar","official_label":"駐緬甸代表處"},
        {"value":"66","text":"Taipei Economic and Cultural Center in India","label_zh":"驻印度代表处","label_en":"Taipei Economic and Cultural Center in India","official_label":"駐印度代表處"},
        {"value":"54","text":"Taipei Economic and Trade Office in Indonesia","label_zh":"驻印尼台北经济贸易代表处","label_en":"Taipei Economic and Trade Office in Indonesia","official_label":"駐印尼台北經濟貿易代表處"},
        {"value":"6A","text":"Taipei Economic and Cultural Office in Vancouver","label_zh":"驻温哥华台北经济文化办事处","label_en":"Taipei Economic and Cultural Office in Vancouver","official_label":"駐溫哥華台北經濟文化辦事處"},
        {"value":"6B","text":"Taipei Economic and Cultural Office in Toronto","label_zh":"驻多伦多台北经济文化办事处","label_en":"Taipei Economic and Cultural Office in Toronto","official_label":"駐多倫多台北經濟文化辦事處"},
        {"value":"60","text":"Taipei Economic and Cultural Office in New York","label_zh":"驻纽约台北经济文化办事处","label_en":"Taipei Economic and Cultural Office in New York","official_label":"駐紐約台北經濟文化辦事處"},
        {"value":"61","text":"Taipei Economic and Cultural Office in Los Angeles","label_zh":"驻洛杉矶台北经济文化办事处","label_en":"Taipei Economic and Cultural Office in Los Angeles","official_label":"駐洛杉磯台北經濟文化辦事處"},
        {"value":"62","text":"Taipei Economic and Cultural Office in San Francisco","label_zh":"驻旧金山台北经济文化办事处","label_en":"Taipei Economic and Cultural Office in San Francisco","official_label":"駐舊金山台北經濟文化辦事處"},
        {"value":"64","text":"Taipei Economic and Cultural Representative Office in the United States (Washington, DC)","label_zh":"驻美国台北经济文化代表处(华盛顿特区)","label_en":"Taipei Economic and Cultural Representative Office in the United States (Washington, DC)","official_label":"駐美國台北經濟文化代表處(華盛頓特區)"},
        {"value":"65","text":"Taipei Economic and Cultural Office in Miami","label_zh":"驻迈阿密台北经济文化办事处","label_en":"Taipei Economic and Cultural Office in Miami","official_label":"駐邁阿密台北經濟文化辦事處"},
        {"value":"70","text":"Embassy of the Republic of China (Taiwan) in Paraguay","label_zh":"驻巴拉圭共和国大使馆","label_en":"Embassy of the Republic of China (Taiwan) in Paraguay","official_label":"駐巴拉圭共和國大使館"},
        {"value":"GP","text":"Taipei Representative Office in the EU and Belgium","label_zh":"驻欧盟兼驻比利时代表处","label_en":"Taipei Representative Office in the EU and Belgium","official_label":"駐歐盟兼駐比利時代表處"},
        {"value":"72","text":"Taipei Representative Office in France","label_zh":"驻法国台北代表处","label_en":"Taipei Representative Office in France","official_label":"駐法國台北代表處"},
        {"value":"63","text":"Taipei Representative Office in the United Kingdom","label_zh":"驻英国台北代表处","label_en":"Taipei Representative Office in the United Kingdom","official_label":"駐英國台北代表處"},
        {"value":"71","text":"Taipei Liaison Office in the Republic of South Africa","label_zh":"驻南非共和国台北联络代表处","label_en":"Taipei Liaison Office in the Republic of South Africa","official_label":"駐南非共和國台北聯絡代表處"},
        {"value":"73","text":"Taipei Economic and Cultural Office in Sydney","label_zh":"驻雪梨台北经济文化办事处","label_en":"Taipei Economic and Cultural Office in Sydney","official_label":"駐雪梨台北經濟文化辦事處"},
        {"value":"74","text":"Taipei Economic and Cultural Office in Auckland","label_zh":"驻奥克兰台北经济文化办事处","label_en":"Taipei Economic and Cultural Office in Auckland","official_label":"駐奧克蘭台北經濟文化辦事處"}
      ]'::jsonb,
      NULL::jsonb
    )
),
upserted AS (
  INSERT INTO public.visa_form_fields (
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
    conditional_logic
  )
  SELECT
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
    conditional_logic
  FROM embassy_office_metadata
  WHERE visa_type = 'TW_ENTRY_PERMIT'
    AND field_name = 'embassy_office'
  ON CONFLICT (visa_type, field_name) DO UPDATE SET
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
    updated_at = now()
  RETURNING field_name
)
SELECT count(*) AS tw_embassy_office_metadata_rows_upserted
FROM upserted;
