-- Durable DS-160 official confirmation-email queue and send fence.
--
-- The queue row is the only durable state for this action.  The request
-- metadata is kept in ceac_result_payload so an explicit retry can be
-- distinguished from a worker replay without storing the recipient address.
-- A reservation is written immediately before the CEAC send click.  Once the
-- reservation exists, an interrupted worker must settle as unknown rather
-- than replaying the click automatically.

CREATE OR REPLACE FUNCTION public.enqueue_ds160_proof_email(
  p_application_id UUID,
  p_auth_user_id UUID,
  p_request_id UUID,
  p_recipient_sha256 TEXT,
  p_retry BOOLEAN DEFAULT FALSE
)
RETURNS SETOF public.submission_queue
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_application public.applications%ROWTYPE;
  v_profile public.applicant_profiles%ROWTYPE;
  v_recipient_sha256 TEXT := LOWER(BTRIM(p_recipient_sha256));
  v_now TIMESTAMPTZ;
  v_queue public.submission_queue%ROWTYPE;
  v_existing_request public.submission_queue%ROWTYPE;
  v_same_email_active public.submission_queue%ROWTYPE;
  v_same_email_terminal public.submission_queue%ROWTYPE;
  v_action TEXT;
  v_email_status TEXT;
  v_existing_request_id TEXT;
  v_existing_recipient_sha256 TEXT;
  v_is_active BOOLEAN;
  v_has_other_active BOOLEAN := FALSE;
  v_email_payload JSONB;
  v_new_payload JSONB;
BEGIN
  IF p_application_id IS NULL OR p_auth_user_id IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'DS-160 email application, user, and request identifiers are required'
      USING ERRCODE = '22023';
  END IF;
  IF v_recipient_sha256 IS NULL OR v_recipient_sha256 !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'DS-160 email recipient digest must be a lowercase hexadecimal SHA-256 value'
      USING ERRCODE = '22023';
  END IF;

  -- This lock is the per-application enqueue mutex.  It also prevents a
  -- download/proof enqueue from racing this email action's active-row scan.
  SELECT a.*
  INTO v_application
  FROM public.applications AS a
  WHERE a.id = p_application_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DS-160 application does not exist' USING ERRCODE = '23503';
  END IF;

  SELECT p.*
  INTO v_profile
  FROM public.applicant_profiles AS p
  WHERE p.id = v_application.applicant_id
    AND p.auth_user_id = p_auth_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DS-160 application is not owned by the authenticated user'
      USING ERRCODE = '42501';
  END IF;

  -- The API computes this digest from auth.getUser(), and the worker repeats
  -- the auth.admin.getUserById check immediately before opening CEAC.  The
  -- service role intentionally has no auth.users SELECT grant, so the queue
  -- RPC validates the owner and digest shape without widening auth ACLs.

  IF UPPER(BTRIM(COALESCE(v_application.country, ''))) NOT IN
      ('US', 'USA', 'UNITED STATES', 'UNITED_STATES', 'UNITED_STATES_OF_AMERICA')
     OR UPPER(BTRIM(COALESCE(v_application.submission_result ->> 'country', ''))) <> 'US'
     OR LOWER(BTRIM(COALESCE(v_application.submission_result ->> 'status', ''))) <> 'submitted' THEN
    RAISE EXCEPTION 'DS-160 official email requires a submitted US result'
      USING ERRCODE = '55000';
  END IF;

  -- Sample the database clock only after the application lock is acquired.
  -- Every queue row for this application is then locked before any decision,
  -- so concurrent clicks cannot both pass the active-row check.
  v_now := clock_timestamp();
  FOR v_queue IN
    SELECT sq.*
    FROM public.submission_queue AS sq
    WHERE sq.application_id = p_application_id
    ORDER BY sq.updated_at DESC NULLS LAST, sq.id DESC
    FOR UPDATE
  LOOP
    v_action := v_queue.ceac_result_payload ->> 'action';
    v_email_payload := v_queue.ceac_result_payload -> 'email';
    v_email_status := v_email_payload ->> 'status';
    v_existing_request_id := v_email_payload ->> 'request_id';
    v_existing_recipient_sha256 := LOWER(BTRIM(v_email_payload ->> 'recipient_sha256'));
    v_is_active := (
      v_queue.status IN ('pending', 'processing', 'france_live_official_portal_opened')
      OR v_queue.status LIKE '%pending'
      OR v_queue.status LIKE '%processing'
      OR v_queue.status LIKE '%scheduled'
      OR COALESCE(v_queue.locked_until > v_now, FALSE)
    );

    IF v_action = 'official_ceac_email'
       AND v_existing_request_id = p_request_id::TEXT
       AND v_existing_request.id IS NULL THEN
      v_existing_request := v_queue;
    END IF;

    IF v_action = 'official_ceac_email'
       AND v_existing_recipient_sha256 = v_recipient_sha256 THEN
      IF v_is_active AND v_same_email_active.id IS NULL THEN
        v_same_email_active := v_queue;
      ELSIF NOT v_is_active
            AND v_same_email_terminal.id IS NULL
            AND v_email_status IN ('sent', 'unknown', 'failed') THEN
        v_same_email_terminal := v_queue;
      END IF;
    ELSIF v_is_active THEN
      v_has_other_active := TRUE;
    END IF;
  END LOOP;

  IF v_existing_request.id IS NOT NULL THEN
    IF LOWER(BTRIM(v_existing_request.ceac_result_payload -> 'email' ->> 'recipient_sha256'))
       IS DISTINCT FROM v_recipient_sha256 THEN
      RAISE EXCEPTION 'DS-160 email request id is already bound to another recipient digest'
        USING ERRCODE = '23505';
    END IF;
    RETURN NEXT v_existing_request;
    RETURN;
  END IF;

  -- A sending row is a second fence in addition to the queue lease.  An
  -- explicit retry may retire it as unknown only after its lease is absent or
  -- expired; ordinary retries always reuse it and never trigger another click.
  IF v_same_email_active.id IS NOT NULL THEN
    v_email_status := v_same_email_active.ceac_result_payload -> 'email' ->> 'status';
    IF p_retry
       AND v_same_email_active.status LIKE '%processing'
       AND NOT COALESCE(v_same_email_active.locked_until > v_now, FALSE)
       AND v_email_status IN ('queued', 'sending') THEN
      v_email_payload := COALESCE(v_same_email_active.ceac_result_payload, '{}'::JSONB);
      IF v_email_status = 'sending' THEN
        v_email_payload := pg_catalog.jsonb_set(
          v_email_payload,
          ARRAY['email']::TEXT[],
          COALESCE(v_email_payload -> 'email', '{}'::JSONB)
            || pg_catalog.jsonb_build_object(
              'status', 'unknown',
              'code', 'ds160_email_lease_expired',
              'unknown_at', v_now
            ),
          TRUE
        );
      ELSE
        v_email_payload := pg_catalog.jsonb_set(
          v_email_payload,
          ARRAY['email']::TEXT[],
          COALESCE(v_email_payload -> 'email', '{}'::JSONB)
            || pg_catalog.jsonb_build_object(
              'status', 'failed',
              'code', 'ds160_email_lease_expired_before_send',
              'failed_at', v_now
            ),
          TRUE
        );
      END IF;
      UPDATE public.submission_queue AS sq
      SET
        status = 'ds160_proof_failed',
        current_stage = CASE WHEN v_email_status = 'sending'
          THEN 'email_confirmation_unknown' ELSE 'email_confirmation_failed' END,
        error_code = CASE WHEN v_email_status = 'sending'
          THEN 'ds160_email_lease_expired' ELSE 'ds160_email_lease_expired_before_send' END,
        error_message = CASE WHEN v_email_status = 'sending'
          THEN 'The prior official email send reservation lost its live queue lease.'
          ELSE 'The prior official email retrieval lost its live queue lease before the send reservation.' END,
        ceac_result_payload = v_email_payload,
        locked_by = NULL,
        locked_at = NULL,
        locked_until = NULL,
        updated_at = v_now,
        heartbeat_at = v_now
      WHERE sq.id = v_same_email_active.id;
      v_same_email_active.id := NULL;
    ELSE
      RETURN NEXT v_same_email_active;
      RETURN;
    END IF;
  END IF;

  IF v_has_other_active THEN
    RAISE EXCEPTION 'Another active submission job already owns this application'
      USING ERRCODE = '55000';
  END IF;

  IF NOT p_retry AND v_same_email_terminal.id IS NOT NULL THEN
    RETURN NEXT v_same_email_terminal;
    RETURN;
  END IF;

  -- The newer runner pool is a second durable queue for the same application.
  -- Hold its rows while deciding so a concurrent wake cannot create a browser
  -- run in the gap between this check and the email insert.
  PERFORM rj.id
  FROM public.runner_job AS rj
  WHERE rj.application_id = p_application_id
    AND rj.status IN ('queued', 'running')
  FOR UPDATE;
  IF FOUND THEN
    RAISE EXCEPTION 'Another active runner job already owns this application'
      USING ERRCODE = '55000';
  END IF;

  v_new_payload := pg_catalog.jsonb_build_object(
    'action', 'official_ceac_email',
    'email', pg_catalog.jsonb_build_object(
      'status', 'queued',
      'request_id', p_request_id::TEXT,
      'recipient_sha256', v_recipient_sha256
    )
  );

  INSERT INTO public.submission_queue (
    application_id,
    user_id,
    status,
    mode,
    provider,
    attempts,
    last_error,
    current_stage,
    ceac_result_payload,
    created_at,
    updated_at
  )
  VALUES (
    p_application_id,
    p_auth_user_id,
    'ds160_proof_pending',
    'live_assisted',
    'ceac_proof',
    0,
    NULL,
    'queued',
    v_new_payload,
    v_now,
    v_now
  )
  RETURNING * INTO v_queue;

  RETURN NEXT v_queue;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_ds160_proof_download(
  p_application_id UUID,
  p_auth_user_id UUID
)
RETURNS SETOF public.submission_queue
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_application public.applications%ROWTYPE;
  v_profile public.applicant_profiles%ROWTYPE;
  v_now TIMESTAMPTZ;
  v_queue public.submission_queue%ROWTYPE;
  v_existing_download public.submission_queue%ROWTYPE;
  v_action TEXT;
  v_is_active BOOLEAN;
  v_has_other_active BOOLEAN := FALSE;
BEGIN
  IF p_application_id IS NULL OR p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'DS-160 download application and user identifiers are required'
      USING ERRCODE = '22023';
  END IF;

  -- The application row is the same mutex used by the email enqueue RPC.
  -- Download recovery can therefore never supersede an email row between its
  -- active-row check and its insert.
  SELECT a.*
  INTO v_application
  FROM public.applications AS a
  WHERE a.id = p_application_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DS-160 application does not exist' USING ERRCODE = '23503';
  END IF;

  SELECT p.*
  INTO v_profile
  FROM public.applicant_profiles AS p
  WHERE p.id = v_application.applicant_id
    AND p.auth_user_id = p_auth_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DS-160 application is not owned by the authenticated user'
      USING ERRCODE = '42501';
  END IF;
  IF UPPER(BTRIM(COALESCE(v_application.country, ''))) NOT IN
      ('US', 'USA', 'UNITED STATES', 'UNITED_STATES', 'UNITED_STATES_OF_AMERICA')
     OR UPPER(BTRIM(COALESCE(v_application.submission_result ->> 'country', ''))) <> 'US'
     OR LOWER(BTRIM(COALESCE(v_application.submission_result ->> 'status', ''))) <> 'submitted' THEN
    RAISE EXCEPTION 'DS-160 proof download requires a submitted US result'
      USING ERRCODE = '55000';
  END IF;

  v_now := clock_timestamp();
  FOR v_queue IN
    SELECT sq.*
    FROM public.submission_queue AS sq
    WHERE sq.application_id = p_application_id
    ORDER BY sq.updated_at DESC NULLS LAST, sq.id DESC
    FOR UPDATE
  LOOP
    v_action := v_queue.ceac_result_payload ->> 'action';
    v_is_active := (
      v_queue.status IN ('pending', 'processing', 'france_live_official_portal_opened')
      OR v_queue.status LIKE '%pending'
      OR v_queue.status LIKE '%processing'
      OR v_queue.status LIKE '%scheduled'
      OR COALESCE(v_queue.locked_until > v_now, FALSE)
    );

    IF v_is_active AND v_action = 'official_ceac_email' THEN
      RAISE EXCEPTION 'DS-160 official email recovery is active; download cannot supersede it'
        USING ERRCODE = '55000';
    ELSIF v_is_active
          AND v_queue.provider = 'ceac_proof'
          AND v_action IS NULL
          AND v_queue.status IN ('ds160_proof_pending', 'ds160_proof_processing')
          AND v_existing_download.id IS NULL THEN
      v_existing_download := v_queue;
    ELSIF v_is_active THEN
      v_has_other_active := TRUE;
    END IF;
  END LOOP;

  IF v_existing_download.id IS NOT NULL THEN
    RETURN NEXT v_existing_download;
    RETURN;
  END IF;
  IF v_has_other_active THEN
    RAISE EXCEPTION 'Another active submission job already owns this application'
      USING ERRCODE = '55000';
  END IF;

  -- runner_job is the newer shared pool.  It uses the same application scope
  -- but is not represented in submission_queue, so fence it separately.
  PERFORM rj.id
  FROM public.runner_job AS rj
  WHERE rj.application_id = p_application_id
    AND rj.status IN ('queued', 'running')
  FOR UPDATE;
  IF FOUND THEN
    RAISE EXCEPTION 'Another active runner job already owns this application'
      USING ERRCODE = '55000';
  END IF;

  INSERT INTO public.submission_queue (
    application_id,
    user_id,
    status,
    mode,
    provider,
    attempts,
    last_error,
    current_stage,
    ceac_result_payload,
    created_at,
    updated_at
  )
  VALUES (
    p_application_id,
    p_auth_user_id,
    'ds160_proof_pending',
    'live_assisted',
    'ceac_proof',
    0,
    NULL,
    'queued',
    NULL,
    v_now,
    v_now
  )
  RETURNING * INTO v_queue;

  RETURN NEXT v_queue;
END;
$$;

CREATE OR REPLACE FUNCTION public.start_ds160_proof_email(
  p_queue_id UUID,
  p_worker_id TEXT,
  p_locked_at TIMESTAMPTZ
)
RETURNS SETOF public.submission_queue
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ;
  v_owner TEXT := BTRIM(p_worker_id);
  v_queue public.submission_queue%ROWTYPE;
BEGIN
  IF p_queue_id IS NULL OR p_locked_at IS NULL OR NULLIF(v_owner, '') IS NULL THEN
    RAISE EXCEPTION 'DS-160 email queue ownership arguments are required' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_queue
  FROM public.submission_queue AS sq
  WHERE sq.id = p_queue_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  v_now := clock_timestamp();
  IF v_queue.provider IS DISTINCT FROM 'ceac_proof'
     OR v_queue.ceac_result_payload ->> 'action' IS DISTINCT FROM 'official_ceac_email'
     OR v_queue.locked_by IS DISTINCT FROM v_owner
     OR v_queue.locked_at IS DISTINCT FROM p_locked_at
     OR v_queue.locked_until IS NULL
     OR v_queue.locked_until <= v_now THEN
    RETURN;
  END IF;

  IF v_queue.status = 'ds160_proof_pending' THEN
    UPDATE public.submission_queue AS sq
    SET
      status = 'ds160_proof_processing',
      current_stage = 'retrieving_confirmation',
      started_at = COALESCE(sq.started_at, v_now),
      heartbeat_at = v_now,
      updated_at = v_now
    WHERE sq.id = p_queue_id
      AND sq.locked_by = v_owner
      AND sq.locked_at = p_locked_at
      AND sq.locked_until > v_now
      AND sq.status = 'ds160_proof_pending'
    RETURNING * INTO v_queue;
  ELSIF v_queue.status <> 'ds160_proof_processing' THEN
    RETURN;
  END IF;

  -- Returning an already-processing row is deliberate.  If its email payload
  -- is sending/sent/unknown, the caller must finish recovery without replaying
  -- CEAC's send control.
  RETURN NEXT v_queue;
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_ds160_email_send(
  p_queue_id UUID,
  p_worker_id TEXT,
  p_locked_at TIMESTAMPTZ
)
RETURNS SETOF public.submission_queue
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ;
  v_owner TEXT := BTRIM(p_worker_id);
  v_queue public.submission_queue%ROWTYPE;
  v_email JSONB;
BEGIN
  IF p_queue_id IS NULL OR p_locked_at IS NULL OR NULLIF(v_owner, '') IS NULL THEN
    RAISE EXCEPTION 'DS-160 email queue ownership arguments are required' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_queue
  FROM public.submission_queue AS sq
  WHERE sq.id = p_queue_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  v_now := clock_timestamp();
  IF v_queue.provider IS DISTINCT FROM 'ceac_proof'
     OR v_queue.ceac_result_payload ->> 'action' IS DISTINCT FROM 'official_ceac_email'
     OR v_queue.locked_by IS DISTINCT FROM v_owner
     OR v_queue.locked_at IS DISTINCT FROM p_locked_at
     OR v_queue.locked_until IS NULL
     OR v_queue.locked_until <= v_now
     OR v_queue.status IS DISTINCT FROM 'ds160_proof_processing' THEN
    RETURN;
  END IF;

  v_email := COALESCE(v_queue.ceac_result_payload -> 'email', '{}'::JSONB);
  IF v_email ->> 'status' = 'sending' AND v_email ? 'send_started_at' THEN
    -- A response lost after commit must force no-replay recovery.  Returning
    -- an already-reserved row would let a caller reach the browser click a
    -- second time, so this RPC deliberately returns an empty result.
    RETURN;
  END IF;
  IF v_email ->> 'status' IS DISTINCT FROM 'queued'
     OR v_email ? 'send_started_at' THEN
    RETURN;
  END IF;

  v_email := v_email || pg_catalog.jsonb_build_object(
    'status', 'sending',
    'send_started_at', v_now
  );
  UPDATE public.submission_queue AS sq
  SET
    current_stage = 'email_confirmation_sending',
    heartbeat_at = v_now,
    updated_at = v_now,
    ceac_result_payload = pg_catalog.jsonb_set(
      COALESCE(sq.ceac_result_payload, '{}'::JSONB),
      ARRAY['email']::TEXT[],
      v_email,
      TRUE
    )
  WHERE sq.id = p_queue_id
    AND sq.provider = 'ceac_proof'
    AND sq.ceac_result_payload ->> 'action' = 'official_ceac_email'
    AND sq.locked_by = v_owner
    AND sq.locked_at = p_locked_at
    AND sq.locked_until > v_now
    AND sq.status = 'ds160_proof_processing'
    AND COALESCE(sq.ceac_result_payload -> 'email' ->> 'status', '') = 'queued'
  RETURNING * INTO v_queue;

  IF v_queue.id IS NOT NULL THEN
    RETURN NEXT v_queue;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.settle_ds160_proof_email(
  p_queue_id UUID,
  p_worker_id TEXT,
  p_locked_at TIMESTAMPTZ,
  p_status TEXT,
  p_error_code TEXT DEFAULT NULL,
  p_evidence JSONB DEFAULT '{}'::JSONB
)
RETURNS SETOF public.submission_queue
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ;
  v_owner TEXT := BTRIM(p_worker_id);
  v_status TEXT := LOWER(BTRIM(p_status));
  v_error_code TEXT := NULLIF(LEFT(BTRIM(COALESCE(p_error_code, '')), 100), '');
  v_queue public.submission_queue%ROWTYPE;
  v_email JSONB;
  v_payload JSONB;
BEGIN
  IF p_queue_id IS NULL OR p_locked_at IS NULL OR NULLIF(v_owner, '') IS NULL THEN
    RAISE EXCEPTION 'DS-160 email queue ownership arguments are required' USING ERRCODE = '22023';
  END IF;
  IF v_status NOT IN ('sent', 'unknown', 'failed') THEN
    RAISE EXCEPTION 'DS-160 email settlement status is unsupported' USING ERRCODE = '22023';
  END IF;
  IF p_evidence IS NOT NULL AND pg_catalog.jsonb_typeof(p_evidence) <> 'object' THEN
    RAISE EXCEPTION 'DS-160 email settlement evidence must be a JSON object' USING ERRCODE = '22023';
  END IF;
  IF p_evidence IS NOT NULL AND pg_catalog.pg_column_size(p_evidence) > 524288 THEN
    RAISE EXCEPTION 'DS-160 email settlement evidence is too large' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_queue
  FROM public.submission_queue AS sq
  WHERE sq.id = p_queue_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  v_now := clock_timestamp();
  IF v_queue.provider IS DISTINCT FROM 'ceac_proof'
     OR v_queue.ceac_result_payload ->> 'action' IS DISTINCT FROM 'official_ceac_email'
     OR v_queue.locked_by IS DISTINCT FROM v_owner
     OR v_queue.locked_at IS DISTINCT FROM p_locked_at
     OR v_queue.locked_until IS NULL
     OR v_queue.locked_until <= v_now
     OR v_queue.status IS DISTINCT FROM 'ds160_proof_processing' THEN
    RETURN;
  END IF;

  v_email := COALESCE(v_queue.ceac_result_payload -> 'email', '{}'::JSONB);
  IF v_status IN ('sent', 'unknown') THEN
    IF v_email ->> 'status' IS DISTINCT FROM 'sending'
       OR NULLIF(v_email ->> 'send_started_at', '') IS NULL THEN
      RETURN;
    END IF;
  ELSIF v_email ->> 'status' IS DISTINCT FROM 'queued'
        OR v_email ? 'send_started_at' THEN
    RETURN;
  END IF;

  v_email := v_email || pg_catalog.jsonb_build_object(
    'status', v_status,
    CASE v_status
      WHEN 'sent' THEN 'sent_at'
      WHEN 'unknown' THEN 'unknown_at'
      ELSE 'failed_at'
    END,
    v_now
  );
  IF v_error_code IS NOT NULL THEN
    v_email := v_email || pg_catalog.jsonb_build_object('code', v_error_code);
  END IF;
  IF p_evidence IS NOT NULL THEN
    v_email := v_email || pg_catalog.jsonb_build_object('evidence', p_evidence);
  END IF;
  v_payload := pg_catalog.jsonb_set(
    COALESCE(v_queue.ceac_result_payload, '{}'::JSONB),
    ARRAY['email']::TEXT[],
    v_email,
    TRUE
  );

  UPDATE public.submission_queue AS sq
  SET
    status = CASE WHEN v_status = 'sent' THEN 'done' ELSE 'ds160_proof_failed' END,
    current_stage = CASE v_status
      WHEN 'sent' THEN 'email_confirmation_sent'
      WHEN 'unknown' THEN 'email_confirmation_unknown'
      ELSE 'email_confirmation_failed'
    END,
    last_error = CASE WHEN v_status = 'sent' THEN NULL ELSE v_error_code END,
    error_code = CASE WHEN v_status = 'sent' THEN NULL ELSE v_error_code END,
    error_message = CASE WHEN v_status = 'sent' THEN NULL ELSE v_error_code END,
    ceac_result_payload = v_payload,
    locked_by = NULL,
    locked_at = NULL,
    locked_until = NULL,
    heartbeat_at = v_now,
    updated_at = v_now
  WHERE sq.id = p_queue_id
    AND sq.provider = 'ceac_proof'
    AND sq.ceac_result_payload ->> 'action' = 'official_ceac_email'
    AND sq.locked_by = v_owner
    AND sq.locked_at = p_locked_at
    AND sq.locked_until > v_now
    AND sq.status = 'ds160_proof_processing'
  RETURNING * INTO v_queue;

  IF v_queue.id IS NOT NULL THEN
    RETURN NEXT v_queue;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_ds160_proof_email(UUID, UUID, UUID, TEXT, BOOLEAN)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_ds160_proof_email(UUID, UUID, UUID, TEXT, BOOLEAN)
  TO service_role;

REVOKE ALL ON FUNCTION public.enqueue_ds160_proof_download(UUID, UUID)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_ds160_proof_download(UUID, UUID)
  TO service_role;

REVOKE ALL ON FUNCTION public.start_ds160_proof_email(UUID, TEXT, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.start_ds160_proof_email(UUID, TEXT, TIMESTAMPTZ)
  TO service_role;

REVOKE ALL ON FUNCTION public.reserve_ds160_email_send(UUID, TEXT, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reserve_ds160_email_send(UUID, TEXT, TIMESTAMPTZ)
  TO service_role;

REVOKE ALL ON FUNCTION public.settle_ds160_proof_email(UUID, TEXT, TIMESTAMPTZ, TEXT, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.settle_ds160_proof_email(UUID, TEXT, TIMESTAMPTZ, TEXT, TEXT, JSONB)
  TO service_role;

COMMENT ON FUNCTION public.enqueue_ds160_proof_email(UUID, UUID, UUID, TEXT, BOOLEAN) IS
  'Atomically validates the submitted US result and account-email digest before enqueueing one durable official CEAC email request.';
COMMENT ON FUNCTION public.enqueue_ds160_proof_download(UUID, UUID) IS
  'Atomically reuses or enqueues DS-160 proof download recovery without superseding an active official email or runner job.';
COMMENT ON FUNCTION public.start_ds160_proof_email(UUID, TEXT, TIMESTAMPTZ) IS
  'Starts a live-owned official CEAC email queue row while preserving the queued send state.';
COMMENT ON FUNCTION public.reserve_ds160_email_send(UUID, TEXT, TIMESTAMPTZ) IS
  'Fences the one official CEAC email send immediately before the browser click using the database clock.';
COMMENT ON FUNCTION public.settle_ds160_proof_email(UUID, TEXT, TIMESTAMPTZ, TEXT, TEXT, JSONB) IS
  'Settles a fenced official CEAC email after browser cleanup and clears the exact live queue lease.';
