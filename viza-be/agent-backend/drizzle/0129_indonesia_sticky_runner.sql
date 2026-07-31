-- Move Indonesia B1/C1 from the shared runner_job pool to one sticky
-- submission_queue Machine. The sticky process owns account registration,
-- alias email/OTP, browser state, one-time card data, payment, and evidence.

-- Preserve any queued Indonesia pool work by moving it to the authoritative
-- submission_queue transport before retiring the old jobs.
INSERT INTO public.submission_queue (
  application_id,
  status,
  mode,
  provider,
  attempts,
  current_stage,
  created_at,
  updated_at
)
SELECT
  rj.application_id,
  CASE
    WHEN rj.flow_key = 'id_b1_evoa' THEN 'id_b1_evoa_live_assisted_pending'
    ELSE 'id_c1_live_assisted_pending'
  END,
  'live_assisted',
  CASE
    WHEN rj.flow_key = 'id_b1_evoa' THEN 'indonesia_b1_evoa_live'
    ELSE 'indonesia_c1_live'
  END,
  0,
  'migrated_to_indonesia_sticky_worker',
  COALESCE(rj.enqueued_at, NOW()),
  NOW()
FROM public.runner_job AS rj
WHERE rj.country = 'indonesia'
  AND rj.status = 'queued'
  AND NOT EXISTS (
    SELECT 1
    FROM public.submission_queue AS sq
    WHERE sq.application_id = rj.application_id
      AND (
        sq.status IN ('pending', 'processing', 'france_live_official_portal_opened')
        OR sq.status LIKE '%pending'
        OR sq.status LIKE '%processing'
        OR sq.status LIKE '%scheduled'
      )
  )
ON CONFLICT DO NOTHING;

UPDATE public.runner_job
SET
  status = 'failed',
  attempts = max_attempts,
  last_error = 'Indonesia runner_job transport retired; work moved to the sticky submission_queue worker.',
  leased_by = NULL,
  leased_until = NULL,
  finished_at = NOW()
WHERE country = 'indonesia'
  AND status = 'queued';

UPDATE public.runner_concurrency_cap
SET
  paused = TRUE,
  notes = 'Retired from shared pool; Indonesia B1/C1 uses one sticky submission_queue Machine.',
  updated_at = NOW()
WHERE country = 'indonesia';

-- Prevent old application servers from creating new simplified Indonesia pool
-- jobs after the migration. New code enqueues through enqueue_submission_retry.
CREATE OR REPLACE FUNCTION public.reject_indonesia_runner_job_transport()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF LOWER(COALESCE(NEW.country, '')) = 'indonesia'
    AND NEW.status IN ('queued', 'running') THEN
    RAISE EXCEPTION
      'Indonesia runner_job transport is retired; enqueue the sticky submission_queue flow'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reject_indonesia_runner_job_transport
  ON public.runner_job;
CREATE TRIGGER reject_indonesia_runner_job_transport
BEFORE INSERT
ON public.runner_job
FOR EACH ROW
EXECUTE FUNCTION public.reject_indonesia_runner_job_transport();

REVOKE ALL ON FUNCTION public.reject_indonesia_runner_job_transport()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reject_indonesia_runner_job_transport()
  TO service_role;

-- Indonesia owns one of the same ten logical started-Machine slots as the
-- shared pool, legacy worker, and Korea sticky worker.
ALTER TABLE public.runner_machine_slot
  DROP CONSTRAINT IF EXISTS runner_machine_slot_owner_kind_check;
ALTER TABLE public.runner_machine_slot
  ADD CONSTRAINT runner_machine_slot_owner_kind_check
  CHECK (owner_kind IN ('pool', 'legacy', 'south_korea', 'indonesia'));

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
  IF p_kind NOT IN ('legacy', 'south_korea', 'indonesia') THEN
    RAISE EXCEPTION 'Sticky slot kind must be legacy, south_korea, or indonesia'
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

REVOKE ALL ON FUNCTION public.reserve_sticky_runner_machine_slot(
  TEXT, TEXT, INTEGER, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_sticky_runner_machine_slot(
  TEXT, TEXT, INTEGER, TIMESTAMPTZ
) TO service_role;

-- Dedicated atomic claim for Indonesia. Only the sticky Indonesia worker
-- enables this RPC; generic legacy workers no longer see these statuses.
CREATE INDEX IF NOT EXISTS submission_queue_indonesia_claim_idx
  ON public.submission_queue(status, locked_until, created_at)
  WHERE status IN (
    'id_c1_live_assisted_pending',
    'id_b1_evoa_live_assisted_pending'
  );

CREATE OR REPLACE FUNCTION public.claim_indonesia_submission_queue_batch(
  p_worker_id TEXT,
  p_limit INTEGER DEFAULT 1,
  p_lease_seconds INTEGER DEFAULT 900,
  p_target_job_id UUID DEFAULT NULL,
  p_max_attempts INTEGER DEFAULT 3
)
RETURNS SETOF public.submission_queue
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT sq.id
    FROM public.submission_queue AS sq
    WHERE sq.status IN (
        'id_c1_live_assisted_pending',
        'id_b1_evoa_live_assisted_pending'
      )
      AND sq.attempts < p_max_attempts
      AND (p_target_job_id IS NULL OR sq.id = p_target_job_id)
      AND (sq.locked_until IS NULL OR sq.locked_until < NOW())
    ORDER BY sq.created_at, sq.id
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.submission_queue AS sq
  SET
    locked_by = p_worker_id,
    locked_at = NOW(),
    locked_until = NOW() + MAKE_INTERVAL(
      secs => GREATEST(COALESCE(p_lease_seconds, 900), 60)
    ),
    updated_at = NOW()
  FROM candidates
  WHERE sq.id = candidates.id
  RETURNING sq.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_indonesia_submission_queue_batch(
  TEXT, INTEGER, INTEGER, UUID, INTEGER
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_indonesia_submission_queue_batch(
  TEXT, INTEGER, INTEGER, UUID, INTEGER
) TO service_role;

-- Replace the generic claim list without Indonesia statuses.
DROP INDEX IF EXISTS public.submission_queue_claim_pending_idx;
CREATE INDEX submission_queue_claim_pending_idx
  ON public.submission_queue(status, locked_until, created_at)
  WHERE status IN (
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
  );

CREATE OR REPLACE FUNCTION public.claim_submission_queue_batch(
  p_worker_id TEXT,
  p_limit INTEGER DEFAULT 20,
  p_lease_seconds INTEGER DEFAULT 900,
  p_target_job_id UUID DEFAULT NULL,
  p_max_attempts INTEGER DEFAULT 3
)
RETURNS SETOF public.submission_queue
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT sq.id
    FROM public.submission_queue AS sq
    WHERE sq.status IN (
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
      AND sq.attempts < p_max_attempts
      AND (p_target_job_id IS NULL OR sq.id = p_target_job_id)
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
    locked_by = p_worker_id,
    locked_at = NOW(),
    locked_until = NOW() + MAKE_INTERVAL(
      secs => GREATEST(COALESCE(p_lease_seconds, 900), 60)
    ),
    updated_at = NOW()
  FROM candidates
  WHERE sq.id = candidates.id
  RETURNING sq.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_submission_queue_batch(
  TEXT, INTEGER, INTEGER, UUID, INTEGER
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_submission_queue_batch(
  TEXT, INTEGER, INTEGER, UUID, INTEGER
) TO service_role;

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
  'vietnam', 'singapore', 'malaysia', 'thailand', 'south_korea'
)
GROUP BY cap.country, cap.max_concurrent, cap.paused;

REVOKE ALL ON TABLE public.runner_pool_depth FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.runner_pool_depth TO service_role;

COMMENT ON FUNCTION public.claim_indonesia_submission_queue_batch(
  TEXT, INTEGER, INTEGER, UUID, INTEGER
) IS
  'Claims at most one Indonesia B1/C1 job for the sticky viza-runner-indonesia Machine.';
COMMENT ON TABLE public.runner_machine_slot IS
  'Ten logical started-Machine slots shared by pool, legacy, Indonesia, and Korea sticky services.';
