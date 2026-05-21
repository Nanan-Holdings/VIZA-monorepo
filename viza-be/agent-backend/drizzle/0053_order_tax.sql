-- =============================================================================
-- Tax fields on order (PAY-006)
--
-- Stripe Tax computes the tax amount during checkout; we mirror it on
-- the order so receipts + invoices surface the line independently of
-- the Stripe API. Stored separately from agency / govt fees so unit
-- economics queries don't have to reverse-engineer it.
-- =============================================================================

ALTER TABLE "order"
  ADD COLUMN IF NOT EXISTS tax_amount_cents INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "order"
  ADD COLUMN IF NOT EXISTS tax_country TEXT;

ALTER TABLE "order"
  ADD COLUMN IF NOT EXISTS tax_rate_basis_points INTEGER;
