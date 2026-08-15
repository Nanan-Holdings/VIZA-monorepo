import assert from "node:assert/strict";
import test from "node:test";
import type {
  RunnerExecutionContext,
  RunnerJob,
  RunnerPoolClient,
} from "../worker.js";
import { RunnerJobOwnershipLostError } from "../execution-context.js";
import { claimNextJob, RunnerPoolRpcSchemaError } from "../worker.js";

process.env.SUPABASE_URL ??= "https://worker-runtime-test.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "worker-runtime-test-key";

type RpcCall = { name: string; args: Record<string, unknown> };
type QueryResult = { data: unknown; error: { message: string } | null };

interface FakeQuery {
  insert(values: unknown): Promise<QueryResult>;
  update(values: Record<string, unknown>): FakeQuery;
  eq(column: string, value: unknown): FakeQuery;
  gt(column: string, value: unknown): FakeQuery;
  select(columns: string): FakeQuery;
  maybeSingle(): Promise<QueryResult>;
}

interface MutableSupabaseClient {
  rpc(name: string, args: Record<string, unknown>): Promise<QueryResult>;
  from(table: string): FakeQuery;
}

interface WorkerModule {
  markSucceeded(jobId: string, workerId: string, dependencies?: unknown): Promise<void>;
  markFailedWithRetry(
    job: RunnerJob,
    error: unknown,
    workerId: string,
    client?: RunnerPoolClient,
  ): Promise<number | null>;
  drainAndRun(options: {
    workerId: string;
    leaseMs: number;
    renewEveryMs: number;
    dependencies?: { client: RunnerPoolClient };
    handler: (job: RunnerJob, execution: RunnerExecutionContext) => Promise<void>;
  }): Promise<{ jobsProcessed: number; stoppedBecause: string }>;
}

function claimedJob() {
  return {
    id: "job-1",
    application_id: "app-1",
    country: "singapore",
    flow_key: "sgac",
    attempts: 0,
    max_attempts: 3,
    correlation_id: null,
    metadata: null,
    started_at: null,
  };
}

async function loadWorker(): Promise<{ worker: WorkerModule; client: MutableSupabaseClient }> {
  const [{ supabase }, worker] = await Promise.all([
    import("../../supabase.js"),
    import("../worker.js"),
  ]);
  return {
    worker: worker as unknown as WorkerModule,
    client: supabase as unknown as MutableSupabaseClient,
  };
}

function queryReturning(data: unknown, error: { message: string } | null = null): FakeQuery {
  const chain: FakeQuery = {
    insert: async () => ({ data: null, error: null }),
    update: () => chain,
    eq: () => chain,
    gt: () => chain,
    select: () => chain,
    maybeSingle: async () => ({ data, error }),
  };
  return chain;
}

test("success settlement uses the DB clock and does not send client p_now", async () => {
  const { worker, client } = await loadWorker();
  const calls: RpcCall[] = [];
  const originalRpc = client.rpc;
  client.rpc = async (name, args) => {
    calls.push({ name, args });
    return {
      data: { application_id: "app-1", country: "singapore", started_at: null },
      error: null,
    };
  };
  try {
    await worker.markSucceeded("job-1", "worker-1");
    assert.deepEqual(calls[0]?.name, "complete_runner_pool_job");
    assert.equal("p_now" in (calls[0]?.args ?? {}), false);
  } finally {
    client.rpc = originalRpc;
  }
});

test("worker RPC settlement parsing fails closed on malformed truthy rows", async () => {
  const { worker, client } = await loadWorker();
  const originalRpc = client.rpc;
  client.rpc = async (name) => {
    if (name === "claim_runner_pool_job") return { data: { id: "job-1" }, error: null };
    if (name === "complete_runner_pool_job") return { data: {}, error: null };
    return { data: {}, error: null };
  };
  try {
    const dependencyClient = client as unknown as RunnerPoolClient;
    await assert.rejects(
      () => import("../worker.js").then(({ claimNextJob }) =>
        claimNextJob({ workerId: "worker-1", client: dependencyClient })),
      (error: unknown) => error instanceof RunnerPoolRpcSchemaError,
    );
    await assert.rejects(
      () => worker.markSucceeded("job-1", "worker-1"),
      (error: unknown) => error instanceof RunnerPoolRpcSchemaError,
    );
    await assert.rejects(
      () => worker.markFailedWithRetry({ ...claimedJob(), attempts: 0 }, new Error("x"), "worker-1", dependencyClient),
      (error: unknown) => error instanceof RunnerPoolRpcSchemaError,
    );
  } finally {
    client.rpc = originalRpc;
  }
});

test("claim parser accepts only the six exact active pool tuples", async () => {
  const { client } = await loadWorker();
  const originalRpc = client.rpc;
  const tuples = [
    ["vietnam", "vn_prearrival"],
    ["singapore", "sgac"],
    ["malaysia", "mdac"],
    ["thailand", "tdac"],
    ["south_korea", "kr_eform"],
    ["taiwan", "tw_entry_permit"],
  ] as const;
  try {
    for (const [country, flowKey] of tuples) {
      client.rpc = async () => ({
        data: [{ ...claimedJob(), id: `${country}-job`, country, flow_key: flowKey }],
        error: null,
      });
      const claimed = await claimNextJob({ workerId: "worker-1", client });
      assert.equal(claimed?.country, country);
      assert.equal(claimed?.flow_key, flowKey);
    }

    client.rpc = async () => ({
      data: [{ ...claimedJob(), country: "taiwan", flow_key: "sgac" }],
      error: null,
    });
    await assert.rejects(
      () => claimNextJob({ workerId: "worker-1", client }),
      (error: unknown) => error instanceof RunnerPoolRpcSchemaError,
    );

    client.rpc = async () => ({ data: [], error: null });
    assert.equal(await claimNextJob({ workerId: "worker-1", client }), null);
    client.rpc = async () => ({ data: null, error: null });
    assert.equal(await claimNextJob({ workerId: "worker-1", client }), null);
  } finally {
    client.rpc = originalRpc;
  }
});

test("failure settlement keeps retry and dead-letter backoff semantics", async () => {
  const { worker } = await loadWorker();
  const calls: RpcCall[] = [];
  const client: RunnerPoolClient = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: { id: "job-1", status: args.p_status, available_at: null }, error: null };
    },
    from: () => queryReturning(null),
  };
  const retryDelayMs = await worker.markFailedWithRetry(
    { ...claimedJob(), attempts: 0 },
    new Error("temporary portal outage"),
    "worker-1",
    client,
  );
  assert.equal(retryDelayMs, 15_000);
  assert.deepEqual(calls[0], {
    name: "fail_runner_pool_job",
    args: {
      p_job_id: "job-1",
      p_worker_id: "worker-1",
      p_status: "queued",
      p_attempts: 1,
      p_last_error: "temporary portal outage",
      p_retry_after_seconds: 15,
    },
  });

  calls.length = 0;
  const deadLetterDelayMs = await worker.markFailedWithRetry(
    { ...claimedJob(), attempts: 2 },
    new Error("permanent portal outage"),
    "worker-1",
    client,
  );
  assert.equal(deadLetterDelayMs, null);
  assert.equal(calls[0]?.args.p_status, "failed");
  assert.equal(calls[0]?.args.p_attempts, 3);
  assert.equal(calls[0]?.args.p_retry_after_seconds, 0);
});

test("successful renew uses the typed DB-clock renewal RPC result", async () => {
  const { worker, client } = await loadWorker();
  const calls: RpcCall[] = [];
  const originalRpc = client.rpc;
  const originalFrom = client.from;
  let claimed = false;
  client.rpc = async (name, args) => {
    calls.push({ name, args });
    if (name === "claim_runner_pool_job") {
      if (claimed) return { data: null, error: null };
      claimed = true;
      return { data: claimedJob(), error: null };
    }
    if (name === "complete_runner_pool_job") return { data: claimedJob(), error: null };
    return { data: { leased_until: "2099-01-01T00:00:00.000Z" }, error: null };
  };
  client.from = () => queryReturning({ id: "job-1" });
  try {
    await worker.drainAndRun({
      workerId: "worker-1",
      leaseMs: 100,
      renewEveryMs: 5,
      handler: async () => new Promise((resolve) => setTimeout(resolve, 20)),
    });
    assert.ok(calls.some((call) => call.name === "renew_runner_pool_job"));
  } finally {
    client.rpc = originalRpc;
    client.from = originalFrom;
  }
});

test("renewal ownership loss aborts the active handler", async () => {
  const { worker, client } = await loadWorker();
  const originalRpc = client.rpc;
  const originalFrom = client.from;
  let claimed = false;
  let renewalCalls = 0;
  client.rpc = async (name) => {
    if (name === "claim_runner_pool_job") {
      if (claimed) return { data: null, error: null };
      claimed = true;
      return { data: claimedJob(), error: null };
    }
    if (name === "complete_runner_pool_job") return { data: claimedJob(), error: null };
    return { data: null, error: null };
  };
  client.from = () => {
    renewalCalls += 1;
    return queryReturning(renewalCalls === 1 ? null : { id: "job-1" });
  };
  let observedAborted = false;
  try {
    await worker.drainAndRun({
      workerId: "worker-1",
      leaseMs: 100,
      renewEveryMs: 5,
      handler: async (_job, execution) => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        observedAborted = execution.signal.aborted;
      },
    });
    assert.equal(observedAborted, true);
  } finally {
    client.rpc = originalRpc;
    client.from = originalFrom;
  }
});

test("handler checkpoint observes the aborted signal before an irreversible action", async () => {
  const { worker, client } = await loadWorker();
  const originalRpc = client.rpc;
  const originalFrom = client.from;
  let claimed = false;
  client.rpc = async (name) => {
    if (name === "claim_runner_pool_job") {
      if (claimed) return { data: null, error: null };
      claimed = true;
      return { data: claimedJob(), error: null };
    }
    if (name === "complete_runner_pool_job") return { data: claimedJob(), error: null };
    return { data: null, error: null };
  };
  client.from = () => queryReturning(null);
  let irreversibleActionReached = false;
  let missingExecutionContext = false;
  try {
    await worker.drainAndRun({
      workerId: "worker-1",
      leaseMs: 100,
      renewEveryMs: 5,
      handler: async (_job, execution) => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        if (!execution) {
          missingExecutionContext = true;
          return;
        }
        execution.assertOwned();
        irreversibleActionReached = true;
      },
    });
    assert.equal(missingExecutionContext, false);
    assert.equal(irreversibleActionReached, false);
  } finally {
    client.rpc = originalRpc;
    client.from = originalFrom;
  }
});

test("settlement waits for in-flight renewal", async () => {
  const { worker, client } = await loadWorker();
  const originalRpc = client.rpc;
  const originalFrom = client.from;
  let claimed = false;
  const events: string[] = [];
  client.rpc = async (name) => {
    if (name === "claim_runner_pool_job") {
      if (claimed) return { data: null, error: null };
      claimed = true;
      return { data: claimedJob(), error: null };
    }
    if (name === "complete_runner_pool_job") {
      events.push("complete");
      return { data: claimedJob(), error: null };
    }
    if (name === "renew_runner_pool_job") {
      events.push("renew-start");
      await new Promise((resolve) => setTimeout(resolve, 25));
      events.push("renew-end");
    }
    return { data: { leased_until: "2099-01-01T00:00:00.000Z" }, error: null };
  };
  client.from = () => {
    const query = queryReturning({ id: "job-1" });
    return {
      ...query,
      maybeSingle: async () => {
        events.push("renew-start");
        await new Promise((resolve) => setTimeout(resolve, 25));
        events.push("renew-end");
        return { data: { id: "job-1" }, error: null };
      },
    };
  };
  try {
    await worker.drainAndRun({
      workerId: "worker-1",
      leaseMs: 100,
      renewEveryMs: 1,
      handler: async () => new Promise((resolve) => setTimeout(resolve, 5)),
    });
    assert.deepEqual(events.slice(-2), ["renew-end", "complete"]);
  } finally {
    client.rpc = originalRpc;
    client.from = originalFrom;
  }
});

test("settlement stops renewal scheduling before completion starts", async () => {
  const { worker, client } = await loadWorker();
  const originalRpc = client.rpc;
  const events: string[] = [];
  let claimed = false;
  client.rpc = async (name) => {
    if (name === "claim_runner_pool_job") {
      if (claimed) return { data: null, error: null };
      claimed = true;
      return { data: claimedJob(), error: null };
    }
    if (name === "renew_runner_pool_job") {
      events.push("renew");
      return { data: { leased_until: "2099-01-01T00:00:00.000Z" }, error: null };
    }
    if (name === "complete_runner_pool_job") {
      events.push("complete-start");
      await new Promise((resolve) => setTimeout(resolve, 20));
      events.push("complete-end");
      return {
        data: { application_id: "app-1", country: "singapore", started_at: null },
        error: null,
      };
    }
    return { data: { leased_until: "2099-01-01T00:00:00.000Z" }, error: null };
  };
  try {
    await worker.drainAndRun({
      workerId: "worker-1",
      leaseMs: 100,
      renewEveryMs: 1,
      handler: async () => undefined,
    });
    const completeStart = events.indexOf("complete-start");
    const completeEnd = events.indexOf("complete-end");
    assert.ok(completeStart >= 0);
    assert.ok(completeEnd > completeStart);
    assert.equal(events.slice(completeStart + 1, completeEnd).includes("renew"), false);
  } finally {
    client.rpc = originalRpc;
  }
});

test("successful renewals re-arm the local expiry before a long handler finishes", async () => {
  const { worker, client } = await loadWorker();
  const originalRpc = client.rpc;
  let claimed = false;
  let renewals = 0;
  let completed = false;
  client.rpc = async (name) => {
    if (name === "claim_runner_pool_job") {
      if (claimed) return { data: null, error: null };
      claimed = true;
      return { data: claimedJob(), error: null };
    }
    if (name === "renew_runner_pool_job") {
      renewals += 1;
      return { data: { leased_until: "2099-01-01T00:00:00.000Z" }, error: null };
    }
    if (name === "complete_runner_pool_job") {
      completed = true;
      return { data: claimedJob(), error: null };
    }
    return { data: claimedJob(), error: null };
  };
  try {
    await worker.drainAndRun({
      workerId: "worker-1",
      leaseMs: 80,
      renewEveryMs: 15,
      handler: async () => new Promise((resolve) => setTimeout(resolve, 160)),
    });
    assert.ok(renewals >= 3);
    assert.equal(completed, true);
  } finally {
    client.rpc = originalRpc;
  }
});

test("an already-expired conservative lease aborts synchronously before handler microtasks", async () => {
  const { worker } = await loadWorker();
  const originalDateNow = Date.now;
  const originalSetTimeout = globalThis.setTimeout;
  let fakeNow = 1_000;
  let claimed = false;
  let expiryTimerScheduled = false;
  let signalAbortedAtHandlerStart = false;
  let checkpointRejected = false;

  Date.now = () => fakeNow;
  globalThis.setTimeout = ((...args: Parameters<typeof setTimeout>) => {
    expiryTimerScheduled = true;
    return originalSetTimeout(...args);
  }) as typeof setTimeout;

  const client: RunnerPoolClient = {
    rpc: async (name) => {
      if (name === "claim_runner_pool_job") {
        if (claimed) return { data: null, error: null };
        claimed = true;
        // Make the observed claim round trip longer than the lease. The
        // worker must fence ownership in scheduleExpiry itself, before the
        // handler gets a chance to yield to a microtask.
        fakeNow = 2_000;
        return { data: claimedJob(), error: null };
      }
      throw new Error(`unexpected settlement RPC: ${name}`);
    },
  };

  try {
    await worker.drainAndRun({
      workerId: "worker-1",
      leaseMs: 100,
      renewEveryMs: 100_000,
      dependencies: { client },
      handler: async (_job, execution) => {
        signalAbortedAtHandlerStart = execution.signal.aborted;
        try {
          execution.assertOwned();
        } catch {
          checkpointRejected = true;
        }
        await Promise.resolve();
        assert.equal(execution.signal.aborted, true);
      },
    });
    assert.equal(signalAbortedAtHandlerStart, true);
    assert.equal(checkpointRejected, true);
    assert.equal(expiryTimerScheduled, false);
  } finally {
    Date.now = originalDateNow;
    globalThis.setTimeout = originalSetTimeout;
  }
});

test("queued expiry and renewal callbacks cannot start after settlement fencing begins", async () => {
  const { worker, client } = await loadWorker();
  const originalRpc = client.rpc;
  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const events: string[] = [];
  let claimed = false;
  let intervalCallback: (() => void) | null = null;
  let queuedTickAfterStop = false;
  let renewalStarts = 0;
  let expiryCallback: (() => void) | null = null;
  let resolveRenewal: (() => void) | null = null;
  const intervalToken = {} as ReturnType<typeof setInterval>;
  const timeoutToken = {} as ReturnType<typeof setTimeout>;

  globalThis.setInterval = ((callback: Parameters<typeof setInterval>[0]) => {
    intervalCallback = callback as () => void;
    return intervalToken;
  }) as typeof setInterval;
  globalThis.clearInterval = (() => {
    events.push("clear-interval");
    // Simulate an expiry timer callback already queued by the event loop.
    queueMicrotask(() => expiryCallback?.());
  }) as typeof clearInterval;
  globalThis.setTimeout = ((callback: Parameters<typeof setTimeout>[0]) => {
    expiryCallback = callback as () => void;
    return timeoutToken;
  }) as typeof setTimeout;
  globalThis.clearTimeout = (() => {
    events.push("clear-timeout");
  }) as typeof clearTimeout;

  client.rpc = async (name) => {
    if (name === "claim_runner_pool_job") {
      if (claimed) return { data: null, error: null };
      claimed = true;
      return { data: claimedJob(), error: null };
    }
    if (name === "renew_runner_pool_job") {
      events.push("renew-start");
      renewalStarts += 1;
      await new Promise<void>((resolve) => {
        resolveRenewal = resolve;
      });
      events.push("renew-end");
      return { data: { leased_until: "2099-01-01T00:00:00.000Z" }, error: null };
    }
    if (name === "complete_runner_pool_job") {
      events.push("complete-start");
      // The interval callback is queued while settlement is in flight. The
      // worker must have already fenced renewal scheduling, so this callback
      // may be attempted but must not start a second RPC.
      queueMicrotask(() => {
        queuedTickAfterStop = true;
        intervalCallback?.();
      });
      await Promise.resolve();
      events.push("complete");
      return { data: claimedJob(), error: null };
    }
    return { data: claimedJob(), error: null };
  };

  try {
    const drain = worker.drainAndRun({
      workerId: "worker-1",
      leaseMs: 100,
      renewEveryMs: 10,
      handler: async () => {
        intervalCallback?.();
        setImmediate(() => resolveRenewal?.());
      },
    });
    await drain;
    assert.equal(events.includes("clear-interval"), true);
    assert.equal(events.includes("clear-timeout"), true);
    assert.equal(events.includes("renew-start"), true);
    assert.equal(queuedTickAfterStop, true);
    assert.equal(renewalStarts, 1);
    assert.equal(events.includes("complete"), true);
  } finally {
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
    client.rpc = originalRpc;
  }
});

test("ownership loss prevents both success and fallback failure settlement", async () => {
  const { worker, client } = await loadWorker();
  const originalRpc = client.rpc;
  const originalFrom = client.from;
  let claimed = false;
  const settlements: string[] = [];
  client.rpc = async (name) => {
    if (name === "claim_runner_pool_job") {
      if (claimed) return { data: null, error: null };
      claimed = true;
      return { data: claimedJob(), error: null };
    }
    settlements.push(name);
    return { data: claimedJob(), error: null };
  };
  client.from = () => queryReturning(null);
  try {
    await worker.drainAndRun({
      workerId: "worker-1",
      leaseMs: 100,
      renewEveryMs: 5,
      handler: async () => new Promise((resolve) => setTimeout(resolve, 20)),
    });
    assert.equal(settlements.includes("complete_runner_pool_job"), false);
    assert.equal(settlements.includes("fail_runner_pool_job"), false);
  } finally {
    client.rpc = originalRpc;
    client.from = originalFrom;
  }
});
