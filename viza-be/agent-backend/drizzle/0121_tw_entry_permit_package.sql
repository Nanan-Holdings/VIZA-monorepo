-- Add standalone Taiwan Online Entry Permit package.
-- "旅居海外大陸地區人民申請來臺觀光入境許可" — mainland Chinese nationals residing
-- abroad or in Hong Kong/Macau applying online for a Taiwan tourism entry
-- permit via the National Immigration Agency's coa.immigration.gov.tw portal.
--
-- Distinct from Malaysia MDAC / Thailand TDAC arrival cards: this is a real
-- reviewed application (NIA approves/rejects), not an instant free arrival
-- notification. Payment (NT$600 single-entry / NT$1,000 one-year multiple)
-- happens in a separate later session after approval — out of scope here.
--
-- Companion seed script: scripts/seed-tw-entry-permit-form-fields.ts
-- No persistent account table (see docs/tw-entry-permit-auto-submit-plan.md
-- "架构修正" — the official portal has no cross-day account/resume model, so
-- unlike uk_accounts/fv_accounts this package needs no accounts table).

INSERT INTO visa_packages (country, visa_type, name, description) VALUES
  (
    'taiwan',
    'TW_ENTRY_PERMIT',
    'Taiwan Online Entry Permit (Overseas Mainland Chinese Tourism)',
    'Online application for mainland Chinese nationals residing abroad or in Hong Kong/Macau applying to enter Taiwan for tourism, submitted via the National Immigration Agency''s coa.immigration.gov.tw portal. This package collects eligibility category, applicant identity/passport, Taiwan contact address, kinship, and declaration details. Out of scope: CAPTCHA solving, final submission, review/approval tracking, and the post-approval online payment (NT$600 single-entry / NT$1,000 one-year multiple), which remain applicant-controlled.'
  )
ON CONFLICT DO NOTHING;
