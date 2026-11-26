-- UKVI's live home-property validator rejects an empty month component with
-- "Enter months between 0 and 11". Align the VIZA field metadata with that
-- server-side requirement without changing any saved applicant answer.

UPDATE public.visa_form_fields
SET
  required = TRUE,
  validation_rules = COALESCE(validation_rules, '{}'::JSONB) ||
    '{"pattern":"^(?:0|[1-9]|1[01])$","maxLength":2,"min":0,"max":11,"inline_group":"address_duration"}'::JSONB,
  updated_at = NOW()
WHERE visa_type = 'UK_STANDARD_VISITOR'
  AND field_name = 'months_at_address';
