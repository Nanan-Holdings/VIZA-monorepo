-- Shard shared runner claims by country without a global advisory lock.
--
-- The cap row is the serialization point for one country's running-count
-- check. A caller locks only the selected country's row, so unrelated country
-- claims can proceed concurrently while the ten production machine slots
-- remain the global cost guard.
-- Callers should invoke this RPC in a short/autocommit transaction so its
-- country-cap and machine-slot row locks are released immediately after claim.

-- Keep runner_job_pool_claim_idx from 0127 for rolling compatibility with
-- older claim readers; this country-leading index supplements it for cap scans.
CREATE INDEX IF NOT EXISTS runner_job_queued_available_idx
  ON public.runner_job (country, available_at, enqueued_at, id)
  WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS runner_job_running_country_idx
  ON public.runner_job (country)
  WHERE status = 'running';

CREATE INDEX IF NOT EXISTS runner_job_running_lease_idx
  ON public.runner_job (leased_until)
  INCLUDE (country, attempts, max_attempts)
  WHERE status = 'running';

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
  v_locked_country TEXT;
  v_tried_countries TEXT[] := ARRAY[]::TEXT[];
  v_cap_iterations INTEGER := 0;
  v_claimed_rows INTEGER := 0;
BEGIN
  IF NULLIF(BTRIM(p_worker_id), '') IS NULL THEN
    RAISE EXCEPTION 'Worker id is required' USING ERRCODE = '22023';
  END IF;
  IF p_lease_ms IS NULL OR p_lease_ms < 10000 OR p_lease_ms > 7200000 THEN
    RAISE EXCEPTION 'Runner lease must be between 10 seconds and 2 hours'
      USING ERRCODE = '22023';
  END IF;
  IF p_require_slot IS NULL THEN
    RAISE EXCEPTION 'Runner slot requirement is required'
      USING ERRCODE = '22023';
  END IF;
  IF p_now IS NULL THEN
    RAISE EXCEPTION 'Runner claim timestamp is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_require_slot THEN
    PERFORM 1
    FROM public.runner_machine_slot AS rms
    WHERE rms.owner_machine_id = p_worker_id
      AND rms.owner_kind = 'pool'
      AND rms.lease_until > p_now
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN;
    END IF;
  END IF;

  -- Recover only one expired lease per poll. The conditional update protects
  -- against a worker heartbeat winning the row between the CTE and UPDATE.
  WITH expired AS MATERIALIZED (
    SELECT expired.id
    FROM public.runner_job AS expired
    WHERE expired.status = 'running'
      AND expired.leased_until <= p_now
      AND expired.country IN (
        'vietnam', 'singapore', 'malaysia', 'thailand', 'south_korea'
      )
    ORDER BY expired.leased_until, expired.id
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.runner_job AS job
  SET attempts = job.attempts + 1,
      status = CASE
        WHEN job.attempts + 1 >= job.max_attempts THEN 'failed'
        ELSE 'queued'
      END,
      last_error = 'Worker lease expired before completion; job recovered by shared pool.',
      leased_by = NULL,
      leased_until = NULL,
      started_at = CASE
        WHEN job.attempts + 1 >= job.max_attempts THEN job.started_at
        ELSE NULL
      END,
      finished_at = CASE
        WHEN job.attempts + 1 >= job.max_attempts THEN p_now
        ELSE NULL
      END,
      available_at = CASE
        WHEN job.attempts + 1 >= job.max_attempts THEN job.available_at
        ELSE p_now + LEAST(300, 15 * (job.attempts + 1)) * INTERVAL '1 second'
      END
  FROM expired
  WHERE job.id = expired.id
    AND job.status = 'running'
    AND job.leased_until <= p_now;

  -- Lock at most the five eligible country-cap rows. The oldest due queued
  -- candidate determines the next country, avoiding alphabetical starvation.
  -- The cap lock is acquired without waiting; capacity is checked after the
  -- cap row is locked in a separate statement with a fresh READ COMMITTED snapshot.
  WHILE v_cap_iterations < 5 LOOP
    SELECT cap.country
    INTO v_locked_country
    FROM public.runner_concurrency_cap AS cap
    JOIN LATERAL (
      SELECT oldest_candidate.enqueued_at, oldest_candidate.id
      FROM public.runner_job AS oldest_candidate
      WHERE oldest_candidate.country = cap.country
        AND oldest_candidate.status = 'queued'
        AND oldest_candidate.available_at <= p_now
      ORDER BY oldest_candidate.enqueued_at, oldest_candidate.id
      LIMIT 1
    ) AS oldest_candidate ON TRUE
    WHERE cap.country IN (
        'vietnam', 'singapore', 'malaysia', 'thailand', 'south_korea'
      )
      AND NOT cap.paused
      AND cap.country <> ALL(v_tried_countries)
    ORDER BY oldest_candidate.enqueued_at, oldest_candidate.id, cap.country
    LIMIT 1
    FOR UPDATE OF cap SKIP LOCKED;

    IF NOT FOUND THEN
      EXIT;
    END IF;

    v_tried_countries := v_tried_countries || v_locked_country;
    v_cap_iterations := v_cap_iterations + 1;

    -- This is a separate SQL statement after the cap-row lock. Its snapshot
    -- sees any committed same-country claim before evaluating the count.
    RETURN QUERY
    WITH selected AS MATERIALIZED (
      SELECT candidate.id, candidate.country
      FROM public.runner_job AS candidate
      JOIN public.runner_concurrency_cap AS cap
        ON cap.country = candidate.country
      WHERE candidate.country = v_locked_country
        AND candidate.status = 'queued'
        AND candidate.available_at <= p_now
        AND candidate.country IN (
          'vietnam', 'singapore', 'malaysia', 'thailand', 'south_korea'
        )
        AND NOT cap.paused
        AND (
          SELECT COUNT(*)
          FROM public.runner_job AS active
          WHERE active.country = candidate.country
            AND active.status = 'running'
        ) < cap.max_concurrent
      ORDER BY candidate.enqueued_at, candidate.id
      LIMIT 1
      FOR UPDATE OF candidate, cap SKIP LOCKED
    )
    UPDATE public.runner_job AS claimed
    SET status = 'running',
        leased_by = p_worker_id,
        leased_until = p_now + p_lease_ms * INTERVAL '1 millisecond',
        started_at = p_now,
        finished_at = NULL,
        last_error = NULL
    FROM selected
    WHERE claimed.id = selected.id
      AND claimed.status = 'queued'
    RETURNING
      claimed.id,
      claimed.application_id,
      claimed.country,
      claimed.flow_key,
      claimed.attempts,
      claimed.max_attempts,
      claimed.correlation_id,
      claimed.metadata;

    GET DIAGNOSTICS v_claimed_rows = ROW_COUNT;
    IF v_claimed_rows > 0 THEN
      RETURN;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_runner_pool_job(
  TEXT, INTEGER, BOOLEAN, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_runner_pool_job(
  TEXT, INTEGER, BOOLEAN, TIMESTAMPTZ
) TO service_role;

COMMENT ON FUNCTION public.claim_runner_pool_job(TEXT, INTEGER, BOOLEAN, TIMESTAMPTZ) IS
  'Atomically recovers one expired lease and claims one country-sharded shared-pool job.';

-- Match a bounded batch of official Vietnam status emails in one set-based
-- operation. The service-role submission worker passes only parsed message
-- identifiers and an optional normalized official reference; all applicant
-- and tracking data is resolved inside this RPC under the caller's RLS.
CREATE INDEX IF NOT EXISTS official_tracking_active_email_idx
  ON public.official_application_tracking (LOWER(official_lookup_email))
  WHERE tracking_status = 'active';

-- The historical migration created a partial unique index. Keep it for
-- compatibility and add a plain unique index so ON CONFLICT (idempotency_key)
-- remains valid for this rolling-deploy function.
CREATE UNIQUE INDEX IF NOT EXISTS official_status_checks_idempotency_key_unique_idx
  ON public.official_status_checks (idempotency_key);

CREATE OR REPLACE FUNCTION public.enqueue_vn_email_triggered_status_checks(
  p_emails JSONB
)
RETURNS TABLE (
  queued INTEGER,
  ambiguous INTEGER,
  unmatched INTEGER,
  duplicates INTEGER
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_unique INTEGER := 0;
  v_queued INTEGER := 0;
  v_ambiguous INTEGER := 0;
  v_unmatched INTEGER := 0;
BEGIN
  IF p_emails IS NULL THEN
    RAISE EXCEPTION 'p_emails is required' USING ERRCODE = '22023';
  END IF;
  IF JSONB_TYPEOF(p_emails) <> 'array' THEN
    RAISE EXCEPTION 'p_emails must be a JSON array' USING ERRCODE = '22023';
  END IF;
  IF JSONB_ARRAY_LENGTH(p_emails) > 100 THEN
    RAISE EXCEPTION 'p_emails cannot contain more than 100 emails'
      USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM JSONB_ARRAY_ELEMENTS(p_emails) AS item(value)
    WHERE JSONB_TYPEOF(item.value) <> 'object'
      OR NOT (item.value ? 'email_id')
      OR JSONB_TYPEOF(item.value -> 'email_id') <> 'string'
      OR NULLIF(BTRIM(item.value ->> 'email_id'), '') IS NULL
      OR BTRIM(item.value ->> 'email_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR (
        item.value ? 'normalized_reference'
        AND JSONB_TYPEOF(item.value -> 'normalized_reference') NOT IN ('string', 'null')
      )
  ) THEN
    RAISE EXCEPTION 'p_emails contains a malformed email row'
      USING ERRCODE = '22023';
  END IF;

  -- Count candidate classes before any writes. DISTINCT ON makes a repeated
  -- inbound id idempotent within one caller batch.
  WITH input_emails AS MATERIALIZED (
    SELECT DISTINCT ON (parsed.email_id)
      parsed.email_id,
      NULLIF(
        REGEXP_REPLACE(UPPER(BTRIM(parsed.normalized_reference)), '[^A-Z0-9]', '', 'g'),
        ''
      ) AS normalized_reference
    FROM JSONB_TO_RECORDSET(p_emails) AS parsed(
      email_id UUID,
      normalized_reference TEXT
    )
    ORDER BY parsed.email_id
  ),
  candidate_rows AS MATERIALIZED (
    SELECT
      input.email_id,
      tracking.application_id,
      tracking.applicant_id,
      tracking.auth_user_id,
      tracking.country_code,
      tracking.provider,
      input.normalized_reference,
      COUNT(*) OVER (PARTITION BY input.email_id) AS candidate_count
    FROM input_emails AS input
    JOIN public.inbound_email AS email
      ON email.id = input.email_id
    JOIN public.official_application_tracking AS tracking
      ON tracking.tracking_status = 'active'
      AND tracking.country_code = 'VN'
      AND LOWER(tracking.official_lookup_email) = LOWER(email.to_addr)
    JOIN public.applications AS application
      ON application.id = tracking.application_id
    WHERE input.normalized_reference IS NULL
      OR NULLIF(
        REGEXP_REPLACE(UPPER(COALESCE(application.external_reference, '')), '[^A-Z0-9]', '', 'g'),
        ''
      ) = input.normalized_reference
  ),
  candidate_summary AS (
    SELECT
      input.email_id,
      COALESCE(MAX(candidate_rows.candidate_count), 0)::INTEGER AS candidate_count
    FROM input_emails AS input
    LEFT JOIN candidate_rows
      ON candidate_rows.email_id = input.email_id
    GROUP BY input.email_id
  )
  SELECT
    COUNT(*) FILTER (WHERE candidate_count = 1)::INTEGER,
    COUNT(*) FILTER (WHERE candidate_count > 1)::INTEGER,
    COUNT(*) FILTER (WHERE candidate_count = 0)::INTEGER
  INTO v_unique, v_ambiguous, v_unmatched
  FROM candidate_summary;

  WITH input_emails AS MATERIALIZED (
    SELECT DISTINCT ON (parsed.email_id)
      parsed.email_id,
      NULLIF(
        REGEXP_REPLACE(UPPER(BTRIM(parsed.normalized_reference)), '[^A-Z0-9]', '', 'g'),
        ''
      ) AS normalized_reference
    FROM JSONB_TO_RECORDSET(p_emails) AS parsed(
      email_id UUID,
      normalized_reference TEXT
    )
    ORDER BY parsed.email_id
  ),
  candidate_rows AS MATERIALIZED (
    SELECT
      input.email_id,
      tracking.application_id,
      tracking.auth_user_id,
      tracking.country_code,
      tracking.provider,
      input.normalized_reference,
      COUNT(*) OVER (PARTITION BY input.email_id) AS candidate_count
    FROM input_emails AS input
    JOIN public.inbound_email AS email
      ON email.id = input.email_id
    JOIN public.official_application_tracking AS tracking
      ON tracking.tracking_status = 'active'
      AND tracking.country_code = 'VN'
      AND LOWER(tracking.official_lookup_email) = LOWER(email.to_addr)
    JOIN public.applications AS application
      ON application.id = tracking.application_id
    WHERE input.normalized_reference IS NULL
      OR NULLIF(
        REGEXP_REPLACE(UPPER(COALESCE(application.external_reference, '')), '[^A-Z0-9]', '', 'g'),
        ''
      ) = input.normalized_reference
  ),
  unique_matches AS (
    SELECT DISTINCT ON (candidate_rows.email_id)
      candidate_rows.email_id,
      candidate_rows.application_id,
      candidate_rows.auth_user_id,
      candidate_rows.country_code,
      candidate_rows.provider,
      candidate_rows.normalized_reference
    FROM candidate_rows
    WHERE candidate_rows.candidate_count = 1
    ORDER BY candidate_rows.email_id
  )
  INSERT INTO public.official_status_checks (
    application_id,
    user_id,
    country_code,
    provider,
    status,
    requested_by,
    trigger_source,
    idempotency_key,
    inbound_email_id,
    scheduled_for,
    checked_at,
    raw_status_json,
    created_at,
    updated_at
  )
  SELECT
    match.application_id,
    match.auth_user_id,
    match.country_code,
    match.provider,
    'queued',
    'system',
    'email',
    'vn:email:' || match.email_id::TEXT,
    match.email_id,
    NOW(),
    NULL,
    JSONB_BUILD_OBJECT(
      'source', 'official_email',
      'normalized_reference', match.normalized_reference
    ),
    NOW(),
    NOW()
  FROM unique_matches AS match
  ON CONFLICT (idempotency_key) DO NOTHING;

  GET DIAGNOSTICS v_queued = ROW_COUNT;

  WITH input_emails AS MATERIALIZED (
    SELECT DISTINCT ON (parsed.email_id)
      parsed.email_id,
      NULLIF(
        REGEXP_REPLACE(UPPER(BTRIM(parsed.normalized_reference)), '[^A-Z0-9]', '', 'g'),
        ''
      ) AS normalized_reference
    FROM JSONB_TO_RECORDSET(p_emails) AS parsed(
      email_id UUID,
      normalized_reference TEXT
    )
    ORDER BY parsed.email_id
  ),
  candidate_rows AS MATERIALIZED (
    SELECT
      input.email_id,
      tracking.application_id,
      tracking.applicant_id,
      tracking.auth_user_id,
      input.normalized_reference,
      COUNT(*) OVER (PARTITION BY input.email_id) AS candidate_count
    FROM input_emails AS input
    JOIN public.inbound_email AS email
      ON email.id = input.email_id
    JOIN public.official_application_tracking AS tracking
      ON tracking.tracking_status = 'active'
      AND tracking.country_code = 'VN'
      AND LOWER(tracking.official_lookup_email) = LOWER(email.to_addr)
    JOIN public.applications AS application
      ON application.id = tracking.application_id
    WHERE input.normalized_reference IS NULL
      OR NULLIF(
        REGEXP_REPLACE(UPPER(COALESCE(application.external_reference, '')), '[^A-Z0-9]', '', 'g'),
        ''
      ) = input.normalized_reference
  ),
  unique_matches AS (
    SELECT DISTINCT ON (candidate_rows.email_id)
      candidate_rows.email_id,
      candidate_rows.application_id,
      candidate_rows.applicant_id,
      candidate_rows.auth_user_id,
      candidate_rows.normalized_reference
    FROM candidate_rows
    WHERE candidate_rows.candidate_count = 1
    ORDER BY candidate_rows.email_id
  )
  INSERT INTO public.application_events (
    application_id,
    applicant_id,
    auth_user_id,
    event_type,
    actor_type,
    source,
    visibility,
    idempotency_key,
    message,
    metadata,
    occurred_at,
    created_at
  )
  SELECT
    match.application_id,
    match.applicant_id,
    match.auth_user_id,
    'official_email_status_check_queued',
    'system',
    'vietnam_official_email',
    'staff',
    'vn:email-event:' || match.email_id::TEXT,
    'Official Vietnam email matched; status check queued.',
    JSONB_BUILD_OBJECT(
      'inbound_email_id', match.email_id,
      'normalized_reference', match.normalized_reference
    ),
    NOW(),
    NOW()
  FROM unique_matches AS match
  ON CONFLICT DO NOTHING;

  RETURN QUERY
  SELECT
    v_queued,
    v_ambiguous,
    v_unmatched,
    GREATEST(v_unique - v_queued, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_vn_email_triggered_status_checks(JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_vn_email_triggered_status_checks(JSONB)
  TO service_role;

COMMENT ON FUNCTION public.enqueue_vn_email_triggered_status_checks(JSONB) IS
  'Atomically matches up to 100 Vietnam official emails and queues unique status checks.';
