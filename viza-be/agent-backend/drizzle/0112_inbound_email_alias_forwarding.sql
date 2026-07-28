-- =============================================================================
-- Applicant alias forwarding state
--
-- The Cloudflare Email Worker stores each original RFC 822 message in R2,
-- forwards it to the applicant's real profile email, and retries transient
-- delivery failures without asking the official portal to resend the OTP or
-- confirmation message.
-- =============================================================================

ALTER TABLE inbound_email
  ADD COLUMN IF NOT EXISTS forwarding_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS forwarded_to TEXT,
  ADD COLUMN IF NOT EXISTS forwarded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS forwarding_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS forwarding_error TEXT;

-- This migration must not replay historical OTP or status mail. New Worker
-- inserts explicitly use `pending`; only rows that predate this migration are
-- changed here.
UPDATE inbound_email
SET
  forwarding_status = 'skipped',
  forwarding_error = 'received before applicant alias forwarding was enabled'
WHERE forwarding_status = 'pending'
  AND forwarding_attempts = 0
  AND forwarded_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_inbound_email_forwarding_pending
  ON inbound_email(received_at ASC)
  WHERE forwarding_status IN ('pending', 'failed')
    AND forwarding_attempts < 5
    AND quarantined = FALSE;
