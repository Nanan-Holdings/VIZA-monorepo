-- Optimize the two audited notification/signature ownership policies so the
-- caller identity is evaluated once per statement through a scalar init plan.
-- Policy identities, commands, roles, permissiveness, and ownership semantics
-- remain unchanged.

ALTER POLICY "notification_event_log_select_own"
  ON public.notification_event_log
  USING (
    applicant_id IN (
      SELECT id
      FROM public.applicant_profiles
      WHERE auth_user_id = (select auth.uid())
    )
  );

ALTER POLICY "signature_event_select_own"
  ON public.signature_event
  USING (
    applicant_id IN (
      SELECT id
      FROM public.applicant_profiles
      WHERE auth_user_id = (select auth.uid())
    )
  );
