import { test } from "node:test";
import assert from "node:assert/strict";

import { emitConcurrencyMetric } from "./emit.js";

test("emitConcurrencyMetric inserts only bounded operational fields", async () => {
  const inserts: Array<Record<string, unknown>> = [];
  const client = {
    from: (table: string) => {
      assert.equal(table, "runner_concurrency_metric");
      return {
        insert: async (values: Record<string, unknown>) => {
          inserts.push(values);
          return { error: null };
        },
      };
    },
  };

  await emitConcurrencyMetric({
    eventType: "claim",
    outcome: "claimed",
    durationMs: 42,
    country: "vietnam",
    machineKind: "pool",
    count: 1,
  }, client);

  assert.deepEqual(inserts, [{
    event_type: "claim",
    outcome: "claimed",
    duration_ms: 42,
    country: "vietnam",
    machine_kind: "pool",
    count: 1,
  }]);
});

test("emitConcurrencyMetric swallows database failures", async () => {
  let attempted = 0;
  const client = {
    from: () => ({
      insert: async () => {
        attempted += 1;
        return { error: { message: "metric table unavailable" } };
      },
    }),
  };

  await assert.doesNotReject(() => emitConcurrencyMetric({
    eventType: "machine_start",
    outcome: "started",
    durationMs: 100,
  }, client));
  assert.equal(attempted, 1);
});

test("emitConcurrencyMetric swallows synchronous client failures", async () => {
  const client = {
    from: () => {
      throw new Error("connection unavailable");
    },
  };

  await assert.doesNotReject(() => emitConcurrencyMetric({
    eventType: "claim",
    outcome: "error",
    durationMs: 1,
  }, client));
});
