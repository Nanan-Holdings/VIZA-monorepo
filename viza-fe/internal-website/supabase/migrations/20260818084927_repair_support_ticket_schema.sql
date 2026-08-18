-- Repair production support-ticket schema drift. The original queue migration
-- was only partially applied in the hosted project, leaving the admin inbox
-- unable to select or write its canonical priority/status fields.

ALTER TABLE public.support_ticket
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'p2',
  ADD COLUMN IF NOT EXISTS assigned_to UUID,
  ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_due_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours');

UPDATE public.support_ticket
SET status = CASE status
  WHEN 'open' THEN 'unresolved'
  WHEN 'staff_replied' THEN 'in_progress'
  WHEN 'closed' THEN 'resolved'
  ELSE status
END;

ALTER TABLE public.support_ticket
  ALTER COLUMN status SET DEFAULT 'unresolved',
  ALTER COLUMN priority SET DEFAULT 'p2',
  ALTER COLUMN sla_due_at SET DEFAULT (NOW() + INTERVAL '24 hours');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.support_ticket'::regclass
      AND conname = 'support_ticket_status_check'
  ) THEN
    ALTER TABLE public.support_ticket
      ADD CONSTRAINT support_ticket_status_check
      CHECK (status IN ('unresolved', 'in_progress', 'resolved', 'open', 'staff_replied', 'closed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.support_ticket'::regclass
      AND conname = 'support_ticket_priority_check'
  ) THEN
    ALTER TABLE public.support_ticket
      ADD CONSTRAINT support_ticket_priority_check
      CHECK (priority IN ('p0', 'p1', 'p2', 'p3', 'p4'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_support_ticket_status_priority
  ON public.support_ticket(status, priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_ticket_assigned_status
  ON public.support_ticket(assigned_to, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_ticket_sla_due
  ON public.support_ticket(sla_due_at) WHERE first_response_at IS NULL;

ALTER TABLE public.support_ticket ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON TABLE public.support_ticket TO authenticated;
GRANT ALL ON TABLE public.support_ticket TO service_role;
