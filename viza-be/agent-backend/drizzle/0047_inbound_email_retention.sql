-- =============================================================================
-- Inbound mail retention + quarantine policy (INBOX-007)
--
-- 1. `quarantined` flag on inbound_email — set by the worker when the
--    Cloudflare-provided spam score exceeds the configured threshold,
--    or when the worker rejects a message but still wants forensic
--    visibility (kept hidden from the applicant inbox view).
-- 2. `inbox_alias_retired_at` on applicant_profiles — when an alias is
--    retired, the worker drops further messages with a 5xx so the
--    sender retries / bounces; existing rows are kept until purge.
-- 3. SQL function `purge_old_inbound_email(retention_days int)` — runs
--    via cron (daily) and deletes rows older than the configured
--    retention horizon (default 180 days). Returning the count makes
--    the cron job's output legible.
-- =============================================================================

ALTER TABLE inbound_email
  ADD COLUMN IF NOT EXISTS quarantined BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE inbound_email
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE applicant_profiles
  ADD COLUMN IF NOT EXISTS inbox_alias_retired_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_inbound_email_quarantined
  ON inbound_email(received_at DESC) WHERE quarantined = TRUE;

-- Hide quarantined rows from the per-applicant SELECT policy that was
-- created by 0046. Drop + recreate is the safest path; a parallel
-- `_quarantined` policy would surprise admins later.
DROP POLICY IF EXISTS "inbound_email_select_owning_applicant" ON inbound_email;
CREATE POLICY "inbound_email_select_owning_applicant"
  ON inbound_email FOR SELECT
  USING (
    quarantined = FALSE
    AND LOWER(to_addr) IN (
      SELECT LOWER(inbox_alias)
      FROM applicant_profiles
      WHERE auth_user_id = auth.uid()
        AND inbox_alias IS NOT NULL
        AND inbox_alias_retired_at IS NULL
    )
  );

CREATE OR REPLACE FUNCTION purge_old_inbound_email(retention_days INTEGER)
  RETURNS INTEGER
  LANGUAGE plpgsql
AS $$
DECLARE
  cutoff TIMESTAMPTZ := NOW() - MAKE_INTERVAL(days => retention_days);
  rows_deleted INTEGER;
BEGIN
  DELETE FROM inbound_email
  WHERE received_at < cutoff;
  GET DIAGNOSTICS rows_deleted = ROW_COUNT;
  RETURN rows_deleted;
END;
$$;
