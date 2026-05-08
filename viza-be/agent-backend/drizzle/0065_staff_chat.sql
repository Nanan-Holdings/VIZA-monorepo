-- =============================================================================
-- Applicant ↔ staff chat thread (CS-001)
--
-- Sits alongside the existing Companion sessions (visa_chat_sessions /
-- _messages) which are AI-only. This table tracks human-handoff
-- threads so /admin/chat can render a queue and route a staff member
-- to the right applicant. Realtime updates ride Supabase
-- postgres_changes — the existing /visa Socket.IO namespace stays
-- focused on the Companion stream.
-- =============================================================================

CREATE TABLE IF NOT EXISTS staff_chat_thread (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID NOT NULL REFERENCES applicant_profiles(id) ON DELETE CASCADE,
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  /** queued | active | resolved */
  status TEXT NOT NULL DEFAULT 'queued',
  /** Free-form context surfaced to the on-deck staff member. */
  applicant_context TEXT,
  assigned_to UUID,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_chat_thread_status_last
  ON staff_chat_thread(status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_chat_thread_applicant
  ON staff_chat_thread(applicant_id);

CREATE TABLE IF NOT EXISTS staff_chat_message (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES staff_chat_thread(id) ON DELETE CASCADE,
  /** applicant | staff | system */
  sender_role TEXT NOT NULL,
  sender_user_id UUID,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_chat_message_thread_created
  ON staff_chat_message(thread_id, created_at);

ALTER TABLE staff_chat_thread ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_chat_message ENABLE ROW LEVEL SECURITY;

-- Owning applicant can SELECT their own threads + messages.
CREATE POLICY "staff_chat_thread_select_own"
  ON staff_chat_thread FOR SELECT
  USING (
    applicant_id IN (
      SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "staff_chat_message_select_own"
  ON staff_chat_message FOR SELECT
  USING (
    thread_id IN (
      SELECT id FROM staff_chat_thread
       WHERE applicant_id IN (
         SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
       )
    )
  );
