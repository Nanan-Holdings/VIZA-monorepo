-- Preserve the production-confirmed supporting-document ownership policy while
-- evaluating auth.uid() once per statement through an InitPlan.
--
-- Production evidence: metadata-only architecture audit run 32667974276 and
-- the matching read-only catalog contract for project oyjxdzsoejraedqghndi.
-- Policy/relation OIDs, command, PUBLIC role, permissiveness, RLS state,
-- relation ACL, policy count, and row visibility must remain unchanged.

DO $migration$
DECLARE
  v_relation_oid oid;
  v_relation_acl pg_catalog.aclitem[];
  v_rls_enabled boolean;
  v_rls_forced boolean;
  v_policy_count integer;
  v_policy_oid oid;
  v_policy_command "char";
  v_policy_permissive boolean;
  v_policy_roles oid[];
  v_using_sha256 text;
  v_check_sha256 text;
BEGIN
  SELECT relation.oid,
    relation.relacl,
    relation.relrowsecurity,
    relation.relforcerowsecurity,
    (
      SELECT pg_catalog.count(*)::integer
      FROM pg_catalog.pg_policy sibling
      WHERE sibling.polrelid = relation.oid
    )
  INTO STRICT
    v_relation_oid,
    v_relation_acl,
    v_rls_enabled,
    v_rls_forced,
    v_policy_count
  FROM pg_catalog.pg_class relation
  JOIN pg_catalog.pg_namespace schema_ref ON schema_ref.oid = relation.relnamespace
  WHERE schema_ref.nspname = 'public'
    AND relation.relname = 'supporting_doc_submission'
    AND relation.relkind = 'r';

  IF v_rls_enabled IS DISTINCT FROM true
    OR v_rls_forced IS DISTINCT FROM false
    OR v_policy_count IS DISTINCT FROM 1
  THEN
    RAISE EXCEPTION 'supporting_doc_submission RLS state or policy count drifted before optimization';
  END IF;

  SELECT policy.oid,
    policy.polcmd,
    policy.polpermissive,
    policy.polroles,
    pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
      pg_catalog.regexp_replace(pg_catalog.pg_get_expr(
        policy.polqual, policy.polrelid
      ), '\s+', '', 'g'), 'UTF8'
    )), 'hex'),
    pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
      pg_catalog.regexp_replace(pg_catalog.pg_get_expr(
        policy.polwithcheck, policy.polrelid
      ), '\s+', '', 'g'), 'UTF8'
    )), 'hex')
  INTO STRICT
    v_policy_oid,
    v_policy_command,
    v_policy_permissive,
    v_policy_roles,
    v_using_sha256,
    v_check_sha256
  FROM pg_catalog.pg_policy policy
  WHERE policy.polrelid = v_relation_oid
    AND policy.polname = 'supporting_doc_submission_select_own';

  IF v_policy_command IS DISTINCT FROM 'r'
    OR v_policy_permissive IS DISTINCT FROM true
    OR v_policy_roles IS DISTINCT FROM ARRAY[0]::oid[]
    OR v_using_sha256 IS DISTINCT FROM
      '0c1f144a5f4ed2d63e7cbe75cbdee0a425444763f84353d8dde8fb9a7a3ad6d4'
    OR v_check_sha256 IS NOT NULL
  THEN
    RAISE EXCEPTION 'supporting_doc_submission_select_own policy drifted before optimization';
  END IF;

  EXECUTE $policy$
    ALTER POLICY "supporting_doc_submission_select_own"
      ON public.supporting_doc_submission
      USING (
        application_id IN (
          SELECT a.id
          FROM public.applications a
          JOIN public.applicant_profiles p ON p.id = a.applicant_id
          WHERE p.auth_user_id = (select auth.uid())
        )
      )
  $policy$;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policy policy
    WHERE policy.oid = v_policy_oid
      AND policy.polrelid = v_relation_oid
      AND policy.polname = 'supporting_doc_submission_select_own'
      AND policy.polcmd = 'r'
      AND policy.polpermissive
      AND policy.polroles = ARRAY[0]::oid[]
      AND policy.polwithcheck IS NULL
      AND pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
        pg_catalog.regexp_replace(pg_catalog.pg_get_expr(
          policy.polqual, policy.polrelid
        ), '\s+', '', 'g'), 'UTF8'
      )), 'hex') =
        '8c0df2ed0556d31617abbdee9ca003d8346949fafa4e18a3a49f94fa98f4e7f5'
  ) THEN
    RAISE EXCEPTION 'supporting_doc_submission_select_own policy identity or contract changed during optimization';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class relation
    WHERE relation.oid = v_relation_oid
      AND relation.relacl IS NOT DISTINCT FROM v_relation_acl
      AND relation.relrowsecurity IS NOT DISTINCT FROM v_rls_enabled
      AND relation.relforcerowsecurity IS NOT DISTINCT FROM v_rls_forced
      AND (
        SELECT pg_catalog.count(*)::integer
        FROM pg_catalog.pg_policy sibling
        WHERE sibling.polrelid = relation.oid
      ) = v_policy_count
  ) THEN
    RAISE EXCEPTION 'supporting_doc_submission ACL, RLS state, or policy count drifted during optimization';
  END IF;
END
$migration$;
