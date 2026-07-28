-- Keep one active official-fee browser job per application/provider.
--
-- New payment authorizations supersede unlocked pending/terminal work for the
-- same application only. A job already claimed by a worker is reused instead
-- of being replaced underneath the running browser session.

WITH ranked_active_jobs AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY application_id, provider
      ORDER BY
        CASE
          WHEN status IN (
            'vn_live_assisted_processing',
            'vn_payment_processing',
            'id_c1_live_assisted_processing',
            'id_c1_payment_processing',
            'id_b1_evoa_live_assisted_processing',
            'id_b1_evoa_payment_processing'
          ) THEN 0
          WHEN locked_until > NOW() THEN 1
          ELSE 2
        END,
        created_at DESC,
        id DESC
    ) AS active_rank
  FROM public.submission_queue
  WHERE provider IN (
      'vietnam_evisa_live',
      'indonesia_c1_live',
      'indonesia_b1_evoa_live'
    )
    AND status IN (
      'vn_cloud_live_pending',
      'vn_live_assisted_pending',
      'vn_live_assisted_processing',
      'vn_payment_pending',
      'vn_payment_processing',
      'id_c1_live_assisted_pending',
      'id_c1_live_assisted_processing',
      'id_c1_payment_pending',
      'id_c1_payment_processing',
      'id_b1_evoa_live_assisted_pending',
      'id_b1_evoa_live_assisted_processing',
      'id_b1_evoa_payment_pending',
      'id_b1_evoa_payment_processing'
    )
)
UPDATE public.submission_queue AS sq
SET
  status = 'retry_superseded',
  current_stage = 'superseded_by_queue_isolation_migration',
  error_code = 'superseded_duplicate_official_fee_job',
  error_message = 'Superseded while enforcing one active official-fee job per application.',
  locked_by = NULL,
  locked_at = NULL,
  locked_until = NULL,
  updated_at = NOW()
FROM ranked_active_jobs AS ranked
WHERE sq.id = ranked.id
  AND ranked.active_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS submission_queue_one_active_official_fee_job_idx
  ON public.submission_queue(application_id, provider)
  WHERE provider IN (
      'vietnam_evisa_live',
      'indonesia_c1_live',
      'indonesia_b1_evoa_live'
    )
    AND status IN (
      'vn_cloud_live_pending',
      'vn_live_assisted_pending',
      'vn_live_assisted_processing',
      'vn_payment_pending',
      'vn_payment_processing',
      'id_c1_live_assisted_pending',
      'id_c1_live_assisted_processing',
      'id_c1_payment_pending',
      'id_c1_payment_processing',
      'id_b1_evoa_live_assisted_pending',
      'id_b1_evoa_live_assisted_processing',
      'id_b1_evoa_payment_pending',
      'id_b1_evoa_payment_processing'
    );

CREATE OR REPLACE FUNCTION public.enqueue_official_fee_submission(
  p_application_id UUID,
  p_user_id UUID,
  p_status TEXT,
  p_provider TEXT,
  p_current_stage TEXT,
  p_manual_action_status TEXT,
  p_payment_status TEXT,
  p_official_status TEXT,
  p_result_payload JSONB,
  p_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  queue_id UUID,
  queue_status TEXT,
  queue_provider TEXT,
  reused_existing BOOLEAN,
  superseded_count INTEGER
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_existing_id UUID;
  v_existing_status TEXT;
  v_inserted_id UUID;
  v_superseded_ids UUID[] := ARRAY[]::UUID[];
  v_superseded_count INTEGER := 0;
BEGIN
  IF p_provider NOT IN (
    'vietnam_evisa_live',
    'indonesia_c1_live',
    'indonesia_b1_evoa_live'
  ) THEN
    RAISE EXCEPTION 'Unsupported official-fee queue provider: %', p_provider
      USING ERRCODE = '22023';
  END IF;

  IF NOT (
    (p_provider = 'vietnam_evisa_live' AND p_status IN ('vn_cloud_live_pending', 'vn_payment_pending'))
    OR
    (p_provider = 'indonesia_c1_live' AND p_status = 'id_c1_live_assisted_pending')
    OR
    (p_provider = 'indonesia_b1_evoa_live' AND p_status = 'id_b1_evoa_live_assisted_pending')
  ) THEN
    RAISE EXCEPTION 'Invalid status % for official-fee provider %', p_status, p_provider
      USING ERRCODE = '22023';
  END IF;

  -- This row lock is the per-application mutex. Different applications lock
  -- different rows and cannot overwrite each other's queue work.
  PERFORM 1
  FROM public.applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application % does not exist', p_application_id
      USING ERRCODE = '23503';
  END IF;

  -- Lock all active rows for this application/provider before deciding. Queue
  -- claimers use SKIP LOCKED and therefore cannot pick an unlocked pending row
  -- while it is being superseded.
  PERFORM sq.id
  FROM public.submission_queue AS sq
  WHERE sq.application_id = p_application_id
    AND sq.provider = p_provider
    AND sq.status IN (
      'vn_cloud_live_pending',
      'vn_live_assisted_pending',
      'vn_live_assisted_processing',
      'vn_payment_pending',
      'vn_payment_processing',
      'id_c1_live_assisted_pending',
      'id_c1_live_assisted_processing',
      'id_c1_payment_pending',
      'id_c1_payment_processing',
      'id_b1_evoa_live_assisted_pending',
      'id_b1_evoa_live_assisted_processing',
      'id_b1_evoa_payment_pending',
      'id_b1_evoa_payment_processing'
    )
  FOR UPDATE;

  -- Do not replace a browser session that is already running, or a pending row
  -- whose claim lease is still live. Reuse it so a second click cannot start a
  -- competing official-portal session.
  SELECT sq.id, sq.status
  INTO v_existing_id, v_existing_status
  FROM public.submission_queue AS sq
  WHERE sq.application_id = p_application_id
    AND sq.provider = p_provider
    AND (
      sq.status IN (
        'vn_live_assisted_processing',
        'vn_payment_processing',
        'id_c1_live_assisted_processing',
        'id_c1_payment_processing',
        'id_b1_evoa_live_assisted_processing',
        'id_b1_evoa_payment_processing'
      )
      OR (
        sq.status IN (
          'vn_cloud_live_pending',
          'vn_live_assisted_pending',
          'vn_payment_pending',
          'id_c1_live_assisted_pending',
          'id_c1_payment_pending',
          'id_b1_evoa_live_assisted_pending',
          'id_b1_evoa_payment_pending'
        )
        AND sq.locked_until > p_now
      )
    )
  ORDER BY sq.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_existing_id IS NOT NULL THEN
    RETURN QUERY
    SELECT v_existing_id, v_existing_status, p_provider, TRUE, 0;
    RETURN;
  END IF;

  WITH superseded AS (
    UPDATE public.submission_queue AS sq
    SET
      status = 'retry_superseded',
      current_stage = 'superseded_by_new_payment_authorization',
      error_code = 'superseded_by_new_payment_authorization',
      error_message = 'A newer payment authorization replaced this official-fee job.',
      locked_by = NULL,
      locked_at = NULL,
      locked_until = NULL,
      updated_at = p_now
    WHERE sq.application_id = p_application_id
      AND sq.provider = p_provider
      AND sq.status IN (
        'pending',
        'stalled',
        'failed',
        'action_required',
        'needs_manual_verification',
        'vn_cloud_live_pending',
        'vn_live_assisted_pending',
        'vn_live_assisted_failed',
        'vn_payment_pending',
        'vn_payment_failed',
        'vn_blocked',
        'id_c1_live_assisted_pending',
        'id_c1_live_assisted_failed',
        'id_c1_payment_pending',
        'id_c1_payment_failed',
        'id_c1_blocked',
        'id_b1_evoa_live_assisted_pending',
        'id_b1_evoa_live_assisted_failed',
        'id_b1_evoa_payment_pending',
        'id_b1_evoa_payment_failed',
        'id_b1_evoa_blocked'
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
    user_id,
    status,
    mode,
    provider,
    current_stage,
    manual_action_status,
    payment_status,
    official_status,
    vn_result_payload,
    attempts,
    heartbeat_at,
    created_at,
    updated_at
  )
  VALUES (
    p_application_id,
    p_user_id,
    p_status,
    'live_assisted',
    p_provider,
    p_current_stage,
    p_manual_action_status,
    p_payment_status,
    p_official_status,
    p_result_payload,
    0,
    p_now,
    p_now,
    p_now
  )
  RETURNING id INTO v_inserted_id;

  RETURN QUERY
  SELECT v_inserted_id, p_status, p_provider, FALSE, v_superseded_count;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_official_fee_submission(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.enqueue_official_fee_submission(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ
) TO service_role;

COMMENT ON INDEX public.submission_queue_one_active_official_fee_job_idx IS
  'Prevents two active official-fee browser jobs from competing for the same application/provider.';

COMMENT ON FUNCTION public.enqueue_official_fee_submission(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ
) IS
  'Atomically isolates official-fee queue work per application, supersedes stale work, and reuses claimed/running work.';
