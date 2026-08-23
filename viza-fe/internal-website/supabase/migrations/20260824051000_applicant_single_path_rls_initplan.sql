-- Preserve four production-confirmed, single-path applicant ownership policies
-- while evaluating auth.uid() once per statement through an InitPlan.
--
-- Production evidence: metadata-only architecture audit run 32665595556 and a
-- follow-up read-only catalog query against project oyjxdzsoejraedqghndi.
-- Policy OIDs, commands, PUBLIC roles, permissiveness, RLS state, relation ACLs,
-- policy counts, and row visibility semantics must remain unchanged.

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
    AND relation.relname = 'applicant_secret'
    AND relation.relkind = 'r';

  IF v_rls_enabled IS DISTINCT FROM true
    OR v_rls_forced IS DISTINCT FROM false
    OR v_policy_count IS DISTINCT FROM 1
  THEN
    RAISE EXCEPTION 'applicant_secret RLS state or policy count drifted before optimization';
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
    AND policy.polname = 'applicant_secret_select_own';

  IF v_policy_command IS DISTINCT FROM 'r'
    OR v_policy_permissive IS DISTINCT FROM true
    OR v_policy_roles IS DISTINCT FROM ARRAY[0]::oid[]
    OR v_using_sha256 IS DISTINCT FROM
      '25b1a1fe79d4578daaa9ce3a895db3195c732290aa4290acac2e212ea1967fad'
    OR v_check_sha256 IS NOT NULL
  THEN
    RAISE EXCEPTION 'applicant_secret_select_own policy drifted before optimization';
  END IF;

  EXECUTE $policy$
    ALTER POLICY "applicant_secret_select_own"
      ON public.applicant_secret
      USING (
        applicant_id IN (
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
      AND policy.polrelid = v_relation_oid
      AND policy.polname = 'applicant_secret_select_own'
      AND policy.polcmd = 'r'
      AND policy.polpermissive
      AND policy.polroles = ARRAY[0]::oid[]
      AND policy.polwithcheck IS NULL
      AND pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
        pg_catalog.regexp_replace(pg_catalog.pg_get_expr(
          policy.polqual, policy.polrelid
        ), '\s+', '', 'g'), 'UTF8'
      )), 'hex') =
        'f4e3e33d2585cbb579e477f7f118f0b5b80ac10bea6a0dbb5fa875089f38aa86'
  ) THEN
    RAISE EXCEPTION 'applicant_secret_select_own policy identity or contract changed during optimization';
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
    RAISE EXCEPTION 'applicant_secret ACL, RLS state, or policy count drifted during optimization';
  END IF;
END
$migration$;

DO $migration$
DECLARE
  v_relation_oid oid;
  v_relation_acl pg_catalog.aclitem[];
  v_rls_enabled boolean;
  v_rls_forced boolean;
  v_policy_count integer;
  v_policy_oid oid;
  v_upsert_policy_oid oid;
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
    AND relation.relname = 'notification_preferences'
    AND relation.relkind = 'r';

  IF v_rls_enabled IS DISTINCT FROM true
    OR v_rls_forced IS DISTINCT FROM false
    OR v_policy_count IS DISTINCT FROM 2
  THEN
    RAISE EXCEPTION 'notification_preferences RLS state or policy count drifted before optimization';
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
    AND policy.polname = 'notification_preferences_select_own';

  IF v_policy_command IS DISTINCT FROM 'r'
    OR v_policy_permissive IS DISTINCT FROM true
    OR v_policy_roles IS DISTINCT FROM ARRAY[0]::oid[]
    OR v_using_sha256 IS DISTINCT FROM
      '25b1a1fe79d4578daaa9ce3a895db3195c732290aa4290acac2e212ea1967fad'
    OR v_check_sha256 IS NOT NULL
  THEN
    RAISE EXCEPTION 'notification_preferences_select_own policy drifted before optimization';
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
    v_upsert_policy_oid,
    v_policy_command,
    v_policy_permissive,
    v_policy_roles,
    v_using_sha256,
    v_check_sha256
  FROM pg_catalog.pg_policy policy
  WHERE policy.polrelid = v_relation_oid
    AND policy.polname = 'notification_preferences_upsert_own';

  IF v_policy_command IS DISTINCT FROM '*'
    OR v_policy_permissive IS DISTINCT FROM true
    OR v_policy_roles IS DISTINCT FROM ARRAY[0]::oid[]
    OR v_using_sha256 IS DISTINCT FROM
      '25b1a1fe79d4578daaa9ce3a895db3195c732290aa4290acac2e212ea1967fad'
    OR v_check_sha256 IS DISTINCT FROM
      '25b1a1fe79d4578daaa9ce3a895db3195c732290aa4290acac2e212ea1967fad'
  THEN
    RAISE EXCEPTION 'notification_preferences_upsert_own policy drifted before optimization';
  END IF;

  EXECUTE $policy$
    ALTER POLICY "notification_preferences_select_own"
      ON public.notification_preferences
      USING (
        applicant_id IN (
          SELECT id
          FROM public.applicant_profiles
          WHERE auth_user_id = (select auth.uid())
        )
      )
  $policy$;

  EXECUTE $policy$
    ALTER POLICY "notification_preferences_upsert_own"
      ON public.notification_preferences
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
      )
  $policy$;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policy policy
    WHERE policy.oid = v_policy_oid
      AND policy.polrelid = v_relation_oid
      AND policy.polname = 'notification_preferences_select_own'
      AND policy.polcmd = 'r'
      AND policy.polpermissive
      AND policy.polroles = ARRAY[0]::oid[]
      AND policy.polwithcheck IS NULL
      AND pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
        pg_catalog.regexp_replace(pg_catalog.pg_get_expr(
          policy.polqual, policy.polrelid
        ), '\s+', '', 'g'), 'UTF8'
      )), 'hex') =
        'f4e3e33d2585cbb579e477f7f118f0b5b80ac10bea6a0dbb5fa875089f38aa86'
  ) THEN
    RAISE EXCEPTION 'notification_preferences_select_own policy identity or contract changed during optimization';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policy policy
    WHERE policy.oid = v_upsert_policy_oid
      AND policy.polrelid = v_relation_oid
      AND policy.polname = 'notification_preferences_upsert_own'
      AND policy.polcmd = '*'
      AND policy.polpermissive
      AND policy.polroles = ARRAY[0]::oid[]
      AND pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
        pg_catalog.regexp_replace(pg_catalog.pg_get_expr(
          policy.polqual, policy.polrelid
        ), '\s+', '', 'g'), 'UTF8'
      )), 'hex') =
        'f4e3e33d2585cbb579e477f7f118f0b5b80ac10bea6a0dbb5fa875089f38aa86'
      AND pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
        pg_catalog.regexp_replace(pg_catalog.pg_get_expr(
          policy.polwithcheck, policy.polrelid
        ), '\s+', '', 'g'), 'UTF8'
      )), 'hex') =
        'f4e3e33d2585cbb579e477f7f118f0b5b80ac10bea6a0dbb5fa875089f38aa86'
  ) THEN
    RAISE EXCEPTION 'notification_preferences_upsert_own policy identity or contract changed during optimization';
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
    RAISE EXCEPTION 'notification_preferences ACL, RLS state, or policy count drifted during optimization';
  END IF;
END
$migration$;

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
    AND relation.relname = 'staff_chat_thread'
    AND relation.relkind = 'r';

  IF v_rls_enabled IS DISTINCT FROM true
    OR v_rls_forced IS DISTINCT FROM false
    OR v_policy_count IS DISTINCT FROM 1
  THEN
    RAISE EXCEPTION 'staff_chat_thread RLS state or policy count drifted before optimization';
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
    AND policy.polname = 'staff_chat_thread_select_own';

  IF v_policy_command IS DISTINCT FROM 'r'
    OR v_policy_permissive IS DISTINCT FROM true
    OR v_policy_roles IS DISTINCT FROM ARRAY[0]::oid[]
    OR v_using_sha256 IS DISTINCT FROM
      '25b1a1fe79d4578daaa9ce3a895db3195c732290aa4290acac2e212ea1967fad'
    OR v_check_sha256 IS NOT NULL
  THEN
    RAISE EXCEPTION 'staff_chat_thread_select_own policy drifted before optimization';
  END IF;

  EXECUTE $policy$
    ALTER POLICY "staff_chat_thread_select_own"
      ON public.staff_chat_thread
      USING (
        applicant_id IN (
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
      AND policy.polrelid = v_relation_oid
      AND policy.polname = 'staff_chat_thread_select_own'
      AND policy.polcmd = 'r'
      AND policy.polpermissive
      AND policy.polroles = ARRAY[0]::oid[]
      AND policy.polwithcheck IS NULL
      AND pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
        pg_catalog.regexp_replace(pg_catalog.pg_get_expr(
          policy.polqual, policy.polrelid
        ), '\s+', '', 'g'), 'UTF8'
      )), 'hex') =
        'f4e3e33d2585cbb579e477f7f118f0b5b80ac10bea6a0dbb5fa875089f38aa86'
  ) THEN
    RAISE EXCEPTION 'staff_chat_thread_select_own policy identity or contract changed during optimization';
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
    RAISE EXCEPTION 'staff_chat_thread ACL, RLS state, or policy count drifted during optimization';
  END IF;
END
$migration$;
