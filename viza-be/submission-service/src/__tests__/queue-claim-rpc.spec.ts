import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { claimPendingSubmissionQueueItems } from "../submission-queue-claim";

const repoRoot = path.resolve(__dirname, "..", "..", "..", "..");
const migrationPath = path.join(
  repoRoot,
  "viza-be",
  "agent-backend",
  "drizzle",
  "0105_submission_queue_claim_locks.sql",
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
  });
});
