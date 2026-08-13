-- Keep required declaration checkboxes semantically required for the form
-- assistant as well as the visual form renderer.
BEGIN;

UPDATE public.visa_form_fields
SET validation_rules = COALESCE(validation_rules, '{}'::jsonb) || '{"mustBeTrue":true}'::jsonb
WHERE upper(trim(visa_type)) IN ('PH_ETRAVEL_ARRIVAL_CARD', 'PH_ETRAVEL_DEPARTURE_CARD')
  AND field_name = 'data_privacy_agreement';

UPDATE public.visa_form_fields
SET validation_rules = COALESCE(validation_rules, '{}'::jsonb) || '{"mustBeTrue":true}'::jsonb
WHERE upper(trim(visa_type)) = 'TW_ENTRY_PERMIT'
  AND field_name = 'accepted_terms';

COMMIT;
