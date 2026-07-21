ALTER TABLE public.appointment_assistance_jobs
  ADD COLUMN IF NOT EXISTS last_slot_check_at TIMESTAMPTZ;
