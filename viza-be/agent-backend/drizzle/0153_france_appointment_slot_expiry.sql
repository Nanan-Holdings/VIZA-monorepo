-- France TLS observations are short-lived. A slot may be shown to an
-- applicant only until ten minutes after the official observation.
ALTER TABLE public.appointment_slots
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

UPDATE public.appointment_slots
SET expires_at = COALESCE(observed_at, NOW()) + INTERVAL '10 minutes'
WHERE expires_at IS NULL;

ALTER TABLE public.appointment_slots
  ALTER COLUMN expires_at SET DEFAULT (CURRENT_TIMESTAMP + INTERVAL '10 minutes');

ALTER TABLE public.appointment_slots
  ALTER COLUMN expires_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS appointment_slots_job_status_expires_idx
  ON public.appointment_slots(job_id, status, expires_at);

CREATE INDEX IF NOT EXISTS appointment_slots_application_status_expires_idx
  ON public.appointment_slots(application_id, status, expires_at);

COMMENT ON COLUMN public.appointment_slots.expires_at IS
  'Observation expiry. France TLS service writes observed_at + ten minutes and filters expired observations before display or selection.';
