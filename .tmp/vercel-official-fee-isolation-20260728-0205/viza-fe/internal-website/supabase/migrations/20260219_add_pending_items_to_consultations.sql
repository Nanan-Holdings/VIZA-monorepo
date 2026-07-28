-- Add pending_items JSONB column to consultations table
-- Stores doctor's cart during an active consultation (deferred order creation)
ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS pending_items jsonb DEFAULT '[]'::jsonb;
