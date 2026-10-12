-- Keep a claimed DS-160 legacy queue row alive during long CEAC runs.
-- The renewal is intentionally owner- and status-fenced: an expired worker
-- can never resurrect its lease or overwrite a row reclaimed by another worker.

CREATE OR REPLACE FUNCTION public.renew_submission_queue_lease(
  p_queue_id UUID,
  p_worker_id TEXT,
  p_lease_seconds INTEGER DEFAULT 900
)
RETURNS TABLE (
  id UUID,
  locked_until TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now TIMESTAMPTZ;
  v_owner TEXT := BTRIM(p_worker_id);
  v_lease_seconds INTEGER := GREATEST(60, LEAST(COALESCE(p_lease_seconds, 900), 3600));
  v_queue public.submission_queue%ROWTYPE;
BEGIN
  IF p_queue_id IS NULL THEN
    RAISE EXCEPTION 'p_queue_id is required' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(BTRIM(p_worker_id), '') IS NULL THEN
    RAISE EXCEPTION 'p_worker_id must not be blank' USING ERRCODE = '22023';
  END IF;
  IF p_lease_seconds IS NOT NULL AND p_lease_seconds < 1 THEN
    RAISE EXCEPTION 'p_lease_seconds must be positive' USING ERRCODE = '22023';
  END IF;

  -- Do not wait indefinitely behind a competing writer. After the row lock is
  -- acquired, sample the database clock again so a lock wait cannot turn an
  -- already-expired lease into a valid renewal.
  PERFORM set_config('lock_timeout', '2s', true);
  SELECT *
  INTO v_queue
  FROM public.submission_queue AS sq
  WHERE sq.id = p_queue_id
  FOR UPDATE;

  IF NOT FOUND
    OR v_queue.locked_by IS DISTINCT FROM v_owner
    OR v_queue.locked_until IS NULL
    OR v_queue.status NOT IN (
      'ds160_prefill_processing',
      'ds160_live_assisted_processing',
      'ds160_proof_processing'
    ) THEN
    RETURN;
  END IF;

  v_now := clock_timestamp();
  IF v_queue.locked_until <= v_now THEN
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE public.submission_queue AS sq
  SET
    locked_until = v_now + MAKE_INTERVAL(secs => v_lease_seconds),
    updated_at = v_now
  WHERE sq.id = p_queue_id
    AND sq.locked_by = v_owner
    AND sq.locked_until > v_now
    AND sq.status IN (
      'ds160_prefill_processing',
      'ds160_live_assisted_processing',
      'ds160_proof_processing'
    )
  RETURNING sq.id, sq.locked_until;
END;
$$;

REVOKE ALL ON FUNCTION public.renew_submission_queue_lease(UUID, TEXT, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.renew_submission_queue_lease(UUID, TEXT, INTEGER)
  TO service_role;

COMMENT ON FUNCTION public.renew_submission_queue_lease(UUID, TEXT, INTEGER) IS
  'Renews a live DS-160 submission_queue lease only for its current worker; an expired or reclaimed lease returns no row.';
