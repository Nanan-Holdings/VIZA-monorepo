-- =============================================================================
-- Refund requests + Stripe dispute handling (PRODUCT-001)
-- =============================================================================

CREATE TABLE IF NOT EXISTS refund_request (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID NOT NULL,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  /** Stripe charge / payment intent we want to refund against. */
  stripe_payment_intent_id TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  reason TEXT NOT NULL,
  /** 'requested' | 'approved' | 'denied' | 'refunded' | 'disputed' */
  status TEXT NOT NULL DEFAULT 'requested',
  staff_note TEXT,
  decided_by UUID,
  decided_at TIMESTAMPTZ,
  stripe_refund_id TEXT,
  stripe_dispute_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refund_request_applicant
  ON refund_request(applicant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_refund_request_status
  ON refund_request(status, created_at);

ALTER TABLE refund_request ENABLE ROW LEVEL SECURITY;

CREATE POLICY "refund_request_select_own"
  ON refund_request FOR SELECT
  USING (
    applicant_id IN (
      SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "refund_request_insert_own"
  ON refund_request FOR INSERT
  WITH CHECK (
    applicant_id IN (
      SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "refund_request_staff_all"
  ON refund_request FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('staff', 'admin')
        AND users.deleted_at IS NULL
    )
  )
  WITH CHECK (TRUE);
