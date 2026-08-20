-- Stable speed: renew a live machine lease without reallocation, and expose
-- service-role-only operational health for the existing six-flow/ten-slot
-- runner topology. This migration deliberately does not change caps or slot
-- rows.

CREATE OR REPLACE FUNCTION public.renew_runner_machine_slot(
  p_machine_id TEXT,
  p_kind TEXT,
  p_lease_seconds INTEGER DEFAULT 1800
)
RETURNS TABLE (
  slot_number SMALLINT,
  lease_until TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_machine_id TEXT := pg_catalog.btrim(p_machine_id);
  v_kind TEXT := pg_catalog.btrim(p_kind);
  v_slot SMALLINT;
  v_existing_lease_until TIMESTAMPTZ;
  v_now TIMESTAMPTZ;
BEGIN
  IF NULLIF(v_machine_id, '') IS NULL THEN
    RAISE EXCEPTION 'Machine id is required' USING ERRCODE = '22023';
  END IF;
  IF v_kind NOT IN ('pool', 'legacy', 'south_korea', 'indonesia') THEN
    RAISE EXCEPTION 'Unsupported Machine kind: %', p_kind USING ERRCODE = '22023';
  END IF;
  IF p_lease_seconds IS NULL OR p_lease_seconds < 60 OR p_lease_seconds > 7200 THEN
    RAISE EXCEPTION 'Machine slot lease must be between 60 and 7200 seconds'
      USING ERRCODE = '22023';
  END IF;

  -- Lock only the exact owner row. Sampling the clock after this short lock
  -- wait prevents renewing a lease that expired while another allocator held
  -- the row lock.
  SELECT slot.slot_number, slot.lease_until
  INTO v_slot, v_existing_lease_until
  FROM public.runner_machine_slot AS slot
  WHERE slot.owner_machine_id = v_machine_id
    AND slot.owner_kind = v_kind
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_now := pg_catalog.clock_timestamp();
  IF v_existing_lease_until IS NULL OR v_existing_lease_until <= v_now THEN
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE public.runner_machine_slot AS slot
  SET lease_until = v_now + p_lease_seconds * INTERVAL '1 second',
      updated_at = v_now
  WHERE slot.slot_number = v_slot
    AND slot.owner_machine_id = v_machine_id
    AND slot.owner_kind = v_kind
    AND slot.lease_until > v_now
  RETURNING slot.slot_number, slot.lease_until;
END;
$$;

REVOKE ALL ON FUNCTION public.renew_runner_machine_slot(TEXT, TEXT, INTEGER)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.renew_runner_machine_slot(TEXT, TEXT, INTEGER)
  TO service_role;

COMMENT ON FUNCTION public.renew_runner_machine_slot(TEXT, TEXT, INTEGER) IS
  'Renews only the exact unexpired owner/kind pair with the database clock; zero rows means the lease is lost. It never reallocates or cleans slots.';

CREATE OR REPLACE VIEW public.runner_pool_concurrency_health
WITH (security_invoker = true)
AS
WITH database_clock AS (
  SELECT pg_catalog.clock_timestamp() AS now
)
SELECT
  cap.country,
  cap.max_concurrent,
  cap.paused,
  COALESCE(COUNT(job.id) FILTER (
    WHERE job.status = 'queued'
      AND job.attempts >= 0
      AND job.attempts < job.max_attempts
      AND job.available_at <= database_clock.now
      AND application.status <> 'staff_action_required'
  ), 0)::INTEGER AS claimable,
  COALESCE(COUNT(job.id) FILTER (
    WHERE job.status = 'queued'
      AND job.attempts >= 0
      AND job.attempts < job.max_attempts
      AND job.available_at > database_clock.now
      AND application.status <> 'staff_action_required'
  ), 0)::INTEGER AS scheduled,
  COALESCE(COUNT(job.id) FILTER (WHERE job.status = 'running'), 0)::INTEGER AS running,
  COALESCE(COUNT(job.id) FILTER (
    WHERE job.status = 'running'
      AND (job.leased_until IS NULL OR job.leased_until <= database_clock.now)
  ), 0)::INTEGER AS expired_running,
  GREATEST(
    cap.max_concurrent - COALESCE(COUNT(job.id) FILTER (WHERE job.status = 'running'), 0)::INTEGER,
    0
  )::INTEGER AS capacity_headroom,
  MIN(job.enqueued_at) FILTER (
    WHERE job.status = 'queued'
      AND job.attempts >= 0
      AND job.attempts < job.max_attempts
      AND job.available_at <= database_clock.now
      AND application.status <> 'staff_action_required'
  ) AS oldest_claimable_at,
  GREATEST(
    COALESCE(EXTRACT(EPOCH FROM (
      database_clock.now - MIN(job.enqueued_at) FILTER (
        WHERE job.status = 'queued'
          AND job.attempts >= 0
          AND job.attempts < job.max_attempts
          AND job.available_at <= database_clock.now
          AND application.status <> 'staff_action_required'
      )
    )), 0),
    0
  )::DOUBLE PRECISION AS oldest_claimable_age_seconds
FROM public.runner_concurrency_cap AS cap
CROSS JOIN database_clock
LEFT JOIN public.runner_job AS job
  ON job.country = cap.country
 AND (
      (job.country = 'vietnam' AND job.flow_key = 'vn_prearrival')
      OR (job.country = 'singapore' AND job.flow_key = 'sgac')
      OR (job.country = 'malaysia' AND job.flow_key = 'mdac')
      OR (job.country = 'thailand' AND job.flow_key = 'tdac')
      OR (job.country = 'south_korea' AND job.flow_key = 'kr_eform')
      OR (job.country = 'taiwan' AND job.flow_key = 'tw_entry_permit')
 )
LEFT JOIN public.applications AS application
  ON application.id = job.application_id
WHERE cap.country IN (
  'vietnam', 'singapore', 'malaysia', 'thailand', 'south_korea', 'taiwan'
)
GROUP BY cap.country, cap.max_concurrent, cap.paused, database_clock.now;

REVOKE ALL ON TABLE public.runner_pool_concurrency_health
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.runner_pool_concurrency_health TO service_role;

COMMENT ON VIEW public.runner_pool_concurrency_health IS
  'Service-role-only, database-clock queue/capacity health for the exact six shared runner flow tuples.';

CREATE OR REPLACE VIEW public.runner_slot_capacity_health
WITH (security_invoker = true)
AS
WITH database_clock AS (
  SELECT pg_catalog.clock_timestamp() AS now
)
SELECT
  COUNT(*)::SMALLINT AS max_slots,
  COUNT(*) FILTER (
    WHERE slot.owner_machine_id IS NOT NULL
      AND slot.lease_until > database_clock.now
  )::INTEGER AS live_slots,
  COUNT(*) FILTER (
    WHERE slot.owner_machine_id IS NULL
      AND slot.owner_kind IS NULL
      AND slot.lease_until IS NULL
  )::INTEGER AS free_slots,
  COUNT(*) FILTER (
    WHERE slot.owner_kind = 'pool'
      AND slot.owner_machine_id IS NOT NULL
      AND slot.lease_until > database_clock.now
  )::INTEGER AS pool_live_slots,
  COUNT(*) FILTER (
    WHERE slot.owner_kind IN ('legacy', 'south_korea', 'indonesia')
      AND slot.owner_machine_id IS NOT NULL
      AND slot.lease_until > database_clock.now
  )::INTEGER AS sticky_live_slots,
  COUNT(*) FILTER (
    WHERE slot.owner_machine_id IS NOT NULL
      AND (slot.lease_until IS NULL OR slot.lease_until <= database_clock.now)
  )::INTEGER AS expired_owned_slots,
  COUNT(*) FILTER (
    WHERE slot.owner_machine_id IS NOT NULL
      AND (
        slot.lease_until IS NULL
        OR (
          slot.lease_until > database_clock.now
          AND slot.updated_at < database_clock.now - INTERVAL '180 seconds'
        )
      )
  )::INTEGER AS stale_renewal_slots,
  COUNT(*) FILTER (
    WHERE (slot.owner_machine_id IS NULL AND (
      slot.owner_kind IS NOT NULL OR slot.lease_until IS NOT NULL OR slot.acquired_at IS NOT NULL
    ))
       OR (slot.owner_machine_id IS NOT NULL AND (
      slot.owner_kind IS NULL OR slot.lease_until IS NULL
    ))
  )::INTEGER AS invalid_slots,
  ROUND(
    COALESCE(
      COUNT(*) FILTER (
        WHERE slot.owner_machine_id IS NOT NULL
          AND slot.lease_until > database_clock.now
      )::NUMERIC * 100 / NULLIF(COUNT(*)::NUMERIC, 0),
      0
    ),
    2
  ) AS utilization_percent
FROM public.runner_machine_slot AS slot
CROSS JOIN database_clock;

REVOKE ALL ON TABLE public.runner_slot_capacity_health
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.runner_slot_capacity_health TO service_role;

COMMENT ON VIEW public.runner_slot_capacity_health IS
  'Service-role-only health for the existing ten logical machine lease slots; expired leases are reported but never reclaimed here.';

CREATE TABLE IF NOT EXISTS public.runner_concurrency_metric (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  event_type TEXT NOT NULL,
  outcome TEXT NOT NULL,
  duration_ms INTEGER,
  country TEXT,
  machine_kind TEXT,
  count INTEGER NOT NULL DEFAULT 1,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  CONSTRAINT runner_concurrency_metric_event_type_check
    CHECK (event_type IN ('claim', 'machine_start')),
  CONSTRAINT runner_concurrency_metric_outcome_check
    CHECK (pg_catalog.char_length(pg_catalog.btrim(outcome)) BETWEEN 1 AND 64),
  CONSTRAINT runner_concurrency_metric_duration_check
    CHECK (duration_ms IS NULL OR duration_ms BETWEEN 0 AND 7200000),
  CONSTRAINT runner_concurrency_metric_country_check
    CHECK (country IS NULL OR country IN (
      'vietnam', 'singapore', 'malaysia', 'thailand', 'south_korea', 'taiwan'
    )),
  CONSTRAINT runner_concurrency_metric_machine_kind_check
    CHECK (machine_kind IS NULL OR machine_kind IN (
      'pool', 'legacy', 'south_korea', 'indonesia'
    )),
  CONSTRAINT runner_concurrency_metric_count_check
    CHECK (count BETWEEN 1 AND 10)
);

CREATE INDEX IF NOT EXISTS runner_concurrency_metric_recorded_idx
  ON public.runner_concurrency_metric (recorded_at DESC);
CREATE INDEX IF NOT EXISTS runner_concurrency_metric_event_recorded_idx
  ON public.runner_concurrency_metric (event_type, recorded_at DESC);

ALTER TABLE public.runner_concurrency_metric ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.runner_concurrency_metric
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.runner_concurrency_metric TO service_role;
REVOKE ALL ON SEQUENCE public.runner_concurrency_metric_id_seq
  FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.runner_concurrency_metric_id_seq TO service_role;

COMMENT ON TABLE public.runner_concurrency_metric IS
  'Service-role-only, bounded non-PII claim and machine-start timing samples for concurrency operations.';
