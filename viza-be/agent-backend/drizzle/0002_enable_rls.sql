-- VIZA RLS Migration
-- Enable Row Level Security on all visa application tables
--
-- Context: Supabase Security Advisor flagged 8 tables with RLS disabled.
-- All backend services (agent-backend, submission-service) use SUPABASE_SERVICE_ROLE_KEY
-- which bypasses RLS. These policies protect data when accessed via the anon key
-- (frontend client portal).

-- =============================================================================
-- 1. APPLICANT PROFILES
-- Users own their profile via auth_user_id = auth.uid()
-- =============================================================================

ALTER TABLE applicant_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "applicant_profiles_select_own"
  ON applicant_profiles FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

CREATE POLICY "applicant_profiles_insert_own"
  ON applicant_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "applicant_profiles_update_own"
  ON applicant_profiles FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- =============================================================================
-- 2. APPLICATIONS
-- Users own applications via applicant_id -> applicant_profiles.auth_user_id
-- =============================================================================

ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "applications_select_own"
  ON applications FOR SELECT
  TO authenticated
  USING (
    applicant_id IN (
      SELECT id FROM applicant_profiles
      WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "applications_insert_own"
  ON applications FOR INSERT
  TO authenticated
  WITH CHECK (
    applicant_id IN (
      SELECT id FROM applicant_profiles
      WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "applications_update_own"
  ON applications FOR UPDATE
  TO authenticated
  USING (
    applicant_id IN (
      SELECT id FROM applicant_profiles
      WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    applicant_id IN (
      SELECT id FROM applicant_profiles
      WHERE auth_user_id = auth.uid()
    )
  );

-- =============================================================================
-- 3. APPLICATION DOCUMENTS
-- Cascade: application_id -> applications -> applicant_profiles
-- =============================================================================

ALTER TABLE application_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "application_documents_select_own"
  ON application_documents FOR SELECT
  TO authenticated
  USING (
    application_id IN (
      SELECT a.id FROM applications a
      JOIN applicant_profiles ap ON ap.id = a.applicant_id
      WHERE ap.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "application_documents_insert_own"
  ON application_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    application_id IN (
      SELECT a.id FROM applications a
      JOIN applicant_profiles ap ON ap.id = a.applicant_id
      WHERE ap.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "application_documents_update_own"
  ON application_documents FOR UPDATE
  TO authenticated
  USING (
    application_id IN (
      SELECT a.id FROM applications a
      JOIN applicant_profiles ap ON ap.id = a.applicant_id
      WHERE ap.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    application_id IN (
      SELECT a.id FROM applications a
      JOIN applicant_profiles ap ON ap.id = a.applicant_id
      WHERE ap.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "application_documents_delete_own"
  ON application_documents FOR DELETE
  TO authenticated
  USING (
    application_id IN (
      SELECT a.id FROM applications a
      JOIN applicant_profiles ap ON ap.id = a.applicant_id
      WHERE ap.auth_user_id = auth.uid()
    )
  );

-- =============================================================================
-- 4. SUBMISSION QUEUE
-- Users can only INSERT (to submit their own application).
-- All other operations are service-role only (backend processing).
-- =============================================================================

ALTER TABLE submission_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "submission_queue_insert_own"
  ON submission_queue FOR INSERT
  TO authenticated
  WITH CHECK (
    application_id IN (
      SELECT a.id FROM applications a
      JOIN applicant_profiles ap ON ap.id = a.applicant_id
      WHERE ap.auth_user_id = auth.uid()
    )
  );

-- =============================================================================
-- 5. VISA CHAT SESSIONS
-- Users own sessions via applicant_id -> applicant_profiles.auth_user_id
-- =============================================================================

ALTER TABLE visa_chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visa_chat_sessions_select_own"
  ON visa_chat_sessions FOR SELECT
  TO authenticated
  USING (
    applicant_id IN (
      SELECT id FROM applicant_profiles
      WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "visa_chat_sessions_insert_own"
  ON visa_chat_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    applicant_id IN (
      SELECT id FROM applicant_profiles
      WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "visa_chat_sessions_update_own"
  ON visa_chat_sessions FOR UPDATE
  TO authenticated
  USING (
    applicant_id IN (
      SELECT id FROM applicant_profiles
      WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    applicant_id IN (
      SELECT id FROM applicant_profiles
      WHERE auth_user_id = auth.uid()
    )
  );

-- =============================================================================
-- 6. VISA CHAT MESSAGES
-- Cascade: session_id -> visa_chat_sessions -> applicant_profiles
-- =============================================================================

ALTER TABLE visa_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visa_chat_messages_select_own"
  ON visa_chat_messages FOR SELECT
  TO authenticated
  USING (
    session_id IN (
      SELECT vcs.id FROM visa_chat_sessions vcs
      JOIN applicant_profiles ap ON ap.id = vcs.applicant_id
      WHERE ap.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "visa_chat_messages_insert_own"
  ON visa_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    session_id IN (
      SELECT vcs.id FROM visa_chat_sessions vcs
      JOIN applicant_profiles ap ON ap.id = vcs.applicant_id
      WHERE ap.auth_user_id = auth.uid()
    )
  );

-- =============================================================================
-- 7. VISA DOCUMENTS
-- Public knowledge base: all authenticated users can read.
-- Writes are service-role only (no INSERT/UPDATE/DELETE policy needed).
-- =============================================================================

ALTER TABLE visa_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visa_documents_read_all"
  ON visa_documents FOR SELECT
  TO authenticated
  USING (true);

-- =============================================================================
-- 8. VISA CHUNKS
-- Public knowledge base: all authenticated users can read.
-- Writes are service-role only (no INSERT/UPDATE/DELETE policy needed).
-- =============================================================================

ALTER TABLE visa_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visa_chunks_read_all"
  ON visa_chunks FOR SELECT
  TO authenticated
  USING (true);
