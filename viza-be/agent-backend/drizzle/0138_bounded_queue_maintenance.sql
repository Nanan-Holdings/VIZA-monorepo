-- Bound stale submission maintenance to an indexed, atomic database operation.
-- The worker invokes this at a low frequency; the RPC limits each pass so a
-- large abandoned queue cannot turn one poll into an unbounded write burst.

CREATE INDEX IF NOT EXISTS submission_queue_stale_processing_idx
  ON public.submission_queue (
    status,
    (COALESCE(heartbeat_at, updated_at, created_at)),
    id
  )
  WHERE status IN (
    'processing',
    'ds160_prefill_processing',
    'ds160_live_assisted_processing',
    'ds160_proof_processing',
    'fv_prefill_processing',
    'france_live_processing',
    'uk_prefill_processing',
    'uk_live_processing',
    'vn_dry_run_processing',
    'vn_live_assisted_processing',
    'vn_payment_processing',
    'vn_prearrival_dry_run_processing',
    'vn_prearrival_live_assisted_processing',
    'sgac_dry_run_processing',
    'sgac_live_assisted_processing',
    'mdac_dry_run_processing',
    'mdac_live_assisted_processing',
    'tdac_dry_run_processing',
    'tdac_live_assisted_processing',
    'id_c1_live_assisted_processing',
    'id_c1_payment_processing',
    'id_b1_evoa_live_assisted_processing',
    'id_b1_evoa_payment_processing',
    'phetravel_dry_run_processing',
    'phetravel_live_assisted_processing',
    'au_prefill_processing'
  );

CREATE OR REPLACE FUNCTION public.mark_stale_submission_queue_batch(
  p_stale_before TIMESTAMPTZ,
  p_vn_live_stale_before TIMESTAMPTZ,
  p_ds160_live_stale_before TIMESTAMPTZ,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  application_id UUID,
  status TEXT,
  timed_out_status TEXT,
  timeout_seconds INTEGER
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS MATERIALIZED (
    SELECT
      queue.id,
      queue.application_id,
      queue.status,
      CASE
        WHEN queue.status LIKE 'ds160_live_assisted_%' THEN p_ds160_live_stale_before
        WHEN queue.status IN ('vn_live_assisted_processing', 'vn_payment_processing')
          THEN p_vn_live_stale_before
        ELSE p_stale_before
      END AS stale_before,
      CASE
        WHEN queue.status LIKE 'ds160_live_assisted_%' THEN 'ds160_live_assisted_failed'
        WHEN queue.status LIKE 'ds160_proof_%' THEN 'ds160_proof_failed'
        WHEN queue.status LIKE 'ds160_%' THEN 'ds160_prefill_failed'
        WHEN queue.status LIKE 'fv_%' THEN 'fv_prefill_failed'
        WHEN queue.status LIKE 'uk_%' THEN 'uk_prefill_failed'
        WHEN queue.status LIKE 'vn_live_assisted_%' THEN 'vn_live_assisted_failed'
        WHEN queue.status LIKE 'vn_dry_run_%' THEN 'vn_dry_run_failed'
        WHEN queue.status LIKE 'vn_prearrival_live_assisted_%' THEN 'vn_prearrival_live_assisted_failed'
        WHEN queue.status LIKE 'vn_prearrival_dry_run_%' THEN 'vn_prearrival_dry_run_failed'
        WHEN queue.status LIKE 'vn_prearrival_%' THEN 'vn_prearrival_blocked'
        WHEN queue.status LIKE 'vn_%' THEN 'vn_prefill_failed'
        WHEN queue.status LIKE 'sgac_live_assisted_%' THEN 'sgac_live_assisted_failed'
        WHEN queue.status LIKE 'sgac_dry_run_%' THEN 'sgac_dry_run_failed'
        WHEN queue.status LIKE 'sgac_%' THEN 'sgac_blocked'
        WHEN queue.status LIKE 'mdac_live_assisted_%' THEN 'mdac_live_assisted_failed'
        WHEN queue.status LIKE 'mdac_dry_run_%' THEN 'mdac_dry_run_failed'
        WHEN queue.status LIKE 'mdac_%' THEN 'mdac_blocked'
        WHEN queue.status LIKE 'tdac_live_assisted_%' THEN 'tdac_live_assisted_failed'
        WHEN queue.status LIKE 'tdac_dry_run_%' THEN 'tdac_dry_run_failed'
        WHEN queue.status LIKE 'tdac_%' THEN 'tdac_blocked'
        WHEN queue.status LIKE 'id_c1_live_assisted_%' THEN 'id_c1_live_assisted_failed'
        WHEN queue.status LIKE 'id_c1_payment_%' THEN 'id_c1_payment_failed'
        WHEN queue.status LIKE 'id_b1_evoa_live_assisted_%' THEN 'id_b1_evoa_live_assisted_failed'
        WHEN queue.status LIKE 'id_b1_evoa_payment_%' THEN 'id_b1_evoa_payment_failed'
        WHEN queue.status LIKE 'phetravel_live_assisted_%' THEN 'phetravel_live_assisted_failed'
        WHEN queue.status LIKE 'phetravel_dry_run_%' THEN 'phetravel_dry_run_failed'
        WHEN queue.status LIKE 'phetravel_%' THEN 'phetravel_blocked'
        WHEN queue.status LIKE 'au_%' THEN 'au_prefill_failed'
        ELSE 'failed'
      END AS timed_out_status,
      CASE
        WHEN queue.status LIKE 'ds160_live_assisted_%' THEN EXTRACT(EPOCH FROM (NOW() - p_ds160_live_stale_before))::INTEGER
        WHEN queue.status IN ('vn_live_assisted_processing', 'vn_payment_processing') THEN EXTRACT(EPOCH FROM (NOW() - p_vn_live_stale_before))::INTEGER
        ELSE EXTRACT(EPOCH FROM (NOW() - p_stale_before))::INTEGER
      END AS timeout_seconds,
      COALESCE(queue.heartbeat_at, queue.updated_at, queue.created_at) AS last_touched
    FROM public.submission_queue AS queue
    WHERE queue.status IN (
      'processing',
      'ds160_prefill_processing', 'ds160_live_assisted_processing', 'ds160_proof_processing',
      'fv_prefill_processing', 'france_live_processing', 'uk_prefill_processing', 'uk_live_processing',
      'vn_dry_run_processing', 'vn_live_assisted_processing', 'vn_payment_processing',
      'vn_prearrival_dry_run_processing', 'vn_prearrival_live_assisted_processing',
      'sgac_dry_run_processing', 'sgac_live_assisted_processing',
      'mdac_dry_run_processing', 'mdac_live_assisted_processing',
      'tdac_dry_run_processing', 'tdac_live_assisted_processing',
      'id_c1_live_assisted_processing', 'id_c1_payment_processing',
      'id_b1_evoa_live_assisted_processing', 'id_b1_evoa_payment_processing',
      'phetravel_dry_run_processing', 'phetravel_live_assisted_processing', 'au_prefill_processing'
    )
      AND COALESCE(queue.heartbeat_at, queue.updated_at, queue.created_at) <
        CASE
          WHEN queue.status IN ('vn_live_assisted_processing', 'vn_payment_processing') THEN p_vn_live_stale_before
          WHEN queue.status = 'ds160_live_assisted_processing' THEN p_ds160_live_stale_before
          ELSE p_stale_before
        END
    ORDER BY COALESCE(queue.heartbeat_at, queue.updated_at, queue.created_at), queue.id
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 100), 500))
    FOR UPDATE SKIP LOCKED
  ), updated AS (
    UPDATE public.submission_queue AS queue
    SET status = candidates.timed_out_status,
        attempts = GREATEST(queue.attempts, 3),
        last_error = format(
          'Submission job failed: worker heartbeat stopped for %ss in status %s.',
          GREATEST(candidates.timeout_seconds, 1), candidates.status
        ),
        error_code = 'queue_processing_timed_out',
        error_message = format(
          'Submission job failed: worker heartbeat stopped for %ss in status %s.',
          GREATEST(candidates.timeout_seconds, 1), candidates.status
        ),
        current_stage = 'failed',
        locked_by = NULL,
        locked_until = NULL,
        updated_at = NOW()
    FROM candidates
    WHERE queue.id = candidates.id
      AND queue.status = candidates.status
    RETURNING queue.id, queue.application_id, candidates.status,
      candidates.timed_out_status, GREATEST(candidates.timeout_seconds, 1) AS timeout_seconds,
      queue.last_error
  ), app_updated AS (
    UPDATE public.applications AS app
    SET submission_result = jsonb_build_object('error', updated.last_error),
        submission_result_status = 'failed',
        submission_result_updated_at = NOW()
    FROM updated
    WHERE app.id = updated.application_id
    RETURNING updated.id
  )
  SELECT updated.id, updated.application_id, updated.status,
    updated.timed_out_status, updated.timeout_seconds
  FROM updated;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_stale_submission_queue_batch(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_stale_submission_queue_batch(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER)
  TO service_role;

COMMENT ON FUNCTION public.mark_stale_submission_queue_batch(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) IS
  'Atomically marks a bounded batch of stale processing queue rows and their applications as failed.';
