import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const PRODUCTION_PROJECT_REF = "oyjxdzsoejraedqghndi";
export const APPROVED_MIGRATION_SOURCE_REF = "c4fbff410b958b2ff7e8b2e3f945061a9c33bd4e";
export const STABLE_SPEED_MIGRATION_SOURCE_REF = "9278267c5440b1727e04cf4bf5e5b72128457a1d";
export const SUPABASE_PRODUCTION_CA_URL =
  "https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt";
export const SUPABASE_PRODUCTION_CA_SHA256 =
  "700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7";
export const APPROVED_MIGRATIONS = [
  {
    version: "20260816160000",
    name: "concurrency_phase_two",
    path: "viza-fe/internal-website/supabase/migrations/20260816160000_concurrency_phase_two.sql",
    sha256: "9fa7ef4fec051a3a86dae041c0e51e61a17bd3c9aa5cfdaab44f6da6a97c6c00",
  },
  {
    version: "20260816161000",
    name: "vietnam_status_settlement_fence",
    path: "viza-fe/internal-website/supabase/migrations/20260816161000_vietnam_status_settlement_fence.sql",
    sha256: "146406a8238b036d900b0d976eb4c8405534742d54831d8514fc6f82cf5f760c",
  },
];
export const STABLE_SPEED_MIGRATION = {
  version: "20260820152526",
  name: "concurrency_stable_speed",
  path: "viza-fe/internal-website/supabase/migrations/20260820152526_concurrency_stable_speed.sql",
  sha256: "83e981efc32257a266ebebd3d744605afb1ecd43a01ebbd5efe6dcc30a4da841",
};
export const APPROVED_BATCH_MANIFEST_URL = new URL(
  "./database-architecture/approved-migration-batches.json",
  import.meta.url,
);

const TAIWAN_CAP = {
  country: "taiwan",
  max_concurrent: 1,
  notes: "Shared pool: Taiwan entry-permit applicant handoff",
};

const STABLE_SPEED_CAPS = new Map([
  ["malaysia", 2],
  ["singapore", 1],
  ["south_korea", 1],
  ["taiwan", 1],
  ["thailand", 2],
  ["vietnam", 2],
]);

export const EXPECTED_CAP_SNAPSHOT = [
  {
    country: "malaysia",
    max_concurrent: 2,
    paused: false,
    notes: "Shared pool: Malaysia MDAC",
  },
  {
    country: "singapore",
    max_concurrent: 1,
    paused: false,
    notes: "Shared pool: ICA SG Arrival Card",
  },
  {
    country: "south_korea",
    max_concurrent: 1,
    paused: false,
    notes: "Shared pool: Korea background e-Form preparation",
  },
  {
    country: "thailand",
    max_concurrent: 2,
    paused: false,
    notes: "Shared pool: Thailand TDAC",
  },
  {
    country: "vietnam",
    max_concurrent: 2,
    paused: false,
    notes: "Shared pool: Vietnam eVisa and pre-arrival sessions",
  },
];

export const PREFLIGHT_SQL = `
WITH
runner_counts AS (
  SELECT
    COUNT(*) FILTER (WHERE status = 'running')::INTEGER AS running,
    COUNT(*) FILTER (WHERE status = 'queued')::INTEGER AS queued
  FROM public.runner_job
),
legacy_counts AS (
  SELECT
    COUNT(*) FILTER (
      WHERE status = 'processing'
         OR status LIKE '%_processing'
         OR locked_until > pg_catalog.clock_timestamp()
    )::INTEGER AS processing_or_live_locked
  FROM public.submission_queue
),
vn_counts AS (
  SELECT
    COUNT(*) FILTER (
      WHERE country_code = 'VN' AND status = 'running'
    )::INTEGER AS running
  FROM public.official_status_checks
),
slot_counts AS (
  SELECT
    COUNT(*) FILTER (
      WHERE owner_machine_id IS NOT NULL
        AND lease_until > pg_catalog.clock_timestamp()
    )::INTEGER AS live
  FROM public.runner_machine_slot
),
cap_snapshot AS (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'country', country,
        'max_concurrent', max_concurrent,
        'paused', paused,
        'notes', notes
      ) ORDER BY country
    ),
    '[]'::jsonb
  ) AS value
  FROM public.runner_concurrency_cap
  WHERE country = ANY (
    ARRAY['vietnam','singapore','malaysia','thailand','south_korea','taiwan']::text[]
  )
),
cron_snapshot AS (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'jobid', jobid,
        'jobname', jobname,
        'schedule', schedule,
        'command', command,
        'active', active
      ) ORDER BY jobid
    ),
    '[]'::jsonb
  ) AS value
  FROM cron.job
  WHERE jobname = 'viza-vn-evisa-status-every-15m'
),
migration_snapshot AS (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('version', version, 'name', name)
      ORDER BY version
    ),
    '[]'::jsonb
  ) AS value
  FROM supabase_migrations.schema_migrations
  WHERE version >= '20260801000000'
),
ledger_columns AS (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'column', column_name,
        'type', data_type,
        'nullable', is_nullable,
        'default', column_default
      ) ORDER BY ordinal_position
    ),
    '[]'::jsonb
  ) AS value
  FROM information_schema.columns
  WHERE table_schema = 'supabase_migrations'
    AND table_name = 'schema_migrations'
)
SELECT jsonb_build_object(
  'database', current_database(),
  'database_user', current_user,
  'environment_marker', current_setting('app.viza_environment', true),
  'project_ref_marker', current_setting('app.viza_project_ref', true),
  'runner_jobs', jsonb_build_object(
    'running', runner_counts.running,
    'queued', runner_counts.queued
  ),
  'legacy_processing_or_live_locked', legacy_counts.processing_or_live_locked,
  'vn_status_running', vn_counts.running,
  'live_machine_slots', slot_counts.live,
  'caps', cap_snapshot.value,
  'vn_status_cron', cron_snapshot.value,
  'recent_migrations', migration_snapshot.value,
  'migration_ledger_columns', ledger_columns.value,
  'strict_objects', jsonb_build_object(
    'runner_private_schema', to_regnamespace('runner_private') IS NOT NULL,
    'load_claim_rpc', to_regprocedure(
      'public.claim_runner_pool_load_test_job(text,uuid,text,integer,boolean)'
    ) IS NOT NULL,
    'vn_generation_claim_rpc', to_regprocedure(
      'public.claim_vn_official_status_checks(text,integer,integer)'
    ) IS NOT NULL,
    'vn_lease_generation_column', EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'official_status_checks'
        AND column_name = 'lease_generation'
    ),
    'stable_slot_renew_rpc', to_regprocedure(
      'public.renew_runner_machine_slot(text,text,integer)'
    ) IS NOT NULL,
    'stable_pool_health_view', to_regclass(
      'public.runner_pool_concurrency_health'
    ) IS NOT NULL,
    'stable_slot_health_view', to_regclass(
      'public.runner_slot_capacity_health'
    ) IS NOT NULL,
    'stable_metric_table', to_regclass(
      'public.runner_concurrency_metric'
    ) IS NOT NULL,
    'stable_acl_ok', COALESCE(
      has_function_privilege(
        'service_role',
        to_regprocedure('public.renew_runner_machine_slot(text,text,integer)'),
        'EXECUTE'
      )
      AND NOT has_function_privilege(
        'anon',
        to_regprocedure('public.renew_runner_machine_slot(text,text,integer)'),
        'EXECUTE'
      )
      AND has_table_privilege(
        'service_role', to_regclass('public.runner_pool_concurrency_health'), 'SELECT'
      )
      AND has_table_privilege(
        'service_role', to_regclass('public.runner_slot_capacity_health'), 'SELECT'
      )
      AND has_table_privilege(
        'service_role', to_regclass('public.runner_concurrency_metric'), 'SELECT,INSERT'
      )
      AND NOT has_table_privilege(
        'anon', to_regclass('public.runner_concurrency_metric'), 'SELECT,INSERT'
      ),
      FALSE
    )
  )
) AS maintenance_state
FROM runner_counts, legacy_counts, vn_counts, slot_counts,
     cap_snapshot, cron_snapshot, migration_snapshot, ledger_columns;
`;

export const ARCHITECTURE_AUDIT_SQL = `
SELECT jsonb_build_object(
  'schema_version', 1,
  'source', 'supabase-management-api-read-only',
  'sanitization_schema', 'viza-architecture-audit-metadata-only-v2',
  'database', current_database(),
  'database_user', current_user,
  'environment_marker', current_setting('app.viza_environment', true),
  'project_ref_marker', current_setting('app.viza_project_ref', true),
  'tables', (
    SELECT jsonb_build_object(
      'total', COUNT(*)::INTEGER,
      'rls_enabled', COUNT(*) FILTER (WHERE c.relrowsecurity)::INTEGER,
      'rls_forced', COUNT(*) FILTER (WHERE c.relforcerowsecurity)::INTEGER,
      'rls_disabled', COALESCE(
        jsonb_agg(c.relname ORDER BY c.relname) FILTER (WHERE NOT c.relrowsecurity),
        '[]'::jsonb
      )
    )
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
  ),
  'acl', (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'role', grants.grantee,
          'privilege', grants.privilege_type,
          'tables', grants.table_count
        ) ORDER BY grants.grantee, grants.privilege_type
      ),
      '[]'::jsonb
    )
    FROM (
      SELECT grantee, privilege_type, COUNT(DISTINCT table_name)::INTEGER AS table_count
      FROM information_schema.role_table_grants
      WHERE table_schema = 'public'
        AND grantee IN ('PUBLIC', 'anon', 'authenticated', 'service_role')
      GROUP BY grantee, privilege_type
    ) grants
  ),
  'relation_acl', (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'schema', namespace.nspname,
          'name', relation.relname,
          'kind', CASE relation.relkind
            WHEN 'r' THEN 'table'
            WHEN 'p' THEN 'partitioned_table'
            WHEN 'v' THEN 'view'
            WHEN 'm' THEN 'materialized_view'
            WHEN 'f' THEN 'foreign_table'
            ELSE relation.relkind::text
          END,
          'owner', owner_role.rolname,
          'rls_enabled', relation.relrowsecurity,
          'rls_forced', relation.relforcerowsecurity,
          'grants', COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'role', CASE WHEN relation_acl.grantee = 0
                  THEN 'PUBLIC' ELSE grantee_role.rolname END,
                'privilege', relation_acl.privilege_type,
                'grantable', relation_acl.is_grantable
              ) ORDER BY relation_acl.grantee, relation_acl.privilege_type
            )
            FROM pg_catalog.aclexplode(
              COALESCE(relation.relacl, pg_catalog.acldefault('r', relation.relowner))
            ) relation_acl
            LEFT JOIN pg_catalog.pg_roles grantee_role
              ON grantee_role.oid = relation_acl.grantee
          ), '[]'::jsonb)
        ) ORDER BY namespace.nspname, relation.relname
      ),
      '[]'::jsonb
    )
    FROM pg_catalog.pg_class relation
    JOIN pg_catalog.pg_namespace namespace ON namespace.oid = relation.relnamespace
    JOIN pg_catalog.pg_roles owner_role ON owner_role.oid = relation.relowner
    WHERE namespace.nspname IN ('public', 'runner_private')
      AND relation.relkind IN ('r', 'p', 'v', 'm', 'f')
  ),
  'sequence_acl', (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'schema', namespace.nspname,
          'name', sequence.relname,
          'owner', owner_role.rolname,
          'grants', COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'role', CASE WHEN sequence_acl.grantee = 0
                  THEN 'PUBLIC' ELSE grantee_role.rolname END,
                'privilege', sequence_acl.privilege_type,
                'grantable', sequence_acl.is_grantable
              ) ORDER BY sequence_acl.grantee, sequence_acl.privilege_type
            )
            FROM pg_catalog.aclexplode(
              COALESCE(sequence.relacl, pg_catalog.acldefault('S', sequence.relowner))
            ) sequence_acl
            LEFT JOIN pg_catalog.pg_roles grantee_role
              ON grantee_role.oid = sequence_acl.grantee
          ), '[]'::jsonb)
        ) ORDER BY namespace.nspname, sequence.relname
      ),
      '[]'::jsonb
    )
    FROM pg_catalog.pg_class sequence
    JOIN pg_catalog.pg_namespace namespace ON namespace.oid = sequence.relnamespace
    JOIN pg_catalog.pg_roles owner_role ON owner_role.oid = sequence.relowner
    WHERE namespace.nspname IN ('public', 'runner_private')
      AND sequence.relkind = 'S'
  ),
  'schema_acl', (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'schema', namespace.nspname,
          'owner', owner_role.rolname,
          'grants', COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'role', CASE WHEN schema_acl.grantee = 0
                  THEN 'PUBLIC' ELSE grantee_role.rolname END,
                'privilege', schema_acl.privilege_type,
                'grantable', schema_acl.is_grantable
              ) ORDER BY schema_acl.grantee, schema_acl.privilege_type
            )
            FROM pg_catalog.aclexplode(
              COALESCE(namespace.nspacl, pg_catalog.acldefault('n', namespace.nspowner))
            ) schema_acl
            LEFT JOIN pg_catalog.pg_roles grantee_role ON grantee_role.oid = schema_acl.grantee
          ), '[]'::jsonb)
        ) ORDER BY namespace.nspname
      ),
      '[]'::jsonb
    )
    FROM pg_catalog.pg_namespace namespace
    JOIN pg_catalog.pg_roles owner_role ON owner_role.oid = namespace.nspowner
    WHERE namespace.nspname IN ('public', 'runner_private')
  ),
  'routine_acl', (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'schema', namespace.nspname,
          'name', routine.proname,
          'identity_arguments', pg_catalog.pg_get_function_identity_arguments(routine.oid),
          'kind', CASE routine.prokind WHEN 'p' THEN 'procedure' ELSE 'function' END,
          'owner', owner_role.rolname,
          'security_definer', routine.prosecdef,
          'search_path', COALESCE(routine.proconfig, ARRAY[]::text[]),
          'grants', COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'role', CASE WHEN routine_acl.grantee = 0
                  THEN 'PUBLIC' ELSE grantee_role.rolname END,
                'privilege', routine_acl.privilege_type,
                'grantable', routine_acl.is_grantable
              ) ORDER BY routine_acl.grantee, routine_acl.privilege_type
            )
            FROM pg_catalog.aclexplode(
              COALESCE(routine.proacl, pg_catalog.acldefault('f', routine.proowner))
            ) routine_acl
            LEFT JOIN pg_catalog.pg_roles grantee_role ON grantee_role.oid = routine_acl.grantee
          ), '[]'::jsonb)
        ) ORDER BY namespace.nspname, routine.proname,
          pg_catalog.pg_get_function_identity_arguments(routine.oid)
      ),
      '[]'::jsonb
    )
    FROM pg_catalog.pg_proc routine
    JOIN pg_catalog.pg_namespace namespace ON namespace.oid = routine.pronamespace
    JOIN pg_catalog.pg_roles owner_role ON owner_role.oid = routine.proowner
    WHERE namespace.nspname IN ('public', 'runner_private')
      AND routine.prokind IN ('f', 'p')
  ),
  'default_acl', (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'owner', owner_role.rolname,
          'schema', COALESCE(namespace.nspname, '*'),
          'object_type', default_acl.defaclobjtype::text,
          'role', CASE WHEN acl_entry.grantee = 0 THEN 'PUBLIC' ELSE grantee_role.rolname END,
          'privilege', acl_entry.privilege_type,
          'grantable', acl_entry.is_grantable
        ) ORDER BY owner_role.rolname, namespace.nspname,
          default_acl.defaclobjtype, acl_entry.grantee, acl_entry.privilege_type
      ),
      '[]'::jsonb
    )
    FROM pg_catalog.pg_default_acl default_acl
    JOIN pg_catalog.pg_roles owner_role ON owner_role.oid = default_acl.defaclrole
    LEFT JOIN pg_catalog.pg_namespace namespace ON namespace.oid = default_acl.defaclnamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(default_acl.defaclacl) acl_entry
    LEFT JOIN pg_catalog.pg_roles grantee_role ON grantee_role.oid = acl_entry.grantee
    WHERE namespace.nspname = 'public'
       OR default_acl.defaclnamespace = 0
  ),
  'security_definer_functions', (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'schema', n.nspname,
          'name', p.proname,
          'identity_arguments', pg_catalog.pg_get_function_identity_arguments(p.oid),
          'search_path', COALESCE(p.proconfig, ARRAY[]::text[]),
          'public_execute', EXISTS (
            SELECT 1
            FROM pg_catalog.aclexplode(
              COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))
            ) function_acl
            WHERE function_acl.grantee = 0
              AND function_acl.privilege_type = 'EXECUTE'
          ),
          'anon_execute', pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE'),
          'authenticated_execute', pg_catalog.has_function_privilege(
            'authenticated', p.oid, 'EXECUTE'
          ),
          'service_role_execute', pg_catalog.has_function_privilege(
            'service_role', p.oid, 'EXECUTE'
          )
        ) ORDER BY n.nspname, p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid)
      ),
      '[]'::jsonb
    )
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE p.prosecdef AND n.nspname IN ('public', 'runner_private')
  ),
  'policy_contracts', (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'schema', policy_schema.nspname,
          'table', policy_relation.relname,
          'policy', policy.polname,
          'command', CASE policy.polcmd
            WHEN 'r' THEN 'SELECT'
            WHEN 'a' THEN 'INSERT'
            WHEN 'w' THEN 'UPDATE'
            WHEN 'd' THEN 'DELETE'
            WHEN '*' THEN 'ALL'
            ELSE policy.polcmd::text
          END,
          'permissive', policy.polpermissive,
          'roles', ARRAY(
            SELECT CASE WHEN policy_role_oid = 0 THEN 'PUBLIC' ELSE policy_role.rolname END
            FROM pg_catalog.unnest(policy.polroles) policy_role_oid
            LEFT JOIN pg_catalog.pg_roles policy_role ON policy_role.oid = policy_role_oid
            ORDER BY CASE WHEN policy_role_oid = 0 THEN 'PUBLIC' ELSE policy_role.rolname END
          ),
          'using_sha256', CASE WHEN policy.polqual IS NULL THEN NULL ELSE
            pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
              pg_catalog.regexp_replace(pg_catalog.pg_get_expr(
                policy.polqual, policy.polrelid
              ), '\\s+', '', 'g'),
              'UTF8'
            )), 'hex')
          END,
          'check_sha256', CASE WHEN policy.polwithcheck IS NULL THEN NULL ELSE
            pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
              pg_catalog.regexp_replace(pg_catalog.pg_get_expr(
                policy.polwithcheck, policy.polrelid
              ), '\\s+', '', 'g'),
              'UTF8'
            )), 'hex')
          END
        ) ORDER BY policy_schema.nspname, policy_relation.relname, policy.polname
      ),
      '[]'::jsonb
    )
    FROM pg_catalog.pg_policy policy
    JOIN pg_catalog.pg_class policy_relation ON policy_relation.oid = policy.polrelid
    JOIN pg_catalog.pg_namespace policy_schema
      ON policy_schema.oid = policy_relation.relnamespace
    WHERE policy_schema.nspname = 'public'
  ),
  'views', (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'schema', n.nspname,
          'name', c.relname,
          'security_invoker', COALESCE('security_invoker=true' = ANY(c.reloptions), FALSE)
        ) ORDER BY n.nspname, c.relname
      ),
      '[]'::jsonb
    )
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'v'
  ),
  'foreign_keys', (
    SELECT jsonb_build_object(
      'total', COUNT(*)::INTEGER,
      'without_supporting_index', COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'table', con.conrelid::regclass::text,
            'constraint', con.conname
          ) ORDER BY con.conrelid::regclass::text, con.conname
        ) FILTER (
          WHERE NOT EXISTS (
            SELECT 1
            FROM pg_catalog.pg_index idx
            WHERE idx.indrelid = con.conrelid
              AND idx.indisvalid
              AND idx.indisready
              AND idx.indpred IS NULL
              AND idx.indexprs IS NULL
              AND idx.indnkeyatts >= pg_catalog.cardinality(con.conkey)
              AND NOT EXISTS (
                SELECT 1
                FROM pg_catalog.generate_subscripts(con.conkey, 1) column_position
                WHERE (idx.indkey::smallint[])[column_position - 1]
                  IS DISTINCT FROM con.conkey[column_position]
              )
          )
        ),
        '[]'::jsonb
      )
    )
    FROM pg_catalog.pg_constraint con
    JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = rel.relnamespace
    WHERE con.contype = 'f' AND n.nspname = 'public'
  ),
  'indexes', (
    SELECT jsonb_build_object(
      'total', COUNT(*)::INTEGER,
      'invalid', COUNT(*) FILTER (WHERE NOT idx.indisvalid)::INTEGER,
      'not_ready', COUNT(*) FILTER (WHERE NOT idx.indisready)::INTEGER,
      'never_scanned', COUNT(*) FILTER (WHERE COALESCE(stats.idx_scan, 0) = 0)::INTEGER,
      'size_bytes', COALESCE(SUM(pg_catalog.pg_relation_size(idx.indexrelid)), 0)::bigint
    )
    FROM pg_catalog.pg_index idx
    JOIN pg_catalog.pg_class rel ON rel.oid = idx.indrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = rel.relnamespace
    LEFT JOIN pg_catalog.pg_stat_user_indexes stats ON stats.indexrelid = idx.indexrelid
    WHERE n.nspname = 'public'
  ),
  'connections', (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'state', states.state,
          'wait_event_type', states.wait_event_type,
          'count', states.connection_count
        ) ORDER BY states.state, states.wait_event_type
      ),
      '[]'::jsonb
    )
    FROM (
      SELECT
        COALESCE(state, 'background') AS state,
        COALESCE(wait_event_type, 'none') AS wait_event_type,
        COUNT(*)::INTEGER AS connection_count
      FROM pg_catalog.pg_stat_activity
      WHERE datid = (SELECT oid FROM pg_catalog.pg_database WHERE datname = current_database())
      GROUP BY COALESCE(state, 'background'), COALESCE(wait_event_type, 'none')
    ) states
  ),
  'locks', (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'locktype', grouped.locktype,
          'mode', grouped.mode,
          'granted', grouped.granted,
          'count', grouped.lock_count
        ) ORDER BY grouped.granted, grouped.locktype, grouped.mode
      ),
      '[]'::jsonb
    )
    FROM (
      SELECT locktype, mode, granted, COUNT(*)::INTEGER AS lock_count
      FROM pg_catalog.pg_locks
      WHERE database IS NULL
         OR database = (SELECT oid FROM pg_catalog.pg_database WHERE datname = current_database())
      GROUP BY locktype, mode, granted
    ) grouped
  ),
  'table_health', (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'table', stats.relname,
          'size_bytes', pg_catalog.pg_total_relation_size(stats.relid),
          'live_tuples', stats.n_live_tup,
          'dead_tuples', stats.n_dead_tup,
          'last_vacuum', stats.last_vacuum,
          'last_autovacuum', stats.last_autovacuum,
          'last_analyze', stats.last_analyze,
          'last_autoanalyze', stats.last_autoanalyze
        ) ORDER BY pg_catalog.pg_total_relation_size(stats.relid) DESC, stats.relname
      ),
      '[]'::jsonb
    )
    FROM pg_catalog.pg_stat_user_tables stats
    WHERE stats.schemaname = 'public'
  ),
  'migration_reconciliation_evidence', jsonb_build_object(
    'jp_vjw_official_accommodation_fields', jsonb_build_object(
      'ledger', (
        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'version', migration.version,
              'name', migration.name,
              'statement_count', pg_catalog.cardinality(migration.statements),
              'statements_sha256', CASE
                WHEN migration.statements IS NULL THEN NULL
                ELSE pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
                  pg_catalog.array_to_string(migration.statements, E'\\n'),
                  'UTF8'
                )), 'hex')
              END
            ) ORDER BY migration.version
          ),
          '[]'::jsonb
        )
        FROM supabase_migrations.schema_migrations migration
        WHERE migration.version IN ('20260823193517', '20260824033000')
      ),
      'field_count', (
        SELECT COUNT(*)::INTEGER
        FROM public.visa_form_fields field
        WHERE field.visa_type = 'JP_VISIT_JAPAN_WEB'
          AND field.field_name IN (
            'accommodation_postal_code',
            'accommodation_prefecture',
            'accommodation_city',
            'accommodation_address',
            'accommodation_name',
            'accommodation_phone'
          )
      ),
      'field_contract_sha256', (
        SELECT pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
          COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'field_name', field.field_name,
                'label', field.label,
                'field_type', field.field_type,
                'required', field.required,
                'step_number', field.step_number,
                'step_name', field.step_name,
                'display_order', field.display_order,
                'placeholder', field.placeholder,
                'validation_rules', field.validation_rules,
                'options', field.options,
                'conditional_logic', field.conditional_logic
              ) ORDER BY field.field_name
            )::text,
            '[]'
          ),
          'UTF8'
        )), 'hex')
        FROM public.visa_form_fields field
        WHERE field.visa_type = 'JP_VISIT_JAPAN_WEB'
          AND field.field_name IN (
            'accommodation_postal_code',
            'accommodation_prefecture',
            'accommodation_city',
            'accommodation_address',
            'accommodation_name',
            'accommodation_phone'
          )
      )
    )
  ),
  'pg_stat_statements_available',
    pg_catalog.to_regclass('extensions.pg_stat_statements') IS NOT NULL
) AS architecture_audit;
`;

export const PG_STAT_STATEMENTS_AUDIT_SQL = `
SELECT jsonb_build_object(
  'stats_reset', statement_info.stats_reset,
  'observation_window_seconds', GREATEST(
    0,
    ROUND(EXTRACT(EPOCH FROM (pg_catalog.clock_timestamp() - statement_info.stats_reset)))
  ),
  'statements', COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'queryid', ranked.queryid::text,
        'calls', ranked.calls,
        'rows', ranked.rows,
        'total_exec_time_ms', ROUND(ranked.total_exec_time::numeric, 3),
        'mean_exec_time_ms', ROUND(ranked.mean_exec_time::numeric, 3),
        'shared_blks_hit', ranked.shared_blks_hit,
        'shared_blks_read', ranked.shared_blks_read,
        'temp_blks_written', ranked.temp_blks_written
      ) ORDER BY ranked.total_exec_time DESC
    )
    FROM (
      SELECT
        queryid,
        calls,
        rows,
        total_exec_time,
        mean_exec_time,
        shared_blks_hit,
        shared_blks_read,
        temp_blks_written
      FROM extensions.pg_stat_statements
      WHERE dbid = (
        SELECT oid FROM pg_catalog.pg_database WHERE datname = current_database()
      )
      ORDER BY total_exec_time DESC
      LIMIT 50
    ) ranked
  ), '[]'::jsonb)
) AS pg_stat_statements
FROM extensions.pg_stat_statements_info statement_info;
`;

export const PASSIVE_CAPACITY_SQL = `
WITH
settings AS (
  SELECT
    current_setting('max_connections')::INTEGER AS max_connections,
    current_setting('superuser_reserved_connections')::INTEGER AS superuser_reserved,
    COALESCE(NULLIF(current_setting('reserved_connections', true), '')::INTEGER, 0)
      AS reserved_connections
),
activity AS (
  SELECT
    COUNT(*)::INTEGER AS total,
    COUNT(*) FILTER (WHERE datname = current_database())::INTEGER AS current_database,
    COUNT(*) FILTER (
      WHERE datname = current_database() AND state = 'active'
    )::INTEGER AS active,
    COUNT(*) FILTER (
      WHERE datname = current_database() AND state = 'idle'
    )::INTEGER AS idle,
    COUNT(*) FILTER (
      WHERE datname = current_database() AND state = 'idle in transaction'
    )::INTEGER AS idle_in_transaction,
    COUNT(*) FILTER (
      WHERE datname = current_database()
        AND state = 'idle in transaction'
        AND state_change < pg_catalog.clock_timestamp() - INTERVAL '30 seconds'
    )::INTEGER AS idle_in_transaction_over_30s,
    COUNT(*) FILTER (
      WHERE datname = current_database()
        AND xact_start IS NOT NULL
        AND xact_start < pg_catalog.clock_timestamp() - INTERVAL '30 seconds'
    )::INTEGER AS long_transactions_over_30s,
    COUNT(*) FILTER (
      WHERE datname = current_database() AND wait_event_type = 'Lock'
    )::INTEGER AS lock_waiting,
    COALESCE(MAX(EXTRACT(EPOCH FROM (
      pg_catalog.clock_timestamp() - xact_start
    ))) FILTER (
      WHERE datname = current_database() AND xact_start IS NOT NULL
    ), 0)::NUMERIC AS max_transaction_age_seconds,
    COALESCE(MAX(EXTRACT(EPOCH FROM (
      pg_catalog.clock_timestamp() - state_change
    ))) FILTER (
      WHERE datname = current_database() AND state = 'idle in transaction'
    ), 0)::NUMERIC AS max_idle_in_transaction_seconds
  FROM pg_catalog.pg_stat_activity
  WHERE backend_type = 'client backend'
),
connection_source_labels(position, source) AS (
  VALUES
    (1, 'agent_backend'::TEXT),
    (2, 'maintenance'::TEXT),
    (3, 'other'::TEXT)
),
connection_source_counts AS (
  SELECT
    CASE
      WHEN application_name = 'viza-agent-backend' THEN 'agent_backend'
      WHEN application_name = 'viza-production-maintenance' THEN 'maintenance'
      ELSE 'other'
    END AS source,
    COUNT(*)::INTEGER AS total,
    COUNT(*) FILTER (WHERE state = 'active')::INTEGER AS active,
    COUNT(*) FILTER (WHERE state = 'idle')::INTEGER AS idle,
    COUNT(*) FILTER (WHERE state = 'idle in transaction')::INTEGER
      AS idle_in_transaction,
    COUNT(*) FILTER (
      WHERE state IS NULL
         OR state NOT IN ('active', 'idle', 'idle in transaction')
    )::INTEGER AS other
  FROM pg_catalog.pg_stat_activity
  WHERE backend_type = 'client backend'
    AND datname = current_database()
  GROUP BY 1
),
connection_sources AS (
  SELECT jsonb_agg(
    jsonb_build_object(
      'source', labels.source,
      'total', COALESCE(counts.total, 0),
      'active', COALESCE(counts.active, 0),
      'idle', COALESCE(counts.idle, 0),
      'idle_in_transaction', COALESCE(counts.idle_in_transaction, 0),
      'other', COALESCE(counts.other, 0)
    ) ORDER BY labels.position
  ) AS value
  FROM connection_source_labels labels
  LEFT JOIN connection_source_counts counts USING (source)
),
lock_summary AS (
  SELECT COUNT(*) FILTER (WHERE NOT granted)::INTEGER AS ungranted
  FROM pg_catalog.pg_locks
  WHERE database IS NULL
     OR database = (
       SELECT oid FROM pg_catalog.pg_database WHERE datname = current_database()
     )
),
database_stats AS (
  SELECT
    stats_reset,
    deadlocks,
    xact_commit,
    xact_rollback,
    temp_files,
    temp_bytes
  FROM pg_catalog.pg_stat_database
  WHERE datname = current_database()
),
work_counts AS (
  SELECT
    (SELECT COUNT(*)::INTEGER FROM public.runner_job WHERE status = 'running')
      AS runner_running,
    (SELECT COUNT(*)::INTEGER FROM public.runner_job WHERE status = 'queued')
      AS runner_queued,
    (SELECT COUNT(*)::INTEGER FROM public.submission_queue
      WHERE status = 'processing'
         OR status LIKE '%_processing'
         OR locked_until > pg_catalog.clock_timestamp())
      AS legacy_processing_or_live_locked,
    (SELECT COUNT(*)::INTEGER FROM public.official_status_checks
      WHERE country_code = 'VN' AND status = 'running')
      AS vn_status_running,
    (SELECT COUNT(*)::INTEGER FROM public.runner_machine_slot
      WHERE owner_machine_id IS NOT NULL
        AND lease_until > pg_catalog.clock_timestamp())
      AS live_machine_slots
),
table_activity AS (
  SELECT jsonb_build_object(
    'stats_reset', (
      SELECT COALESCE(
        stats_reset,
        pg_catalog.pg_postmaster_start_time()
      )
      FROM pg_catalog.pg_stat_database
      WHERE datname = current_database()
    ),
    'tables', COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'table', stats.relname,
          'seq_scan', COALESCE(stats.seq_scan, 0)::text,
          'seq_tup_read', COALESCE(stats.seq_tup_read, 0)::text,
          'idx_scan', COALESCE(stats.idx_scan, 0)::text,
          'idx_tup_fetch', COALESCE(stats.idx_tup_fetch, 0)::text,
          'n_tup_ins', COALESCE(stats.n_tup_ins, 0)::text,
          'n_tup_upd', COALESCE(stats.n_tup_upd, 0)::text,
          'n_tup_del', COALESCE(stats.n_tup_del, 0)::text,
          'n_tup_hot_upd', COALESCE(stats.n_tup_hot_upd, 0)::text
        ) ORDER BY stats.relname
      ),
      '[]'::jsonb
    )
  ) AS value
  FROM pg_catalog.pg_stat_user_tables stats
  WHERE stats.schemaname = 'public'
),
maintenance_candidates AS (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'table', stats.relname,
        'size_bytes', measured.size_bytes,
        'live_tuples', stats.n_live_tup,
        'dead_tuples', stats.n_dead_tup,
        'dead_tuple_ratio', CASE
          WHEN stats.n_live_tup + stats.n_dead_tup = 0 THEN 0
          ELSE ROUND(
            stats.n_dead_tup::NUMERIC / (stats.n_live_tup + stats.n_dead_tup),
            4
          )
        END,
        'last_analyze', stats.last_analyze,
        'last_autoanalyze', stats.last_autoanalyze
      ) ORDER BY measured.size_bytes DESC, stats.relname
    ),
    '[]'::jsonb
  ) AS value
  FROM pg_catalog.pg_stat_user_tables stats
  CROSS JOIN LATERAL (
    SELECT pg_catalog.pg_total_relation_size(stats.relid) AS size_bytes
  ) measured
  WHERE stats.schemaname = 'public'
    AND measured.size_bytes >= 104857600
    AND (
      (stats.n_live_tup + stats.n_dead_tup > 0
       AND stats.n_dead_tup::NUMERIC / (stats.n_live_tup + stats.n_dead_tup) >= 0.10)
      OR GREATEST(
        COALESCE(stats.last_analyze, '-infinity'::TIMESTAMPTZ),
        COALESCE(stats.last_autoanalyze, '-infinity'::TIMESTAMPTZ)
      ) < pg_catalog.clock_timestamp() - INTERVAL '24 hours'
    )
)
SELECT jsonb_build_object(
  'schema_version', 1,
  'project_ref_marker', current_setting('app.viza_project_ref', true),
  'sample_at', pg_catalog.clock_timestamp(),
  'max_connections', settings.max_connections,
  'effective_connection_limit', GREATEST(
    1,
    settings.max_connections - settings.superuser_reserved - settings.reserved_connections
  ),
  'connections', jsonb_build_object(
    'total', activity.total,
    'current_database', activity.current_database,
    'active', activity.active,
    'idle', activity.idle,
    'idle_in_transaction', activity.idle_in_transaction,
    'idle_in_transaction_over_30s', activity.idle_in_transaction_over_30s,
    'long_transactions_over_30s', activity.long_transactions_over_30s,
    'lock_waiting', activity.lock_waiting,
    'max_transaction_age_seconds', ROUND(activity.max_transaction_age_seconds, 3),
    'max_idle_in_transaction_seconds', ROUND(
      activity.max_idle_in_transaction_seconds, 3
    )
  ),
  'connection_sources', connection_sources.value,
  'locks', jsonb_build_object('ungranted', lock_summary.ungranted),
  'database_stats', jsonb_build_object(
    'stats_reset', database_stats.stats_reset,
    'deadlocks', database_stats.deadlocks,
    'xact_commit', database_stats.xact_commit,
    'xact_rollback', database_stats.xact_rollback,
    'temp_files', database_stats.temp_files,
    'temp_bytes', database_stats.temp_bytes
  ),
  'work', jsonb_build_object(
    'runner_running', work_counts.runner_running,
    'runner_queued', work_counts.runner_queued,
    'legacy_processing_or_live_locked', work_counts.legacy_processing_or_live_locked,
    'vn_status_running', work_counts.vn_status_running,
    'live_machine_slots', work_counts.live_machine_slots
  ),
  'table_activity', table_activity.value,
  'maintenance_candidates', maintenance_candidates.value,
  'pg_stat_statements_available',
    pg_catalog.to_regclass('extensions.pg_stat_statements') IS NOT NULL
) AS passive_capacity
FROM settings, activity, connection_sources, lock_summary, database_stats, work_counts,
     table_activity, maintenance_candidates;
`;

const expectedCapSnapshotSql = JSON.stringify(EXPECTED_CAP_SNAPSHOT).replaceAll("'", "''");
const expectedPausedResumeCapSnapshotSql = JSON.stringify(
  [
    ...EXPECTED_CAP_SNAPSHOT,
    {
      ...TAIWAN_CAP,
      paused: false,
    },
  ]
    .sort((left, right) => left.country.localeCompare(right.country))
    .map((cap) => ({ ...cap, paused: true })),
).replaceAll("'", "''");

export const PAUSE_SQL = `
BEGIN;

SELECT pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended('viza:production-controlled-cutover', 0)
);

DO $pause_guard$
DECLARE
  v_caps JSONB;
  v_cron RECORD;
  v_unscheduled BOOLEAN;
  v_runner_running INTEGER;
  v_runner_queued INTEGER;
  v_legacy_live INTEGER;
  v_vn_running INTEGER;
  v_slots_live INTEGER;
  v_updated_caps INTEGER;
BEGIN
  PERFORM 1
  FROM public.runner_concurrency_cap
  WHERE country = ANY (
    ARRAY['vietnam','singapore','malaysia','thailand','south_korea','taiwan']::text[]
  )
  ORDER BY country
  FOR UPDATE;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'country', country,
        'max_concurrent', max_concurrent,
        'paused', paused,
        'notes', notes
      ) ORDER BY country
    ),
    '[]'::jsonb
  )
  INTO v_caps
  FROM public.runner_concurrency_cap
  WHERE country = ANY (
    ARRAY['vietnam','singapore','malaysia','thailand','south_korea','taiwan']::text[]
  );

  IF v_caps IS DISTINCT FROM '${expectedCapSnapshotSql}'::jsonb THEN
    RAISE EXCEPTION 'runner cap snapshot changed after approved preflight'
      USING ERRCODE = '55000';
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE status = 'running')::INTEGER,
    COUNT(*) FILTER (WHERE status = 'queued')::INTEGER
  INTO v_runner_running, v_runner_queued
  FROM public.runner_job;

  SELECT COUNT(*)::INTEGER
  INTO v_legacy_live
  FROM public.submission_queue
  WHERE status = 'processing'
     OR status LIKE '%_processing'
     OR locked_until > pg_catalog.clock_timestamp();

  SELECT COUNT(*)::INTEGER
  INTO v_vn_running
  FROM public.official_status_checks
  WHERE country_code = 'VN' AND status = 'running';

  SELECT COUNT(*)::INTEGER
  INTO v_slots_live
  FROM public.runner_machine_slot
  WHERE owner_machine_id IS NOT NULL
    AND lease_until > pg_catalog.clock_timestamp();

  IF v_runner_running <> 0 OR v_runner_queued <> 0 OR v_legacy_live <> 0
     OR v_vn_running <> 0 OR v_slots_live <> 0 THEN
    RAISE EXCEPTION 'production queues are not drained'
      USING ERRCODE = '55000';
  END IF;

  SELECT jobid, jobname, schedule, command, active
  INTO STRICT v_cron
  FROM cron.job
  WHERE jobname = 'viza-vn-evisa-status-every-15m';

  IF v_cron.jobid <> 5
     OR v_cron.schedule IS DISTINCT FROM '*/15 * * * *'
     OR v_cron.command IS DISTINCT FROM 'SELECT enqueue_due_vn_official_status_checks();'
     OR v_cron.active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Vietnam status cron changed after approved preflight'
      USING ERRCODE = '55000';
  END IF;

  UPDATE public.runner_concurrency_cap
  SET paused = TRUE,
      updated_at = pg_catalog.clock_timestamp()
  WHERE country = ANY (
    ARRAY['vietnam','singapore','malaysia','thailand','south_korea']::text[]
  );

  GET DIAGNOSTICS v_updated_caps = ROW_COUNT;
  IF v_updated_caps <> 5 THEN
    RAISE EXCEPTION 'runner cap pause updated % rows, expected 5', v_updated_caps
      USING ERRCODE = '55000';
  END IF;

  SELECT cron.unschedule(v_cron.jobid) INTO v_unscheduled;
  IF v_unscheduled IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Vietnam status cron was not unscheduled'
      USING ERRCODE = '55000';
  END IF;
END;
$pause_guard$;

COMMIT;

SELECT jsonb_build_object(
  'runner_jobs_running', (
    SELECT COUNT(*)::INTEGER FROM public.runner_job WHERE status = 'running'
  ),
  'runner_jobs_queued', (
    SELECT COUNT(*)::INTEGER FROM public.runner_job WHERE status = 'queued'
  ),
  'legacy_processing_or_live_locked', (
    SELECT COUNT(*)::INTEGER
    FROM public.submission_queue
    WHERE status = 'processing'
       OR status LIKE '%_processing'
       OR locked_until > pg_catalog.clock_timestamp()
  ),
  'vn_status_running', (
    SELECT COUNT(*)::INTEGER
    FROM public.official_status_checks
    WHERE country_code = 'VN' AND status = 'running'
  ),
  'live_machine_slots', (
    SELECT COUNT(*)::INTEGER
    FROM public.runner_machine_slot
    WHERE owner_machine_id IS NOT NULL
      AND lease_until > pg_catalog.clock_timestamp()
  ),
  'paused_caps', (
    SELECT COALESCE(
      jsonb_agg(country ORDER BY country) FILTER (WHERE paused),
      '[]'::jsonb
    )
    FROM public.runner_concurrency_cap
    WHERE country = ANY (
      ARRAY['vietnam','singapore','malaysia','thailand','south_korea']::text[]
    )
  ),
  'vn_status_cron_rows', (
    SELECT COUNT(*)::INTEGER
    FROM cron.job
    WHERE jobname = 'viza-vn-evisa-status-every-15m'
  )
) AS maintenance_pause_state;
`;

export const RESUME_SQL = `
BEGIN;

SELECT pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended('viza:production-controlled-cutover', 0)
);

DO $resume_guard$
DECLARE
  v_caps JSONB;
  v_runner_running INTEGER;
  v_runner_queued INTEGER;
  v_legacy_live INTEGER;
  v_vn_running INTEGER;
  v_slots_live INTEGER;
  v_cron_rows INTEGER;
  v_migration_rows INTEGER;
  v_updated_caps INTEGER;
  v_cron_jobid BIGINT;
BEGIN
  PERFORM 1
  FROM public.runner_concurrency_cap
  WHERE country = ANY (
    ARRAY['vietnam','singapore','malaysia','thailand','south_korea','taiwan']::text[]
  )
  ORDER BY country
  FOR UPDATE;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'country', country,
        'max_concurrent', max_concurrent,
        'paused', paused,
        'notes', notes
      ) ORDER BY country
    ),
    '[]'::jsonb
  )
  INTO v_caps
  FROM public.runner_concurrency_cap
  WHERE country = ANY (
    ARRAY['vietnam','singapore','malaysia','thailand','south_korea','taiwan']::text[]
  );

  IF v_caps IS DISTINCT FROM '${expectedPausedResumeCapSnapshotSql}'::jsonb THEN
    RAISE EXCEPTION 'paused runner cap snapshot changed before production resume'
      USING ERRCODE = '55000';
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE status = 'running')::INTEGER,
    COUNT(*) FILTER (WHERE status = 'queued')::INTEGER
  INTO v_runner_running, v_runner_queued
  FROM public.runner_job;

  SELECT COUNT(*)::INTEGER
  INTO v_legacy_live
  FROM public.submission_queue
  WHERE status = 'processing'
     OR status LIKE '%_processing'
     OR locked_until > pg_catalog.clock_timestamp();

  SELECT COUNT(*)::INTEGER
  INTO v_vn_running
  FROM public.official_status_checks
  WHERE country_code = 'VN' AND status = 'running';

  SELECT COUNT(*)::INTEGER
  INTO v_slots_live
  FROM public.runner_machine_slot
  WHERE owner_machine_id IS NOT NULL
    AND lease_until > pg_catalog.clock_timestamp();

  IF v_runner_running <> 0 OR v_runner_queued <> 0 OR v_legacy_live <> 0
     OR v_vn_running <> 0 OR v_slots_live <> 0 THEN
    RAISE EXCEPTION 'production queues are not drained'
      USING ERRCODE = '55000';
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO v_cron_rows
  FROM cron.job
  WHERE jobname = 'viza-vn-evisa-status-every-15m';
  IF v_cron_rows <> 0 THEN
    RAISE EXCEPTION 'Vietnam status cron already exists before production resume'
      USING ERRCODE = '55000';
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO v_migration_rows
  FROM supabase_migrations.schema_migrations
  WHERE version IN ('20260816160000', '20260816161000');
  IF v_migration_rows <> 2 THEN
    RAISE EXCEPTION 'approved strict migrations are incomplete before production resume'
      USING ERRCODE = '55000';
  END IF;

  IF pg_catalog.to_regnamespace('runner_private') IS NULL
     OR pg_catalog.to_regprocedure(
       'public.claim_runner_pool_load_test_job(text,uuid,text,integer,boolean)'
     ) IS NULL
     OR pg_catalog.to_regprocedure(
       'public.claim_vn_official_status_checks(text,integer,integer)'
     ) IS NULL
     OR NOT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'official_status_checks'
         AND column_name = 'lease_generation'
     ) THEN
    RAISE EXCEPTION 'strict production database objects are incomplete'
      USING ERRCODE = '55000';
  END IF;

  UPDATE public.runner_concurrency_cap
  SET paused = FALSE,
      updated_at = pg_catalog.clock_timestamp()
  WHERE country = ANY (
    ARRAY['vietnam','singapore','malaysia','thailand','south_korea','taiwan']::text[]
  );
  GET DIAGNOSTICS v_updated_caps = ROW_COUNT;
  IF v_updated_caps <> 6 THEN
    RAISE EXCEPTION 'runner cap resume updated % rows, expected 6', v_updated_caps
      USING ERRCODE = '55000';
  END IF;

  SELECT cron.schedule(
    'viza-vn-evisa-status-every-15m',
    '*/15 * * * *',
    'SELECT enqueue_due_vn_official_status_checks();'
  ) INTO v_cron_jobid;
  IF v_cron_jobid IS NULL THEN
    RAISE EXCEPTION 'Vietnam status cron was not scheduled'
      USING ERRCODE = '55000';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobid = v_cron_jobid
      AND jobname = 'viza-vn-evisa-status-every-15m'
      AND schedule = '*/15 * * * *'
      AND command = 'SELECT enqueue_due_vn_official_status_checks();'
      AND active IS TRUE
  ) THEN
    RAISE EXCEPTION 'Vietnam status cron did not match the canonical resume shape'
      USING ERRCODE = '55000';
  END IF;
END;
$resume_guard$;

COMMIT;

SELECT jsonb_build_object(
  'resumed_caps', (
    SELECT COUNT(*)::INTEGER
    FROM public.runner_concurrency_cap
    WHERE country = ANY (
      ARRAY['vietnam','singapore','malaysia','thailand','south_korea','taiwan']::text[]
    ) AND paused IS FALSE
  ),
  'cron_rows', (
    SELECT COUNT(*)::INTEGER
    FROM cron.job
    WHERE jobname = 'viza-vn-evisa-status-every-15m'
      AND schedule = '*/15 * * * *'
      AND command = 'SELECT enqueue_due_vn_official_status_checks();'
      AND active IS TRUE
  )
) AS maintenance_resume_state;
`;

function requiredEnv(env, name) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function maintenanceState(payload) {
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray(payload.result)
      ? payload.result
      : [];
  const state = rows[0]?.maintenance_state;
  if (!state || typeof state !== "object") {
    throw new Error("Production preflight returned an unexpected payload");
  }
  return state;
}

function assertApplyPreconditions(payload) {
  const state = maintenanceState(payload);
  const zeroChecks = [
    state.runner_jobs?.running,
    state.runner_jobs?.queued,
    state.legacy_processing_or_live_locked,
    state.vn_status_running,
    state.live_machine_slots,
  ];
  if (zeroChecks.some((value) => value !== 0)) {
    throw new Error("Production queues or leases are not drained");
  }

  const expectedCountries = EXPECTED_CAP_SNAPSHOT.map((cap) => cap.country);
  const caps = Array.isArray(state.caps) ? state.caps : [];
  if (
    caps.length !== expectedCountries.length ||
    caps.some((cap, index) => cap.country !== expectedCountries[index] || cap.paused !== true)
  ) {
    throw new Error("Production runner caps are not exactly paused");
  }
  if (!Array.isArray(state.vn_status_cron) || state.vn_status_cron.length !== 0) {
    throw new Error("Vietnam status cron is still scheduled");
  }
  if (state.strict_objects?.runner_private_schema !== false) {
    throw new Error("Concurrency phase-two strict schema is already present or ambiguous");
  }
  if (state.strict_objects?.vn_lease_generation_column !== false) {
    throw new Error("Vietnam lease-generation schema is already present or ambiguous");
  }

  const versions = new Set(
    (Array.isArray(state.recent_migrations) ? state.recent_migrations : []).map(
      (migration) => migration.version,
    ),
  );
  if (!versions.has("20260816134048")) {
    throw new Error("Expected production migration baseline is missing");
  }
  for (const migration of APPROVED_MIGRATIONS) {
    if (versions.has(migration.version)) {
      throw new Error(`Migration ${migration.version} is already recorded`);
    }
  }
}

function assertApplyPostconditions(payload) {
  const state = maintenanceState(payload);
  const zeroChecks = [
    state.runner_jobs?.running,
    state.runner_jobs?.queued,
    state.legacy_processing_or_live_locked,
    state.vn_status_running,
    state.live_machine_slots,
  ];
  if (zeroChecks.some((value) => value !== 0)) {
    throw new Error("Production queues or leases changed during migration");
  }

  const caps = Array.isArray(state.caps) ? state.caps : [];
  const expectedCountries = [
    ...EXPECTED_CAP_SNAPSHOT.map((cap) => cap.country),
    TAIWAN_CAP.country,
  ].sort();
  if (
    caps.length !== expectedCountries.length ||
    caps.some((cap, index) => cap.country !== expectedCountries[index] || cap.paused !== true)
  ) {
    throw new Error("Production runner caps are not exactly paused after migration");
  }
  if (!Array.isArray(state.vn_status_cron) || state.vn_status_cron.length !== 0) {
    throw new Error("Vietnam status cron changed during migration");
  }
  if (
    state.strict_objects?.runner_private_schema !== true ||
    state.strict_objects?.load_claim_rpc !== true ||
    state.strict_objects?.vn_generation_claim_rpc !== true ||
    state.strict_objects?.vn_lease_generation_column !== true
  ) {
    throw new Error("Strict production database objects are incomplete after migration");
  }

  const versions = new Set(
    (Array.isArray(state.recent_migrations) ? state.recent_migrations : []).map(
      (migration) => migration.version,
    ),
  );
  for (const migration of APPROVED_MIGRATIONS) {
    if (!versions.has(migration.version)) {
      throw new Error(`Migration ${migration.version} was not recorded`);
    }
  }
}

function assertStableSpeedPreconditions(payload) {
  const state = maintenanceState(payload);
  if (
    state.strict_objects?.runner_private_schema !== true ||
    state.strict_objects?.load_claim_rpc !== true ||
    state.strict_objects?.vn_generation_claim_rpc !== true ||
    state.strict_objects?.vn_lease_generation_column !== true
  ) {
    throw new Error("Strict production database baseline is incomplete");
  }
  if (
    state.strict_objects?.stable_slot_renew_rpc !== false ||
    state.strict_objects?.stable_pool_health_view !== false ||
    state.strict_objects?.stable_slot_health_view !== false ||
    state.strict_objects?.stable_metric_table !== false
  ) {
    throw new Error("Stable-speed database objects are already present or ambiguous");
  }

  const caps = Array.isArray(state.caps) ? state.caps : [];
  if (
    caps.length !== STABLE_SPEED_CAPS.size ||
    caps.some((cap) =>
      STABLE_SPEED_CAPS.get(cap.country) !== cap.max_concurrent || cap.paused !== false)
  ) {
    throw new Error("Production runner caps are not the approved active topology");
  }

  const versions = new Set(
    (Array.isArray(state.recent_migrations) ? state.recent_migrations : []).map(
      (migration) => migration.version,
    ),
  );
  for (const migration of APPROVED_MIGRATIONS) {
    if (!versions.has(migration.version)) {
      throw new Error(`Required baseline migration ${migration.version} is missing`);
    }
  }
  if (versions.has(STABLE_SPEED_MIGRATION.version)) {
    throw new Error(`Migration ${STABLE_SPEED_MIGRATION.version} is already recorded`);
  }
  return JSON.stringify(caps);
}

function assertStableSpeedPostconditions(payload, capSnapshot) {
  const state = maintenanceState(payload);
  if (
    state.strict_objects?.stable_slot_renew_rpc !== true ||
    state.strict_objects?.stable_pool_health_view !== true ||
    state.strict_objects?.stable_slot_health_view !== true ||
    state.strict_objects?.stable_metric_table !== true ||
    state.strict_objects?.stable_acl_ok !== true
  ) {
    throw new Error("Stable-speed database objects or privileges are incomplete after migration");
  }
  if (JSON.stringify(Array.isArray(state.caps) ? state.caps : []) !== capSnapshot) {
    throw new Error("Production runner caps changed during stable-speed migration");
  }
  const versions = new Set(
    (Array.isArray(state.recent_migrations) ? state.recent_migrations : []).map(
      (migration) => migration.version,
    ),
  );
  if (!versions.has(STABLE_SPEED_MIGRATION.version)) {
    throw new Error(`Migration ${STABLE_SPEED_MIGRATION.version} was not recorded`);
  }
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function loadApprovedMigrationBatch({
  sourceRoot,
  readFile = readFileSync,
  hash = (buffer) => createHash("sha256").update(buffer).digest("hex"),
} = {}) {
  if (!sourceRoot) throw new Error("MIGRATION_SOURCE_ROOT is required");

  const sources = APPROVED_MIGRATIONS.map((migration) => {
    const filePath = path.resolve(sourceRoot, migration.path);
    const bytes = readFile(filePath);
    const actualHash = hash(bytes);
    if (actualHash !== migration.sha256) {
      throw new Error(`Migration ${migration.version} hash mismatch`);
    }
    return { ...migration, sql: Buffer.from(bytes).toString("utf8") };
  });

  const statements = sources.flatMap((migration) => [
    `-- BEGIN APPROVED MIGRATION ${migration.version}\n${migration.sql}\n-- END APPROVED MIGRATION ${migration.version}`,
    `INSERT INTO supabase_migrations.schema_migrations (version, statements, name)\n` +
      `VALUES (${sqlLiteral(migration.version)}, ARRAY[${sqlLiteral(`sha256:${migration.sha256}`)}]::TEXT[], ` +
      `${sqlLiteral(migration.name)});`,
  ]);

  return `SET SESSION ROLE postgres;\nBEGIN;\n${statements.join("\n\n")}\n` +
    `DO $pause_taiwan_cap$\n` +
    `DECLARE\n` +
    `  v_updated INTEGER;\n` +
    `BEGIN\n` +
    `  UPDATE public.runner_concurrency_cap\n` +
    `  SET paused = TRUE, updated_at = pg_catalog.clock_timestamp()\n` +
    `  WHERE country = ${sqlLiteral(TAIWAN_CAP.country)}\n` +
    `    AND max_concurrent = ${TAIWAN_CAP.max_concurrent}\n` +
    `    AND paused IS FALSE\n` +
    `    AND notes IS NOT DISTINCT FROM ${sqlLiteral(TAIWAN_CAP.notes)};\n` +
    `  GET DIAGNOSTICS v_updated = ROW_COUNT;\n` +
    `  IF v_updated <> 1 THEN\n` +
    `    RAISE EXCEPTION 'Taiwan runner cap did not match the approved migration shape'\n` +
    `      USING ERRCODE = '55000';\n` +
    `  END IF;\n` +
    `END;\n` +
    `$pause_taiwan_cap$;\n` +
    `COMMIT;\n` +
    `SELECT jsonb_build_object(\n` +
    `  'runner_private_schema', pg_catalog.to_regnamespace('runner_private') IS NOT NULL,\n` +
    `  'vn_lease_generation_column', EXISTS (\n` +
    `    SELECT 1 FROM information_schema.columns\n` +
    `    WHERE table_schema = 'public' AND table_name = 'official_status_checks'\n` +
    `      AND column_name = 'lease_generation'\n` +
    `  ),\n` +
    `  'versions', (\n` +
    `    SELECT jsonb_agg(version ORDER BY version)\n` +
    `    FROM supabase_migrations.schema_migrations\n` +
    `    WHERE version IN ('20260816160000','20260816161000')\n` +
    `  )\n` +
    `) AS maintenance_apply_state;`;
}

export function loadStableSpeedMigrationBatch({
  sourceRoot,
  readFile = readFileSync,
  hash = (buffer) => createHash("sha256").update(buffer).digest("hex"),
} = {}) {
  if (!sourceRoot) throw new Error("MIGRATION_SOURCE_ROOT is required");
  const filePath = path.resolve(sourceRoot, STABLE_SPEED_MIGRATION.path);
  const bytes = readFile(filePath);
  const actualHash = hash(bytes);
  if (actualHash !== STABLE_SPEED_MIGRATION.sha256) {
    throw new Error(`Migration ${STABLE_SPEED_MIGRATION.version} hash mismatch`);
  }
  const sql = Buffer.from(bytes).toString("utf8");
  return `SET SESSION ROLE postgres;\nBEGIN;\n` +
    `SET LOCAL lock_timeout = '5s';\n` +
    `SET LOCAL statement_timeout = '120s';\n` +
    `SELECT pg_catalog.pg_advisory_xact_lock(` +
      `pg_catalog.hashtextextended('viza:production-controlled-cutover', 0)` +
    `);\n` +
    `-- BEGIN APPROVED MIGRATION ${STABLE_SPEED_MIGRATION.version}\n${sql}\n` +
    `-- END APPROVED MIGRATION ${STABLE_SPEED_MIGRATION.version}\n` +
    `INSERT INTO supabase_migrations.schema_migrations (version, statements, name)\n` +
    `VALUES (${sqlLiteral(STABLE_SPEED_MIGRATION.version)}, ` +
      `ARRAY[${sqlLiteral(`sha256:${STABLE_SPEED_MIGRATION.sha256}`)}]::TEXT[], ` +
      `${sqlLiteral(STABLE_SPEED_MIGRATION.name)});\n` +
    `COMMIT;\n` +
    `SELECT jsonb_build_object(\n` +
    `  'renew_rpc', pg_catalog.to_regprocedure(` +
      `'public.renew_runner_machine_slot(text,text,integer)'` +
    `) IS NOT NULL,\n` +
    `  'metric_table', pg_catalog.to_regclass(` +
      `'public.runner_concurrency_metric'` +
    `) IS NOT NULL,\n` +
    `  'version', (SELECT version FROM supabase_migrations.schema_migrations ` +
      `WHERE version = ${sqlLiteral(STABLE_SPEED_MIGRATION.version)})\n` +
    `) AS stable_speed_apply_state;`;
}

function validateApprovedBatchManifest(manifest) {
  if (!manifest || manifest.schema_version !== 1 || !Array.isArray(manifest.batches)) {
    throw new Error("Approved migration batch manifest schema_version must be 1");
  }
  const batchIds = new Set();
  for (const batch of manifest.batches) {
    if (!/^[a-z0-9][a-z0-9-]{2,63}$/u.test(batch.batch_id ?? "")) {
      throw new Error("Approved migration batch_id is invalid");
    }
    if (batchIds.has(batch.batch_id)) {
      throw new Error(`Approved migration batch_id is duplicated: ${batch.batch_id}`);
    }
    batchIds.add(batch.batch_id);
    if (!/^[a-f0-9]{40}$/u.test(batch.source_ref ?? "")) {
      throw new Error(`Approved migration batch ${batch.batch_id} must pin a full source_ref`);
    }
    if (!['transactional', 'concurrent-index'].includes(batch.mode)) {
      throw new Error(`Approved migration batch ${batch.batch_id} has an invalid mode`);
    }
    if (!Array.isArray(batch.migrations) || batch.migrations.length === 0) {
      throw new Error(`Approved migration batch ${batch.batch_id} has no migrations`);
    }
    const versions = new Set();
    for (const migration of batch.migrations) {
      if (!/^\d{14}$/u.test(migration.version ?? "") ||
          !/^[a-z0-9][a-z0-9_]{2,127}$/u.test(migration.name ?? "") ||
          !/^viza-(?:be\/agent-backend\/drizzle|fe\/internal-website\/supabase\/migrations)\/[a-zA-Z0-9][a-zA-Z0-9_.-]*\.sql$/u.test(
            migration.path ?? "",
          ) ||
          !/^[a-f0-9]{64}$/u.test(migration.sha256 ?? "")) {
        throw new Error(`Approved migration batch ${batch.batch_id} has invalid migration metadata`);
      }
      if (versions.has(migration.version)) {
        throw new Error(`Approved migration version is duplicated: ${migration.version}`);
      }
      versions.add(migration.version);
      if (batch.mode === "concurrent-index") {
        if (!Array.isArray(migration.indexes) || migration.indexes.length === 0) {
          throw new Error(
            `Concurrent migration ${migration.version} must pin expected index definitions`,
          );
        }
        for (const index of migration.indexes) {
          if (!/^public\.[a-z_][a-z0-9_]*$/u.test(index.identity ?? "") ||
              typeof index.definition !== "string" ||
              !/^CREATE\s+(?:UNIQUE\s+)?INDEX\s+/u.test(index.definition)) {
            throw new Error(`Concurrent migration ${migration.version} has invalid index metadata`);
          }
        }
      }
    }
    for (const conditionName of ["preconditions", "postconditions"]) {
      const conditions = batch[conditionName] ?? {};
      for (const listName of ["required_migration_versions", "absent_migration_versions"]) {
        if (conditions[listName] !== undefined &&
            (!Array.isArray(conditions[listName]) ||
             conditions[listName].some((version) => !/^\d{14}$/u.test(version)))) {
          throw new Error(`${batch.batch_id} ${conditionName}.${listName} is invalid`);
        }
      }
      const assertions = conditions.catalog_assertions ?? [];
      if (!Array.isArray(assertions)) {
        throw new Error(`${batch.batch_id} ${conditionName}.catalog_assertions is invalid`);
      }
      const assertionIds = new Set();
      for (const assertion of assertions) {
        validateCatalogAssertion(assertion);
        if (assertionIds.has(assertion.id)) {
          throw new Error(`${batch.batch_id} duplicates catalog assertion ${assertion.id}`);
        }
        assertionIds.add(assertion.id);
      }
    }
  }
  return manifest;
}

const APPROVED_RELATION_IDENTITY = /^(?:public|runner_private)\.[a-z_][a-z0-9_]*$/u;
const APPROVED_FUNCTION_IDENTITY =
  /^(?:public|runner_private)\.[a-z_][a-z0-9_]*\([a-z0-9_., \[\]]*\)$/u;
const APPROVED_ROLES = new Set([
  "PUBLIC",
  "anon",
  "authenticated",
  "service_role",
  "postgres",
  "supabase_admin",
]);

function validateCatalogAssertion(assertion) {
  if (!assertion || !/^[a-z0-9][a-z0-9_]{2,79}$/u.test(assertion.id ?? "")) {
    throw new Error("Approved batch catalog assertion id is invalid");
  }
  const relationKinds = new Set([
    "relation_exists",
    "relation_absent",
    "table_absent_or_columns_match",
    "rls_enabled",
    "relation_acl",
    "view_security_invoker",
  ]);
  const functionKinds = new Set([
    "function_exists",
    "function_execute_acl",
    "function_empty_search_path",
    "function_search_path",
  ]);
  const policyKinds = new Set(["policy_absent", "policy_contract"]);
  if (relationKinds.has(assertion.kind) &&
      !APPROVED_RELATION_IDENTITY.test(assertion.identity ?? "")) {
    throw new Error(`Approved batch assertion ${assertion.id} has an invalid relation identity`);
  }
  if (functionKinds.has(assertion.kind) &&
      !APPROVED_FUNCTION_IDENTITY.test(assertion.identity ?? "")) {
    throw new Error(`Approved batch assertion ${assertion.id} has an invalid function identity`);
  }
  if (policyKinds.has(assertion.kind)) {
    if (!APPROVED_RELATION_IDENTITY.test(assertion.identity ?? "") ||
        !/^[A-Za-z0-9 _-]{1,63}$/u.test(assertion.policy ?? "")) {
      throw new Error(`Approved batch assertion ${assertion.id} has invalid policy metadata`);
    }
    if (assertion.kind === "policy_contract" &&
        (!['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'ALL'].includes(assertion.command) ||
         !Array.isArray(assertion.roles) || assertion.roles.length === 0 ||
         assertion.roles.some((role) => !APPROVED_ROLES.has(role)) ||
         typeof assertion.permissive !== "boolean" ||
         ![assertion.using_sha256, assertion.check_sha256].every((value) =>
           value === null || /^[a-f0-9]{64}$/u.test(value ?? "")))) {
      throw new Error(`Approved batch assertion ${assertion.id} has invalid policy contract`);
    }
  }
  if (assertion.kind === "policy_count") {
    if (!APPROVED_RELATION_IDENTITY.test(assertion.identity ?? "") ||
        !Number.isSafeInteger(assertion.count) || assertion.count < 0 || assertion.count > 100) {
      throw new Error(`Approved batch assertion ${assertion.id} has invalid policy count`);
    }
    return;
  }
  if (assertion.kind === "table_absent_or_columns_match") {
    if (!Array.isArray(assertion.columns) || assertion.columns.length === 0 ||
        assertion.columns.some((column) =>
          !/^[a-z_][a-z0-9_]*$/u.test(column.name ?? "") ||
          !/^[a-z_][a-z0-9_ ]*$/u.test(column.type ?? "") ||
          typeof column.nullable !== "boolean")) {
      throw new Error(`Approved batch assertion ${assertion.id} has invalid column metadata`);
    }
    return;
  }
  if (assertion.kind === "relation_acl") {
    if (!['table', 'sequence', 'view'].includes(assertion.relation_kind) ||
        !Array.isArray(assertion.required) || !Array.isArray(assertion.forbidden_roles) ||
        (assertion.allowed_direct_roles !== undefined &&
          (!Array.isArray(assertion.allowed_direct_roles) ||
           assertion.allowed_direct_roles.length === 0 ||
           assertion.allowed_direct_roles.some((role) => !APPROVED_ROLES.has(role)))) ||
        (assertion.grant_options_forbidden !== undefined &&
          typeof assertion.grant_options_forbidden !== "boolean")) {
      throw new Error(`Approved batch assertion ${assertion.id} has invalid ACL metadata`);
    }
    for (const grant of assertion.required) {
      if (!APPROVED_ROLES.has(grant.role) || !Array.isArray(grant.privileges) ||
          grant.privileges.length === 0 ||
          grant.privileges.some((privilege) => !/^[A-Z ]+$/u.test(privilege)) ||
          (grant.exact !== undefined && typeof grant.exact !== "boolean") ||
          (grant.exact_direct !== undefined && typeof grant.exact_direct !== "boolean")) {
        throw new Error(`Approved batch assertion ${assertion.id} has invalid required ACL`);
      }
    }
    if (assertion.forbidden_roles.some((role) => !APPROVED_ROLES.has(role))) {
      throw new Error(`Approved batch assertion ${assertion.id} has invalid forbidden ACL`);
    }
    return;
  }
  if (assertion.kind === "function_execute_acl") {
    if (!Array.isArray(assertion.required_roles) || !Array.isArray(assertion.forbidden_roles) ||
        [...assertion.required_roles, ...assertion.forbidden_roles].some((role) =>
          !APPROVED_ROLES.has(role))) {
      throw new Error(`Approved batch assertion ${assertion.id} has invalid function ACL`);
    }
    return;
  }
  if (assertion.kind === "function_search_path") {
    if (!Array.isArray(assertion.search_path) || assertion.search_path.length === 0 ||
        assertion.search_path.length > 8 || assertion.search_path[0] !== "pg_catalog" ||
        new Set(assertion.search_path).size !== assertion.search_path.length ||
        assertion.search_path.some((schema) => !/^[a-z_][a-z0-9_]*$/u.test(schema)) ||
        typeof assertion.security_definer !== "boolean") {
      throw new Error(`Approved batch assertion ${assertion.id} has invalid function search path`);
    }
    return;
  }
  if (assertion.kind === "default_acl_denied") {
    if (!Array.isArray(assertion.owner_roles) || !Array.isArray(assertion.object_types) ||
        !Array.isArray(assertion.denied_roles) ||
        assertion.owner_roles.some((role) => !APPROVED_ROLES.has(role)) ||
        assertion.denied_roles.some((role) => !APPROVED_ROLES.has(role)) ||
        assertion.object_types.some((type) => !['r', 'S', 'f'].includes(type))) {
      throw new Error(`Approved batch assertion ${assertion.id} has invalid default ACL metadata`);
    }
    return;
  }
  if (assertion.kind === "migration_record") {
    if (!/^\d{14}$/u.test(assertion.version ?? "") ||
        !/^[a-z0-9][a-z0-9_]{2,127}$/u.test(assertion.name ?? "") ||
        !/^[a-f0-9]{64}$/u.test(assertion.sha256 ?? "")) {
      throw new Error(`Approved batch assertion ${assertion.id} has invalid migration metadata`);
    }
    return;
  }
  if (assertion.kind === "role_settings") {
    const settings = assertion.settings;
    const expectedSettingNames = [
      "statement_timeout",
      "idle_in_transaction_session_timeout",
    ];
    if (assertion.role !== "postgres" ||
        !settings || typeof settings !== "object" || Array.isArray(settings) ||
        Object.keys(settings).length !== expectedSettingNames.length ||
        expectedSettingNames.some((name) => settings[name] !== "30s")) {
      throw new Error(`Approved batch assertion ${assertion.id} has invalid role settings`);
    }
    return;
  }
  if (!relationKinds.has(assertion.kind) && !functionKinds.has(assertion.kind) &&
      !policyKinds.has(assertion.kind)) {
    throw new Error(`Unsupported approved batch catalog assertion: ${assertion.kind}`);
  }
}

function approvedRoleSettingsExpression(assertion) {
  const expectedSettings = Object.entries(assertion.settings)
    .map(([name, value]) => `${name}=${value}`)
    .sort();
  const expectedNames = Object.keys(assertion.settings).sort();
  return `EXISTS (\n` +
    `    SELECT 1\n` +
    `    FROM pg_catalog.pg_roles configured_role\n` +
    `    WHERE configured_role.rolname = ${sqlLiteral(assertion.role)}\n` +
    `      AND ARRAY(\n` +
    `        SELECT configured_setting\n` +
    `        FROM pg_catalog.unnest(\n` +
    `          COALESCE(configured_role.rolconfig, ARRAY[]::text[])\n` +
    `        ) configured_setting\n` +
    `        WHERE pg_catalog.split_part(configured_setting, '=', 1) IN (` +
    `${expectedNames.map(sqlLiteral).join(", ")})\n` +
    `        ORDER BY configured_setting\n` +
    `      ) = ARRAY[${expectedSettings.map(sqlLiteral).join(", ")}]::text[]\n` +
    `  )`;
}

export function loadApprovedBatchManifest({
  readFile = readFileSync,
  manifestUrl = APPROVED_BATCH_MANIFEST_URL,
} = {}) {
  return validateApprovedBatchManifest(JSON.parse(readFile(manifestUrl, "utf8")));
}

function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//gu, " ")
    .replace(/--[^\r\n]*/gu, " ");
}

function validateConcurrentIndexSql(sql, migration) {
  const statements = stripSqlComments(sql).split(";").map((value) => value.trim()).filter(Boolean);
  const matches = statements.map((statement) =>
    /^CREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY\s+IF\s+NOT\s+EXISTS\s+((?:public\.)?"?[a-z_][a-z0-9_]*"?)\s+ON\s+/iu.exec(
      statement,
    ));
  if (statements.length === 0 || matches.some((match) => !match)) {
    throw new Error(
      `Migration ${migration.version} must contain only online CREATE INDEX CONCURRENTLY IF NOT EXISTS statements`,
    );
  }
  const identities = matches.map((match) =>
    match[1].includes(".") ? match[1] : `public.${match[1]}`);
  const expected = migration.indexes.map((index) => index.identity).sort();
  if (JSON.stringify([...identities].sort()) !== JSON.stringify(expected)) {
    throw new Error(`Migration ${migration.version} index identities do not match its manifest`);
  }
  return identities;
}

function resolveMigrationSourcePath(sourceRoot, migrationPath) {
  const root = path.resolve(sourceRoot);
  const filePath = path.resolve(root, migrationPath);
  const relative = path.relative(root, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Approved migration path escapes MIGRATION_SOURCE_ROOT");
  }
  return filePath;
}

export function loadGenericApprovedBatch({
  batch,
  sourceRoot,
  readFile = readFileSync,
  hash = (buffer) => createHash("sha256").update(buffer).digest("hex"),
} = {}) {
  validateApprovedBatchManifest({ schema_version: 1, batches: [batch] });
  if (!sourceRoot) throw new Error("MIGRATION_SOURCE_ROOT is required");

  const sources = batch.migrations.map((migration) => {
    const bytes = readFile(resolveMigrationSourcePath(sourceRoot, migration.path));
    const actualHash = hash(bytes);
    if (actualHash !== migration.sha256) {
      throw new Error(`Migration ${migration.version} hash mismatch`);
    }
    const sql = Buffer.from(bytes).toString("utf8");
    let concurrentIndexes = [];
    if (batch.mode === "concurrent-index") {
      concurrentIndexes = validateConcurrentIndexSql(sql, migration);
    } else if (/\b(?:BEGIN|COMMIT|ROLLBACK)\s*;/iu.test(stripSqlComments(sql))) {
      throw new Error(`Transactional migration ${migration.version} contains transaction control`);
    }
    return { ...migration, sql, concurrentIndexes };
  });

  const migrationStatements = sources.map((migration) =>
    `-- BEGIN APPROVED MIGRATION ${migration.version}\n${migration.sql}\n` +
    `-- END APPROVED MIGRATION ${migration.version}`);
  const ledgerStatements = sources.map((migration) =>
    `INSERT INTO supabase_migrations.schema_migrations (version, statements, name)\n` +
    `VALUES (${sqlLiteral(migration.version)}, ` +
    `ARRAY[${sqlLiteral(`sha256:${migration.sha256}`)}]::TEXT[], ` +
    `${sqlLiteral(migration.name)});`);

  if (batch.mode === "transactional") {
    return `SET SESSION ROLE postgres;\nBEGIN;\n` +
      `SET LOCAL lock_timeout = '5s';\n` +
      `SET LOCAL statement_timeout = '120s';\n` +
      `SELECT pg_catalog.pg_advisory_xact_lock(` +
      `pg_catalog.hashtextextended('viza:approved-migration-batch:${batch.batch_id}', 0)` +
      `);\n${migrationStatements.join("\n\n")}\n` +
      `${ledgerStatements.join("\n")}\nCOMMIT;\n`;
  }

  const concurrentIndexes = sources.flatMap((migration) => migration.indexes);
  const indexValues = concurrentIndexes.map((index) =>
    `(${sqlLiteral(index.identity)}, ${sqlLiteral(index.definition)})`).join(",\n      ");
  return `SET SESSION ROLE postgres;\n` +
    `SET lock_timeout = '5s';\nSET statement_timeout = '900s';\n` +
    `SELECT pg_catalog.format(` +
    `'DROP INDEX CONCURRENTLY IF EXISTS %s;', index_state.indexrelid::regclass)\n` +
    `FROM (VALUES\n      ${indexValues}\n` +
    `) AS expected(index_name, expected_definition)\n` +
    `JOIN pg_catalog.pg_index index_state\n` +
    `  ON index_state.indexrelid = pg_catalog.to_regclass(expected.index_name)\n` +
    `WHERE index_state.indisvalid IS NOT TRUE OR index_state.indisready IS NOT TRUE\n` +
    `\\gexec\n` +
    `DO $approved_index_preflight$\n` +
    `BEGIN\n` +
    `  IF EXISTS (\n` +
    `    SELECT 1\n` +
    `    FROM (VALUES\n      ${indexValues}\n` +
    `    ) AS expected(index_name, expected_definition)\n` +
    `    JOIN pg_catalog.pg_index index_state\n` +
    `      ON index_state.indexrelid = pg_catalog.to_regclass(expected.index_name)\n` +
    `    WHERE pg_catalog.pg_get_indexdef(index_state.indexrelid)\n` +
    `      IS DISTINCT FROM expected.expected_definition\n` +
    `  ) THEN\n` +
    `    RAISE EXCEPTION 'approved existing index definition does not match the manifest'\n` +
    `      USING ERRCODE = '55000';\n` +
    `  END IF;\n` +
    `END\n` +
    `$approved_index_preflight$;\n` +
    `${migrationStatements.join("\n\n")}\n` +
    `DO $approved_index_validity$\n` +
    `BEGIN\n` +
    `  IF EXISTS (\n` +
    `    SELECT 1\n` +
    `    FROM (VALUES\n      ${indexValues}\n` +
    `    ) AS expected(index_name, expected_definition)\n` +
    `    LEFT JOIN pg_catalog.pg_class index_class\n` +
    `      ON index_class.oid = pg_catalog.to_regclass(expected.index_name)\n` +
    `    LEFT JOIN pg_catalog.pg_index index_state\n` +
    `      ON index_state.indexrelid = index_class.oid\n` +
    `    WHERE index_state.indexrelid IS NULL\n` +
    `       OR index_state.indisvalid IS NOT TRUE\n` +
    `       OR index_state.indisready IS NOT TRUE\n` +
    `       OR pg_catalog.pg_get_indexdef(index_state.indexrelid)\n` +
    `          IS DISTINCT FROM expected.expected_definition\n` +
    `  ) THEN\n` +
    `    RAISE EXCEPTION 'approved concurrent index is missing, invalid, or not ready'\n` +
    `      USING ERRCODE = '55000';\n` +
    `  END IF;\n` +
    `END\n` +
    `$approved_index_validity$;\n` +
    `BEGIN;\n${ledgerStatements.join("\n")}\nCOMMIT;\n`;
}

function managementApiUrl(projectRef, suffix) {
  return `https://api.supabase.com/v1/projects/${projectRef}${suffix}`;
}

async function managementJsonRequest({
  token,
  projectRef,
  suffix,
  method,
  body,
  fetchImpl,
  timeoutMs = 60_000,
  allowNotFound = false,
}) {
  const response = await fetchImpl(managementApiUrl(projectRef, suffix), {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const payload = await response.json().catch(() => null);
  if (allowNotFound && response.status === 404) {
    return payload;
  }
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && typeof payload.message === "string"
        ? payload.message
        : "Management API request failed";
    const requestError = new Error(
      `Supabase temporary database access failed (${response.status}): ${message}`,
    );
    requestError.statusCode = response.status;
    if (suffix === "/cli/login-role" && method === "POST") {
      try {
        await revokeTemporaryRole({ token, projectRef, fetchImpl });
      } catch (cleanupError) {
        throw new AggregateError(
          [requestError, cleanupError],
          "Temporary database access request failed and uncertain role cleanup also failed",
        );
      }
    }
    throw requestError;
  }
  return payload;
}

function parseTemporaryRole(payload) {
  const role = typeof payload?.role === "string" ? payload.role.trim() : "";
  const password = typeof payload?.password === "string" ? payload.password : "";
  const ttlSeconds = Number(payload?.ttl_seconds);
  if (
    !/^cli_login_[a-z0-9_]+(?:\.[a-z0-9]{20})?$/u.test(role) ||
    password.length < 16 ||
    !Number.isFinite(ttlSeconds) ||
    ttlSeconds < 60 ||
    ttlSeconds > 600
  ) {
    throw new Error("Supabase returned an invalid temporary database role");
  }
  return { role, password, ttlSeconds };
}

function parsePrimarySessionPooler(payload, projectRef) {
  const configs = Array.isArray(payload) ? payload : [];
  const config = configs.find((item) => item?.database_type === "PRIMARY");
  const host = typeof config?.db_host === "string" ? config.db_host.trim().toLowerCase() : "";
  const advertisedPort = Number(config?.db_port);
  const database = typeof config?.db_name === "string" ? config.db_name.trim() : "";
  const configuredUser = typeof config?.db_user === "string" ? config.db_user.trim() : "";
  const advertisedMode = config?.pool_mode;
  const advertisedEndpointIsValid =
    (advertisedMode === "session" && advertisedPort === 5432) ||
    (advertisedMode === "transaction" && advertisedPort === 6543);
  if (
    !/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.pooler\.supabase\.com$/u.test(host) ||
    !advertisedEndpointIsValid ||
    database !== "postgres" ||
    configuredUser !== `postgres.${projectRef}`
  ) {
    throw new Error("Supabase returned an unexpected primary session-pooler configuration");
  }
  // Supabase's CLI deliberately switches the primary pooler to its session
  // port for migration connections, even when the Management API advertises
  // the transaction-pooler connection string on 6543.
  return { host, port: 5432, database };
}

export async function downloadSupabaseProductionCa({
  fetchImpl = fetch,
  hash = (bytes) => createHash("sha256").update(bytes).digest("hex"),
} = {}) {
  const response = await fetchImpl(SUPABASE_PRODUCTION_CA_URL, {
    method: "GET",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Supabase production CA download failed (${response.status})`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const actualHash = hash(bytes);
  const pem = bytes.toString("utf8").trim();
  if (
    actualHash !== SUPABASE_PRODUCTION_CA_SHA256 ||
    !pem.startsWith("-----BEGIN CERTIFICATE-----\n") ||
    !pem.endsWith("\n-----END CERTIFICATE-----")
  ) {
    throw new Error("Supabase production CA failed its pinned integrity check");
  }
  return bytes;
}

export function executePsqlMigration({
  query,
  projectRef,
  role,
  password,
  pooler,
  caCertificate,
  spawn = spawnSync,
  makeTempDir = () => mkdtempSync(path.join(tmpdir(), "viza-production-migration-")),
  writeTempFile = (filePath, contents) => writeFileSync(filePath, contents, { mode: 0o600 }),
  removeTempDir = (dirPath) => rmSync(dirPath, { recursive: true, force: true }),
  parentEnv = process.env,
} = {}) {
  const username = role.includes(".") ? role : `${role}.${projectRef}`;
  if (!username.endsWith(`.${projectRef}`)) {
    throw new Error("Temporary database role does not match the approved production project");
  }
  if (!Buffer.isBuffer(caCertificate) || caCertificate.length === 0) {
    throw new Error("Pinned Supabase production CA is required");
  }

  const version = spawn("psql", ["--version"], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (version.error || version.status !== 0) {
    throw new Error("psql is unavailable on the protected maintenance runner");
  }

  const tempDir = makeTempDir();
  const caPath = path.join(tempDir, "supabase-prod-ca-2021.crt");
  const sqlPath = path.join(tempDir, "approved-production-migrations.sql");
  try {
    writeTempFile(caPath, caCertificate);
    const childEnv = {};
    for (const inheritedName of [
      "PATH",
      "HOME",
      "LANG",
      "LC_ALL",
      "LC_CTYPE",
      "SYSTEMROOT",
      "WINDIR",
      "COMSPEC",
      "PATHEXT",
      "TMP",
      "TEMP",
    ]) {
      if (parentEnv[inheritedName] !== undefined) {
        childEnv[inheritedName] = parentEnv[inheritedName];
      }
    }
    Object.assign(childEnv, {
      PGPASSWORD: password,
      PGSSLMODE: "verify-full",
      PGSSLROOTCERT: caPath,
      PGCONNECT_TIMEOUT: "15",
      PGAPPNAME: "viza-production-maintenance",
    });
    const connectionArgs = [
      "--no-psqlrc",
      "--host", pooler.host,
      "--port", String(pooler.port),
      "--username", username,
      "--dbname", pooler.database,
      "--set", "ON_ERROR_STOP=1",
      "--set", "VERBOSITY=terse",
    ];
    const spawnOptions = {
      env: childEnv,
      stdio: "inherit",
      timeout: 480_000,
      windowsHide: true,
    };

    const permissionProbe = spawn(
      "psql",
      [
        ...connectionArgs,
        "--command",
        "SET SESSION ROLE postgres; SELECT current_user = 'postgres' AS role_verified;",
      ],
      spawnOptions,
    );
    if (permissionProbe.error || permissionProbe.status !== 0) {
      throw new Error("Temporary database role failed the postgres permission probe");
    }

    writeTempFile(sqlPath, query);
    const result = spawn(
      "psql",
      [
        ...connectionArgs,
        "--file", sqlPath,
      ],
      spawnOptions,
    );
    if (result.error || result.status !== 0) {
      throw new Error("psql rejected the approved production migration transaction");
    }
  } finally {
    removeTempDir(tempDir);
  }
}

async function revokeTemporaryRole({ token, projectRef, fetchImpl, wait = setTimeout }) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await managementJsonRequest({
        token,
        projectRef,
        suffix: "/cli/login-role",
        method: "DELETE",
        fetchImpl,
        allowNotFound: true,
      });
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise((resolve) => wait(resolve, attempt * 500));
      }
    }
  }
  throw new Error("Could not revoke temporary database access after three attempts", {
    cause: lastError,
  });
}

async function managementQuery({
  env,
  fetchImpl,
  action,
  query,
  readOnly,
  expectedConfirm = `${PRODUCTION_PROJECT_REF}:${action}`,
  timeoutMs = action === "apply" ? 180_000 : 60_000,
}) {
  const token = requiredEnv(env, "SUPABASE_ACCESS_TOKEN");
  const projectRef = requiredEnv(env, "SUPABASE_PROJECT_REF");
  const confirm = requiredEnv(env, "PRODUCTION_DB_MAINTENANCE_CONFIRM");

  if (projectRef !== PRODUCTION_PROJECT_REF) {
    throw new Error("SUPABASE_PROJECT_REF is not the approved production project");
  }
  if (confirm !== expectedConfirm) {
    throw new Error(`PRODUCTION_DB_MAINTENANCE_CONFIRM does not authorize ${action}`);
  }

  const response = await fetchImpl(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query${readOnly ? "/read-only" : ""}`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ query, parameters: [], ...(readOnly ? {} : { read_only: false }) }),
      signal: AbortSignal.timeout(timeoutMs),
    },
  );

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && typeof payload.message === "string"
        ? payload.message
        : "Management API request failed";
    const requestError = new Error(`Supabase ${action} failed (${response.status}): ${message}`);
    requestError.statusCode = response.status;
    throw requestError;
  }

  return payload;
}

function metadataRow(payload, key, errorMessage) {
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray(payload.result)
      ? payload.result
      : [];
  const value = rows[0]?.[key];
  if (value === undefined || value === null) throw new Error(errorMessage);
  return value;
}

function sanitizeAdvisorPayload(payload) {
  const lints = Array.isArray(payload?.lints) ? payload.lints : [];
  return {
    lints: lints.map((lint) => {
      const metadata = lint && typeof lint.metadata === "object" ? lint.metadata : {};
      const object = {};
      for (const key of ["schema", "name", "entity", "type", "fkey_name", "fkey_columns"]) {
        const value = metadata[key];
        if (
          typeof value === "string" || typeof value === "number" || typeof value === "boolean" ||
          (Array.isArray(value) && value.every((item) =>
            typeof item === "string" || typeof item === "number"))
        ) {
          object[key] = value;
        }
      }
      return {
        name: typeof lint?.name === "string" ? lint.name : "unknown",
        level: typeof lint?.level === "string" ? lint.level : "UNKNOWN",
        facing: typeof lint?.facing === "string" ? lint.facing : "UNKNOWN",
        categories: Array.isArray(lint?.categories)
          ? lint.categories.filter((item) => typeof item === "string")
          : [],
        object,
      };
    }),
  };
}

function assertManagementProjectIdentity(payload, projectRef) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Supabase Management API project identity is missing or mismatched");
  }
  const identities = [payload.id, payload.ref]
    .filter((value) => typeof value === "string" && value.length > 0);
  if (identities.length === 0 || identities.some((value) => value !== projectRef)) {
    throw new Error("Supabase Management API project identity is missing or mismatched");
  }
}

function isTransientReadOnlyManagementError(error) {
  const statusCode = Number(error?.statusCode);
  if (statusCode === 429 || (statusCode >= 500 && statusCode <= 599)) return true;
  if (error?.name === "AbortError" || error?.name === "TimeoutError") return true;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /\b(?:ECONNRESET|ETIMEDOUT|fetch failed|connection timeout)\b/iu.test(message);
}

async function retryArchitectureAuditRead({ phase, run, wait }) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (!isTransientReadOnlyManagementError(error) || attempt === 2) {
        const suffix = attempt === 2 ? " after two attempts" : "";
        throw new Error(
          `Production architecture audit ${phase} failed${suffix}: ${
            error instanceof Error ? error.message : String(error)
          }`,
          { cause: error },
        );
      }
      await new Promise((resolve) => wait(resolve, 500));
    }
  }
  throw lastError;
}

function finiteMetric(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`Passive capacity metric ${name} is invalid`);
  }
  return value;
}

function validTimestamp(value) {
  return typeof value === "string" && value.length > 0 && Number.isFinite(Date.parse(value));
}

const TABLE_ACTIVITY_COUNTERS = [
  "seq_scan",
  "seq_tup_read",
  "idx_scan",
  "idx_tup_fetch",
  "n_tup_ins",
  "n_tup_upd",
  "n_tup_del",
  "n_tup_hot_upd",
];

const CONNECTION_SOURCE_LABELS = [
  "agent_backend",
  "maintenance",
  "other",
];
const CONNECTION_SOURCE_METRICS = [
  "total",
  "active",
  "idle",
  "idle_in_transaction",
  "other",
];

function validateConnectionSources(sources, currentDatabaseConnections, path) {
  if (!Array.isArray(sources) || sources.length !== CONNECTION_SOURCE_LABELS.length) {
    throw new Error(`Passive capacity connection sources ${path} are invalid`);
  }
  const expectedKeys = ["source", ...CONNECTION_SOURCE_METRICS].sort();
  let totalConnections = 0;
  for (const [index, expectedSource] of CONNECTION_SOURCE_LABELS.entries()) {
    const source = sources[index];
    if (!source || typeof source !== "object" || Array.isArray(source) ||
        source.source !== expectedSource ||
        JSON.stringify(Object.keys(source).sort()) !== JSON.stringify(expectedKeys)) {
      throw new Error(`Passive capacity connection sources ${path}[${index}] are invalid`);
    }
    for (const metric of CONNECTION_SOURCE_METRICS) {
      const value = finiteMetric(source[metric], `${path}[${index}].${metric}`);
      if (!Number.isInteger(value)) {
        throw new Error(`Passive capacity connection sources ${path}[${index}] are invalid`);
      }
    }
    if (source.active + source.idle + source.idle_in_transaction + source.other !==
        source.total) {
      throw new Error(`Passive capacity connection sources ${path}[${index}] are inconsistent`);
    }
    totalConnections += source.total;
  }
  if (totalConnections !== currentDatabaseConnections) {
    throw new Error(`Passive capacity connection sources ${path} are inconsistent`);
  }
  return sources;
}

function validateTableActivitySnapshot(snapshot, path) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot) ||
      (snapshot.stats_reset !== null && !validTimestamp(snapshot.stats_reset)) ||
      !Array.isArray(snapshot.tables)) {
    throw new Error(`Passive capacity table activity ${path} is invalid`);
  }
  const expectedKeys = ["table", ...TABLE_ACTIVITY_COUNTERS].sort();
  const seen = new Set();
  let previous = "";
  for (const [index, table] of snapshot.tables.entries()) {
    if (!table || typeof table !== "object" || Array.isArray(table) ||
        typeof table.table !== "string" ||
        !/^[A-Za-z_][A-Za-z0-9_$]{0,62}$/u.test(table.table) ||
        seen.has(table.table) || table.table.localeCompare(previous) < 0 ||
        JSON.stringify(Object.keys(table).sort()) !== JSON.stringify(expectedKeys)) {
      throw new Error(`Passive capacity table activity ${path}.tables[${index}] is invalid`);
    }
    for (const key of TABLE_ACTIVITY_COUNTERS) {
      if (typeof table[key] !== "string" || !/^\d+$/u.test(table[key])) {
        throw new Error(
          `Passive capacity table activity ${path}.tables[${index}].${key} is invalid`,
        );
      }
    }
    seen.add(table.table);
    previous = table.table;
  }
  return snapshot;
}

function validateCapacityStatementMetrics(statementMetrics, { required }) {
  if (
    !statementMetrics || typeof statementMetrics !== "object" ||
    Array.isArray(statementMetrics) ||
    (statementMetrics.stats_reset !== null &&
      typeof statementMetrics.stats_reset !== "string") ||
    (statementMetrics.observation_window_seconds !== null &&
      (typeof statementMetrics.observation_window_seconds !== "number" ||
        !Number.isFinite(statementMetrics.observation_window_seconds) ||
        statementMetrics.observation_window_seconds < 0)) ||
    !Array.isArray(statementMetrics.statements)
  ) {
    throw new Error("Passive capacity statement metadata is invalid");
  }
  if (required && (
    !validTimestamp(statementMetrics.stats_reset) ||
    statementMetrics.observation_window_seconds <= 0
  )) {
    throw new Error("Passive capacity statement metadata is incomplete");
  }
  for (const [index, statement] of statementMetrics.statements.entries()) {
    if (!statement || typeof statement !== "object" || Array.isArray(statement) ||
        typeof statement.queryid !== "string" || statement.queryid.length === 0) {
      throw new Error(`Passive capacity statement ${index} is invalid`);
    }
    for (const key of [
      "calls",
      "rows",
      "total_exec_time_ms",
      "mean_exec_time_ms",
      "shared_blks_hit",
      "shared_blks_read",
      "temp_blks_written",
    ]) {
      finiteMetric(statement[key], `statement.${key}`);
    }
  }
  return statementMetrics;
}

function validatePassiveCapacitySample(sample) {
  if (!sample || typeof sample !== "object" || Array.isArray(sample)) {
    throw new Error("Passive capacity sample is invalid");
  }
  if (
    sample.schema_version !== 1 ||
    !validTimestamp(sample.sample_at) ||
    (sample.project_ref_marker !== null &&
      sample.project_ref_marker !== PRODUCTION_PROJECT_REF) ||
    typeof sample.pg_stat_statements_available !== "boolean"
  ) {
    throw new Error("Passive capacity sample contract is invalid");
  }
  const connections = sample.connections;
  const locks = sample.locks;
  const databaseStats = sample.database_stats;
  const work = sample.work;
  if (!connections || !locks || !databaseStats || !work) {
    throw new Error("Passive capacity sample is incomplete");
  }
  finiteMetric(sample.max_connections, "max_connections");
  const effectiveLimit = finiteMetric(
    sample.effective_connection_limit,
    "effective_connection_limit",
  );
  if (effectiveLimit < 1) throw new Error("Passive capacity effective limit is invalid");
  if (effectiveLimit > sample.max_connections) {
    throw new Error("Passive capacity effective limit exceeds max connections");
  }
  for (const key of [
    "total",
    "current_database",
    "active",
    "idle",
    "idle_in_transaction",
    "idle_in_transaction_over_30s",
    "long_transactions_over_30s",
    "lock_waiting",
    "max_transaction_age_seconds",
    "max_idle_in_transaction_seconds",
  ]) {
    finiteMetric(connections[key], `connections.${key}`);
  }
  if (
    connections.total > sample.max_connections ||
    connections.current_database > connections.total ||
    connections.active + connections.idle + connections.idle_in_transaction >
      connections.current_database ||
    connections.idle_in_transaction_over_30s > connections.idle_in_transaction ||
    connections.long_transactions_over_30s > connections.current_database ||
    connections.lock_waiting > connections.current_database
  ) {
    throw new Error("Passive capacity connection counts are inconsistent");
  }
  validateConnectionSources(
    sample.connection_sources,
    connections.current_database,
    "sample.connection_sources",
  );
  finiteMetric(locks.ungranted, "locks.ungranted");
  if (databaseStats.stats_reset !== null && typeof databaseStats.stats_reset !== "string") {
    throw new Error("Passive capacity database stats reset marker is invalid");
  }
  for (const key of ["deadlocks", "xact_commit", "xact_rollback", "temp_files", "temp_bytes"]) {
    finiteMetric(databaseStats[key], `database_stats.${key}`);
  }
  for (const key of [
    "runner_running",
    "runner_queued",
    "legacy_processing_or_live_locked",
    "vn_status_running",
    "live_machine_slots",
  ]) {
    finiteMetric(work[key], `work.${key}`);
  }
  if (!Array.isArray(sample.maintenance_candidates)) {
    throw new Error("Passive capacity maintenance candidates are invalid");
  }
  validateTableActivitySnapshot(sample.table_activity, "sample.table_activity");
  return sample;
}

function optimizationCandidates(statementMetrics) {
  validateCapacityStatementMetrics(statementMetrics, { required: false });
  const windowSeconds = statementMetrics.observation_window_seconds;
  if (typeof windowSeconds !== "number" || !Number.isFinite(windowSeconds) || windowSeconds <= 0) {
    return [];
  }
  if (!Array.isArray(statementMetrics.statements)) return [];
  return statementMetrics.statements
    .map((statement) => {
      if (!statement || typeof statement !== "object" || typeof statement.queryid !== "string") {
        return null;
      }
      const calls = finiteMetric(statement.calls, "statement.calls");
      const rows = finiteMetric(statement.rows, "statement.rows");
      const totalExecTimeMs = finiteMetric(
        statement.total_exec_time_ms,
        "statement.total_exec_time_ms",
      );
      const meanExecTimeMs = finiteMetric(
        statement.mean_exec_time_ms,
        "statement.mean_exec_time_ms",
      );
      const callsPerDay = Math.round((calls * 86_400) / windowSeconds);
      if (callsPerDay < 100 || (meanExecTimeMs < 50 && totalExecTimeMs < 5_000)) {
        return null;
      }
      return {
        queryid: statement.queryid,
        calls,
        calls_per_day: callsPerDay,
        rows,
        total_exec_time_ms: totalExecTimeMs,
        mean_exec_time_ms: meanExecTimeMs,
        shared_blks_hit: finiteMetric(statement.shared_blks_hit, "statement.shared_blks_hit"),
        shared_blks_read: finiteMetric(statement.shared_blks_read, "statement.shared_blks_read"),
        temp_blks_written: finiteMetric(
          statement.temp_blks_written,
          "statement.temp_blks_written",
        ),
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.total_exec_time_ms - left.total_exec_time_ms)
    .slice(0, 20);
}

export function assessPassiveCapacity({ samples, statementMetrics }) {
  if (!Array.isArray(samples) || samples.length !== 3) {
    throw new Error("Passive capacity assessment requires exactly three samples");
  }
  const validated = samples.map(validatePassiveCapacitySample);
  const statementsAvailable = validated.every((sample) =>
    sample.pg_stat_statements_available === true);
  const validatedStatementMetrics = validateCapacityStatementMetrics(
    statementMetrics,
    { required: statementsAvailable },
  );
  const blockers = [];
  const warnings = [];
  const utilization = validated.map((sample) =>
    Math.round((sample.connections.total / sample.effective_connection_limit) * 10_000) / 100,
  );
  const every = (predicate) => validated.every(predicate);
  const some = (predicate) => validated.some(predicate);

  if (!statementsAvailable) {
    warnings.push("pg_stat_statements was unavailable; query optimization evidence is incomplete");
  }
  if (some((sample) => sample.project_ref_marker === null)) {
    warnings.push(
      "database project marker was unavailable; Management API identity remains authoritative",
    );
  }
  if (new Set(validated.map((sample) => sample.pg_stat_statements_available)).size !== 1) {
    warnings.push("pg_stat_statements availability changed during the observation window");
  }

  if (utilization.every((value) => value >= 80)) {
    blockers.push("connection utilization stayed at or above 80% across all samples");
  } else if (utilization.some((value) => value >= 70)) {
    warnings.push("connection utilization reached 70% in at least one sample");
  }
  if (every((sample) => sample.locks.ungranted > 0 || sample.connections.lock_waiting > 0)) {
    blockers.push("ungranted locks persisted across all samples");
  } else if (some((sample) => sample.locks.ungranted > 0 || sample.connections.lock_waiting > 0)) {
    warnings.push("a transient ungranted lock was observed");
  }
  if (every((sample) => sample.connections.idle_in_transaction_over_30s > 0)) {
    blockers.push("idle in transaction sessions older than 30 seconds persisted");
  } else if (some((sample) => sample.connections.idle_in_transaction_over_30s > 0)) {
    warnings.push("a transient idle in transaction session older than 30 seconds was observed");
  }
  if (every((sample) => sample.connections.long_transactions_over_30s > 0)) {
    blockers.push("long transactions older than 30 seconds persisted");
  } else if (some((sample) => sample.connections.long_transactions_over_30s > 0)) {
    warnings.push("a transient transaction older than 30 seconds was observed");
  }
  const firstStats = validated[0].database_stats;
  const lastStats = validated.at(-1).database_stats;
  const resetMarkers = new Set(validated.map((sample) => sample.database_stats.stats_reset));
  if (resetMarkers.size !== 1) {
    blockers.push("database statistics reset during the observation window");
  }
  for (const key of ["deadlocks", "xact_commit", "xact_rollback"]) {
    if (lastStats[key] < firstStats[key]) {
      blockers.push(`database ${key} counter moved backwards during the observation window`);
    }
  }
  if (lastStats.deadlocks > firstStats.deadlocks) {
    blockers.push("database deadlocks increased during the observation window");
  }
  const commitDelta = Math.max(0, lastStats.xact_commit - firstStats.xact_commit);
  const rollbackDelta = Math.max(0, lastStats.xact_rollback - firstStats.xact_rollback);
  if (rollbackDelta >= 5 && rollbackDelta / Math.max(1, commitDelta + rollbackDelta) >= 0.2) {
    warnings.push("transaction rollback ratio was at least 20% during the observation window");
  }

  const maintenanceTables = [...new Set(validated.flatMap((sample) =>
    sample.maintenance_candidates
      .map((candidate) => candidate?.table)
      .filter((table) => typeof table === "string" && table.length > 0),
  ))].sort();
  if (maintenanceTables.length > 0) {
    warnings.push("large-table vacuum or analyze maintenance candidates were observed");
  }

  return {
    status: blockers.length > 0 ? "red" : warnings.length > 0 ? "warn" : "green",
    blockers,
    warnings,
    summary: {
      sample_count: validated.length,
      max_connection_utilization_percent: Math.max(...utilization),
      max_total_connections: Math.max(...validated.map((sample) => sample.connections.total)),
      max_active_connections: Math.max(...validated.map((sample) => sample.connections.active)),
      max_ungranted_locks: Math.max(...validated.map((sample) => sample.locks.ungranted)),
      max_idle_in_transaction_over_30s: Math.max(...validated.map((sample) =>
        sample.connections.idle_in_transaction_over_30s)),
      max_long_transactions_over_30s: Math.max(...validated.map((sample) =>
        sample.connections.long_transactions_over_30s)),
      deadlock_delta: Math.max(0, lastStats.deadlocks - firstStats.deadlocks),
      commit_delta: commitDelta,
      rollback_delta: rollbackDelta,
      maintenance_tables: maintenanceTables,
      connection_source_peaks: Object.fromEntries(
        CONNECTION_SOURCE_LABELS.map((source, index) => [
          source,
          Math.max(...validated.map((sample) => sample.connection_sources[index].total)),
        ]),
      ),
    },
    optimization_candidates: optimizationCandidates(validatedStatementMetrics),
  };
}

export async function runPassiveCapacityObservation({
  env = process.env,
  fetchImpl = fetch,
  wait = setTimeout,
} = {}) {
  const token = requiredEnv(env, "SUPABASE_ACCESS_TOKEN");
  const projectRef = requiredEnv(env, "SUPABASE_PROJECT_REF");
  const confirm = requiredEnv(env, "PRODUCTION_DB_MAINTENANCE_CONFIRM");
  if (projectRef !== PRODUCTION_PROJECT_REF) {
    throw new Error("SUPABASE_PROJECT_REF is not the approved production project");
  }
  if (confirm !== `${PRODUCTION_PROJECT_REF}:capacity-observe`) {
    throw new Error("PRODUCTION_DB_MAINTENANCE_CONFIRM does not authorize capacity-observe");
  }

  const projectIdentity = await retryArchitectureAuditRead({
    phase: "capacity project identity",
    wait,
    run: () => managementJsonRequest({
      token,
      projectRef,
      suffix: "",
      method: "GET",
      fetchImpl,
    }),
  });
  assertManagementProjectIdentity(projectIdentity, projectRef);
  const performanceAdvisor = sanitizeAdvisorPayload(await retryArchitectureAuditRead({
    phase: "capacity performance advisor",
    wait,
    run: () => managementJsonRequest({
      token,
      projectRef,
      suffix: "/advisors/performance",
      method: "GET",
      fetchImpl,
    }),
  }));

  const samples = [];
  for (let index = 0; index < 3; index += 1) {
    if (index > 0) await new Promise((resolve) => wait(resolve, 5_000));
    const payload = await retryArchitectureAuditRead({
      phase: `capacity sample ${index + 1}`,
      wait,
      run: () => managementQuery({
        env,
        fetchImpl,
        action: "capacity-observe",
        query: PASSIVE_CAPACITY_SQL,
        readOnly: true,
      }),
    });
    const sample = validatePassiveCapacitySample(metadataRow(
      payload,
      "passive_capacity",
      "Production passive capacity observation returned an unexpected sample",
    ));
    if (sample.project_ref_marker != null && sample.project_ref_marker !== projectRef) {
      throw new Error("Production passive capacity database project marker is mismatched");
    }
    samples.push(sample);
  }

  let statementMetrics = {
    stats_reset: null,
    observation_window_seconds: null,
    statements: [],
  };
  if (samples.at(-1).pg_stat_statements_available === true) {
    const statementPayload = await retryArchitectureAuditRead({
      phase: "capacity statement metrics",
      wait,
      run: () => managementQuery({
        env,
        fetchImpl,
        action: "capacity-observe",
        query: PG_STAT_STATEMENTS_AUDIT_SQL,
        readOnly: true,
      }),
    });
    statementMetrics = validateCapacityStatementMetrics(metadataRow(
      statementPayload,
      "pg_stat_statements",
      "Production passive capacity observation returned unexpected statement metadata",
    ), { required: true });
  }

  return {
    schema_version: 1,
    source: {
      management_api: "https://api.supabase.com/v1",
      project_endpoint: `projects/${projectRef}`,
      performance_advisor_endpoint: "advisors/performance",
      catalog_endpoint: "database/query/read-only",
    },
    project_ref: projectRef,
    sanitization_schema: "viza-passive-capacity-metadata-only-v3",
    performance_advisor: performanceAdvisor,
    samples,
    pg_stat_statements: statementMetrics,
    assessment: assessPassiveCapacity({ samples, statementMetrics }),
  };
}

export async function runArchitectureAudit({
  env = process.env,
  fetchImpl = fetch,
  wait = setTimeout,
} = {}) {
  const token = requiredEnv(env, "SUPABASE_ACCESS_TOKEN");
  const projectRef = requiredEnv(env, "SUPABASE_PROJECT_REF");
  const confirm = requiredEnv(env, "PRODUCTION_DB_MAINTENANCE_CONFIRM");
  if (projectRef !== PRODUCTION_PROJECT_REF) {
    throw new Error("SUPABASE_PROJECT_REF is not the approved production project");
  }
  if (confirm !== `${PRODUCTION_PROJECT_REF}:architecture-audit`) {
    throw new Error("PRODUCTION_DB_MAINTENANCE_CONFIRM does not authorize architecture-audit");
  }

  const projectIdentity = await retryArchitectureAuditRead({
    phase: "project identity",
    wait,
    run: () => managementJsonRequest({
      token,
      projectRef,
      suffix: "",
      method: "GET",
      fetchImpl,
    }),
  });
  assertManagementProjectIdentity(projectIdentity, projectRef);
  const security = sanitizeAdvisorPayload(await retryArchitectureAuditRead({
    phase: "security advisor",
    wait,
    run: () => managementJsonRequest({
      token,
      projectRef,
      suffix: "/advisors/security",
      method: "GET",
      fetchImpl,
    }),
  }));
  const performance = sanitizeAdvisorPayload(await retryArchitectureAuditRead({
    phase: "performance advisor",
    wait,
    run: () => managementJsonRequest({
      token,
      projectRef,
      suffix: "/advisors/performance",
      method: "GET",
      fetchImpl,
    }),
  }));
  const catalogPayload = await retryArchitectureAuditRead({
    phase: "catalog query",
    wait,
    run: () => managementQuery({
      env,
      fetchImpl,
      action: "architecture-audit",
      query: ARCHITECTURE_AUDIT_SQL,
      readOnly: true,
    }),
  });
  const catalog = metadataRow(
    catalogPayload,
    "architecture_audit",
    "Production architecture audit returned an unexpected catalog payload",
  );
  if (catalog.project_ref_marker != null &&
      catalog.project_ref_marker !== PRODUCTION_PROJECT_REF) {
    throw new Error("Production architecture audit database project marker is mismatched");
  }

  let statementMetrics = {
    stats_reset: null,
    observation_window_seconds: null,
    statements: [],
  };
  if (catalog.pg_stat_statements_available === true) {
    const statementPayload = await retryArchitectureAuditRead({
      phase: "statement metrics query",
      wait,
      run: () => managementQuery({
        env,
        fetchImpl,
        action: "architecture-audit",
        query: PG_STAT_STATEMENTS_AUDIT_SQL,
        readOnly: true,
      }),
    });
    const rawMetrics = metadataRow(
      statementPayload,
      "pg_stat_statements",
      "Production architecture audit returned unexpected statement metadata",
    );
    if (
      !rawMetrics || typeof rawMetrics !== "object" ||
      !Array.isArray(rawMetrics.statements) ||
      (rawMetrics.stats_reset !== null && typeof rawMetrics.stats_reset !== "string") ||
      (rawMetrics.observation_window_seconds !== null &&
        (typeof rawMetrics.observation_window_seconds !== "number" ||
          !Number.isFinite(rawMetrics.observation_window_seconds) ||
          rawMetrics.observation_window_seconds < 0))
    ) {
      throw new Error("Production architecture audit statement metadata is invalid");
    }
    statementMetrics = {
      stats_reset: rawMetrics.stats_reset,
      observation_window_seconds: rawMetrics.observation_window_seconds,
      statements: rawMetrics.statements,
    };
  }

  return {
    schema_version: 1,
    source: {
      management_api: "https://api.supabase.com/v1",
      project_endpoint: `projects/${projectRef}`,
      advisor_endpoints: ["advisors/security", "advisors/performance"],
      catalog_endpoint: "database/query/read-only",
    },
    project_ref: projectRef,
    sanitization_schema: "viza-architecture-audit-metadata-only-v2",
    advisors: { security, performance },
    catalog,
    pg_stat_statements: statementMetrics,
  };
}

export async function runPreflight({ env = process.env, fetchImpl = fetch } = {}) {
  return managementQuery({
    env,
    fetchImpl,
    action: "preflight",
    query: PREFLIGHT_SQL,
    readOnly: true,
  });
}

export async function runPause({ env = process.env, fetchImpl = fetch } = {}) {
  return managementQuery({
    env,
    fetchImpl,
    action: "pause",
    query: PAUSE_SQL,
    readOnly: false,
  });
}

export async function runResume({ env = process.env, fetchImpl = fetch } = {}) {
  return managementQuery({
    env,
    fetchImpl,
    action: "resume",
    query: RESUME_SQL,
    readOnly: false,
  });
}

export async function runApply({
  env = process.env,
  fetchImpl = fetch,
  readFile = readFileSync,
  hash,
  executeMigration = executePsqlMigration,
  downloadCa = downloadSupabaseProductionCa,
} = {}) {
  const sourceRef = requiredEnv(env, "PRODUCTION_DB_MAINTENANCE_SOURCE_REF");
  const sourceRoot = requiredEnv(env, "MIGRATION_SOURCE_ROOT");
  const confirm = requiredEnv(env, "PRODUCTION_DB_MAINTENANCE_CONFIRM");
  if (sourceRef !== APPROVED_MIGRATION_SOURCE_REF) {
    throw new Error("Migration source ref is not approved");
  }
  if (confirm !== `${PRODUCTION_PROJECT_REF}:apply:${sourceRef}`) {
    throw new Error("PRODUCTION_DB_MAINTENANCE_CONFIRM does not authorize apply");
  }

  const preflight = await runPreflight({
    env: {
      ...env,
      PRODUCTION_DB_MAINTENANCE_CONFIRM: `${PRODUCTION_PROJECT_REF}:preflight`,
    },
    fetchImpl,
  });
  assertApplyPreconditions(preflight);

  const query = loadApprovedMigrationBatch({ sourceRoot, readFile, hash });
  const caCertificate = await downloadCa({ fetchImpl });
  const token = requiredEnv(env, "SUPABASE_ACCESS_TOKEN");
  const projectRef = requiredEnv(env, "SUPABASE_PROJECT_REF");
  let applyError;
  let temporaryRole;
  let loginRoleCreated = false;
  try {
    const temporaryRolePayload = await managementJsonRequest({
      token,
      projectRef,
      suffix: "/cli/login-role",
      method: "POST",
      body: { read_only: false },
      fetchImpl,
    });
    loginRoleCreated = true;
    temporaryRole = parseTemporaryRole(temporaryRolePayload);
    const pooler = parsePrimarySessionPooler(
      await managementJsonRequest({
        token,
        projectRef,
        suffix: "/config/database/pooler",
        method: "GET",
        fetchImpl,
      }),
      projectRef,
    );
    await executeMigration({
      query,
      projectRef,
      ...temporaryRole,
      pooler,
      caCertificate,
    });
  } catch (error) {
    applyError = error;
  }

  let cleanupError;
  if (loginRoleCreated) {
    try {
      await revokeTemporaryRole({ token, projectRef, fetchImpl });
    } catch (error) {
      cleanupError = error;
    }
  }
  if (applyError && cleanupError) {
    throw new AggregateError(
      [applyError, cleanupError],
      "Production migration failed and temporary database access cleanup also failed",
    );
  }
  if (applyError) throw applyError;
  if (cleanupError) throw cleanupError;

  const postflight = await runPreflight({
    env: {
      ...env,
      PRODUCTION_DB_MAINTENANCE_CONFIRM: `${PRODUCTION_PROJECT_REF}:preflight`,
    },
    fetchImpl,
  });
  assertApplyPostconditions(postflight);
  return postflight;
}

export async function runStableSpeedApply({
  env = process.env,
  fetchImpl = fetch,
  readFile = readFileSync,
  hash,
  executeMigration = executePsqlMigration,
  downloadCa = downloadSupabaseProductionCa,
} = {}) {
  const sourceRef = requiredEnv(env, "PRODUCTION_DB_MAINTENANCE_SOURCE_REF");
  const sourceRoot = requiredEnv(env, "MIGRATION_SOURCE_ROOT");
  const confirm = requiredEnv(env, "PRODUCTION_DB_MAINTENANCE_CONFIRM");
  if (sourceRef !== STABLE_SPEED_MIGRATION_SOURCE_REF) {
    throw new Error("Stable-speed migration source ref is not approved");
  }
  if (confirm !== `${PRODUCTION_PROJECT_REF}:apply-stable-speed:${sourceRef}`) {
    throw new Error("PRODUCTION_DB_MAINTENANCE_CONFIRM does not authorize apply-stable-speed");
  }

  const preflight = await runPreflight({
    env: {
      ...env,
      PRODUCTION_DB_MAINTENANCE_CONFIRM: `${PRODUCTION_PROJECT_REF}:preflight`,
    },
    fetchImpl,
  });
  const capSnapshot = assertStableSpeedPreconditions(preflight);
  const query = loadStableSpeedMigrationBatch({ sourceRoot, readFile, hash });
  const caCertificate = await downloadCa({ fetchImpl });
  const token = requiredEnv(env, "SUPABASE_ACCESS_TOKEN");
  const projectRef = requiredEnv(env, "SUPABASE_PROJECT_REF");
  let applyError;
  let temporaryRole;
  let loginRoleCreated = false;
  try {
    const temporaryRolePayload = await managementJsonRequest({
      token,
      projectRef,
      suffix: "/cli/login-role",
      method: "POST",
      body: { read_only: false },
      fetchImpl,
    });
    loginRoleCreated = true;
    temporaryRole = parseTemporaryRole(temporaryRolePayload);
    const pooler = parsePrimarySessionPooler(
      await managementJsonRequest({
        token,
        projectRef,
        suffix: "/config/database/pooler",
        method: "GET",
        fetchImpl,
      }),
      projectRef,
    );
    await executeMigration({
      query,
      projectRef,
      ...temporaryRole,
      pooler,
      caCertificate,
    });
  } catch (error) {
    applyError = error;
  }

  let cleanupError;
  if (loginRoleCreated) {
    try {
      await revokeTemporaryRole({ token, projectRef, fetchImpl });
    } catch (error) {
      cleanupError = error;
    }
  }
  if (applyError && cleanupError) {
    throw new AggregateError(
      [applyError, cleanupError],
      "Stable-speed migration failed and temporary database access cleanup also failed",
    );
  }
  if (applyError) throw applyError;
  if (cleanupError) throw cleanupError;

  const postflight = await runPreflight({
    env: {
      ...env,
      PRODUCTION_DB_MAINTENANCE_CONFIRM: `${PRODUCTION_PROJECT_REF}:preflight`,
    },
    fetchImpl,
  });
  assertStableSpeedPostconditions(postflight, capSnapshot);
  return postflight;
}

function approvedRelationAclExpression(assertion) {
  const identity = sqlLiteral(assertion.identity);
  const privilegeFunction = assertion.relation_kind === "sequence"
    ? "pg_catalog.has_sequence_privilege"
    : "pg_catalog.has_table_privilege";
  const objectPrivileges = assertion.relation_kind === "sequence"
    ? ["USAGE", "SELECT", "UPDATE"]
    : ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"];
  const required = assertion.required.flatMap((grant) => [
    ...grant.privileges.map((privilege) =>
      `COALESCE(${privilegeFunction}(${sqlLiteral(grant.role)}, ` +
      `pg_catalog.to_regclass(${identity}), ${sqlLiteral(privilege)}), FALSE)`),
    ...(grant.exact
      ? objectPrivileges.filter((privilege) => !grant.privileges.includes(privilege)).map((privilege) =>
        `NOT COALESCE(${privilegeFunction}(${sqlLiteral(grant.role)}, ` +
        `pg_catalog.to_regclass(${identity}), ${sqlLiteral(privilege)}), FALSE)`)
      : []),
    ...(grant.exact_direct
      ? [
          `NOT EXISTS (\n` +
          `      SELECT 1\n` +
          `      FROM pg_catalog.pg_class exact_acl_relation\n` +
          `      CROSS JOIN LATERAL pg_catalog.aclexplode(\n` +
          `        COALESCE(exact_acl_relation.relacl, ` +
          `pg_catalog.acldefault(${sqlLiteral(assertion.relation_kind === "sequence" ? "S" : "r")}, ` +
          `exact_acl_relation.relowner))\n` +
          `      ) exact_acl_entry\n` +
          `      WHERE exact_acl_relation.oid = pg_catalog.to_regclass(${identity})\n` +
          `        AND exact_acl_entry.grantee = ${grant.role === "PUBLIC"
            ? "0::oid"
            : `(SELECT exact_acl_role.oid FROM pg_catalog.pg_roles exact_acl_role ` +
              `WHERE exact_acl_role.rolname = ${sqlLiteral(grant.role)})`}\n` +
          `        AND exact_acl_entry.privilege_type NOT IN (` +
          `${grant.privileges.map(sqlLiteral).join(", ")})\n` +
          `    )`,
          `NOT EXISTS (\n` +
          `      SELECT 1\n` +
          `      FROM (VALUES ${grant.privileges.map((privilege) =>
            `(${sqlLiteral(privilege)})`).join(", ")}) expected_acl(privilege_type)\n` +
          `      WHERE NOT EXISTS (\n` +
          `        SELECT 1\n` +
          `        FROM pg_catalog.pg_class exact_acl_relation\n` +
          `        CROSS JOIN LATERAL pg_catalog.aclexplode(\n` +
          `          COALESCE(exact_acl_relation.relacl, ` +
          `pg_catalog.acldefault(${sqlLiteral(assertion.relation_kind === "sequence" ? "S" : "r")}, ` +
          `exact_acl_relation.relowner))\n` +
          `        ) exact_acl_entry\n` +
          `        WHERE exact_acl_relation.oid = pg_catalog.to_regclass(${identity})\n` +
          `          AND exact_acl_entry.grantee = ${grant.role === "PUBLIC"
            ? "0::oid"
            : `(SELECT exact_acl_role.oid FROM pg_catalog.pg_roles exact_acl_role ` +
              `WHERE exact_acl_role.rolname = ${sqlLiteral(grant.role)})`}\n` +
          `          AND exact_acl_entry.privilege_type = expected_acl.privilege_type\n` +
          `      )\n` +
          `    )`,
        ]
      : []),
  ]);
  const forbidden = assertion.forbidden_roles.map((role) => {
    if (role === "PUBLIC") {
      const aclDefaultType = assertion.relation_kind === "sequence" ? "S" : "r";
      return `NOT EXISTS (\n` +
        `      SELECT 1\n` +
        `      FROM pg_catalog.pg_class acl_relation\n` +
        `      CROSS JOIN LATERAL pg_catalog.aclexplode(\n` +
        `        COALESCE(acl_relation.relacl, ` +
        `pg_catalog.acldefault(${sqlLiteral(aclDefaultType)}, acl_relation.relowner))\n` +
        `      ) acl_entry\n` +
        `      WHERE acl_relation.oid = pg_catalog.to_regclass(${identity})\n` +
        `        AND acl_entry.grantee = 0\n` +
        `    )`;
    }
    return objectPrivileges.map((privilege) =>
      `NOT COALESCE(${privilegeFunction}(${sqlLiteral(role)}, ` +
      `pg_catalog.to_regclass(${identity}), ${sqlLiteral(privilege)}), FALSE)`).join(" AND ");
  });
  const aclDefaultType = assertion.relation_kind === "sequence" ? "S" : "r";
  const allowedDirectRoles = assertion.allowed_direct_roles === undefined
    ? []
    : [
        `NOT EXISTS (\n` +
        `      SELECT 1\n` +
        `      FROM pg_catalog.pg_class acl_relation\n` +
        `      CROSS JOIN LATERAL pg_catalog.aclexplode(\n` +
        `        COALESCE(acl_relation.relacl, ` +
        `pg_catalog.acldefault(${sqlLiteral(aclDefaultType)}, acl_relation.relowner))\n` +
        `      ) acl_entry\n` +
        `      WHERE acl_relation.oid = pg_catalog.to_regclass(${identity})\n` +
        `        AND acl_entry.grantee <> acl_relation.relowner\n` +
        `        AND (CASE WHEN acl_entry.grantee = 0 THEN 'PUBLIC'\n` +
        `          ELSE pg_catalog.pg_get_userbyid(acl_entry.grantee) END) NOT IN (` +
        `${assertion.allowed_direct_roles.map(sqlLiteral).join(", ")})\n` +
        `    )`,
      ];
  const forbiddenGrantOptions = assertion.grant_options_forbidden
    ? [
        `NOT EXISTS (\n` +
        `      SELECT 1\n` +
        `      FROM pg_catalog.pg_class acl_relation\n` +
        `      CROSS JOIN LATERAL pg_catalog.aclexplode(\n` +
        `        COALESCE(acl_relation.relacl, ` +
        `pg_catalog.acldefault(${sqlLiteral(aclDefaultType)}, acl_relation.relowner))\n` +
        `      ) acl_entry\n` +
        `      WHERE acl_relation.oid = pg_catalog.to_regclass(${identity})\n` +
        `        AND acl_entry.grantee <> acl_relation.relowner\n` +
        `        AND acl_entry.is_grantable\n` +
        `    )`,
      ]
    : [];
  return `(pg_catalog.to_regclass(${identity}) IS NOT NULL` +
    [...required, ...forbidden, ...allowedDirectRoles, ...forbiddenGrantOptions]
      .map((check) => `\n    AND (${check})`).join("") + `)`;
}

function approvedFunctionAclExpression(assertion) {
  const identity = sqlLiteral(assertion.identity);
  const required = assertion.required_roles.map((role) =>
    `COALESCE(pg_catalog.has_function_privilege(${sqlLiteral(role)}, ` +
    `pg_catalog.to_regprocedure(${identity}), 'EXECUTE'), FALSE)`);
  const forbidden = assertion.forbidden_roles.map((role) => role === "PUBLIC"
    ? `NOT EXISTS (\n` +
      `      SELECT 1\n` +
      `      FROM pg_catalog.pg_proc acl_function\n` +
      `      CROSS JOIN LATERAL pg_catalog.aclexplode(\n` +
      `        COALESCE(acl_function.proacl, ` +
      `pg_catalog.acldefault('f', acl_function.proowner))\n` +
      `      ) acl_entry\n` +
      `      WHERE acl_function.oid = pg_catalog.to_regprocedure(${identity})\n` +
      `        AND acl_entry.grantee = 0\n` +
      `    )`
    : `NOT COALESCE(pg_catalog.has_function_privilege(${sqlLiteral(role)}, ` +
      `pg_catalog.to_regprocedure(${identity}), 'EXECUTE'), FALSE)`);
  return `(pg_catalog.to_regprocedure(${identity}) IS NOT NULL` +
    [...required, ...forbidden].map((check) => `\n    AND (${check})`).join("") + `)`;
}

function approvedFunctionSearchPathExpression(assertion) {
  const identity = sqlLiteral(assertion.identity);
  const expected = sqlLiteral(`search_path=${assertion.search_path.join(", ")}`);
  return `EXISTS (\n` +
    `    SELECT 1\n` +
    `    FROM pg_catalog.pg_proc configured_function\n` +
    `    WHERE configured_function.oid = pg_catalog.to_regprocedure(${identity})\n` +
    `      AND configured_function.prosecdef IS ${assertion.security_definer ? "TRUE" : "FALSE"}\n` +
    `      AND ARRAY(\n` +
    `        SELECT configured_setting\n` +
    `        FROM pg_catalog.unnest(\n` +
    `          COALESCE(configured_function.proconfig, ARRAY[]::text[])\n` +
    `        ) configured_setting\n` +
    `        WHERE pg_catalog.split_part(configured_setting, '=', 1) = 'search_path'\n` +
    `        ORDER BY configured_setting\n` +
    `      ) = ARRAY[${expected}]::text[]\n` +
    `  )`;
}

function approvedDefaultAclExpression(assertion) {
  const ownerValues = assertion.owner_roles.map((role) => `(${sqlLiteral(role)})`).join(", ");
  const typeValues = assertion.object_types.map((type) =>
    `(${sqlLiteral(type)}::\"char\")`).join(", ");
  const denied = assertion.denied_roles.filter((role) => role !== "PUBLIC");
  const deniedList = denied.length > 0 ? denied.map(sqlLiteral).join(", ") : "NULL";
  const publicCheck = assertion.denied_roles.includes("PUBLIC")
    ? `acl_entry.grantee = 0 OR `
    : "";
  return `NOT EXISTS (\n` +
    `    SELECT 1\n` +
    `    FROM (VALUES ${ownerValues}) AS expected_owner(role_name)\n` +
    `    JOIN pg_catalog.pg_roles owner_role\n` +
    `      ON owner_role.rolname = expected_owner.role_name\n` +
    `    CROSS JOIN (VALUES ${typeValues}) AS expected_type(object_type)\n` +
    `    JOIN pg_catalog.pg_namespace default_schema ON default_schema.nspname = 'public'\n` +
    `    CROSS JOIN LATERAL (VALUES (0::oid, TRUE), (default_schema.oid, FALSE)) ` +
    `AS default_scope(namespace_oid, is_global)\n` +
    `    LEFT JOIN pg_catalog.pg_default_acl default_acl\n` +
    `      ON default_acl.defaclrole = owner_role.oid\n` +
    `     AND default_acl.defaclnamespace = default_scope.namespace_oid\n` +
    `     AND default_acl.defaclobjtype = expected_type.object_type\n` +
    `    CROSS JOIN LATERAL pg_catalog.aclexplode(\n` +
    `      CASE\n` +
    `        WHEN default_acl.oid IS NOT NULL THEN default_acl.defaclacl\n` +
    `        WHEN default_scope.is_global THEN ` +
    `pg_catalog.acldefault(expected_type.object_type, owner_role.oid)\n` +
    `        ELSE '{}'::aclitem[]\n` +
    `      END\n` +
    `    ) acl_entry\n` +
    `    LEFT JOIN pg_catalog.pg_roles grantee_role ON grantee_role.oid = acl_entry.grantee\n` +
    `    WHERE ${publicCheck}grantee_role.rolname IN (${deniedList})\n` +
    `  )`;
}

function approvedPolicyExpressionHash(columnName, expectedHash) {
  if (expectedHash === null) return `secure_policy.${columnName} IS NULL`;
  return `pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(` +
    `pg_catalog.regexp_replace(pg_catalog.pg_get_expr(` +
    `secure_policy.${columnName}, secure_policy.polrelid), '\\s+', '', 'g'), ` +
    `'UTF8')), 'hex') = ${sqlLiteral(expectedHash)}`;
}

function approvedPolicyContractExpression(assertion) {
  const [schemaName, tableName] = assertion.identity.split(".");
  const commandCode = {
    SELECT: "r",
    INSERT: "a",
    UPDATE: "w",
    DELETE: "d",
    ALL: "*",
  }[assertion.command];
  const roleOids = assertion.roles.map((role) => role === "PUBLIC"
    ? "0::oid"
    : `(SELECT policy_role.oid FROM pg_catalog.pg_roles policy_role ` +
      `WHERE policy_role.rolname = ${sqlLiteral(role)})`).join(", ");
  return `EXISTS (\n` +
    `    SELECT 1\n` +
    `    FROM pg_catalog.pg_policy secure_policy\n` +
    `    JOIN pg_catalog.pg_class policy_relation ON policy_relation.oid = secure_policy.polrelid\n` +
    `    JOIN pg_catalog.pg_namespace policy_schema ON policy_schema.oid = policy_relation.relnamespace\n` +
    `    WHERE policy_schema.nspname = ${sqlLiteral(schemaName)}\n` +
    `      AND policy_relation.relname = ${sqlLiteral(tableName)}\n` +
    `      AND secure_policy.polname = ${sqlLiteral(assertion.policy)}\n` +
    `      AND secure_policy.polcmd = ${sqlLiteral(commandCode)}::\"char\"\n` +
    `      AND secure_policy.polpermissive IS ${assertion.permissive ? "TRUE" : "FALSE"}\n` +
    `      AND ARRAY(SELECT actual_role FROM pg_catalog.unnest(secure_policy.polroles) actual_role ORDER BY actual_role) =\n` +
    `          ARRAY(SELECT expected_role FROM pg_catalog.unnest(ARRAY[${roleOids}]::oid[]) expected_role ORDER BY expected_role)\n` +
    `      AND ${approvedPolicyExpressionHash("polqual", assertion.using_sha256)}\n` +
    `      AND ${approvedPolicyExpressionHash("polwithcheck", assertion.check_sha256)}\n` +
    `  )`;
}

function approvedCatalogAssertionExpression(assertion) {
  validateCatalogAssertion(assertion);
  if (assertion.kind === "role_settings") {
    return approvedRoleSettingsExpression(assertion);
  }
  const identity = sqlLiteral(assertion.identity);
  switch (assertion.kind) {
    case "relation_exists":
      return `pg_catalog.to_regclass(${identity}) IS NOT NULL`;
    case "relation_absent":
      return `pg_catalog.to_regclass(${identity}) IS NULL`;
    case "function_exists":
      return `pg_catalog.to_regprocedure(${identity}) IS NOT NULL`;
    case "table_absent_or_columns_match": {
      const [schemaName, tableName] = assertion.identity.split(".");
      const values = assertion.columns.map((column) =>
        `(${sqlLiteral(column.name)}, ${sqlLiteral(column.type)}, ` +
        `${column.nullable ? "TRUE" : "FALSE"})`).join(",\n        ");
      return `(pg_catalog.to_regclass(${identity}) IS NULL OR NOT EXISTS (\n` +
        `    SELECT 1\n` +
        `    FROM (VALUES\n        ${values}\n` +
        `    ) AS expected(column_name, udt_name, nullable)\n` +
        `    WHERE NOT EXISTS (\n` +
        `      SELECT 1\n` +
        `      FROM information_schema.columns actual\n` +
        `      WHERE actual.table_schema = ${sqlLiteral(schemaName)}\n` +
        `        AND actual.table_name = ${sqlLiteral(tableName)}\n` +
        `        AND actual.column_name = expected.column_name\n` +
        `        AND actual.udt_name = expected.udt_name\n` +
        `        AND (actual.is_nullable = 'YES') = expected.nullable\n` +
        `    )\n` +
        `  ))`;
    }
    case "rls_enabled":
      return `EXISTS (\n` +
        `    SELECT 1 FROM pg_catalog.pg_class rls_relation\n` +
        `    WHERE rls_relation.oid = pg_catalog.to_regclass(${identity})\n` +
        `      AND rls_relation.relrowsecurity IS TRUE\n` +
        `  )`;
    case "relation_acl":
      return approvedRelationAclExpression(assertion);
    case "function_execute_acl":
      return approvedFunctionAclExpression(assertion);
    case "function_search_path":
      return approvedFunctionSearchPathExpression(assertion);
    case "view_security_invoker":
      return `EXISTS (\n` +
        `    SELECT 1 FROM pg_catalog.pg_class invoker_view\n` +
        `    WHERE invoker_view.oid = pg_catalog.to_regclass(${identity})\n` +
        `      AND invoker_view.relkind = 'v'\n` +
        `      AND 'security_invoker=true' = ANY(COALESCE(invoker_view.reloptions, ARRAY[]::text[]))\n` +
        `  )`;
    case "function_empty_search_path":
      return `EXISTS (\n` +
        `    SELECT 1 FROM pg_catalog.pg_proc secure_function\n` +
        `    WHERE secure_function.oid = pg_catalog.to_regprocedure(${identity})\n` +
        `      AND secure_function.prosecdef IS TRUE\n` +
        `      AND COALESCE(secure_function.proconfig, ARRAY[]::text[]) ` +
        `@> ARRAY['search_path=""']::text[]\n` +
        `  )`;
    case "policy_absent": {
      const [schemaName, tableName] = assertion.identity.split(".");
      return `NOT EXISTS (\n` +
        `    SELECT 1\n` +
        `    FROM pg_catalog.pg_policy absent_policy\n` +
        `    JOIN pg_catalog.pg_class policy_relation ON policy_relation.oid = absent_policy.polrelid\n` +
        `    JOIN pg_catalog.pg_namespace policy_schema ON policy_schema.oid = policy_relation.relnamespace\n` +
        `    WHERE policy_schema.nspname = ${sqlLiteral(schemaName)}\n` +
        `      AND policy_relation.relname = ${sqlLiteral(tableName)}\n` +
        `      AND absent_policy.polname = ${sqlLiteral(assertion.policy)}\n` +
        `  )`;
    }
    case "policy_contract":
      return approvedPolicyContractExpression(assertion);
    case "policy_count": {
      const [schemaName, tableName] = assertion.identity.split(".");
      return `(SELECT pg_catalog.count(*)
    FROM pg_catalog.pg_policy counted_policy
    JOIN pg_catalog.pg_class policy_relation ON policy_relation.oid = counted_policy.polrelid
    JOIN pg_catalog.pg_namespace policy_schema ON policy_schema.oid = policy_relation.relnamespace
    WHERE policy_schema.nspname = ${sqlLiteral(schemaName)}
      AND policy_relation.relname = ${sqlLiteral(tableName)}
  ) = ${assertion.count}`;
    }
    case "default_acl_denied":
      return approvedDefaultAclExpression(assertion);
    case "migration_record":
      return `EXISTS (\n` +
        `    SELECT 1 FROM supabase_migrations.schema_migrations migration_record\n` +
        `    WHERE migration_record.version = ${sqlLiteral(assertion.version)}\n` +
        `      AND migration_record.name = ${sqlLiteral(assertion.name)}\n` +
        `      AND migration_record.statements = ` +
        `ARRAY[${sqlLiteral(`sha256:${assertion.sha256}`)}]::text[]\n` +
        `  )`;
    default:
      throw new Error(`Unsupported approved batch catalog assertion: ${assertion.kind}`);
  }
}

export function buildApprovedBatchStateSql(batch, conditionName) {
  validateApprovedBatchManifest({ schema_version: 1, batches: [batch] });
  if (!['preconditions', 'postconditions'].includes(conditionName)) {
    throw new Error("Approved batch condition phase is invalid");
  }
  const versions = [...new Set([
    ...batch.migrations.map((migration) => migration.version),
    ...(batch.preconditions?.required_migration_versions ?? []),
    ...(batch.preconditions?.absent_migration_versions ?? []),
    ...(batch.postconditions?.required_migration_versions ?? []),
    ...(batch.postconditions?.absent_migration_versions ?? []),
  ])].sort();
  const versionList = versions.map(sqlLiteral).join(", ");
  const assertions = batch[conditionName]?.catalog_assertions ?? [];
  const assertionSql = assertions.length === 0
    ? `'[]'::jsonb`
    : `jsonb_build_array(\n${assertions.map((assertion) =>
      `    jsonb_build_object(\n` +
      `      'id', ${sqlLiteral(assertion.id)},\n` +
      `      'passed', (${approvedCatalogAssertionExpression(assertion)})\n` +
      `    )`).join(",\n")}\n  )`;
  return `SELECT jsonb_build_object(\n` +
    `  'project_ref_marker', current_setting('app.viza_project_ref', true),\n` +
    `  'environment_marker', current_setting('app.viza_environment', true),\n` +
    `  'migration_versions', COALESCE((\n` +
    `    SELECT jsonb_agg(version ORDER BY version)\n` +
    `    FROM supabase_migrations.schema_migrations\n` +
    `    WHERE version IN (${versionList})\n` +
    `  ), '[]'::jsonb),\n` +
    `  'assertions', ${assertionSql}\n` +
    `) AS approved_batch_state;`;
}

function parseApprovedBatchState(payload) {
  const state = metadataRow(
    payload,
    "approved_batch_state",
    "Approved migration batch returned an unexpected state payload",
  );
  if (!Array.isArray(state.migration_versions) ||
      (state.assertions !== undefined && !Array.isArray(state.assertions))) {
    throw new Error("Approved migration batch state is not the production database marker");
  }
  if (state.project_ref_marker !== null &&
      state.project_ref_marker !== PRODUCTION_PROJECT_REF) {
    throw new Error("Approved migration batch database project marker is mismatched");
  }
  return state;
}

function assertApprovedBatchConditions(state, conditions, phase) {
  const versions = new Set(state.migration_versions);
  for (const version of conditions?.required_migration_versions ?? []) {
    if (!versions.has(version)) {
      throw new Error(`Approved migration batch ${phase} is missing required migration ${version}`);
    }
  }
  for (const version of conditions?.absent_migration_versions ?? []) {
    if (versions.has(version)) {
      throw new Error(`Approved migration batch ${phase} requires migration ${version} to be absent`);
    }
  }
  const expectedAssertions = conditions?.catalog_assertions ?? [];
  const results = Array.isArray(state.assertions) ? state.assertions : [];
  for (const assertion of expectedAssertions) {
    const matches = results.filter((result) => result?.id === assertion.id);
    if (matches.length !== 1 || matches[0].passed !== true) {
      throw new Error(`Approved migration batch ${phase} catalog guard failed: ${assertion.id}`);
    }
  }
}

async function readApprovedBatchState({
  env,
  fetchImpl,
  batch,
  expectedConfirm,
  conditionName,
  action = "apply-approved-batch",
}) {
  return parseApprovedBatchState(await managementQuery({
    env,
    fetchImpl,
    action,
    query: buildApprovedBatchStateSql(batch, conditionName),
    readOnly: true,
    expectedConfirm,
  }));
}

export async function runApprovedBatchVerify({
  env = process.env,
  fetchImpl = fetch,
  manifest,
} = {}) {
  const token = requiredEnv(env, "SUPABASE_ACCESS_TOKEN");
  const projectRef = requiredEnv(env, "SUPABASE_PROJECT_REF");
  const batchId = requiredEnv(env, "PRODUCTION_DB_MAINTENANCE_BATCH_ID");
  const sourceRef = requiredEnv(env, "PRODUCTION_DB_MAINTENANCE_SOURCE_REF");
  const confirm = requiredEnv(env, "PRODUCTION_DB_MAINTENANCE_CONFIRM");
  if (projectRef !== PRODUCTION_PROJECT_REF) {
    throw new Error("SUPABASE_PROJECT_REF is not the approved production project");
  }
  if (!/^[a-f0-9]{40}$/u.test(sourceRef)) {
    throw new Error("Approved migration_ref must be a full 40-character commit SHA");
  }
  const expectedConfirm =
    `${PRODUCTION_PROJECT_REF}:verify-approved-batch:${batchId}:${sourceRef}`;
  if (confirm !== expectedConfirm) {
    throw new Error("PRODUCTION_DB_MAINTENANCE_CONFIRM does not authorize verify-approved-batch");
  }

  const approvedManifest = validateApprovedBatchManifest(
    manifest ?? loadApprovedBatchManifest(),
  );
  const matchingBatches = approvedManifest.batches.filter((batch) => batch.batch_id === batchId);
  if (matchingBatches.length !== 1) {
    throw new Error(`Migration batch is not uniquely approved in the manifest: ${batchId}`);
  }
  const batch = matchingBatches[0];
  if (sourceRef !== batch.source_ref) {
    throw new Error(`Migration batch source ref is not approved: ${batchId}`);
  }
  assertManagementProjectIdentity(await managementJsonRequest({
    token,
    projectRef,
    suffix: "",
    method: "GET",
    fetchImpl,
  }), projectRef);
  const postflight = await readApprovedBatchState({
    env,
    fetchImpl,
    batch,
    expectedConfirm,
    conditionName: "postconditions",
    action: "verify-approved-batch",
  });
  assertApprovedBatchConditions(postflight, batch.postconditions, "postflight");
  for (const migration of batch.migrations) {
    if (!postflight.migration_versions.includes(migration.version)) {
      throw new Error(`Approved migration ${migration.version} was not recorded`);
    }
  }
  return {
    schema_version: 1,
    source: "approved-migration-batch-verification",
    project_ref: projectRef,
    batch_id: batch.batch_id,
    mode: batch.mode,
    migration_ref: sourceRef,
    migration_versions: postflight.migration_versions,
  };
}

export async function runApprovedBatchApply({
  env = process.env,
  fetchImpl = fetch,
  manifest,
  readFile = readFileSync,
  hash,
  executeMigration = executePsqlMigration,
  downloadCa = downloadSupabaseProductionCa,
} = {}) {
  const token = requiredEnv(env, "SUPABASE_ACCESS_TOKEN");
  const projectRef = requiredEnv(env, "SUPABASE_PROJECT_REF");
  const batchId = requiredEnv(env, "PRODUCTION_DB_MAINTENANCE_BATCH_ID");
  const sourceRef = requiredEnv(env, "PRODUCTION_DB_MAINTENANCE_SOURCE_REF");
  const sourceRoot = requiredEnv(env, "MIGRATION_SOURCE_ROOT");
  const confirm = requiredEnv(env, "PRODUCTION_DB_MAINTENANCE_CONFIRM");
  if (projectRef !== PRODUCTION_PROJECT_REF) {
    throw new Error("SUPABASE_PROJECT_REF is not the approved production project");
  }
  if (!/^[a-f0-9]{40}$/u.test(sourceRef)) {
    throw new Error("Approved migration_ref must be a full 40-character commit SHA");
  }
  const expectedConfirm =
    `${PRODUCTION_PROJECT_REF}:apply-approved-batch:${batchId}:${sourceRef}`;
  if (confirm !== expectedConfirm) {
    throw new Error("PRODUCTION_DB_MAINTENANCE_CONFIRM does not authorize apply-approved-batch");
  }

  const approvedManifest = validateApprovedBatchManifest(
    manifest ?? loadApprovedBatchManifest(),
  );
  const matchingBatches = approvedManifest.batches.filter((batch) => batch.batch_id === batchId);
  if (matchingBatches.length !== 1) {
    throw new Error(`Migration batch is not uniquely approved in the manifest: ${batchId}`);
  }
  const batch = matchingBatches[0];
  if (sourceRef !== batch.source_ref) {
    throw new Error(`Migration batch source ref is not approved: ${batchId}`);
  }
  assertManagementProjectIdentity(await managementJsonRequest({
    token,
    projectRef,
    suffix: "",
    method: "GET",
    fetchImpl,
  }), projectRef);
  const preflight = await readApprovedBatchState({
    env,
    fetchImpl,
    batch,
    expectedConfirm,
    conditionName: "preconditions",
  });
  assertApprovedBatchConditions(preflight, batch.preconditions, "preflight");
  for (const migration of batch.migrations) {
    if (preflight.migration_versions.includes(migration.version)) {
      throw new Error(`Approved migration ${migration.version} is already recorded`);
    }
  }

  const query = loadGenericApprovedBatch({ batch, sourceRoot, readFile, hash });
  const caCertificate = await downloadCa({ fetchImpl });
  let applyError;
  let temporaryRole;
  let loginRoleCreated = false;
  try {
    const temporaryRolePayload = await managementJsonRequest({
      token,
      projectRef,
      suffix: "/cli/login-role",
      method: "POST",
      body: { read_only: false },
      fetchImpl,
    });
    loginRoleCreated = true;
    temporaryRole = parseTemporaryRole(temporaryRolePayload);
    const pooler = parsePrimarySessionPooler(
      await managementJsonRequest({
        token,
        projectRef,
        suffix: "/config/database/pooler",
        method: "GET",
        fetchImpl,
      }),
      projectRef,
    );
    await executeMigration({
      query,
      projectRef,
      ...temporaryRole,
      pooler,
      caCertificate,
    });
  } catch (error) {
    applyError = error;
  }

  let cleanupError;
  if (loginRoleCreated) {
    try {
      await revokeTemporaryRole({ token, projectRef, fetchImpl });
    } catch (error) {
      cleanupError = error;
    }
  }
  if (applyError && cleanupError) {
    throw new AggregateError(
      [applyError, cleanupError],
      "Approved migration batch failed and temporary database access cleanup also failed",
    );
  }
  if (applyError) throw applyError;
  if (cleanupError) throw cleanupError;

  const postflight = await readApprovedBatchState({
    env,
    fetchImpl,
    batch,
    expectedConfirm,
    conditionName: "postconditions",
  });
  assertApprovedBatchConditions(postflight, batch.postconditions, "postflight");
  for (const migration of batch.migrations) {
    if (!postflight.migration_versions.includes(migration.version)) {
      throw new Error(`Approved migration ${migration.version} was not recorded`);
    }
  }
  return {
    schema_version: 1,
    source: "approved-migration-batch-manifest",
    project_ref: projectRef,
    batch_id: batch.batch_id,
    mode: batch.mode,
    migration_ref: sourceRef,
    migration_versions: postflight.migration_versions,
  };
}

async function main() {
  const action = process.env.PRODUCTION_DB_MAINTENANCE_ACTION?.trim() || "preflight";
  const payload =
    action === "preflight"
      ? await runPreflight()
      : action === "architecture-audit"
        ? await runArchitectureAudit()
        : action === "capacity-observe"
          ? await runPassiveCapacityObservation()
          : action === "pause"
            ? await runPause()
            : action === "resume"
              ? await runResume()
              : action === "apply"
                ? await runApply()
                : action === "apply-stable-speed"
                  ? await runStableSpeedApply()
                  : action === "apply-approved-batch"
                    ? await runApprovedBatchApply()
                    : action === "verify-approved-batch"
                      ? await runApprovedBatchVerify()
                      : (() => {
                          throw new Error(
                            `Unsupported production database maintenance action: ${action}`,
                          );
                        })();
  console.log(JSON.stringify(payload, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
