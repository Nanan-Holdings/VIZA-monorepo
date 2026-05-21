-- =============================================================================
-- Notification worker columns + DLQ (NOTIFY-001 / NOTIFY-002 / NOTIFY-003)
-- =============================================================================

ALTER TABLE notification_event_log
  ADD COLUMN IF NOT EXISTS template_key TEXT,
  ADD COLUMN IF NOT EXISTS payload JSONB,
  ADD COLUMN IF NOT EXISTS recipient TEXT,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_notification_event_log_outcome_next
  ON notification_event_log(outcome, next_attempt_at);

CREATE TABLE IF NOT EXISTS notification_dlq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_event_id BIGINT,
  applicant_id UUID,
  application_id UUID,
  template_key TEXT NOT NULL,
  channel TEXT NOT NULL,
  recipient TEXT,
  payload JSONB,
  error TEXT NOT NULL,
  retry_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  replayed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notification_dlq_created
  ON notification_dlq(created_at DESC);

ALTER TABLE notification_dlq ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notification_dlq_select_authenticated"
  ON notification_dlq FOR SELECT
  USING (auth.role() = 'authenticated');
