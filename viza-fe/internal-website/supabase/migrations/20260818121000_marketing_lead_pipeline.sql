-- Durable marketing enquiry pipeline. Contact submissions remain email-notified,
-- but the database record is the operational source of truth for ownership,
-- response SLA, qualification, conversion, and loss reasons.

CREATE TABLE IF NOT EXISTS public.marketing_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  preferred_channel TEXT,
  passport_nationality TEXT,
  destination TEXT,
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  message TEXT NOT NULL,
  locale TEXT,
  source TEXT NOT NULL DEFAULT 'marketing_contact',
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost')),
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  first_response_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '4 hours'),
  loss_reason TEXT,
  converted_applicant_id UUID REFERENCES public.applicant_profiles(id) ON DELETE SET NULL,
  email_delivery_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (email_delivery_status IN ('pending', 'sent', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketing_leads_queue_idx
  ON public.marketing_leads(status, due_at, created_at);
CREATE INDEX IF NOT EXISTS marketing_leads_assignee_idx
  ON public.marketing_leads(assigned_to, status, due_at);
CREATE INDEX IF NOT EXISTS marketing_leads_email_idx
  ON public.marketing_leads(lower(email), created_at DESC);

ALTER TABLE public.marketing_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketing_leads_staff_all"
  ON public.marketing_leads FOR ALL
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

GRANT SELECT, INSERT, UPDATE ON TABLE public.marketing_leads TO authenticated;
GRANT ALL ON TABLE public.marketing_leads TO service_role;
