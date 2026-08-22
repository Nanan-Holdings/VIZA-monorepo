-- Route the five canonical tourist submission runners through the retained
-- shared runner pool. The existing direct runner_job producers already wake
-- this pool; the prior claim allowlist left their rows permanently queued.
--
-- Keep one session per tourist country, the existing global ten-Machine cap,
-- logical Machine-slot enforcement, non-blocking claims, lease recovery, and
-- scale-to-zero depth accounting. Indonesia remains on its sticky worker.

INSERT INTO public.runner_concurrency_cap (
  country,
  max_concurrent,
  paused,
  notes
)
VALUES
  ('canada', 1, FALSE, 'Shared pool: Canada IRCC managed TRV session'),
  ('turkey', 1, FALSE, 'Shared pool: Türkiye tourist e-Visa eligibility/application session'),
  ('india', 1, FALSE, 'Shared pool: India tourist e-Visa eligibility/application session'),
  ('saudi_arabia', 1, FALSE, 'Shared pool: Saudi tourist e-Visa managed session'),
  ('united_arab_emirates', 1, FALSE, 'Shared pool: UAE tourist visa authorized session')
ON CONFLICT (country) DO UPDATE
SET max_concurrent = EXCLUDED.max_concurrent,
    notes = EXCLUDED.notes,
    updated_at = NOW();

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

  -- A busy claimant should not build a database lock queue. A later explicit
  -- wake or recovery reconciliation retries this bounded claim.
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
      'vietnam', 'singapore', 'malaysia', 'thailand', 'south_korea',
      'canada', 'turkey', 'india', 'saudi_arabia', 'united_arab_emirates'
    );

  SELECT COUNT(*)::INTEGER
  INTO v_running
  FROM public.runner_job AS active_global
  WHERE active_global.status = 'running'
    AND active_global.country IN (
      'vietnam', 'singapore', 'malaysia', 'thailand', 'south_korea',
      'canada', 'turkey', 'india', 'saudi_arabia', 'united_arab_emirates'
    );

  IF v_running >= 10 THEN
    RETURN;
  END IF;

  SELECT rj.id
  INTO v_job_id
  FROM public.runner_job AS rj
  JOIN public.runner_concurrency_cap AS cap
    ON cap.country = rj.country
  WHERE rj.status = 'queued'
    AND rj.available_at <= p_now
    AND rj.country IN (
      'vietnam', 'singapore', 'malaysia', 'thailand', 'south_korea',
      'canada', 'turkey', 'india', 'saudi_arabia', 'united_arab_emirates'
    )
    AND NOT cap.paused
    AND (
      SELECT COUNT(*)
      FROM public.runner_job AS active
      WHERE active.country = rj.country
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

CREATE OR REPLACE VIEW public.runner_pool_depth
WITH (security_invoker = true)
AS
SELECT
  cap.country,
  cap.max_concurrent,
  cap.paused,
  COALESCE(COUNT(rj.id) FILTER (
    WHERE rj.status = 'queued' AND rj.available_at <= NOW()
  ), 0)::INTEGER AS claimable,
  COALESCE(COUNT(rj.id) FILTER (
    WHERE rj.status = 'queued' AND rj.available_at > NOW()
  ), 0)::INTEGER AS scheduled,
  COALESCE(COUNT(rj.id) FILTER (
    WHERE rj.status = 'running'
  ), 0)::INTEGER AS running
FROM public.runner_concurrency_cap AS cap
LEFT JOIN public.runner_job AS rj
  ON rj.country = cap.country
WHERE cap.country IN (
  'vietnam', 'singapore', 'malaysia', 'thailand', 'south_korea',
  'canada', 'turkey', 'india', 'saudi_arabia', 'united_arab_emirates'
)
GROUP BY cap.country, cap.max_concurrent, cap.paused;

REVOKE ALL ON FUNCTION public.claim_runner_pool_job(
  TEXT, INTEGER, BOOLEAN, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_runner_pool_job(
  TEXT, INTEGER, BOOLEAN, TIMESTAMPTZ
) TO service_role;

REVOKE ALL ON TABLE public.runner_pool_depth FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.runner_pool_depth TO service_role;

COMMENT ON FUNCTION public.claim_runner_pool_job(
  TEXT, INTEGER, BOOLEAN, TIMESTAMPTZ
) IS
  'Non-blocking, slot-bound shared-pool claim for arrival, e-Visa, Korea background, and five tourist-country runner jobs.';
COMMENT ON VIEW public.runner_pool_depth IS
  'Claimable, scheduled, and running shared-pool demand used for on-demand Machine capacity and scale-to-zero reconciliation.';
