-- Harden the remaining database-backed workers for horizontal concurrency.
-- All RPCs run with the caller's privileges and are exposed only to the
-- server-side service_role. No browser/client role can claim or settle work.

-- ---------------------------------------------------------------------------
-- Transactional notification delivery leases
-- ---------------------------------------------------------------------------

ALTER TABLE public.notification_event_log
  ADD COLUMN IF NOT EXISTS worker_id TEXT,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS notification_event_log_worker_claim_idx
  ON public.notification_event_log (outcome, next_attempt_at, lease_expires_at, id)
  WHERE outcome IN ('queued', 'processing');

CREATE OR REPLACE FUNCTION public.claim_notification_event_batch(
  p_worker_id TEXT,
  p_limit INTEGER DEFAULT 20,
  p_lease_seconds INTEGER DEFAULT 300
)
RETURNS SETOF public.notification_event_log
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NULLIF(BTRIM(p_worker_id), '') IS NULL THEN
    RAISE EXCEPTION 'p_worker_id must not be blank';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT event_log.id
    FROM public.notification_event_log AS event_log
    WHERE event_log.retry_count < 5
      AND (
        (
          event_log.outcome = 'queued'
          AND (
            event_log.next_attempt_at IS NULL
            OR event_log.next_attempt_at <= NOW()
          )
        )
        OR (
          event_log.outcome = 'processing'
          AND event_log.lease_expires_at < NOW()
        )
      )
    ORDER BY event_log.id
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 20), 100))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.notification_event_log AS event_log
  SET
    outcome = 'processing',
    worker_id = BTRIM(p_worker_id),
    claimed_at = NOW(),
    lease_expires_at = NOW() + MAKE_INTERVAL(
      secs => GREATEST(30, LEAST(COALESCE(p_lease_seconds, 300), 3600))
    )
  FROM candidates
  WHERE event_log.id = candidates.id
  RETURNING event_log.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.ack_notification_event(
  p_event_id BIGINT,
  p_worker_id TEXT,
  p_external_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  updated_count INTEGER := 0;
BEGIN
  UPDATE public.notification_event_log AS event_log
  SET
    outcome = 'sent',
    external_id = p_external_id,
    error = NULL,
    next_attempt_at = NULL,
    worker_id = NULL,
    claimed_at = NULL,
    lease_expires_at = NULL
  WHERE event_log.id = p_event_id
    AND event_log.outcome = 'processing'
    AND event_log.worker_id = p_worker_id
    AND event_log.lease_expires_at > NOW();

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.nack_notification_event(
  p_event_id BIGINT,
  p_worker_id TEXT,
  p_error TEXT,
  p_retry_count INTEGER,
  p_next_attempt_at TIMESTAMPTZ DEFAULT NULL,
  p_terminal BOOLEAN DEFAULT FALSE,
  p_failure_code TEXT DEFAULT 'delivery'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  settled public.notification_event_log%ROWTYPE;
  normalized_failure_code TEXT;
BEGIN
  IF NOT COALESCE(p_terminal, FALSE) AND p_next_attempt_at IS NULL THEN
    RAISE EXCEPTION 'retryable notification nacks require p_next_attempt_at';
  END IF;

  normalized_failure_code := NULLIF(
    BTRIM(REGEXP_REPLACE(LOWER(COALESCE(p_failure_code, 'delivery')), '[^a-z0-9_]+', '_', 'g')),
    ''
  );

  UPDATE public.notification_event_log AS event_log
  SET
    outcome = CASE
      WHEN COALESCE(p_terminal, FALSE)
        THEN 'failed_' || COALESCE(normalized_failure_code, 'delivery')
      ELSE 'queued'
    END,
    error = LEFT(COALESCE(p_error, 'unknown'), 1000),
    retry_count = GREATEST(
      event_log.retry_count,
      LEAST(COALESCE(p_retry_count, event_log.retry_count + 1), 5)
    ),
    next_attempt_at = CASE
      WHEN COALESCE(p_terminal, FALSE) THEN NULL
      ELSE p_next_attempt_at
    END,
    worker_id = NULL,
    claimed_at = NULL,
    lease_expires_at = NULL
  WHERE event_log.id = p_event_id
    AND event_log.outcome = 'processing'
    AND event_log.worker_id = p_worker_id
    AND event_log.lease_expires_at > NOW()
  RETURNING event_log.* INTO settled;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF COALESCE(p_terminal, FALSE) THEN
    INSERT INTO public.notification_dlq (
      source_event_id,
      applicant_id,
      application_id,
      template_key,
      channel,
      recipient,
      payload,
      error,
      retry_count
    )
    VALUES (
      settled.id,
      settled.applicant_id,
      settled.application_id,
      COALESCE(settled.template_key, '(none)'),
      settled.channel,
      settled.recipient,
      settled.payload,
      COALESCE(settled.error, 'unknown'),
      settled.retry_count
    );
  END IF;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_notification_event_batch(TEXT, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ack_notification_event(BIGINT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.nack_notification_event(
  BIGINT, TEXT, TEXT, INTEGER, TIMESTAMPTZ, BOOLEAN, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notification_event_batch(TEXT, INTEGER, INTEGER)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.ack_notification_event(BIGINT, TEXT, TEXT)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.nack_notification_event(
  BIGINT, TEXT, TEXT, INTEGER, TIMESTAMPTZ, BOOLEAN, TEXT
) TO service_role;

GRANT SELECT, UPDATE ON TABLE public.notification_event_log TO service_role;
GRANT INSERT ON TABLE public.notification_dlq TO service_role;

COMMENT ON FUNCTION public.claim_notification_event_batch(TEXT, INTEGER, INTEGER) IS
  'Atomically claims due notification events and recovers expired processing leases.';
COMMENT ON FUNCTION public.ack_notification_event(BIGINT, TEXT, TEXT) IS
  'Marks a notification sent only while the caller still owns its live lease.';
COMMENT ON FUNCTION public.nack_notification_event(
  BIGINT, TEXT, TEXT, INTEGER, TIMESTAMPTZ, BOOLEAN, TEXT
) IS
  'Conditionally retries or terminally fails a leased notification; terminal failure also writes its DLQ row.';

-- ---------------------------------------------------------------------------
-- Vietnam official-status worker leases and conditional settlement
-- ---------------------------------------------------------------------------

ALTER TABLE public.official_status_checks
  ADD COLUMN IF NOT EXISTS worker_id TEXT,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ;

DROP INDEX IF EXISTS public.official_status_checks_claim_idx;
CREATE INDEX official_status_checks_claim_idx
  ON public.official_status_checks (status, scheduled_for, lease_expires_at, created_at);

CREATE OR REPLACE FUNCTION public.claim_vn_official_status_checks(
  p_worker_id TEXT,
  p_limit INTEGER DEFAULT 5,
  p_lease_seconds INTEGER DEFAULT 300
)
RETURNS SETOF public.official_status_checks
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NULLIF(BTRIM(p_worker_id), '') IS NULL THEN
    RAISE EXCEPTION 'p_worker_id must not be blank';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT candidate.id
    FROM public.official_status_checks AS candidate
    WHERE candidate.country_code = 'VN'
      AND candidate.scheduled_for <= NOW()
      AND (
        candidate.status = 'queued'
        OR (
          candidate.status = 'running'
          AND candidate.lease_expires_at < NOW()
        )
      )
    ORDER BY candidate.scheduled_for, candidate.created_at, candidate.id
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 5), 20))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.official_status_checks AS checks
  SET
    status = 'running',
    worker_id = BTRIM(p_worker_id),
    claimed_at = NOW(),
    lease_expires_at = NOW() + MAKE_INTERVAL(
      secs => GREATEST(60, LEAST(COALESCE(p_lease_seconds, 300), 3600))
    ),
    started_at = NOW(),
    attempt_count = checks.attempt_count + 1,
    updated_at = NOW()
  FROM candidates
  WHERE checks.id = candidates.id
  RETURNING checks.*;
END;
$$;

-- Rolling-deploy compatibility for submission-service revisions that still
-- call the original one-argument RPC. The distinct first-argument type keeps
-- PostgREST resolution unambiguous. Retire this wrapper only after every old
-- consumer has been replaced.
CREATE OR REPLACE FUNCTION public.claim_vn_official_status_checks(
  p_limit INTEGER DEFAULT 5
)
RETURNS SETOF public.official_status_checks
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT *
  FROM public.claim_vn_official_status_checks(
    'vn-status-legacy-compat',
    p_limit,
    300
  );
$$;

CREATE OR REPLACE FUNCTION public.complete_vn_official_status_check(
  p_check_id UUID,
  p_worker_id TEXT,
  p_patch JSONB DEFAULT '{}'::JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  updated_count INTEGER := 0;
  next_status TEXT := COALESCE(p_patch ->> 'status', 'completed');
BEGIN
  IF JSONB_TYPEOF(COALESCE(p_patch, '{}'::JSONB)) <> 'object' THEN
    RAISE EXCEPTION 'p_patch must be a JSON object';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM JSONB_OBJECT_KEYS(COALESCE(p_patch, '{}'::JSONB)) AS patch_keys(patch_key)
    WHERE patch_key <> ALL (ARRAY[
      'status',
      'official_reference',
      'official_status',
      'result_status',
      'artifact_storage_path',
      'artifact_sha256',
      'raw_status_json',
      'error_code',
      'error_message',
      'checked_at'
    ])
  ) THEN
    RAISE EXCEPTION 'p_patch contains an unsupported status-check field';
  END IF;

  IF next_status NOT IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'p_patch.status must be completed or cancelled';
  END IF;

  UPDATE public.official_status_checks AS checks
  SET
    status = next_status,
    official_reference = CASE
      WHEN p_patch ? 'official_reference' THEN p_patch ->> 'official_reference'
      ELSE checks.official_reference
    END,
    official_status = CASE
      WHEN p_patch ? 'official_status' THEN p_patch ->> 'official_status'
      ELSE checks.official_status
    END,
    result_status = CASE
      WHEN p_patch ? 'result_status' THEN p_patch ->> 'result_status'
      ELSE checks.result_status
    END,
    artifact_storage_path = CASE
      WHEN p_patch ? 'artifact_storage_path' THEN p_patch ->> 'artifact_storage_path'
      ELSE checks.artifact_storage_path
    END,
    artifact_sha256 = CASE
      WHEN p_patch ? 'artifact_sha256' THEN p_patch ->> 'artifact_sha256'
      ELSE checks.artifact_sha256
    END,
    raw_status_json = CASE
      WHEN p_patch ? 'raw_status_json' THEN COALESCE(p_patch -> 'raw_status_json', '{}'::JSONB)
      ELSE checks.raw_status_json
    END,
    error_code = CASE
      WHEN p_patch ? 'error_code' THEN p_patch ->> 'error_code'
      ELSE checks.error_code
    END,
    error_message = CASE
      WHEN p_patch ? 'error_message' THEN LEFT(p_patch ->> 'error_message', 500)
      ELSE checks.error_message
    END,
    checked_at = CASE
      WHEN p_patch ? 'checked_at' THEN NULLIF(p_patch ->> 'checked_at', '')::TIMESTAMPTZ
      ELSE NOW()
    END,
    completed_at = NOW(),
    updated_at = NOW(),
    worker_id = NULL,
    claimed_at = NULL,
    lease_expires_at = NULL
  WHERE checks.id = p_check_id
    AND checks.status = 'running'
    AND checks.worker_id = p_worker_id
    AND checks.lease_expires_at > NOW();

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_vn_official_status_check(
  p_check_id UUID,
  p_worker_id TEXT,
  p_error_code TEXT,
  p_error_message TEXT,
  p_raw_status_json JSONB DEFAULT '{}'::JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  updated_count INTEGER := 0;
BEGIN
  UPDATE public.official_status_checks AS checks
  SET
    status = 'failed',
    checked_at = NOW(),
    completed_at = NOW(),
    error_code = LEFT(COALESCE(NULLIF(p_error_code, ''), 'official_status_check_failed'), 100),
    error_message = LEFT(COALESCE(p_error_message, 'unknown'), 500),
    raw_status_json = COALESCE(p_raw_status_json, '{}'::JSONB),
    updated_at = NOW(),
    worker_id = NULL,
    claimed_at = NULL,
    lease_expires_at = NULL
  WHERE checks.id = p_check_id
    AND checks.status = 'running'
    AND checks.worker_id = p_worker_id
    AND checks.lease_expires_at > NOW();

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_vn_official_status_checks(TEXT, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_vn_official_status_checks(INTEGER)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_vn_official_status_check(UUID, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_vn_official_status_check(UUID, TEXT, TEXT, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_vn_official_status_checks(TEXT, INTEGER, INTEGER)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_vn_official_status_checks(INTEGER)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_vn_official_status_check(UUID, TEXT, JSONB)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_vn_official_status_check(UUID, TEXT, TEXT, TEXT, JSONB)
  TO service_role;

COMMENT ON FUNCTION public.claim_vn_official_status_checks(TEXT, INTEGER, INTEGER) IS
  'Atomically claims due Vietnam checks and recovers expired running leases.';
COMMENT ON FUNCTION public.claim_vn_official_status_checks(INTEGER) IS
  'Rolling-deploy compatibility wrapper for legacy Vietnam status workers; new consumers must pass their worker identity.';
COMMENT ON FUNCTION public.complete_vn_official_status_check(UUID, TEXT, JSONB) IS
  'Completes or cancels a Vietnam check only while the caller owns its live lease; p_patch is field-allowlisted.';
COMMENT ON FUNCTION public.fail_vn_official_status_check(UUID, TEXT, TEXT, TEXT, JSONB) IS
  'Fails a Vietnam check only while the caller owns its live lease.';

-- ---------------------------------------------------------------------------
-- Generic submission_queue claim: provider filtering and targeted retry
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.claim_submission_queue_batch(
  TEXT, INTEGER, INTEGER, UUID, INTEGER
);

CREATE OR REPLACE FUNCTION public.claim_submission_queue_batch(
  p_worker_id TEXT,
  p_limit INTEGER DEFAULT 20,
  p_lease_seconds INTEGER DEFAULT 900,
  p_target_job_id UUID DEFAULT NULL,
  p_max_attempts INTEGER DEFAULT 3,
  p_provider_allowlist TEXT[] DEFAULT NULL,
  p_allow_failed BOOLEAN DEFAULT FALSE
)
RETURNS SETOF public.submission_queue
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NULLIF(BTRIM(p_worker_id), '') IS NULL THEN
    RAISE EXCEPTION 'p_worker_id must not be blank';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT sq.id
    FROM public.submission_queue AS sq
    WHERE (
        sq.status IN (
          'pending',
          'ds160_prefill_pending',
          'ds160_live_assisted_pending',
          'ds160_proof_pending',
          'fv_prefill_pending',
          'france_live_assisted_pending',
          'uk_prefill_pending',
          'vn_dry_run_pending',
          'vn_live_assisted_pending',
          'vn_payment_pending',
          'sgac_dry_run_pending',
          'sgac_live_assisted_scheduled',
          'sgac_live_assisted_pending',
          'mdac_dry_run_pending',
          'mdac_live_assisted_scheduled',
          'mdac_live_assisted_pending',
          'tdac_dry_run_pending',
          'tdac_live_assisted_scheduled',
          'tdac_live_assisted_pending',
          'phetravel_dry_run_pending',
          'phetravel_live_assisted_scheduled',
          'phetravel_live_assisted_pending',
          'vn_prefill_pending',
          'au_prefill_pending'
        )
        OR (
          COALESCE(p_allow_failed, FALSE)
          AND p_target_job_id IS NOT NULL
          AND sq.status IN (
            'ds160_prefill_failed',
            'ds160_live_assisted_failed',
            'ds160_proof_failed',
            'fv_prefill_failed',
            'france_live_assisted_failed',
            'uk_prefill_failed',
            'vn_dry_run_failed',
            'vn_live_assisted_failed',
            'vn_payment_failed',
            'sgac_dry_run_failed',
            'sgac_live_assisted_failed',
            'mdac_dry_run_failed',
            'mdac_live_assisted_failed',
            'tdac_dry_run_failed',
            'tdac_live_assisted_failed',
            'phetravel_dry_run_failed',
            'phetravel_live_assisted_failed',
            'vn_prefill_failed',
            'au_prefill_failed'
          )
        )
      )
      AND sq.attempts < GREATEST(1, COALESCE(p_max_attempts, 3))
      AND (p_target_job_id IS NULL OR sq.id = p_target_job_id)
      AND (
        COALESCE(CARDINALITY(p_provider_allowlist), 0) = 0
        OR sq.provider = ANY (p_provider_allowlist)
      )
      AND (sq.locked_until IS NULL OR sq.locked_until < NOW())
    ORDER BY
      CASE
        WHEN sq.status IN (
          'sgac_live_assisted_scheduled',
          'sgac_live_assisted_pending',
          'mdac_live_assisted_scheduled',
          'mdac_live_assisted_pending',
          'tdac_live_assisted_scheduled',
          'tdac_live_assisted_pending',
          'phetravel_live_assisted_scheduled',
          'phetravel_live_assisted_pending'
        ) THEN 0
        WHEN sq.status IN (
          'sgac_dry_run_pending',
          'mdac_dry_run_pending',
          'tdac_dry_run_pending',
          'phetravel_dry_run_pending'
        ) THEN 1
        WHEN sq.status = 'vn_live_assisted_pending' THEN 2
        WHEN sq.status = 'vn_dry_run_pending' THEN 3
        ELSE 10
      END,
      sq.created_at,
      sq.id
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 20), 100))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.submission_queue AS sq
  SET
    locked_by = BTRIM(p_worker_id),
    locked_at = NOW(),
    locked_until = NOW() + MAKE_INTERVAL(
      secs => GREATEST(60, LEAST(COALESCE(p_lease_seconds, 900), 3600))
    ),
    updated_at = NOW()
  FROM candidates
  WHERE sq.id = candidates.id
  RETURNING sq.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_submission_queue_batch(
  TEXT, INTEGER, INTEGER, UUID, INTEGER, TEXT[], BOOLEAN
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_submission_queue_batch(
  TEXT, INTEGER, INTEGER, UUID, INTEGER, TEXT[], BOOLEAN
) TO service_role;

COMMENT ON FUNCTION public.claim_submission_queue_batch(
  TEXT, INTEGER, INTEGER, UUID, INTEGER, TEXT[], BOOLEAN
) IS
  'Atomically claims generic submission_queue rows with optional provider filtering; failed rows are eligible only for an explicitly targeted retry.';
