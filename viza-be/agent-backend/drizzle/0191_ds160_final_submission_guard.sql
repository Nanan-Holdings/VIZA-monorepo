-- Durable DS-160 Sign and Submit deduplication.
--
-- A queue lease prevents two live workers from settling the same queue row at
-- once. This table adds the second, cross-run fence needed after a browser
-- click: once an authorization has started, an automatic retry must recover
-- the existing CEAC Application ID instead of clicking a new draft. A new
-- explicit resubmission is represented by a new authorization_id.

CREATE TABLE IF NOT EXISTS public.ds160_final_submission_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  authorization_id TEXT NOT NULL CHECK (btrim(authorization_id) <> ''),
  queue_id UUID REFERENCES public.submission_queue(id) ON DELETE SET NULL,
  owner_id TEXT NOT NULL CHECK (btrim(owner_id) <> ''),
  state TEXT NOT NULL DEFAULT 'started'
    CHECK (state IN ('started', 'unknown', 'confirmed')),
  official_application_id_hash TEXT,
  confirmation_number_hash TEXT,
  confirmation_page_url TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  clicked_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  last_error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (application_id, authorization_id)
);

CREATE INDEX IF NOT EXISTS ds160_final_submission_attempts_application_idx
  ON public.ds160_final_submission_attempts(application_id, state, updated_at DESC);

ALTER TABLE public.ds160_final_submission_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ds160_final_submission_attempts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ds160_final_submission_attempts TO service_role;

CREATE OR REPLACE FUNCTION public.begin_ds160_final_submission(
  p_application_id UUID,
  p_authorization_id TEXT,
  p_queue_id UUID,
  p_owner_id TEXT,
  p_lease_seconds INTEGER DEFAULT 900
)
RETURNS TABLE (
  decision TEXT,
  attempt_id UUID,
  attempt_state TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_attempt public.ds160_final_submission_attempts%ROWTYPE;
  v_attempt_id UUID;
BEGIN
  IF p_application_id IS NULL THEN
    RAISE EXCEPTION 'DS-160 application id is required' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(BTRIM(p_authorization_id), '') IS NULL THEN
    RAISE EXCEPTION 'DS-160 authorization id is required' USING ERRCODE = '22023';
  END IF;
  IF p_queue_id IS NULL THEN
    RAISE EXCEPTION 'DS-160 queue id is required' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(BTRIM(p_owner_id), '') IS NULL THEN
    RAISE EXCEPTION 'DS-160 queue lease owner is required' USING ERRCODE = '22023';
  END IF;
  IF p_lease_seconds < 60 OR p_lease_seconds > 7200 THEN
    RAISE EXCEPTION 'DS-160 final submission lease must be between 60 and 7200 seconds'
      USING ERRCODE = '22023';
  END IF;

  -- Serialize final-submit authorization per VIZA application.
  PERFORM 1
  FROM public.applications
  WHERE id = p_application_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DS-160 application does not exist' USING ERRCODE = '23503';
  END IF;

  -- The caller must still own the queue lease at the reservation boundary.
  PERFORM 1
  FROM public.submission_queue
  WHERE id = p_queue_id
    AND application_id = p_application_id
    AND BTRIM(locked_by) = BTRIM(p_owner_id)
    AND locked_until > clock_timestamp()
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DS-160 queue lease is not owned or has expired' USING ERRCODE = '40001';
  END IF;

  SELECT *
  INTO v_attempt
  FROM public.ds160_final_submission_attempts
  WHERE application_id = p_application_id
    AND authorization_id = BTRIM(p_authorization_id)
  FOR UPDATE;

  IF v_attempt.id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      CASE v_attempt.state
        WHEN 'started' THEN 'already_started'
        ELSE v_attempt.state
      END,
      v_attempt.id,
      v_attempt.state;
    RETURN;
  END IF;

  INSERT INTO public.ds160_final_submission_attempts (
    application_id,
    authorization_id,
    queue_id,
    owner_id,
    state,
    started_at,
    created_at,
    updated_at
  )
  VALUES (
    p_application_id,
    BTRIM(p_authorization_id),
    p_queue_id,
    BTRIM(p_owner_id),
    'started',
    clock_timestamp(),
    clock_timestamp(),
    clock_timestamp()
  )
  RETURNING id INTO v_attempt_id;

  RETURN QUERY SELECT 'acquired'::TEXT, v_attempt_id, 'started'::TEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_ds160_final_submission_unknown(
  p_attempt_id UUID,
  p_application_id UUID,
  p_authorization_id TEXT,
  p_queue_id UUID,
  p_owner_id TEXT,
  p_error_code TEXT DEFAULT 'final_submission_unknown'
)
RETURNS TABLE (
  attempt_id UUID,
  attempt_state TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_attempt public.ds160_final_submission_attempts%ROWTYPE;
  v_attempt_id UUID;
  v_attempt_state TEXT;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF p_attempt_id IS NULL OR p_application_id IS NULL OR p_queue_id IS NULL THEN
    RAISE EXCEPTION 'DS-160 final submission identifiers are required' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(BTRIM(p_authorization_id), '') IS NULL
    OR NULLIF(BTRIM(p_owner_id), '') IS NULL THEN
    RAISE EXCEPTION 'DS-160 authorization and lease owner are required' USING ERRCODE = '22023';
  END IF;

  PERFORM 1
  FROM public.applications
  WHERE id = p_application_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DS-160 application does not exist' USING ERRCODE = '23503';
  END IF;

  SELECT *
  INTO v_attempt
  FROM public.ds160_final_submission_attempts
  WHERE id = p_attempt_id
    AND application_id = p_application_id
    AND authorization_id = BTRIM(p_authorization_id)
    AND owner_id = BTRIM(p_owner_id)
  FOR UPDATE;
  IF v_attempt.id IS NULL THEN
    RAISE EXCEPTION 'DS-160 final submission reservation is not owned' USING ERRCODE = '40001';
  END IF;
  IF v_attempt.state <> 'started' THEN
    RAISE EXCEPTION 'DS-160 final submission reservation already has a terminal state'
      USING ERRCODE = '40001';
  END IF;

  PERFORM 1
  FROM public.submission_queue
  WHERE id = p_queue_id
    AND application_id = p_application_id
    AND BTRIM(locked_by) = BTRIM(p_owner_id)
    AND locked_until > v_now
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DS-160 queue lease is not owned or has expired' USING ERRCODE = '40001';
  END IF;

  UPDATE public.ds160_final_submission_attempts
  SET
    state = 'unknown',
    clicked_at = COALESCE(clicked_at, v_now),
    last_error_code = NULLIF(LEFT(BTRIM(COALESCE(p_error_code, 'final_submission_unknown')), 80), ''),
    updated_at = v_now
  WHERE id = v_attempt.id
    AND state = 'started'
  RETURNING id, state INTO v_attempt_id, v_attempt_state;

  IF v_attempt_id IS NULL THEN
    RAISE EXCEPTION 'DS-160 final submission state transition was lost' USING ERRCODE = '40001';
  END IF;
  RETURN QUERY SELECT v_attempt_id, v_attempt_state;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_ds160_final_submission(
  p_attempt_id UUID,
  p_application_id UUID,
  p_authorization_id TEXT,
  p_queue_id UUID,
  p_owner_id TEXT,
  p_official_application_id_hash TEXT,
  p_confirmation_number_hash TEXT DEFAULT NULL,
  p_confirmation_page_url TEXT DEFAULT NULL
)
RETURNS TABLE (
  attempt_id UUID,
  attempt_state TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_attempt public.ds160_final_submission_attempts%ROWTYPE;
  v_attempt_id UUID;
  v_attempt_state TEXT;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF p_attempt_id IS NULL OR p_application_id IS NULL OR p_queue_id IS NULL THEN
    RAISE EXCEPTION 'DS-160 final submission identifiers are required' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(BTRIM(p_authorization_id), '') IS NULL
    OR NULLIF(BTRIM(p_owner_id), '') IS NULL THEN
    RAISE EXCEPTION 'DS-160 authorization and lease owner are required' USING ERRCODE = '22023';
  END IF;
  IF p_official_application_id_hash IS NULL
    OR p_official_application_id_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'DS-160 official application id hash is invalid' USING ERRCODE = '22023';
  END IF;
  IF p_confirmation_number_hash IS NOT NULL
    AND p_confirmation_number_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'DS-160 confirmation number hash is invalid' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(BTRIM(p_confirmation_page_url), '') IS NULL THEN
    RAISE EXCEPTION 'DS-160 confirmation page URL is required' USING ERRCODE = '22023';
  END IF;

  PERFORM 1
  FROM public.applications
  WHERE id = p_application_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DS-160 application does not exist' USING ERRCODE = '23503';
  END IF;

  SELECT *
  INTO v_attempt
  FROM public.ds160_final_submission_attempts
  WHERE id = p_attempt_id
    AND application_id = p_application_id
    AND authorization_id = BTRIM(p_authorization_id)
    AND owner_id = BTRIM(p_owner_id)
  FOR UPDATE;
  IF v_attempt.id IS NULL THEN
    RAISE EXCEPTION 'DS-160 final submission reservation is not owned' USING ERRCODE = '40001';
  END IF;
  IF v_attempt.state <> 'started' THEN
    RAISE EXCEPTION 'DS-160 final submission reservation already has a terminal state'
      USING ERRCODE = '40001';
  END IF;

  PERFORM 1
  FROM public.submission_queue
  WHERE id = p_queue_id
    AND application_id = p_application_id
    AND BTRIM(locked_by) = BTRIM(p_owner_id)
    AND locked_until > v_now
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DS-160 queue lease is not owned or has expired' USING ERRCODE = '40001';
  END IF;

  UPDATE public.ds160_final_submission_attempts
  SET
    state = 'confirmed',
    official_application_id_hash = LOWER(BTRIM(p_official_application_id_hash)),
    confirmation_number_hash = CASE
      WHEN p_confirmation_number_hash IS NULL THEN NULL
      ELSE LOWER(BTRIM(p_confirmation_number_hash))
    END,
    confirmation_page_url = BTRIM(p_confirmation_page_url),
    clicked_at = COALESCE(clicked_at, v_now),
    confirmed_at = v_now,
    last_error_code = NULL,
    updated_at = v_now
  WHERE id = v_attempt.id
    AND state = 'started'
  RETURNING id, state INTO v_attempt_id, v_attempt_state;

  IF v_attempt_id IS NULL THEN
    RAISE EXCEPTION 'DS-160 final submission state transition was lost' USING ERRCODE = '40001';
  END IF;
  RETURN QUERY SELECT v_attempt_id, v_attempt_state;
END;
$$;

REVOKE ALL ON FUNCTION public.begin_ds160_final_submission(UUID, TEXT, UUID, TEXT, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_ds160_final_submission(UUID, TEXT, UUID, TEXT, INTEGER)
  TO service_role;

REVOKE ALL ON FUNCTION public.mark_ds160_final_submission_unknown(UUID, UUID, TEXT, UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_ds160_final_submission_unknown(UUID, UUID, TEXT, UUID, TEXT, TEXT)
  TO service_role;

REVOKE ALL ON FUNCTION public.confirm_ds160_final_submission(UUID, UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_ds160_final_submission(UUID, UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT)
  TO service_role;

COMMENT ON TABLE public.ds160_final_submission_attempts IS
  'Persistent one-click fence for each DS-160 final submission authorization. Official identifiers are stored only as hashes.';
COMMENT ON FUNCTION public.begin_ds160_final_submission(UUID, TEXT, UUID, TEXT, INTEGER) IS
  'Atomically records a DS-160 final submission start after verifying the caller owns the submission queue lease.';
COMMENT ON FUNCTION public.mark_ds160_final_submission_unknown(UUID, UUID, TEXT, UUID, TEXT, TEXT) IS
  'Records an unknowable DS-160 final-submit outcome while preserving the cross-run duplicate-click fence.';
COMMENT ON FUNCTION public.confirm_ds160_final_submission(UUID, UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT) IS
  'Records verified CEAC confirmation evidence for a reserved DS-160 final submission.';
