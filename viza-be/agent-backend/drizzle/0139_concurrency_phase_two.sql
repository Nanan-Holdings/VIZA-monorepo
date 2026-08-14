-- Shard shared runner claims by country without a global advisory lock.
--
-- The cap row is the serialization point for one country's running-count
-- check. A caller locks only the selected country's row, so unrelated country
-- claims can proceed concurrently while the ten production machine slots
-- remain the global cost guard.

CREATE INDEX IF NOT EXISTS runner_job_queued_available_idx
  ON public.runner_job (available_at, enqueued_at, id)
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
BEGIN
  IF NULLIF(BTRIM(p_worker_id), '') IS NULL THEN
    RAISE EXCEPTION 'Worker id is required' USING ERRCODE = '22023';
  END IF;
  IF p_lease_ms < 10000 OR p_lease_ms > 7200000 THEN
    RAISE EXCEPTION 'Runner lease must be between 10 seconds and 2 hours'
      USING ERRCODE = '22023';
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

  -- Scan the shared queue in stable FIFO order. The candidate and its country
  -- cap are locked together, so a locked country is skipped and another
  -- eligible country's row can be claimed by the same poll.
  RETURN QUERY
  WITH selected AS MATERIALIZED (
    SELECT candidate.id, candidate.country
    FROM public.runner_job AS candidate
    JOIN public.runner_concurrency_cap AS cap
      ON cap.country = candidate.country
    WHERE candidate.status = 'queued'
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
