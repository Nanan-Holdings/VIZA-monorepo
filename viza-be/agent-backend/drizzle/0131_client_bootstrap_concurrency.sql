-- Bound client bootstrap work and make destination selection idempotent.

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_form_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  form_type TEXT NOT NULL DEFAULT 'about_me'
    CHECK (form_type IN ('about_me')),
  triggered_by TEXT NOT NULL DEFAULT 'system'
    CHECK (triggered_by IN ('system', 'admin', 'scheduled')),
  triggered_by_user_id UUID,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'skipped')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  skipped_at TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  notes TEXT
);

COMMENT ON COLUMN public.user_form_requests.user_id IS
  'VIZA subject id. Supports both legacy public.users and applicant_profiles during identity migration.';

CREATE INDEX IF NOT EXISTS user_form_requests_user_status_created_idx
  ON public.user_form_requests (user_id, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS user_form_requests_one_pending_idx
  ON public.user_form_requests (user_id, form_type)
  WHERE status = 'pending';

ALTER TABLE public.user_form_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_form_requests FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_form_requests TO service_role;

CREATE OR REPLACE FUNCTION public.ensure_first_login_form_request(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request_id UUID;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT request.id
  INTO v_request_id
  FROM public.user_form_requests request
  WHERE request.user_id = p_user_id
    AND request.form_type = 'about_me'
    AND request.status = 'pending'
  ORDER BY request.created_at DESC
  LIMIT 1;

  IF v_request_id IS NOT NULL THEN
    RETURN v_request_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_form_requests request
    WHERE request.user_id = p_user_id
      AND request.form_type = 'about_me'
      AND request.status = 'completed'
  ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.user_form_requests (
    user_id,
    form_type,
    triggered_by,
    status,
    notes
  )
  VALUES (
    p_user_id,
    'about_me',
    'system',
    'pending',
    'First login - please complete your profile'
  )
  ON CONFLICT (user_id, form_type) WHERE status = 'pending'
  DO NOTHING
  RETURNING id INTO v_request_id;

  IF v_request_id IS NULL THEN
    SELECT request.id
    INTO v_request_id
    FROM public.user_form_requests request
    WHERE request.user_id = p_user_id
      AND request.form_type = 'about_me'
      AND request.status = 'pending'
    ORDER BY request.created_at DESC
    LIMIT 1;
  END IF;

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_first_login_form_request(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_first_login_form_request(UUID) TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS user_packages_one_active_package_idx
  ON public.user_packages (auth_user_id, visa_package_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS visa_chat_messages_session_created_idx
  ON public.visa_chat_messages (session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS visa_chat_sessions_applicant_updated_idx
  ON public.visa_chat_sessions (applicant_id, updated_at DESC);

CREATE OR REPLACE FUNCTION public.select_user_visa_destination(
  p_auth_user_id UUID,
  p_country TEXT,
  p_visa_type TEXT,
  p_name TEXT,
  p_description TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  id UUID,
  country TEXT,
  visa_type TEXT,
  name TEXT,
  description TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_package_id UUID;
BEGIN
  IF p_auth_user_id IS NULL OR NULLIF(trim(p_country), '') IS NULL
    OR NULLIF(trim(p_visa_type), '') IS NULL THEN
    RAISE EXCEPTION 'auth user, country and visa type are required';
  END IF;

  INSERT INTO public.visa_packages (
    country,
    visa_type,
    name,
    description,
    is_active,
    metadata
  )
  VALUES (
    p_country,
    p_visa_type,
    p_name,
    p_description,
    true,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  ON CONFLICT DO NOTHING;

  SELECT package.id
  INTO v_package_id
  FROM public.visa_packages package
  WHERE lower(trim(package.country)) = lower(trim(p_country))
    AND upper(trim(package.visa_type)) = upper(trim(p_visa_type))
    AND package.is_active = true
  ORDER BY package.created_at ASC, package.id ASC
  LIMIT 1;

  IF v_package_id IS NULL THEN
    RAISE EXCEPTION 'active visa package could not be resolved';
  END IF;

  INSERT INTO public.user_packages (
    auth_user_id,
    visa_package_id,
    status
  )
  VALUES (
    p_auth_user_id,
    v_package_id,
    'active'
  )
  ON CONFLICT (auth_user_id, visa_package_id) WHERE status = 'active'
  DO NOTHING;

  RETURN QUERY
  SELECT
    package.id,
    package.country,
    package.visa_type,
    package.name,
    package.description
  FROM public.visa_packages package
  WHERE package.id = v_package_id;
END;
$$;

REVOKE ALL ON FUNCTION public.select_user_visa_destination(UUID, TEXT, TEXT, TEXT, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.select_user_visa_destination(UUID, TEXT, TEXT, TEXT, TEXT, JSONB)
  TO service_role;

COMMIT;
