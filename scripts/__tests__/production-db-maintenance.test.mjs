import assert from "node:assert/strict";
import test from "node:test";
import {
  APPROVED_MIGRATION_SOURCE_REF,
  APPROVED_MIGRATIONS,
  PREFLIGHT_SQL,
  PAUSE_SQL,
  PRODUCTION_PROJECT_REF,
  EXPECTED_CAP_SNAPSHOT,
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

test("apply reads only the approved ref and exact migration hashes", async () => {
  const requests = [];
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
    fetchImpl: async (url, init) => {
      requests.push({ url, body: JSON.parse(init.body) });
      const payload = requests.length === 1
        ? drainedPreflightPayload()
        : [{ maintenance_apply_state: { runner_private_schema: true } }];
      return new Response(JSON.stringify(payload), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    },
  });

  assert.equal(requests.length, 2);
  assert.match(requests[0].url, /database\/query\/read-only$/u);
  assert.match(requests[1].url, /database\/query$/u);
  assert.equal(requests[1].body.read_only, false);
  assert.match(requests[1].body.query, /^BEGIN;/u);
  assert.match(requests[1].body.query, /20260816160000/u);
  assert.match(requests[1].body.query, /20260816161000/u);
  assert.match(requests[1].body.query, /COMMIT;/u);
  assert.deepEqual(result, [{ maintenance_apply_state: { runner_private_schema: true } }]);
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
