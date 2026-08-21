-- Database access baseline for the Supabase Data API permission change.
--
-- This migration is additive and transactional. It makes future public-schema
-- objects private until a migration grants an exact role/operation contract,
-- restores the missing application translation table used by the backend, and
-- hardens the confirmed production ACL/RLS/view/function findings without
-- deleting, renaming, or rewriting customer data.

-- Migrations execute as the database migration owner. Supabase also creates
-- objects as supabase_admin in some dashboard/platform paths, so configure both
-- owners when that managed role is present.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;

DO $database_access_defaults$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'supabase_admin') THEN
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role';
  END IF;
END
$database_access_defaults$;

-- The application backend has always declared and used this table, but the
-- production catalog did not contain it. Install the existing contract and
-- expose only owned rows to authenticated users.
CREATE TABLE IF NOT EXISTS public.application_translations (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  application_id UUID NOT NULL
    REFERENCES public.applications(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  source_text TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  source_lang TEXT NOT NULL DEFAULT 'zh',
  target_lang TEXT NOT NULL DEFAULT 'en',
  translated_by TEXT NOT NULL DEFAULT 'google',
  user_edited BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT application_translations_application_field_target_key
    UNIQUE (application_id, field_key, target_lang)
);

CREATE INDEX IF NOT EXISTS idx_app_translations_app_id
  ON public.application_translations (application_id);

ALTER TABLE public.application_translations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS application_translations_select_own
  ON public.application_translations;
CREATE POLICY application_translations_select_own
  ON public.application_translations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.applications AS application
      JOIN public.applicant_profiles AS applicant
        ON applicant.id = application.applicant_id
      WHERE application.id = application_translations.application_id
        AND applicant.auth_user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS application_translations_insert_own
  ON public.application_translations;
CREATE POLICY application_translations_insert_own
  ON public.application_translations
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.applications AS application
      JOIN public.applicant_profiles AS applicant
        ON applicant.id = application.applicant_id
      WHERE application.id = application_translations.application_id
        AND applicant.auth_user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS application_translations_update_own
  ON public.application_translations;
CREATE POLICY application_translations_update_own
  ON public.application_translations
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.applications AS application
      JOIN public.applicant_profiles AS applicant
        ON applicant.id = application.applicant_id
      WHERE application.id = application_translations.application_id
        AND applicant.auth_user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.applications AS application
      JOIN public.applicant_profiles AS applicant
        ON applicant.id = application.applicant_id
      WHERE application.id = application_translations.application_id
        AND applicant.auth_user_id = (SELECT auth.uid())
    )
  );

REVOKE ALL ON TABLE public.application_translations
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.application_translations TO authenticated;
GRANT ALL ON TABLE public.application_translations TO service_role;

-- public.users is queried with the signed-in Supabase session only for the
-- caller's own role/profile row. Administrative list/mutation paths use the
-- server-only service-role client.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_select_own ON public.users;
CREATE POLICY users_select_own
  ON public.users
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));

REVOKE ALL ON TABLE public.users
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.users TO authenticated;
GRANT ALL ON TABLE public.users TO service_role;

-- Encrypted official identifiers, remote-debug tokens, OTP aliases, and
-- operational timing samples are never browser-readable. Service role bypasses
-- RLS only after the route/action authorization boundary.
ALTER TABLE public.ds160_live_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ds160_live_sessions
  FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE public.ds160_live_sessions TO service_role;

ALTER TABLE public.takeover_session ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.takeover_session
  FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE public.takeover_session TO service_role;

ALTER TABLE public.takeover_action_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.takeover_action_log
  FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE public.takeover_action_log TO service_role;
REVOKE ALL ON SEQUENCE public.takeover_action_log_id_seq
  FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.takeover_action_log_id_seq TO service_role;

ALTER TABLE public.application_inbox_aliases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.application_inbox_aliases
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.application_inbox_aliases TO service_role;

ALTER TABLE public.runner_concurrency_metric ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.runner_concurrency_metric
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.runner_concurrency_metric TO service_role;
REVOKE ALL ON SEQUENCE public.runner_concurrency_metric_id_seq
  FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.runner_concurrency_metric_id_seq TO service_role;

-- Preserve the existing view definition and dependencies; only switch the
-- execution model and ACL.
ALTER VIEW public.runner_queue_depth SET (security_invoker = true);
REVOKE ALL ON TABLE public.runner_queue_depth
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.runner_queue_depth TO service_role;

-- Recreate the one confirmed externally executable SECURITY DEFINER function
-- with the same identity/signature and schema-qualified relations. The empty
-- search path is now safe, and only the server-side service role can call it.
CREATE OR REPLACE FUNCTION public.commit_travel_agent_turn(
  p_session_id text,
  p_user_id uuid,
  p_external_message_id text,
  p_expected_state_version bigint,
  p_user_content text,
  p_assistant_content text,
  p_state_json jsonb,
  p_memory_summary text,
  p_openai_response_id text,
  p_pending_actions_json jsonb,
  p_response_json jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_session public.travel_agent_sessions%ROWTYPE;
  stored_response jsonb;
BEGIN
  SELECT response_json INTO stored_response
  FROM public.travel_agent_messages
  WHERE session_id = p_session_id
    AND user_id = p_user_id
    AND external_message_id = p_external_message_id
    AND role = 'user';

  IF stored_response IS NOT NULL THEN
    RETURN pg_catalog.jsonb_build_object('status', 'replayed', 'response', stored_response);
  END IF;

  SELECT * INTO current_session
  FROM public.travel_agent_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND OR current_session.user_id <> p_user_id THEN
    RETURN pg_catalog.jsonb_build_object('status', 'missing');
  END IF;

  IF current_session.state_version <> p_expected_state_version THEN
    RETURN pg_catalog.jsonb_build_object(
      'status', 'conflict',
      'state_version', current_session.state_version,
      'state', current_session.state_json
    );
  END IF;

  UPDATE public.travel_agent_sessions
  SET state_json = p_state_json,
      state_version = state_version + 1,
      memory_summary = p_memory_summary,
      openai_previous_response_id = p_openai_response_id,
      pending_actions_json = p_pending_actions_json,
      updated_at = pg_catalog.now()
  WHERE id = p_session_id;

  INSERT INTO public.travel_agent_messages (
    session_id, user_id, external_message_id, role, content,
    openai_response_id, response_json
  ) VALUES (
    p_session_id, p_user_id, p_external_message_id, 'user', p_user_content,
    p_openai_response_id, p_response_json
  );

  INSERT INTO public.travel_agent_messages (
    session_id, user_id, external_message_id, role, content,
    openai_response_id
  ) VALUES (
    p_session_id, p_user_id, p_external_message_id, 'assistant',
    p_assistant_content, p_openai_response_id
  );

  RETURN pg_catalog.jsonb_build_object('status', 'ok', 'response', p_response_json);
END;
$$;

REVOKE ALL ON FUNCTION public.commit_travel_agent_turn(
  text, uuid, text, bigint, text, text, jsonb, text, text, jsonb, jsonb
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.commit_travel_agent_turn(
  text, uuid, text, bigint, text, text, jsonb, text, text, jsonb, jsonb
) TO service_role;

-- These confirmed SECURITY DEFINER bodies already use schema-qualified table
-- references. ALTER preserves their OIDs, signatures, ownership, ACLs, and
-- dependencies while removing the mutable search path.
DO $database_access_functions$
BEGIN
  IF pg_catalog.to_regprocedure(
    'public.record_portal_health_check(text,text,integer,integer,text,text,timestamp with time zone,text)'
  ) IS NOT NULL THEN
    EXECUTE $alter$ALTER FUNCTION public.record_portal_health_check(
      TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT, TIMESTAMPTZ, TEXT
    ) SET search_path = ''$alter$;
  END IF;
  IF pg_catalog.to_regprocedure('public.get_public_portal_status(integer)') IS NOT NULL THEN
    EXECUTE $alter$ALTER FUNCTION public.get_public_portal_status(INTEGER)
      SET search_path = ''$alter$;
  END IF;
  IF pg_catalog.to_regprocedure(
    'public.save_catalogue_draft(uuid,jsonb,jsonb,uuid,text)'
  ) IS NOT NULL THEN
    EXECUTE $alter$ALTER FUNCTION public.save_catalogue_draft(UUID, JSONB, JSONB, UUID, TEXT)
      SET search_path = ''$alter$;
  END IF;
  IF pg_catalog.to_regprocedure(
    'public.publish_catalogue_entry(uuid,jsonb,uuid,text)'
  ) IS NOT NULL THEN
    EXECUTE $alter$ALTER FUNCTION public.publish_catalogue_entry(UUID, JSONB, UUID, TEXT)
      SET search_path = ''$alter$;
  END IF;
  IF pg_catalog.to_regprocedure('public.retire_catalogue_entry(uuid,uuid,text)') IS NOT NULL THEN
    EXECUTE $alter$ALTER FUNCTION public.retire_catalogue_entry(UUID, UUID, TEXT)
      SET search_path = ''$alter$;
  END IF;
END
$database_access_functions$;
