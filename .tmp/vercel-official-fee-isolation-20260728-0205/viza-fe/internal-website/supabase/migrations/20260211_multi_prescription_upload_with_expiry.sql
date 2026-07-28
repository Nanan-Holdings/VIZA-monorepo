-- Drop the UNIQUE constraint on patient_id to allow multiple prescriptions per patient
ALTER TABLE public.patient_prescriptions
  DROP CONSTRAINT patient_prescriptions_patient_id_unique;

-- Add expires_at column (default: 1 month from upload)
ALTER TABLE public.patient_prescriptions
  ADD COLUMN expires_at timestamptz DEFAULT (now() + interval '1 month');

-- Backfill existing rows
UPDATE public.patient_prescriptions
  SET expires_at = created_at + interval '1 month'
  WHERE expires_at IS NULL;

ALTER TABLE public.patient_prescriptions
  ALTER COLUMN expires_at SET NOT NULL;

-- Add consultation_id column (for doctor uploads)
ALTER TABLE public.patient_prescriptions
  ADD COLUMN consultation_id uuid REFERENCES public.consultations(id) ON DELETE SET NULL;

-- Index for cleanup cron to find expired prescriptions
CREATE INDEX idx_patient_prescriptions_expires_at
  ON public.patient_prescriptions (expires_at);

-- Index for looking up prescriptions by consultation
CREATE INDEX idx_patient_prescriptions_consultation_id
  ON public.patient_prescriptions (consultation_id)
  WHERE consultation_id IS NOT NULL;
