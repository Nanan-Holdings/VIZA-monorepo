-- =============================================================================
-- Per-applicant notification preferences (CS-002)
--
-- Six discrete transition events. Three are "essential" — paid,
-- runner_input_needed, decision_issued — and cannot be silenced
-- (transactional). The rest can be opted out individually. Marketing
-- is opt-in (default off).
-- =============================================================================

CREATE TABLE IF NOT EXISTS notification_preferences (
  applicant_id UUID PRIMARY KEY REFERENCES applicant_profiles(id) ON DELETE CASCADE,
  channel_email BOOLEAN NOT NULL DEFAULT TRUE,
  channel_push BOOLEAN NOT NULL DEFAULT FALSE,
  /** Transition opt-outs (essential events ignore these flags). */
  notify_runner_started BOOLEAN NOT NULL DEFAULT TRUE,
  notify_runner_stopped_for_input BOOLEAN NOT NULL DEFAULT TRUE,
  notify_submitted BOOLEAN NOT NULL DEFAULT TRUE,
  notify_document_ready BOOLEAN NOT NULL DEFAULT TRUE,
  notify_marketing BOOLEAN NOT NULL DEFAULT FALSE,
  /** Optional Expo / OneSignal push token. */
  push_token TEXT,
  push_provider TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notification_preferences_select_own"
  ON notification_preferences FOR SELECT
  USING (
    applicant_id IN (
      SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
    )
  );
CREATE POLICY "notification_preferences_upsert_own"
  ON notification_preferences FOR ALL
  USING (
    applicant_id IN (
      SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    applicant_id IN (
      SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS notification_event_log (
  id BIGSERIAL PRIMARY KEY,
  applicant_id UUID NOT NULL REFERENCES applicant_profiles(id) ON DELETE CASCADE,
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  /** paid | runner_started | runner_input_needed | submitted | decision_issued | doc_ready */
  event TEXT NOT NULL,
  /** Channel actually delivered on (email / push / suppressed). */
  channel TEXT NOT NULL,
  /** Resend/Expo message id when applicable. */
  external_id TEXT,
  outcome TEXT NOT NULL DEFAULT 'sent',
  error TEXT,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_event_log_applicant_ts
  ON notification_event_log(applicant_id, ts DESC);

ALTER TABLE notification_event_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notification_event_log_select_own"
  ON notification_event_log FOR SELECT
  USING (
    applicant_id IN (
      SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
    )
  );
