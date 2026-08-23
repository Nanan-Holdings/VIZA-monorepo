-- Evaluate the authenticated user id once per statement in both authorization
-- paths of the account-action audit-log SELECT policy. Policy identity, roles,
-- RLS state, relation ACLs, and row-visibility semantics remain unchanged.

DO $migration$
DECLARE
  v_policy_oid oid;
  v_relation_acl pg_catalog.aclitem[];
BEGIN
  SELECT policy.oid, relation.relacl
  INTO STRICT v_policy_oid, v_relation_acl
  FROM pg_catalog.pg_policy policy
  JOIN pg_catalog.pg_class relation ON relation.oid = policy.polrelid
  JOIN pg_catalog.pg_namespace schema_ref ON schema_ref.oid = relation.relnamespace
  WHERE schema_ref.nspname = 'public'
    AND relation.relname = 'account_action_log'
    AND policy.polname = 'account_action_log_select_own';

  EXECUTE $policy$
    ALTER POLICY "account_action_log_select_own"
      ON public.account_action_log
      USING (
        user_id = (select auth.uid())
        OR applicant_id IN (
          SELECT id
          FROM public.applicant_profiles
          WHERE auth_user_id = (select auth.uid())
        )
      )
  $policy$;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policy policy
    WHERE policy.oid = v_policy_oid
      AND policy.polrelid = 'public.account_action_log'::pg_catalog.regclass
      AND policy.polname = 'account_action_log_select_own'
  ) THEN
    RAISE EXCEPTION 'account_action_log_select_own policy identity changed during optimization';
  END IF;

  IF (
    SELECT relation.relacl
    FROM pg_catalog.pg_class relation
    WHERE relation.oid = 'public.account_action_log'::pg_catalog.regclass
  ) IS DISTINCT FROM v_relation_acl THEN
    RAISE EXCEPTION 'account_action_log ACL changed during policy optimization';
  END IF;
END
$migration$;
