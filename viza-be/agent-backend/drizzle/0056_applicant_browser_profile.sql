-- =============================================================================
-- Per-applicant browser fingerprint persistence (INFRA-005)
--
-- Each applicant gets one stable fingerprint reused across runs so a
-- portal that fingerprints (canvas / WebGL / fonts / timezone) does
-- not see a different "person" every time we reconnect.
-- =============================================================================

CREATE TABLE IF NOT EXISTS applicant_browser_profile (
  applicant_id UUID PRIMARY KEY REFERENCES applicant_profiles(id) ON DELETE CASCADE,
  /**
   * Stable fingerprint payload — see
   * viza-be/submission-service/src/browser/profile.ts for the shape.
   * Populated on first runner job; never overwritten silently.
   */
  fingerprint_json JSONB NOT NULL,
  /** Optional Playwright storageState (cookies + localStorage). */
  storage_state_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE applicant_browser_profile ENABLE ROW LEVEL SECURITY;
-- Service role only.
