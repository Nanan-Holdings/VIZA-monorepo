-- Optimize the eleven audited core ownership policies so the caller identity is
-- evaluated once per statement through a scalar init plan instead of once per
-- candidate row.
--
-- Production evidence: architecture audit run 32643943531 reported these
-- exact 11 auth_rls_initplan findings. Policy names, commands, roles,
-- permissiveness, and ownership semantics remain unchanged.

ALTER POLICY "applicant_profiles_select_own"
  ON public.applicant_profiles
  USING (auth_user_id = (select auth.uid()));

ALTER POLICY "applicant_profiles_insert_own"
  ON public.applicant_profiles
  WITH CHECK (auth_user_id = (select auth.uid()));

ALTER POLICY "applicant_profiles_update_own"
  ON public.applicant_profiles
  USING (auth_user_id = (select auth.uid()))
  WITH CHECK (auth_user_id = (select auth.uid()));

ALTER POLICY "applications_select_own"
  ON public.applications
  USING (
    applicant_id IN (
      SELECT id
      FROM public.applicant_profiles
      WHERE auth_user_id = (select auth.uid())
    )
  );

ALTER POLICY "applications_insert_own"
  ON public.applications
  WITH CHECK (
    applicant_id IN (
      SELECT id
      FROM public.applicant_profiles
      WHERE auth_user_id = (select auth.uid())
    )
  );

ALTER POLICY "applications_update_own"
  ON public.applications
  USING (
    applicant_id IN (
      SELECT id
      FROM public.applicant_profiles
      WHERE auth_user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    applicant_id IN (
      SELECT id
      FROM public.applicant_profiles
      WHERE auth_user_id = (select auth.uid())
    )
  );

ALTER POLICY "application_documents_select_own"
  ON public.application_documents
  USING (
    application_id IN (
      SELECT a.id
      FROM public.applications AS a
      JOIN public.applicant_profiles AS ap ON ap.id = a.applicant_id
      WHERE ap.auth_user_id = (select auth.uid())
    )
  );

ALTER POLICY "application_documents_insert_own"
  ON public.application_documents
  WITH CHECK (
    application_id IN (
      SELECT a.id
      FROM public.applications AS a
      JOIN public.applicant_profiles AS ap ON ap.id = a.applicant_id
      WHERE ap.auth_user_id = (select auth.uid())
    )
  );

ALTER POLICY "application_documents_update_own"
  ON public.application_documents
  USING (
    application_id IN (
      SELECT a.id
      FROM public.applications AS a
      JOIN public.applicant_profiles AS ap ON ap.id = a.applicant_id
      WHERE ap.auth_user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    application_id IN (
      SELECT a.id
      FROM public.applications AS a
      JOIN public.applicant_profiles AS ap ON ap.id = a.applicant_id
      WHERE ap.auth_user_id = (select auth.uid())
    )
  );

ALTER POLICY "application_documents_delete_own"
  ON public.application_documents
  USING (
    application_id IN (
      SELECT a.id
      FROM public.applications AS a
      JOIN public.applicant_profiles AS ap ON ap.id = a.applicant_id
      WHERE ap.auth_user_id = (select auth.uid())
    )
  );

ALTER POLICY "submission_queue_insert_own"
  ON public.submission_queue
  WITH CHECK (
    application_id IN (
      SELECT a.id
      FROM public.applications AS a
      JOIN public.applicant_profiles AS ap ON ap.id = a.applicant_id
      WHERE ap.auth_user_id = (select auth.uid())
    )
  );
