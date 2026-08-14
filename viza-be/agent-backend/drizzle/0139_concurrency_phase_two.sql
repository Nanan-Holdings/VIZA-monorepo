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

CREATE INDEX IF NOT EXISTS runner_job_running_owner_lease_idx
  ON public.runner_job (leased_by, leased_until)
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

    -- A live worker may own at most one running pool job. The slot row lock
    -- above serializes same-owner claims before this fresh READ COMMITTED
    -- statement observes the existing lease.
    IF EXISTS (
      SELECT 1
      FROM public.runner_job AS owned
      WHERE owned.status = 'running'
        AND owned.leased_by = p_worker_id
        AND owned.leased_until > p_now
    ) THEN
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

-- Complete a claimed pool job only while the caller still owns its live lease.
-- The submission worker uses this service-role-only RPC so stale owners cannot
-- terminally mutate a row reclaimed by another worker.
CREATE OR REPLACE FUNCTION public.complete_runner_pool_job(
  p_job_id UUID,
  p_worker_id TEXT,
  p_now TIMESTAMPTZ DEFAULT clock_timestamp()
)
RETURNS TABLE (
  application_id UUID,
  country TEXT,
  started_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF p_job_id IS NULL THEN
    RAISE EXCEPTION 'p_job_id is required' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(BTRIM(p_worker_id), '') IS NULL THEN
    RAISE EXCEPTION 'p_worker_id must not be blank' USING ERRCODE = '22023';
  END IF;
  IF p_now IS NULL THEN
    RAISE EXCEPTION 'p_now is required' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  UPDATE public.runner_job AS job
  SET status = 'succeeded',
    finished_at = COALESCE(p_now, v_now),
    leased_by = NULL,
    leased_until = NULL,
    last_error = NULL
  WHERE job.id = p_job_id
    AND job.status = 'running'
    AND job.leased_by = p_worker_id
    AND job.leased_until > v_now
  RETURNING job.application_id, job.country, job.started_at;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_runner_pool_job(UUID, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_runner_pool_job(UUID, TEXT, TIMESTAMPTZ) TO service_role;

COMMENT ON FUNCTION public.complete_runner_pool_job(UUID, TEXT, TIMESTAMPTZ) IS
  'Completes a running pool job only for its owning worker and live lease.';

-- Renew a claimed pool job only while the caller still owns its live lease.
-- The database clock is intentionally authoritative; no caller timestamp is
-- accepted, so network delay cannot extend a reclaimed lease.
CREATE OR REPLACE FUNCTION public.renew_runner_pool_job(
  p_job_id UUID,
  p_worker_id TEXT,
  p_lease_ms INTEGER DEFAULT 900000
)
RETURNS TABLE (
  leased_until TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF p_job_id IS NULL THEN
    RAISE EXCEPTION 'p_job_id is required' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(BTRIM(p_worker_id), '') IS NULL THEN
    RAISE EXCEPTION 'p_worker_id must not be blank' USING ERRCODE = '22023';
  END IF;
  IF p_lease_ms IS NULL OR p_lease_ms < 10000 OR p_lease_ms > 7200000 THEN
    RAISE EXCEPTION 'Runner lease must be between 10 seconds and 2 hours'
      USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  UPDATE public.runner_job AS job
  SET leased_until = v_now + p_lease_ms * INTERVAL '1 millisecond'
  WHERE job.id = p_job_id
    AND job.status = 'running'
    AND job.leased_by = BTRIM(p_worker_id)
    AND job.leased_until > v_now
  RETURNING job.leased_until;
END;
$$;

REVOKE ALL ON FUNCTION public.renew_runner_pool_job(UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.renew_runner_pool_job(UUID, TEXT, INTEGER) TO service_role;

COMMENT ON FUNCTION public.renew_runner_pool_job(UUID, TEXT, INTEGER) IS
  'Renews a running pool job only for its owning worker and live database-clock lease.';

-- Settle a failed pool job only while the caller still owns its live lease.
-- Retry availability and terminal timestamps are derived from clock_timestamp()
-- inside SQL; p_retry_after_seconds preserves the existing backoff policy.
CREATE OR REPLACE FUNCTION public.fail_runner_pool_job(
  p_job_id UUID,
  p_worker_id TEXT,
  p_status TEXT,
  p_attempts INTEGER,
  p_last_error TEXT,
  p_retry_after_seconds INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  status TEXT,
  available_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_available_at TIMESTAMPTZ;
BEGIN
  IF p_job_id IS NULL THEN
    RAISE EXCEPTION 'p_job_id is required' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(BTRIM(p_worker_id), '') IS NULL THEN
    RAISE EXCEPTION 'p_worker_id must not be blank' USING ERRCODE = '22023';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('queued', 'failed') THEN
    RAISE EXCEPTION 'p_status must be queued or failed' USING ERRCODE = '22023';
  END IF;
  IF p_attempts IS NULL OR p_attempts < 1 THEN
    RAISE EXCEPTION 'p_attempts must be positive' USING ERRCODE = '22023';
  END IF;
  IF p_retry_after_seconds IS NULL
    OR p_retry_after_seconds < 0
    OR p_retry_after_seconds > 300
  THEN
    RAISE EXCEPTION 'p_retry_after_seconds must be between 0 and 300'
      USING ERRCODE = '22023';
  END IF;

  v_available_at := CASE
    WHEN p_status = 'queued'
      THEN v_now + p_retry_after_seconds * INTERVAL '1 second'
    ELSE NULL
  END;

  RETURN QUERY
  UPDATE public.runner_job AS job
  SET status = p_status,
      attempts = p_attempts,
      last_error = p_last_error,
      finished_at = CASE WHEN p_status = 'failed' THEN v_now ELSE NULL END,
      leased_by = NULL,
      leased_until = NULL,
      available_at = CASE
        WHEN p_status = 'queued' THEN v_available_at
        ELSE job.available_at
      END
  WHERE job.id = p_job_id
    AND job.status = 'running'
    AND job.leased_by = BTRIM(p_worker_id)
    AND job.leased_until > v_now
  RETURNING job.id, job.status, job.available_at;
END;
$$;

REVOKE ALL ON FUNCTION public.fail_runner_pool_job(UUID, TEXT, TEXT, INTEGER, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_runner_pool_job(UUID, TEXT, TEXT, INTEGER, TEXT, INTEGER) TO service_role;

COMMENT ON FUNCTION public.fail_runner_pool_job(UUID, TEXT, TEXT, INTEGER, TEXT, INTEGER) IS
  'Settles a failed running pool job only for its owning worker and live database-clock lease.';

-- Match a bounded batch of official Vietnam status emails in one set-based
-- operation. The service-role submission worker passes only parsed message
-- identifiers and an optional normalized official reference; all applicant
-- and tracking data is resolved inside this RPC under the caller's RLS.
CREATE INDEX IF NOT EXISTS official_tracking_active_email_idx
  ON public.official_application_tracking (LOWER(official_lookup_email))
  WHERE tracking_status = 'active';

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
      OR NOT (item.value ? 'emailId')
      OR JSONB_TYPEOF(item.value -> 'emailId') <> 'string'
      OR NULLIF(BTRIM(item.value ->> 'emailId'), '') IS NULL
      OR BTRIM(item.value ->> 'emailId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR (
        NOT (item.value ? 'normalizedReference')
        OR JSONB_TYPEOF(item.value -> 'normalizedReference') NOT IN ('string', 'null')
      )
  ) THEN
    RAISE EXCEPTION 'p_emails contains a malformed email row'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT
        LOWER(BTRIM(item.value ->> 'emailId')) AS email_id,
        COALESCE(
          NULLIF(
            REGEXP_REPLACE(
              UPPER(BTRIM(item.value ->> 'normalizedReference')),
              '[^A-Z0-9]',
              '',
              'g'
            ),
            ''
          ),
          '<NULL>'
        ) AS normalized_reference
      FROM JSONB_ARRAY_ELEMENTS(p_emails) AS item(value)
    ) AS duplicate_inputs
    GROUP BY duplicate_inputs.email_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate emailId values are not allowed'
      USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH parsed_inputs AS MATERIALIZED (
    SELECT
      parsed."emailId" AS email_id_text,
      parsed."normalizedReference" AS normalized_reference_text
    FROM JSONB_TO_RECORDSET(p_emails) AS parsed(
      "emailId" TEXT,
      "normalizedReference" TEXT
    )
  ),
  inputs AS MATERIALIZED (
    SELECT
      BTRIM(parsed.email_id_text)::UUID AS email_id,
      NULLIF(
        REGEXP_REPLACE(
          UPPER(BTRIM(parsed.normalized_reference_text)),
          '[^A-Z0-9]',
          '',
          'g'
        ),
        ''
      ) AS normalized_reference
    FROM parsed_inputs AS parsed
  ),
  emails AS MATERIALIZED (
    SELECT
      input.email_id,
      input.normalized_reference,
      email.to_addr,
      email.received_at
    FROM inputs AS input
    JOIN public.inbound_email AS email
      ON email.id = input.email_id
  ),
  alias_candidates AS MATERIALIZED (
    SELECT
      email.email_id,
      email.normalized_reference,
      email.received_at,
      tracking.application_id,
      tracking.applicant_id,
      tracking.auth_user_id,
      tracking.country_code,
      tracking.provider,
      NULLIF(
        REGEXP_REPLACE(
          UPPER(COALESCE(application.external_reference, '')),
          '[^A-Z0-9]',
          '',
          'g'
        ),
        ''
      ) AS application_reference
    FROM emails AS email
    JOIN public.official_application_tracking AS tracking
      ON tracking.tracking_status = 'active'
      AND tracking.country_code = 'VN'
      AND LOWER(tracking.official_lookup_email) = LOWER(email.to_addr)
    JOIN public.applications AS application
      ON application.id = tracking.application_id
  ),
  candidate_matches AS MATERIALIZED (
    SELECT candidate.*
    FROM alias_candidates AS candidate
    WHERE candidate.normalized_reference IS NULL
      OR candidate.application_reference = candidate.normalized_reference
  ),
  candidate_counts AS MATERIALIZED (
    SELECT
      candidate.email_id,
      COUNT(*)::INTEGER AS candidate_count
    FROM candidate_matches AS candidate
    GROUP BY candidate.email_id
  ),
  classified AS MATERIALIZED (
    SELECT
      input.email_id,
      input.normalized_reference,
      COALESCE(counts.candidate_count, 0)::INTEGER AS candidate_count
    FROM inputs AS input
    LEFT JOIN candidate_counts AS counts
      ON counts.email_id = input.email_id
  ),
  unique_matches AS MATERIALIZED (
    SELECT candidate.*
    FROM candidate_matches AS candidate
    JOIN classified AS classification
      ON classification.email_id = candidate.email_id
      AND classification.candidate_count = 1
  ),
  status_inserts AS (
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
        'received_at', match.received_at
      ),
      NOW(),
      NOW()
    FROM unique_matches AS match
    ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
    RETURNING idempotency_key, application_id, inbound_email_id
  ),
  latest_tracking_emails AS MATERIALIZED (
    SELECT
      inserted.application_id,
      inserted.inbound_email_id AS email_id,
      ROW_NUMBER() OVER (
        PARTITION BY inserted.application_id
        ORDER BY inbound.received_at DESC, inserted.inbound_email_id DESC
      ) AS row_number
    FROM status_inserts AS inserted
    JOIN public.inbound_email AS inbound
      ON inbound.id = inserted.inbound_email_id
  ),
  tracking_updates AS (
    UPDATE public.official_application_tracking AS tracking
    SET
      last_email_message_id = latest.email_id,
      updated_at = NOW()
    FROM latest_tracking_emails AS latest
    WHERE latest.row_number = 1
      AND tracking.application_id = latest.application_id
    RETURNING tracking.application_id
  ),
  ambiguous_events AS (
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
      candidate.application_id,
      candidate.applicant_id,
      candidate.auth_user_id,
      'official_email_match_ambiguous',
      'system',
      'vietnam_official_email',
      'staff',
      'vn:email-ambiguous:' || candidate.email_id::TEXT || ':' || candidate.application_id::TEXT,
      'Official Vietnam email could not be uniquely matched; daily polling remains active.',
      JSONB_BUILD_OBJECT(
        'inbound_email_id', candidate.email_id,
        'candidate_count', classification.candidate_count,
        'reference_present', classification.normalized_reference IS NOT NULL
      ),
      NOW(),
      NOW()
    FROM alias_candidates AS candidate
    JOIN classified AS classification
      ON classification.email_id = candidate.email_id
    LEFT JOIN candidate_matches AS matched
      ON matched.email_id = candidate.email_id
      AND matched.application_id = candidate.application_id
    WHERE classification.candidate_count <> 1
      AND (
        classification.candidate_count = 0
        OR matched.application_id IS NOT NULL
      )
    ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
    RETURNING id
  )
  SELECT
    (SELECT COUNT(*)::INTEGER FROM status_inserts),
    (SELECT COUNT(*)::INTEGER FROM classified WHERE candidate_count > 1),
    (SELECT COUNT(*)::INTEGER FROM classified WHERE candidate_count = 0),
    (
      (SELECT COUNT(*)::INTEGER FROM classified WHERE candidate_count = 1)
      - (SELECT COUNT(*)::INTEGER FROM status_inserts)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_vn_email_triggered_status_checks(JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_vn_email_triggered_status_checks(JSONB)
  TO service_role;

COMMENT ON FUNCTION public.enqueue_vn_email_triggered_status_checks(JSONB) IS
  'Atomically matches up to 100 Vietnam official emails and queues unique status checks.';

-- Return a provider-gate-denied status check to the queue without consuming
-- the admission attempt. This is conditional on the same live Postgres lease
-- that admitted the worker, so a stale worker cannot requeue another owner.
CREATE OR REPLACE FUNCTION public.defer_vn_official_status_check(
  p_check_id UUID,
  p_worker_id TEXT,
  p_retry_after_seconds INTEGER DEFAULT 30
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  updated_count INTEGER := 0;
BEGIN
  IF p_check_id IS NULL THEN
    RAISE EXCEPTION 'p_check_id is required' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(BTRIM(p_worker_id), '') IS NULL THEN
    RAISE EXCEPTION 'p_worker_id must not be blank' USING ERRCODE = '22023';
  END IF;
  IF p_retry_after_seconds IS NULL
    OR p_retry_after_seconds < 1
    OR p_retry_after_seconds > 300
  THEN
    RAISE EXCEPTION 'p_retry_after_seconds must be between 1 and 300'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.official_status_checks AS checks
  SET
    status = 'queued',
    scheduled_for = NOW() + p_retry_after_seconds * INTERVAL '1 second',
    attempt_count = GREATEST(checks.attempt_count - 1, 0),
    worker_id = NULL,
    claimed_at = NULL,
    lease_expires_at = NULL,
    started_at = NULL,
    updated_at = NOW()
  WHERE checks.id = p_check_id
    AND checks.status = 'running'
    AND checks.worker_id = BTRIM(p_worker_id)
    AND checks.lease_expires_at > NOW();

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.defer_vn_official_status_check(UUID, TEXT, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.defer_vn_official_status_check(UUID, TEXT, INTEGER)
  TO service_role;

COMMENT ON FUNCTION public.defer_vn_official_status_check(UUID, TEXT, INTEGER) IS
  'Requeues a provider-gate-denied Vietnam status check only while its live worker lease is owned.';
