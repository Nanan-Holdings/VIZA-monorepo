-- Private bucket for applicant-uploaded visa documents.
--
-- Frontend upload paths must start with the authenticated user's UUID:
--   {authUserId}/{applicationId}/{documentType}/{filename}
--
-- The service-role admin client bypasses these policies for server-side OCR,
-- signed URL creation, document validation, and staff review workflows.

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
