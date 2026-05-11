-- =============================================================================
-- /admin/cs surface tables (PRODUCT-003 / PRODUCT-004 / PRODUCT-005 / PRODUCT-006)
-- =============================================================================

-- support_ticket.assigned_to + first_response_at
ALTER TABLE support_ticket
  ADD COLUMN IF NOT EXISTS assigned_to UUID,
  ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_due_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_support_ticket_assigned_status
  ON support_ticket(assigned_to, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_ticket_sla_due
  ON support_ticket(sla_due_at) WHERE first_response_at IS NULL;

-- PRODUCT-004 canned replies
CREATE TABLE IF NOT EXISTS support_macro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_macro_country
  ON support_macro(country, locale, is_active);

ALTER TABLE support_macro ENABLE ROW LEVEL SECURITY;
CREATE POLICY "support_macro_staff_all"
  ON support_macro FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('staff', 'admin')
        AND users.deleted_at IS NULL
    )
  )
  WITH CHECK (TRUE);

-- PRODUCT-005 staff-only internal notes
CREATE TABLE IF NOT EXISTS support_internal_note (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_ticket(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_internal_note_ticket
  ON support_internal_note(ticket_id, created_at ASC);

ALTER TABLE support_internal_note ENABLE ROW LEVEL SECURITY;
CREATE POLICY "support_internal_note_staff_only"
  ON support_internal_note FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('staff', 'admin')
        AND users.deleted_at IS NULL
    )
  )
  WITH CHECK (TRUE);
