-- Execution state for high-risk admin workflows. These rows make privacy,
-- disputes, and appointment operations owned, resumable, and auditable without
-- turning the successful customer path into a manual approval gate.

CREATE TABLE IF NOT EXISTS public.privacy_execution_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  privacy_request_id UUID NOT NULL REFERENCES public.data_privacy_requests(id) ON DELETE CASCADE,
  operation TEXT NOT NULL CHECK (operation IN ('export', 'erasure')),
  status TEXT NOT NULL DEFAULT 'prepared'
    CHECK (status IN ('prepared', 'awaiting_approval', 'approved', 'running', 'completed', 'blocked', 'failed')),
  inventory JSONB NOT NULL DEFAULT '{}'::jsonb,
  retained_scope JSONB NOT NULL DEFAULT '[]'::jsonb,
  result_redacted JSONB NOT NULL DEFAULT '{}'::jsonb,
  requested_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  executed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (privacy_request_id, operation)
);

CREATE INDEX IF NOT EXISTS privacy_execution_jobs_status_idx
  ON public.privacy_execution_jobs(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.payment_dispute_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_request_id UUID NOT NULL UNIQUE REFERENCES public.refund_request(id) ON DELETE CASCADE,
  stripe_dispute_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'needs_response',
  reason TEXT,
  amount_cents INTEGER,
  currency TEXT,
  evidence_due_at TIMESTAMPTZ,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  submitted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_dispute_cases_queue_idx
  ON public.payment_dispute_cases(status, evidence_due_at, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.appointment_operation_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_job_id UUID NOT NULL UNIQUE REFERENCES public.appointment_assistance_jobs(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'waiting_customer', 'resolved', 'cancelled')),
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  next_action TEXT,
  resolution_code TEXT,
  resolution_notes TEXT,
  last_customer_reminder_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS appointment_operation_cases_queue_idx
  ON public.appointment_operation_cases(status, updated_at DESC);

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('privacy-exports', 'privacy-exports', false, 52428800)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit;

ALTER TABLE public.privacy_execution_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_dispute_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_operation_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "privacy_execution_jobs_staff_all" ON public.privacy_execution_jobs
  FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'staff') AND users.deleted_at IS NULL))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'staff') AND users.deleted_at IS NULL));
CREATE POLICY "payment_dispute_cases_staff_all" ON public.payment_dispute_cases
  FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'staff') AND users.deleted_at IS NULL))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'staff') AND users.deleted_at IS NULL));
CREATE POLICY "appointment_operation_cases_staff_all" ON public.appointment_operation_cases
  FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'staff') AND users.deleted_at IS NULL))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'staff') AND users.deleted_at IS NULL));

CREATE POLICY "privacy_exports_staff_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'privacy-exports' AND EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'staff') AND users.deleted_at IS NULL));

GRANT SELECT, INSERT, UPDATE ON public.privacy_execution_jobs, public.payment_dispute_cases, public.appointment_operation_cases TO authenticated;
GRANT ALL ON public.privacy_execution_jobs, public.payment_dispute_cases, public.appointment_operation_cases TO service_role;
