import { test } from "node:test";
import assert from "node:assert/strict";

import { drainAndRun } from "./worker.js";

test("drainAndRun records an empty claim without changing the queue result", async () => {
  const metrics: Array<Record<string, unknown>> = [];
  const result = await drainAndRun({
    workerId: "worker-empty",
    handler: async () => {
      throw new Error("empty queue must not invoke a handler");
    },
    dependencies: {
      client: {
        rpc: async () => ({ data: null, error: null }),
      },
    },
    emitClaimMetric: async (metric) => {
      metrics.push(metric as unknown as Record<string, unknown>);
    },
  });

  assert.deepEqual(result, { jobsProcessed: 0, stoppedBecause: "empty" });
  assert.equal(metrics.length, 1);
  assert.equal(metrics[0]?.eventType, "claim");
  assert.equal(metrics[0]?.outcome, "empty");
  assert.equal(typeof metrics[0]?.durationMs, "number");
});

test("claim metric failures never mask an RPC claim error", async () => {
  const result = await drainAndRun({
    workerId: "worker-error",
    handler: async () => undefined,
    dependencies: {
      client: {
        rpc: async () => ({ data: null, error: { message: "database unavailable" } }),
      },
    },
    emitClaimMetric: async () => {
      throw new Error("metric database unavailable");
    },
  });

  assert.deepEqual(result, { jobsProcessed: 0, stoppedBecause: "claim_error" });
});

test("transient application row locks retry inside the same drain", async () => {
  let claimCalls = 0;
  let claimErrors = 0;
  let healthyClaims = 0;
  const result = await drainAndRun({
    workerId: "worker-row-lock",
    handler: async () => undefined,
    claimLockRetryDelaysMs: [0, 0],
    dependencies: {
      client: {
        rpc: async () => {
          claimCalls += 1;
          if (claimCalls <= 2) {
            return {
              data: null,
              error: { message: 'could not obtain lock on row in relation "applications"' },
            };
          }
          return { data: null, error: null };
        },
      },
    },
    onClaimError: () => {
      claimErrors += 1;
    },
    onClaimHealthy: () => {
      healthyClaims += 1;
    },
  });

  assert.deepEqual(result, { jobsProcessed: 0, stoppedBecause: "empty" });
  assert.equal(claimCalls, 3);
  assert.equal(claimErrors, 0);
  assert.equal(healthyClaims, 1);
});

test("transient application row lock retries are bounded", async () => {
  let claimCalls = 0;
  let claimErrors = 0;
  const result = await drainAndRun({
    workerId: "worker-row-lock-exhausted",
    handler: async () => undefined,
    claimLockRetryDelaysMs: [0, 0],
    dependencies: {
      client: {
        rpc: async () => {
          claimCalls += 1;
          return {
            data: null,
            error: { message: 'could not obtain lock on row in relation "applications"' },
          };
        },
      },
    },
    onClaimError: () => {
      claimErrors += 1;
    },
  });

  assert.deepEqual(result, { jobsProcessed: 0, stoppedBecause: "claim_error" });
  assert.equal(claimCalls, 3);
  assert.equal(claimErrors, 1);
});

test("a claimed job emits claimed latency before normal settlement", async () => {
  const metrics: Array<Record<string, unknown>> = [];
  const job = {
    id: "job-1",
    application_id: "application-1",
    country: "vietnam",
    flow_key: "vn_prearrival",
    attempts: 0,
    max_attempts: 3,
    correlation_id: null,
    metadata: null,
  };
  const calls: string[] = [];
  let claimed = true;
  const result = await drainAndRun({
    workerId: "worker-claimed",
    handler: async () => undefined,
    dependencies: {
      client: {
        rpc: async (name) => {
          calls.push(name);
          if (name === "claim_runner_pool_job") {
            if (claimed) {
              claimed = false;
              return { data: job, error: null };
            }
            return { data: null, error: null };
          }
          if (name === "complete_runner_pool_job") {
            return {
              data: {
                id: job.id,
                application_id: job.application_id,
                country: job.country,
                started_at: new Date().toISOString(),
              },
              error: null,
            };
          }
          return { data: null, error: null };
        },
      },
    },
    emitClaimMetric: async (metric) => {
      metrics.push(metric as unknown as Record<string, unknown>);
    },
  });

  assert.equal(result.jobsProcessed, 1);
  assert.equal(result.stoppedBecause, "empty");
  assert.equal(metrics[0]?.outcome, "claimed");
  assert.equal(metrics[0]?.country, "vietnam");
  assert.ok(calls.includes("complete_runner_pool_job"));
});
