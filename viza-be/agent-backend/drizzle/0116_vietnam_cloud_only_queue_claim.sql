-- Isolate Vietnam e-Visa live submissions from legacy/local queue consumers.
-- Only the production Fly worker calls this dedicated RPC. Older workers keep
-- calling claim_submission_queue_batch, whose exact status list intentionally
-- excludes vn_cloud_live_pending.

CREATE INDEX IF NOT EXISTS submission_queue_vn_cloud_claim_idx
  ON submission_queue(locked_until, created_at)
  WHERE status = 'vn_cloud_live_pending';

CREATE OR REPLACE FUNCTION public.claim_vn_cloud_submission_queue_batch(
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
    WHERE sq.status = 'vn_cloud_live_pending'
      AND sq.attempts < p_max_attempts
      AND (p_target_job_id IS NULL OR sq.id = p_target_job_id)
      AND (sq.locked_until IS NULL OR sq.locked_until < NOW())
    ORDER BY sq.created_at ASC
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

REVOKE ALL ON FUNCTION public.claim_vn_cloud_submission_queue_batch(TEXT, INTEGER, INTEGER, UUID, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_vn_cloud_submission_queue_batch(TEXT, INTEGER, INTEGER, UUID, INTEGER)
  TO service_role;

COMMENT ON FUNCTION public.claim_vn_cloud_submission_queue_batch(TEXT, INTEGER, INTEGER, UUID, INTEGER) IS
  'Atomically claims Vietnam e-Visa live jobs reserved for the production cloud worker.';
