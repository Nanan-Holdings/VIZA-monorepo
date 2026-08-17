import assert from "node:assert/strict";
import test from "node:test";
import {
  APPROVED_MIGRATION_SOURCE_REF,
  APPROVED_MIGRATIONS,
  PREFLIGHT_SQL,
  PAUSE_SQL,
  PRODUCTION_PROJECT_REF,
  EXPECTED_CAP_SNAPSHOT,
  SUPABASE_PRODUCTION_CA_SHA256,
  SUPABASE_PRODUCTION_CA_URL,
  downloadSupabaseProductionCa,
  executePsqlMigration,
  loadApprovedMigrationBatch,
  runApply,
  runPause,
  runPreflight,
} from "../production-db-maintenance.mjs";

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
