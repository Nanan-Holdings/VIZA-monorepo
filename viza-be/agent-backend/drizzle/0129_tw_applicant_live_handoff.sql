-- Taiwan has no resumable applicant account or durable resume URL. Keep the
-- already-filled official page alive briefly and hand that exact browser
-- session to the owning applicant for the final official click.

ALTER TABLE takeover_session
  ADD COLUMN IF NOT EXISTS handoff_kind TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_takeover_session_application_kind_status
  ON takeover_session(application_id, handoff_kind, status, created_at DESC);

COMMENT ON COLUMN takeover_session.handoff_kind IS
  'Typed handoff purpose. taiwan_applicant_final_submit is exposed only to the owning applicant through the authenticated application API.';

COMMENT ON COLUMN takeover_session.expires_at IS
  'Hard expiry for applicant-visible live browser handoffs.';
