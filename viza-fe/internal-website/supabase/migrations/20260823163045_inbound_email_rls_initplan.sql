-- Optimize the audited applicant inbox ownership policy so the caller
-- identity is evaluated once per statement through a scalar init plan.
-- Policy identity, command, role, permissiveness, quarantine handling, alias
-- retirement handling, and service-role behavior remain unchanged.

ALTER POLICY "inbound_email_select_owning_applicant"
  ON public.inbound_email
  USING (
    quarantined = FALSE
    AND LOWER(to_addr) IN (
      SELECT LOWER(inbox_alias)
      FROM public.applicant_profiles
      WHERE auth_user_id = (select auth.uid())
        AND inbox_alias IS NOT NULL
        AND inbox_alias_retired_at IS NULL
    )
  );
