-- =============================================================================
-- Application documents bucket
--
-- Creates the private Supabase Storage bucket used by the applicant portal for
-- passport scans, photos, supporting documents, Travel AI itinerary exports,
-- OCR source files, and staff-reviewed application document records.
--
-- Path convention:
--   {authUserId}/{applicationId}/{documentType}/{filename}
--
-- The authenticated policies below only allow a user to access objects under
-- their own auth-user-id prefix. Service-role clients still bypass RLS for OCR,
-- signed URLs, validation, staff review, retention, and backup workflows.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('application-documents', 'application-documents', false, 52428800)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  public = false,
  file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "application_documents_owner_select" ON storage.objects;
CREATE POLICY "application_documents_owner_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'application-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "application_documents_owner_insert" ON storage.objects;
CREATE POLICY "application_documents_owner_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'application-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "application_documents_owner_update" ON storage.objects;
CREATE POLICY "application_documents_owner_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'application-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'application-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "application_documents_owner_delete" ON storage.objects;
CREATE POLICY "application_documents_owner_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'application-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
