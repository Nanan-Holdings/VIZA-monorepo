-- =============================================================================
-- Orders + line items (PAY-001)
--
-- Separates the agency fee (VIZA), the government fee (destination
-- country) and any third-party costs (captcha solves, proxy spend) so
-- revenue and unit economics are auditable per application.
--
-- One `order` per application × payment cycle. Line items break the
-- amount into kinds (`agency`, `govt`, `third_party_*`) with per-line
-- payee + currency.
-- =============================================================================

CREATE TABLE IF NOT EXISTS "order" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  applicant_id UUID NOT NULL REFERENCES applicant_profiles(id) ON DELETE CASCADE,
  /** Aggregated VIZA fee in minor units (cents). */
  agency_fee_cents INTEGER NOT NULL DEFAULT 0,
  /** Pass-through destination-country fee in minor units. */
  govt_fee_cents INTEGER NOT NULL DEFAULT 0,
  /** ISO 4217 currency code (USD default; override per package). */
  currency TEXT NOT NULL DEFAULT 'USD',
  /**
   * Lifecycle: draft → pending → paid → submitted → completed
   *                     ↘ refunded ↙
   *                     ↘ cancelled
   */
  status TEXT NOT NULL DEFAULT 'draft',
  /** Stripe Checkout / PaymentIntent ids when present. */
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  /** Counter-party metadata (e.g. portal payment receipt id). */
  metadata JSONB,
  paid_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_applicant_status
  ON "order"(applicant_id, status);
CREATE INDEX IF NOT EXISTS idx_order_application
  ON "order"(application_id);
CREATE INDEX IF NOT EXISTS idx_order_status_created
  ON "order"(status, created_at DESC);

ALTER TABLE "order" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_select_own"
  ON "order" FOR SELECT
  USING (
    applicant_id IN (
      SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS order_line (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES "order"(id) ON DELETE CASCADE,
  /** agency | govt | third_party_captcha | third_party_proxy | refund */
  kind TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  /** Counter-party that receives the funds (or 'VIZA' for the agency fee). */
  payee TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_line_order
  ON order_line(order_id);

ALTER TABLE order_line ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_line_select_own"
  ON order_line FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM "order" WHERE applicant_id IN (
        SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
      )
    )
  );
