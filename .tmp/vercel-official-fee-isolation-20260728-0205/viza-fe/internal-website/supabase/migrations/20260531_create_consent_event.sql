-- Legal consent audit log for signup and application authorization.
-- This mirrors the agent-backend consent_event table used by server actions.

CREATE TABLE IF NOT EXISTS public.consent_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  applicant_id UUID,
  application_id UUID,
  email TEXT,
  doc_kind TEXT NOT NULL CHECK (doc_kind IN ('tos', 'privacy', 'application_authorisation', 'dpa')),
  doc_version TEXT NOT NULL,
  ip TEXT,
  ua TEXT,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT consent_event_subject_present CHECK (
    user_id IS NOT NULL
    OR applicant_id IS NOT NULL
    OR application_id IS NOT NULL
    OR email IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_consent_event_user_id_ts
  ON public.consent_event(user_id, ts DESC);

CREATE INDEX IF NOT EXISTS idx_consent_event_applicant_id_ts
  ON public.consent_event(applicant_id, ts DESC);

CREATE INDEX IF NOT EXISTS idx_consent_event_email
  ON public.consent_event(LOWER(email)) WHERE email IS NOT NULL;

ALTER TABLE public.consent_event ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consent_event_select_own"
  ON public.consent_event FOR SELECT
  USING (user_id = auth.uid());
