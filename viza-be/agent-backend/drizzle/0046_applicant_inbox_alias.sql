-- =============================================================================
-- Per-applicant inbox alias (INBOX-003)
--
-- Each applicant gets a stable `appl-{ulid}@haggstorm.com` address. Aliases
-- are stored lowercased on the profile so the join with
-- `inbound_email.to_addr` (also lowercased by the worker) is exact.
-- =============================================================================

ALTER TABLE applicant_profiles
  ADD COLUMN IF NOT EXISTS inbox_alias TEXT;

-- One alias per applicant, case-insensitive uniqueness across the table.
CREATE UNIQUE INDEX IF NOT EXISTS uq_applicant_profiles_inbox_alias_lower
  ON applicant_profiles(LOWER(inbox_alias));

-- Open inbound_email reads to the owning applicant. Worker still writes via
-- service role (no INSERT policy needed — service role bypasses RLS).
CREATE POLICY "inbound_email_select_owning_applicant"
  ON inbound_email FOR SELECT
  USING (
    LOWER(to_addr) IN (
      SELECT LOWER(inbox_alias)
      FROM applicant_profiles
      WHERE auth_user_id = auth.uid()
        AND inbox_alias IS NOT NULL
    )
  );
