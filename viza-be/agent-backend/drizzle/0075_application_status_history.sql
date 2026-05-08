-- =============================================================================
-- application_status_history (STATUS-002)
--
-- Append-only log of every applications.status transition. Source of
-- truth for the /home and /application[id] timelines.
-- =============================================================================

CREATE TABLE IF NOT EXISTS application_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  /** auth.users.id of the actor (applicant, staff, or system). */
  actor_id UUID,
  /** 'applicant' | 'staff' | 'system' (e.g. runner). */
  actor_kind TEXT NOT NULL DEFAULT 'system',
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_application_status_history_app_ts
  ON application_status_history (application_id, created_at DESC);

ALTER TABLE application_status_history ENABLE ROW LEVEL SECURITY;

-- Applicants see their own history.
CREATE POLICY "ash_select_own"
  ON application_status_history FOR SELECT
  USING (
    application_id IN (
      SELECT id FROM applications WHERE applicant_id IN (
        SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
      )
    )
  );

-- Staff/admin see everything.
CREATE POLICY "ash_select_staff"
  ON application_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('staff', 'admin')
        AND users.deleted_at IS NULL
    )
  );
