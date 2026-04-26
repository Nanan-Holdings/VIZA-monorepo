-- =============================================================================
-- Submission results — user-facing per-country result payload
--
-- Adds three columns to applications:
--   - submission_result            JSONB    canonical SubmissionResult payload
--                                           (discriminated union, country-keyed)
--   - submission_result_status     TEXT     waiting | processing | submitted |
--                                           stopped_at_pay | failed
--   - submission_result_updated_at TIMESTAMPTZ
--
-- Why on `applications` (and not on `submission_queue`):
--   - The frontend `/application` page already subscribes to realtime UPDATEs
--     on `applications` (page.tsx:1015–1036). Reusing that channel avoids new
--     socket plumbing.
--   - submission_queue is operator-internal (per-country *_result_payload
--     columns kept there for operator diagnostics). The applications-level
--     payload is the user-facing canonical surface.
--
-- Also defensively adds ceac_result_payload to submission_queue. This column
-- is referenced by submission-service runtime code (src/index.ts:539, 560,
-- 609, 641) and by submission-service/src/types.ts but no prior migration
-- creates it — it must have been added via Supabase dashboard out-of-band.
-- IF NOT EXISTS makes this a no-op when already present.
-- =============================================================================

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS submission_result JSONB,
  ADD COLUMN IF NOT EXISTS submission_result_status TEXT,
  ADD COLUMN IF NOT EXISTS submission_result_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN applications.submission_result IS
  'Canonical SubmissionResult payload (discriminated union by country: US|FR|UK|VN). User-facing.';
COMMENT ON COLUMN applications.submission_result_status IS
  'High-level submission status: waiting | processing | submitted | stopped_at_pay | failed.';

CREATE INDEX IF NOT EXISTS idx_applications_submission_result_status
  ON applications(submission_result_status)
  WHERE submission_result_status IS NOT NULL;

ALTER TABLE submission_queue
  ADD COLUMN IF NOT EXISTS ceac_result_payload JSONB;

COMMENT ON COLUMN submission_queue.ceac_result_payload IS
  'CeacRunResult JSON payload (operator diagnostics, parallel to fv_result_payload / uk_result_payload).';
