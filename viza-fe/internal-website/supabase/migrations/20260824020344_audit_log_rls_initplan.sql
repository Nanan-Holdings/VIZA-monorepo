-- Evaluate the authenticated user id once per statement for two applicant-owned
-- audit-log policies. Policy names, commands, roles, RLS state, relation ACLs,
-- and row-visibility semantics remain unchanged.

ALTER POLICY "secret_access_log_select_own"
  ON public.secret_access_log
  USING (
    applicant_id IN (
      SELECT id
      FROM public.applicant_profiles
      WHERE auth_user_id = (select auth.uid())
    )
  );

ALTER POLICY "pii_access_log_select_own"
  ON public.pii_access_log
  USING (
    applicant_id IN (
      SELECT id
      FROM public.applicant_profiles
      WHERE auth_user_id = (select auth.uid())
    )
  );
