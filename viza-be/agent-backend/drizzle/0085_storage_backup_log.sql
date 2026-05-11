-- =============================================================================
-- Storage backup log (OBS-004)
--
-- Nightly off-site copy of the application-documents bucket. One row per
-- backup attempt. /admin/storage-backups reads from here.
-- =============================================================================

CREATE TABLE IF NOT EXISTS storage_backup_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket TEXT NOT NULL,
  target TEXT NOT NULL,
  status TEXT NOT NULL,
  bytes BIGINT,
  object_count INTEGER,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  error TEXT,
  /** Quarterly drill = TRUE marks the row as a verified restore test. */
  is_drill BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_storage_backup_log_started
  ON storage_backup_log(bucket, started_at DESC);

ALTER TABLE storage_backup_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "storage_backup_log_staff_only"
  ON storage_backup_log FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('staff', 'admin')
        AND users.deleted_at IS NULL
    )
  )
  WITH CHECK (TRUE);
