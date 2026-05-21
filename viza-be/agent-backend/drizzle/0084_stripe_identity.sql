-- =============================================================================
-- Stripe Identity gate (PRODUCT-007)
-- =============================================================================

-- Per-applicant verification session.
CREATE TABLE IF NOT EXISTS stripe_identity_session (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID NOT NULL,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  /** Stripe VerificationSession id (vs_...). */
  session_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'requires_input',
  /** Stripe's last_error.code when verified=false. */
  last_error_code TEXT,
  /** Stripe's last_verification_report.id once verified. */
  last_report_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_identity_session_applicant
  ON stripe_identity_session(applicant_id, created_at DESC);

ALTER TABLE stripe_identity_session ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stripe_identity_session_select_own"
  ON stripe_identity_session FOR SELECT
  USING (
    applicant_id IN (
      SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
    )
  );
CREATE POLICY "stripe_identity_session_staff_all"
  ON stripe_identity_session FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('staff', 'admin')
        AND users.deleted_at IS NULL
    )
  )
  WITH CHECK (TRUE);

-- Per-package gate flag — high-risk packages require Stripe Identity
-- before submission_queue enqueue.
ALTER TABLE visa_packages
  ADD COLUMN IF NOT EXISTS requires_stripe_identity BOOLEAN NOT NULL DEFAULT FALSE;
