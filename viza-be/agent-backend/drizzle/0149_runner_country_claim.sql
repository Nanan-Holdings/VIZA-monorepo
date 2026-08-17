-- Dedicated country runner_job claim.
--
-- This function is intentionally separate from the existing shared claim
-- path. It is a Philippines-only boundary for the dedicated eTravel worker;
-- unscoped workers retain their existing compatibility behavior.

CREATE INDEX IF NOT EXISTS idx_runner_job_philippines_claim
  ON public.runner_job (enqueued_at, id)
  WHERE country = 'philippines' AND status = 'queued';

CREATE OR REPLACE FUNCTION public.claim_runner_country_job(
  p_worker_id TEXT,
  p_country TEXT,
  p_lease_ms INTEGER DEFAULT 900000,
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
  v_country TEXT := LOWER(REPLACE(BTRIM(p_country), '-', '_'));
  v_job_id UUID;
BEGIN
  IF NULLIF(BTRIM(p_worker_id), '') IS NULL THEN
    RAISE EXCEPTION 'Worker id is required' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(v_country, '') IS NULL THEN
    RAISE EXCEPTION 'Country is required' USING ERRCODE = '22023';
  END IF;
  IF v_country <> 'philippines' THEN
    RAISE EXCEPTION 'Unsupported country-scoped runner claim: %', p_country
      USING ERRCODE = '22023';
  END IF;
  IF p_lease_ms < 10000 OR p_lease_ms > 7200000 THEN
    RAISE EXCEPTION 'Runner lease must be between 10 seconds and 2 hours'
      USING ERRCODE = '22023';
  END IF;

  -- A dedicated lock makes cap checks, lease recovery, and claim selection
  -- atomic without changing the unscoped compatibility claimant.
  PERFORM pg_advisory_xact_lock(
    hashtext('viza-runner-country-claim:' || v_country)
  );

  UPDATE public.runner_job AS expired
  SET attempts = expired.attempts + 1,
      status = CASE
        WHEN expired.attempts + 1 >= expired.max_attempts THEN 'failed'
        ELSE 'queued'
      END,
      last_error = 'Worker lease expired before completion; job recovered by country worker.',
      leased_by = NULL,
      leased_until = NULL,
      started_at = CASE
        WHEN expired.attempts + 1 >= expired.max_attempts THEN expired.started_at
        ELSE NULL
      END,
      finished_at = CASE
        WHEN expired.attempts + 1 >= expired.max_attempts THEN p_now
        ELSE NULL
      END
  WHERE expired.status = 'running'
    AND expired.leased_until <= p_now
    AND expired.country = v_country;

  SELECT rj.id
  INTO v_job_id
  FROM public.runner_job AS rj
  JOIN public.runner_concurrency_cap AS cap
    ON cap.country = rj.country
  WHERE rj.status = 'queued'
    AND rj.country = v_country
    AND NOT cap.paused
    AND (
      SELECT COUNT(*)
      FROM public.runner_job AS active
      WHERE active.country = v_country
        AND active.status = 'running'
    ) < cap.max_concurrent
  ORDER BY rj.enqueued_at, rj.id
  LIMIT 1
  FOR UPDATE OF rj SKIP LOCKED;

  IF v_job_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE public.runner_job AS claimed
  SET status = 'running',
      leased_by = p_worker_id,
      leased_until = p_now + p_lease_ms * INTERVAL '1 millisecond',
      started_at = p_now,
      finished_at = NULL,
      last_error = NULL
  WHERE claimed.id = v_job_id
    AND claimed.status = 'queued'
    AND claimed.country = v_country
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

REVOKE ALL ON FUNCTION public.claim_runner_country_job(
  TEXT, TEXT, INTEGER, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_runner_country_job(
  TEXT, TEXT, INTEGER, TIMESTAMPTZ
) TO service_role;

COMMENT ON FUNCTION public.claim_runner_country_job(
  TEXT, TEXT, INTEGER, TIMESTAMPTZ
) IS
  'Atomically recovers and claims one runner_job for exactly one country without changing the shared runner pool.';
