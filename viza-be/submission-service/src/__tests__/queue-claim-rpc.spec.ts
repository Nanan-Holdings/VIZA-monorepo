import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  claimPendingSubmissionQueueItems,
  claimPendingIndonesiaQueueItems,
  claimPendingVietnamCloudQueueItems,
} from "../submission-queue-claim";

const repoRoot = path.resolve(__dirname, "..", "..", "..", "..");
const migrationPath = path.join(
  repoRoot,
  "viza-be",
  "agent-backend",
  "drizzle",
  "0105_submission_queue_claim_locks.sql",
);
const vietnamCloudMigrationPath = path.join(
  repoRoot,
  "viza-be",
  "agent-backend",
  "drizzle",
  "0116_vietnam_cloud_only_queue_claim.sql",
);
const vietnamPrearrivalMigrationPath = path.join(
  repoRoot,
  "viza-be",
  "agent-backend",
  "drizzle",
  "0117_vietnam_prearrival_queue_claim.sql",
);
const officialFeeIsolationMigrationPath = path.join(
  repoRoot,
  "viza-be",
  "agent-backend",
  "drizzle",
  "0118_official_fee_queue_isolation.sql",
);
const submissionRetryIsolationMigrationPath = path.join(
  repoRoot,
  "viza-be",
  "agent-backend",
  "drizzle",
  "0119_submission_retry_queue_isolation.sql",
);
const indonesiaStickyMigrationPath = path.join(
  repoRoot,
  "viza-be",
  "agent-backend",
  "drizzle",
  "0129_indonesia_sticky_runner.sql",
);
const queueWorkerLeaseMigrationPath = path.join(
  repoRoot,
  "viza-be",
  "agent-backend",
  "drizzle",
  "0137_queue_worker_leases_and_runtime_claims.sql",
);
const boundedMaintenanceMigrationPath = path.join(
  repoRoot,
  "viza-be",
  "agent-backend",
  "drizzle",
  "0138_bounded_queue_maintenance.sql",
);
const issuerCardLeaseMigrationPath = path.join(
  repoRoot,
  "viza-be",
  "agent-backend",
  "drizzle",
  "0145_protect_issuer_card_attempt_leases.sql",
);
const issuerCardLeaseSupabaseMigrationPath = path.join(
  repoRoot,
  "viza-fe",
  "internal-website",
  "supabase",
  "migrations",
  "20260815152000_protect_issuer_card_attempt_leases.sql",
);
const vietnamPaymentRegistrationCodeHandoffMigrationPath = path.join(
  repoRoot,
  "viza-be",
  "agent-backend",
  "drizzle",
  "0146_vietnam_payment_registration_code_handoff.sql",
);
const submissionServiceIndexPath = path.join(
  repoRoot,
  "viza-be",
  "submission-service",
  "src",
  "index.ts",
);
const vietnamPreCardSmokePath = path.join(
  repoRoot,
  "viza-be",
  "submission-service",
  "scripts",
  "run-vn-payment-pre-card-smoke.ts",
);

test("submission_queue claim migration uses skip-locked leases and service-role-only RPC access", () => {
  const sql = readFileSync(migrationPath, "utf8").toLowerCase();

  assert.match(sql, /alter table submission_queue[\s\S]*add column if not exists locked_by/);
  assert.match(sql, /alter table submission_queue[\s\S]*add column if not exists locked_until/);
  assert.match(sql, /for update skip locked/);
  assert.match(sql, /create or replace function public\.claim_submission_queue_batch/);
  assert.match(sql, /revoke all on function public\.claim_submission_queue_batch/);
  assert.match(sql, /grant execute on function public\.claim_submission_queue_batch[\s\S]*to service_role/);
});

test("Vietnam cloud claim migration isolates the new status behind its own service-role RPC", () => {
  const legacySql = readFileSync(migrationPath, "utf8").toLowerCase();
  const cloudSql = readFileSync(vietnamCloudMigrationPath, "utf8").toLowerCase();

  assert.doesNotMatch(legacySql, /vn_cloud_live_pending/);
  assert.match(cloudSql, /where sq\.status = 'vn_cloud_live_pending'/);
  assert.match(cloudSql, /for update skip locked/);
  assert.match(cloudSql, /create or replace function public\.claim_vn_cloud_submission_queue_batch/);
  assert.match(cloudSql, /grant execute on function public\.claim_vn_cloud_submission_queue_batch[\s\S]*to service_role/);
});

test("Vietnam Pre-Arrival states are included in the atomic legacy queue claim", () => {
  const sql = readFileSync(vietnamPrearrivalMigrationPath, "utf8").toLowerCase();

  assert.match(sql, /vn_prearrival_dry_run_pending/);
  assert.match(sql, /vn_prearrival_live_assisted_scheduled/);
  assert.match(sql, /vn_prearrival_live_assisted_pending/);
  assert.match(sql, /for update skip locked/);
  assert.match(sql, /create or replace function public\.claim_submission_queue_batch/);
  assert.match(sql, /grant execute on function public\.claim_submission_queue_batch[\s\S]*to service_role/);
});

test("Indonesia sticky migration isolates B1/C1 behind a dedicated service-role claim", () => {
  const sql = readFileSync(indonesiaStickyMigrationPath, "utf8").toLowerCase();
  const genericClaim = sql
    .split("create or replace function public.claim_submission_queue_batch")[1]
    ?.split("revoke all on function public.claim_submission_queue_batch")[0] ?? "";

  assert.match(sql, /create or replace function public\.claim_indonesia_submission_queue_batch/);
  assert.match(sql, /for update skip locked/);
  assert.match(sql, /grant execute on function public\.claim_indonesia_submission_queue_batch[\s\S]*to service_role/);
  assert.match(sql, /owner_kind in \('pool', 'legacy', 'south_korea', 'indonesia'\)/);
  assert.doesNotMatch(genericClaim, /id_c1_live_assisted_pending/);
  assert.doesNotMatch(genericClaim, /id_b1_evoa_live_assisted_pending/);
  assert.doesNotMatch(genericClaim, /vn_prearrival_live_assisted_pending/);
  assert.match(sql, /before insert[\s\S]*reject_indonesia_runner_job_transport/);
});

test("official-fee enqueue is serialized per application and cannot create competing active jobs", () => {
  const sql = readFileSync(officialFeeIsolationMigrationPath, "utf8").toLowerCase();

  assert.match(sql, /create unique index if not exists submission_queue_one_active_official_fee_job_idx/);
  assert.match(sql, /on public\.submission_queue\(application_id, provider\)/);
  assert.match(sql, /create or replace function public\.enqueue_official_fee_submission/);
  assert.match(sql, /from public\.applications[\s\S]*where id = p_application_id[\s\S]*for update/);
  assert.match(sql, /sq\.application_id = p_application_id/);
  assert.match(sql, /sq\.provider = p_provider/);
  assert.match(sql, /queue[\s\S]*claimers use skip locked[\s\S]*for update/);
  assert.match(sql, /status = 'retry_superseded'/);
  assert.match(sql, /locked_until > p_now/);
  assert.match(sql, /revoke all on function public\.enqueue_official_fee_submission/);
  assert.match(sql, /grant execute on function public\.enqueue_official_fee_submission[\s\S]*to service_role/);
});

test("Vietnam payment enqueue carries forward only same-application encrypted registration checkpoints", () => {
  const sql = readFileSync(vietnamPaymentRegistrationCodeHandoffMigrationPath, "utf8").toLowerCase();

  assert.match(sql, /before insert on public\.submission_queue/);
  assert.match(sql, /new\.provider <> 'vietnam_evisa_live'/);
  assert.match(sql, /new\.status <> 'vn_payment_pending'/);
  assert.match(sql, /registrationcodecapture[d]?/);
  assert.match(sql, /sq\.application_id = new\.application_id/);
  assert.match(sql, /sq\.provider = new\.provider/);
  assert.match(sql, /sq\.vn_registration_code_encrypted is not null/);
  assert.match(sql, /into new\.vn_registration_code_encrypted/);
  assert.doesNotMatch(sql, /decrypt/);
  assert.match(sql, /revoke all on function public\.carry_forward_vietnam_payment_registration_code/);
});

test("Vietnam payment resume always uses the managed tracking alias", () => {
  const source = readFileSync(submissionServiceIndexPath, "utf8");
  const paymentSection = source
    .split("async function processVnPaymentItem")[1]
    ?.split("async function processVnItem")[0] ?? "";

  assert.match(paymentSection, /const email = await getVietnamOfficialLookupEmail\(profile\.id\)/);
  assert.doesNotMatch(paymentSection, /submittedOfficialEmail/);
});

test("Vietnam cloud pre-card QA never mutates the existing official profile", () => {
  const source = readFileSync(submissionServiceIndexPath, "utf8");
  const paymentSection = source
    .split("async function processVnPaymentItem")[1]
    ?.split("async function processVnItem")[0] ?? "";

  assert.match(
    paymentSection,
    /const preCardQaMode\s*=\s*stopBeforeCardEntry\s*&&\s*item\.vn_result_payload\?\.qaMode === "pre_card_only"/,
  );
  assert.match(
    paymentSection,
    /if \(!preCardQaMode && \(!intent \|\| !isManagedVirtualCardIntent\(intent\)\)\)/,
  );
  assert.match(paymentSection, /if \(stopBeforeCardEntry && !preCardQaMode\)/);
});

test("Vietnam safe smoke can hand a fresh registration checkpoint to cloud before opening VNPAY", () => {
  const source = readFileSync(vietnamPreCardSmokePath, "utf8");
  const stopGate = source.indexOf('VN_PRE_CARD_STOP_AFTER_REGISTRATION === "true"');
  const paymentResume = source.indexOf("const result = await resumeVietnamOfficialPayment");

  assert.ok(stopGate > 0);
  assert.ok(paymentResume > stopGate);
  assert.match(source.slice(stopGate, paymentResume), /paymentSubmitted:\s*false/);
  assert.match(source.slice(stopGate, paymentResume), /return;/);
});

test("generic submission retries atomically supersede only the same application", () => {
  const sql = readFileSync(submissionRetryIsolationMigrationPath, "utf8").toLowerCase();

  assert.match(sql, /create unique index if not exists submission_queue_one_active_job_per_application_idx/);
  assert.match(sql, /on public\.submission_queue\(application_id\)/);
  assert.match(sql, /create or replace function public\.enqueue_submission_retry/);
  assert.match(sql, /from public\.applications[\s\S]*where id = p_application_id[\s\S]*for update/);
  assert.match(sql, /sq\.application_id = p_application_id/);
  assert.match(sql, /queue claimers use skip locked[\s\S]*for update/);
  assert.match(sql, /sq\.locked_until > p_now/);
  assert.match(sql, /status = 'retry_superseded'/);
  assert.match(sql, /insert into public\.submission_queue/);
  assert.match(sql, /revoke all on function public\.enqueue_submission_retry/);
  assert.match(sql, /grant execute on function public\.enqueue_submission_retry[\s\S]*to service_role/);
});

test("runtime claim migration filters providers inside the atomic skip-locked claim", () => {
  const sql = readFileSync(queueWorkerLeaseMigrationPath, "utf8").toLowerCase();
  const genericClaim = sql
    .split("create or replace function public.claim_submission_queue_batch")[1]
    ?.split("revoke all on function public.claim_submission_queue_batch")[0] ?? "";

  assert.match(genericClaim, /p_provider_allowlist text\[\] default null/);
  assert.match(genericClaim, /p_allow_failed boolean default false/);
  assert.match(genericClaim, /cardinality\(p_provider_allowlist\)/);
  assert.match(genericClaim, /sq\.provider = any \(p_provider_allowlist\)/);
  assert.match(genericClaim, /p_allow_failed[\s\S]*p_target_job_id is not null/);
  assert.match(genericClaim, /for update skip locked/);
  assert.match(genericClaim, /update public\.submission_queue[\s\S]*locked_by = btrim\(p_worker_id\)/);
  assert.match(
    sql,
    /grant execute on function public\.claim_submission_queue_batch\([\s\S]*text\[\], boolean[\s\S]*to service_role/,
  );
});

test("Vietnam status migration leases claims and conditionally settles only live worker ownership", () => {
  const sql = readFileSync(queueWorkerLeaseMigrationPath, "utf8").toLowerCase();
  const claim = sql
    .split("create or replace function public.claim_vn_official_status_checks")[1]
    ?.split("create or replace function public.complete_vn_official_status_check")[0] ?? "";
  const complete = sql
    .split("create or replace function public.complete_vn_official_status_check")[1]
    ?.split("create or replace function public.fail_vn_official_status_check")[0] ?? "";
  const fail = sql
    .split("create or replace function public.fail_vn_official_status_check")[1]
    ?.split("revoke all on function public.claim_vn_official_status_checks")[0] ?? "";

  assert.match(claim, /p_worker_id text/);
  assert.match(claim, /p_lease_seconds integer default 300/);
  assert.match(claim, /status = 'running'/);
  assert.match(claim, /lease_expires_at < now\(\)/);
  assert.match(claim, /for update skip locked/);

  assert.match(complete, /p_patch jsonb default '\{\}'::jsonb/);
  assert.match(complete, /p_patch\.status must be completed or cancelled/);
  assert.match(complete, /checks\.worker_id = p_worker_id/);
  assert.match(complete, /checks\.lease_expires_at > now\(\)/);
  assert.match(complete, /worker_id = null[\s\S]*lease_expires_at = null/);

  assert.match(fail, /status = 'failed'/);
  assert.match(fail, /checks\.worker_id = p_worker_id/);
  assert.match(fail, /checks\.lease_expires_at > now\(\)/);
  assert.match(fail, /worker_id = null[\s\S]*lease_expires_at = null/);
});

test("stale queue maintenance is a bounded indexed atomic RPC", () => {
  const sql = readFileSync(boundedMaintenanceMigrationPath, "utf8").toLowerCase();
  const source = readFileSync(submissionServiceIndexPath, "utf8");

  assert.match(sql, /create index if not exists submission_queue_stale_processing_idx/);
  assert.match(sql, /coalesce\(heartbeat_at, updated_at, created_at\)/);
  assert.match(sql, /create or replace function public\.mark_stale_submission_queue_batch/);
  assert.match(sql, /limit greatest\(1, least\(coalesce\(p_limit, 100\), 500\)\)/);
  assert.match(sql, /for update skip locked/);
  assert.match(sql, /update public\.submission_queue/);
  assert.match(sql, /update public\.applications/);
  assert.match(sql, /grant execute on function public\.mark_stale_submission_queue_batch[\s\S]*to service_role/);

  const maintenanceStart = source.indexOf("async function markStaleQueueItemsTimedOut");
  const maintenanceEnd = source.indexOf("async function loadDs160Answers", maintenanceStart);
  const maintenanceSource = source.slice(maintenanceStart, maintenanceEnd);
  assert.doesNotMatch(maintenanceSource, /\.from\(["']submission_queue["']\)\.select\(["']\*["']\)/);
  assert.match(maintenanceSource, /\.rpc\(["']mark_stale_submission_queue_batch["']/);
  assert.match(source, /STALE_QUEUE_MAINTENANCE_INTERVAL_MS/);
});

test("issuer-card claims preserve another worker's unexpired lease in both migration lineages", () => {
  const drizzleSql = readFileSync(issuerCardLeaseMigrationPath, "utf8").toLowerCase();
  const supabaseSql = readFileSync(issuerCardLeaseSupabaseMigrationPath, "utf8").toLowerCase();

  assert.equal(drizzleSql, supabaseSql);
  assert.match(drizzleSql, /select \* into v_attempt[\s\S]*for update/);
  assert.match(
    drizzleSql,
    /v_attempt\.locked_by is not null[\s\S]*v_attempt\.locked_by <> p_worker_id[\s\S]*v_attempt\.lease_expires_at > now\(\)/,
  );
  assert.match(drizzleSql, /issuer-card attempt is leased by another worker/);
  assert.ok(
    drizzleSql.indexOf("v_attempt.lease_expires_at > now()") <
      drizzleSql.indexOf("locked_by = p_worker_id"),
  );
});

test("claimPendingSubmissionQueueItems calls the DB claim RPC with worker and lease settings", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const claimedRows = [
    {
      id: "queue-1",
      application_id: "app-1",
      user_id: "user-1",
      status: "sgac_live_assisted_pending",
      attempts: 0,
      mode: "live_assisted",
      provider: "sg_arrival_card_live",
      last_error: null,
      ceac_result_payload: null,
      fv_result_payload: null,
      fv_application_reference: null,
      fv_pdf_storage_path: null,
      uk_result_payload: null,
      uk_application_reference: null,
      au_result_payload: null,
      au_trn: null,
      au_review_screenshot_storage_path: null,
      created_at: "2026-06-30T00:00:00.000Z",
      updated_at: "2026-06-30T00:00:00.000Z",
    },
  ];
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return { data: claimedRows, error: null };
    },
  };

  const result = await claimPendingSubmissionQueueItems(client, {
    workerId: "runner-a",
    limit: 10,
    leaseSeconds: 900,
  });

  assert.equal(result.length, 1);
  assert.equal(calls[0]?.name, "claim_submission_queue_batch");
  assert.deepEqual(calls[0]?.args, {
    p_worker_id: "runner-a",
    p_limit: 10,
    p_lease_seconds: 900,
    p_target_job_id: null,
    p_max_attempts: 3,
    p_provider_allowlist: null,
    p_allow_failed: false,
  });
});

test("generic claims send provider and failed-retry filters through the atomic RPC", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return { data: [], error: null };
    },
  };

  await claimPendingSubmissionQueueItems(client, {
    workerId: "5ec4f2a6-7972-422f-989d-de907947aa55",
    limit: 1,
    leaseSeconds: 600,
    maxAttempts: 4,
    providerAllowlist: [" vietnam_evisa_live ", "", "sg_arrival_card_live"],
    targetJobId: "00000000-0000-0000-0000-000000000001",
    allowFailed: true,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.name, "claim_submission_queue_batch");
  assert.deepEqual(calls[0]?.args, {
    p_worker_id: "5ec4f2a6-7972-422f-989d-de907947aa55",
    p_limit: 1,
    p_lease_seconds: 600,
    p_target_job_id: "00000000-0000-0000-0000-000000000001",
    p_max_attempts: 4,
    p_provider_allowlist: ["vietnam_evisa_live", "sg_arrival_card_live"],
    p_allow_failed: true,
  });
});

test("generic claim RPC errors fail closed without a table-select fallback", async () => {
  let rpcCalls = 0;
  let tableReads = 0;
  const client = {
    rpc: async () => {
      rpcCalls += 1;
      return {
        data: null,
        error: {
          code: "PGRST202",
          message: "claim_submission_queue_batch is missing from the schema cache",
        },
      };
    },
    from: () => {
      tableReads += 1;
      throw new Error("unsafe table fallback invoked");
    },
  };

  await assert.rejects(
    claimPendingSubmissionQueueItems(client, {
      workerId: "5ec4f2a6-7972-422f-989d-de907947aa55",
      limit: 5,
      leaseSeconds: 900,
      providerAllowlist: ["vietnam_evisa_live"],
    }),
    /failed to claim submission_queue batch/i,
  );
  assert.equal(rpcCalls, 1);
  assert.equal(tableReads, 0);
});

test("legacy production pickup contains no plain submission_queue select fallback", () => {
  const source = readFileSync(submissionServiceIndexPath, "utf8");
  const fetchStart = source.indexOf("async function fetchPendingItems");
  const fetchEnd = source.indexOf("function queuePriority", fetchStart);
  const fetchSource = source.slice(fetchStart, fetchEnd);

  assert.ok(fetchStart >= 0 && fetchEnd > fetchStart);
  assert.doesNotMatch(fetchSource, /\.from\(["']submission_queue["']\)[\s\S]*?\.select\(/);
  assert.doesNotMatch(fetchSource, /selectPendingItemsFallback/);
  assert.match(fetchSource, /claimPendingSubmissionQueueItems/);
});

test("two concurrent generic claimers cannot receive the same RPC-owned row", async () => {
  const pending = [{ id: "queue-atomic-1" }];
  let tableReads = 0;
  const client = {
    rpc: async () => ({ data: pending.splice(0, 1), error: null }),
    from: () => {
      tableReads += 1;
      throw new Error("unsafe table fallback invoked");
    },
  };

  const [first, second] = await Promise.all([
    claimPendingSubmissionQueueItems(client, {
      workerId: "worker-a",
      limit: 1,
      leaseSeconds: 900,
    }),
    claimPendingSubmissionQueueItems(client, {
      workerId: "worker-b",
      limit: 1,
      leaseSeconds: 900,
    }),
  ]);

  assert.equal([...first, ...second].length, 1);
  assert.equal([...first, ...second][0]?.id, "queue-atomic-1");
  assert.equal(tableReads, 0);
});

test("claimPendingVietnamCloudQueueItems calls only the cloud-isolated RPC", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return { data: [], error: null };
    },
  };

  await claimPendingVietnamCloudQueueItems(client, {
    workerId: "fly-vn",
    limit: 4,
    leaseSeconds: 600,
    targetJobId: "00000000-0000-0000-0000-000000000001",
  });

  assert.equal(calls[0]?.name, "claim_vn_cloud_submission_queue_batch");
  assert.deepEqual(calls[0]?.args, {
    p_worker_id: "fly-vn",
    p_limit: 4,
    p_lease_seconds: 600,
    p_target_job_id: "00000000-0000-0000-0000-000000000001",
    p_max_attempts: 3,
  });
});

test("claimPendingIndonesiaQueueItems calls only the sticky Indonesia RPC", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return { data: [], error: null };
    },
  };

  await claimPendingIndonesiaQueueItems(client, {
    workerId: "fly-indonesia",
    limit: 1,
    leaseSeconds: 900,
  });

  assert.equal(calls[0]?.name, "claim_indonesia_submission_queue_batch");
  assert.deepEqual(calls[0]?.args, {
    p_worker_id: "fly-indonesia",
    p_limit: 1,
    p_lease_seconds: 900,
    p_target_job_id: null,
    p_max_attempts: 3,
  });
});
