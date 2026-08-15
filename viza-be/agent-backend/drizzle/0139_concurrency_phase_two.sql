-- Shard shared runner claims by country without a global advisory lock.
--
-- The cap row is the serialization point for one country's running-count
-- check. A caller locks only the selected country's row, so unrelated country
-- claims can proceed concurrently while the ten production machine slots
-- remain the global cost guard.
-- Callers should invoke this RPC in a short/autocommit transaction so its
-- country-cap and machine-slot row locks are released immediately after claim.

-- Private one-time update capabilities replace forgeable session markers.
-- Every authorized running-row mutation records the exact full OLD/NEW row
-- image in this transaction/backend/job key. The permanent trigger consumes
-- that capability atomically. This is a controlled drain cutover: direct
-- lifecycle writers must be migrated to the fenced RPCs before this migration
-- is applied; there is no stale-write bypass.
CREATE SCHEMA IF NOT EXISTS runner_private;
REVOKE ALL ON SCHEMA runner_private FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS guard_expired_runner_job_lifecycle_update
  ON public.runner_job;
DROP FUNCTION IF EXISTS runner_private.guard_expired_runner_job_lifecycle_update();
DROP FUNCTION IF EXISTS public.guard_expired_runner_job_lifecycle_update();
DO $$
BEGIN
  EXECUTE 'DROP TABLE IF EXISTS runner_private.' || 'runner_' || 'recovery_capability';
END;
$$;

CREATE TABLE IF NOT EXISTS runner_private.runner_job_update_capability (
  txid BIGINT NOT NULL,
  backend_pid INTEGER NOT NULL,
  job_id UUID NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN (
    'recover', 'complete', 'renew', 'fail', 'takeover_open',
    'admin_pause', 'fingerprint_append'
  )),
  old_row JSONB NOT NULL,
  new_row JSONB NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  PRIMARY KEY (txid, backend_pid, job_id)
);

ALTER TABLE runner_private.runner_job_update_capability ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE runner_private.runner_job_update_capability
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON SCHEMA runner_private IS
  'Unexposed runner fencing state; runtime roles cannot inspect or mutate it.';
COMMENT ON TABLE runner_private.runner_job_update_capability IS
  'One-time full-row capability consumed by the permanent runner_job update fence.';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.runner_job
    WHERE status = 'running'
      AND NOT (
        (country = 'vietnam' AND flow_key = 'vn_prearrival')
        OR (country = 'singapore' AND flow_key = 'sgac')
        OR (country = 'malaysia' AND flow_key = 'mdac')
        OR (country = 'thailand' AND flow_key = 'tdac')
        OR (country = 'south_korea' AND flow_key = 'kr_eform')
      )
  ) THEN
    RAISE EXCEPTION
      'Cannot enable runner flow fence while invalid running runner_job rows exist';
  END IF;

  UPDATE public.runner_job
  SET status = 'failed',
      last_error = 'Runner flow is retired or invalid; quarantined by concurrency fence.',
      leased_by = NULL,
      leased_until = NULL,
      finished_at = pg_catalog.clock_timestamp()
  WHERE status = 'queued'
    AND NOT (
      (country = 'vietnam' AND flow_key = 'vn_prearrival')
      OR (country = 'singapore' AND flow_key = 'sgac')
      OR (country = 'malaysia' AND flow_key = 'mdac')
      OR (country = 'thailand' AND flow_key = 'tdac')
      OR (country = 'south_korea' AND flow_key = 'kr_eform')
    );
END;
$$;

ALTER TABLE public.runner_job
  DROP CONSTRAINT IF EXISTS runner_job_active_flow_key_check;
ALTER TABLE public.runner_job
  ADD CONSTRAINT runner_job_active_flow_key_check
  CHECK (
    status <> 'running'
    OR (country = 'vietnam' AND flow_key = 'vn_prearrival')
    OR (country = 'singapore' AND flow_key = 'sgac')
    OR (country = 'malaysia' AND flow_key = 'mdac')
    OR (country = 'thailand' AND flow_key = 'tdac')
    OR (country = 'south_korea' AND flow_key = 'kr_eform')
  );

-- The SGAC retry signature is retained for existing service callers, but the
-- live runner transport is now explicitly flow-keyed so null/legacy rows can
-- never re-enter the shared pool.
CREATE OR REPLACE FUNCTION public.enqueue_sgac_country_runner_retry(
  p_application_id UUID,
  p_max_attempts INTEGER DEFAULT 3,
  p_correlation_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB,
  p_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  runner_job_id UUID,
  reused_existing BOOLEAN,
  blocked_by_legacy BOOLEAN,
  legacy_queue_id UUID,
  legacy_queue_status TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_legacy public.submission_queue%ROWTYPE;
  v_runner public.runner_job%ROWTYPE;
BEGIN
  IF p_application_id IS NULL THEN
    RAISE EXCEPTION 'Application id is required' USING ERRCODE = '22023';
  END IF;
  IF p_max_attempts IS NULL OR p_max_attempts < 1 OR p_max_attempts > 10 THEN
    RAISE EXCEPTION 'SGAC max attempts must be between 1 and 10'
      USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM public.applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application % does not exist', p_application_id
      USING ERRCODE = '23503';
  END IF;

  SELECT sq.* INTO v_legacy
  FROM public.submission_queue AS sq
  WHERE sq.application_id = p_application_id
    AND (
      sq.status IN ('pending', 'processing', 'france_live_official_portal_opened')
      OR sq.status LIKE '%pending'
      OR sq.status LIKE '%processing'
      OR sq.status LIKE '%scheduled'
      OR sq.locked_until > p_now
    )
  ORDER BY sq.created_at DESC, sq.id DESC
  LIMIT 1
  FOR UPDATE;

  IF v_legacy.id IS NOT NULL THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, TRUE, v_legacy.id, v_legacy.status;
    RETURN;
  END IF;

  SELECT rj.* INTO v_runner
  FROM public.runner_job AS rj
  WHERE rj.application_id = p_application_id
    AND rj.country = 'singapore'
    AND rj.flow_key = 'sgac'
    AND rj.status IN ('queued', 'running')
  ORDER BY rj.enqueued_at DESC, rj.id DESC
  LIMIT 1
  FOR UPDATE;

  IF v_runner.id IS NOT NULL THEN
    RETURN QUERY SELECT v_runner.id, TRUE, FALSE, NULL::UUID, NULL::TEXT;
    RETURN;
  END IF;

  INSERT INTO public.runner_job (
    application_id, country, flow_key, status, attempts, max_attempts,
    correlation_id, metadata, enqueued_at, available_at
  )
  VALUES (
    p_application_id, 'singapore', 'sgac', 'queued', 0, p_max_attempts,
    p_correlation_id, COALESCE(p_metadata, '{}'::JSONB), p_now, p_now
  )
  RETURNING * INTO v_runner;

  RETURN QUERY SELECT v_runner.id, FALSE, FALSE, NULL::UUID, NULL::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_sgac_country_runner_retry(
  UUID, INTEGER, TEXT, JSONB, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_sgac_country_runner_retry(
  UUID, INTEGER, TEXT, JSONB, TIMESTAMPTZ
) TO service_role;

-- Keep runner_job_pool_claim_idx from 0127 for existing claim readers; this
-- country-leading index supplements it for cap scans.
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

-- p_now remains in the four-argument identity for API stability during the
-- controlled drain; the function body ignores caller time and trusts only
-- clock_timestamp(). Invalid running flows are never recovered or claimed.
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
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_locked_country TEXT;
  v_worker_id TEXT;
  v_expired_job_id UUID;
  v_expired_old_row public.runner_job%ROWTYPE;
  v_expired_new_row JSONB;
  v_now TIMESTAMPTZ;
  v_recovery_rows INTEGER := 0;
  v_tried_countries TEXT[] := ARRAY[]::TEXT[];
  v_cap_iterations INTEGER := 0;
  v_claimed_rows INTEGER := 0;
BEGIN
  v_worker_id := BTRIM(COALESCE(p_worker_id, ''));
  IF v_worker_id = '' THEN
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

  -- The timestamp argument is intentionally ignored. Every
  -- eligibility, recovery, and lease timestamp below is database-derived.
  v_now := pg_catalog.clock_timestamp();

  IF p_require_slot THEN
    PERFORM 1
    FROM public.runner_machine_slot AS rms
    WHERE rms.owner_machine_id = v_worker_id
      AND rms.owner_kind = 'pool'
      AND rms.lease_until > v_now
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
        AND owned.leased_by = v_worker_id
        AND owned.leased_until > v_now
    ) THEN
      RETURN;
    END IF;
  END IF;

  -- Recover only one expired lease per poll. First acquire the exact row with
  -- SKIP LOCKED, then insert a private one-time capability immediately before
  -- the exact lifecycle update. The permanent trigger atomically
  -- consumes this capability and permits only the matching recovery shape.

  WITH expired AS MATERIALIZED (
    SELECT expired.id
    FROM public.runner_job AS expired
    WHERE expired.status = 'running'
      AND expired.leased_until <= v_now
      AND (
        (expired.country = 'vietnam' AND expired.flow_key = 'vn_prearrival')
        OR (expired.country = 'singapore' AND expired.flow_key = 'sgac')
        OR (expired.country = 'malaysia' AND expired.flow_key = 'mdac')
        OR (expired.country = 'thailand' AND expired.flow_key = 'tdac')
        OR (expired.country = 'south_korea' AND expired.flow_key = 'kr_eform')
      )
    ORDER BY expired.leased_until, expired.id
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  SELECT expired.id
  INTO v_expired_job_id
  FROM expired;

  IF v_expired_job_id IS NOT NULL THEN
    SELECT job.*
    INTO v_expired_old_row
    FROM public.runner_job AS job
    WHERE job.id = v_expired_job_id
      AND job.status = 'running'
      AND job.leased_until <= v_now
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN;
    END IF;

    v_expired_new_row := to_jsonb(v_expired_old_row) || jsonb_build_object(
      'attempts', v_expired_old_row.attempts + 1,
      'status', CASE
        WHEN v_expired_old_row.attempts + 1 >= v_expired_old_row.max_attempts
          THEN 'failed'
        ELSE 'queued'
      END,
      'last_error', 'Worker lease expired before completion; job recovered by shared pool.',
      'leased_by', NULL,
      'leased_until', NULL,
      'started_at', CASE
        WHEN v_expired_old_row.attempts + 1 >= v_expired_old_row.max_attempts
          THEN v_expired_old_row.started_at
        ELSE NULL
      END,
      'finished_at', CASE
        WHEN v_expired_old_row.attempts + 1 >= v_expired_old_row.max_attempts
          THEN v_now
        ELSE NULL
      END,
      'available_at', CASE
        WHEN v_expired_old_row.attempts + 1 >= v_expired_old_row.max_attempts
          THEN v_expired_old_row.available_at
        ELSE v_now + LEAST(300, 15 * (v_expired_old_row.attempts + 1))
          * INTERVAL '1 second'
      END
    );

    DELETE FROM runner_private.runner_job_update_capability AS capability
    WHERE capability.txid = pg_catalog.txid_current()
      AND capability.backend_pid = pg_catalog.pg_backend_pid()
      AND capability.job_id = v_expired_job_id;

    INSERT INTO runner_private.runner_job_update_capability (
      txid,
      backend_pid,
      job_id,
      operation,
      old_row,
      new_row
    )
    VALUES (
      pg_catalog.txid_current(),
      pg_catalog.pg_backend_pid(),
      v_expired_job_id,
      'recover',
      to_jsonb(v_expired_old_row),
      v_expired_new_row
    );

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
          WHEN job.attempts + 1 >= job.max_attempts THEN v_now
          ELSE NULL
        END,
        available_at = CASE
          WHEN job.attempts + 1 >= job.max_attempts THEN job.available_at
          ELSE v_now + LEAST(300, 15 * (job.attempts + 1)) * INTERVAL '1 second'
        END
    WHERE job.id = v_expired_job_id
      AND job.status = 'running'
      AND job.leased_until <= v_now;

    GET DIAGNOSTICS v_recovery_rows = ROW_COUNT;

    IF v_recovery_rows <> 1 THEN
      -- A capability that was not consumed must never survive a successful
      -- claim transaction. Raise so the surrounding transaction rolls back
      -- the insert (and any accidental partial recovery) atomically.
      RAISE EXCEPTION 'Runner lease recovery capability was not consumed'
        USING ERRCODE = '55000';
    END IF;
  END IF;

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
        AND (
          (oldest_candidate.country = 'vietnam' AND oldest_candidate.flow_key = 'vn_prearrival')
          OR (oldest_candidate.country = 'singapore' AND oldest_candidate.flow_key = 'sgac')
          OR (oldest_candidate.country = 'malaysia' AND oldest_candidate.flow_key = 'mdac')
          OR (oldest_candidate.country = 'thailand' AND oldest_candidate.flow_key = 'tdac')
          OR (oldest_candidate.country = 'south_korea' AND oldest_candidate.flow_key = 'kr_eform')
        )
      AND oldest_candidate.status = 'queued'
        AND oldest_candidate.available_at <= v_now
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
        AND candidate.available_at <= v_now
        AND candidate.country IN (
          'vietnam', 'singapore', 'malaysia', 'thailand', 'south_korea'
        )
        AND (
          (candidate.country = 'vietnam' AND candidate.flow_key = 'vn_prearrival')
          OR (candidate.country = 'singapore' AND candidate.flow_key = 'sgac')
          OR (candidate.country = 'malaysia' AND candidate.flow_key = 'mdac')
          OR (candidate.country = 'thailand' AND candidate.flow_key = 'tdac')
          OR (candidate.country = 'south_korea' AND candidate.flow_key = 'kr_eform')
        )
        AND NOT cap.paused
        AND (
          SELECT COUNT(*)
          FROM public.runner_job AS active
          WHERE active.country = candidate.country
            AND active.status = 'running'
            AND (
              (active.country = 'vietnam' AND active.flow_key = 'vn_prearrival')
              OR (active.country = 'singapore' AND active.flow_key = 'sgac')
              OR (active.country = 'malaysia' AND active.flow_key = 'mdac')
              OR (active.country = 'thailand' AND active.flow_key = 'tdac')
              OR (active.country = 'south_korea' AND active.flow_key = 'kr_eform')
            )
        ) < cap.max_concurrent
      ORDER BY candidate.enqueued_at, candidate.id
      LIMIT 1
      FOR UPDATE OF candidate, cap SKIP LOCKED
    )
    UPDATE public.runner_job AS claimed
    SET status = 'running',
        leased_by = v_worker_id,
        leased_until = v_now + p_lease_ms * INTERVAL '1 millisecond',
        started_at = v_now,
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

CREATE OR REPLACE VIEW public.runner_pool_depth
WITH (security_invoker = true)
AS
SELECT
  cap.country,
  cap.max_concurrent,
  cap.paused,
  COALESCE(COUNT(rj.id) FILTER (
    WHERE rj.status = 'queued' AND rj.available_at <= pg_catalog.clock_timestamp()
  ), 0)::INTEGER AS claimable,
  COALESCE(COUNT(rj.id) FILTER (
    WHERE rj.status = 'queued' AND rj.available_at > pg_catalog.clock_timestamp()
  ), 0)::INTEGER AS scheduled,
  COALESCE(COUNT(rj.id) FILTER (WHERE rj.status = 'running'), 0)::INTEGER AS running
FROM public.runner_concurrency_cap AS cap
LEFT JOIN public.runner_job AS rj
  ON rj.country = cap.country
  AND (
    (rj.country = 'vietnam' AND rj.flow_key = 'vn_prearrival')
    OR (rj.country = 'singapore' AND rj.flow_key = 'sgac')
    OR (rj.country = 'malaysia' AND rj.flow_key = 'mdac')
    OR (rj.country = 'thailand' AND rj.flow_key = 'tdac')
    OR (rj.country = 'south_korea' AND rj.flow_key = 'kr_eform')
  )
WHERE cap.country IN ('vietnam', 'singapore', 'malaysia', 'thailand', 'south_korea')
GROUP BY cap.country, cap.max_concurrent, cap.paused;

REVOKE ALL ON TABLE public.runner_pool_depth FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.runner_pool_depth TO service_role;

REVOKE ALL ON FUNCTION public.claim_runner_pool_job(
  TEXT, INTEGER, BOOLEAN, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_runner_pool_job(
  TEXT, INTEGER, BOOLEAN, TIMESTAMPTZ
) TO service_role;

COMMENT ON FUNCTION public.claim_runner_pool_job(TEXT, INTEGER, BOOLEAN, TIMESTAMPTZ) IS
  'Atomically recovers one expired lease and claims one exact active tuple using database clock_timestamp(); p_now is ignored and direct stale writes require a controlled RPC cutover.';

-- Every direct UPDATE of a running row must carry a private exact full-row
-- capability minted by one of the service-role RPCs. Metadata-only changes
  -- remain harmless because metadata is deliberately outside the
-- lifecycle/identity fence. This is not an expired-only check: an active row
-- reclaimed after a lock wait is fenced identically to an expired row.
CREATE OR REPLACE FUNCTION runner_private.guard_expired_runner_job_lifecycle_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_capability_operation TEXT;
BEGIN
  IF OLD.status IS DISTINCT FROM 'running' THEN
    RETURN NEW;
  END IF;

  -- Metadata-only writes are the sole direct exception. The
  -- subtraction keeps this future-proof if non-fenced metadata keys evolve;
  -- every identity/lifecycle/fingerprint column remains protected.
  IF to_jsonb(NEW) - 'metadata' = to_jsonb(OLD) - 'metadata' THEN
    RETURN NEW;
  END IF;

  DELETE FROM runner_private.runner_job_update_capability AS capability
  WHERE capability.txid = pg_catalog.txid_current()
    AND capability.backend_pid = pg_catalog.pg_backend_pid()
    AND capability.job_id = OLD.id
    AND capability.operation IN (
      'recover', 'complete', 'renew', 'fail', 'takeover_open',
      'admin_pause', 'fingerprint_append'
    )
    AND capability.old_row = to_jsonb(OLD)
    AND capability.new_row = to_jsonb(NEW)
  RETURNING capability.operation
  INTO v_capability_operation;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- The row-image equality above is the exact shape check. A consumed
  -- allowlisted operation is the only path that reaches the new row.
  IF v_capability_operation IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_expired_runner_job_lifecycle_update
BEFORE UPDATE ON public.runner_job
FOR EACH ROW
EXECUTE FUNCTION runner_private.guard_expired_runner_job_lifecycle_update();

REVOKE ALL ON FUNCTION runner_private.guard_expired_runner_job_lifecycle_update()
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION runner_private.guard_expired_runner_job_lifecycle_update() IS
  'Fences every running-row lifecycle/identity/fingerprint update unless an exact private capability is consumed; metadata-only writes remain allowed.';

-- Complete a claimed pool job only while the caller still owns its live lease.
-- The exact full-row capability is minted immediately before UPDATE and is
-- consumed by the permanent trigger. p_now remains only as an API signature
-- slot and is never used for eligibility or finished_at.
CREATE OR REPLACE FUNCTION public.complete_runner_pool_job(
  p_job_id UUID,
  p_worker_id TEXT,
  p_now TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  application_id UUID,
  country TEXT,
  started_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old_row public.runner_job%ROWTYPE;
  v_new_row JSONB;
  v_worker_id TEXT;
  v_now TIMESTAMPTZ;
  v_updated_rows INTEGER := 0;
BEGIN
  IF p_job_id IS NULL THEN
    RAISE EXCEPTION 'p_job_id is required' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(BTRIM(p_worker_id), '') IS NULL THEN
    RAISE EXCEPTION 'p_worker_id must not be blank' USING ERRCODE = '22023';
  END IF;
  v_worker_id := BTRIM(p_worker_id);

  -- Lock the exact live owner/status row before sampling the authoritative
  -- time. A concurrent lease recovery or re-claim therefore completes first,
  -- and this worker rechecks the locked row against the post-lock time.
  SELECT job.*
  INTO v_old_row
  FROM public.runner_job AS job
  WHERE job.id = p_job_id
    AND job.status = 'running'
    AND job.leased_by = v_worker_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_now := pg_catalog.clock_timestamp();
  IF v_old_row.leased_until <= v_now THEN
    RETURN;
  END IF;

  v_new_row := to_jsonb(v_old_row) || jsonb_build_object(
    'status', 'succeeded',
    'finished_at', v_now,
    'leased_by', NULL,
    'leased_until', NULL,
    'last_error', NULL
  );

  DELETE FROM runner_private.runner_job_update_capability
  WHERE txid = pg_catalog.txid_current()
    AND backend_pid = pg_catalog.pg_backend_pid()
    AND job_id = p_job_id;
  INSERT INTO runner_private.runner_job_update_capability (
    txid, backend_pid, job_id, operation, old_row, new_row
  )
  VALUES (
    pg_catalog.txid_current(), pg_catalog.pg_backend_pid(), p_job_id,
    'complete', to_jsonb(v_old_row), v_new_row
  );

  RETURN QUERY
  UPDATE public.runner_job AS job
  SET status = 'succeeded',
    finished_at = v_now,
    leased_by = NULL,
    leased_until = NULL,
    last_error = NULL
  WHERE job.id = p_job_id
    AND job.status = 'running'
    AND job.leased_by = v_worker_id
    AND job.leased_until > v_now
  RETURNING job.application_id, job.country, job.started_at;

  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
  IF v_updated_rows <> 1 THEN
    DELETE FROM runner_private.runner_job_update_capability
    WHERE txid = pg_catalog.txid_current()
      AND backend_pid = pg_catalog.pg_backend_pid()
      AND job_id = p_job_id;
    RETURN;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_runner_pool_job(UUID, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_runner_pool_job(UUID, TEXT, TIMESTAMPTZ) TO service_role;

COMMENT ON FUNCTION public.complete_runner_pool_job(UUID, TEXT, TIMESTAMPTZ) IS
  'Completes a running pool job with a database-clock exact-row capability; p_now is ignored.';

-- Renew a claimed pool job only while the caller still owns its live lease.
-- The database clock is intentionally authoritative and sampled after the
-- exact owner/status row is locked, so network delay cannot extend a reclaimed
-- lease.
CREATE OR REPLACE FUNCTION public.renew_runner_pool_job(
  p_job_id UUID,
  p_worker_id TEXT,
  p_lease_ms INTEGER DEFAULT 900000
)
RETURNS TABLE (
  leased_until TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old_row public.runner_job%ROWTYPE;
  v_new_row JSONB;
  v_now TIMESTAMPTZ;
  v_updated_rows INTEGER := 0;
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

  SELECT job.*
  INTO v_old_row
  FROM public.runner_job AS job
  WHERE job.id = p_job_id
    AND job.status = 'running'
    AND job.leased_by = BTRIM(p_worker_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_now := pg_catalog.clock_timestamp();
  IF v_old_row.leased_until <= v_now THEN
    RETURN;
  END IF;

  v_new_row := to_jsonb(v_old_row) || jsonb_build_object(
    'leased_until', v_now + p_lease_ms * INTERVAL '1 millisecond'
  );

  DELETE FROM runner_private.runner_job_update_capability
  WHERE txid = pg_catalog.txid_current()
    AND backend_pid = pg_catalog.pg_backend_pid()
    AND job_id = p_job_id;
  INSERT INTO runner_private.runner_job_update_capability (
    txid, backend_pid, job_id, operation, old_row, new_row
  )
  VALUES (
    pg_catalog.txid_current(), pg_catalog.pg_backend_pid(), p_job_id,
    'renew', to_jsonb(v_old_row), v_new_row
  );

  RETURN QUERY
  UPDATE public.runner_job AS job
  SET leased_until = v_now + p_lease_ms * INTERVAL '1 millisecond'
  WHERE job.id = p_job_id
    AND job.status = 'running'
    AND job.leased_by = BTRIM(p_worker_id)
    AND job.leased_until > v_now
  RETURNING job.leased_until;

  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
  IF v_updated_rows <> 1 THEN
    DELETE FROM runner_private.runner_job_update_capability
    WHERE txid = pg_catalog.txid_current()
      AND backend_pid = pg_catalog.pg_backend_pid()
      AND job_id = p_job_id;
    RETURN;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.renew_runner_pool_job(UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.renew_runner_pool_job(UUID, TEXT, INTEGER) TO service_role;

COMMENT ON FUNCTION public.renew_runner_pool_job(UUID, TEXT, INTEGER) IS
  'Renews a running pool job with a database-clock exact-row capability.';

-- Settle a failed pool job only while the caller still owns its live lease.
-- Retry availability and terminal timestamps are derived from the database
-- clock sampled after the exact owner/status row is locked;
-- p_retry_after_seconds preserves the existing backoff policy.
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
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old_row public.runner_job%ROWTYPE;
  v_new_row JSONB;
  v_now TIMESTAMPTZ;
  v_available_at TIMESTAMPTZ;
  v_updated_rows INTEGER := 0;
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

  SELECT job.*
  INTO v_old_row
  FROM public.runner_job AS job
  WHERE job.id = p_job_id
    AND job.status = 'running'
    AND job.leased_by = BTRIM(p_worker_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_now := pg_catalog.clock_timestamp();
  IF v_old_row.leased_until <= v_now THEN
    RETURN;
  END IF;

  v_available_at := CASE
    WHEN p_status = 'queued'
      THEN v_now + p_retry_after_seconds * INTERVAL '1 second'
    ELSE NULL
  END;

  v_new_row := to_jsonb(v_old_row) || jsonb_build_object(
    'status', p_status,
    'attempts', p_attempts,
    'last_error', p_last_error,
    'finished_at', CASE WHEN p_status = 'failed' THEN v_now ELSE NULL END,
    'leased_by', NULL,
    'leased_until', NULL,
    'available_at', CASE
      WHEN p_status = 'queued' THEN v_available_at
      ELSE v_old_row.available_at
    END
  );

  DELETE FROM runner_private.runner_job_update_capability
  WHERE txid = pg_catalog.txid_current()
    AND backend_pid = pg_catalog.pg_backend_pid()
    AND job_id = p_job_id;
  INSERT INTO runner_private.runner_job_update_capability (
    txid, backend_pid, job_id, operation, old_row, new_row
  )
  VALUES (
    pg_catalog.txid_current(), pg_catalog.pg_backend_pid(), p_job_id,
    'fail', to_jsonb(v_old_row), v_new_row
  );

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

  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
  IF v_updated_rows <> 1 THEN
    DELETE FROM runner_private.runner_job_update_capability
    WHERE txid = pg_catalog.txid_current()
      AND backend_pid = pg_catalog.pg_backend_pid()
      AND job_id = p_job_id;
    RETURN;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.fail_runner_pool_job(UUID, TEXT, TEXT, INTEGER, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_runner_pool_job(UUID, TEXT, TEXT, INTEGER, TEXT, INTEGER) TO service_role;

COMMENT ON FUNCTION public.fail_runner_pool_job(UUID, TEXT, TEXT, INTEGER, TEXT, INTEGER) IS
  'Settles a failed running pool job with a database-clock exact-row capability.';

-- Open a human takeover only for the current live owner. The runner update,
-- takeover row, and open action log share one transaction and one exact-row
-- capability, so a stale worker cannot orphan a handoff record.
CREATE OR REPLACE FUNCTION public.open_runner_job_takeover(
  p_job_id UUID,
  p_worker_id TEXT,
  p_application_id UUID,
  p_applicant_id UUID,
  p_reason TEXT,
  p_remote_debug_url TEXT,
  p_vnc_url TEXT DEFAULT NULL
)
RETURNS TABLE (takeover_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old_row public.runner_job%ROWTYPE;
  v_new_row JSONB;
  v_takeover_id UUID;
  v_worker_id TEXT;
  v_reason TEXT;
  v_remote_debug_url TEXT;
  v_vnc_url TEXT;
  v_now TIMESTAMPTZ;
  v_updated_rows INTEGER := 0;
BEGIN
  IF p_job_id IS NULL OR p_application_id IS NULL OR p_applicant_id IS NULL THEN
    RAISE EXCEPTION 'job, application, and applicant ids are required'
      USING ERRCODE = '22023';
  END IF;
  v_worker_id := BTRIM(COALESCE(p_worker_id, ''));
  v_reason := BTRIM(COALESCE(p_reason, ''));
  v_remote_debug_url := BTRIM(COALESCE(p_remote_debug_url, ''));
  v_vnc_url := NULLIF(BTRIM(COALESCE(p_vnc_url, '')), '');
  IF v_worker_id = '' OR length(v_worker_id) > 200 THEN
    RAISE EXCEPTION 'worker id is required and must be at most 200 characters'
      USING ERRCODE = '22023';
  END IF;
  IF v_reason = '' OR length(v_reason) > 2000 THEN
    RAISE EXCEPTION 'takeover reason is required and must be at most 2000 characters'
      USING ERRCODE = '22023';
  END IF;
  IF v_remote_debug_url = '' OR length(v_remote_debug_url) > 4096
    OR v_remote_debug_url !~* '^wss?://'
  THEN
    RAISE EXCEPTION 'remote debug URL must be a bounded ws:// or wss:// URL'
      USING ERRCODE = '22023';
  END IF;
  IF v_vnc_url IS NOT NULL AND (
    length(v_vnc_url) > 4096 OR v_vnc_url !~* '^https?://'
  ) THEN
    RAISE EXCEPTION 'VNC URL must be a bounded http:// or https:// URL'
      USING ERRCODE = '22023';
  END IF;

  SELECT job.*
  INTO v_old_row
  FROM public.runner_job AS job
  JOIN public.applications AS application
    ON application.id = job.application_id
  WHERE job.id = p_job_id
    AND job.application_id = p_application_id
    AND application.applicant_id = p_applicant_id
    AND job.status = 'running'
    AND job.leased_by = v_worker_id
  FOR UPDATE OF job, application;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_now := pg_catalog.clock_timestamp();
  IF v_old_row.leased_until IS NULL OR v_old_row.leased_until <= v_now THEN
    RETURN;
  END IF;

  v_takeover_id := public.gen_random_uuid();
  v_new_row := to_jsonb(v_old_row) || jsonb_build_object(
    'status', 'needs_human',
    'leased_by', NULL,
    'leased_until', NULL,
    'last_error', v_reason
  );

  DELETE FROM runner_private.runner_job_update_capability
  WHERE txid = pg_catalog.txid_current()
    AND backend_pid = pg_catalog.pg_backend_pid()
    AND job_id = p_job_id;
  INSERT INTO runner_private.runner_job_update_capability (
    txid, backend_pid, job_id, operation, old_row, new_row
  )
  VALUES (
    pg_catalog.txid_current(), pg_catalog.pg_backend_pid(), p_job_id,
    'takeover_open', to_jsonb(v_old_row), v_new_row
  );

  UPDATE public.runner_job AS job
  SET status = 'needs_human',
      leased_by = NULL,
      leased_until = NULL,
      last_error = v_reason
  WHERE job.id = p_job_id
    AND job.status = 'running'
    AND job.leased_by = v_worker_id
    AND job.leased_until > v_now;
  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
  IF v_updated_rows <> 1 THEN
    DELETE FROM runner_private.runner_job_update_capability
    WHERE txid = pg_catalog.txid_current()
      AND backend_pid = pg_catalog.pg_backend_pid()
      AND job_id = p_job_id;
    RETURN;
  END IF;

  INSERT INTO public.takeover_session (
    id, job_id, application_id, applicant_id, status, reason,
    remote_debug_url, vnc_url, created_at
  )
  VALUES (
    v_takeover_id, p_job_id, p_application_id, p_applicant_id, 'queued',
    v_reason, v_remote_debug_url, v_vnc_url, v_now
  );
  INSERT INTO public.takeover_action_log (takeover_id, action, detail, ts)
  VALUES (
    v_takeover_id,
    'open',
    jsonb_build_object('job_id', p_job_id, 'worker_id', v_worker_id),
    v_now
  );

  RETURN QUERY SELECT v_takeover_id;
END;
$$;

REVOKE ALL ON FUNCTION public.open_runner_job_takeover(
  UUID, TEXT, UUID, UUID, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.open_runner_job_takeover(
  UUID, TEXT, UUID, UUID, TEXT, TEXT, TEXT
) TO service_role;

COMMENT ON FUNCTION public.open_runner_job_takeover(UUID, TEXT, UUID, UUID, TEXT, TEXT, TEXT) IS
  'Atomically opens a queued human takeover for a live runner owner and records the open action.';

-- Pause all queued/running jobs for face-match or staff review. Queued rows
-- are ordinary non-running lifecycle updates; each running row gets its own
-- exact capability immediately before the guarded update.
CREATE OR REPLACE FUNCTION public.pause_runner_jobs_for_review(
  p_application_id UUID,
  p_reason TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_job public.runner_job%ROWTYPE;
  v_new_row JSONB;
  v_reason TEXT := BTRIM(COALESCE(p_reason, ''));
  v_now TIMESTAMPTZ;
  v_updated_rows INTEGER;
  v_count INTEGER := 0;
BEGIN
  IF p_application_id IS NULL THEN
    RAISE EXCEPTION 'application id is required' USING ERRCODE = '22023';
  END IF;
  IF v_reason = '' OR length(v_reason) > 2000 THEN
    RAISE EXCEPTION 'pause reason is required and must be at most 2000 characters'
      USING ERRCODE = '22023';
  END IF;

  FOR v_job IN
    SELECT job.*
    FROM public.runner_job AS job
    WHERE job.application_id = p_application_id
      AND job.status IN ('queued', 'running')
    ORDER BY job.id
    FOR UPDATE
  LOOP
    IF v_job.status = 'queued' THEN
      UPDATE public.runner_job AS job
      SET status = 'paused',
          leased_by = NULL,
          leased_until = NULL,
          last_error = v_reason
      WHERE job.id = v_job.id;
      GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
    ELSE
      v_now := pg_catalog.clock_timestamp();
      v_new_row := to_jsonb(v_job) || jsonb_build_object(
        'status', 'paused',
        'leased_by', NULL,
        'leased_until', NULL,
        'last_error', v_reason
      );
      DELETE FROM runner_private.runner_job_update_capability
      WHERE txid = pg_catalog.txid_current()
        AND backend_pid = pg_catalog.pg_backend_pid()
        AND job_id = v_job.id;
      INSERT INTO runner_private.runner_job_update_capability (
        txid, backend_pid, job_id, operation, old_row, new_row
      )
      VALUES (
        pg_catalog.txid_current(), pg_catalog.pg_backend_pid(), v_job.id,
        'admin_pause', to_jsonb(v_job), v_new_row
      );
      UPDATE public.runner_job AS job
      SET status = 'paused',
          leased_by = NULL,
          leased_until = NULL,
          last_error = v_reason
      WHERE job.id = v_job.id
        AND job.status = 'running';
      GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
      IF v_updated_rows <> 1 THEN
        DELETE FROM runner_private.runner_job_update_capability
        WHERE txid = pg_catalog.txid_current()
          AND backend_pid = pg_catalog.pg_backend_pid()
          AND job_id = v_job.id;
        RAISE EXCEPTION 'runner job pause capability was not consumed'
          USING ERRCODE = '55000';
      END IF;
    END IF;
    IF v_updated_rows = 1 THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.pause_runner_jobs_for_review(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pause_runner_jobs_for_review(UUID, TEXT)
  TO service_role;

COMMENT ON FUNCTION public.pause_runner_jobs_for_review(UUID, TEXT) IS
  'Pauses queued and live running jobs for one application with exact capabilities for running rows.';

-- Append one anti-bot fingerprint entry only for the current live owner. A
-- direct fingerprint_history UPDATE is protected by the same full-row trigger.
CREATE OR REPLACE FUNCTION public.append_runner_job_fingerprint(
  p_job_id UUID,
  p_worker_id TEXT,
  p_entry JSONB
)
RETURNS TABLE (job_id UUID, fingerprint_history JSONB)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old_row public.runner_job%ROWTYPE;
  v_new_history JSONB;
  v_new_row JSONB;
  v_worker_id TEXT := BTRIM(COALESCE(p_worker_id, ''));
  v_now TIMESTAMPTZ;
  v_updated_rows INTEGER := 0;
BEGIN
  IF p_job_id IS NULL OR v_worker_id = '' OR length(v_worker_id) > 200 THEN
    RAISE EXCEPTION 'job id and worker id are required' USING ERRCODE = '22023';
  END IF;
  IF p_entry IS NULL OR pg_catalog.jsonb_typeof(p_entry) <> 'object'
    OR pg_catalog.pg_column_size(p_entry) > 65536
  THEN
    RAISE EXCEPTION 'fingerprint entry must be a JSON object no larger than 64 KiB'
      USING ERRCODE = '22023';
  END IF;

  SELECT job.*
  INTO v_old_row
  FROM public.runner_job AS job
  WHERE job.id = p_job_id
    AND job.status = 'running'
    AND job.leased_by = v_worker_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_now := pg_catalog.clock_timestamp();
  IF v_old_row.leased_until IS NULL OR v_old_row.leased_until <= v_now THEN
    RETURN;
  END IF;
  v_new_history := COALESCE(v_old_row.fingerprint_history, '[]'::JSONB)
    || jsonb_build_array(p_entry);
  IF pg_catalog.pg_column_size(v_new_history) > 524288 THEN
    RAISE EXCEPTION 'fingerprint history cannot exceed 512 KiB'
      USING ERRCODE = '22023';
  END IF;
  v_new_row := to_jsonb(v_old_row) || jsonb_build_object(
    'fingerprint_history', v_new_history
  );

  DELETE FROM runner_private.runner_job_update_capability
  WHERE txid = pg_catalog.txid_current()
    AND backend_pid = pg_catalog.pg_backend_pid()
    AND job_id = p_job_id;
  INSERT INTO runner_private.runner_job_update_capability (
    txid, backend_pid, job_id, operation, old_row, new_row
  )
  VALUES (
    pg_catalog.txid_current(), pg_catalog.pg_backend_pid(), p_job_id,
    'fingerprint_append', to_jsonb(v_old_row), v_new_row
  );

  RETURN QUERY
  UPDATE public.runner_job AS job
  SET fingerprint_history = v_new_history
  WHERE job.id = p_job_id
    AND job.status = 'running'
    AND job.leased_by = v_worker_id
    AND job.leased_until > v_now
  RETURNING job.id, job.fingerprint_history;
  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
  IF v_updated_rows <> 1 THEN
    DELETE FROM runner_private.runner_job_update_capability
    WHERE txid = pg_catalog.txid_current()
      AND backend_pid = pg_catalog.pg_backend_pid()
      AND job_id = p_job_id;
    RETURN;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.append_runner_job_fingerprint(UUID, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.append_runner_job_fingerprint(UUID, TEXT, JSONB)
  TO service_role;

COMMENT ON FUNCTION public.append_runner_job_fingerprint(UUID, TEXT, JSONB) IS
  'Appends one bounded fingerprint entry for the exact live runner owner.';

-- Persist a runner's canonical submission result while its exact owner lease
-- is still live. The job row is locked before sampling clock_timestamp(), so
-- a reclaimed/expired owner cannot overwrite a newer worker's application
-- result. Application fields update in the same transaction as the ownership
-- check; only a submitted result advances applications.status.
CREATE OR REPLACE FUNCTION public.write_runner_pool_submission_result(
  p_job_id UUID,
  p_worker_id TEXT,
  p_submission_result JSONB,
  p_submission_result_status TEXT
)
RETURNS TABLE (
  runner_job_id UUID,
  application_id UUID,
  submission_result_updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_application_id UUID;
  v_locked_application_id UUID;
  v_locked_job_application_id UUID;
  v_leased_until TIMESTAMPTZ;
  v_worker_id TEXT;
  v_result_status TEXT;
  v_now TIMESTAMPTZ;
  v_updated_at TIMESTAMPTZ;
BEGIN
  IF p_job_id IS NULL THEN
    RAISE EXCEPTION 'p_job_id is required' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(BTRIM(p_worker_id), '') IS NULL THEN
    RAISE EXCEPTION 'p_worker_id must not be blank' USING ERRCODE = '22023';
  END IF;
  IF p_submission_result IS NULL
    OR pg_catalog.jsonb_typeof(p_submission_result) <> 'object'
    OR pg_catalog.pg_column_size(p_submission_result) > 524288
  THEN
    RAISE EXCEPTION 'p_submission_result must be a JSON object no larger than 512 KiB'
      USING ERRCODE = '22023';
  END IF;
  IF NULLIF(BTRIM(p_submission_result_status), '') IS NULL
    OR LOWER(BTRIM(p_submission_result_status)) NOT IN (
      'waiting',
      'scheduled',
      'processing',
      'needs_user_action',
      'completed',
      'stalled',
      'submitted',
      'submitted_mock',
      'unsupported',
      'action_required',
      'stopped_at_sign',
      'stopped_at_pay',
      'stopped_at_review',
      'final_review_required',
      'form_ready_for_agency',
      'form_ready_for_kvac',
      'failed'
    )
  THEN
    RAISE EXCEPTION 'p_submission_result_status is not a supported submission result status'
      USING ERRCODE = '22023';
  END IF;

  v_worker_id := BTRIM(p_worker_id);
  v_result_status := LOWER(BTRIM(p_submission_result_status));

  -- Match enqueue_runner_pool_job's application -> runner_job lock order.
  -- The initial job read is deliberately unlocked; ownership is verified only
  -- after the application row is locked, so an app writer cannot be stranded
  -- behind a lease that expires while this RPC waits.
  SELECT job.application_id
  INTO v_application_id
  FROM public.runner_job AS job
  WHERE job.id = p_job_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT application.id
  INTO v_locked_application_id
  FROM public.applications AS application
  WHERE application.id = v_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT job.application_id, job.leased_until
  INTO v_locked_job_application_id, v_leased_until
  FROM public.runner_job AS job
  WHERE job.id = p_job_id
    AND job.status = 'running'
    AND job.leased_by = v_worker_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_locked_job_application_id IS DISTINCT FROM v_application_id THEN
    RETURN;
  END IF;

  v_now := pg_catalog.clock_timestamp();
  IF v_leased_until IS NULL OR v_leased_until <= v_now THEN
    RETURN;
  END IF;

  UPDATE public.applications AS application
  SET submission_result = p_submission_result,
      submission_result_status = v_result_status,
      submission_result_updated_at = v_now,
      status = CASE
       WHEN v_result_status = 'submitted' THEN 'submitted'
       ELSE application.status
     END
  WHERE application.id = v_locked_application_id
  RETURNING application.submission_result_updated_at
  INTO v_updated_at;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p_job_id, v_locked_application_id, v_updated_at;
END;
$$;

REVOKE ALL ON FUNCTION public.write_runner_pool_submission_result(
  UUID, TEXT, JSONB, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.write_runner_pool_submission_result(
  UUID, TEXT, JSONB, TEXT
) TO service_role;

COMMENT ON FUNCTION public.write_runner_pool_submission_result(UUID, TEXT, JSONB, TEXT) IS
  'Writes a running owner result atomically; stale or expired owners return zero rows.';

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
