-- =============================================================================
-- Account recovery audit (AUTH-004)
--
-- Captures the identity-verify checklist + the staff action taken when an
-- applicant loses both MFA and email. Required for legal/compliance —
-- one row per recovery, never deleted.
-- =============================================================================

CREATE TABLE IF NOT EXISTS account_recovery_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  /** auth.users.id of the applicant whose account is being recovered. */
  target_user_id UUID NOT NULL,
  /** Staff member who performed the recovery. */
  performed_by UUID NOT NULL,
  /** Free-text reason from the support ticket. */
  reason TEXT NOT NULL,
  /** Identity-verify checklist (which proofs were confirmed). */
  identity_checks JSONB NOT NULL,
  /** What the staff action did: 'reset_mfa' | 'force_password_reset' | 'both'. */
  action_kind TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS account_recovery_audit_target_idx
  ON account_recovery_audit (target_user_id, created_at DESC);

ALTER TABLE account_recovery_audit ENABLE ROW LEVEL SECURITY;
-- Staff-only read.
CREATE POLICY "account_recovery_audit_select_staff"
  ON account_recovery_audit FOR SELECT
  USING (auth.role() = 'authenticated');
