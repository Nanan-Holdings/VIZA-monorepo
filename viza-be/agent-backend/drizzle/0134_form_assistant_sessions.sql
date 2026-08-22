-- Durable per-application Form Filling Assistant sessions and messages.

ALTER TABLE public.visa_application_answers
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS source_profile_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source_metadata JSONB;

CREATE TABLE IF NOT EXISTS public.form_assistant_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL
    REFERENCES public.applications(id) ON DELETE CASCADE,
  applicant_id UUID NOT NULL
    REFERENCES public.applicant_profiles(id) ON DELETE CASCADE,
  auth_user_id UUID NOT NULL,
  schema_fingerprint TEXT NOT NULL,
  knowledge_release_id UUID,
  knowledge_release_key TEXT,
  state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  state_version BIGINT NOT NULL DEFAULT 0,
  last_check_json JSONB,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.form_assistant_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL
    REFERENCES public.form_assistant_sessions(id) ON DELETE CASCADE,
  application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
  applicant_id UUID REFERENCES public.applicant_profiles(id) ON DELETE CASCADE,
  auth_user_id UUID,
  idempotency_key TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  input_mode TEXT NOT NULL DEFAULT 'text'
    CHECK (input_mode IN ('text', 'voice', 'system')),
  response_json JSONB,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS form_assistant_sessions_application_unique_idx
  ON public.form_assistant_sessions (application_id);
CREATE INDEX IF NOT EXISTS form_assistant_sessions_auth_user_updated_idx
  ON public.form_assistant_sessions (auth_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS form_assistant_sessions_applicant_updated_idx
  ON public.form_assistant_sessions (applicant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS form_assistant_messages_session_created_idx
  ON public.form_assistant_messages (session_id, created_at);
CREATE INDEX IF NOT EXISTS form_assistant_messages_application_created_idx
  ON public.form_assistant_messages (application_id, created_at);
CREATE INDEX IF NOT EXISTS form_assistant_messages_auth_user_created_idx
  ON public.form_assistant_messages (auth_user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS form_assistant_messages_session_idempotency_role_unique_idx
  ON public.form_assistant_messages (session_id, idempotency_key, role);

ALTER TABLE public.form_assistant_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_assistant_messages ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.form_assistant_sessions FROM PUBLIC;
REVOKE ALL ON TABLE public.form_assistant_sessions FROM anon;
REVOKE ALL ON TABLE public.form_assistant_sessions FROM authenticated;
REVOKE ALL ON TABLE public.form_assistant_messages FROM PUBLIC;
REVOKE ALL ON TABLE public.form_assistant_messages FROM anon;
REVOKE ALL ON TABLE public.form_assistant_messages FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.form_assistant_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.form_assistant_messages TO authenticated;
GRANT ALL ON TABLE public.form_assistant_sessions TO service_role;
GRANT ALL ON TABLE public.form_assistant_messages TO service_role;

DROP POLICY IF EXISTS form_assistant_sessions_owner_all
  ON public.form_assistant_sessions;
CREATE POLICY form_assistant_sessions_owner_all
  ON public.form_assistant_sessions
  FOR ALL TO authenticated
  USING (
    auth_user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.applications AS application_record
      JOIN public.applicant_profiles AS profile
        ON profile.id = application_record.applicant_id
      WHERE application_record.id = form_assistant_sessions.application_id
        AND application_record.applicant_id = form_assistant_sessions.applicant_id
        AND (
          profile.auth_user_id = (SELECT auth.uid())
          OR profile.dependant_of_user_id = (SELECT auth.uid())
        )
    )
  )
  WITH CHECK (
    auth_user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.applications AS application_record
      JOIN public.applicant_profiles AS profile
        ON profile.id = application_record.applicant_id
      WHERE application_record.id = form_assistant_sessions.application_id
        AND application_record.applicant_id = form_assistant_sessions.applicant_id
        AND (
          profile.auth_user_id = (SELECT auth.uid())
          OR profile.dependant_of_user_id = (SELECT auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS form_assistant_messages_owner_all
  ON public.form_assistant_messages;
CREATE POLICY form_assistant_messages_owner_all
  ON public.form_assistant_messages
  FOR ALL TO authenticated
  USING (
    (form_assistant_messages.auth_user_id IS NULL
      OR form_assistant_messages.auth_user_id = (SELECT auth.uid()))
    AND EXISTS (
      SELECT 1
      FROM public.form_assistant_sessions AS assistant_session
      WHERE assistant_session.id = form_assistant_messages.session_id
        AND assistant_session.auth_user_id = (SELECT auth.uid())
        AND (form_assistant_messages.application_id IS NULL
          OR form_assistant_messages.application_id = assistant_session.application_id)
        AND (form_assistant_messages.applicant_id IS NULL
          OR form_assistant_messages.applicant_id = assistant_session.applicant_id)
    )
  )
  WITH CHECK (
    (form_assistant_messages.auth_user_id IS NULL
      OR form_assistant_messages.auth_user_id = (SELECT auth.uid()))
    AND EXISTS (
      SELECT 1
      FROM public.form_assistant_sessions AS assistant_session
      WHERE assistant_session.id = form_assistant_messages.session_id
        AND assistant_session.auth_user_id = (SELECT auth.uid())
        AND (form_assistant_messages.application_id IS NULL
          OR form_assistant_messages.application_id = assistant_session.application_id)
        AND (form_assistant_messages.applicant_id IS NULL
          OR form_assistant_messages.applicant_id = assistant_session.applicant_id)
    )
  );

COMMENT ON TABLE public.form_assistant_sessions IS
  'Durable, application-scoped Form Filling Assistant state and validation summary.';
COMMENT ON TABLE public.form_assistant_messages IS
  'Persisted text turns for the application Form Filling Assistant; raw audio is never stored.';
