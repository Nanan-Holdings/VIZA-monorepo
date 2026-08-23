-- Evaluate the authenticated user id once per statement in both authorization
-- paths of the account-action audit-log SELECT policy. Policy identity, roles,
-- RLS state, relation ACLs, and row-visibility semantics remain unchanged.

ALTER POLICY "account_action_log_select_own"
  ON public.account_action_log
  USING (
    user_id = (select auth.uid())
    OR applicant_id IN (
      SELECT id
      FROM public.applicant_profiles
      WHERE auth_user_id = (select auth.uid())
    )
  );
