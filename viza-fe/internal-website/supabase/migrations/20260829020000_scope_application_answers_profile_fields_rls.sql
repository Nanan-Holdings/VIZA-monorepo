-- =============================================================================
-- Fix cross-tenant PII leak: scope RLS SELECT policies to the owning applicant
-- -----------------------------------------------------------------------------
-- Two tables created in the drizzle chain
-- (viza-be/agent-backend/drizzle/0007_application_answers_and_profile_fields.sql)
-- shipped with `FOR SELECT TO authenticated USING (true)`:
--
--   * visa_application_answers  — dynamic visa form answers (passport numbers,
--     dates of birth, travel history) for EVERY applicant.
--   * shared_profile_fields     — per-applicant reusable profile completeness.
--
-- With `USING (true)` any authenticated user could call PostgREST directly
-- (GET /rest/v1/visa_application_answers with their own access token) and read
-- every other applicant's answers across all tenants. This migration replaces
-- those permissive SELECT policies with ownership-scoped policies, matching the
-- InitPlan convention used by the other *_rls_initplan migrations
-- (`(select auth.uid())` is evaluated once per statement).
--
-- Writes are unchanged: only the service_role policy grants writes, so the
-- backend (service role) continues to insert/update on behalf of applicants.
-- This migration is idempotent and safe to re-run.
-- =============================================================================

-- visa_application_answers: owner can read only their own applications' answers
DROP POLICY IF EXISTS "visa_application_answers_select" ON public.visa_application_answers;

CREATE POLICY "visa_application_answers_select" ON public.visa_application_answers
  FOR SELECT
  TO authenticated
  USING (
    application_id IN (
      SELECT a.id
      FROM public.applications a
      JOIN public.applicant_profiles p ON p.id = a.applicant_id
      WHERE p.auth_user_id = (select auth.uid())
    )
  );

-- shared_profile_fields: owner can read only their own profile rows
DROP POLICY IF EXISTS "shared_profile_fields_select" ON public.shared_profile_fields;

CREATE POLICY "shared_profile_fields_select" ON public.shared_profile_fields
  FOR SELECT
  TO authenticated
  USING (
    applicant_id IN (
      SELECT p.id
      FROM public.applicant_profiles p
      WHERE p.auth_user_id = (select auth.uid())
    )
  );

-- Note: the pre-existing service_role FOR ALL policies on both tables are left
-- intact so backend service-role writes/reads are unaffected.
