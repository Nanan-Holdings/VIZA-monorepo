-- Customer support tickets shown in /client/support and /admin/support.
CREATE TABLE IF NOT EXISTS public.support_ticket (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID NOT NULL,
  application_id UUID,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unresolved',
  priority TEXT NOT NULL DEFAULT 'p2',
  assigned_to UUID,
  first_response_at TIMESTAMPTZ,
  sla_due_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT support_ticket_status_check
    CHECK (status IN ('unresolved', 'in_progress', 'resolved', 'open', 'staff_replied', 'closed')),
  CONSTRAINT support_ticket_priority_check
    CHECK (priority IN ('p0', 'p1', 'p2', 'p3', 'p4'))
);

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
  ALTER COLUMN priority SET DEFAULT 'p2';

CREATE INDEX IF NOT EXISTS idx_support_ticket_applicant
  ON public.support_ticket(applicant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_ticket_status_priority
  ON public.support_ticket(status, priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_ticket_assigned_status
  ON public.support_ticket(assigned_to, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_ticket_sla_due
  ON public.support_ticket(sla_due_at) WHERE first_response_at IS NULL;

CREATE TABLE IF NOT EXISTS public.support_message (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_ticket(id) ON DELETE CASCADE,
  author_kind TEXT NOT NULL CHECK (author_kind IN ('applicant', 'staff')),
  author_id UUID,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_message_ticket
  ON public.support_message(ticket_id, created_at ASC);

CREATE TABLE IF NOT EXISTS public.support_internal_note (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_ticket(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_internal_note_ticket
  ON public.support_internal_note(ticket_id, created_at ASC);

CREATE TABLE IF NOT EXISTS public.support_macro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_macro_country
  ON public.support_macro(country, locale, is_active);

ALTER TABLE public.support_ticket ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_message ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_internal_note ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_macro ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_ticket_select_own" ON public.support_ticket;
DROP POLICY IF EXISTS "support_ticket_insert_own" ON public.support_ticket;
DROP POLICY IF EXISTS "support_ticket_staff_all" ON public.support_ticket;
DROP POLICY IF EXISTS "support_message_select_own" ON public.support_message;
DROP POLICY IF EXISTS "support_message_insert_own" ON public.support_message;
DROP POLICY IF EXISTS "support_message_staff_all" ON public.support_message;
DROP POLICY IF EXISTS "support_internal_note_staff_only" ON public.support_internal_note;
DROP POLICY IF EXISTS "support_macro_staff_all" ON public.support_macro;

DO $$
BEGIN
  IF to_regclass('public.applicant_profiles') IS NOT NULL THEN
    CREATE POLICY "support_ticket_select_own"
      ON public.support_ticket FOR SELECT
      USING (
        applicant_id IN (
          SELECT id FROM public.applicant_profiles WHERE auth_user_id = auth.uid()
        )
      );
    CREATE POLICY "support_ticket_insert_own"
      ON public.support_ticket FOR INSERT
      WITH CHECK (
        applicant_id IN (
          SELECT id FROM public.applicant_profiles WHERE auth_user_id = auth.uid()
        )
      );
    CREATE POLICY "support_message_select_own"
      ON public.support_message FOR SELECT
      USING (
        ticket_id IN (
          SELECT id FROM public.support_ticket WHERE applicant_id IN (
            SELECT id FROM public.applicant_profiles WHERE auth_user_id = auth.uid()
          )
        )
      );
    CREATE POLICY "support_message_insert_own"
      ON public.support_message FOR INSERT
      WITH CHECK (
        ticket_id IN (
          SELECT id FROM public.support_ticket WHERE applicant_id IN (
            SELECT id FROM public.applicant_profiles WHERE auth_user_id = auth.uid()
          )
        )
      );
  END IF;
END $$;

CREATE POLICY "support_ticket_staff_all"
  ON public.support_ticket FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('staff', 'admin')
        AND users.deleted_at IS NULL
    )
  )
  WITH CHECK (TRUE);

CREATE POLICY "support_message_staff_all"
  ON public.support_message FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('staff', 'admin')
        AND users.deleted_at IS NULL
    )
  )
  WITH CHECK (TRUE);

CREATE POLICY "support_internal_note_staff_only"
  ON public.support_internal_note FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('staff', 'admin')
        AND users.deleted_at IS NULL
    )
  )
  WITH CHECK (TRUE);

CREATE POLICY "support_macro_staff_all"
  ON public.support_macro FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('staff', 'admin')
        AND users.deleted_at IS NULL
    )
  )
  WITH CHECK (TRUE);
