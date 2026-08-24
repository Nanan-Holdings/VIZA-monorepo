import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  APPROVED_MIGRATION_SOURCE_REF,
  APPROVED_MIGRATIONS,
  ARCHITECTURE_AUDIT_SQL,
  PASSIVE_CAPACITY_SQL,
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
  loadApprovedBatchManifest,
  loadApprovedMigrationBatch,
  loadGenericApprovedBatch,
  runArchitectureAudit,
  assessPassiveCapacity,
  runPassiveCapacityObservation,
  runApprovedBatchApply,
  runApprovedBatchVerify,
  loadStableSpeedMigrationBatch,
  runApply,
  runPause,
  runPreflight,
  runResume,
  runStableSpeedApply,
} from "../production-db-maintenance.mjs";

function passiveCapacitySample(overrides = {}) {
  return {
    schema_version: 1,
    project_ref_marker: PRODUCTION_PROJECT_REF,
    sample_at: "2026-08-24T06:00:00Z",
    max_connections: 200,
    effective_connection_limit: 197,
    connections: {
      total: 30,
      current_database: 25,
      active: 2,
      idle: 23,
      idle_in_transaction: 0,
      idle_in_transaction_over_30s: 0,
      long_transactions_over_30s: 0,
      lock_waiting: 0,
      max_transaction_age_seconds: 0,
      max_idle_in_transaction_seconds: 0,
    },
    locks: { ungranted: 0 },
    database_stats: {
      stats_reset: "2026-08-22T00:00:00Z",
      deadlocks: 0,
      xact_commit: 1000,
      xact_rollback: 5,
      temp_files: 0,
      temp_bytes: 0,
    },
    work: {
      runner_running: 0,
      runner_queued: 0,
      legacy_processing_or_live_locked: 0,
      vn_status_running: 0,
      live_machine_slots: 0,
    },
    maintenance_candidates: [],
    pg_stat_statements_available: true,
    ...overrides,
  };
}

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
  assert.match(workflow, /- verify-approved-batch/u);
  assert.match(workflow, /batch_id:/u);
  assert.match(
    workflow,
    /inputs\.action == 'apply-approved-batch'/u,
  );
  assert.match(
    workflow,
    /apply-approved-batch:\{0\}:\{1\}/u,
  );
  assert.match(
    workflow,
    /verify-approved-batch:\{0\}:\{1\}/u,
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
                policy_contracts: [{
                  schema: "public",
                  table: "users",
                  policy: "users_select_own",
                  command: "SELECT",
                  permissive: true,
                  roles: ["authenticated"],
                  using_sha256: "a".repeat(64),
                  check_sha256: null,
                }],
                migration_reconciliation_evidence: {
                  jp_vjw_official_accommodation_fields: {
                    ledger: [{
                      version: "20260823193517",
                      name: "jp_vjw_official_accommodation_fields",
                      statement_count: null,
                      statements_sha256: null,
                    }],
                    field_count: 6,
                    field_contract_sha256: "b".repeat(64),
                  },
                },
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
  assert.equal(result.sanitization_schema, "viza-architecture-audit-metadata-only-v2");
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
  assert.deepEqual(result.catalog.policy_contracts, [{
    schema: "public",
    table: "users",
    policy: "users_select_own",
    command: "SELECT",
    permissive: true,
    roles: ["authenticated"],
    using_sha256: "a".repeat(64),
    check_sha256: null,
  }]);
  assert.deepEqual(
    result.catalog.migration_reconciliation_evidence.jp_vjw_official_accommodation_fields,
    {
      ledger: [{
        version: "20260823193517",
        name: "jp_vjw_official_accommodation_fields",
        statement_count: null,
        statements_sha256: null,
      }],
      field_count: 6,
      field_contract_sha256: "b".repeat(64),
    },
  );
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
  assert.match(ARCHITECTURE_AUDIT_SQL, /'policy_contracts'/u);
  assert.match(ARCHITECTURE_AUDIT_SQL, /'migration_reconciliation_evidence'/u);
  assert.match(ARCHITECTURE_AUDIT_SQL, /supabase_migrations\.schema_migrations/u);
  assert.match(ARCHITECTURE_AUDIT_SQL, /public\.visa_form_fields/u);
  assert.match(ARCHITECTURE_AUDIT_SQL, /pg_catalog\.pg_policy/u);
  assert.match(ARCHITECTURE_AUDIT_SQL, /pg_catalog\.sha256/u);
  assert.match(
    ARCHITECTURE_AUDIT_SQL,
    /pg_catalog\.to_regclass\('extensions\.pg_stat_statements'\)/u,
  );
  assert.match(PG_STAT_STATEMENTS_AUDIT_SQL, /stats_reset/u);
  assert.match(PG_STAT_STATEMENTS_AUDIT_SQL, /observation_window_seconds/u);
  assert.match(PG_STAT_STATEMENTS_AUDIT_SQL, /FROM extensions\.pg_stat_statements\b/u);
  assert.match(PG_STAT_STATEMENTS_AUDIT_SQL, /FROM extensions\.pg_stat_statements_info\b/u);
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

test("passive capacity assessment distinguishes transient warnings from persistent blockers", () => {
  const transient = passiveCapacitySample({
    connections: {
      ...passiveCapacitySample().connections,
      idle: 22,
      idle_in_transaction: 1,
      idle_in_transaction_over_30s: 1,
      max_idle_in_transaction_seconds: 42,
    },
  });
  const result = assessPassiveCapacity({
    samples: [transient, passiveCapacitySample(), passiveCapacitySample()],
    statementMetrics: {
      stats_reset: "2026-08-22T00:00:00Z",
      observation_window_seconds: 172800,
      statements: [{
        queryid: "42",
        calls: 400,
        rows: 400,
        total_exec_time_ms: 8000,
        mean_exec_time_ms: 20,
        shared_blks_hit: 1000,
        shared_blks_read: 10,
        temp_blks_written: 0,
      }],
    },
  });

  assert.equal(result.status, "warn");
  assert.deepEqual(result.blockers, []);
  assert.match(result.warnings.join("\n"), /idle in transaction/u);
  assert.deepEqual(result.optimization_candidates, [{
    queryid: "42",
    calls: 400,
    calls_per_day: 200,
    rows: 400,
    total_exec_time_ms: 8000,
    mean_exec_time_ms: 20,
    shared_blks_hit: 1000,
    shared_blks_read: 10,
    temp_blks_written: 0,
  }]);

  const blockedSamples = [0, 1, 2].map((offset) => passiveCapacitySample({
    connections: {
      ...passiveCapacitySample().connections,
      total: 175,
      idle: 22,
      idle_in_transaction: 1,
      idle_in_transaction_over_30s: 1,
      long_transactions_over_30s: 1,
      lock_waiting: 1,
      max_transaction_age_seconds: 50 + offset,
      max_idle_in_transaction_seconds: 50 + offset,
    },
    locks: { ungranted: 1 },
    database_stats: {
      ...passiveCapacitySample().database_stats,
      deadlocks: offset,
    },
  }));
  const blocked = assessPassiveCapacity({
    samples: blockedSamples,
    statementMetrics: {
      stats_reset: "2026-08-22T00:00:00Z",
      observation_window_seconds: 3600,
      statements: [],
    },
  });
  assert.equal(blocked.status, "red");
  assert.match(blocked.blockers.join("\n"), /connection utilization/u);
  assert.match(blocked.blockers.join("\n"), /ungranted locks/u);
  assert.match(blocked.blockers.join("\n"), /idle in transaction/u);
  assert.match(blocked.blockers.join("\n"), /long transactions/u);
  assert.match(blocked.blockers.join("\n"), /deadlocks increased/u);
});

test("passive capacity assessment rejects malformed statement metadata", () => {
  assert.throws(
    () => assessPassiveCapacity({
      samples: [passiveCapacitySample(), passiveCapacitySample(), passiveCapacitySample()],
      statementMetrics: {
        stats_reset: "2026-08-22T00:00:00Z",
        observation_window_seconds: 3600,
        statements: [{ queryid: "42", calls: "100" }],
      },
    }),
    /statement\.calls is invalid/u,
  );
});

test("passive capacity assessment rejects malformed samples and warns without statement metrics", () => {
  assert.throws(
    () => assessPassiveCapacity({
      samples: [
        passiveCapacitySample(),
        passiveCapacitySample({ sample_at: "not-a-timestamp" }),
        passiveCapacitySample(),
      ],
      statementMetrics: {
        stats_reset: "2026-08-22T00:00:00Z",
        observation_window_seconds: 3600,
        statements: [],
      },
    }),
    /sample contract is invalid/u,
  );

  const unavailable = passiveCapacitySample({ pg_stat_statements_available: false });
  const result = assessPassiveCapacity({
    samples: [unavailable, unavailable, unavailable],
    statementMetrics: {
      stats_reset: null,
      observation_window_seconds: null,
      statements: [],
    },
  });
  assert.equal(result.status, "warn");
  assert.match(result.warnings.join("\n"), /evidence is incomplete/u);

  const missingDatabaseMarker = passiveCapacitySample({ project_ref_marker: null });
  const markerResult = assessPassiveCapacity({
    samples: [missingDatabaseMarker, missingDatabaseMarker, missingDatabaseMarker],
    statementMetrics: {
      stats_reset: "2026-08-22T00:00:00Z",
      observation_window_seconds: 3600,
      statements: [],
    },
  });
  assert.equal(markerResult.status, "warn");
  assert.match(markerResult.warnings.join("\n"), /Management API identity remains authoritative/u);

  assert.throws(
    () => assessPassiveCapacity({
      samples: [
        passiveCapacitySample(),
        passiveCapacitySample({ project_ref_marker: "wrong-project" }),
        passiveCapacitySample(),
      ],
      statementMetrics: {
        stats_reset: "2026-08-22T00:00:00Z",
        observation_window_seconds: 3600,
        statements: [],
      },
    }),
    /sample contract is invalid/u,
  );
});

test("passive capacity assessment fails closed when database counters reset", () => {
  const samples = [
    passiveCapacitySample(),
    passiveCapacitySample({
      database_stats: {
        ...passiveCapacitySample().database_stats,
        stats_reset: "2026-08-24T06:00:05Z",
        xact_commit: 1,
      },
    }),
    passiveCapacitySample({
      database_stats: {
        ...passiveCapacitySample().database_stats,
        stats_reset: "2026-08-24T06:00:05Z",
        xact_commit: 2,
      },
    }),
  ];
  const result = assessPassiveCapacity({
    samples,
    statementMetrics: {
      stats_reset: "2026-08-22T00:00:00Z",
      observation_window_seconds: 3600,
      statements: [],
    },
  });

  assert.equal(result.status, "red");
  assert.match(result.blockers.join("\n"), /statistics reset/u);
  assert.match(result.blockers.join("\n"), /xact_commit counter moved backwards/u);
});

test("passive capacity observation takes three read-only samples and emits no statement text", async () => {
  const requests = [];
  const waits = [];
  let sampleNumber = 0;
  const result = await runPassiveCapacityObservation({
    env: {
      SUPABASE_ACCESS_TOKEN: "test-token",
      SUPABASE_PROJECT_REF: PRODUCTION_PROJECT_REF,
      PRODUCTION_DB_MAINTENANCE_CONFIRM: `${PRODUCTION_PROJECT_REF}:capacity-observe`,
    },
    wait: (resolve, delayMs) => {
      waits.push(delayMs);
      resolve();
    },
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      if (url.endsWith(`/projects/${PRODUCTION_PROJECT_REF}`)) {
        return new Response(JSON.stringify({ id: PRODUCTION_PROJECT_REF }), { status: 200 });
      }
      if (url.endsWith("/advisors/performance")) {
        return new Response(JSON.stringify({
          lints: [{
            name: "unindexed_foreign_keys",
            level: "INFO",
            detail: "must not be emitted",
            metadata: {
              schema: "public",
              name: "submission_queue",
              type: "table",
              fkey_name: "submission_queue_application_id_fkey",
              fkey_columns: [2],
            },
          }],
        }), { status: 200 });
      }
      const query = JSON.parse(init.body).query;
      if (query === PASSIVE_CAPACITY_SQL) {
        sampleNumber += 1;
        return new Response(JSON.stringify([{
          passive_capacity: passiveCapacitySample({
            sample_at: `2026-08-24T06:00:0${sampleNumber}Z`,
          }),
        }]), { status: 200 });
      }
      assert.equal(query, PG_STAT_STATEMENTS_AUDIT_SQL);
      return new Response(JSON.stringify([{ pg_stat_statements: {
        stats_reset: "2026-08-22T00:00:00Z",
        observation_window_seconds: 172800,
        statements: [{
          queryid: "42",
          calls: 400,
          rows: 400,
          total_exec_time_ms: 8000,
          mean_exec_time_ms: 20,
          shared_blks_hit: 1000,
          shared_blks_read: 10,
          temp_blks_written: 0,
        }],
      } }]), { status: 200 });
    },
  });

  assert.equal(sampleNumber, 3);
  assert.deepEqual(waits, [5000, 5000]);
  assert.equal(requests.filter(({ url }) => url.endsWith("/database/query/read-only")).length, 4);
  assert.equal(requests.some(({ url }) => /\/database\/query$/u.test(url)), false);
  assert.equal(result.project_ref, PRODUCTION_PROJECT_REF);
  assert.equal(result.sanitization_schema, "viza-passive-capacity-metadata-only-v1");
  assert.equal(result.samples.length, 3);
  assert.equal(result.assessment.status, "green");
  assert.equal(JSON.stringify(result).includes("must not be emitted"), false);
  assert.deepEqual(result.performance_advisor.lints[0].object, {
    schema: "public",
    name: "submission_queue",
    type: "table",
    fkey_name: "submission_queue_application_id_fkey",
    fkey_columns: [2],
  });
  assert.doesNotMatch(PASSIVE_CAPACITY_SQL, /SELECT\s+\*\s+FROM\s+public\./iu);
  assert.doesNotMatch(PG_STAT_STATEMENTS_AUDIT_SQL, /\bquery\b\s*,/iu);
});

test("scheduled passive capacity workflow is read-only, single-flight, and retains only metadata", () => {
  const workflow = readFileSync(
    new URL("../../.github/workflows/passive-production-capacity.yml", import.meta.url),
    "utf8",
  );
  assert.match(workflow, /schedule:/u);
  assert.match(workflow, /workflow_dispatch:/u);
  assert.match(workflow, /if: github\.ref == 'refs\/heads\/main'/u);
  assert.match(workflow, /group: supabase-production-database-maintenance/u);
  assert.match(workflow, /environment: supabase-production-recovery/u);
  assert.match(workflow, /PRODUCTION_DB_MAINTENANCE_ACTION: capacity-observe/u);
  assert.match(workflow, /oyjxdzsoejraedqghndi:capacity-observe/u);
  assert.match(workflow, /actions\/upload-artifact@v4/u);
  assert.match(workflow, /retention-days: 7/u);
  assert.match(workflow, /ref: refs\/heads\/main/u);
  assert.match(workflow, /persist-credentials: false/u);
  assert.doesNotMatch(workflow, /database\/query[^\n]*read_only:\s*false/iu);
  assert.doesNotMatch(workflow, /psql|supabase db push|apply-approved-batch|PRODUCTION_DB_MAINTENANCE_ACTION: apply/u);
});

test("architecture audit retries one transient read-only Management API failure", async () => {
  const env = {
    SUPABASE_ACCESS_TOKEN: "test-token",
    SUPABASE_PROJECT_REF: PRODUCTION_PROJECT_REF,
    PRODUCTION_DB_MAINTENANCE_CONFIRM: `${PRODUCTION_PROJECT_REF}:architecture-audit`,
  };
  let securityAttempts = 0;
  const waits = [];
  const result = await runArchitectureAudit({
    env,
    wait: (resolve, delayMs) => {
      waits.push(delayMs);
      resolve();
    },
    fetchImpl: async (url, init) => {
      if (url.endsWith(`/projects/${PRODUCTION_PROJECT_REF}`)) {
        return new Response(JSON.stringify({ id: PRODUCTION_PROJECT_REF }), { status: 200 });
      }
      if (url.endsWith("/advisors/security")) {
        securityAttempts += 1;
        if (securityAttempts === 1) {
          return new Response(JSON.stringify({
            message: "Failed to run sql query: Connection terminated due to connection timeout",
          }), { status: 544 });
        }
        return new Response(JSON.stringify({ lints: [] }), { status: 200 });
      }
      if (url.endsWith("/advisors/performance")) {
        return new Response(JSON.stringify({ lints: [] }), { status: 200 });
      }
      const query = JSON.parse(init.body).query;
      assert.equal(query, ARCHITECTURE_AUDIT_SQL);
      return new Response(JSON.stringify([{ architecture_audit: {
        project_ref_marker: PRODUCTION_PROJECT_REF,
        pg_stat_statements_available: false,
      } }]), { status: 200 });
    },
  });

  assert.equal(result.project_ref, PRODUCTION_PROJECT_REF);
  assert.equal(securityAttempts, 2);
  assert.deepEqual(waits, [500]);
});

test("architecture audit never retries authorization failures and names exhausted phases", async () => {
  const env = {
    SUPABASE_ACCESS_TOKEN: "test-token",
    SUPABASE_PROJECT_REF: PRODUCTION_PROJECT_REF,
    PRODUCTION_DB_MAINTENANCE_CONFIRM: `${PRODUCTION_PROJECT_REF}:architecture-audit`,
  };
  let calls = 0;
  await assert.rejects(
    runArchitectureAudit({
      env,
      wait: (resolve) => resolve(),
      fetchImpl: async () => {
        calls += 1;
        return new Response(JSON.stringify({ message: "forbidden" }), { status: 403 });
      },
    }),
    /project identity failed: .*\(403\): forbidden/u,
  );
  assert.equal(calls, 1);

  calls = 0;
  await assert.rejects(
    runArchitectureAudit({
      env,
      wait: (resolve) => resolve(),
      fetchImpl: async (url) => {
        calls += 1;
        if (url.endsWith(`/projects/${PRODUCTION_PROJECT_REF}`)) {
          return new Response(JSON.stringify({ id: PRODUCTION_PROJECT_REF }), { status: 200 });
        }
        return new Response(JSON.stringify({ message: "connection timeout" }), { status: 544 });
      },
    }),
    /security advisor failed after two attempts: .*\(544\): connection timeout/u,
  );
  assert.equal(calls, 3);
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

test("production access batch pins observed production policy hashes", () => {
  const manifest = loadApprovedBatchManifest();
  const batch = manifest.batches.find(({ batch_id: batchId }) =>
    batchId === "database-access-baseline-v1");
  const policies = Object.fromEntries(
    batch.postconditions.catalog_assertions
      .filter(({ kind }) => kind === "policy_contract")
      .map((assertion) => [assertion.id, assertion]),
  );
  assert.equal(
    policies.users_select_own_policy_exact.using_sha256,
    "9eb2ae882c5df8f07df6b9694b665ca1e1a718b39812bbbde6a8f95af17637ba",
  );
  for (const policyId of [
    "application_translations_select_policy_exact",
    "application_translations_insert_policy_exact",
    "application_translations_update_policy_exact",
  ]) {
    const policy = policies[policyId];
    for (const hash of [policy.using_sha256, policy.check_sha256].filter(Boolean)) {
      assert.equal(hash, "798452f9af245df3fabc82efdd13ce75324ce5a06cfd6d1e4341dc8525f83fc4");
    }
  }
});

test("production performance-index batch pins the three reviewed online indexes", () => {
  const manifest = loadApprovedBatchManifest();
  const batch = manifest.batches.find(({ batch_id: batchId }) =>
    batchId === "database-performance-indexes-v1");
  assert.ok(batch);
  assert.equal(batch.source_ref, "acb1a0694afb8b572acfaba626596702e0a88d2e");
  assert.equal(batch.mode, "concurrent-index");
  assert.deepEqual(batch.preconditions.required_migration_versions, ["20260821131006"]);
  assert.deepEqual(batch.preconditions.absent_migration_versions, ["20260821175138"]);
  assert.deepEqual(
    batch.migrations.flatMap(({ indexes }) => indexes.map(({ identity }) => identity)).sort(),
    [
      "public.pii_access_log_application_id_idx",
      "public.submission_queue_application_latest_idx",
      "public.visa_chunks_document_id_idx",
    ],
  );
  assert.equal(
    batch.migrations[0].sha256,
    "34474dd9e3e265a1d3333abf13c0b7034727b2a1e08e44f8a28475d2997f3944",
  );
});

test("agent-backend timeout batch pins the role defaults and exact postflight", () => {
  const manifest = loadApprovedBatchManifest();
  const batch = manifest.batches.find(({ batch_id: batchId }) =>
    batchId === "agent-backend-role-timeouts-v1");
  assert.ok(batch);
  assert.equal(batch.source_ref, "a468609c31ccadd0ec758caedc18f1c6a037dcfe");
  assert.equal(batch.mode, "transactional");
  assert.deepEqual(batch.preconditions.required_migration_versions, ["20260821175138"]);
  assert.deepEqual(batch.preconditions.absent_migration_versions, ["20260821181514"]);
  assert.equal(batch.migrations[0].sha256,
    "126ec3bfa2165be75996d53865a28ddd81f3b402107c68f4532ac714d7df4d6d");
  assert.deepEqual(
    batch.postconditions.catalog_assertions.find(({ id }) =>
      id === "postgres_runtime_timeouts_exact"),
    {
      id: "postgres_runtime_timeouts_exact",
      kind: "role_settings",
      role: "postgres",
      settings: {
        statement_timeout: "30s",
        idle_in_transaction_session_timeout: "30s",
      },
    },
  );
});

test("function execution batch pins the reviewed source, namespace, and ACL contracts", () => {
  const manifest = loadApprovedBatchManifest();
  const batch = manifest.batches.find(({ batch_id: batchId }) =>
    batchId === "database-function-execution-baseline-v1");
  assert.ok(batch);
  assert.equal(batch.source_ref, "4ed17ad114011da171356b66fd0a7f71aa993059");
  assert.equal(batch.mode, "transactional");
  assert.deepEqual(batch.preconditions.required_migration_versions, ["20260821181514"]);
  assert.deepEqual(batch.preconditions.absent_migration_versions, ["20260823134811"]);
  assert.deepEqual(batch.migrations[0], {
    version: "20260823134811",
    name: "database_function_execution_baseline",
    path: "viza-fe/internal-website/supabase/migrations/20260823134811_database_function_execution_baseline.sql",
    sha256: "43ee2f78b60782b7a1a56399df8beda1ab8d36472d2cbaa9bc6e581f22470ed8",
  });
  const postconditions = batch.postconditions.catalog_assertions;
  assert.equal(postconditions.filter(({ kind }) => kind === "function_search_path").length, 9);
  assert.equal(postconditions.filter(({ kind }) => kind === "function_execute_acl").length, 8);
  for (const contract of postconditions.filter(({ kind }) => kind === "function_search_path")) {
    assert.deepEqual(contract.search_path, ["pg_catalog", "public"]);
    assert.equal(contract.security_definer, false);
  }
  const postflightSql = buildApprovedBatchStateSql(batch, "postconditions");
  assert.match(postflightSql, /public\.match_visa_chunks\(public\.vector,integer,text,text,text\[\],real\)/u);
  assert.match(postflightSql, /search_path=pg_catalog, public/u);
  assert.match(postflightSql, /configured_function\.prosecdef IS FALSE/u);
});

test("core RLS init-plan batch pins every policy before and after the rewrite", () => {
  const manifest = loadApprovedBatchManifest();
  const batch = manifest.batches.find(({ batch_id: batchId }) =>
    batchId === "core-rls-initplan-v1");
  assert.ok(batch);
  assert.equal(batch.source_ref, "4819df5080775c4cb3f8115949c66165d984984e");
  assert.equal(batch.mode, "transactional");
  assert.deepEqual(batch.preconditions.required_migration_versions, ["20260823134811"]);
  assert.deepEqual(batch.preconditions.absent_migration_versions, ["20260823140456"]);
  assert.deepEqual(batch.migrations[0], {
    version: "20260823140456",
    name: "core_rls_initplan",
    path: "viza-fe/internal-website/supabase/migrations/20260823140456_core_rls_initplan.sql",
    sha256: "e1a97dde6a7868dcba950a7cf3848cb907c4a16fb6ba1ca9578c745b08ea2d40",
  });
  for (const phase of [batch.preconditions, batch.postconditions]) {
    const assertions = phase.catalog_assertions;
    assert.equal(assertions.filter(({ kind }) => kind === "policy_contract").length, 11);
    assert.deepEqual(
      assertions.filter(({ kind }) => kind === "policy_count")
        .map(({ identity, count }) => [identity, count])
        .sort(),
      [
        ["public.applicant_profiles", 3],
        ["public.application_documents", 4],
        ["public.applications", 3],
        ["public.submission_queue", 1],
      ],
    );
  }
  const preflightSql = buildApprovedBatchStateSql(batch, "preconditions");
  const postflightSql = buildApprovedBatchStateSql(batch, "postconditions");
  assert.match(preflightSql, /7483a7130e3798bb9db96d7a70ad5323e96852d5bf23dc90e501a937eab7451f/u);
  assert.match(preflightSql, /25b1a1fe79d4578daaa9ce3a895db3195c732290aa4290acac2e212ea1967fad/u);
  assert.match(preflightSql, /ce1b4a6b77c56198e78ac673b893027882840bb094b82834e68602fd650e7e00/u);
  assert.match(postflightSql, /395001fc5fa67b0b0a69cf3aecfd369149ddef1a8c00eb6268fd895330eb2b6b/u);
  assert.match(postflightSql, /f4e3e33d2585cbb579e477f7f118f0b5b80ac10bea6a0dbb5fa875089f38aa86/u);
  assert.match(postflightSql, /bf2366686b415d0aed45d3f473b698f5323e1c4be0c548f5365c4d495ea86a2a/u);
});

test("chat RLS init-plan batch pins every policy before and after the rewrite", () => {
  const manifest = loadApprovedBatchManifest();
  const batch = manifest.batches.find(({ batch_id: batchId }) =>
    batchId === "chat-rls-initplan-v1");
  assert.ok(batch);
  assert.equal(batch.source_ref, "51142975b1df522d750b743392a721d723795cd8");
  assert.equal(batch.mode, "transactional");
  assert.deepEqual(batch.preconditions.required_migration_versions, ["20260823140456"]);
  assert.deepEqual(batch.preconditions.absent_migration_versions, ["20260823143810"]);
  assert.deepEqual(batch.migrations[0], {
    version: "20260823143810",
    name: "chat_rls_initplan",
    path: "viza-fe/internal-website/supabase/migrations/20260823143810_chat_rls_initplan.sql",
    sha256: "f184696b540b8003fe9a0748882982cf481cfce8ace19a213ff993b562e280f2",
  });
  for (const phase of [batch.preconditions, batch.postconditions]) {
    const assertions = phase.catalog_assertions;
    assert.equal(assertions.filter(({ kind }) => kind === "policy_contract").length, 9);
    assert.equal(assertions.filter(({ kind }) => kind === "rls_enabled").length, 6);
    assert.deepEqual(
      assertions.filter(({ kind }) => kind === "policy_count")
        .map(({ identity, count }) => [identity, count])
        .sort(),
      [
        ["public.travel_agent_messages", 1],
        ["public.travel_agent_sessions", 1],
        ["public.travel_user_preferences", 1],
        ["public.user_chat_sessions", 2],
        ["public.visa_chat_messages", 2],
        ["public.visa_chat_sessions", 3],
      ],
    );
  }
  const preflightSql = buildApprovedBatchStateSql(batch, "preconditions");
  const postflightSql = buildApprovedBatchStateSql(batch, "postconditions");
  assert.match(preflightSql, /88343edb2dcb676910bbb308c3db6ec72642830f5146274958532e4354593857/u);
  assert.match(preflightSql, /795cc81c691fa00af552b35db6b73f6e43ff7c8b762fca1138c3128f9a467b0b/u);
  assert.match(postflightSql, /067f2b9c489a616b20dba2a5a889efaf0c73212fd91d16a91767f32a164c6ef3/u);
  assert.match(postflightSql, /7d4586bde32e08a4267f4282fe7a0bd3e2971beee3b8809298df68955de27b03/u);
  assert.match(postflightSql, /f4e3e33d2585cbb579e477f7f118f0b5b80ac10bea6a0dbb5fa875089f38aa86/u);
});

test("user packages RLS init-plan batch pins the sole policy contract", () => {
  const manifest = loadApprovedBatchManifest();
  const batch = manifest.batches.find(({ batch_id: batchId }) =>
    batchId === "user-packages-rls-initplan-v1");
  assert.ok(batch);
  assert.equal(batch.source_ref, "40814de368ec2030c850bf906ade4b5d6a64e6f6");
  assert.equal(batch.mode, "transactional");
  assert.deepEqual(batch.preconditions.required_migration_versions, ["20260823143810"]);
  assert.deepEqual(batch.preconditions.absent_migration_versions, ["20260823152021"]);
  assert.deepEqual(batch.migrations[0], {
    version: "20260823152021",
    name: "user_packages_rls_initplan",
    path: "viza-fe/internal-website/supabase/migrations/20260823152021_user_packages_rls_initplan.sql",
    sha256: "81a7e178c00d647afda7c00c1ad99b506965c5f4542fc7e31da9c46c9e4a6ecf",
  });
  for (const phase of [batch.preconditions, batch.postconditions]) {
    const assertions = phase.catalog_assertions;
    assert.equal(assertions.filter(({ kind }) => kind === "policy_contract").length, 1);
    assert.deepEqual(
      assertions.filter(({ kind }) => kind === "policy_count")
        .map(({ identity, count }) => [identity, count]),
      [["public.user_packages", 1]],
    );
    assert.equal(assertions.filter(({ kind }) => kind === "rls_enabled").length, 1);
  }
  const preflightSql = buildApprovedBatchStateSql(batch, "preconditions");
  const postflightSql = buildApprovedBatchStateSql(batch, "postconditions");
  assert.match(preflightSql, /ce62525c186c42a375e07249cdd9461522f496b27a3d8789df71b39ac5e77d58/u);
  assert.match(postflightSql, /2be57c38df7ccb57585e26e8063a9915959f6814c740ec2f581dd7830759c312/u);
});

test("notification/signature RLS init-plan batch pins both public SELECT policies", () => {
  const manifest = loadApprovedBatchManifest();
  const batch = manifest.batches.find(({ batch_id: batchId }) =>
    batchId === "notification-signature-rls-initplan-v1");
  assert.ok(batch);
  assert.equal(batch.source_ref, "438fc9edb67e5bc8c133ac8c34139233f27ce25e");
  assert.equal(batch.mode, "transactional");
  assert.deepEqual(batch.preconditions.required_migration_versions, ["20260823152021"]);
  assert.deepEqual(batch.preconditions.absent_migration_versions, ["20260823154730"]);
  assert.deepEqual(batch.migrations[0], {
    version: "20260823154730",
    name: "notification_signature_rls_initplan",
    path: "viza-fe/internal-website/supabase/migrations/20260823154730_notification_signature_rls_initplan.sql",
    sha256: "e6f9b05feacda137d8709b1de1c96b0461ada7ce65ec46e7d685d3c42cf4e3af",
  });
  for (const phase of [batch.preconditions, batch.postconditions]) {
    const assertions = phase.catalog_assertions;
    assert.equal(assertions.filter(({ kind }) => kind === "policy_contract").length, 2);
    assert.deepEqual(
      assertions.filter(({ kind }) => kind === "policy_count")
        .map(({ identity, count }) => [identity, count]),
      [
        ["public.notification_event_log", 1],
        ["public.signature_event", 1],
      ],
    );
    assert.equal(assertions.filter(({ kind }) => kind === "rls_enabled").length, 2);
  }
  const preflightSql = buildApprovedBatchStateSql(batch, "preconditions");
  const postflightSql = buildApprovedBatchStateSql(batch, "postconditions");
  assert.match(preflightSql, /25b1a1fe79d4578daaa9ce3a895db3195c732290aa4290acac2e212ea1967fad/u);
  assert.match(postflightSql, /f4e3e33d2585cbb579e477f7f118f0b5b80ac10bea6a0dbb5fa875089f38aa86/u);
});

test("inbound-email RLS init-plan batch pins policy and unchanged broad ACL", () => {
  const manifest = loadApprovedBatchManifest();
  const batch = manifest.batches.find(({ batch_id: batchId }) =>
    batchId === "inbound-email-rls-initplan-v1");
  assert.ok(batch);
  assert.equal(batch.source_ref, "1d29e1ca931d3e66162467f4e4d6a5fd798038ac");
  assert.equal(batch.mode, "transactional");
  assert.deepEqual(batch.preconditions.required_migration_versions, ["20260823154730"]);
  assert.deepEqual(batch.preconditions.absent_migration_versions, ["20260823163045"]);
  assert.deepEqual(batch.migrations[0], {
    version: "20260823163045",
    name: "inbound_email_rls_initplan",
    path: "viza-fe/internal-website/supabase/migrations/20260823163045_inbound_email_rls_initplan.sql",
    sha256: "a91b09072241084a259757978051f66ed2ba1afd80d950c9a94f8030640a9f35",
  });
  for (const phase of [batch.preconditions, batch.postconditions]) {
    const assertions = phase.catalog_assertions;
    assert.equal(assertions.filter(({ kind }) => kind === "policy_contract").length, 1);
    assert.deepEqual(
      assertions.filter(({ kind }) => kind === "policy_count")
        .map(({ identity, count }) => [identity, count]),
      [["public.inbound_email", 1]],
    );
    assert.equal(assertions.filter(({ kind }) => kind === "rls_enabled").length, 1);
    const acl = assertions.find(({ kind }) => kind === "relation_acl");
    assert.ok(acl);
    assert.equal(acl.identity, "public.inbound_email");
    assert.deepEqual(acl.required.map(({ role }) => role), ["anon", "authenticated", "service_role"]);
    assert.ok(acl.required.every(({ exact, privileges }) => exact === true && privileges.length === 7));
    assert.deepEqual(acl.forbidden_roles, ["PUBLIC"]);
  }
  const preflightSql = buildApprovedBatchStateSql(batch, "preconditions");
  const postflightSql = buildApprovedBatchStateSql(batch, "postconditions");
  assert.match(preflightSql, /53620884b11312437e65785cdc5445b1ed50036f0fcdb2b096db2502288786c6/u);
  assert.match(postflightSql, /ecb33803f6cb8934051ad83203bedb9a0d5421a5f7114329c219f0d2093460c8/u);
  assert.match(preflightSql, /has_table_privilege/u);
  assert.match(postflightSql, /has_table_privilege/u);
});

test("inbound-email ACL batch removes anonymous access and client mutations", () => {
  const manifest = loadApprovedBatchManifest();
  const batch = manifest.batches.find(({ batch_id: batchId }) =>
    batchId === "inbound-email-acl-v1");
  assert.ok(batch);
  assert.equal(batch.source_ref, "e42a9ea6a093b20ef8f1458e7982bce7ee8706c1");
  assert.equal(batch.mode, "transactional");
  assert.deepEqual(batch.preconditions.required_migration_versions, ["20260823163045"]);
  assert.deepEqual(batch.preconditions.absent_migration_versions, ["20260824012700"]);
  assert.deepEqual(batch.migrations[0], {
    version: "20260824012700",
    name: "inbound_email_acl",
    path: "viza-fe/internal-website/supabase/migrations/20260824012700_inbound_email_acl.sql",
    sha256: "56e0894fa8659daf404dabb99cd536de370653c69f84f3cd6bd6cf1a8062117c",
  });

  const preAssertions = batch.preconditions.catalog_assertions;
  const postAssertions = batch.postconditions.catalog_assertions;
  const preAcl = preAssertions.find(({ kind }) => kind === "relation_acl");
  const postAcl = postAssertions.find(({ kind }) => kind === "relation_acl");
  assert.deepEqual(preAcl.required.map(({ role }) => role), [
    "anon",
    "authenticated",
    "service_role",
  ]);
  assert.ok(preAcl.required.every(({ exact, privileges }) =>
    exact === true && privileges.length === 7));
  assert.deepEqual(preAcl.forbidden_roles, ["PUBLIC"]);
  assert.deepEqual(preAcl.allowed_direct_roles, ["anon", "authenticated", "service_role"]);
  assert.equal(preAcl.grant_options_forbidden, true);
  assert.deepEqual(postAcl.required, [
    { role: "authenticated", privileges: ["SELECT"], exact: true },
    {
      role: "service_role",
      privileges: [
        "SELECT",
        "INSERT",
        "UPDATE",
        "DELETE",
        "TRUNCATE",
        "REFERENCES",
        "TRIGGER",
      ],
      exact: true,
    },
  ]);
  assert.deepEqual(postAcl.forbidden_roles, ["PUBLIC", "anon"]);
  assert.deepEqual(postAcl.allowed_direct_roles, ["authenticated", "service_role"]);
  assert.equal(postAcl.grant_options_forbidden, true);

  for (const assertions of [preAssertions, postAssertions]) {
    const policy = assertions.find(({ kind }) => kind === "policy_contract");
    assert.equal(policy.using_sha256, "ecb33803f6cb8934051ad83203bedb9a0d5421a5f7114329c219f0d2093460c8");
    assert.deepEqual(policy.roles, ["PUBLIC"]);
    assert.equal(assertions.find(({ kind }) => kind === "policy_count").count, 1);
    assert.equal(assertions.filter(({ kind }) => kind === "rls_enabled").length, 1);
  }

  const preflightSql = buildApprovedBatchStateSql(batch, "preconditions");
  const postflightSql = buildApprovedBatchStateSql(batch, "postconditions");
  assert.match(preflightSql, /20260823163045/u);
  assert.match(postflightSql, /20260824012700/u);
  assert.match(preflightSql, /ecb33803f6cb8934051ad83203bedb9a0d5421a5f7114329c219f0d2093460c8/u);
  assert.match(postflightSql, /ecb33803f6cb8934051ad83203bedb9a0d5421a5f7114329c219f0d2093460c8/u);
  assert.match(postflightSql, /pg_catalog\.aclexplode/u);
  assert.match(postflightSql, /acl_entry\.is_grantable/u);
  assert.match(postflightSql, /pg_catalog\.pg_get_userbyid/u);
});

test("audit-log RLS init-plan batch pins only the two single-path ownership policies", () => {
  const manifest = loadApprovedBatchManifest();
  const batch = manifest.batches.find(({ batch_id: batchId }) =>
    batchId === "audit-log-rls-initplan-v1");
  assert.ok(batch);
  assert.equal(batch.source_ref, "90db48360245d758adc89daa1983d9b70948f220");
  assert.equal(batch.mode, "transactional");
  assert.deepEqual(batch.preconditions.required_migration_versions, ["20260824012700"]);
  assert.deepEqual(batch.preconditions.absent_migration_versions, ["20260824020344"]);
  assert.deepEqual(batch.migrations[0], {
    version: "20260824020344",
    name: "audit_log_rls_initplan",
    path: "viza-fe/internal-website/supabase/migrations/20260824020344_audit_log_rls_initplan.sql",
    sha256: "5b79d4d4e0eb0e6c341c7f6aa21631093f1a5688b9a7677212df169eb9e7153d",
  });

  const expectedRelations = [
    ["public.secret_access_log", 1],
    ["public.pii_access_log", 1],
  ];
  for (const phase of [batch.preconditions, batch.postconditions]) {
    const assertions = phase.catalog_assertions;
    const policies = assertions.filter(({ kind }) => kind === "policy_contract");
    assert.equal(policies.length, 2);
    assert.ok(policies.every(({ command, roles, permissive, check_sha256: checkHash }) =>
      command === "SELECT" && permissive === true && checkHash === null &&
      JSON.stringify(roles) === JSON.stringify(["PUBLIC"])));
    assert.deepEqual(
      assertions.filter(({ kind }) => kind === "policy_count")
        .map(({ identity, count }) => [identity, count]),
      expectedRelations,
    );
    assert.equal(assertions.filter(({ kind }) => kind === "rls_enabled").length, 2);
    assert.ok(assertions.every(({ identity }) =>
      identity !== "public.account_action_log" && identity !== "public.consent_event"));
  }

  const preflightSql = buildApprovedBatchStateSql(batch, "preconditions");
  const postflightSql = buildApprovedBatchStateSql(batch, "postconditions");
  assert.match(preflightSql, /25b1a1fe79d4578daaa9ce3a895db3195c732290aa4290acac2e212ea1967fad/u);
  assert.doesNotMatch(preflightSql, /91d4d5f1bd65562b9581892c345fa0b60d0dc1aa398f0b271e86338385060ac8/u);
  assert.match(postflightSql, /f4e3e33d2585cbb579e477f7f118f0b5b80ac10bea6a0dbb5fa875089f38aa86/u);
  assert.doesNotMatch(postflightSql, /71f1513bd40970f7d84c85ec82450b575df8915148b67210085a056186962975/u);
});

test("account-action-log RLS init-plan batch pins the reviewed two-path policy", () => {
  const manifest = loadApprovedBatchManifest();
  const batch = manifest.batches.find(({ batch_id: batchId }) =>
    batchId === "account-action-log-rls-initplan-v1");
  assert.ok(batch);
  assert.equal(batch.source_ref, "d32d817c39a138881d1d6d4233e5e498cec6f482");
  assert.equal(batch.mode, "transactional");
  assert.deepEqual(batch.preconditions.required_migration_versions, ["20260824020344"]);
  assert.deepEqual(batch.preconditions.absent_migration_versions, ["20260824023800"]);
  assert.deepEqual(batch.migrations[0], {
    version: "20260824023800",
    name: "account_action_log_rls_initplan",
    path: "viza-fe/internal-website/supabase/migrations/20260824023800_account_action_log_rls_initplan.sql",
    sha256: "726114d60c513f65e8d755f400a7f6778e70a05a49212351578e7e8b83fd5596",
  });

  for (const phase of [batch.preconditions, batch.postconditions]) {
    const assertions = phase.catalog_assertions;
    assert.equal(assertions.filter(({ kind }) => kind === "policy_contract").length, 1);
    assert.deepEqual(
      assertions.filter(({ kind }) => kind === "policy_count")
        .map(({ identity, count }) => [identity, count]),
      [["public.account_action_log", 1]],
    );
    assert.equal(assertions.filter(({ kind }) => kind === "rls_enabled").length, 1);
    assert.ok(assertions.every(({ identity }) => identity !== "public.consent_event"));
    const acl = assertions.find(({ kind }) => kind === "relation_acl");
    assert.deepEqual(acl.allowed_direct_roles, ["postgres", "anon", "authenticated", "service_role"]);
    assert.deepEqual(acl.forbidden_roles, ["PUBLIC"]);
    assert.equal(acl.grant_options_forbidden, true);
    assert.equal(acl.required.length, 4);
    assert.ok(acl.required.every(({ privileges, exact }) =>
      exact === true && privileges.length === 7));
  }

  const preflightSql = buildApprovedBatchStateSql(batch, "preconditions");
  const postflightSql = buildApprovedBatchStateSql(batch, "postconditions");
  assert.match(preflightSql, /91d4d5f1bd65562b9581892c345fa0b60d0dc1aa398f0b271e86338385060ac8/u);
  assert.match(postflightSql, /71f1513bd40970f7d84c85ec82450b575df8915148b67210085a056186962975/u);
  assert.doesNotMatch(`${preflightSql}\n${postflightSql}`, /consent_event/u);
  assert.match(preflightSql, /pg_catalog\.aclexplode/u);
  assert.match(postflightSql, /acl_entry\.is_grantable/u);
});

test("consent-event RLS batch pins the production-reconciled two-path policy", () => {
  const manifest = loadApprovedBatchManifest();
  const batch = manifest.batches.find(({ batch_id: batchId }) =>
    batchId === "consent-event-rls-initplan-v1");
  assert.ok(batch);
  assert.equal(batch.source_ref, "4227627f49ff631650e999d550c7967f20cecec0");
  assert.equal(batch.mode, "transactional");
  assert.deepEqual(batch.preconditions.required_migration_versions, ["20260824023800"]);
  assert.deepEqual(batch.preconditions.absent_migration_versions, ["20260824032000"]);
  assert.deepEqual(batch.migrations[0], {
    version: "20260824032000",
    name: "consent_event_rls_initplan",
    path: "viza-fe/internal-website/supabase/migrations/20260824032000_consent_event_rls_initplan.sql",
    sha256: "ad8b0e93f158e51ca79694dc6abf80c77781280a1e8d3bbd623dd62d208b27f8",
  });

  for (const phase of [batch.preconditions, batch.postconditions]) {
    const assertions = phase.catalog_assertions;
    assert.equal(assertions.filter(({ kind }) => kind === "policy_contract").length, 1);
    assert.deepEqual(
      assertions.filter(({ kind }) => kind === "policy_count")
        .map(({ identity, count }) => [identity, count]),
      [["public.consent_event", 1]],
    );
    assert.equal(assertions.filter(({ kind }) => kind === "rls_enabled").length, 1);
    assert.ok(assertions.every(({ identity }) => identity !== "public.account_action_log"));
    const acl = assertions.find(({ kind }) => kind === "relation_acl");
    assert.deepEqual(acl.allowed_direct_roles, ["postgres", "anon", "authenticated", "service_role"]);
    assert.deepEqual(acl.forbidden_roles, ["PUBLIC"]);
    assert.equal(acl.grant_options_forbidden, true);
    assert.equal(acl.required.length, 4);
    assert.ok(acl.required.every(({ privileges, exact }) =>
      exact === true && privileges.length === 8 && privileges.includes("MAINTAIN")));
    assert.ok(acl.required.every(({ exact_direct: exactDirect }) => exactDirect === true));
  }

  const preflightSql = buildApprovedBatchStateSql(batch, "preconditions");
  const postflightSql = buildApprovedBatchStateSql(batch, "postconditions");
  assert.match(preflightSql, /91d4d5f1bd65562b9581892c345fa0b60d0dc1aa398f0b271e86338385060ac8/u);
  assert.match(postflightSql, /71f1513bd40970f7d84c85ec82450b575df8915148b67210085a056186962975/u);
  assert.doesNotMatch(`${preflightSql}\n${postflightSql}`, /account_action_log/u);
  assert.match(preflightSql, /pg_catalog\.aclexplode/u);
  assert.match(preflightSql, /exact_acl_entry\.privilege_type NOT IN/u);
  assert.match(preflightSql, /exact_acl_entry\.privilege_type = expected_acl\.privilege_type/u);
  assert.match(preflightSql, /'MAINTAIN'/u);
  assert.match(postflightSql, /acl_entry\.is_grantable/u);
});

test("applicant single-path RLS batch pins all four policy contracts", () => {
  const manifest = loadApprovedBatchManifest();
  const batch = manifest.batches.find(({ batch_id: batchId }) =>
    batchId === "applicant-single-path-rls-initplan-v1");
  assert.ok(batch);
  assert.equal(batch.source_ref, "25ad988389edd4efe0ed0e383b0e7a6c1cd673d6");
  assert.equal(batch.mode, "transactional");
  assert.deepEqual(batch.preconditions.required_migration_versions, ["20260824032000"]);
  assert.deepEqual(batch.preconditions.absent_migration_versions, ["20260824051000"]);
  assert.deepEqual(batch.migrations[0], {
    version: "20260824051000",
    name: "applicant_single_path_rls_initplan",
    path: "viza-fe/internal-website/supabase/migrations/20260824051000_applicant_single_path_rls_initplan.sql",
    sha256: "90d15e9994d544360c536a486da8d8685ed95e7c7adce0bd9f2946f771f0af43",
  });

  for (const phase of [batch.preconditions, batch.postconditions]) {
    const assertions = phase.catalog_assertions;
    assert.equal(assertions.filter(({ kind }) => kind === "policy_contract").length, 4);
    assert.deepEqual(
      assertions.filter(({ kind }) => kind === "policy_count")
        .map(({ identity, count }) => [identity, count]),
      [
        ["public.applicant_secret", 1],
        ["public.notification_preferences", 2],
        ["public.staff_chat_thread", 1],
      ],
    );
    assert.equal(assertions.filter(({ kind }) => kind === "rls_enabled").length, 3);
    const acls = assertions.filter(({ kind }) => kind === "relation_acl");
    assert.equal(acls.length, 3);
    for (const acl of acls) {
      assert.deepEqual(acl.allowed_direct_roles, ["postgres", "anon", "authenticated", "service_role"]);
      assert.deepEqual(acl.forbidden_roles, ["PUBLIC"]);
      assert.equal(acl.grant_options_forbidden, true);
      assert.equal(acl.required.length, 4);
      assert.ok(acl.required.every(({ privileges, exact, exact_direct: exactDirect }) =>
        exact === true && exactDirect === true && privileges.length === 8 && privileges.includes("MAINTAIN")));
    }
  }

  const preflightSql = buildApprovedBatchStateSql(batch, "preconditions");
  const postflightSql = buildApprovedBatchStateSql(batch, "postconditions");
  assert.equal((preflightSql.match(/25b1a1fe79d4578daaa9ce3a895db3195c732290aa4290acac2e212ea1967fad/gu) ?? []).length, 5);
  assert.equal((postflightSql.match(/f4e3e33d2585cbb579e477f7f118f0b5b80ac10bea6a0dbb5fa875089f38aa86/gu) ?? []).length, 5);
  assert.match(preflightSql, /pg_catalog\.aclexplode/u);
  assert.match(postflightSql, /acl_entry\.is_grantable/u);
});

test("supporting-document RLS batch pins the sole two-hop ownership policy", () => {
  const manifest = loadApprovedBatchManifest();
  const batch = manifest.batches.find(({ batch_id: batchId }) =>
    batchId === "supporting-doc-submission-rls-initplan-v1");
  assert.ok(batch);
  assert.equal(batch.source_ref, "f65b84631a776b8ed3f5bb41f08657b5b69d2f5f");
  assert.equal(batch.mode, "transactional");
  assert.deepEqual(batch.preconditions.required_migration_versions, ["20260824051000"]);
  assert.deepEqual(batch.preconditions.absent_migration_versions, ["20260824055000"]);
  assert.deepEqual(batch.migrations[0], {
    version: "20260824055000",
    name: "supporting_doc_submission_rls_initplan",
    path: "viza-fe/internal-website/supabase/migrations/20260824055000_supporting_doc_submission_rls_initplan.sql",
    sha256: "9a260359fb706176565f8e6b30d29e7a8ad484ef1f12f670337481228bab067f",
  });

  for (const phase of [batch.preconditions, batch.postconditions]) {
    const assertions = phase.catalog_assertions;
    assert.equal(assertions.filter(({ kind }) => kind === "policy_contract").length, 1);
    assert.deepEqual(
      assertions.filter(({ kind }) => kind === "policy_count")
        .map(({ identity, count }) => [identity, count]),
      [["public.supporting_doc_submission", 1]],
    );
    assert.equal(assertions.filter(({ kind }) => kind === "rls_enabled").length, 1);
    const acls = assertions.filter(({ kind }) => kind === "relation_acl");
    assert.equal(acls.length, 1);
    const [acl] = acls;
    assert.deepEqual(acl.allowed_direct_roles, ["postgres", "anon", "authenticated", "service_role"]);
    assert.deepEqual(acl.forbidden_roles, ["PUBLIC"]);
    assert.equal(acl.grant_options_forbidden, true);
    assert.equal(acl.required.length, 4);
    assert.ok(acl.required.every(({ privileges, exact, exact_direct: exactDirect }) =>
      exact === true && exactDirect === true && privileges.length === 8 && privileges.includes("MAINTAIN")));
  }

  const preflightSql = buildApprovedBatchStateSql(batch, "preconditions");
  const postflightSql = buildApprovedBatchStateSql(batch, "postconditions");
  assert.equal((preflightSql.match(/0c1f144a5f4ed2d63e7cbe75cbdee0a425444763f84353d8dde8fb9a7a3ad6d4/gu) ?? []).length, 1);
  assert.equal((postflightSql.match(/8c0df2ed0556d31617abbdee9ca003d8346949fafa4e18a3a49f94fa98f4e7f5/gu) ?? []).length, 1);
  assert.match(preflightSql, /pg_catalog\.aclexplode/u);
  assert.match(postflightSql, /acl_entry\.is_grantable/u);
});

test("notification-preferences policy dedupe batch removes only the redundant SELECT policy", () => {
  const manifest = loadApprovedBatchManifest();
  const batch = manifest.batches.find(({ batch_id: batchId }) =>
    batchId === "notification-preferences-policy-dedupe-v1");
  assert.ok(batch);
  assert.equal(batch.source_ref, "da821d7ef775086fcf44583860fb0e5dc6dc74b0");
  assert.equal(batch.mode, "transactional");
  assert.deepEqual(batch.preconditions.required_migration_versions, ["20260824055000"]);
  assert.deepEqual(batch.preconditions.absent_migration_versions, ["20260824061117"]);
  assert.deepEqual(batch.migrations[0], {
    version: "20260824061117",
    name: "notification_preferences_policy_dedupe",
    path: "viza-fe/internal-website/supabase/migrations/20260824061117_notification_preferences_policy_dedupe.sql",
    sha256: "fbbaa13c9cde71289d4b22103bd33e11c87e61620e9d65f78d17c41d63968cde",
  });

  const preAssertions = batch.preconditions.catalog_assertions;
  const postAssertions = batch.postconditions.catalog_assertions;
  assert.equal(preAssertions.filter(({ kind }) => kind === "policy_contract").length, 2);
  assert.equal(postAssertions.filter(({ kind }) => kind === "policy_contract").length, 1);
  assert.deepEqual(
    preAssertions.filter(({ kind }) => kind === "policy_count").map(({ identity, count }) => [identity, count]),
    [["public.notification_preferences", 2]],
  );
  assert.deepEqual(
    postAssertions.filter(({ kind }) => kind === "policy_count").map(({ identity, count }) => [identity, count]),
    [["public.notification_preferences", 1]],
  );
  assert.deepEqual(
    postAssertions.filter(({ kind }) => kind === "policy_absent").map(({ identity, policy }) => [identity, policy]),
    [["public.notification_preferences", "notification_preferences_select_own"]],
  );

  for (const assertions of [preAssertions, postAssertions]) {
    assert.equal(assertions.filter(({ kind }) => kind === "rls_enabled").length, 1);
    const [acl] = assertions.filter(({ kind }) => kind === "relation_acl");
    assert.ok(acl);
    assert.deepEqual(acl.allowed_direct_roles, ["postgres", "anon", "authenticated", "service_role"]);
    assert.deepEqual(acl.forbidden_roles, ["PUBLIC"]);
    assert.equal(acl.grant_options_forbidden, true);
    assert.equal(acl.required.length, 4);
    assert.ok(acl.required.every(({ privileges, exact, exact_direct: exactDirect }) =>
      exact === true && exactDirect === true && privileges.length === 8 && privileges.includes("MAINTAIN")));
  }

  const preflightSql = buildApprovedBatchStateSql(batch, "preconditions");
  const postflightSql = buildApprovedBatchStateSql(batch, "postconditions");
  assert.equal((preflightSql.match(/f4e3e33d2585cbb579e477f7f118f0b5b80ac10bea6a0dbb5fa875089f38aa86/gu) ?? []).length, 3);
  assert.equal((postflightSql.match(/f4e3e33d2585cbb579e477f7f118f0b5b80ac10bea6a0dbb5fa875089f38aa86/gu) ?? []).length, 2);
  assert.match(postflightSql, /notification_preferences_select_own/u);
  assert.match(preflightSql, /pg_catalog\.aclexplode/u);
  assert.match(postflightSql, /acl_entry\.is_grantable/u);
});

test("approved batch state SQL supports only structured exact catalog guards", () => {
  const batch = {
    ...genericBatchManifest.batches[0],
    preconditions: {
      ...genericBatchManifest.batches[0].preconditions,
      catalog_assertions: [
        { id: "users_exists", kind: "relation_exists", identity: "public.users" },
        {
          id: "translations_absent",
          kind: "relation_absent",
          identity: "public.application_translations",
        },
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
          id: "users_legacy_policy_absent",
          kind: "policy_absent",
          identity: "public.users",
          policy: "Users can view all users",
        },
        {
          id: "users_policy_exact",
          kind: "policy_contract",
          identity: "public.users",
          policy: "users_select_own",
          command: "SELECT",
          roles: ["authenticated"],
          permissive: true,
          using_sha256: "7".repeat(64),
          check_sha256: null,
        },
        {
          id: "users_policy_count",
          kind: "policy_count",
          identity: "public.users",
          count: 1,
        },
        {
          id: "users_acl_exact",
          kind: "relation_acl",
          identity: "public.users",
          relation_kind: "table",
          required: [
            { role: "authenticated", privileges: ["SELECT"], exact: true },
          ],
          forbidden_roles: ["PUBLIC", "anon"],
        },
        {
          id: "commit_rpc_signature",
          kind: "function_exists",
          identity: "public.commit_travel_agent_turn(text,uuid,text,bigint,text,text,jsonb,text,text,jsonb,jsonb)",
        },
        {
          id: "match_chunks_fixed_path",
          kind: "function_search_path",
          identity: "public.match_visa_chunks(public.vector,integer,text,text,text[],real)",
          search_path: ["pg_catalog", "public"],
          security_definer: false,
        },
        {
          id: "future_objects_private",
          kind: "default_acl_denied",
          owner_roles: ["postgres"],
          object_types: ["r", "S", "f"],
          denied_roles: ["PUBLIC", "anon", "authenticated", "service_role"],
        },
        {
          id: "postgres_runtime_timeouts_exact",
          kind: "role_settings",
          role: "postgres",
          settings: {
            statement_timeout: "30s",
            idle_in_transaction_session_timeout: "30s",
          },
        },
      ],
    },
  };
  const sql = buildApprovedBatchStateSql(batch, "preconditions");
  assert.match(sql, /public\.users/u);
  assert.match(sql, /public\.application_translations/u);
  assert.match(sql, /to_regclass\('public\.application_translations'\) IS NULL/u);
  assert.match(sql, /Users can view all users/u);
  assert.match(sql, /users_select_own/u);
  assert.match(sql, /pg_catalog\.count\(\*\)[\s\S]*?\) = 1/u);
  assert.match(sql, /pg_catalog\.sha256/u);
  assert.match(sql, /has_table_privilege\('authenticated',[\s\S]*?'INSERT'\), FALSE/u);
  assert.match(sql, /information_schema\.columns/u);
  assert.match(sql, /commit_travel_agent_turn/u);
  assert.match(sql, /match_visa_chunks/u);
  assert.match(sql, /search_path=pg_catalog, public/u);
  assert.match(sql, /configured_function\.prosecdef IS FALSE/u);
  assert.match(sql, /default_scope\.namespace_oid/u);
  assert.match(sql, /VALUES \(0::oid, TRUE\)/u);
  assert.match(sql, /pg_catalog\.pg_roles/u);
  assert.match(sql, /statement_timeout=30s/u);
  assert.match(sql, /idle_in_transaction_session_timeout=30s/u);
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

  for (const unsafeAssertion of [
    {
      id: "unsafe_role",
      kind: "role_settings",
      role: "service_role",
      settings: { statement_timeout: "30s" },
    },
    {
      id: "unsafe_setting",
      kind: "role_settings",
      role: "postgres",
      settings: { search_path: "public" },
    },
    {
      id: "unsafe_value",
      kind: "role_settings",
      role: "postgres",
      settings: { statement_timeout: "0" },
    },
  ]) {
    assert.throws(
      () => buildApprovedBatchStateSql({
        ...batch,
        preconditions: { catalog_assertions: [unsafeAssertion] },
      }, "preconditions"),
      /invalid role settings/u,
    );
  }

  for (const unsafeAssertion of [
    {
      id: "unsafe_path_order",
      kind: "function_search_path",
      identity: "public.match_visa_chunks(public.vector,integer,text,text,text[],real)",
      search_path: ["public", "pg_catalog"],
      security_definer: false,
    },
    {
      id: "unsafe_path_schema",
      kind: "function_search_path",
      identity: "public.match_visa_chunks(public.vector,integer,text,text,text[],real)",
      search_path: ["pg_catalog", "public;drop schema public"],
      security_definer: false,
    },
  ]) {
    assert.throws(
      () => buildApprovedBatchStateSql({
        ...batch,
        preconditions: { catalog_assertions: [unsafeAssertion] },
      }, "preconditions"),
      /invalid function search path/u,
    );
  }
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
        ? { id: PRODUCTION_PROJECT_REF, ref: PRODUCTION_PROJECT_REF }
        : requests.length === 2
          ? [{ approved_batch_state: {
            project_ref_marker: null,
            migration_versions: ["20260820152526"],
          } }]
        : requests.length === 3
          ? { role: "cli_login_postgres", password: "temporary-password-123", ttl_seconds: 300 }
          : requests.length === 4
            ? [{
                database_type: "PRIMARY",
                db_host: "aws-1-ap-south-1.pooler.supabase.com",
                db_port: 5432,
                db_name: "postgres",
                db_user: `postgres.${PRODUCTION_PROJECT_REF}`,
                pool_mode: "session",
              }]
            : requests.length === 5
              ? { message: "ok" }
              : [{ approved_batch_state: {
                  project_ref_marker: null,
                  migration_versions: ["20260820152526", "20260822000000"],
                } }];
      return new Response(JSON.stringify(payload), { status: 200 });
    },
  });

  assert.equal(requests.length, 6);
  assert.match(requests[0].url, new RegExp(`/projects/${PRODUCTION_PROJECT_REF}$`, "u"));
  assert.match(requests[1].url, /database\/query\/read-only$/u);
  assert.match(requests[5].url, /database\/query\/read-only$/u);
  assert.match(execution.query, /20260822000000/u);
  assert.equal(result.batch_id, "database-access-baseline-v1");
  assert.deepEqual(result.migration_versions, ["20260820152526", "20260822000000"]);
});

test("approved batch verification is read-only and validates an already-recorded batch", async () => {
  const migrationRef = "a".repeat(40);
  const requests = [];
  const result = await runApprovedBatchVerify({
    env: {
      SUPABASE_ACCESS_TOKEN: "test-token",
      SUPABASE_PROJECT_REF: PRODUCTION_PROJECT_REF,
      PRODUCTION_DB_MAINTENANCE_BATCH_ID: "database-access-baseline-v1",
      PRODUCTION_DB_MAINTENANCE_SOURCE_REF: migrationRef,
      PRODUCTION_DB_MAINTENANCE_CONFIRM:
        `${PRODUCTION_PROJECT_REF}:verify-approved-batch:database-access-baseline-v1:${migrationRef}`,
    },
    manifest: genericBatchManifest,
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      const payload = requests.length === 1
        ? { id: PRODUCTION_PROJECT_REF, ref: PRODUCTION_PROJECT_REF }
        : [{ approved_batch_state: {
            project_ref_marker: null,
            migration_versions: ["20260820152526", "20260822000000"],
          } }];
      return new Response(JSON.stringify(payload), { status: 200 });
    },
  });
  assert.equal(requests.length, 2);
  assert.equal(requests[0].init.method, "GET");
  assert.match(requests[1].url, /database\/query\/read-only$/u);
  assert.equal(requests[1].init.method, "POST");
  assert.deepEqual(result.migration_versions, ["20260820152526", "20260822000000"]);
  assert.equal(result.source, "approved-migration-batch-verification");
});

test("generic approved batch verifies Management API identity and rejects a mismatched database marker", async () => {
  const migrationRef = "a".repeat(40);
  const env = {
    SUPABASE_ACCESS_TOKEN: "test-token",
    SUPABASE_PROJECT_REF: PRODUCTION_PROJECT_REF,
    PRODUCTION_DB_MAINTENANCE_ACTION: "apply-approved-batch",
    PRODUCTION_DB_MAINTENANCE_BATCH_ID: "database-access-baseline-v1",
    PRODUCTION_DB_MAINTENANCE_SOURCE_REF: migrationRef,
    PRODUCTION_DB_MAINTENANCE_CONFIRM:
      `${PRODUCTION_PROJECT_REF}:apply-approved-batch:database-access-baseline-v1:${migrationRef}`,
    MIGRATION_SOURCE_ROOT: "/approved-source",
  };
  let calls = 0;
  await assert.rejects(
    runApprovedBatchApply({
      env,
      manifest: genericBatchManifest,
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
    runApprovedBatchApply({
      env,
      manifest: genericBatchManifest,
      fetchImpl: async () => {
        calls += 1;
        const payload = calls === 1
          ? { ref: PRODUCTION_PROJECT_REF }
          : [{ approved_batch_state: {
              project_ref_marker: "wrong-project-ref",
              migration_versions: ["20260820152526"],
            } }];
        return new Response(JSON.stringify(payload), { status: 200 });
      },
    }),
    /database project marker is mismatched/u,
  );
  assert.equal(calls, 2);
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
  let guardedCalls = 0;
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
      fetchImpl: async () => {
        guardedCalls += 1;
        const payload = guardedCalls === 1
          ? { id: PRODUCTION_PROJECT_REF }
          : [{
              approved_batch_state: {
                project_ref_marker: null,
                migration_versions: ["20260820152526"],
                assertions: [{ id: "users_exists", passed: false }],
              },
            }];
        return new Response(JSON.stringify(payload), { status: 200 });
      },
    }),
    /catalog guard failed: users_exists/u,
  );
  assert.equal(guardedCalls, 2);
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
