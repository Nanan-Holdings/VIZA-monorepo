-- CEAC presents one arrival/departure block.  Planned locations and trip
-- purpose remain the repeatable Travel Information groups.  Metadata only;
-- existing applicant answer rows, including historical suffixed keys, stay
-- untouched.

UPDATE public.visa_form_fields
SET validation_rules =
      (COALESCE(validation_rules, '{}'::jsonb) - 'repeatable' - 'repeat_group'),
    updated_at = now()
WHERE visa_type = 'DS160'
  AND field_name IN (
    'arrival_date',
    'arrival_flight',
    'arrival_city',
    'departure_date',
    'departure_flight',
    'departure_city'
  );
