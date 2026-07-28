-- Serialize generic submission retries per application.
--
-- The previous API performed supersede and insert as separate requests. Two
-- concurrent clicks could both pass the active-row check and create competing
-- browser jobs. Locking the application row makes the operation atomic while
-- allowing different application IDs to progress independently.

WITH ranked_active_jobs AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY application_id
      ORDER BY
        CASE
          WHEN locked_until > NOW() THEN 0
          WHEN status = 'processing' OR status LIKE '%processing' THEN 1
          ELSE 2
        END,
        created_at DESC,
        id DESC
    ) AS active_rank
  FROM public.submission_queue
  WHERE status IN ('pending', 'processing', 'france_live_official_portal_opened')
    OR status LIKE '%pending'
    OR status LIKE '%processing'
    OR status LIKE '%scheduled'
)
UPDATE public.submission_queue AS sq
SET
  status = 'retry_superseded',
  current_stage = 'superseded_by_application_queue_isolation',
  error_code = 'superseded_duplicate_application_job',
  error_message = 'Superseded while enforcing one active submission job per application.',
  locked_by = NULL,
  locked_at = NULL,
  locked_until = NULL,
  updated_at = NOW()
FROM ranked_active_jobs AS ranked
WHERE sq.id = ranked.id
  AND ranked.active_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS submission_queue_one_active_job_per_application_idx
  ON public.submission_queue(application_id)
  WHERE status IN ('pending', 'processing', 'france_live_official_portal_opened')
    OR status LIKE '%pending'
    OR status LIKE '%processing'
    OR status LIKE '%scheduled';

CREATE OR REPLACE FUNCTION public.enqueue_submission_retry(
  p_application_id UUID,
  p_status TEXT,
  p_mode TEXT,
  p_provider TEXT,
  p_current_stage TEXT DEFAULT NULL,
  p_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  queue_id UUID,
  queue_status TEXT,
  queue_mode TEXT,
  queue_provider TEXT,
  reused_existing BOOLEAN,
  superseded_count INTEGER
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_existing public.submission_queue%ROWTYPE;
  v_inserted_id UUID;
  v_superseded_ids UUID[] := ARRAY[]::UUID[];
  v_superseded_count INTEGER := 0;
BEGIN
  IF p_mode NOT IN ('dry_run', 'live_assisted') THEN
    RAISE EXCEPTION 'Unsupported submission mode: %', p_mode
      USING ERRCODE = '22023';
  END IF;

  IF NOT (
    p_status = 'pending'
    OR p_status LIKE '%pending'
    OR p_status LIKE '%scheduled'
  ) THEN
    RAISE EXCEPTION 'Unsupported retry queue status: %', p_status
      USING ERRCODE = '22023';
  END IF;

  -- Per-application mutex. A different application locks a different row.
  PERFORM 1
  FROM public.applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application % does not exist', p_application_id
      USING ERRCODE = '23503';
  END IF;

  -- Lock every active row before deciding whether to reuse or supersede it.
  -- Queue claimers use SKIP LOCKED, so they cannot claim an unlocked pending
  -- row in the gap between this decision and the replacement insert.
  PERFORM sq.id
  FROM public.submission_queue AS sq
  WHERE sq.application_id = p_application_id
    AND (
      sq.status IN ('pending', 'processing', 'france_live_official_portal_opened')
      OR sq.status LIKE '%pending'
      OR sq.status LIKE '%processing'
      OR sq.status LIKE '%scheduled'
    )
  FOR UPDATE;

  SELECT sq.*
  INTO v_existing
  FROM public.submission_queue AS sq
  WHERE sq.application_id = p_application_id
    AND (
      sq.status IN ('processing', 'france_live_official_portal_opened')
      OR sq.status LIKE '%processing'
      OR sq.status LIKE '%scheduled'
      OR sq.locked_until > p_now
    )
  ORDER BY
    CASE
      WHEN sq.locked_until > p_now THEN 0
      WHEN sq.status = 'processing' OR sq.status LIKE '%processing' THEN 1
      ELSE 2
    END,
    sq.created_at DESC,
    sq.id DESC
  LIMIT 1
  FOR UPDATE;

  IF v_existing.id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      v_existing.id,
      v_existing.status,
      v_existing.mode,
      v_existing.provider,
      TRUE,
      0;
    RETURN;
  END IF;

  WITH superseded AS (
    UPDATE public.submission_queue AS sq
    SET
      status = 'retry_superseded',
      current_stage = 'superseded_by_new_application_retry',
      error_code = 'superseded_by_new_application_retry',
      error_message = 'A newer retry replaced this application submission job.',
      locked_by = NULL,
      locked_at = NULL,
      locked_until = NULL,
      updated_at = p_now
    WHERE sq.application_id = p_application_id
      AND (
        sq.status IN (
          'pending',
          'stalled',
          'action_required',
          'needs_manual_verification',
          'failed'
        )
        OR sq.status LIKE '%pending'
        OR sq.status LIKE '%scheduled'
        OR sq.status LIKE '%failed'
        OR sq.status LIKE '%blocked'
        OR sq.status LIKE '%cancelled'
      )
    RETURNING sq.id
  )
  SELECT COALESCE(ARRAY_AGG(id), ARRAY[]::UUID[]), COUNT(*)::INTEGER
  INTO v_superseded_ids, v_superseded_count
  FROM superseded;

  IF CARDINALITY(v_superseded_ids) > 0 THEN
    UPDATE public.submission_manual_actions
    SET
      status = 'expired',
      completed_at = COALESCE(completed_at, p_now),
      expires_at = COALESCE(expires_at, p_now)
    WHERE submission_queue_id = ANY(v_superseded_ids)
      AND status IN ('pending', 'in_progress');

    UPDATE public.vietnam_live_manual_actions
    SET
      status = 'expired',
      completed_at = COALESCE(completed_at, p_now),
      expires_at = COALESCE(expires_at, p_now)
    WHERE submission_queue_id = ANY(v_superseded_ids)
      AND status IN ('pending', 'in_progress');
  END IF;

  INSERT INTO public.submission_queue (
    application_id,
    status,
    mode,
    provider,
    attempts,
    last_error,
    current_stage,
    created_at,
    updated_at
  )
  VALUES (
    p_application_id,
    p_status,
    p_mode,
    p_provider,
    0,
    NULL,
    p_current_stage,
    p_now,
    p_now
  )
  RETURNING id INTO v_inserted_id;

  RETURN QUERY
  SELECT
    v_inserted_id,
    p_status,
    p_mode,
    p_provider,
    FALSE,
    v_superseded_count;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_submission_retry(
  UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.enqueue_submission_retry(
  UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ
) TO service_role;

COMMENT ON INDEX public.submission_queue_one_active_job_per_application_idx IS
  'Allows only one active browser job per application while different applications remain independent.';

COMMENT ON FUNCTION public.enqueue_submission_retry(
  UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ
) IS
  'Atomically reuses active work or supersedes stale work before enqueueing one retry for an application.';
