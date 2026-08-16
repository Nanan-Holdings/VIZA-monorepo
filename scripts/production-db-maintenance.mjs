import { pathToFileURL } from "node:url";

export const PRODUCTION_PROJECT_REF = "oyjxdzsoejraedqghndi";

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
    )
  )
) AS maintenance_state
FROM runner_counts, legacy_counts, vn_counts, slot_counts,
     cap_snapshot, cron_snapshot, migration_snapshot, ledger_columns;
`;

const expectedCapSnapshotSql = JSON.stringify(EXPECTED_CAP_SNAPSHOT).replaceAll("'", "''");

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

function requiredEnv(env, name) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function managementQuery({
  env,
  fetchImpl,
  action,
  query,
  readOnly,
}) {
  const token = requiredEnv(env, "SUPABASE_ACCESS_TOKEN");
  const projectRef = requiredEnv(env, "SUPABASE_PROJECT_REF");
  const confirm = requiredEnv(env, "PRODUCTION_DB_MAINTENANCE_CONFIRM");

  if (projectRef !== PRODUCTION_PROJECT_REF) {
    throw new Error("SUPABASE_PROJECT_REF is not the approved production project");
  }
  if (confirm !== `${PRODUCTION_PROJECT_REF}:${action}`) {
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
      signal: AbortSignal.timeout(60_000),
    },
  );

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && typeof payload.message === "string"
        ? payload.message
        : "Management API request failed";
    throw new Error(`Supabase ${action} failed (${response.status}): ${message}`);
  }

  return payload;
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

async function main() {
  const action = process.env.PRODUCTION_DB_MAINTENANCE_ACTION?.trim() || "preflight";
  const payload =
    action === "preflight"
      ? await runPreflight()
      : action === "pause"
        ? await runPause()
        : (() => {
            throw new Error(`Unsupported production database maintenance action: ${action}`);
          })();
  console.log(JSON.stringify(payload, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
