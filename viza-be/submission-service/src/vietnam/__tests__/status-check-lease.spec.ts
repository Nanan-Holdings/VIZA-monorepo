import assert from "node:assert/strict";
import test from "node:test";

import {
  claimVietnamOfficialStatusChecks,
  completeVietnamOfficialStatusCheck,
  failVietnamOfficialStatusCheck,
} from "../status-check-lease.js";

test("Vietnam status claims include worker ownership and a bounded lease", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return { data: [{ id: "check-1" }], error: null };
    },
  };

  const rows = await claimVietnamOfficialStatusChecks<{ id: string }>(client, {
    workerId: "worker-a",
    limit: 3,
    leaseSeconds: 420,
  });

  assert.deepEqual(rows, [{ id: "check-1" }]);
  assert.deepEqual(calls, [{
    name: "claim_vn_official_status_checks",
    args: { p_worker_id: "worker-a", p_limit: 3, p_lease_seconds: 420 },
  }]);
});

test("Vietnam status completion is conditional on the same worker", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return { data: false, error: null };
    },
  };

  const completed = await completeVietnamOfficialStatusCheck(client, {
    checkId: "check-1",
    workerId: "worker-a",
    patch: { status: "cancelled" },
  });

  assert.equal(completed, false);
  assert.deepEqual(calls[0], {
    name: "complete_vn_official_status_check",
    args: {
      p_check_id: "check-1",
      p_worker_id: "worker-a",
      p_patch: { status: "cancelled" },
    },
  });
});

test("Vietnam status failure is conditional and carries failure evidence", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return { data: true, error: null };
    },
  };

  const failed = await failVietnamOfficialStatusCheck(client, {
    checkId: "check-1",
    workerId: "worker-a",
    errorCode: "official_status_check_failed",
    errorMessage: "portal unavailable",
    rawStatusJson: { source: "vietnam_evisa_search", failed: true },
  });

  assert.equal(failed, true);
  assert.deepEqual(calls[0], {
    name: "fail_vn_official_status_check",
    args: {
      p_check_id: "check-1",
      p_worker_id: "worker-a",
      p_error_code: "official_status_check_failed",
      p_error_message: "portal unavailable",
      p_raw_status_json: { source: "vietnam_evisa_search", failed: true },
    },
  });
});
