-- Six-country shared Fly runner pool.
--
-- This migration keeps legacy submission_queue work authoritative while new
-- runner_job work is migrated. All new objects and RPCs are service-role only.

ALTER TABLE public.runner_job
  ADD COLUMN IF NOT EXISTS flow_key TEXT,
  ADD COLUMN IF NOT EXISTS available_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.runner_job
SET flow_key = CASE country
  WHEN 'singapore' THEN 'sgac'
  WHEN 'malaysia' THEN 'mdac'
  WHEN 'thailand' THEN 'tdac'
  WHEN 'vietnam' THEN 'vn_evisa'
  WHEN 'indonesia' THEN 'id_c1'
  WHEN 'south_korea' THEN 'kr_eform'
  ELSE flow_key
END
WHERE flow_key IS NULL;

CREATE INDEX IF NOT EXISTS runner_job_pool_claim_idx
  ON public.runner_job(status, available_at, enqueued_at)
  WHERE status = 'queued';

DROP INDEX IF EXISTS public.runner_job_one_active_singapore_job_per_application_idx;

CREATE UNIQUE INDEX IF NOT EXISTS runner_job_one_active_job_per_application_idx
  ON public.runner_job(application_id)
  WHERE status IN ('queued', 'running');

INSERT INTO public.runner_concurrency_cap (country, max_concurrent, paused, notes)
VALUES
  ('indonesia', 2, FALSE, 'Shared pool: Indonesia C1/B1 browser sessions'),
  ('vietnam', 2, FALSE, 'Shared pool: Vietnam eVisa and pre-arrival sessions'),
  ('singapore', 1, FALSE, 'Shared pool: ICA SG Arrival Card'),
  ('malaysia', 2, FALSE, 'Shared pool: Malaysia MDAC'),
  ('thailand', 2, FALSE, 'Shared pool: Thailand TDAC'),
  ('south_korea', 1, FALSE, 'Shared pool: Korea background e-Form preparation')
ON CONFLICT (country) DO UPDATE
SET max_concurrent = EXCLUDED.max_concurrent,
    notes = EXCLUDED.notes,
    updated_at = NOW();

CREATE TABLE IF NOT EXISTS public.runner_machine_slot (
  slot_number SMALLINT PRIMARY KEY CHECK (slot_number BETWEEN 1 AND 10),
  owner_machine_id TEXT UNIQUE,
  owner_kind TEXT CHECK (owner_kind IN ('pool', 'legacy', 'south_korea')),
  lease_until TIMESTAMPTZ,
  acquired_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (owner_machine_id IS NULL AND owner_kind IS NULL AND lease_until IS NULL)
    OR
    (owner_machine_id IS NOT NULL AND owner_kind IS NOT NULL AND lease_until IS NOT NULL)
  )
);

INSERT INTO public.runner_machine_slot (slot_number)
SELECT value
FROM generate_series(1, 10) AS value
ON CONFLICT (slot_number) DO NOTHING;

ALTER TABLE public.runner_machine_slot ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.runner_machine_slot FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.runner_machine_slot TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_runner_machine_slot(
  p_machine_id TEXT,
  p_kind TEXT,
  p_lease_seconds INTEGER DEFAULT 1800,
  p_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS SMALLINT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_slot SMALLINT;
BEGIN
  IF NULLIF(BTRIM(p_machine_id), '') IS NULL THEN
    RAISE EXCEPTION 'Machine id is required' USING ERRCODE = '22023';
  END IF;
  IF p_kind NOT IN ('pool', 'legacy', 'south_korea') THEN
    RAISE EXCEPTION 'Unsupported Machine kind: %', p_kind USING ERRCODE = '22023';
  END IF;
  IF p_lease_seconds < 60 OR p_lease_seconds > 7200 THEN
    RAISE EXCEPTION 'Machine slot lease must be between 60 and 7200 seconds'
      USING ERRCODE = '22023';
  END IF;

  LOCK TABLE public.runner_machine_slot IN EXCLUSIVE MODE;

  UPDATE public.runner_machine_slot
  SET owner_machine_id = NULL,
      owner_kind = NULL,
      lease_until = NULL,
      acquired_at = NULL,
      updated_at = p_now
  WHERE lease_until <= p_now;

  UPDATE public.runner_machine_slot
  SET owner_kind = p_kind,
      lease_until = p_now + p_lease_seconds * INTERVAL '1 second',
      updated_at = p_now
  WHERE owner_machine_id = p_machine_id
  RETURNING slot_number INTO v_slot;

  IF v_slot IS NOT NULL THEN
    RETURN v_slot;
  END IF;

  SELECT slot_number
  INTO v_slot
  FROM public.runner_machine_slot
  WHERE owner_machine_id IS NULL
  ORDER BY slot_number
  LIMIT 1
  FOR UPDATE;

  IF v_slot IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.runner_machine_slot
  SET owner_machine_id = p_machine_id,
      owner_kind = p_kind,
      lease_until = p_now + p_lease_seconds * INTERVAL '1 second',
      acquired_at = p_now,
      updated_at = p_now
  WHERE slot_number = v_slot;

  RETURN v_slot;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_runner_machine_slot(
  p_machine_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_released INTEGER;
BEGIN
  UPDATE public.runner_machine_slot
  SET owner_machine_id = NULL,
      owner_kind = NULL,
      lease_until = NULL,
      acquired_at = NULL,
      updated_at = NOW()
  WHERE owner_machine_id = p_machine_id;
  GET DIAGNOSTICS v_released = ROW_COUNT;
  RETURN v_released > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_sticky_runner_machine_slot(
  p_machine_id TEXT,
  p_kind TEXT,
  p_lease_seconds INTEGER DEFAULT 1800,
  p_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  slot_number SMALLINT,
  evicted_pool_machine_id TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_slot SMALLINT;
  v_evicted TEXT;
BEGIN
  IF NULLIF(BTRIM(p_machine_id), '') IS NULL THEN
    RAISE EXCEPTION 'Machine id is required' USING ERRCODE = '22023';
  END IF;
  IF p_kind NOT IN ('legacy', 'south_korea') THEN
    RAISE EXCEPTION 'Sticky slot kind must be legacy or south_korea'
      USING ERRCODE = '22023';
  END IF;
  IF p_lease_seconds < 60 OR p_lease_seconds > 7200 THEN
    RAISE EXCEPTION 'Machine slot lease must be between 60 and 7200 seconds'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('viza-runner-pool-claim'));
  LOCK TABLE public.runner_machine_slot IN EXCLUSIVE MODE;

  UPDATE public.runner_machine_slot
  SET owner_machine_id = NULL,
      owner_kind = NULL,
      lease_until = NULL,
      acquired_at = NULL,
      updated_at = p_now
  WHERE lease_until <= p_now;

  SELECT rms.slot_number
  INTO v_slot
  FROM public.runner_machine_slot AS rms
  WHERE rms.owner_machine_id = p_machine_id
  LIMIT 1;

  IF v_slot IS NOT NULL THEN
    UPDATE public.runner_machine_slot
    SET owner_kind = p_kind,
        lease_until = p_now + p_lease_seconds * INTERVAL '1 second',
        updated_at = p_now
    WHERE runner_machine_slot.slot_number = v_slot;
    RETURN QUERY SELECT v_slot, NULL::TEXT;
    RETURN;
  END IF;

  SELECT rms.slot_number
  INTO v_slot
  FROM public.runner_machine_slot AS rms
  WHERE rms.owner_machine_id IS NULL
  ORDER BY rms.slot_number
  LIMIT 1;

  IF v_slot IS NULL THEN
    SELECT rms.slot_number, rms.owner_machine_id
    INTO v_slot, v_evicted
    FROM public.runner_machine_slot AS rms
    WHERE rms.owner_kind = 'pool'
      AND NOT EXISTS (
        SELECT 1
        FROM public.runner_job AS rj
        WHERE rj.status = 'running'
          AND rj.leased_by = rms.owner_machine_id
      )
    ORDER BY rms.updated_at, rms.slot_number
    LIMIT 1;
  END IF;

  IF v_slot IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.runner_machine_slot
  SET owner_machine_id = p_machine_id,
      owner_kind = p_kind,
      lease_until = p_now + p_lease_seconds * INTERVAL '1 second',
      acquired_at = p_now,
      updated_at = p_now
  WHERE runner_machine_slot.slot_number = v_slot;

  RETURN QUERY SELECT v_slot, v_evicted;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_runner_pool_job(
  p_application_id UUID,
  p_country TEXT,
  p_flow_key TEXT,
  p_available_at TIMESTAMPTZ DEFAULT NOW(),
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
  v_country TEXT := LOWER(REPLACE(BTRIM(p_country), '-', '_'));
  v_flow TEXT := LOWER(REPLACE(BTRIM(p_flow_key), '-', '_'));
  v_legacy public.submission_queue%ROWTYPE;
  v_runner public.runner_job%ROWTYPE;
BEGIN
  IF p_max_attempts < 1 OR p_max_attempts > 10 THEN
    RAISE EXCEPTION 'Runner max attempts must be between 1 and 10'
      USING ERRCODE = '22023';
  END IF;
  IF NOT (
    (v_country = 'singapore' AND v_flow = 'sgac')
    OR (v_country = 'malaysia' AND v_flow = 'mdac')
    OR (v_country = 'thailand' AND v_flow = 'tdac')
    OR (v_country = 'vietnam' AND v_flow IN ('vn_evisa', 'vn_prearrival'))
    OR (v_country = 'indonesia' AND v_flow IN ('id_c1', 'id_b1_evoa'))
    OR (v_country = 'south_korea' AND v_flow = 'kr_eform')
  ) THEN
    RAISE EXCEPTION 'Unsupported shared runner flow: %/%', v_country, v_flow
      USING ERRCODE = '22023';
  END IF;

  PERFORM 1
  FROM public.applications
  WHERE id = p_application_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application % does not exist', p_application_id
      USING ERRCODE = '23503';
  END IF;

  SELECT sq.*
  INTO v_legacy
  FROM public.submission_queue AS sq
  WHERE sq.application_id = p_application_id
    AND (
      sq.status IN ('pending', 'processing', 'france_live_official_portal_opened')
      OR sq.status LIKE '%pending'
      OR sq.status LIKE '%processing'
      OR sq.status LIKE '%scheduled'
      OR sq.locked_until > p_now
    )
  ORDER BY
    CASE
      WHEN sq.locked_until > p_now THEN 0
      WHEN sq.status = 'processing' OR sq.status LIKE '%processing' THEN 1
      WHEN sq.status LIKE '%scheduled' THEN 2
      ELSE 3
    END,
    sq.created_at DESC,
    sq.id DESC
  LIMIT 1
  FOR UPDATE;

  IF v_legacy.id IS NOT NULL THEN
    RETURN QUERY
    SELECT NULL::UUID, FALSE, TRUE, v_legacy.id, v_legacy.status;
    RETURN;
  END IF;

  SELECT rj.*
  INTO v_runner
  FROM public.runner_job AS rj
  WHERE rj.application_id = p_application_id
    AND rj.status IN ('queued', 'running')
  ORDER BY rj.enqueued_at DESC, rj.id DESC
  LIMIT 1
  FOR UPDATE;

  IF v_runner.id IS NOT NULL THEN
    RETURN QUERY
    SELECT v_runner.id, TRUE, FALSE, NULL::UUID, NULL::TEXT;
    RETURN;
  END IF;

  INSERT INTO public.runner_job (
    application_id,
    country,
    flow_key,
    status,
    attempts,
    max_attempts,
    correlation_id,
    metadata,
    available_at,
    enqueued_at
  )
  VALUES (
    p_application_id,
    v_country,
    v_flow,
    'queued',
    0,
    p_max_attempts,
    p_correlation_id,
    COALESCE(p_metadata, '{}'::JSONB),
    COALESCE(p_available_at, p_now),
    p_now
  )
  RETURNING * INTO v_runner;

  RETURN QUERY
  SELECT v_runner.id, FALSE, FALSE, NULL::UUID, NULL::TEXT;
END;
$$;

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

  PERFORM pg_advisory_xact_lock(hashtext('viza-runner-pool-claim'));

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
      'indonesia', 'vietnam', 'singapore',
      'malaysia', 'thailand', 'south_korea'
    );

  SELECT COUNT(*)::INTEGER
  INTO v_running
  FROM public.runner_job AS active_global
  WHERE active_global.status = 'running'
    AND active_global.country IN (
      'indonesia', 'vietnam', 'singapore',
      'malaysia', 'thailand', 'south_korea'
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
      'indonesia', 'vietnam', 'singapore',
      'malaysia', 'thailand', 'south_korea'
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
  COALESCE(COUNT(rj.id) FILTER (WHERE rj.status = 'running'), 0)::INTEGER AS running
FROM public.runner_concurrency_cap AS cap
LEFT JOIN public.runner_job AS rj
  ON rj.country = cap.country
WHERE cap.country IN (
  'indonesia', 'vietnam', 'singapore',
  'malaysia', 'thailand', 'south_korea'
)
GROUP BY cap.country, cap.max_concurrent, cap.paused;

REVOKE ALL ON FUNCTION public.reserve_runner_machine_slot(
  TEXT, TEXT, INTEGER, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_runner_machine_slot(TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_sticky_runner_machine_slot(
  TEXT, TEXT, INTEGER, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_runner_pool_job(
  UUID, TEXT, TEXT, TIMESTAMPTZ, INTEGER, TEXT, JSONB, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_runner_pool_job(
  TEXT, INTEGER, BOOLEAN, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.reserve_runner_machine_slot(
  TEXT, TEXT, INTEGER, TIMESTAMPTZ
) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_runner_machine_slot(TEXT)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_sticky_runner_machine_slot(
  TEXT, TEXT, INTEGER, TIMESTAMPTZ
) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_runner_pool_job(
  UUID, TEXT, TEXT, TIMESTAMPTZ, INTEGER, TEXT, JSONB, TIMESTAMPTZ
) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_runner_pool_job(
  TEXT, INTEGER, BOOLEAN, TIMESTAMPTZ
) TO service_role;

REVOKE ALL ON TABLE public.runner_pool_depth FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.runner_pool_depth TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.runner_job TO service_role;
GRANT SELECT, UPDATE ON TABLE public.runner_concurrency_cap TO service_role;

COMMENT ON TABLE public.runner_machine_slot IS
  'Ten logical started-Machine slots shared by pool, legacy, and Korea sticky services.';
COMMENT ON FUNCTION public.claim_runner_pool_job(TEXT, INTEGER, BOOLEAN, TIMESTAMPTZ) IS
  'Atomically recovers expired leases and claims one eligible six-country shared-pool job.';
COMMENT ON FUNCTION public.enqueue_runner_pool_job(
  UUID, TEXT, TEXT, TIMESTAMPTZ, INTEGER, TEXT, JSONB, TIMESTAMPTZ
) IS
  'Atomically enqueues one typed six-country pool flow unless legacy work is active.';
