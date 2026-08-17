import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const PRODUCTION_PROJECT_REF = "oyjxdzsoejraedqghndi";
export const APPROVED_MIGRATION_SOURCE_REF = "e80f1d7a71bcc5aca2de11348e4f8b9e7e5a7ef2";
export const SUPABASE_PRODUCTION_CA_URL =
  "https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt";
export const SUPABASE_PRODUCTION_CA_SHA256 =
  "700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7";
export const APPROVED_MIGRATIONS = [
  {
    version: "20260816160000",
    name: "concurrency_phase_two",
    path: "viza-fe/internal-website/supabase/migrations/20260816160000_concurrency_phase_two.sql",
    sha256: "de14085487215c05b1aa90afcb98a9ee0c40fc9873ed0ec1b2da74d03b479a2c",
  },
  {
    version: "20260816161000",
    name: "vietnam_status_settlement_fence",
    path: "viza-fe/internal-website/supabase/migrations/20260816161000_vietnam_status_settlement_fence.sql",
    sha256: "146406a8238b036d900b0d976eb4c8405534742d54831d8514fc6f82cf5f760c",
  },
];

const TAIWAN_CAP = {
  country: "taiwan",
  max_concurrent: 1,
  notes: "Shared pool: Taiwan entry-permit applicant handoff",
};

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
    `INSERT INTO supabase_migrations.schema_migrations (version, statements, name, created_by, idempotency_key)\n` +
      `VALUES (${sqlLiteral(migration.version)}, ARRAY[${sqlLiteral(`sha256:${migration.sha256}`)}]::TEXT[], ` +
      `${sqlLiteral(migration.name)}, 'codex-production-maintenance', ` +
      `${sqlLiteral(`codex-production-cutover:${migration.version}:${migration.sha256}`)});`,
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
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && typeof payload.message === "string"
        ? payload.message
        : "Management API request failed";
    throw new Error(`Supabase temporary database access failed (${response.status}): ${message}`);
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
    ttlSeconds < 60
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
      signal: AbortSignal.timeout(action === "apply" ? 180_000 : 60_000),
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

async function main() {
  const action = process.env.PRODUCTION_DB_MAINTENANCE_ACTION?.trim() || "preflight";
  const payload =
    action === "preflight"
      ? await runPreflight()
      : action === "pause"
        ? await runPause()
        : action === "apply"
          ? await runApply()
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
