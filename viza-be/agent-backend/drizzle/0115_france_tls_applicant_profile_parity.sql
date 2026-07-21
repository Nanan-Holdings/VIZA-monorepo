-- TLScontact China applicant-profile parity fields discovered on the live
-- France appointment workflow. These are collected in VIZA before the cloud
-- runner opens the official form; no official save/submit action is implied.

DELETE FROM public.visa_form_fields
WHERE visa_type = 'EU_SCHENGEN_C_SHORT_STAY'
  AND field_name IN ('departure_from_origin_date', 'visits_french_overseas_territories');

UPDATE public.visa_form_fields
SET display_order = CASE field_name
  WHEN 'intended_arrival_date' THEN 8
  WHEN 'intended_departure_date' THEN 9
  ELSE display_order
END,
updated_at = NOW()
WHERE visa_type = 'EU_SCHENGEN_C_SHORT_STAY'
  AND step_number = 7
  AND field_name IN ('intended_arrival_date', 'intended_departure_date');

INSERT INTO public.visa_form_fields (
  visa_type,
  field_name,
  label,
  field_type,
  required,
  step_number,
  step_name,
  display_order,
  validation_rules,
  options,
  created_at,
  updated_at
)
VALUES
  (
    'EU_SCHENGEN_C_SHORT_STAY',
    'departure_from_origin_date',
    'Date of departure from your country of residence',
    'date',
    TRUE,
    7,
    'Trip Details',
    7,
    '{"format":"DD/MM/YYYY","inline_group":"trip_dates"}'::jsonb,
    NULL,
    NOW(),
    NOW()
  ),
  (
    'EU_SCHENGEN_C_SHORT_STAY',
    'visits_french_overseas_territories',
    'Are you going to French overseas territories?',
    'radio',
    TRUE,
    7,
    'Trip Details',
    10,
    NULL,
    '[{"value":"yes","text":"Yes","label_en":"Yes","label_zh":"是"},{"value":"no","text":"No","label_en":"No","label_zh":"否"}]'::jsonb,
    NOW(),
    NOW()
  );
