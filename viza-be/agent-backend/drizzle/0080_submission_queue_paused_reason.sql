-- =============================================================================
-- submission_queue.paused_reason (FIX-004)
--
-- When face-match flips decision != auto_approve the runner is paused
-- alongside applications.status='staff_action_required'. Capturing the
-- reason here lets /admin/cs explain why a job is held without joining
-- back to face_match_audit.
-- =============================================================================

ALTER TABLE submission_queue
  ADD COLUMN IF NOT EXISTS paused_reason TEXT;
