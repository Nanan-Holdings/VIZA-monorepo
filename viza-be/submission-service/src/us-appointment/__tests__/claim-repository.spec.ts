import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";

process.env.SUPABASE_URL ??= "http://127.0.0.1:1";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-key";

const jobId = "a1000000-0000-0000-0000-000000000001";
const claimId = "b1000000-0000-0000-0000-000000000001";
const workerId = "us-appointment-test-worker";

test("claim sends the exact persisted job and worker to one RPC and returns its claim UUID", async () => {
  const { SupabaseUSAppointmentClaims } = await import("../claim-repository");
  let calls = 0;
  const db = createClient("http://127.0.0.1:1", "test-key", { global: { fetch: async (input, init) => {
    calls += 1;
    assert.equal(new URL(String(input)).pathname, "/rest/v1/rpc/claim_us_appointment_runner_job");
    assert.equal(init?.method, "POST");
    assert.deepEqual(JSON.parse(String(init?.body)), { p_job_id: jobId, p_worker_id: workerId });
    return Response.json(claimId);
  } } });
  assert.deepEqual(await new SupabaseUSAppointmentClaims(db).claim(jobId, workerId), { claimId });
  assert.equal(calls, 1);
});

test("claim conflict or ineligible job is null, while malformed responses fail closed", async () => {
  const { SupabaseUSAppointmentClaims } = await import("../claim-repository");
  const conflict = new SupabaseUSAppointmentClaims({ rpc: async () => ({ data: null, error: null }) });
  assert.equal(await conflict.claim(jobId, workerId), null);
  for (const data of [undefined, false, true, "", "claimed", [claimId], { claimId }]) {
    const claims = new SupabaseUSAppointmentClaims({ rpc: async () => ({ data, error: null }) });
    await assert.rejects(claims.claim(jobId, workerId), { message: "US_APPOINTMENT_CLAIM_INVALID_RESPONSE" });
  }
});

test("claim failure never discloses database or transport error contents", async () => {
  const { SupabaseUSAppointmentClaims } = await import("../claim-repository");
  for (const rpc of [
    async () => ({ data: null, error: { message: "sensitive row details", code: "42501" } }),
    async () => { throw new Error("sensitive connection details"); },
  ]) {
    await assert.rejects(new SupabaseUSAppointmentClaims({ rpc }).claim(jobId, workerId), {
      message: "US_APPOINTMENT_CLAIM_FAILED",
    });
  }
});

test("finish sends exact claim ownership and outcome; only true acknowledges settlement", async () => {
  const { SupabaseUSAppointmentClaims } = await import("../claim-repository");
  for (const outcome of ["completed", "failed", "skipped"] as const) {
    const claims = new SupabaseUSAppointmentClaims({ rpc: async (name, args) => {
      assert.equal(name, "finish_us_appointment_runner_job");
      assert.deepEqual(args, { p_claim_id: claimId, p_worker_id: workerId, p_outcome: outcome });
      return { data: true, error: null };
    } });
    await claims.finish(claimId, workerId, outcome);
  }
  for (const data of [false, null, undefined, "true", 1, [true]]) {
    const claims = new SupabaseUSAppointmentClaims({ rpc: async () => ({ data, error: null }) });
    await assert.rejects(claims.finish(claimId, workerId, "completed"), {
      message: "US_APPOINTMENT_CLAIM_FINISH_CONFLICT",
    });
  }
});

test("finish errors are fixed codes and do not attempt a second settlement", async () => {
  const { SupabaseUSAppointmentClaims } = await import("../claim-repository");
  let calls = 0;
  const claims = new SupabaseUSAppointmentClaims({ rpc: async () => {
    calls += 1;
    return { data: false, error: { message: "sensitive database details" } };
  } });
  await assert.rejects(claims.finish(claimId, workerId, "failed"), { message: "US_APPOINTMENT_CLAIM_FINISH_FAILED" });
  assert.equal(calls, 1);
  const disconnected = new SupabaseUSAppointmentClaims({ rpc: async () => { throw new Error("private connection"); } });
  await assert.rejects(disconnected.finish(claimId, workerId, "failed"), { message: "US_APPOINTMENT_CLAIM_FINISH_FAILED" });
});

const migrationPath = resolve(__dirname, "../../../../agent-backend/drizzle/0193_us_appointment_runner_claims.sql");

function functionSql(sql: string, name: string): string {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  assert.notEqual(start, -1, `missing ${name}`);
  const end = sql.indexOf("$$;", start);
  assert.notEqual(end, -1);
  return sql.slice(start, end + 3);
}

test("migration serializes exact-job claims and has no expiration or owner takeover path", async () => {
  const sql = await readFile(migrationPath, "utf8");
  const claim = functionSql(sql, "claim_us_appointment_runner_job");
  assert.match(claim, /FROM public\.appointment_assistance_jobs\s+WHERE id = p_job_id FOR UPDATE;/);
  assert.ok(claim.indexOf("FOR UPDATE") < claim.indexOf("IF EXISTS"));
  assert.ok(claim.indexOf("IF EXISTS") < claim.indexOf("INSERT INTO private.us_appointment_runner_claims"));
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS us_appointment_runner_claims_one_active_job_idx\s+ON private\.us_appointment_runner_claims\(job_id\) WHERE status = 'active';/);
  assert.match(claim, /WHERE job_id = p_job_id AND status = 'active'\) THEN\s+RETURN NULL;/);
  assert.doesNotMatch(claim, /UPDATE private\.us_appointment_runner_claims|DELETE FROM|claimed_at\s*[<>]|ON CONFLICT|SKIP LOCKED/i);
  assert.match(sql, /REFERENCES public\.appointment_assistance_jobs\(id\) ON DELETE RESTRICT/);
});

test("migration rejects unsupported routes and nonautomatic checkpoint states before claiming", async () => {
  const sql = await readFile(migrationPath, "utf8");
  const claim = functionSql(sql, "claim_us_appointment_runner_job");
  for (const [field, value] of Object.entries({ mode: "assisted_live", country_code: "US", applying_country_code: "CN", scheduling_provider: "usvisascheduling" })) {
    assert.ok(claim.includes(`v_job.${field} IS DISTINCT FROM '${value}'`));
  }
  const allowedStatuses = [...claim.matchAll(/'(appointment_[a-z_]+)'/g)].map((match) => match[1]);
  assert.deepEqual(allowedStatuses, [
    "appointment_consent_received", "appointment_account_required", "appointment_login_required",
    "appointment_payment_completed", "appointment_no_slots_available", "appointment_booked",
    "appointment_status_check_in_progress",
  ]);
  assert.match(claim, /v_job\.requires_user_action IS TRUE AND COALESCE\(v_job\.current_manual_action, ''\) NOT IN \('login', 'account_email_verification'\)/);
  assert.match(claim, /v_job\.current_manual_action IS NOT NULL AND v_job\.current_manual_action NOT IN \('login', 'account_email_verification'\)/);
});

test("migration settlement preserves exact owner, requires active claim and acknowledges affected row", async () => {
  const sql = await readFile(migrationPath, "utf8");
  const finish = functionSql(sql, "finish_us_appointment_runner_job");
  assert.match(finish, /p_outcome IS NULL OR p_outcome NOT IN \('completed', 'failed', 'skipped'\)/);
  assert.match(finish, /SET status = p_outcome, finished_at = clock_timestamp\(\)\s+WHERE id = p_claim_id AND worker_id = p_worker_id AND status = 'active';\s+RETURN FOUND;/);
  assert.doesNotMatch(finish, /UPDATE public\.appointment_assistance_jobs|SET worker_id|INSERT INTO|DELETE FROM/);
});

test("migration exposes only restricted service RPCs and preserves shared runner contracts", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /ALTER TABLE private\.us_appointment_runner_claims ENABLE ROW LEVEL SECURITY;/);
  assert.match(sql, /REVOKE ALL ON TABLE private\.us_appointment_runner_claims FROM PUBLIC, anon, authenticated, service_role;/);
  assert.doesNotMatch(sql, /CREATE POLICY|GRANT .+ ON TABLE/i);
  const definitions = [...sql.matchAll(/CREATE OR REPLACE FUNCTION public\.([a-z_]+)\(/g)].map((match) => match[1]);
  assert.deepEqual(definitions, ["claim_us_appointment_runner_job", "finish_us_appointment_runner_job"]);
  for (const [name, args] of [["claim_us_appointment_runner_job", "UUID, TEXT"], ["finish_us_appointment_runner_job", "UUID, TEXT, TEXT"]]) {
    assert.match(functionSql(sql, name), /SECURITY DEFINER SET search_path = ''/);
    assert.ok(sql.includes(`REVOKE ALL ON FUNCTION public.${name}(${args}) FROM PUBLIC, anon, authenticated;`));
    assert.ok(sql.includes(`GRANT EXECUTE ON FUNCTION public.${name}(${args}) TO service_role;`));
  }
  assert.doesNotMatch(sql, /ALTER TABLE public\.runner_job|UPDATE public\.runner_job|DROP (?:FUNCTION|TABLE|TRIGGER)/i);
});
