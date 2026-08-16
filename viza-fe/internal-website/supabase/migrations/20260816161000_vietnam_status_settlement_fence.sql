-- Vietnam official-status lease generations and atomic settlement fence.
--
-- This migration supersedes the worker-identity-only functions from 0137/0139.
-- Every mutating RPC is SECURITY DEFINER with an empty search path and is
-- executable by service_role only.  A lease generation changes on every
-- acquisition, so a reclaimed worker can never settle a previous lease.

ALTER TABLE public.official_status_checks
  ADD COLUMN IF NOT EXISTS lease_generation BIGINT NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.official_status_checks'::regclass
      AND conname = 'official_status_checks_lease_generation_nonnegative'
  ) THEN
    ALTER TABLE public.official_status_checks
      ADD CONSTRAINT official_status_checks_lease_generation_nonnegative
      CHECK (lease_generation >= 0);
  END IF;
END;
$$;

DROP INDEX IF EXISTS public.official_status_checks_claim_idx;
CREATE INDEX IF NOT EXISTS official_status_checks_claim_idx
  ON public.official_status_checks
    (country_code, status, scheduled_for, lease_expires_at, created_at, id)
  WHERE country_code = 'VN';

-- The old one-argument compatibility wrapper is intentionally removed.  A
-- worker must identify itself and carry the generation returned by this call.
DROP FUNCTION IF EXISTS public.claim_vn_official_status_checks(INTEGER);
DROP FUNCTION IF EXISTS public.claim_vn_official_status_checks(TEXT, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.claim_vn_official_status_checks(
  p_worker_id TEXT,
  p_limit INTEGER DEFAULT 1,
  p_lease_seconds INTEGER DEFAULT 300
)
RETURNS SETOF public.official_status_checks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_worker_id TEXT;
  v_limit INTEGER;
  v_lease_seconds INTEGER;
  v_now TIMESTAMPTZ;
  v_ids UUID[];
BEGIN
  IF p_worker_id IS NULL OR NULLIF(BTRIM(p_worker_id), '') IS NULL
     OR CHAR_LENGTH(BTRIM(p_worker_id)) > 128 THEN
    RAISE EXCEPTION 'p_worker_id must be a non-empty string of at most 128 characters'
      USING ERRCODE = '22023';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'p_limit must be between 1 and 100' USING ERRCODE = '22023';
  END IF;
  IF p_lease_seconds IS NULL OR p_lease_seconds < 1 OR p_lease_seconds > 3600 THEN
    RAISE EXCEPTION 'p_lease_seconds must be between 1 and 3600'
      USING ERRCODE = '22023';
  END IF;

  -- Lock candidates before sampling the clock.  The second clock sample below
  -- makes a long lock wait visible to the lease predicate and returned lease.
  SELECT COALESCE(ARRAY_AGG(locked_candidates.id), ARRAY[]::UUID[])
    INTO v_ids
  FROM (
    SELECT candidate.id
    FROM public.official_status_checks AS candidate
    WHERE candidate.country_code = 'VN'
      AND candidate.scheduled_for <= clock_timestamp()
      AND (
        candidate.status = 'queued'
        OR (
          candidate.status = 'running'
          AND candidate.lease_expires_at IS NOT NULL
          AND candidate.lease_expires_at <= clock_timestamp()
        )
      )
    ORDER BY candidate.scheduled_for, candidate.created_at, candidate.id
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  ) AS locked_candidates;

  v_now := pg_catalog.clock_timestamp();

  RETURN QUERY
  UPDATE public.official_status_checks AS checks
  SET
    status = 'running',
    worker_id = BTRIM(p_worker_id),
    claimed_at = v_now,
    lease_expires_at = v_now + MAKE_INTERVAL(secs => p_lease_seconds),
    started_at = v_now,
    completed_at = NULL,
    attempt_count = checks.attempt_count + 1,
    lease_generation = checks.lease_generation + 1,
    updated_at = v_now
  WHERE checks.id = ANY(v_ids)
    AND checks.country_code = 'VN'
    AND checks.scheduled_for <= v_now
    AND (
      checks.status = 'queued'
      OR (
        checks.status = 'running'
        AND checks.lease_expires_at IS NOT NULL
        AND checks.lease_expires_at <= v_now
      )
    )
  RETURNING checks.*;
END;
$$;

DROP FUNCTION IF EXISTS public.renew_vn_official_status_check(UUID, TEXT, BIGINT, INTEGER);

CREATE OR REPLACE FUNCTION public.renew_vn_official_status_check(
  p_check_id UUID,
  p_worker_id TEXT,
  p_lease_generation BIGINT,
  p_lease_seconds INTEGER
)
RETURNS TABLE (
  id UUID,
  lease_generation BIGINT,
  lease_expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_check public.official_status_checks%ROWTYPE;
  v_now TIMESTAMPTZ;
  v_updated INTEGER := 0;
BEGIN
  IF p_check_id IS NULL OR p_lease_generation IS NULL THEN
    RAISE EXCEPTION 'p_check_id and p_lease_generation are required'
      USING ERRCODE = '22023';
  END IF;
  IF p_worker_id IS NULL OR NULLIF(BTRIM(p_worker_id), '') IS NULL
     OR CHAR_LENGTH(BTRIM(p_worker_id)) > 128 THEN
    RAISE EXCEPTION 'p_worker_id must be a non-empty string of at most 128 characters'
      USING ERRCODE = '22023';
  END IF;
  IF p_lease_seconds IS NULL OR p_lease_seconds < 1 OR p_lease_seconds > 3600 THEN
    RAISE EXCEPTION 'p_lease_seconds must be between 1 and 3600'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_check
  FROM public.official_status_checks
  WHERE id = p_check_id
  FOR UPDATE;

  v_now := pg_catalog.clock_timestamp();
  IF NOT FOUND
     OR v_check.country_code <> 'VN'
     OR v_check.status <> 'running'
     OR v_check.worker_id <> BTRIM(p_worker_id)
     OR v_check.lease_generation <> p_lease_generation
     OR v_check.lease_expires_at IS NULL
     OR v_check.lease_expires_at <= v_now THEN
    RETURN;
  END IF;

  UPDATE public.official_status_checks AS checks
  SET lease_expires_at = v_now + MAKE_INTERVAL(secs => p_lease_seconds),
      updated_at = v_now
  WHERE checks.id = p_check_id
    AND checks.status = 'running'
    AND checks.worker_id = BTRIM(p_worker_id)
    AND checks.lease_generation = p_lease_generation
    AND checks.lease_expires_at > v_now;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 1 THEN
    RETURN QUERY
    SELECT checks.id, checks.lease_generation, checks.lease_expires_at
    FROM public.official_status_checks AS checks
    WHERE checks.id = p_check_id;
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.defer_vn_official_status_check(UUID, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.defer_vn_official_status_check(UUID, TEXT, BIGINT, INTEGER);

CREATE OR REPLACE FUNCTION public.defer_vn_official_status_check(
  p_check_id UUID,
  p_worker_id TEXT,
  p_lease_generation BIGINT,
  p_retry_after_seconds INTEGER DEFAULT 30
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_check public.official_status_checks%ROWTYPE;
  v_now TIMESTAMPTZ;
  v_updated INTEGER := 0;
BEGIN
  IF p_check_id IS NULL OR p_lease_generation IS NULL THEN
    RAISE EXCEPTION 'p_check_id and p_lease_generation are required'
      USING ERRCODE = '22023';
  END IF;
  IF p_worker_id IS NULL OR NULLIF(BTRIM(p_worker_id), '') IS NULL
     OR CHAR_LENGTH(BTRIM(p_worker_id)) > 128 THEN
    RAISE EXCEPTION 'p_worker_id must be a non-empty string of at most 128 characters'
      USING ERRCODE = '22023';
  END IF;
  IF p_retry_after_seconds IS NULL OR p_retry_after_seconds < 1
     OR p_retry_after_seconds > 300 THEN
    RAISE EXCEPTION 'p_retry_after_seconds must be between 1 and 300'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_check
  FROM public.official_status_checks
  WHERE id = p_check_id
  FOR UPDATE;
  v_now := pg_catalog.clock_timestamp();

  IF NOT FOUND
     OR v_check.country_code <> 'VN'
     OR v_check.status <> 'running'
     OR v_check.worker_id <> BTRIM(p_worker_id)
     OR v_check.lease_generation <> p_lease_generation
     OR v_check.lease_expires_at IS NULL
     OR v_check.lease_expires_at <= v_now THEN
    RETURN FALSE;
  END IF;

  UPDATE public.official_status_checks AS checks
  SET status = 'queued',
      scheduled_for = v_now + MAKE_INTERVAL(secs => p_retry_after_seconds),
      attempt_count = GREATEST(checks.attempt_count - 1, 0),
      worker_id = NULL,
      claimed_at = NULL,
      lease_expires_at = NULL,
      started_at = NULL,
      updated_at = v_now
  WHERE checks.id = p_check_id
    AND checks.status = 'running'
    AND checks.worker_id = BTRIM(p_worker_id)
    AND checks.lease_generation = p_lease_generation
    AND checks.lease_expires_at > v_now;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'Vietnam status check changed during settlement'
      USING ERRCODE = '55000';
  END IF;
  RETURN TRUE;
END;
$$;

DROP FUNCTION IF EXISTS public.fail_vn_official_status_check(UUID, TEXT, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.fail_vn_official_status_check(UUID, TEXT, BIGINT, TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.fail_vn_official_status_check(
  p_check_id UUID,
  p_worker_id TEXT,
  p_lease_generation BIGINT,
  p_error_code TEXT,
  p_error_message TEXT,
  p_raw_status_json JSONB DEFAULT '{}'::JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_check public.official_status_checks%ROWTYPE;
  v_application public.applications%ROWTYPE;
  v_tracking public.official_application_tracking%ROWTYPE;
  v_application_id UUID;
  v_retry_number INTEGER;
  v_retry_delay INTEGER;
  v_retry_key TEXT;
  v_now TIMESTAMPTZ;
  v_updated INTEGER := 0;
  v_failures INTEGER;
  v_backoff_seconds INTEGER;
  v_raw JSONB := p_raw_status_json;
BEGIN
  IF p_check_id IS NULL OR p_lease_generation IS NULL THEN
    RAISE EXCEPTION 'p_check_id and p_lease_generation are required'
      USING ERRCODE = '22023';
  END IF;
  IF p_worker_id IS NULL OR NULLIF(BTRIM(p_worker_id), '') IS NULL
     OR CHAR_LENGTH(BTRIM(p_worker_id)) > 128 THEN
    RAISE EXCEPTION 'p_worker_id must be a non-empty string of at most 128 characters'
      USING ERRCODE = '22023';
  END IF;
  IF p_error_code IS NULL OR CHAR_LENGTH(BTRIM(p_error_code)) = 0
     OR CHAR_LENGTH(p_error_code) > 100
     OR p_error_message IS NULL OR CHAR_LENGTH(p_error_message) > 500 THEN
    RAISE EXCEPTION 'error code/message bounds are invalid' USING ERRCODE = '22023';
  END IF;
  IF p_raw_status_json IS NULL THEN
    RAISE EXCEPTION 'p_raw_status_json is required' USING ERRCODE = '22023';
  END IF;
  IF JSONB_TYPEOF(v_raw) <> 'object' OR PG_COLUMN_SIZE(v_raw) > 524288 THEN
    RAISE EXCEPTION 'p_raw_status_json must be an object no larger than 512KiB'
      USING ERRCODE = '22023';
  END IF;

  -- Consistent lock order for every settlement path: application, check,
  -- tracking. Read the application id first so an application-delete FK
  -- cascade cannot deadlock against the check lock.
  SELECT application_id INTO v_application_id
  FROM public.official_status_checks
  WHERE id = p_check_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  SELECT * INTO v_application
  FROM public.applications
  WHERE id = v_application_id
  FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  SELECT * INTO v_check
  FROM public.official_status_checks
  WHERE id = p_check_id
  FOR UPDATE;
  IF NOT FOUND OR v_check.application_id <> v_application.id THEN RETURN FALSE; END IF;
  SELECT * INTO v_tracking
  FROM public.official_application_tracking
  WHERE application_id = v_check.application_id
  FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  v_now := pg_catalog.clock_timestamp();
  IF v_check.country_code <> 'VN'
     OR v_check.status <> 'running'
     OR v_check.worker_id <> BTRIM(p_worker_id)
     OR v_check.lease_generation <> p_lease_generation
     OR v_check.lease_expires_at IS NULL
     OR v_check.lease_expires_at <= v_now
     OR v_tracking.country_code <> 'VN'
     OR v_tracking.provider <> 'vietnam_evisa'
     OR v_tracking.applicant_id <> v_application.applicant_id THEN
    RETURN FALSE;
  END IF;

  v_failures := LEAST(v_tracking.consecutive_failures + 1, 1000);
  v_backoff_seconds := CASE
    WHEN v_failures <= 1 THEN 60
    WHEN v_failures = 2 THEN 300
    WHEN v_failures = 3 THEN 900
    WHEN v_failures = 4 THEN 1800
    ELSE 3600
  END;

  UPDATE public.official_application_tracking AS tracking
  SET consecutive_failures = LEAST(tracking.consecutive_failures + 1, 1000),
      next_daily_check_at = v_now + MAKE_INTERVAL(secs => v_backoff_seconds),
      updated_at = v_now
  WHERE tracking.application_id = v_application.id
    AND tracking.applicant_id = v_application.applicant_id
    AND tracking.country_code = 'VN'
    AND tracking.provider = 'vietnam_evisa';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'Vietnam tracking row changed during failure settlement'
      USING ERRCODE = '55000';
  END IF;

  IF v_check.attempt_count < 3 THEN
    v_retry_number := v_check.attempt_count + 1;
    v_retry_delay := CASE WHEN v_retry_number = 2 THEN 900 ELSE 3600 END;
    v_retry_key := 'vn:retry:' || v_check.id::TEXT || ':' || v_retry_number::TEXT;
    INSERT INTO public.official_status_checks (
      application_id, user_id, country_code, provider, status, requested_by,
      trigger_source, idempotency_key, scheduled_for, attempt_count,
      raw_status_json, created_at, updated_at
    ) VALUES (
      v_application.id, v_tracking.auth_user_id, 'VN', 'vietnam_evisa', 'queued',
      'system', 'retry', v_retry_key, v_now + MAKE_INTERVAL(secs => v_retry_delay),
      v_retry_number - 1,
      JSONB_BUILD_OBJECT('source', 'bounded_retry', 'previous_check_id', v_check.id),
      v_now, v_now
    ) ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;
  END IF;

  UPDATE public.official_status_checks AS checks
  SET status = 'failed',
      checked_at = v_now,
      completed_at = v_now,
      error_code = BTRIM(p_error_code),
      error_message = p_error_message,
      raw_status_json = v_raw,
      updated_at = v_now,
      worker_id = NULL,
      claimed_at = NULL,
      lease_expires_at = NULL
  WHERE checks.id = p_check_id
    AND checks.status = 'running'
    AND checks.worker_id = BTRIM(p_worker_id)
    AND checks.lease_generation = p_lease_generation
    AND checks.lease_expires_at > v_now;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'Vietnam status check changed during failure settlement'
      USING ERRCODE = '55000';
  END IF;
  RETURN TRUE;
END;
$$;

DROP FUNCTION IF EXISTS public.complete_vn_official_status_check(UUID, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.complete_vn_official_status_check(UUID, TEXT, BIGINT, JSONB);

CREATE OR REPLACE FUNCTION public.complete_vn_official_status_check(
  p_check_id UUID,
  p_worker_id TEXT,
  p_lease_generation BIGINT,
  p_patch JSONB DEFAULT '{}'::JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_check public.official_status_checks%ROWTYPE;
  v_application public.applications%ROWTYPE;
  v_tracking public.official_application_tracking%ROWTYPE;
  v_application_id UUID;
  v_profile public.applicant_profiles%ROWTYPE;
  v_now TIMESTAMPTZ;
  v_patch JSONB := COALESCE(p_patch, '{}'::JSONB);
  v_next_status TEXT;
  v_official_reference TEXT;
  v_visa_number TEXT;
  v_official_status TEXT;
  v_result_status TEXT;
  v_artifact_path TEXT;
  v_artifact_sha TEXT;
  v_new_artifact BOOLEAN := FALSE;
  v_artifact_changed BOOLEAN := FALSE;
  v_document_ready BOOLEAN := FALSE;
  v_terminal BOOLEAN := FALSE;
  v_previous_status TEXT;
  v_event_key TEXT;
  v_decision TEXT;
  v_locale TEXT;
  v_application_url TEXT;
  v_patch_application_url TEXT;
  v_payload JSONB;
  v_event_metadata JSONB;
  v_retry_number INTEGER;
  v_retry_delay INTEGER;
  v_retry_key TEXT;
  v_updated INTEGER := 0;
  v_expected_pattern TEXT := '^submission-artifacts/[0-9a-f-]+/[0-9a-f-]+/VN/evisa-[0-9a-f]{64}[.]pdf$';
BEGIN
  IF p_check_id IS NULL OR p_lease_generation IS NULL THEN
    RAISE EXCEPTION 'p_check_id and p_lease_generation are required'
      USING ERRCODE = '22023';
  END IF;
  IF p_worker_id IS NULL OR NULLIF(BTRIM(p_worker_id), '') IS NULL
     OR CHAR_LENGTH(BTRIM(p_worker_id)) > 128 THEN
    RAISE EXCEPTION 'p_worker_id must be a non-empty string of at most 128 characters'
      USING ERRCODE = '22023';
  END IF;
  IF p_patch IS NULL THEN
    RAISE EXCEPTION 'p_patch is required' USING ERRCODE = '22023';
  END IF;
  IF JSONB_TYPEOF(v_patch) <> 'object' OR PG_COLUMN_SIZE(v_patch) > 524288 THEN
    RAISE EXCEPTION 'p_patch must be an object no larger than 512KiB'
      USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM JSONB_OBJECT_KEYS(v_patch) AS patch_keys(patch_key)
    WHERE patch_key <> ALL (ARRAY[
      'status', 'official_reference', 'official_status', 'result_status',
      'visa_number', 'application_url', 'artifact_storage_path', 'artifact_sha256',
      'raw_status_json', 'error_code', 'error_message'
    ])
  ) THEN
    RAISE EXCEPTION 'p_patch contains an unsupported status-check field'
      USING ERRCODE = '22023';
  END IF;
  IF v_patch ? 'raw_status_json'
     AND (JSONB_TYPEOF(COALESCE(v_patch -> 'raw_status_json', '{}'::JSONB)) <> 'object'
       OR PG_COLUMN_SIZE(COALESCE(v_patch -> 'raw_status_json', '{}'::JSONB)) > 524288) THEN
    RAISE EXCEPTION 'raw_status_json must be an object no larger than 512KiB'
      USING ERRCODE = '22023';
  END IF;

  -- Lock order is application -> check -> tracking. Read the application id
  -- first so an application-delete FK cascade cannot deadlock against the
  -- status-check lock. The profile is read without a lock after these rows.
  SELECT application_id INTO v_application_id
  FROM public.official_status_checks
  WHERE id = p_check_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  SELECT * INTO v_application
  FROM public.applications
  WHERE id = v_application_id
  FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  SELECT * INTO v_check
  FROM public.official_status_checks
  WHERE id = p_check_id
  FOR UPDATE;
  IF NOT FOUND OR v_check.application_id <> v_application.id THEN RETURN FALSE; END IF;
  SELECT * INTO v_tracking
  FROM public.official_application_tracking
  WHERE application_id = v_check.application_id
  FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  SELECT * INTO v_profile
  FROM public.applicant_profiles
  WHERE id = v_application.applicant_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  v_now := pg_catalog.clock_timestamp();
  IF v_check.country_code <> 'VN'
     OR v_check.status <> 'running'
     OR v_check.worker_id <> BTRIM(p_worker_id)
     OR v_check.lease_generation <> p_lease_generation
     OR v_check.lease_expires_at IS NULL
     OR v_check.lease_expires_at <= v_now
     OR v_tracking.country_code <> 'VN'
     OR v_tracking.provider <> 'vietnam_evisa'
     OR v_tracking.applicant_id <> v_application.applicant_id
     OR v_tracking.auth_user_id IS DISTINCT FROM v_profile.auth_user_id THEN
    RETURN FALSE;
  END IF;

  v_next_status := COALESCE(NULLIF(BTRIM(v_patch ->> 'status'), ''), 'completed');
  IF v_next_status NOT IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'p_patch.status must be completed or cancelled'
      USING ERRCODE = '22023';
  END IF;
  v_official_reference := NULLIF(BTRIM(COALESCE(v_patch ->> 'official_reference', v_check.official_reference)), '');
  IF v_official_reference IS NOT NULL AND CHAR_LENGTH(v_official_reference) > 256 THEN
    RAISE EXCEPTION 'official_reference exceeds 256 characters' USING ERRCODE = '22023';
  END IF;
  v_visa_number := NULLIF(BTRIM(v_patch ->> 'visa_number'), '');
  IF v_visa_number IS NOT NULL
     AND (CHAR_LENGTH(v_visa_number) > 128 OR v_visa_number !~ '^[A-Za-z0-9][A-Za-z0-9./-]{0,127}$') THEN
    RAISE EXCEPTION 'visa_number must be at most 128 bounded visa-reference characters'
      USING ERRCODE = '22023';
  END IF;
  v_patch_application_url := NULLIF(BTRIM(v_patch ->> 'application_url'), '');
  IF v_next_status = 'completed'
     AND (v_patch_application_url IS NULL
       OR CHAR_LENGTH(v_patch_application_url) > 2048
       OR v_patch_application_url !~* ('^https?://[A-Za-z0-9.-]+(:[0-9]{1,5})?/client/status[?]applicationId='
         || v_application.id::TEXT || '$')) THEN
    RAISE EXCEPTION 'application_url must be an absolute http(s) URL of at most 2048 characters'
      USING ERRCODE = '22023';
  END IF;
  v_official_status := LOWER(NULLIF(BTRIM(COALESCE(v_patch ->> 'official_status', v_check.official_status)), ''));
  IF v_official_status IS NOT NULL
     AND v_official_status NOT IN ('approved', 'rejected', 'needs_correction', 'payment_required', 'processing', 'unknown') THEN
    RAISE EXCEPTION 'official_status is not in the allowlist' USING ERRCODE = '22023';
  END IF;
  IF v_next_status = 'completed' AND v_official_status IS NULL THEN
    RAISE EXCEPTION 'completed status requires a trusted official_status'
      USING ERRCODE = '22023';
  END IF;

  v_new_artifact := v_next_status = 'completed'
    AND ((v_patch ? 'artifact_storage_path' AND NULLIF(BTRIM(v_patch ->> 'artifact_storage_path'), '') IS NOT NULL)
      OR (v_patch ? 'artifact_sha256' AND NULLIF(BTRIM(v_patch ->> 'artifact_sha256'), '') IS NOT NULL));
  v_artifact_path := CASE
    WHEN v_next_status = 'cancelled' THEN NULL
    WHEN v_new_artifact AND v_patch ? 'artifact_storage_path' THEN NULLIF(BTRIM(v_patch ->> 'artifact_storage_path'), '')
    ELSE COALESCE(v_check.artifact_storage_path, v_tracking.last_artifact_storage_path, v_application.result_storage_path)
  END;
  v_artifact_sha := CASE
    WHEN v_next_status = 'cancelled' THEN NULL
    WHEN v_new_artifact AND v_patch ? 'artifact_sha256' THEN NULLIF(LOWER(BTRIM(v_patch ->> 'artifact_sha256')), '')
    ELSE COALESCE(
      v_check.artifact_sha256,
      v_tracking.last_artifact_hash,
      SUBSTRING(v_artifact_path FROM 'evisa-([0-9a-f]{64})[.]pdf$')
    )
  END;
  IF v_new_artifact
     AND (NULLIF(BTRIM(v_patch ->> 'artifact_storage_path'), '') IS NULL
       OR NULLIF(BTRIM(v_patch ->> 'artifact_sha256'), '') IS NULL) THEN
    RAISE EXCEPTION 'artifact_storage_path and artifact_sha256 must be supplied together'
      USING ERRCODE = '22023';
  END IF;
  IF v_new_artifact THEN
    IF v_official_status <> 'approved' THEN
      RAISE EXCEPTION 'only approved Vietnam statuses may attach an eVisa artifact'
        USING ERRCODE = '22023';
    END IF;
    IF v_artifact_sha !~ '^[0-9a-f]{64}$'
       OR v_artifact_path !~ v_expected_pattern
       OR v_artifact_path <> 'submission-artifacts/' || v_tracking.auth_user_id::TEXT || '/' ||
          v_application.id::TEXT || '/VN/evisa-' || v_artifact_sha || '.pdf' THEN
      RAISE EXCEPTION 'artifact path must be the deterministic full-SHA Vietnam eVisa path'
        USING ERRCODE = '22023';
    END IF;
  END IF;
  -- A previously persisted artifact remains document-ready even when legacy
  -- rows do not have a hash.  New uploads above still require both fields and
  -- the deterministic full-SHA path.
  v_document_ready := v_artifact_path IS NOT NULL;
  v_artifact_changed := v_new_artifact
    AND (v_tracking.last_artifact_hash IS DISTINCT FROM v_artifact_sha
      OR v_tracking.last_artifact_storage_path IS DISTINCT FROM v_artifact_path);

  v_result_status := CASE v_official_status
    WHEN 'approved' THEN CASE WHEN v_document_ready THEN 'approved' ELSE 'approved_pending_document' END
    WHEN 'rejected' THEN 'rejected'
    WHEN 'needs_correction' THEN 'needs_attention'
    WHEN 'payment_required' THEN 'payment_required'
    WHEN 'processing' THEN 'pending_official_review'
    WHEN 'unknown' THEN 'unknown'
    ELSE NULL
  END;
  IF v_patch ? 'result_status'
     AND NULLIF(BTRIM(v_patch ->> 'result_status'), '') IS NOT NULL
     AND BTRIM(v_patch ->> 'result_status') <> v_result_status THEN
    RAISE EXCEPTION 'result_status does not match the derived official status'
      USING ERRCODE = '22023';
  END IF;
  v_terminal := v_official_status = 'rejected'
    OR (v_official_status = 'approved' AND v_document_ready);
  v_previous_status := v_tracking.last_known_status;

  IF v_next_status = 'completed' THEN
    UPDATE public.applications AS applications
    SET external_status = v_official_status,
        external_status_updated_at = v_now,
        result_status = v_result_status,
        result_storage_path = CASE WHEN v_document_ready THEN v_artifact_path ELSE applications.result_storage_path END,
        status = CASE
          WHEN v_document_ready AND v_official_status = 'approved' THEN 'approved'
          WHEN v_official_status = 'rejected' THEN 'rejected'
          ELSE applications.status
        END,
        updated_at = v_now
    WHERE applications.id = v_application.id
      AND applications.applicant_id = v_application.applicant_id;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated <> 1 THEN
      RAISE EXCEPTION 'Vietnam application changed during status settlement'
        USING ERRCODE = '55000';
    END IF;

    UPDATE public.official_application_tracking AS tracking
    SET tracking_status = CASE WHEN v_terminal THEN 'completed' ELSE tracking.tracking_status END,
        completed_at = CASE WHEN v_terminal THEN v_now ELSE tracking.completed_at END,
        last_known_status = v_official_status,
        last_successful_check_at = v_now,
        last_artifact_hash = CASE WHEN v_artifact_sha IS NOT NULL THEN v_artifact_sha ELSE tracking.last_artifact_hash END,
        last_artifact_storage_path = CASE WHEN v_document_ready THEN v_artifact_path ELSE tracking.last_artifact_storage_path END,
        consecutive_failures = 0,
        updated_at = v_now
    WHERE tracking.application_id = v_application.id
      AND tracking.applicant_id = v_application.applicant_id
      AND tracking.country_code = 'VN'
      AND tracking.provider = 'vietnam_evisa';
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated <> 1 THEN
      RAISE EXCEPTION 'Vietnam tracking row changed during status settlement'
        USING ERRCODE = '55000';
    END IF;

    IF v_document_ready AND v_new_artifact THEN
      INSERT INTO public.application_documents (
        application_id, document_type, storage_path, filename, status, required,
        automation_status, uploaded_by, uploaded_at, metadata, updated_at
      ) VALUES (
        v_application.id, 'evisa_pdf', v_artifact_path,
        'evisa-' || v_artifact_sha || '.pdf', 'validated', FALSE, 'complete',
        v_tracking.auth_user_id, v_now,
        JSONB_BUILD_OBJECT(
          'source', 'vietnam_official_status_portal',
          'bucket', 'submission-artifacts',
          'sha256', v_artifact_sha,
          'visa_number', v_visa_number,
          'delivered_at', v_now
        ),
        v_now
      )
      ON CONFLICT (application_id, document_type) DO UPDATE
      SET storage_path = EXCLUDED.storage_path,
          filename = EXCLUDED.filename,
          status = EXCLUDED.status,
          required = EXCLUDED.required,
          automation_status = EXCLUDED.automation_status,
          uploaded_by = EXCLUDED.uploaded_by,
          uploaded_at = EXCLUDED.uploaded_at,
          metadata = EXCLUDED.metadata,
          updated_at = EXCLUDED.updated_at;
    END IF;

    IF v_previous_status IS DISTINCT FROM v_official_status OR v_artifact_changed THEN
      v_locale := COALESCE(NULLIF(BTRIM(v_profile.language_pref), ''), 'en');
    v_application_url := v_patch_application_url;
    v_decision := CASE
      WHEN v_official_status = 'approved' AND v_document_ready THEN CASE WHEN LOWER(v_locale) LIKE 'zh%' THEN '签证已获批，可打印' ELSE 'Approved — visa ready to print' END
      WHEN v_official_status = 'approved' THEN CASE WHEN LOWER(v_locale) LIKE 'zh%' THEN '签证已获批，正在获取文件' ELSE 'Approved — retrieving visa document' END
      WHEN v_official_status = 'rejected' THEN CASE WHEN LOWER(v_locale) LIKE 'zh%' THEN '申请被拒绝' ELSE 'Application rejected' END
      WHEN v_official_status = 'needs_correction' THEN CASE WHEN LOWER(v_locale) LIKE 'zh%' THEN '需要补充或修改资料' ELSE 'Correction required' END
      WHEN v_official_status = 'payment_required' THEN CASE WHEN LOWER(v_locale) LIKE 'zh%' THEN '等待完成官方付款' ELSE 'Official payment required' END
      WHEN v_official_status = 'processing' THEN CASE WHEN LOWER(v_locale) LIKE 'zh%' THEN '官网处理中' ELSE 'Processing on the official portal' END
      ELSE CASE WHEN LOWER(v_locale) LIKE 'zh%' THEN '官网状态已更新' ELSE 'Official status updated' END
    END;
    v_payload := JSONB_BUILD_OBJECT(
      'applicant_name', LEFT(COALESCE(v_profile.full_name, CASE WHEN LOWER(v_locale) LIKE 'zh%' THEN '用户' ELSE 'Applicant' END), 512),
      'country', CASE WHEN LOWER(v_locale) LIKE 'zh%' THEN '越南' ELSE 'Vietnam' END,
      'decision', LEFT(v_decision, 512),
      'application_url', LEFT(v_application_url, 2048),
      'locale', LEFT(v_locale, 32)
    );
    v_event_key := 'vn-status:' || v_application.id::TEXT || ':' || COALESCE(v_official_status, 'unknown') || ':' || COALESCE(v_artifact_sha, 'no-document');
    v_event_metadata := JSONB_BUILD_OBJECT(
      'previous_status', v_previous_status,
      'official_status', v_official_status,
      'official_reference', v_official_reference,
      'document_ready', v_document_ready,
      'artifact_sha256', v_artifact_sha,
      'artifact_storage_path', v_artifact_path,
      'visa_number', v_visa_number,
      'application_url', v_application_url
    );

    INSERT INTO public.application_events (
      application_id, applicant_id, auth_user_id, event_type, actor_type,
      source, visibility, idempotency_key, message, metadata, occurred_at, created_at
    ) VALUES (
      v_application.id, v_application.applicant_id, v_tracking.auth_user_id,
      'official_status_changed', 'system', 'vietnam_official_status', 'customer',
      v_event_key, v_decision, v_event_metadata, v_now, v_now
    ) ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;

    INSERT INTO public.notification_events (
      application_id, applicant_id, auth_user_id, channel, template_key,
      recipient, status, idempotency_key, payload, scheduled_for, created_at, updated_at
    ) VALUES (
      v_application.id, v_application.applicant_id, v_tracking.auth_user_id,
      'email', 'vietnam_status_update', v_profile.email, 'queued', v_event_key,
      v_payload, v_now, v_now, v_now
    ) ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;

    IF NULLIF(BTRIM(v_profile.email), '') IS NOT NULL THEN
      INSERT INTO public.notification_event_log (
        applicant_id, application_id, event, channel, template_key, recipient,
        payload, outcome, retry_count, next_attempt_at, idempotency_key, ts
      ) VALUES (
        v_application.applicant_id, v_application.id,
        CASE WHEN v_document_ready THEN 'doc_ready' ELSE 'decision_issued' END,
        'email', 'vietnam_status_update', v_profile.email, v_payload, 'queued',
        0, v_now, v_event_key, v_now
      ) ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;
    END IF;
    END IF;

    IF v_official_status = 'approved'
       AND NOT v_document_ready
       AND v_check.attempt_count < 3 THEN
      v_retry_number := v_check.attempt_count + 1;
      v_retry_delay := CASE WHEN v_retry_number = 2 THEN 900 ELSE 3600 END;
      v_retry_key := 'vn:retry:' || v_check.id::TEXT || ':' || v_retry_number::TEXT;
      INSERT INTO public.official_status_checks (
        application_id, user_id, country_code, provider, status, requested_by,
        trigger_source, idempotency_key, scheduled_for, attempt_count,
        raw_status_json, created_at, updated_at
      ) VALUES (
        v_application.id, v_tracking.auth_user_id, 'VN', 'vietnam_evisa', 'queued',
        'system', 'retry', v_retry_key, v_now + MAKE_INTERVAL(secs => v_retry_delay),
        v_retry_number - 1,
        JSONB_BUILD_OBJECT('source', 'bounded_retry', 'previous_check_id', v_check.id),
        v_now, v_now
      ) ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;
    END IF;
  END IF;

  UPDATE public.official_status_checks AS checks
  SET status = v_next_status,
      official_reference = v_official_reference,
      official_status = v_official_status,
      result_status = v_result_status,
      artifact_storage_path = v_artifact_path,
      artifact_sha256 = v_artifact_sha,
      raw_status_json = COALESCE(v_patch -> 'raw_status_json', checks.raw_status_json, '{}'::JSONB),
      error_code = NULL,
      error_message = NULL,
      checked_at = v_now,
      completed_at = v_now,
      updated_at = v_now,
      worker_id = NULL,
      claimed_at = NULL,
      lease_expires_at = NULL
  WHERE checks.id = p_check_id
    AND checks.status = 'running'
    AND checks.worker_id = BTRIM(p_worker_id)
    AND checks.lease_generation = p_lease_generation
    AND checks.lease_expires_at > v_now;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'Vietnam status check changed during settlement'
      USING ERRCODE = '55000';
  END IF;
  RETURN TRUE;
END;
$$;

-- Explicitly leave only the generation-bearing signatures callable by the
-- service role.  Legacy signatures are removed for the controlled cutover;
-- callers must send the lease generation returned by claim.
REVOKE ALL ON FUNCTION public.claim_vn_official_status_checks(TEXT, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.renew_vn_official_status_check(UUID, TEXT, BIGINT, INTEGER)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.defer_vn_official_status_check(UUID, TEXT, BIGINT, INTEGER)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_vn_official_status_check(UUID, TEXT, BIGINT, TEXT, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_vn_official_status_check(UUID, TEXT, BIGINT, JSONB)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_vn_official_status_checks(TEXT, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.renew_vn_official_status_check(UUID, TEXT, BIGINT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.defer_vn_official_status_check(UUID, TEXT, BIGINT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_vn_official_status_check(UUID, TEXT, BIGINT, TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_vn_official_status_check(UUID, TEXT, BIGINT, JSONB) TO service_role;

REVOKE ALL ON TABLE public.official_status_checks FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.official_status_checks TO service_role;

COMMENT ON FUNCTION public.claim_vn_official_status_checks(TEXT, INTEGER, INTEGER) IS
  'Claims due Vietnam checks with a monotonic lease generation; p_limit defaults to one.';
COMMENT ON FUNCTION public.renew_vn_official_status_check(UUID, TEXT, BIGINT, INTEGER) IS
  'Renews a Vietnam check only for its live owner and exact lease generation.';
COMMENT ON FUNCTION public.defer_vn_official_status_check(UUID, TEXT, BIGINT, INTEGER) IS
  'Requeues a Vietnam check only for its live owner and exact lease generation.';
COMMENT ON FUNCTION public.fail_vn_official_status_check(UUID, TEXT, BIGINT, TEXT, TEXT, JSONB) IS
  'Atomically fails a Vietnam check and records bounded tracking backoff.';
COMMENT ON FUNCTION public.complete_vn_official_status_check(UUID, TEXT, BIGINT, JSONB) IS
  'Atomically settles Vietnam status, deterministic eVisa evidence, notifications, and bounded retries.';
