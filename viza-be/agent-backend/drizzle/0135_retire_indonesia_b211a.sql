-- Retire the obsolete Indonesia B211A catalog entries.
--
-- Keep the rows (and any historical applications that reference them) intact
-- for audit/history reads. New package selection now uses ID_C1_TOURIST.

BEGIN;

UPDATE public.visa_packages
SET
  is_active = false,
  updated_at = NOW()
WHERE lower(trim(country)) = 'indonesia'
  AND upper(trim(visa_type)) IN ('B211A', 'TOURIST_B211A')
  AND is_active IS DISTINCT FROM false;

ALTER TABLE public.applications
  ALTER COLUMN visa_type SET DEFAULT 'ID_C1_TOURIST';

ALTER TABLE public.visa_form_fields
  ALTER COLUMN visa_type SET DEFAULT 'ID_C1_TOURIST';

COMMIT;
