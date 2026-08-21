import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  APPROVED_MIGRATION_SOURCE_REF,
  APPROVED_MIGRATIONS,
  ARCHITECTURE_AUDIT_SQL,
  PG_STAT_STATEMENTS_AUDIT_SQL,
  STABLE_SPEED_MIGRATION_SOURCE_REF,
  STABLE_SPEED_MIGRATION,
  PREFLIGHT_SQL,
  PAUSE_SQL,
  RESUME_SQL,
  PRODUCTION_PROJECT_REF,
  EXPECTED_CAP_SNAPSHOT,
  SUPABASE_PRODUCTION_CA_SHA256,
  SUPABASE_PRODUCTION_CA_URL,
  downloadSupabaseProductionCa,
  buildApprovedBatchStateSql,
  executePsqlMigration,
  loadApprovedMigrationBatch,
  loadGenericApprovedBatch,
  runArchitectureAudit,
  runApprovedBatchApply,
  loadStableSpeedMigrationBatch,
  runApply,
  runPause,
  runPreflight,
  runResume,
  runStableSpeedApply,
} from "../production-db-maintenance.mjs";

test("pins the reviewed runner PL/pgSQL repairs", () => {
  assert.equal(APPROVED_MIGRATION_SOURCE_REF, "c4fbff410b958b2ff7e8b2e3f945061a9c33bd4e");
  assert.equal(
    APPROVED_MIGRATIONS.find(({ version }) => version === "20260816160000")?.sha256,
    "9fa7ef4fec051a3a86dae041c0e51e61a17bd3c9aa5cfdaab44f6da6a97c6c00",
  );
});

test("pins the reviewed stable-speed expansion", () => {
  assert.equal(
    STABLE_SPEED_MIGRATION_SOURCE_REF,
    "9278267c5440b1727e04cf4bf5e5b72128457a1d",
  );
  assert.deepEqual(STABLE_SPEED_MIGRATION, {
    version: "20260820152526",
    name: "concurrency_stable_speed",
    path: "viza-fe/internal-website/supabase/migrations/20260820152526_concurrency_stable_speed.sql",
    sha256: "83e981efc32257a266ebebd3d744605afb1ecd43a01ebbd5efe6dcc30a4da841",
  });
});

test("workflow exposes the explicit stable-speed action and exact confirmation", () => {
  const workflow = readFileSync(
    new URL("../../.github/workflows/production-db-maintenance.yml", import.meta.url),
    "utf8",
  );
  assert.match(workflow, /- apply-stable-speed/u);
  assert.match(
    workflow,
    /inputs\.action == 'apply' \|\| inputs\.action == 'apply-stable-speed'/u,
  );
  assert.match(
    workflow,
    /oyjxdzsoejraedqghndi:apply-stable-speed:\{0\}/u,
  );
});

test("workflow exposes architecture audit and generic approved batches", () => {
  const workflow = readFileSync(
    new URL("../../.github/workflows/production-db-maintenance.yml", import.meta.url),
    "utf8",
  );
  assert.match(workflow, /- architecture-audit/u);
  assert.match(workflow, /- apply-approved-batch/u);
  assert.match(workflow, /batch_id:/u);
  assert.match(
    workflow,
    /inputs\.action == 'apply-approved-batch'/u,
  );
  assert.match(
    workflow,
    /apply-approved-batch:\{0\}:\{1\}/u,
  );
  const governanceWorkflow = readFileSync(
    new URL("../../.github/workflows/database-migration-governance.yml", import.meta.url),
    "utf8",
  );
  assert.match(governanceWorkflow, /scripts\/production-db-maintenance\.mjs/u);
  assert.match(governanceWorkflow, /approved-migration-batches\.json/u);
});

test("architecture audit combines sanitized advisors and read-only catalog metadata", async () => {
  const requests = [];
  const result = await runArchitectureAudit({
    env: {
      SUPABASE_ACCESS_TOKEN: "test-token",
      SUPABASE_PROJECT_REF: PRODUCTION_PROJECT_REF,
      PRODUCTION_DB_MAINTENANCE_CONFIRM: `${PRODUCTION_PROJECT_REF}:architecture-audit`,
    },
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      const payload = requests.length === 1
        ? { id: PRODUCTION_PROJECT_REF, ref: PRODUCTION_PROJECT_REF }
        : requests.length === 2
          ? { lints: [{
            name: "rls_disabled_in_public",
            title: "hidden title",
            level: "ERROR",
            facing: "EXTERNAL",
            categories: ["SECURITY"],
            detail: "must not be emitted",
            remediation: "must not be emitted",
            metadata: { schema: "public", name: "runner_job", entity: "runner_job", type: "table" },
          }] }
        : requests.length === 3
          ? { lints: [{
              name: "unindexed_foreign_keys",
              level: "WARN",
              facing: "EXTERNAL",
              categories: ["PERFORMANCE"],
              description: "must not be emitted",
              metadata: { schema: "public", name: "runner_job_fk", entity: "runner_job", type: "table" },
            }] }
          : requests.length === 4
            ? [{ architecture_audit: {
                project_ref_marker: PRODUCTION_PROJECT_REF,
                pg_stat_statements_available: true,
                tables: { total: 10 },
              } }]
            : [{ pg_stat_statements: {
                stats_reset: "2026-08-21T00:00:00Z",
                observation_window_seconds: 3600,
                statements: [{ queryid: "42", calls: 100, mean_exec_time_ms: 1.5 }],
              } }];
      return new Response(JSON.stringify(payload), { status: 200 });
    },
  });

  assert.equal(requests.length, 5);
  assert.match(requests[0].url, new RegExp(`/projects/${PRODUCTION_PROJECT_REF}$`, "u"));
  assert.equal(requests[0].init.method, "GET");
  assert.match(requests[1].url, /advisors\/security$/u);
  assert.match(requests[2].url, /advisors\/performance$/u);
  assert.match(requests[3].url, /database\/query\/read-only$/u);
  assert.match(requests[4].url, /database\/query\/read-only$/u);
  assert.equal(JSON.parse(requests[3].init.body).query, ARCHITECTURE_AUDIT_SQL);
  assert.equal(JSON.parse(requests[4].init.body).query, PG_STAT_STATEMENTS_AUDIT_SQL);
  assert.deepEqual(result.advisors.security.lints, [{
    name: "rls_disabled_in_public",
    level: "ERROR",
    facing: "EXTERNAL",
    categories: ["SECURITY"],
    object: { schema: "public", name: "runner_job", entity: "runner_job", type: "table" },
  }]);
  assert.equal(result.project_ref, PRODUCTION_PROJECT_REF);
  assert.equal(result.sanitization_schema, "viza-architecture-audit-metadata-only-v1");
  assert.deepEqual(result.source.advisor_endpoints, [
    "advisors/security",
    "advisors/performance",
  ]);
  assert.equal(result.source.project_endpoint, `projects/${PRODUCTION_PROJECT_REF}`);
  assert.equal(JSON.stringify(result).includes("must not be emitted"), false);
  assert.deepEqual(result.pg_stat_statements, {
    stats_reset: "2026-08-21T00:00:00Z",
    observation_window_seconds: 3600,
    statements: [{ queryid: "42", calls: 100, mean_exec_time_ms: 1.5 }],
  });
  assert.doesNotMatch(ARCHITECTURE_AUDIT_SQL, /SELECT\s+\*\s+FROM\s+public\./iu);
  assert.doesNotMatch(PG_STAT_STATEMENTS_AUDIT_SQL, /\bquery\b\s*,/iu);
  assert.match(ARCHITECTURE_AUDIT_SQL, /relation_acl/u);
  assert.match(ARCHITECTURE_AUDIT_SQL, /sequence_acl/u);
  assert.match(ARCHITECTURE_AUDIT_SQL, /schema_acl/u);
  assert.match(ARCHITECTURE_AUDIT_SQL, /routine_acl/u);
  assert.match(ARCHITECTURE_AUDIT_SQL, /default_acl/u);
  assert.match(ARCHITECTURE_AUDIT_SQL, /default_acl\.defaclnamespace = 0/u);
  assert.match(ARCHITECTURE_AUDIT_SQL, /idx\.indpred IS NULL/u);
  assert.match(ARCHITECTURE_AUDIT_SQL, /idx\.indexprs IS NULL/u);
  assert.match(ARCHITECTURE_AUDIT_SQL, /generate_subscripts\(con\.conkey/u);
  assert.match(PG_STAT_STATEMENTS_AUDIT_SQL, /stats_reset/u);
  assert.match(PG_STAT_STATEMENTS_AUDIT_SQL, /observation_window_seconds/u);
});

test("architecture audit skips statement metrics when the extension is unavailable", async () => {
  let calls = 0;
  const result = await runArchitectureAudit({
    env: {
      SUPABASE_ACCESS_TOKEN: "test-token",
      SUPABASE_PROJECT_REF: PRODUCTION_PROJECT_REF,
      PRODUCTION_DB_MAINTENANCE_CONFIRM: `${PRODUCTION_PROJECT_REF}:architecture-audit`,
    },
    fetchImpl: async () => {
      calls += 1;
      const payload = calls === 1
        ? { id: PRODUCTION_PROJECT_REF }
        : calls <= 3
          ? { lints: [] }
          : [{ architecture_audit: {
            project_ref_marker: null,
            pg_stat_statements_available: false,
          } }];
      return new Response(JSON.stringify(payload), { status: 200 });
    },
  });
  assert.equal(calls, 4);
  assert.deepEqual(result.pg_stat_statements, {
    stats_reset: null,
    observation_window_seconds: null,
    statements: [],
  });
});

test("architecture audit rejects Management API and optional database identity mismatches", async () => {
  const env = {
    SUPABASE_ACCESS_TOKEN: "test-token",
    SUPABASE_PROJECT_REF: PRODUCTION_PROJECT_REF,
    PRODUCTION_DB_MAINTENANCE_CONFIRM: `${PRODUCTION_PROJECT_REF}:architecture-audit`,
  };
  let calls = 0;
  await assert.rejects(
    runArchitectureAudit({
      env,
      fetchImpl: async () => {
        calls += 1;
        return new Response(JSON.stringify({ id: "wrong-project-ref" }), { status: 200 });
      },
    }),
    /Management API project identity is missing or mismatched/u,
  );
  assert.equal(calls, 1);

  calls = 0;
  await assert.rejects(
    runArchitectureAudit({
      env,
      fetchImpl: async () => {
        calls += 1;
        const payload = calls === 1
          ? { ref: PRODUCTION_PROJECT_REF }
          : calls <= 3
            ? { lints: [] }
            : [{ architecture_audit: {
                project_ref_marker: "wrong-project-ref",
                pg_stat_statements_available: false,
              } }];
        return new Response(JSON.stringify(payload), { status: 200 });
      },
    }),
    /database project marker is mismatched/u,
  );
  assert.equal(calls, 4);
});

const genericBatchManifest = {
  schema_version: 1,
  batches: [{
    batch_id: "database-access-baseline-v1",
    source_ref: "a".repeat(40),
    mode: "transactional",
    migrations: [{
      version: "20260822000000",
      name: "database_access_baseline",
      path: "viza-fe/internal-website/supabase/migrations/20260822000000_database_access_baseline.sql",
      sha256: "a".repeat(64),
    }],
    preconditions: {
      required_migration_versions: ["20260820152526"],
      absent_migration_versions: ["20260822000000"],
    },
    postconditions: {
      required_migration_versions: ["20260822000000"],
    },
  }],
};

test("approved batch state SQL supports only structured exact catalog guards", () => {
  const batch = {
    ...genericBatchManifest.batches[0],
    preconditions: {
      ...genericBatchManifest.batches[0].preconditions,
      catalog_assertions: [
        { id: "users_exists", kind: "relation_exists", identity: "public.users" },
        {
          id: "translations_compatible",
          kind: "table_absent_or_columns_match",
          identity: "public.application_translations",
          columns: [
            { name: "id", type: "uuid", nullable: false },
            { name: "field_key", type: "text", nullable: false },
          ],
        },
        {
          id: "commit_rpc_signature",
          kind: "function_exists",
          identity: "public.commit_travel_agent_turn(text,uuid,text,bigint,text,text,jsonb,text,text,jsonb,jsonb)",
        },
        {
          id: "future_objects_private",
          kind: "default_acl_denied",
          owner_roles: ["postgres"],
          object_types: ["r", "S", "f"],
          denied_roles: ["PUBLIC", "anon", "authenticated", "service_role"],
        },
      ],
    },
  };
  const sql = buildApprovedBatchStateSql(batch, "preconditions");
  assert.match(sql, /public\.users/u);
  assert.match(sql, /public\.application_translations/u);
  assert.match(sql, /information_schema\.columns/u);
  assert.match(sql, /commit_travel_agent_turn/u);
  assert.match(sql, /default_scope\.namespace_oid/u);
  assert.match(sql, /VALUES \(0::oid, TRUE\)/u);
  assert.doesNotMatch(sql, /SELECT\s+\*\s+FROM\s+public\./iu);

  assert.throws(
    () => buildApprovedBatchStateSql({
      ...batch,
      preconditions: {
        catalog_assertions: [{ id: "unsafe", kind: "raw_sql", sql: "SELECT true" }],
      },
    }, "preconditions"),
    /Unsupported approved batch catalog assertion/u,
  );
});

test("generic approved batch is hash-pinned and transactionally ledgered", () => {
  const query = loadGenericApprovedBatch({
    batch: genericBatchManifest.batches[0],
    sourceRoot: "/approved-source",
    readFile: () => Buffer.from("SELECT 1;"),
    hash: () => "a".repeat(64),
  });
  assert.match(query, /^SET SESSION ROLE postgres;\nBEGIN;/u);
  assert.match(query, /SET LOCAL lock_timeout = '5s'/u);
  assert.match(query, /20260822000000/u);
  assert.match(query, /INSERT INTO supabase_migrations\.schema_migrations/u);
  assert.match(query, /COMMIT;/u);
});

test("generic concurrent-index batch permits only online idempotent index statements", () => {
  const batch = {
    ...genericBatchManifest.batches[0],
    mode: "concurrent-index",
    migrations: genericBatchManifest.batches[0].migrations.map((migration) => ({
      ...migration,
      indexes: [{
        identity: "public.idx_example",
        definition: "CREATE INDEX idx_example ON public.example USING btree (id)",
      }],
    })),
  };
  const query = loadGenericApprovedBatch({
    batch,
    sourceRoot: "/approved-source",
    readFile: () => Buffer.from(
      "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_example ON public.example (id);",
    ),
    hash: () => "a".repeat(64),
  });
  assert.match(query, /CREATE INDEX CONCURRENTLY IF NOT EXISTS/u);
  assert.match(query, /indisvalid/u);
  assert.match(query, /indisready/u);
  assert.match(query, /pg_get_indexdef/u);
  assert.match(query, /DROP INDEX CONCURRENTLY/u);
  assert.match(query, /\\gexec/u);
  assert.match(query, /BEGIN;\nINSERT INTO supabase_migrations/u);
  assert.doesNotMatch(query, /^SET SESSION ROLE postgres;\nBEGIN;/u);

  assert.throws(
    () => loadGenericApprovedBatch({
      batch,
      sourceRoot: "/approved-source",
      readFile: () => Buffer.from("CREATE INDEX idx_unsafe ON public.example (id);"),
      hash: () => "a".repeat(64),
    }),
    /online CREATE INDEX CONCURRENTLY IF NOT EXISTS/u,
  );

  assert.throws(
    () => loadGenericApprovedBatch({
      batch,
      sourceRoot: "/approved-source",
      readFile: () => Buffer.from(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ok ON public.example (id); DELETE FROM public.example;",
      ),
      hash: () => "a".repeat(64),
    }),
    /online CREATE INDEX CONCURRENTLY IF NOT EXISTS/u,
  );
});

test("generic approved batch performs guarded preflight, apply, cleanup, and postflight", async () => {
  const migrationRef = "a".repeat(40);
  const requests = [];
  let execution;
  const result = await runApprovedBatchApply({
    env: {
      SUPABASE_ACCESS_TOKEN: "test-token",
      SUPABASE_PROJECT_REF: PRODUCTION_PROJECT_REF,
      PRODUCTION_DB_MAINTENANCE_ACTION: "apply-approved-batch",
      PRODUCTION_DB_MAINTENANCE_BATCH_ID: "database-access-baseline-v1",
      PRODUCTION_DB_MAINTENANCE_SOURCE_REF: migrationRef,
      PRODUCTION_DB_MAINTENANCE_CONFIRM:
        `${PRODUCTION_PROJECT_REF}:apply-approved-batch:database-access-baseline-v1:${migrationRef}`,
      MIGRATION_SOURCE_ROOT: "/approved-source",
    },
    manifest: genericBatchManifest,
    readFile: () => Buffer.from("SELECT 1;"),
    hash: () => "a".repeat(64),
    downloadCa: async () => Buffer.from("pinned-ca"),
    executeMigration: async (input) => { execution = input; },
    fetchImpl: async (url, init) => {
      requests.push({ url, method: init.method });
      const payload = requests.length === 1
        ? [{ approved_batch_state: {
            project_ref_marker: PRODUCTION_PROJECT_REF,
            migration_versions: ["20260820152526"],
          } }]
        : requests.length === 2
          ? { role: "cli_login_postgres", password: "temporary-password-123", ttl_seconds: 300 }
          : requests.length === 3
            ? [{
                database_type: "PRIMARY",
                db_host: "aws-1-ap-south-1.pooler.supabase.com",
                db_port: 5432,
                db_name: "postgres",
                db_user: `postgres.${PRODUCTION_PROJECT_REF}`,
                pool_mode: "session",
              }]
            : requests.length === 4
              ? { message: "ok" }
              : [{ approved_batch_state: {
                  project_ref_marker: PRODUCTION_PROJECT_REF,
                  migration_versions: ["20260820152526", "20260822000000"],
                } }];
      return new Response(JSON.stringify(payload), { status: 200 });
    },
  });

  assert.equal(requests.length, 5);
  assert.match(requests[0].url, /database\/query\/read-only$/u);
  assert.match(requests[4].url, /database\/query\/read-only$/u);
  assert.match(execution.query, /20260822000000/u);
  assert.equal(result.batch_id, "database-access-baseline-v1");
  assert.deepEqual(result.migration_versions, ["20260820152526", "20260822000000"]);
});

test("generic approved batch rejects a short ref and source hash drift", async () => {
  await assert.rejects(
    runApprovedBatchApply({
      env: {
        SUPABASE_ACCESS_TOKEN: "test-token",
        SUPABASE_PROJECT_REF: PRODUCTION_PROJECT_REF,
        PRODUCTION_DB_MAINTENANCE_BATCH_ID: "database-access-baseline-v1",
        PRODUCTION_DB_MAINTENANCE_SOURCE_REF: "main",
        PRODUCTION_DB_MAINTENANCE_CONFIRM:
          `${PRODUCTION_PROJECT_REF}:apply-approved-batch:database-access-baseline-v1:main`,
        MIGRATION_SOURCE_ROOT: "/approved-source",
      },
      manifest: genericBatchManifest,
      fetchImpl: async () => { throw new Error("must not fetch"); },
    }),
    /full 40-character commit SHA/u,
  );

  assert.throws(
    () => loadGenericApprovedBatch({
      batch: genericBatchManifest.batches[0],
      sourceRoot: "/approved-source",
      readFile: () => Buffer.from("changed"),
      hash: () => "wrong-hash",
    }),
    /hash mismatch/u,
  );
});

test("generic approved batch rejects an unlisted batch before any request", async () => {
  const migrationRef = "b".repeat(40);
  await assert.rejects(
    runApprovedBatchApply({
      env: {
        SUPABASE_ACCESS_TOKEN: "test-token",
        SUPABASE_PROJECT_REF: PRODUCTION_PROJECT_REF,
        PRODUCTION_DB_MAINTENANCE_BATCH_ID: "not-approved",
        PRODUCTION_DB_MAINTENANCE_SOURCE_REF: migrationRef,
        PRODUCTION_DB_MAINTENANCE_CONFIRM:
          `${PRODUCTION_PROJECT_REF}:apply-approved-batch:not-approved:${migrationRef}`,
        MIGRATION_SOURCE_ROOT: "/approved-source",
      },
      manifest: genericBatchManifest,
      fetchImpl: async () => { throw new Error("must not fetch"); },
    }),
    /not uniquely approved/u,
  );
});

test("generic approved batch rejects source-ref drift and failed catalog guards", async () => {
  const wrongRef = "c".repeat(40);
  await assert.rejects(
    runApprovedBatchApply({
      env: {
        SUPABASE_ACCESS_TOKEN: "test-token",
        SUPABASE_PROJECT_REF: PRODUCTION_PROJECT_REF,
        PRODUCTION_DB_MAINTENANCE_BATCH_ID: "database-access-baseline-v1",
        PRODUCTION_DB_MAINTENANCE_SOURCE_REF: wrongRef,
        PRODUCTION_DB_MAINTENANCE_CONFIRM:
          `${PRODUCTION_PROJECT_REF}:apply-approved-batch:database-access-baseline-v1:${wrongRef}`,
        MIGRATION_SOURCE_ROOT: "/approved-source",
      },
      manifest: genericBatchManifest,
      fetchImpl: async () => { throw new Error("must not fetch"); },
    }),
    /source ref is not approved/u,
  );

  const guardedManifest = structuredClone(genericBatchManifest);
  guardedManifest.batches[0].preconditions.catalog_assertions = [{
    id: "users_exists",
    kind: "relation_exists",
    identity: "public.users",
  }];
  await assert.rejects(
    runApprovedBatchApply({
      env: {
        SUPABASE_ACCESS_TOKEN: "test-token",
        SUPABASE_PROJECT_REF: PRODUCTION_PROJECT_REF,
        PRODUCTION_DB_MAINTENANCE_BATCH_ID: "database-access-baseline-v1",
        PRODUCTION_DB_MAINTENANCE_SOURCE_REF: "a".repeat(40),
        PRODUCTION_DB_MAINTENANCE_CONFIRM:
          `${PRODUCTION_PROJECT_REF}:apply-approved-batch:database-access-baseline-v1:${"a".repeat(40)}`,
        MIGRATION_SOURCE_ROOT: "/approved-source",
      },
      manifest: guardedManifest,
      fetchImpl: async () => new Response(JSON.stringify([{
        approved_batch_state: {
          project_ref_marker: PRODUCTION_PROJECT_REF,
          migration_versions: ["20260820152526"],
          assertions: [{ id: "users_exists", passed: false }],
        },
      }]), { status: 200 }),
    }),
    /catalog guard failed: users_exists/u,
  );
});

test("temporary login role TTL is bounded and ambiguous creation is always revoked", async () => {
  const env = {
    SUPABASE_ACCESS_TOKEN: "test-token",
    SUPABASE_PROJECT_REF: PRODUCTION_PROJECT_REF,
    PRODUCTION_DB_MAINTENANCE_CONFIRM:
      `${PRODUCTION_PROJECT_REF}:apply:${APPROVED_MIGRATION_SOURCE_REF}`,
    PRODUCTION_DB_MAINTENANCE_SOURCE_REF: APPROVED_MIGRATION_SOURCE_REF,
    MIGRATION_SOURCE_ROOT: "/approved-source",
  };
  const methods = [];
  await assert.rejects(
    runApply({
      env,
      readFile: (filePath) => Buffer.from(`sql:${filePath}`),
      hash: (bytes) => {
        const filePath = bytes.toString("utf8").slice(4).replaceAll("\\", "/");
        return APPROVED_MIGRATIONS.find((migration) => filePath.endsWith(migration.path)).sha256;
      },
      downloadCa: async () => Buffer.from("pinned-ca"),
      fetchImpl: async (url, init) => {
        methods.push({ url, method: init.method });
        if (url.endsWith("/database/query/read-only")) {
          return new Response(JSON.stringify(drainedPreflightPayload()), { status: 200 });
        }
        if (url.endsWith("/cli/login-role") && init.method === "POST") {
          return new Response(JSON.stringify({
            role: "cli_login_postgres",
            password: "temporary-password-123",
            ttl_seconds: 3600,
          }), { status: 200 });
        }
        if (url.endsWith("/cli/login-role") && init.method === "DELETE") {
          return new Response(JSON.stringify({ message: "ok" }), { status: 200 });
        }
        throw new Error(`unexpected request: ${url}`);
      },
    }),
    /invalid temporary database role/u,
  );
  assert.equal(methods.at(-1).method, "DELETE");

  methods.length = 0;
  await assert.rejects(
    runApply({
      env,
      readFile: (filePath) => Buffer.from(`sql:${filePath}`),
      hash: (bytes) => {
        const filePath = bytes.toString("utf8").slice(4).replaceAll("\\", "/");
        return APPROVED_MIGRATIONS.find((migration) => filePath.endsWith(migration.path)).sha256;
      },
      downloadCa: async () => Buffer.from("pinned-ca"),
      fetchImpl: async (url, init) => {
        methods.push({ url, method: init.method });
        if (url.endsWith("/database/query/read-only")) {
          return new Response(JSON.stringify(drainedPreflightPayload()), { status: 200 });
        }
        if (url.endsWith("/cli/login-role") && init.method === "POST") {
          return new Response(JSON.stringify({ message: "ambiguous" }), { status: 503 });
        }
        if (url.endsWith("/cli/login-role") && init.method === "DELETE") {
          return new Response(JSON.stringify({ message: "not found" }), { status: 404 });
        }
        throw new Error(`unexpected request: ${url}`);
      },
    }),
    /temporary database access failed/u,
  );
  assert.equal(methods.at(-1).method, "DELETE");
});

test("preflight uses the read-only Management API and aggregate-only SQL", async () => {
  let request;
  const payload = [{ maintenance_state: { runner_jobs: { running: 0 } } }];
  const result = await runPreflight({
    env: {
      SUPABASE_ACCESS_TOKEN: "test-token",
      SUPABASE_PROJECT_REF: PRODUCTION_PROJECT_REF,
      PRODUCTION_DB_MAINTENANCE_CONFIRM: `${PRODUCTION_PROJECT_REF}:preflight`,
    },
    fetchImpl: async (url, init) => {
      request = { url, init };
      return new Response(JSON.stringify(payload), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    },
  });

  assert.deepEqual(result, payload);
  assert.match(request.url, /database\/query\/read-only$/u);
  assert.equal(request.init.method, "POST");
  assert.equal(request.init.headers.authorization, "Bearer test-token");
  assert.deepEqual(JSON.parse(request.init.body), {
    query: PREFLIGHT_SQL,
    parameters: [],
  });
  assert.match(PREFLIGHT_SQL, /COUNT\(\*\) FILTER/u);
  assert.doesNotMatch(PREFLIGHT_SQL, /SELECT\s+\*\s+FROM\s+public\.(applications|applicant_profiles)/iu);
});

test("production CA download is HTTPS-only and pinned before psql use", async () => {
  const pem = "-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----\n";
  let request;
  const result = await downloadSupabaseProductionCa({
    fetchImpl: async (url, init) => {
      request = { url, init };
      return new Response(pem, { status: 200 });
    },
    hash: () => SUPABASE_PRODUCTION_CA_SHA256,
  });
  assert.equal(request.url, SUPABASE_PRODUCTION_CA_URL);
  assert.match(request.url, /^https:\/\//u);
  assert.equal(request.init.method, "GET");
  assert.equal(result.toString("utf8"), pem);

  await assert.rejects(
    downloadSupabaseProductionCa({
      fetchImpl: async () => new Response(pem, { status: 200 }),
      hash: () => "unexpected-hash",
    }),
    /pinned integrity check/u,
  );
});

function drainedPreflightPayload() {
  return [
    {
      maintenance_state: {
        runner_jobs: { running: 0, queued: 0 },
        legacy_processing_or_live_locked: 0,
        vn_status_running: 0,
        live_machine_slots: 0,
        caps: EXPECTED_CAP_SNAPSHOT.map((cap) => ({ ...cap, paused: true })),
        vn_status_cron: [],
        strict_objects: {
          runner_private_schema: false,
          vn_lease_generation_column: false,
        },
        recent_migrations: [{ version: "20260816134048" }],
      },
    },
  ];
}

function migratedPreflightPayload() {
  return [
    {
      maintenance_state: {
        runner_jobs: { running: 0, queued: 0 },
        legacy_processing_or_live_locked: 0,
        vn_status_running: 0,
        live_machine_slots: 0,
        caps: [
          ...EXPECTED_CAP_SNAPSHOT.map((cap) => ({ ...cap, paused: true })),
          {
            country: "taiwan",
            max_concurrent: 1,
            paused: true,
            notes: "Shared pool: Taiwan entry-permit applicant handoff",
          },
        ].sort((left, right) => left.country.localeCompare(right.country)),
        vn_status_cron: [],
        strict_objects: {
          runner_private_schema: true,
          load_claim_rpc: true,
          vn_generation_claim_rpc: true,
          vn_lease_generation_column: true,
        },
        recent_migrations: [
          { version: "20260816134048" },
          { version: "20260816160000" },
          { version: "20260816161000" },
        ],
      },
    },
  ];
}

function stableSpeedPreflightPayload({ migrated = false } = {}) {
  const state = migratedPreflightPayload()[0].maintenance_state;
  state.caps = state.caps.map((cap) => ({ ...cap, paused: false }));
  Object.assign(state.strict_objects, {
    stable_slot_renew_rpc: migrated,
    stable_pool_health_view: migrated,
    stable_slot_health_view: migrated,
    stable_metric_table: migrated,
    stable_acl_ok: migrated,
  });
  if (migrated) {
    state.recent_migrations.push({
      version: STABLE_SPEED_MIGRATION.version,
      name: STABLE_SPEED_MIGRATION.name,
    });
  }
  return [{ maintenance_state: state }];
}

test("stable-speed apply is hash-pinned, online, and preserves the cap snapshot", async () => {
  const requests = [];
  let execution;
  const result = await runStableSpeedApply({
    env: {
      SUPABASE_ACCESS_TOKEN: "test-token",
      SUPABASE_PROJECT_REF: PRODUCTION_PROJECT_REF,
      PRODUCTION_DB_MAINTENANCE_CONFIRM:
        `${PRODUCTION_PROJECT_REF}:apply-stable-speed:${STABLE_SPEED_MIGRATION_SOURCE_REF}`,
      PRODUCTION_DB_MAINTENANCE_SOURCE_REF: STABLE_SPEED_MIGRATION_SOURCE_REF,
      MIGRATION_SOURCE_ROOT: "/approved-source",
    },
    readFile: (filePath) => Buffer.from(`sql:${filePath}`),
    hash: () => STABLE_SPEED_MIGRATION.sha256,
    executeMigration: async (input) => {
      execution = input;
    },
    downloadCa: async () => Buffer.from("pinned-ca"),
    fetchImpl: async (url, init) => {
      requests.push({ url, method: init.method });
      const payload = requests.length === 1
        ? stableSpeedPreflightPayload()
        : requests.length === 2
          ? { role: "cli_login_postgres", password: "temporary-password-123", ttl_seconds: 300 }
          : requests.length === 3
            ? [{
                database_type: "PRIMARY",
                db_host: "aws-1-ap-south-1.pooler.supabase.com",
                db_port: 5432,
                db_name: "postgres",
                db_user: `postgres.${PRODUCTION_PROJECT_REF}`,
                pool_mode: "session",
              }]
            : requests.length === 4
              ? { message: "ok" }
              : stableSpeedPreflightPayload({ migrated: true });
      return new Response(JSON.stringify(payload), { status: 200 });
    },
  });

  assert.equal(requests.length, 5);
  assert.match(execution.query, /^SET SESSION ROLE postgres;\nBEGIN;/u);
  assert.match(execution.query, /SET LOCAL lock_timeout = '5s'/u);
  assert.match(execution.query, /pg_advisory_xact_lock/u);
  assert.match(execution.query, /20260820152526/u);
  assert.match(execution.query, /renew_runner_machine_slot/u);
  assert.doesNotMatch(execution.query, /UPDATE\s+public\.runner_(?:job|machine_slot|concurrency_cap)/iu);
  assert.doesNotMatch(execution.query, /DELETE\s+FROM/iu);
  assert.deepEqual(result, stableSpeedPreflightPayload({ migrated: true }));
});

test("stable-speed migration rejects source hash drift", () => {
  assert.throws(
    () => loadStableSpeedMigrationBatch({
      sourceRoot: "/wrong-source",
      readFile: () => Buffer.from("changed"),
      hash: () => "wrong",
    }),
    /hash mismatch/u,
  );
});

test("apply reads only the approved ref and exact migration hashes", async () => {
  const requests = [];
  let execution;
  const result = await runApply({
    env: {
      SUPABASE_ACCESS_TOKEN: "test-token",
      SUPABASE_PROJECT_REF: PRODUCTION_PROJECT_REF,
      PRODUCTION_DB_MAINTENANCE_CONFIRM: `${PRODUCTION_PROJECT_REF}:apply:${APPROVED_MIGRATION_SOURCE_REF}`,
      PRODUCTION_DB_MAINTENANCE_SOURCE_REF: APPROVED_MIGRATION_SOURCE_REF,
      MIGRATION_SOURCE_ROOT: "/approved-source",
    },
    readFile: (filePath) => Buffer.from(`sql:${filePath}`),
    hash: (bytes) => {
      const filePath = bytes.toString("utf8").slice(4).replaceAll("\\", "/");
      return APPROVED_MIGRATIONS.find((migration) => filePath.endsWith(migration.path)).sha256;
    },
    executeMigration: async (input) => {
      execution = input;
    },
    downloadCa: async () => Buffer.from("pinned-ca"),
    fetchImpl: async (url, init) => {
      requests.push({
        url,
        method: init.method,
        body: init.body === undefined ? undefined : JSON.parse(init.body),
      });
      const payload = requests.length === 1
        ? drainedPreflightPayload()
        : requests.length === 2
          ? { role: "cli_login_postgres", password: "temporary-password-123", ttl_seconds: 300 }
          : requests.length === 3
            ? [{
                database_type: "PRIMARY",
                db_host: "aws-1-ap-south-1.pooler.supabase.com",
                db_port: 6543,
                db_name: "postgres",
                db_user: `postgres.${PRODUCTION_PROJECT_REF}`,
                pool_mode: "transaction",
              }]
            : requests.length === 4
              ? { message: "ok" }
              : migratedPreflightPayload();
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  assert.equal(requests.length, 5);
  assert.match(requests[0].url, /database\/query\/read-only$/u);
  assert.match(requests[1].url, /cli\/login-role$/u);
  assert.equal(requests[1].method, "POST");
  assert.deepEqual(requests[1].body, { read_only: false });
  assert.match(requests[2].url, /config\/database\/pooler$/u);
  assert.equal(requests[2].method, "GET");
  assert.match(requests[3].url, /cli\/login-role$/u);
  assert.equal(requests[3].method, "DELETE");
  assert.match(requests[4].url, /database\/query\/read-only$/u);
  assert.match(execution.query, /^SET SESSION ROLE postgres;\nBEGIN;/u);
  assert.match(execution.query, /20260816160000/u);
  assert.match(execution.query, /20260816161000/u);
  assert.match(execution.query, /pause_taiwan_cap/u);
  assert.match(execution.query, /COMMIT;/u);
  assert.equal(execution.role, "cli_login_postgres");
  assert.equal(execution.password, "temporary-password-123");
  assert.deepEqual(execution.pooler, {
    host: "aws-1-ap-south-1.pooler.supabase.com",
    port: 5432,
    database: "postgres",
  });
  assert.equal(execution.caCertificate.toString("utf8"), "pinned-ca");
  assert.deepEqual(result, migratedPreflightPayload());
});

test("psql apply keeps the password out of args and removes its temporary SQL", () => {
  const calls = [];
  const writes = [];
  const removals = [];
  executePsqlMigration({
    query: "SET SESSION ROLE postgres;\nBEGIN;\nCOMMIT;",
    projectRef: PRODUCTION_PROJECT_REF,
    role: "cli_login_postgres",
    password: "temporary-password-123",
    caCertificate: Buffer.from("pinned-ca"),
    pooler: {
      host: "aws-1-ap-south-1.pooler.supabase.com",
      port: 5432,
      database: "postgres",
    },
    spawn: (command, args, options) => {
      calls.push({ command, args, options });
      return { status: 0 };
    },
    makeTempDir: () => "/safe/temp/migration",
    writeTempFile: (filePath, contents) => writes.push({ filePath, contents }),
    removeTempDir: (dirPath) => removals.push(dirPath),
    parentEnv: {
      PATH: "/usr/bin",
      SUPABASE_ACCESS_TOKEN: "management-token-must-not-reach-psql",
      PRODUCTION_DB_MAINTENANCE_CONFIRM: "production-confirmation",
      PGOPTIONS: "-c search_path=attacker_controlled",
      PGSERVICE: "unexpected-service",
    },
  });

  assert.equal(calls.length, 3);
  assert.deepEqual(calls[0].args, ["--version"]);
  const permissionProbe = calls[1];
  assert.match(permissionProbe.args.at(-1), /SET SESSION ROLE postgres/u);
  assert.equal(permissionProbe.args.includes("--no-psqlrc"), true);
  const applyCall = calls[2];
  assert.equal(applyCall.command, "psql");
  assert.equal(applyCall.args.includes("temporary-password-123"), false);
  assert.deepEqual(applyCall.args.slice(0, 9), [
    "--no-psqlrc",
    "--host", "aws-1-ap-south-1.pooler.supabase.com",
    "--port", "5432",
    "--username", `cli_login_postgres.${PRODUCTION_PROJECT_REF}`,
    "--dbname", "postgres",
  ]);
  assert.equal(applyCall.options.env.PGPASSWORD, "temporary-password-123");
  assert.equal(applyCall.options.env.PGSSLMODE, "verify-full");
  assert.match(applyCall.options.env.PGSSLROOTCERT, /supabase-prod-ca-2021\.crt$/u);
  assert.equal(applyCall.options.env.SUPABASE_ACCESS_TOKEN, undefined);
  assert.equal(applyCall.options.env.PRODUCTION_DB_MAINTENANCE_CONFIRM, undefined);
  assert.equal(applyCall.options.env.PGOPTIONS, undefined);
  assert.equal(applyCall.options.env.PGSERVICE, undefined);
  assert.equal(writes.length, 2);
  assert.match(writes[0].filePath, /supabase-prod-ca-2021\.crt$/u);
  assert.equal(writes[0].contents.toString("utf8"), "pinned-ca");
  assert.match(writes[1].filePath, /approved-production-migrations\.sql$/u);
  assert.deepEqual(removals, ["/safe/temp/migration"]);
});

test("apply revokes the temporary role when psql fails", async () => {
  const methods = [];
  await assert.rejects(
    runApply({
      env: {
        SUPABASE_ACCESS_TOKEN: "test-token",
        SUPABASE_PROJECT_REF: PRODUCTION_PROJECT_REF,
        PRODUCTION_DB_MAINTENANCE_CONFIRM: `${PRODUCTION_PROJECT_REF}:apply:${APPROVED_MIGRATION_SOURCE_REF}`,
        PRODUCTION_DB_MAINTENANCE_SOURCE_REF: APPROVED_MIGRATION_SOURCE_REF,
        MIGRATION_SOURCE_ROOT: "/approved-source",
      },
      readFile: (filePath) => Buffer.from(`sql:${filePath}`),
      hash: (bytes) => {
        const filePath = bytes.toString("utf8").slice(4).replaceAll("\\", "/");
        return APPROVED_MIGRATIONS.find((migration) => filePath.endsWith(migration.path)).sha256;
      },
      executeMigration: async () => {
        throw new Error("synthetic psql failure");
      },
      downloadCa: async () => Buffer.from("pinned-ca"),
      fetchImpl: async (url, init) => {
        methods.push({ url, method: init.method });
        const payload = methods.length === 1
          ? drainedPreflightPayload()
          : methods.length === 2
            ? { role: "cli_login_postgres", password: "temporary-password-123", ttl_seconds: 300 }
            : methods.length === 3
              ? [{
                  database_type: "PRIMARY",
                  db_host: "aws-1-ap-south-1.pooler.supabase.com",
                  db_port: 5432,
                  db_name: "postgres",
                  db_user: `postgres.${PRODUCTION_PROJECT_REF}`,
                  pool_mode: "session",
                }]
              : { message: "ok" };
        return new Response(JSON.stringify(payload), { status: 200 });
      },
    }),
    /synthetic psql failure/u,
  );
  assert.equal(methods.at(-1).method, "DELETE");
  assert.match(methods.at(-1).url, /cli\/login-role$/u);
});

test("apply retries temporary role revocation before returning success", async () => {
  let deleteAttempts = 0;
  const result = await runApply({
    env: {
      SUPABASE_ACCESS_TOKEN: "test-token",
      SUPABASE_PROJECT_REF: PRODUCTION_PROJECT_REF,
      PRODUCTION_DB_MAINTENANCE_CONFIRM: `${PRODUCTION_PROJECT_REF}:apply:${APPROVED_MIGRATION_SOURCE_REF}`,
      PRODUCTION_DB_MAINTENANCE_SOURCE_REF: APPROVED_MIGRATION_SOURCE_REF,
      MIGRATION_SOURCE_ROOT: "/approved-source",
    },
    readFile: (filePath) => Buffer.from(`sql:${filePath}`),
    hash: (bytes) => {
      const filePath = bytes.toString("utf8").slice(4).replaceAll("\\", "/");
      return APPROVED_MIGRATIONS.find((migration) => filePath.endsWith(migration.path)).sha256;
    },
    executeMigration: async () => {},
    downloadCa: async () => Buffer.from("pinned-ca"),
    fetchImpl: async (url, init) => {
      if (url.endsWith("/database/query/read-only")) {
        return new Response(
          JSON.stringify(deleteAttempts === 0 ? drainedPreflightPayload() : migratedPreflightPayload()),
          { status: 200 },
        );
      }
      if (url.endsWith("/cli/login-role") && init.method === "POST") {
        return new Response(JSON.stringify({
          role: "cli_login_postgres",
          password: "temporary-password-123",
          ttl_seconds: 300,
        }), { status: 200 });
      }
      if (url.endsWith("/config/database/pooler")) {
        return new Response(JSON.stringify([{
          database_type: "PRIMARY",
          db_host: "aws-1-ap-south-1.pooler.supabase.com",
          db_port: 6543,
          db_name: "postgres",
          db_user: `postgres.${PRODUCTION_PROJECT_REF}`,
          pool_mode: "transaction",
        }]), { status: 200 });
      }
      if (url.endsWith("/cli/login-role") && init.method === "DELETE") {
        deleteAttempts += 1;
        return new Response(
          JSON.stringify(deleteAttempts < 3 ? { message: "retry" } : { message: "ok" }),
          { status: deleteAttempts < 3 ? 503 : 200 },
        );
      }
      throw new Error(`unexpected request: ${url}`);
    },
  });
  assert.equal(deleteAttempts, 3);
  assert.deepEqual(result, migratedPreflightPayload());
});

test("migration batch rejects any hash drift", () => {
  assert.throws(
    () => loadApprovedMigrationBatch({
      sourceRoot: "/wrong-source",
      readFile: () => Buffer.from("changed"),
      hash: () => "wrong",
    }),
    /hash mismatch/u,
  );
});

test("migration batch writes only the portable Supabase CLI ledger columns", () => {
  const batch = loadApprovedMigrationBatch({
    sourceRoot: "/approved-source",
    readFile: (filePath) => Buffer.from(`sql:${filePath}`),
    hash: (bytes) => {
      const filePath = bytes.toString("utf8").slice(4).replaceAll("\\", "/");
      return APPROVED_MIGRATIONS.find((migration) => filePath.endsWith(migration.path)).sha256;
    },
  });

  assert.match(
    batch,
    /INSERT INTO supabase_migrations\.schema_migrations \(version, statements, name\)/u,
  );
  assert.doesNotMatch(batch, /created_by|idempotency_key/u);
});

test("pause uses the write endpoint with exact snapshot and atomic guards", async () => {
  let request;
  const payload = [{ maintenance_pause_state: { runner_jobs_running: 0 } }];
  const result = await runPause({
    env: {
      SUPABASE_ACCESS_TOKEN: "test-token",
      SUPABASE_PROJECT_REF: PRODUCTION_PROJECT_REF,
      PRODUCTION_DB_MAINTENANCE_CONFIRM: `${PRODUCTION_PROJECT_REF}:pause`,
    },
    fetchImpl: async (url, init) => {
      request = { url, init };
      return new Response(JSON.stringify(payload), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    },
  });

  assert.deepEqual(result, payload);
  assert.match(request.url, /database\/query$/u);
  const body = JSON.parse(request.init.body);
  assert.equal(body.read_only, false);
  assert.equal(body.query, PAUSE_SQL);
  assert.match(PAUSE_SQL, /BEGIN;[\s\S]*COMMIT;/u);
  assert.match(PAUSE_SQL, /pg_advisory_xact_lock/u);
  assert.match(PAUSE_SQL, /cron\.unschedule/u);
  assert.match(PAUSE_SQL, /production queues are not drained/u);
  assert.equal(PAUSE_SQL.includes(JSON.stringify(EXPECTED_CAP_SNAPSHOT[0]).slice(0, 20)), true);
  assert.doesNotMatch(PAUSE_SQL, /UPDATE\s+public\.runner_job/iu);
  assert.doesNotMatch(PAUSE_SQL, /DELETE\s+FROM/iu);
});

test("resume restores exact caps and cron through one guarded transaction", async () => {
  let request;
  const payload = [{ maintenance_resume_state: { resumed_caps: 6, cron_rows: 1 } }];
  const result = await runResume({
    env: {
      SUPABASE_ACCESS_TOKEN: "test-token",
      SUPABASE_PROJECT_REF: PRODUCTION_PROJECT_REF,
      PRODUCTION_DB_MAINTENANCE_CONFIRM: `${PRODUCTION_PROJECT_REF}:resume`,
    },
    fetchImpl: async (url, init) => {
      request = { url, init };
      return new Response(JSON.stringify(payload), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    },
  });

  assert.deepEqual(result, payload);
  assert.match(request.url, /database\/query$/u);
  const body = JSON.parse(request.init.body);
  assert.equal(body.read_only, false);
  assert.equal(body.query, RESUME_SQL);
  assert.match(RESUME_SQL, /BEGIN;[\s\S]*COMMIT;/u);
  assert.match(RESUME_SQL, /pg_advisory_xact_lock/u);
  assert.match(RESUME_SQL, /SET paused = FALSE/u);
  assert.match(RESUME_SQL, /cron\.schedule/u);
  assert.match(RESUME_SQL, /20260816160000/u);
  assert.match(RESUME_SQL, /20260816161000/u);
  assert.match(RESUME_SQL, /strict production database objects are incomplete/u);
  assert.match(RESUME_SQL, /production queues are not drained/u);
  assert.match(
    RESUME_SQL.split("$resume_guard$;")[0],
    /WHERE jobid = v_cron_jobid[\s\S]*active IS TRUE/u,
  );
  assert.doesNotMatch(RESUME_SQL, /UPDATE\s+public\.runner_job/iu);
  assert.doesNotMatch(RESUME_SQL, /DELETE\s+FROM/iu);
});

test("preflight fails closed for the wrong project or confirmation", async () => {
  const neverFetch = async () => {
    throw new Error("fetch must not run");
  };

  await assert.rejects(
    runPreflight({
      env: {
        SUPABASE_ACCESS_TOKEN: "test-token",
        SUPABASE_PROJECT_REF: "not-production",
        PRODUCTION_DB_MAINTENANCE_CONFIRM: `${PRODUCTION_PROJECT_REF}:preflight`,
      },
      fetchImpl: neverFetch,
    }),
    /not the approved production project/u,
  );

  await assert.rejects(
    runPreflight({
      env: {
        SUPABASE_ACCESS_TOKEN: "test-token",
        SUPABASE_PROJECT_REF: PRODUCTION_PROJECT_REF,
        PRODUCTION_DB_MAINTENANCE_CONFIRM: "wrong",
      },
      fetchImpl: neverFetch,
    }),
    /does not authorize preflight/u,
  );
});

test("preflight errors never include the access token", async () => {
  const token = "secret-token-that-must-not-leak";
  await assert.rejects(
    runPreflight({
      env: {
        SUPABASE_ACCESS_TOKEN: token,
        SUPABASE_PROJECT_REF: PRODUCTION_PROJECT_REF,
        PRODUCTION_DB_MAINTENANCE_CONFIRM: `${PRODUCTION_PROJECT_REF}:preflight`,
      },
      fetchImpl: async () =>
        new Response(JSON.stringify({ message: "permission denied" }), {
          status: 403,
          headers: { "content-type": "application/json" },
        }),
    }),
    (error) => {
      assert.match(error.message, /permission denied/u);
      assert.doesNotMatch(error.message, new RegExp(token, "u"));
      return true;
    },
  );
});
