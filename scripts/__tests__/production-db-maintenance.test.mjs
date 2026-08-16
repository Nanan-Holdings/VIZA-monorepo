import assert from "node:assert/strict";
import test from "node:test";
import {
  PREFLIGHT_SQL,
  PAUSE_SQL,
  PRODUCTION_PROJECT_REF,
  EXPECTED_CAP_SNAPSHOT,
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
