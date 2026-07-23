-- Make every Vietnam Pre-Arrival pending state atomically claimable by the
-- production submission_queue worker. Previously these rows depended on the
-- unlocked compatibility fallback and could look abandoned to the frontend.

DROP INDEX IF EXISTS submission_queue_claim_pending_idx;

CREATE INDEX submission_queue_claim_pending_idx
  ON submission_queue(status, locked_until, created_at)
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
    'vn_prearrival_dry_run_pending',
    'vn_prearrival_live_assisted_scheduled',
    'vn_prearrival_live_assisted_pending',
    'sgac_dry_run_pending',
    'sgac_live_assisted_scheduled',
    'sgac_live_assisted_pending',
    'mdac_dry_run_pending',
    'mdac_live_assisted_scheduled',
    'mdac_live_assisted_pending',
    'tdac_dry_run_pending',
    'tdac_live_assisted_scheduled',
    'tdac_live_assisted_pending',
    'id_c1_live_assisted_pending',
    'id_b1_evoa_live_assisted_pending',
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
        'vn_prearrival_dry_run_pending',
        'vn_prearrival_live_assisted_scheduled',
        'vn_prearrival_live_assisted_pending',
        'sgac_dry_run_pending',
        'sgac_live_assisted_scheduled',
        'sgac_live_assisted_pending',
        'mdac_dry_run_pending',
        'mdac_live_assisted_scheduled',
        'mdac_live_assisted_pending',
        'tdac_dry_run_pending',
        'tdac_live_assisted_scheduled',
        'tdac_live_assisted_pending',
        'id_c1_live_assisted_pending',
        'id_b1_evoa_live_assisted_pending',
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
          'vn_prearrival_live_assisted_scheduled',
          'vn_prearrival_live_assisted_pending',
          'sgac_live_assisted_scheduled',
          'sgac_live_assisted_pending',
          'mdac_live_assisted_scheduled',
          'mdac_live_assisted_pending',
          'tdac_live_assisted_scheduled',
          'tdac_live_assisted_pending',
          'id_c1_live_assisted_pending',
          'id_b1_evoa_live_assisted_pending',
          'phetravel_live_assisted_scheduled',
          'phetravel_live_assisted_pending'
        ) THEN 0
        WHEN sq.status IN (
          'vn_prearrival_dry_run_pending',
          'sgac_dry_run_pending',
          'mdac_dry_run_pending',
          'tdac_dry_run_pending',
          'phetravel_dry_run_pending'
        ) THEN 1
        WHEN sq.status = 'vn_live_assisted_pending' THEN 2
        WHEN sq.status = 'vn_dry_run_pending' THEN 3
        ELSE 10
      END,
      sq.created_at ASC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 20), 100))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.submission_queue AS sq
  SET
    locked_by = p_worker_id,
    locked_at = NOW(),
    locked_until = NOW() + MAKE_INTERVAL(secs => GREATEST(COALESCE(p_lease_seconds, 900), 60)),
    updated_at = NOW()
  FROM candidates
  WHERE sq.id = candidates.id
  RETURNING sq.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_submission_queue_batch(TEXT, INTEGER, INTEGER, UUID, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_submission_queue_batch(TEXT, INTEGER, INTEGER, UUID, INTEGER)
  TO service_role;

COMMENT ON FUNCTION public.claim_submission_queue_batch(TEXT, INTEGER, INTEGER, UUID, INTEGER) IS
  'Atomically claims pending submission_queue rows, including Vietnam Pre-Arrival declarations, for horizontally scaled submission-service workers.';
