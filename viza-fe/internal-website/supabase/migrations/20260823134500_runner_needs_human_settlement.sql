-- Keep applicant/operator checkpoints terminal without consuming a retry.
--
-- The submission-service has long classified NeedsHumanError as
-- `needs_human` with an unchanged attempt count. The phase-two fenced failure
-- RPC only accepted queued/failed transitions, so the runner could release its
-- browser but leave the database job stuck in running. Preserve the exact live
-- lease/worker fence while adding the missing terminal transition.

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
  IF p_status IS NULL OR p_status NOT IN ('queued', 'failed', 'needs_human') THEN
    RAISE EXCEPTION 'p_status must be queued, failed, or needs_human' USING ERRCODE = '22023';
  END IF;
  IF p_attempts IS NULL OR p_attempts < 0 THEN
    RAISE EXCEPTION 'p_attempts must not be negative' USING ERRCODE = '22023';
  END IF;
  IF p_retry_after_seconds IS NULL
    OR p_retry_after_seconds < 0
    OR p_retry_after_seconds > 300
  THEN
    RAISE EXCEPTION 'p_retry_after_seconds must be between 0 and 300'
      USING ERRCODE = '22023';
  END IF;
  IF p_status = 'needs_human' AND p_retry_after_seconds <> 0 THEN
    RAISE EXCEPTION 'needs_human must not carry retry backoff'
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

  IF p_status = 'needs_human' THEN
    IF p_attempts <> v_old_row.attempts THEN
      RAISE EXCEPTION 'needs_human must preserve the locked runner attempt count'
        USING ERRCODE = '22023';
    END IF;
  ELSE
    IF p_attempts <> v_old_row.attempts + 1 THEN
      RAISE EXCEPTION 'p_attempts must advance the locked runner attempt exactly once'
        USING ERRCODE = '22023';
    END IF;
    IF p_status IS DISTINCT FROM (CASE
      WHEN p_attempts >= v_old_row.max_attempts THEN 'failed'
      ELSE 'queued'
    END) THEN
      RAISE EXCEPTION
        'p_status must match the terminal state implied by p_attempts'
        USING ERRCODE = '22023';
    END IF;
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
    'finished_at', CASE WHEN p_status IN ('failed', 'needs_human') THEN v_now ELSE NULL END,
    'started_at', CASE WHEN p_status = 'queued' THEN NULL ELSE v_old_row.started_at END,
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
      finished_at = CASE WHEN p_status IN ('failed', 'needs_human') THEN v_now ELSE NULL END,
      started_at = CASE WHEN p_status = 'queued' THEN NULL ELSE job.started_at END,
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
  'Settles a failed, retryable, or needs-human running pool job with a database-clock exact-row capability.';
