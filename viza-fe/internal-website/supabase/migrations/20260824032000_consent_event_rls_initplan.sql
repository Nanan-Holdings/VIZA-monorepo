-- Reconcile the historical consent_event policy ownership split using the
-- production catalog as authority. Metadata-only architecture audit run
-- 32660875895 confirmed that production uses the two-path Drizzle policy with
-- normalized using-expression SHA-256
-- 91d4d5f1bd65562b9581892c345fa0b60d0dc1aa398f0b271e86338385060ac8.
-- Evaluate the authenticated user id once per statement in both authorization
-- paths. Policy identity, roles, RLS state, relation ACLs, and row visibility
-- semantics remain unchanged.

DO $migration$
DECLARE
  v_policy_oid oid;
  v_relation_acl pg_catalog.aclitem[];
  v_policy_using_sha256 text;
BEGIN
  SELECT policy.oid,
    relation.relacl,
    pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
      pg_catalog.regexp_replace(pg_catalog.pg_get_expr(
        policy.polqual, policy.polrelid
      ), '\s+', '', 'g'), 'UTF8'
    )), 'hex')
  INTO STRICT v_policy_oid, v_relation_acl, v_policy_using_sha256
  FROM pg_catalog.pg_policy policy
  JOIN pg_catalog.pg_class relation ON relation.oid = policy.polrelid
  JOIN pg_catalog.pg_namespace schema_ref ON schema_ref.oid = relation.relnamespace
  WHERE schema_ref.nspname = 'public'
    AND relation.relname = 'consent_event'
    AND policy.polname = 'consent_event_select_own';

  IF v_policy_using_sha256 IS DISTINCT FROM
    '91d4d5f1bd65562b9581892c345fa0b60d0dc1aa398f0b271e86338385060ac8'
  THEN
    RAISE EXCEPTION 'consent_event_select_own policy drifted before optimization';
  END IF;

  EXECUTE $policy$
    ALTER POLICY "consent_event_select_own"
      ON public.consent_event
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
      AND policy.polrelid = 'public.consent_event'::pg_catalog.regclass
      AND policy.polname = 'consent_event_select_own'
      AND pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
        pg_catalog.regexp_replace(pg_catalog.pg_get_expr(
          policy.polqual, policy.polrelid
        ), '\s+', '', 'g'), 'UTF8'
      )), 'hex') =
        '71f1513bd40970f7d84c85ec82450b575df8915148b67210085a056186962975'
  ) THEN
    RAISE EXCEPTION 'consent_event_select_own policy identity or contract changed during optimization';
  END IF;

  IF (
    SELECT relation.relacl
    FROM pg_catalog.pg_class relation
    WHERE relation.oid = 'public.consent_event'::pg_catalog.regclass
  ) IS DISTINCT FROM v_relation_acl THEN
    RAISE EXCEPTION 'consent_event ACL changed during policy optimization';
  END IF;
END
$migration$;
