-- =============================================================================
-- PII access audit log (LEGAL-005)
--
-- Every staff/admin/system read of applicant passport, photo, or form
-- answers appends one row here so we can prove who saw what during an
-- incident. The owning applicant can also request their own log via
-- the LEGAL-004 export endpoint.
--
-- Reads via the canonical helper `auditPiiRead(actor, applicant_id, fields)`
-- in viza-fe/internal-website/lib/legal/audit-pii.ts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS pii_access_log (
  id BIGSERIAL PRIMARY KEY,
  applicant_id UUID NOT NULL REFERENCES applicant_profiles(id) ON DELETE CASCADE,
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  /** auth.uid() of the requesting user when authenticated; null for system. */
  actor_user_id UUID,
  /** Free-form actor identifier — e.g. `actions/user-profile:getProfile`. */
  actor TEXT NOT NULL,
  /** Reason / purpose code, e.g. 'admin_review', 'self_view', 'submission_runner'. */
  purpose TEXT NOT NULL,
  /**
   * Field categories touched. Use a stable vocabulary:
   *   passport, photo, form_answers, contact, address, payment.
   */
  fields TEXT[] NOT NULL,
  ip TEXT,
  ua TEXT,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pii_access_log_applicant_ts
  ON pii_access_log(applicant_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_pii_access_log_actor_user_ts
  ON pii_access_log(actor_user_id, ts DESC);

ALTER TABLE pii_access_log ENABLE ROW LEVEL SECURITY;
-- Owner can SELECT their own rows; service role bypasses RLS for staff
-- views (gated by getCurrentUser().role === 'admin' inside the page).
CREATE POLICY "pii_access_log_select_own"
  ON pii_access_log FOR SELECT
  USING (
    applicant_id IN (
      SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
    )
  );
