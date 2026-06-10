-- DS-160 live-assisted queue compatibility fields.
--
-- This keeps the shared submission_queue shape aligned with the generic
-- live-assisted manual-action/review schema used by the Next.js portal.

ALTER TABLE submission_queue
  ADD COLUMN IF NOT EXISTS official_confirmation_page_url TEXT,
  ADD COLUMN IF NOT EXISTS official_confirmation_pdf_url TEXT;

CREATE TABLE IF NOT EXISTS ds160_live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_queue_id UUID REFERENCES submission_queue(id) ON DELETE CASCADE,
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  user_id UUID,
  official_application_id_encrypted TEXT,
  official_security_question_encrypted TEXT,
  official_security_answer_encrypted TEXT,
  official_confirmation_number_encrypted TEXT,
  official_confirmation_page_url TEXT,
  status TEXT DEFAULT 'created',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ds160_live_sessions_queue_idx
  ON ds160_live_sessions(submission_queue_id);
CREATE INDEX IF NOT EXISTS ds160_live_sessions_application_idx
  ON ds160_live_sessions(application_id);
CREATE INDEX IF NOT EXISTS ds160_live_sessions_status_idx
  ON ds160_live_sessions(status);

COMMENT ON TABLE ds160_live_sessions IS
  'Compatibility live-session table for DS-160 assisted CEAC runs. Stores encrypted official identifiers only.';
