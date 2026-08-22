-- Keep field-guidance metadata neutral and consistent across country products.
-- These are data-only corrections; stored answer keys and official option
-- values are intentionally unchanged.

UPDATE public.visa_form_fields
SET label = 'Date of Arrival',
    updated_at = now()
WHERE visa_type = 'SG_ARRIVAL_CARD'
  AND field_name = 'arrival_date'
  AND label = 'Date of Arrival (DD/MM/YYYY)';

UPDATE public.visa_form_fields
SET validation_rules = jsonb_set(
      COALESCE(validation_rules, '{}'::jsonb),
      '{format}',
      '"YYYY"'::jsonb,
      true
    ),
    updated_at = now()
WHERE visa_type = 'DS160'
  AND field_name = 'last_visa_issue_year';

UPDATE public.visa_form_fields
SET placeholder = NULL,
    updated_at = now()
WHERE (visa_type, field_name) IN (
  ('SG_ARRIVAL_CARD', 'mobile_country_code'),
  ('MY_MDAC_ARRIVAL_CARD', 'mobile_country_code'),
  ('PH_ETRAVEL_ARRIVAL_CARD', 'mobile_country_code'),
  ('PH_ETRAVEL_DEPARTURE_CARD', 'mobile_country_code'),
  ('TW_ENTRY_PERMIT', 'local_mobile_phone'),
  ('EU_SCHENGEN_C_SHORT_STAY', 'phone_number')
);

-- This is a yes/no history question, not a year-entry field. Remove stale
-- date metadata left by an older seed so choice guidance never treats it as a
-- four-digit year input.
UPDATE public.visa_form_fields
SET validation_rules = (COALESCE(validation_rules, '{}'::jsonb) - 'format' - 'canonical_format'),
    updated_at = now()
WHERE visa_type = 'VN_E_VISA'
  AND field_name = 'visited_vietnam_in_last_year';
