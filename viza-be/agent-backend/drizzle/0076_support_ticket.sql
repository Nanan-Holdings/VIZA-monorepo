-- =============================================================================
-- Support tickets + messages (SUPPORT-001 / SUPPORT-002)
-- =============================================================================

CREATE TABLE IF NOT EXISTS support_ticket (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID NOT NULL,
  application_id UUID,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_applicant
  ON support_ticket(applicant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS support_message (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_ticket(id) ON DELETE CASCADE,
  /** 'applicant' | 'staff' */
  author_kind TEXT NOT NULL,
  author_id UUID,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_message_ticket
  ON support_message(ticket_id, created_at ASC);

ALTER TABLE support_ticket ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_message ENABLE ROW LEVEL SECURITY;

-- Applicant sees own tickets
CREATE POLICY "support_ticket_select_own"
  ON support_ticket FOR SELECT
  USING (
    applicant_id IN (
      SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
    )
  );
CREATE POLICY "support_ticket_insert_own"
  ON support_ticket FOR INSERT
  WITH CHECK (
    applicant_id IN (
      SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
    )
  );

-- Staff/admin see and update everything
CREATE POLICY "support_ticket_staff_all"
  ON support_ticket FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('staff', 'admin')
        AND users.deleted_at IS NULL
    )
  )
  WITH CHECK (TRUE);

-- Applicants see messages on their own tickets
CREATE POLICY "support_message_select_own"
  ON support_message FOR SELECT
  USING (
    ticket_id IN (
      SELECT id FROM support_ticket WHERE applicant_id IN (
        SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
      )
    )
  );
CREATE POLICY "support_message_insert_own"
  ON support_message FOR INSERT
  WITH CHECK (
    ticket_id IN (
      SELECT id FROM support_ticket WHERE applicant_id IN (
        SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
      )
    )
  );
CREATE POLICY "support_message_staff_all"
  ON support_message FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('staff', 'admin')
        AND users.deleted_at IS NULL
    )
  )
  WITH CHECK (TRUE);
