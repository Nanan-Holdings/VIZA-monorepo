-- =============================================================================
-- Application groups (PRODUCT-002)
--
-- One payer, N applicants under a single Stripe checkout. Each row in
-- `applications` keeps its own applicant_id + status; the group_id ties
-- them together for billing + /home grouping.
-- =============================================================================

CREATE TABLE IF NOT EXISTS application_group (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  /** auth.users.id of the payer (the parent / lead applicant). */
  payer_user_id UUID NOT NULL,
  /** Same package for every applicant in the group at MVP. */
  visa_package_id UUID NOT NULL REFERENCES visa_packages(id) ON DELETE RESTRICT,
  label TEXT,
  stripe_checkout_session_id TEXT,
  total_amount_cents INTEGER,
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_application_group_payer
  ON application_group(payer_user_id, created_at DESC);

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES application_group(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_applications_group ON applications(group_id);

-- Dependant applicants (e.g. minor children) have no auth.users row;
-- they're managed entirely by the payer. This nullable column ties the
-- dependant profile to the payer's auth.users.id so RLS can authorise
-- the payer to read + write the dependant's applications without
-- pretending the dependant has a login.
ALTER TABLE applicant_profiles
  ADD COLUMN IF NOT EXISTS dependant_of_user_id UUID;

CREATE INDEX IF NOT EXISTS idx_applicant_profiles_dependant
  ON applicant_profiles(dependant_of_user_id);

ALTER TABLE application_group ENABLE ROW LEVEL SECURITY;
CREATE POLICY "application_group_select_own"
  ON application_group FOR SELECT
  USING (payer_user_id = auth.uid());
CREATE POLICY "application_group_staff_all"
  ON application_group FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('staff', 'admin')
        AND users.deleted_at IS NULL
    )
  )
  WITH CHECK (TRUE);
