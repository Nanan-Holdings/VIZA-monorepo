-- =============================================================================
-- Per-package pricing + scraper history (FEES-001 / FEES-002)
-- =============================================================================

CREATE TABLE IF NOT EXISTS package_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visa_package_id UUID NOT NULL REFERENCES visa_packages(id) ON DELETE CASCADE,
  currency TEXT NOT NULL DEFAULT 'USD',
  government_fee_cents INTEGER NOT NULL DEFAULT 0,
  agency_fee_cents INTEGER NOT NULL DEFAULT 0,
  /** When non-null + future-dated, the override is in effect. */
  override_until TIMESTAMPTZ,
  override_reason TEXT,
  /** auth.users.id of the staff member who set the current override. */
  override_by UUID,
  /** Source of the live numbers: 'scraper' | 'staff_override' | 'seed'. */
  source TEXT NOT NULL DEFAULT 'seed',
  scraped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (visa_package_id, currency)
);

CREATE TABLE IF NOT EXISTS package_pricing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visa_package_id UUID NOT NULL,
  currency TEXT NOT NULL,
  government_fee_cents INTEGER NOT NULL,
  agency_fee_cents INTEGER NOT NULL,
  source TEXT NOT NULL,
  changed_by UUID,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_package_pricing_history_pkg
  ON package_pricing_history(visa_package_id, created_at DESC);

ALTER TABLE package_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_pricing_history ENABLE ROW LEVEL SECURITY;

-- Public read on the live pricing rows (consumer-facing pricing page).
CREATE POLICY "package_pricing_select_all" ON package_pricing FOR SELECT USING (TRUE);
-- History is staff-only.
CREATE POLICY "package_pricing_history_select_staff"
  ON package_pricing_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('staff', 'admin')
        AND users.deleted_at IS NULL
    )
  );
