-- Korea e-Arrival Card official control contract.
-- Replaces free-text/combined controls with the same logical controls used by
-- the government portal. Existing submitted records remain untouched; active
-- drafts retain transport text where it can be migrated without guessing.

BEGIN;

-- Record the portal control shape even where VIZA intentionally renders a
-- more accessible equivalent. The runner uses this metadata as the mapping
-- contract: personal dates are three-part selectors, travel dates are the
-- portal's formatted text date controls, and controlled lists keep official
-- codes rather than translated display labels.
UPDATE public.visa_form_fields
SET
  validation_rules = coalesce(validation_rules, '{}'::jsonb) || jsonb_build_object(
    'official', true,
    'official_control', CASE field_name
      WHEN 'date_of_birth' THEN 'date_parts'
      WHEN 'passport_expiry_date' THEN 'date_parts'
      WHEN 'arrival_date' THEN 'formatted_date_text'
      WHEN 'departure_date' THEN 'formatted_date_text'
      WHEN 'nationality' THEN 'country_search'
      WHEN 'sex' THEN 'native_select'
      WHEN 'purpose_of_entry' THEN 'native_select'
      WHEN 'occupation' THEN 'native_select'
    END
  ),
  updated_at = now()
WHERE visa_type = 'KR_E_ARRIVAL_CARD'
  AND field_name IN (
    'date_of_birth', 'passport_expiry_date', 'arrival_date', 'departure_date',
    'nationality', 'sex', 'purpose_of_entry', 'occupation'
  );

UPDATE public.visa_form_fields
SET
  field_type = 'radio',
  options = '[
    {"value":"A","code":"A","text":"Air","label_en":"Air","label_zh":"航空","official_label":"Air"},
    {"value":"S","code":"S","text":"Sea","label_en":"Sea","label_zh":"海路","official_label":"Sea"}
  ]'::jsonb,
  validation_rules = CASE field_name
    WHEN 'arrival_mode' THEN '{"label_zh":"抵达方式","official":true,"official_control":"air_or_sea_buttons","option_identity":"value","value_is_official_code":true}'::jsonb
    ELSE '{"label_zh":"离境方式","official":true,"official_control":"air_or_sea_buttons","option_identity":"value","value_is_official_code":true}'::jsonb
  END,
  updated_at = now()
WHERE visa_type = 'KR_E_ARRIVAL_CARD'
  AND field_name IN ('arrival_mode', 'departure_mode');

DELETE FROM public.visa_form_fields
WHERE visa_type = 'KR_E_ARRIVAL_CARD'
  AND field_name IN (
    'arrival_flight_or_ship',
    'departure_flight_or_ship',
    'next_destination'
  );

INSERT INTO public.visa_form_fields (
  visa_type, field_name, label, field_type, required, step_number, step_name,
  display_order, placeholder, validation_rules, options, conditional_logic,
  updated_at
)
VALUES
  (
    'KR_E_ARRIVAL_CARD', 'arrival_flight_number', 'Arrival Flight Number',
    'text', true, 2, 'Arrival and Departure', 3, null,
    '{"label_zh":"抵达航班号","official":true,"official_control":"airline_search","maxLength":20,"dynamic_option_source":{"endpoint":"/portal/apply/srchNavInfo.do","identity":"transport_number","snapshot":"official-options.snapshot.json#flightAndShip"},"allow_manual_fallback":true}'::jsonb,
    null, '{"showIf":"arrival_mode === \"A\""}'::jsonb, now()
  ),
  (
    'KR_E_ARRIVAL_CARD', 'arrival_ship_name', 'Arrival Ship Name',
    'text', true, 2, 'Arrival and Departure', 4, null,
    '{"label_zh":"抵达船名","official":true,"official_control":"ship_name_text","maxLength":80}'::jsonb,
    null, '{"showIf":"arrival_mode === \"S\""}'::jsonb, now()
  ),
  (
    'KR_E_ARRIVAL_CARD', 'departure_flight_number', 'Departure Flight Number',
    'text', false, 2, 'Arrival and Departure', 9, null,
    '{"label_zh":"离境航班号（选填）","official":true,"official_control":"airline_search","maxLength":20,"dynamic_option_source":{"endpoint":"/portal/apply/srchNavInfo.do","identity":"transport_number","snapshot":"official-options.snapshot.json#flightAndShip"},"allow_manual_fallback":true}'::jsonb,
    null, '{"showIf":"departure_mode === \"A\""}'::jsonb, now()
  ),
  (
    'KR_E_ARRIVAL_CARD', 'departure_ship_name', 'Departure Ship Name',
    'text', false, 2, 'Arrival and Departure', 10, null,
    '{"label_zh":"离境船名（选填）","official":true,"official_control":"ship_name_text","maxLength":80}'::jsonb,
    null, '{"showIf":"departure_mode === \"S\""}'::jsonb, now()
  ),
  (
    'KR_E_ARRIVAL_CARD', 'next_destination_country', 'Next Destination Country',
    'country', false, 2, 'Arrival and Departure', 11, null,
    '{"label_zh":"下一目的国家 / 地区（选填）","official":true,"remote_search":true,"dynamic_option_source":{"endpoint":"/portal/apply/srchIbmsNatList.do","identity":"country_code","snapshot":"official-options.snapshot.json#nationality"},"populated_by_transport_lookup":true,"optional_manual_fallback":true}'::jsonb,
    null, null, now()
  ),
  (
    'KR_E_ARRIVAL_CARD', 'next_destination_city', 'Next Destination City',
    'text', false, 2, 'Arrival and Departure', 12, null,
    '{"label_zh":"下一目的城市（选填）","official":true,"maxLength":120,"populated_by_transport_lookup":true,"optional_manual_fallback":true}'::jsonb,
    null, null, now()
  ),
  (
    'KR_E_ARRIVAL_CARD', 'stay_address_search', 'Search and Select Address in Korea',
    'address_lookup', true, 3, 'Stay in Korea', 5,
    'Search by Korean/English road address or postal code',
    '{"label_zh":"搜索并选择韩国住宿地址","official":true,"source":"korea_e_arrival_card_address_search","remote_search":true,"minimum_query_length":2,"official_control":"address_lookup_popup","derived_fields":["stay_address_ko","stay_address_en","stay_postal_code"]}'::jsonb,
    null, null, now()
  ),
  (
    'KR_E_ARRIVAL_CARD', 'stay_address_detail', 'Detailed Address in Korea (optional)',
    'text', false, 3, 'Stay in Korea', 9, null,
    '{"label_zh":"韩国详细地址（房间号等，选填）","official":true,"maxLength":160,"official_control":"detail_address_text"}'::jsonb,
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

UPDATE public.visa_form_fields
SET
  field_type = 'text',
  required = true,
  display_order = CASE field_name
    WHEN 'stay_address_ko' THEN 6
    WHEN 'stay_address_en' THEN 7
    ELSE 8
  END,
  validation_rules = CASE field_name
    WHEN 'stay_address_ko' THEN '{"label_zh":"韩国住宿地址（韩文，自动填写）","official":true,"maxLength":300,"address_language":"ko","read_only":true,"derived_from":"stay_address_search"}'::jsonb
    WHEN 'stay_address_en' THEN '{"label_zh":"韩国住宿地址（英文，自动填写）","official":true,"maxLength":300,"address_language":"en","read_only":true,"derived_from":"stay_address_search"}'::jsonb
    ELSE '{"label_zh":"韩国邮政编码（自动填写，5 位数字）","official":true,"pattern":"^[0-9]{5}$","read_only":true,"derived_from":"stay_address_search","specific_error_zh":"韩国邮政编码需要 5 位数字。","specific_error_en":"Korean postal code must contain exactly 5 digits."}'::jsonb
  END,
  updated_at = now()
WHERE visa_type = 'KR_E_ARRIVAL_CARD'
  AND field_name IN ('stay_address_ko', 'stay_address_en', 'stay_postal_code');

UPDATE public.visa_form_fields
SET display_order = CASE field_name
  WHEN 'previous_departure_country' THEN 5
  WHEN 'previous_departure_city' THEN 6
  WHEN 'departure_mode' THEN 7
  WHEN 'departure_date' THEN 8
  WHEN 'stay_contact_phone' THEN 10
  ELSE display_order
END,
updated_at = now()
WHERE visa_type = 'KR_E_ARRIVAL_CARD'
  AND field_name IN (
    'previous_departure_country', 'previous_departure_city',
    'departure_mode', 'departure_date', 'stay_contact_phone'
  );

-- Preserve transport answers in active drafts while converting display labels
-- to the portal's A/S codes.
UPDATE public.visa_application_answers answer
SET
  value_text = CASE lower(btrim(answer.value_text))
    WHEN 'air' THEN 'A'
    WHEN 'sea' THEN 'S'
    ELSE answer.value_text
  END,
  value_json = CASE
    WHEN lower(btrim(answer.value_text)) = 'air' THEN '"A"'::jsonb
    WHEN lower(btrim(answer.value_text)) = 'sea' THEN '"S"'::jsonb
    ELSE answer.value_json
  END,
  updated_at = now()
WHERE answer.field_name IN ('arrival_mode', 'departure_mode')
  AND EXISTS (
    SELECT 1
    FROM public.applications application
    WHERE application.id = answer.application_id
      AND upper(btrim(coalesce(application.visa_type, ''))) = 'KR_E_ARRIVAL_CARD'
  );

INSERT INTO public.visa_application_answers (
  application_id, field_name, value_text, value_json, created_at, updated_at
)
SELECT
  legacy.application_id,
  CASE lower(btrim(mode.value_text))
    WHEN 'a' THEN 'arrival_flight_number'
    WHEN 'air' THEN 'arrival_flight_number'
    WHEN 's' THEN 'arrival_ship_name'
    WHEN 'sea' THEN 'arrival_ship_name'
  END,
  legacy.value_text,
  legacy.value_json,
  legacy.created_at,
  now()
FROM public.visa_application_answers legacy
JOIN public.visa_application_answers mode
  ON mode.application_id = legacy.application_id
 AND mode.field_name = 'arrival_mode'
JOIN public.applications application
  ON application.id = legacy.application_id
WHERE legacy.field_name = 'arrival_flight_or_ship'
  AND upper(btrim(coalesce(application.visa_type, ''))) = 'KR_E_ARRIVAL_CARD'
  AND lower(btrim(mode.value_text)) IN ('a', 'air', 's', 'sea')
ON CONFLICT (application_id, field_name) DO NOTHING;

INSERT INTO public.visa_application_answers (
  application_id, field_name, value_text, value_json, created_at, updated_at
)
SELECT
  legacy.application_id,
  CASE lower(btrim(mode.value_text))
    WHEN 'a' THEN 'departure_flight_number'
    WHEN 'air' THEN 'departure_flight_number'
    WHEN 's' THEN 'departure_ship_name'
    WHEN 'sea' THEN 'departure_ship_name'
  END,
  legacy.value_text,
  legacy.value_json,
  legacy.created_at,
  now()
FROM public.visa_application_answers legacy
JOIN public.visa_application_answers mode
  ON mode.application_id = legacy.application_id
 AND mode.field_name = 'departure_mode'
JOIN public.applications application
  ON application.id = legacy.application_id
WHERE legacy.field_name = 'departure_flight_or_ship'
  AND upper(btrim(coalesce(application.visa_type, ''))) = 'KR_E_ARRIVAL_CARD'
  AND lower(btrim(mode.value_text)) IN ('a', 'air', 's', 'sea')
ON CONFLICT (application_id, field_name) DO NOTHING;

INSERT INTO public.visa_application_answers (
  application_id, field_name, value_text, value_json, created_at, updated_at
)
SELECT
  legacy.application_id,
  'next_destination_city',
  legacy.value_text,
  legacy.value_json,
  legacy.created_at,
  now()
FROM public.visa_application_answers legacy
JOIN public.applications application
  ON application.id = legacy.application_id
WHERE legacy.field_name = 'next_destination'
  AND upper(btrim(coalesce(application.visa_type, ''))) = 'KR_E_ARRIVAL_CARD'
ON CONFLICT (application_id, field_name) DO NOTHING;

COMMIT;
