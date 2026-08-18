-- Admin operations backbone.
--
-- Work items turn payment, document, submission, support, privacy, and platform
-- exceptions into owned, time-bound workflows. They are not approval gates for
-- a successful automated path; producers create them only when attention is
-- required or when a staff member intentionally schedules follow-up work.

CREATE TABLE IF NOT EXISTS public.admin_work_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
  applicant_id UUID REFERENCES public.applicant_profiles(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public."order"(id) ON DELETE SET NULL,
  source_type TEXT,
  source_id TEXT,
  dedupe_key TEXT UNIQUE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'waiting_customer', 'blocked', 'resolved', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'p2'
    CHECK (priority IN ('p0', 'p1', 'p2', 'p3')),
  owning_team TEXT NOT NULL DEFAULT 'operations',
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  due_at TIMESTAMPTZ,
  checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata_redacted JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolution_code TEXT,
  resolution_notes TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_work_items_queue_idx
  ON public.admin_work_items(status, priority, due_at, created_at);
CREATE INDEX IF NOT EXISTS admin_work_items_assignee_idx
  ON public.admin_work_items(assigned_to, status, due_at);
CREATE INDEX IF NOT EXISTS admin_work_items_application_idx
  ON public.admin_work_items(application_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_work_items_source_idx
  ON public.admin_work_items(source_type, source_id);

CREATE TABLE IF NOT EXISTS public.admin_work_item_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_item_id UUID NOT NULL REFERENCES public.admin_work_items(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  reason TEXT,
  before_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  after_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_redacted JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_work_item_events_item_idx
  ON public.admin_work_item_events(work_item_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.admin_command_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  command TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  before_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  after_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_redacted JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_command_events_target_idx
  ON public.admin_command_events(target_type, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_command_events_actor_idx
  ON public.admin_command_events(actor_user_id, created_at DESC);

ALTER TABLE public.admin_work_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_work_item_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_command_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_work_items_staff_all"
  ON public.admin_work_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'staff', 'customer_service')
        AND users.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'staff', 'customer_service')
        AND users.deleted_at IS NULL
    )
  );

CREATE POLICY "admin_work_item_events_staff_read"
  ON public.admin_work_item_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'staff', 'customer_service')
        AND users.deleted_at IS NULL
    )
  );

CREATE POLICY "admin_work_item_events_staff_insert"
  ON public.admin_work_item_events FOR INSERT
  WITH CHECK (
    actor_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'staff', 'customer_service')
        AND users.deleted_at IS NULL
    )
  );

CREATE POLICY "admin_command_events_staff_read"
  ON public.admin_command_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'staff', 'customer_service')
        AND users.deleted_at IS NULL
    )
  );

CREATE POLICY "admin_command_events_staff_insert"
  ON public.admin_command_events FOR INSERT
  WITH CHECK (
    actor_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'staff', 'customer_service')
        AND users.deleted_at IS NULL
    )
  );

GRANT SELECT, INSERT, UPDATE ON TABLE public.admin_work_items TO authenticated;
GRANT SELECT, INSERT ON TABLE public.admin_work_item_events TO authenticated;
GRANT SELECT, INSERT ON TABLE public.admin_command_events TO authenticated;
GRANT ALL ON TABLE public.admin_work_items, public.admin_work_item_events, public.admin_command_events TO service_role;
