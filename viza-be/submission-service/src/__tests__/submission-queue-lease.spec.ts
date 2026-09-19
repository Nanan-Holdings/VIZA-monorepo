import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  renewSubmissionQueueLease,
  startSubmissionQueueLeaseHeartbeat,
  SubmissionQueueOwnershipLostError,
} from "../submission-queue-claim";

const repoRoot = path.resolve(__dirname, "..", "..", "..", "..");
const migrationPath = path.join(
  repoRoot,
  "viza-be",
  "agent-backend",
  "drizzle",
  "0195_ds160_submission_queue_lease_renewal.sql",
);
const submissionServiceIndexPath = path.join(
  repoRoot,
  "viza-be",
  "submission-service",
  "src",
  "index.ts",
);

const queueId = "00000000-0000-0000-0000-000000000001";
const leaseRow = () => [{
  id: queueId,
  locked_until: new Date(Date.now() + 120_000).toISOString(),
}];

function waitFor(predicate: () => boolean, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise<void>((resolve, reject) => {
    const check = (): void => {
      if (predicate()) {
        resolve();
        return;
      }
      if (Date.now() >= deadline) {
        reject(new Error("timed out waiting for lease heartbeat state"));
        return;
      }
      setTimeout(check, 10);
    };
    check();
  });
}

test("renewSubmissionQueueLease forwards the owner fence and parses the server lease", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return { data: leaseRow(), error: null };
    },
  };

  const renewed = await renewSubmissionQueueLease(client, {
    queueId,
    workerId: "submission-service-test",
    leaseSeconds: 900,
  });

  assert.equal(renewed?.queueId, queueId);
  assert.ok(renewed && Number.isFinite(Date.parse(renewed.leaseExpiresAt)));
  assert.deepEqual(calls, [{
    name: "renew_submission_queue_lease",
    args: {
      p_queue_id: queueId,
      p_worker_id: "submission-service-test",
      p_lease_seconds: 900,
    },
  }]);
});

test("an empty renewal result aborts the heartbeat and runs browser cleanup", async () => {
  let cleanupCalls = 0;
  const client = {
    rpc: async () => ({ data: [], error: null }),
  };

  await assert.rejects(
    startSubmissionQueueLeaseHeartbeat({
      client,
      queueId,
      workerId: "submission-service-test",
      onOwnershipLost: () => {
        cleanupCalls += 1;
      },
    }),
    (error: unknown) => error instanceof SubmissionQueueOwnershipLostError,
  );
  assert.equal(cleanupCalls, 1);
});

test("a renewal RPC error fails closed before the browser starts", async () => {
  const client = {
    rpc: async () => ({
      data: null,
      error: { message: "database unavailable" },
    }),
  };

  await assert.rejects(
    startSubmissionQueueLeaseHeartbeat({
      client,
      queueId,
      workerId: "submission-service-test",
    }),
    (error: unknown) => error instanceof SubmissionQueueOwnershipLostError,
  );
});

test("a later renewal refusal marks the running heartbeat lost and cleans up", async () => {
  let rpcCalls = 0;
  let cleanupCalls = 0;
  const client = {
    rpc: async () => {
      rpcCalls += 1;
      return rpcCalls === 1
        ? { data: leaseRow(), error: null }
        : { data: [], error: null };
    },
  };

  const heartbeat = await startSubmissionQueueLeaseHeartbeat({
    client,
    queueId,
    workerId: "submission-service-test",
    heartbeatMs: 1_000,
    onOwnershipLost: () => {
      cleanupCalls += 1;
    },
  });
  try {
    await waitFor(() => rpcCalls >= 2);
    await waitFor(() => heartbeat.isOwnershipLost());
    assert.equal(cleanupCalls, 1);
    assert.throws(() => heartbeat.assertOwned(), SubmissionQueueOwnershipLostError);
    assert.equal(heartbeat.signal.aborted, true);
  } finally {
    await heartbeat.stopRenewal();
  }
});

test("heartbeat renewals never overlap while a previous RPC is pending", async () => {
  let rpcCalls = 0;
  let inFlight = 0;
  let maxInFlight = 0;
  let releasePending!: () => void;
  const pendingRenewal = new Promise<void>((resolve) => {
    releasePending = resolve;
  });
  const client = {
    rpc: async () => {
      rpcCalls += 1;
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      try {
        if (rpcCalls === 1) return { data: leaseRow(), error: null };
        await pendingRenewal;
        return { data: leaseRow(), error: null };
      } finally {
        inFlight -= 1;
      }
    },
  };

  const heartbeat = await startSubmissionQueueLeaseHeartbeat({
    client,
    queueId,
    workerId: "submission-service-test",
    heartbeatMs: 1_000,
  });
  try {
    await waitFor(() => rpcCalls >= 2);
    await new Promise((resolve) => setTimeout(resolve, 1_250));
    assert.equal(rpcCalls, 2);
    assert.equal(maxInFlight, 1);
    releasePending();
  } finally {
    releasePending();
    await heartbeat.stopRenewal();
  }
});

test("a hung renewal is bounded by the conservative lease deadline", async () => {
  let rpcCalls = 0;
  let cleanupCalls = 0;
  const shortLeaseRow = [{
    id: queueId,
    // The production lease remains at least 60 seconds; this deliberately
    // short synthetic server expiry proves the request timeout is clamped to
    // the remaining conservative deadline rather than waiting 20 seconds.
    locked_until: new Date(Date.now() + 8_000).toISOString(),
  }];
  const client = {
    rpc: async () => {
      rpcCalls += 1;
      if (rpcCalls === 1) return { data: shortLeaseRow, error: null };
      return new Promise<never>(() => undefined);
    },
  };

  const startedAt = Date.now();
  const heartbeat = await startSubmissionQueueLeaseHeartbeat({
    client,
    queueId,
    workerId: "submission-service-test",
    heartbeatMs: 1_000,
    onOwnershipLost: () => {
      cleanupCalls += 1;
    },
  });
  try {
    await waitFor(() => heartbeat.isOwnershipLost(), 4_500);
    assert.equal(rpcCalls, 2);
    assert.equal(cleanupCalls, 1);
    assert.ok(Date.now() - startedAt < 4_500);
  } finally {
    await heartbeat.stopRenewal();
  }
});

test("lease renewal migration locks before sampling the server clock and is service-role-only", () => {
  const sql = readFileSync(migrationPath, "utf8").toLowerCase();
  assert.match(sql, /select \*[\s\S]*into v_queue[\s\S]*for update/);
  assert.match(sql, /set_config\('lock_timeout', '2s', true\)/);
  assert.match(sql, /v_now := clock_timestamp\(\)/);
  assert.match(sql, /v_queue\.locked_until <= v_now/);
  assert.match(sql, /sq\.locked_until > v_now/);
  assert.match(sql, /revoke all on function public\.renew_submission_queue_lease/);
  assert.match(sql, /grant execute on function public\.renew_submission_queue_lease[\s\S]*to service_role/);
  assert.doesNotMatch(sql, /security definer/);
});

test("DS-160 ownership loss closes CEAC and skips stale settlement writes", () => {
  const source = readFileSync(submissionServiceIndexPath, "utf8");
  assert.match(source, /startSubmissionQueueLeaseHeartbeat/);
  assert.match(source, /onOwnershipLost:[\s\S]*session\.close/);
  assert.match(source, /updateOwnedDs160Queue/);
  assert.match(source, /instanceof SubmissionQueueOwnershipLostError \|\| queueLease\?\.isOwnershipLost\(\)/);
  assert.match(source, /stopping without settlement/);
});
