-- Optimize the single audited user-package ownership policy so the caller
-- identity is evaluated once per statement through a scalar init plan. Policy
-- identity, command, role, permissiveness, and ownership semantics remain
-- unchanged.

ALTER POLICY "user_packages_select"
  ON public.user_packages
  USING ((select auth.uid()) = auth_user_id);
