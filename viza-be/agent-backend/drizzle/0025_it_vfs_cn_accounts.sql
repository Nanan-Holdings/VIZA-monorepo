-- =============================================================================
-- Italy Schengen VFS-CN appointment portal credentials
--
-- Mirrors uk_accounts (0018) and au_accounts (0020) for visa.vfsglobal.com/chn/en/ita.
--
-- Scope clarification: Italy's online flow is APPOINTMENT BOOKING ONLY. The
-- visa application form itself is the paper Schengen Annex I PDF that the
-- applicant prints, signs, and brings to the in-person VFS appointment.
-- submission-service therefore uses these credentials to:
--   (a) book the VFS appointment via the VFS portal
--   (b) drive any pre-appointment web fields the portal exposes
--   (c) generate a pre-filled Annex I PDF artifact for the applicant to print
--
-- Future direction (post-domain provisioning):
--   When VIZA owns a customer domain, every applicant gets an auto-generated
--   alias and a system-generated password; the runner registers the VFS
--   account on their behalf at intake.
--
-- Lifecycle (current):
--   1. Frontend collects (username, password, preferred VFS centre) at the
--      Italy step-0 collector and persists them here, encrypted.
--   2. Worker decrypts at runtime, books the appointment, captures the
--      reference here, and emits the pre-filled Annex I PDF.
-- =============================================================================

CREATE TABLE IF NOT EXISTS it_vfs_cn_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID NOT NULL REFERENCES applicant_profiles(id) ON DELETE CASCADE,
  /** VFS Global username (typically the applicant's email). */
  username TEXT NOT NULL,
  /** Encrypted VFS password (scrypt + AES-GCM via secret-cipher.ts). */
  password_encrypted TEXT NOT NULL,
  /** Preferred VFS application centre (Beijing, Shanghai, Guangzhou, Chongqing, Wuhan, Hangzhou, Jinan, Shenzhen). NULL until chosen. */
  preferred_centre TEXT,
  /** Booking reference returned by VFS after appointment is confirmed. NULL until booked. */
  appointment_reference TEXT,
  /** Scheduled appointment timestamp. NULL until booked. */
  appointment_at TIMESTAMPTZ,
  /** Last captured Playwright storageState (cookies + localStorage). */
  storage_state_json JSONB,
  /** Timestamp of the most recent successful authentication. */
  last_authenticated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (applicant_id, username)
);

CREATE INDEX IF NOT EXISTS idx_it_vfs_cn_accounts_applicant_id ON it_vfs_cn_accounts(applicant_id);

ALTER TABLE it_vfs_cn_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "it_vfs_cn_accounts_select_own"
  ON it_vfs_cn_accounts FOR SELECT
  USING (
    applicant_id IN (
      SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "it_vfs_cn_accounts_insert_own"
  ON it_vfs_cn_accounts FOR INSERT
  WITH CHECK (
    applicant_id IN (
      SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "it_vfs_cn_accounts_update_own"
  ON it_vfs_cn_accounts FOR UPDATE
  USING (
    applicant_id IN (
      SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
    )
  );
