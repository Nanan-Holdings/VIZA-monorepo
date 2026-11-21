-- Official applicant final-submit handoff: add Vietnam e-Visa.
--
-- The Vietnam e-Visa runner (provider vietnam_evisa_live, queue prefix vn_)
-- now stops on the official review page before the review CAPTCHA, which is
-- the official submission step, and hands the kept-alive Browserbase session
-- to the applicant exactly like Indonesia (0209/0210). This migration only
-- extends the provider allowlist and the status lists of the functions that
-- enumerate queue statuses, and treats vn_cloud_live_pending (the status the
-- applicant API enqueues for Vietnam) as queued work. Indonesia is unchanged.

DROP INDEX IF EXISTS public.submission_queue_official_handoff_watch_idx;
CREATE INDEX IF NOT EXISTS submission_queue_official_handoff_watch_idx
  ON public.submission_queue (status, locked_until, locked_at)
  WHERE status IN (
    'id_c1_applicant_handoff', 'id_b1_evoa_applicant_handoff', 'vn_applicant_handoff',
    'id_c1_applicant_submitted', 'id_b1_evoa_applicant_submitted', 'vn_applicant_submitted'
  );

CREATE OR REPLACE FUNCTION public.official_handoff_queue_prefix(p_provider TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE p_provider
    WHEN 'indonesia_c1_live' THEN 'id_c1_'
    WHEN 'indonesia_b1_evoa_live' THEN 'id_b1_evoa_'
    WHEN 'vietnam_evisa_live' THEN 'vn_'
    ELSE NULL
  END;
$$;

REVOKE ALL ON FUNCTION public.official_handoff_queue_prefix(TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.official_handoff_queue_prefix(TEXT)
  TO service_role;

CREATE OR REPLACE FUNCTION public.lease_official_applicant_handoff_watch(
  p_worker_id TEXT,
  p_limit INTEGER DEFAULT 1,
  p_lease_seconds INTEGER DEFAULT 180,
  p_min_recheck_seconds INTEGER DEFAULT 60
)
RETURNS TABLE (
  takeover_id UUID,
  submission_queue_id UUID,
  application_id UUID,
  applicant_id UUID,
  provider TEXT,
  browserbase_session_ref TEXT,
  handoff_status TEXT,
  queue_status TEXT,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_worker_id TEXT := BTRIM(COALESCE(p_worker_id, ''));
BEGIN
  IF v_worker_id = '' OR length(v_worker_id) > 200 THEN
    RAISE EXCEPTION 'worker id is required and must be at most 200 characters'
      USING ERRCODE = '22023';
  END IF;
  IF p_lease_seconds IS NULL OR p_lease_seconds < 30 OR p_lease_seconds > 600 THEN
    RAISE EXCEPTION 'watch lease must be between 30 and 600 seconds'
      USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT queue.id AS queue_id, session.id AS session_id
    FROM public.submission_queue AS queue
    JOIN public.takeover_session AS session
      ON session.submission_queue_id = queue.id
     AND session.handoff_kind = 'official_applicant_final_submit'
     AND session.status IN ('queued', 'claimed')
    WHERE queue.status IN (
        'id_c1_applicant_handoff', 'id_b1_evoa_applicant_handoff', 'vn_applicant_handoff',
        'id_c1_applicant_submitted', 'id_b1_evoa_applicant_submitted', 'vn_applicant_submitted'
      )
      AND (
        queue.status = public.official_handoff_queue_prefix(queue.provider) || 'applicant_handoff'
        OR (
          queue.status = public.official_handoff_queue_prefix(queue.provider) || 'applicant_submitted'
          AND session.status = 'claimed'
        )
      )
      AND (queue.locked_until IS NULL OR queue.locked_until < pg_catalog.clock_timestamp())
      AND (
        queue.locked_at IS NULL
        OR queue.locked_at < pg_catalog.clock_timestamp()
          - MAKE_INTERVAL(secs => GREATEST(COALESCE(p_min_recheck_seconds, 60), 15))
        OR session.expires_at <= pg_catalog.clock_timestamp()
      )
    ORDER BY queue.locked_at NULLS FIRST, queue.id
    LIMIT GREATEST(LEAST(COALESCE(p_limit, 1), 10), 1)
    FOR UPDATE OF queue SKIP LOCKED
  ),
  leased AS (
    UPDATE public.submission_queue AS queue
    SET locked_by = v_worker_id,
        locked_at = pg_catalog.clock_timestamp(),
        locked_until = pg_catalog.clock_timestamp() + MAKE_INTERVAL(secs => p_lease_seconds),
        updated_at = pg_catalog.clock_timestamp()
    FROM candidates
    WHERE queue.id = candidates.queue_id
    RETURNING queue.id, queue.provider, queue.status, candidates.session_id
  )
  SELECT session.id, leased.id, session.application_id, session.applicant_id,
    leased.provider, session.remote_debug_url, session.status, leased.status, session.expires_at
  FROM leased
  JOIN public.takeover_session AS session ON session.id = leased.session_id;
END;
$$;

REVOKE ALL ON FUNCTION public.lease_official_applicant_handoff_watch(TEXT, INTEGER, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lease_official_applicant_handoff_watch(TEXT, INTEGER, INTEGER, INTEGER)
  TO service_role;

CREATE OR REPLACE FUNCTION public.request_official_applicant_handoff_regeneration(
  p_application_id UUID,
  p_applicant_id UUID
)
RETURNS TABLE (
  requested BOOLEAN,
  submission_queue_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_queue public.submission_queue%ROWTYPE;
  v_prefix TEXT;
  v_now TIMESTAMPTZ;
BEGIN
  IF p_application_id IS NULL OR p_applicant_id IS NULL THEN
    RAISE EXCEPTION 'application and applicant ids are required'
      USING ERRCODE = '22023';
  END IF;

  PERFORM 1
  FROM public.applications AS application
  WHERE application.id = p_application_id
    AND application.applicant_id = p_applicant_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT queue.*
  INTO v_queue
  FROM public.submission_queue AS queue
  WHERE queue.application_id = p_application_id
    AND queue.status IN (
      'id_c1_applicant_handoff_expired', 'id_b1_evoa_applicant_handoff_expired', 'vn_applicant_handoff_expired'
    )
    AND (queue.locked_until IS NULL OR queue.locked_until < pg_catalog.clock_timestamp())
  ORDER BY queue.updated_at DESC, queue.id
  LIMIT 1
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  v_prefix := public.official_handoff_queue_prefix(v_queue.provider);
  IF v_prefix IS NULL OR v_queue.status IS DISTINCT FROM v_prefix || 'applicant_handoff_expired' THEN
    RETURN;
  END IF;

  v_now := pg_catalog.clock_timestamp();
  -- Each handoff costs a fresh official fill and a Browserbase session. Allow
  -- at most three handoffs per application in any rolling 24 hours.
  IF (
    SELECT COUNT(*)
    FROM public.takeover_session AS session
    WHERE session.application_id = p_application_id
      AND session.handoff_kind = 'official_applicant_final_submit'
      AND session.created_at > v_now - INTERVAL '24 hours'
  ) >= 3 THEN
    RETURN;
  END IF;

  UPDATE public.submission_queue AS queue
  -- Vietnam live work is claimed from vn_cloud_live_pending by the cloud worker.
  SET status = CASE WHEN v_prefix = 'vn_' THEN 'vn_cloud_live_pending' ELSE v_prefix || 'live_assisted_pending' END,
      current_stage = 'applicant_requested_new_handoff',
      cancel_requested_at = NULL,
      attempts = 0,
      locked_by = NULL,
      locked_until = NULL,
      locked_at = NULL,
      last_error = NULL,
      updated_at = v_now
  WHERE queue.id = v_queue.id;

  UPDATE public.applications AS application
  SET submission_result_status = 'processing',
      submission_result_updated_at = v_now,
      updated_at = v_now
  WHERE application.id = p_application_id;

  RETURN QUERY SELECT TRUE, v_queue.id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_official_applicant_handoff_regeneration(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_official_applicant_handoff_regeneration(UUID, UUID)
  TO service_role;

CREATE OR REPLACE FUNCTION public.cancel_official_applicant_submission(
  p_application_id UUID,
  p_applicant_id UUID
)
RETURNS TABLE (
  outcome TEXT,
  submission_queue_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_queue public.submission_queue%ROWTYPE;
  v_session public.takeover_session%ROWTYPE;
  v_prefix TEXT;
  v_now TIMESTAMPTZ;
BEGIN
  IF p_application_id IS NULL OR p_applicant_id IS NULL THEN
    RAISE EXCEPTION 'application and applicant ids are required'
      USING ERRCODE = '22023';
  END IF;

  PERFORM 1
  FROM public.applications AS application
  WHERE application.id = p_application_id
    AND application.applicant_id = p_applicant_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT queue.*
  INTO v_queue
  FROM public.submission_queue AS queue
  WHERE queue.application_id = p_application_id
    AND queue.status IN (
      'id_c1_live_assisted_pending', 'id_b1_evoa_live_assisted_pending',
      'vn_live_assisted_pending', 'vn_cloud_live_pending',
      'id_c1_live_assisted_processing', 'id_b1_evoa_live_assisted_processing', 'vn_live_assisted_processing',
      'id_c1_applicant_handoff', 'id_b1_evoa_applicant_handoff', 'vn_applicant_handoff'
    )
  ORDER BY queue.updated_at DESC NULLS LAST, queue.id
  LIMIT 1
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  v_prefix := public.official_handoff_queue_prefix(v_queue.provider);
  IF v_prefix IS NULL THEN
    RETURN;
  END IF;

  v_now := pg_catalog.clock_timestamp();

  IF v_queue.status = v_prefix || 'live_assisted_processing' THEN
    UPDATE public.submission_queue AS queue
    SET cancel_requested_at = COALESCE(queue.cancel_requested_at, v_now),
        updated_at = v_now
    WHERE queue.id = v_queue.id;
    RETURN QUERY SELECT 'cancel_requested'::TEXT, v_queue.id;
    RETURN;
  END IF;

  IF v_queue.status = v_prefix || 'live_assisted_pending' OR v_queue.status = 'vn_cloud_live_pending' THEN
    IF v_queue.locked_until IS NOT NULL AND v_queue.locked_until > v_now THEN
      -- A worker is claiming it right now; ask it to stop instead.
      UPDATE public.submission_queue AS queue
      SET cancel_requested_at = COALESCE(queue.cancel_requested_at, v_now),
          updated_at = v_now
      WHERE queue.id = v_queue.id;
      RETURN QUERY SELECT 'cancel_requested'::TEXT, v_queue.id;
      RETURN;
    END IF;
    UPDATE public.submission_queue AS queue
    SET status = v_prefix || 'live_assisted_cancelled',
        current_stage = 'cancelled_by_applicant',
        cancel_requested_at = NULL,
        locked_by = NULL,
        locked_until = NULL,
        updated_at = v_now
    WHERE queue.id = v_queue.id;
  ELSE
    -- Open applicant handoff: close every active session for this row.
    FOR v_session IN
      SELECT session.*
      FROM public.takeover_session AS session
      WHERE session.submission_queue_id = v_queue.id
        AND session.handoff_kind = 'official_applicant_final_submit'
        AND session.status IN ('queued', 'claimed')
      FOR UPDATE
    LOOP
      UPDATE public.takeover_session AS session
      SET status = 'abandoned',
          operator_notes = 'cancelled_by_applicant',
          closed_at = v_now
      WHERE session.id = v_session.id;
      INSERT INTO public.takeover_action_log (takeover_id, action, actor_user_id, detail, ts)
      VALUES (
        v_session.id, 'abandon', p_applicant_id,
        jsonb_build_object('kind', 'official_applicant_final_submit', 'reason', 'cancelled_by_applicant'),
        v_now
      );
    END LOOP;
    UPDATE public.submission_queue AS queue
    SET status = v_prefix || 'applicant_cancelled',
        current_stage = 'cancelled_by_applicant',
        cancel_requested_at = NULL,
        locked_by = NULL,
        locked_until = NULL,
        updated_at = v_now
    WHERE queue.id = v_queue.id;
  END IF;

  UPDATE public.applications AS application
  SET submission_result = COALESCE(application.submission_result, '{}'::jsonb)
        || jsonb_build_object('cancelledByApplicant', TRUE, 'cancelledAt', v_now),
      submission_result_status = 'cancelled',
      submission_result_updated_at = v_now,
      updated_at = v_now
  WHERE application.id = p_application_id;

  RETURN QUERY SELECT 'cancelled'::TEXT, v_queue.id;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_official_applicant_submission(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_official_applicant_submission(UUID, UUID)
  TO service_role;
