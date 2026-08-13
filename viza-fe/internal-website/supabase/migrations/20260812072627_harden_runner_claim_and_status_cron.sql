-- Keep high-frequency runner polling from queuing behind a blocking advisory
-- lock, and make lease/status-cron maintenance use bounded indexed scans.

CREATE INDEX IF NOT EXISTS runner_job_running_lease_idx
  ON public.runner_job (leased_until)
  INCLUDE (country, attempts, max_attempts)
  WHERE status = 'running';

CREATE INDEX IF NOT EXISTS runner_job_running_country_idx
  ON public.runner_job (country)
  WHERE status = 'running';

CREATE INDEX IF NOT EXISTS official_application_tracking_daily_due_idx
  ON public.official_application_tracking (next_daily_check_at, application_id)
  WHERE tracking_status = 'active';

CREATE OR REPLACE FUNCTION public.claim_runner_pool_job(
  p_worker_id TEXT,
  p_lease_ms INTEGER DEFAULT 900000,
  p_require_slot BOOLEAN DEFAULT TRUE,
  p_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  id UUID,
  application_id UUID,
  country TEXT,
  flow_key TEXT,
  attempts INTEGER,
  max_attempts INTEGER,
  correlation_id TEXT,
  metadata JSONB
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_job_id UUID;
  v_running INTEGER;
BEGIN
  IF NULLIF(BTRIM(p_worker_id), '') IS NULL THEN
    RAISE EXCEPTION 'Worker id is required' USING ERRCODE = '22023';
  END IF;
  IF p_lease_ms < 10000 OR p_lease_ms > 7200000 THEN
    RAISE EXCEPTION 'Runner lease must be between 10 seconds and 2 hours'
      USING ERRCODE = '22023';
  END IF;

  -- Pollers run frequently. When another claim is making progress, returning an
  -- empty result is healthier than building a lock wait queue in Postgres.
  IF NOT pg_try_advisory_xact_lock(hashtext('viza-runner-pool-claim')) THEN
    RETURN;
  END IF;

  IF p_require_slot AND NOT EXISTS (
    SELECT 1
    FROM public.runner_machine_slot AS rms
    WHERE rms.owner_machine_id = p_worker_id
      AND rms.owner_kind = 'pool'
      AND rms.lease_until > p_now
  ) THEN
    RETURN;
  END IF;

  UPDATE public.runner_job AS expired
  SET attempts = expired.attempts + 1,
      status = CASE
        WHEN expired.attempts + 1 >= expired.max_attempts THEN 'failed'
        ELSE 'queued'
      END,
      last_error = 'Worker lease expired before completion; job recovered by shared pool.',
      leased_by = NULL,
      leased_until = NULL,
      started_at = CASE
        WHEN expired.attempts + 1 >= expired.max_attempts THEN expired.started_at
        ELSE NULL
      END,
      finished_at = CASE
        WHEN expired.attempts + 1 >= expired.max_attempts THEN p_now
        ELSE NULL
      END,
      available_at = CASE
        WHEN expired.attempts + 1 >= expired.max_attempts THEN expired.available_at
        ELSE p_now + LEAST(300, 15 * (expired.attempts + 1)) * INTERVAL '1 second'
      END
  WHERE expired.status = 'running'
    AND expired.leased_until <= p_now
    AND expired.country IN (
      'vietnam', 'singapore',
      'malaysia', 'thailand', 'south_korea'
    );

  SELECT COUNT(*)::INTEGER
  INTO v_running
  FROM public.runner_job AS active_global
  WHERE active_global.status = 'running'
    AND active_global.country IN (
      'vietnam', 'singapore',
      'malaysia', 'thailand', 'south_korea'
    );

  IF v_running >= 10 THEN RETURN; END IF;

  SELECT rj.id
  INTO v_job_id
  FROM public.runner_job AS rj
  JOIN public.runner_concurrency_cap AS cap ON cap.country = rj.country
  WHERE rj.status = 'queued'
    AND rj.available_at <= p_now
    AND rj.country IN (
      'vietnam', 'singapore',
      'malaysia', 'thailand', 'south_korea'
    )
    AND NOT cap.paused
    AND (
      SELECT COUNT(*)
      FROM public.runner_job AS active
      WHERE active.country = rj.country AND active.status = 'running'
    ) < cap.max_concurrent
  ORDER BY rj.enqueued_at, rj.id
  LIMIT 1
  FOR UPDATE OF rj SKIP LOCKED;

  IF v_job_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  UPDATE public.runner_job AS claimed
  SET status = 'running',
      leased_by = p_worker_id,
      leased_until = p_now + p_lease_ms * INTERVAL '1 millisecond',
      started_at = p_now,
      finished_at = NULL,
      last_error = NULL
  WHERE claimed.id = v_job_id AND claimed.status = 'queued'
  RETURNING
    claimed.id, claimed.application_id, claimed.country, claimed.flow_key,
    claimed.attempts, claimed.max_attempts, claimed.correlation_id, claimed.metadata;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_due_vn_official_status_checks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  inserted_count INTEGER := 0;
BEGIN
  WITH due AS MATERIALIZED (
    SELECT tracking.application_id
    FROM public.official_application_tracking AS tracking
    WHERE tracking.tracking_status = 'active'
      AND tracking.next_daily_check_at <= now()
    ORDER BY tracking.next_daily_check_at, tracking.application_id
    FOR UPDATE SKIP LOCKED
    LIMIT 500
  ), advanced AS (
    UPDATE public.official_application_tracking AS tracking
    SET last_daily_check_at = now(),
        next_daily_check_at = (
          date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh')
          + interval '1 day'
          + make_interval(hours => tracking.daily_check_hour, mins => tracking.daily_check_minute)
        ) AT TIME ZONE 'Asia/Ho_Chi_Minh',
        updated_at = now()
    FROM due
    WHERE tracking.application_id = due.application_id
    RETURNING tracking.*
  )
  INSERT INTO public.official_status_checks (
    application_id, user_id, country_code, provider, status, requested_by,
    trigger_source, idempotency_key, scheduled_for, raw_status_json,
    created_at, updated_at
  )
  SELECT
    tracking.application_id, tracking.auth_user_id, tracking.country_code,
    tracking.provider, 'queued', 'system', 'daily',
    'vn:daily:' || tracking.application_id::text || ':' ||
      to_char(now() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD'),
    now(),
    jsonb_build_object(
      'source', 'scheduled_daily',
      'vietnam_date', to_char(now() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD')
    ),
    now(), now()
  FROM advanced AS tracking
  ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_runner_pool_job(TEXT, INTEGER, BOOLEAN, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_runner_pool_job(TEXT, INTEGER, BOOLEAN, TIMESTAMPTZ) TO service_role;
REVOKE ALL ON FUNCTION public.enqueue_due_vn_official_status_checks() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_due_vn_official_status_checks() TO service_role;

COMMENT ON FUNCTION public.claim_runner_pool_job(TEXT, INTEGER, BOOLEAN, TIMESTAMPTZ) IS
  'Non-blocking shared-pool claim with bounded indexed lease recovery.';
COMMENT ON FUNCTION public.enqueue_due_vn_official_status_checks() IS
  'Queues at most 500 due Vietnam status checks per invocation using SKIP LOCKED.';

CREATE OR REPLACE FUNCTION public.replay_resilient_application_answers(
  p_application_id UUID,
  p_applicant_id UUID,
  p_saved_at TIMESTAMPTZ,
  p_answers JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  changed_count INTEGER := 0;
  step_count INTEGER := 0;
BEGIN
  IF p_application_id IS NULL OR p_applicant_id IS NULL OR p_saved_at IS NULL THEN
    RAISE EXCEPTION 'Application, applicant, and save timestamp are required'
      USING ERRCODE = '22023';
  END IF;
  IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'object' THEN
    RAISE EXCEPTION 'Resilience answer payload must be an object'
      USING ERRCODE = '22023';
  END IF;
  IF (SELECT COUNT(*) FROM jsonb_object_keys(p_answers)) > 500 THEN
    RAISE EXCEPTION 'Resilience answer payload must contain at most 500 fields'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.applications AS app
    WHERE app.id = p_application_id AND app.applicant_id = p_applicant_id
  ) THEN
    RAISE EXCEPTION 'Application ownership check failed' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.visa_application_answers AS existing
  USING jsonb_each_text(p_answers) AS incoming(field_name, value_text)
  WHERE existing.application_id = p_application_id
    AND existing.field_name = incoming.field_name
    AND BTRIM(incoming.value_text) = ''
    AND COALESCE(existing.updated_at, '-infinity'::TIMESTAMPTZ) <= p_saved_at;
  GET DIAGNOSTICS step_count = ROW_COUNT;
  changed_count := changed_count + step_count;

  INSERT INTO public.visa_application_answers (
    application_id, field_name, value_text, source,
    source_profile_updated_at, source_metadata, updated_at
  )
  SELECT
    p_application_id, incoming.field_name, incoming.value_text, 'user_form',
    NULL, NULL, p_saved_at
  FROM jsonb_each_text(p_answers) AS incoming(field_name, value_text)
  WHERE BTRIM(incoming.field_name) <> '' AND BTRIM(incoming.value_text) <> ''
  ON CONFLICT (application_id, field_name) DO UPDATE
  SET value_text = EXCLUDED.value_text,
      source = 'user_form',
      source_profile_updated_at = NULL,
      source_metadata = NULL,
      updated_at = EXCLUDED.updated_at
  WHERE COALESCE(public.visa_application_answers.updated_at, '-infinity'::TIMESTAMPTZ) <= EXCLUDED.updated_at;
  GET DIAGNOSTICS step_count = ROW_COUNT;
  changed_count := changed_count + step_count;

  RETURN changed_count;
END;
$$;

REVOKE ALL ON FUNCTION public.replay_resilient_application_answers(UUID, UUID, TIMESTAMPTZ, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replay_resilient_application_answers(UUID, UUID, TIMESTAMPTZ, JSONB) TO service_role;

COMMENT ON FUNCTION public.replay_resilient_application_answers(UUID, UUID, TIMESTAMPTZ, JSONB) IS
  'Replays encrypted outbox form saves after ownership validation; stale deliveries cannot overwrite newer fields.';
