-- Migration: add_escalation_status_and_tracking
-- Description: Add new status values and tracking columns to escalations table
-- Date: 2026-01-29

-- First, check if the constraint exists and drop it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'escalations_status_check'
    AND table_name = 'escalations'
  ) THEN
    ALTER TABLE public.escalations DROP CONSTRAINT escalations_status_check;
  END IF;
END $$;

-- Add new status constraint with all valid values
ALTER TABLE public.escalations
ADD CONSTRAINT escalations_status_check CHECK (status IN (
  'pending', 'assigned', 'in_review', 'resolved', 'escalated_further'
));

-- Add tracking columns for concurrency awareness
ALTER TABLE public.escalations
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_escalations_status ON public.escalations(status);

-- Create index on assigned_to for doctor filtering
CREATE INDEX IF NOT EXISTS idx_escalations_assigned_to ON public.escalations(assigned_to);

-- Create index on severity for sorting
CREATE INDEX IF NOT EXISTS idx_escalations_severity ON public.escalations(severity);

-- Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_escalation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS escalations_updated_at_trigger ON public.escalations;
CREATE TRIGGER escalations_updated_at_trigger
  BEFORE UPDATE ON public.escalations
  FOR EACH ROW
  EXECUTE FUNCTION update_escalation_updated_at();
