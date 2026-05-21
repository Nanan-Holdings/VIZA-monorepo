-- =============================================================================
-- Submission artifacts bucket
--
-- Creates a single private Supabase Storage bucket for per-country runner
-- output (DS-160 .dat, France-Visas CERFA PDF, future Vietnam screenshots,
-- etc.). Path convention enforced by submission-service code:
--
--   {authUserId}/{applicationId}/{countryCode}/{kind}-{utcMillis}.{ext}
--
-- Why one bucket, partitioned by user prefix:
--   - Path-prefix RLS gives per-user isolation for free
--     (storage.foldername(name)[1] = auth.uid()::text).
--   - Adding new artifact kinds is zero-schema-change.
--   - Result payloads store the path; the agent-backend mints fresh
--     1-hour signed URLs on demand via /api/applications/:id/artifact-url.
--
-- The submission-service uses the service-role key, so writes bypass RLS.
-- The policies below cover ONLY frontend reads via signed URLs minted by
-- the user-scoped path.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('submission-artifacts', 'submission-artifacts', false)
ON CONFLICT (id) DO NOTHING;

-- Owner-only SELECT — the auth uid is the first path segment.
DROP POLICY IF EXISTS "submission_artifacts_owner_select" ON storage.objects;
CREATE POLICY "submission_artifacts_owner_select"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'submission-artifacts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Service-role bypasses these; this matters for:
--   - The agent-backend artifact-url endpoint that calls
--     storage.from('submission-artifacts').createSignedUrl(path, ttl).
--     The service-role client (getSupabaseClient) bypasses RLS but the
--     resulting signed URL is itself a capability — anyone with the URL
--     can fetch the object until it expires (1h TTL by default).
--   - Any future user-scoped client read by path.
