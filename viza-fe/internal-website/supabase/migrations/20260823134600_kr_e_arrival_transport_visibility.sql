-- Repair Korea transport-field conditions to match the DB-driven form
-- evaluator grammar. Option values are bare official codes (A/S); quoting the
-- right-hand code made the required flight/ship control invisible even though
-- the runner correctly required it.

UPDATE public.visa_form_fields
SET conditional_logic = jsonb_set(
      COALESCE(conditional_logic, '{}'::jsonb),
      '{showIf}',
      to_jsonb(CASE field_name
        WHEN 'arrival_flight_number' THEN 'arrival_mode === A'
        WHEN 'arrival_ship_name' THEN 'arrival_mode === S'
        WHEN 'departure_flight_number' THEN 'departure_mode === A'
        WHEN 'departure_ship_name' THEN 'departure_mode === S'
      END::text),
      true
    ),
    updated_at = now()
WHERE visa_type = 'KR_E_ARRIVAL_CARD'
  AND field_name IN (
    'arrival_flight_number',
    'arrival_ship_name',
    'departure_flight_number',
    'departure_ship_name'
  );
