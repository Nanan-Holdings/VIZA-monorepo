-- Vietnam e-Visa post-submission status tracking and result delivery.
-- This migration intentionally enables tracking only when application code
-- explicitly creates an official_application_tracking row. Existing
-- applications are not backfilled.

CREATE TABLE IF NOT EXISTS official_status_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  user_id UUID,
  country_code TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  official_reference TEXT,
  official_status TEXT,
  result_status TEXT,
  requested_by TEXT NOT NULL DEFAULT 'system',
  checked_at TIMESTAMPTZ DEFAULT now(),
  raw_status_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE official_status_checks ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS official_status_checks_application_idx
  ON official_status_checks(application_id);
CREATE INDEX IF NOT EXISTS official_status_checks_user_idx
  ON official_status_checks(user_id);
CREATE INDEX IF NOT EXISTS official_status_checks_country_idx
  ON official_status_checks(country_code);
CREATE INDEX IF NOT EXISTS official_status_checks_status_idx
  ON official_status_checks(status);
CREATE INDEX IF NOT EXISTS official_status_checks_checked_idx
  ON official_status_checks(checked_at DESC);

CREATE TABLE IF NOT EXISTS official_application_tracking (
  application_id UUID PRIMARY KEY REFERENCES applications(id) ON DELETE CASCADE,
  applicant_id UUID NOT NULL REFERENCES applicant_profiles(id) ON DELETE CASCADE,
  auth_user_id UUID NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'VN',
  provider TEXT NOT NULL DEFAULT 'vietnam_evisa',
  official_lookup_email TEXT NOT NULL,
  tracking_status TEXT NOT NULL DEFAULT 'active',
  daily_check_hour SMALLINT NOT NULL,
  daily_check_minute SMALLINT NOT NULL,
  next_daily_check_at TIMESTAMPTZ NOT NULL,
  last_daily_check_at TIMESTAMPTZ,
  last_successful_check_at TIMESTAMPTZ,
  last_email_message_id UUID REFERENCES inbound_email(id) ON DELETE SET NULL,
  last_known_status TEXT,
  last_artifact_hash TEXT,
  last_artifact_storage_path TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT official_application_tracking_country_check
    CHECK (country_code = 'VN'),
  CONSTRAINT official_application_tracking_status_check
    CHECK (tracking_status IN ('active', 'completed', 'disabled')),
  CONSTRAINT official_application_tracking_hour_check
    CHECK (daily_check_hour BETWEEN 0 AND 23),
  CONSTRAINT official_application_tracking_minute_check
    CHECK (daily_check_minute BETWEEN 0 AND 59)
);

CREATE INDEX IF NOT EXISTS official_application_tracking_due_idx
  ON official_application_tracking(tracking_status, next_daily_check_at);
CREATE INDEX IF NOT EXISTS official_application_tracking_applicant_idx
  ON official_application_tracking(applicant_id);
CREATE INDEX IF NOT EXISTS official_application_tracking_email_idx
  ON official_application_tracking(lower(official_lookup_email));

ALTER TABLE official_application_tracking ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE official_application_tracking FROM anon, authenticated;
GRANT ALL ON TABLE official_application_tracking TO service_role;

ALTER TABLE official_status_checks
  ADD COLUMN IF NOT EXISTS trigger_source TEXT NOT NULL DEFAULT 'daily',
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS inbound_email_id UUID REFERENCES inbound_email(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS artifact_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS artifact_sha256 TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS official_status_checks_idempotency_idx
  ON official_status_checks(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS official_status_checks_claim_idx
  ON official_status_checks(status, scheduled_for, created_at);

REVOKE ALL ON TABLE official_status_checks FROM anon, authenticated;
GRANT ALL ON TABLE official_status_checks TO service_role;

ALTER TABLE notification_event_log
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS notification_event_log_idempotency_idx
  ON notification_event_log(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION enqueue_due_vn_official_status_checks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  inserted_count INTEGER := 0;
BEGIN
  INSERT INTO official_status_checks (
    application_id,
    user_id,
    country_code,
    provider,
    status,
    requested_by,
    trigger_source,
    idempotency_key,
    scheduled_for,
    raw_status_json,
    created_at,
    updated_at
  )
  SELECT
    tracking.application_id,
    tracking.auth_user_id,
    tracking.country_code,
    tracking.provider,
    'queued',
    'system',
    'daily',
    'vn:daily:' || tracking.application_id::text || ':' ||
      to_char(now() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD'),
    now(),
    jsonb_build_object(
      'source', 'scheduled_daily',
      'vietnam_date', to_char(now() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD')
    ),
    now(),
    now()
  FROM official_application_tracking tracking
  WHERE tracking.tracking_status = 'active'
    AND tracking.next_daily_check_at <= now()
  ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  UPDATE official_application_tracking tracking
  SET
    last_daily_check_at = now(),
    next_daily_check_at = (
      date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh')
      + interval '1 day'
      + make_interval(
          hours => tracking.daily_check_hour,
          mins => tracking.daily_check_minute
        )
    ) AT TIME ZONE 'Asia/Ho_Chi_Minh',
    updated_at = now()
  WHERE tracking.tracking_status = 'active'
    AND tracking.next_daily_check_at <= now();

  RETURN inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION enqueue_due_vn_official_status_checks() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION enqueue_due_vn_official_status_checks() TO service_role;

CREATE OR REPLACE FUNCTION claim_vn_official_status_checks(p_limit INTEGER DEFAULT 5)
RETURNS SETOF official_status_checks
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  UPDATE official_status_checks checks
  SET
    status = 'running',
    started_at = now(),
    attempt_count = checks.attempt_count + 1,
    updated_at = now()
  WHERE checks.id IN (
    SELECT candidate.id
    FROM official_status_checks candidate
    WHERE candidate.country_code = 'VN'
      AND candidate.status = 'queued'
      AND candidate.scheduled_for <= now()
    ORDER BY candidate.scheduled_for ASC, candidate.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT greatest(1, least(coalesce(p_limit, 5), 20))
  )
  RETURNING checks.*;
END;
$$;

REVOKE ALL ON FUNCTION claim_vn_official_status_checks(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_vn_official_status_checks(INTEGER) TO service_role;

DO $$
DECLARE
  existing_job_id BIGINT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    SELECT jobid
    INTO existing_job_id
    FROM cron.job
    WHERE jobname = 'viza-vn-evisa-status-every-15m'
    LIMIT 1;

    IF existing_job_id IS NOT NULL THEN
      PERFORM cron.unschedule(existing_job_id);
    END IF;

    PERFORM cron.schedule(
      'viza-vn-evisa-status-every-15m',
      '*/15 * * * *',
      'SELECT enqueue_due_vn_official_status_checks();'
    );
  END IF;
END
$$;

COMMENT ON TABLE official_application_tracking IS
  'Service-role-only tracking configuration for new official Vietnam e-Visa applications.';
COMMENT ON FUNCTION enqueue_due_vn_official_status_checks() IS
  'Queues at most one daily Vietnam status check per application and Vietnam calendar date.';
COMMENT ON FUNCTION claim_vn_official_status_checks(INTEGER) IS
  'Atomically claims queued Vietnam official status checks using SKIP LOCKED.';
