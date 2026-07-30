-- Atomically migrate immediate Singapore Arrival Card retries from the legacy
-- submission_queue to the country-scoped runner_job transport.
--
-- Existing scheduled or in-flight legacy work remains authoritative. The
-- producer falls back to legacy whenever this function reports a blocking row.

CREATE UNIQUE INDEX IF NOT EXISTS runner_job_one_active_singapore_job_per_application_idx
  ON public.runner_job(application_id)
  WHERE country = 'singapore' AND status IN ('queued', 'running');

CREATE OR REPLACE FUNCTION public.enqueue_sgac_country_runner_retry(
  p_application_id UUID,
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
  v_legacy public.submission_queue%ROWTYPE;
  v_runner public.runner_job%ROWTYPE;
BEGIN
  IF p_max_attempts < 1 OR p_max_attempts > 10 THEN
    RAISE EXCEPTION 'SGAC max attempts must be between 1 and 10'
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
    AND rj.country = 'singapore'
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
    status,
    attempts,
    max_attempts,
    correlation_id,
    metadata,
    enqueued_at
  )
  VALUES (
    p_application_id,
    'singapore',
    'queued',
    0,
    p_max_attempts,
    p_correlation_id,
    COALESCE(p_metadata, '{}'::JSONB),
    p_now
  )
  RETURNING * INTO v_runner;

  RETURN QUERY
  SELECT v_runner.id, FALSE, FALSE, NULL::UUID, NULL::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_sgac_country_runner_retry(
  UUID, INTEGER, TEXT, JSONB, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.enqueue_sgac_country_runner_retry(
  UUID, INTEGER, TEXT, JSONB, TIMESTAMPTZ
) TO service_role;

COMMENT ON INDEX public.runner_job_one_active_singapore_job_per_application_idx IS
  'Allows one queued or running Singapore country runner per application.';

COMMENT ON FUNCTION public.enqueue_sgac_country_runner_retry(
  UUID, INTEGER, TEXT, JSONB, TIMESTAMPTZ
) IS
  'Atomically reuses legacy SGAC work or enqueues one country-scoped Singapore runner job.';
