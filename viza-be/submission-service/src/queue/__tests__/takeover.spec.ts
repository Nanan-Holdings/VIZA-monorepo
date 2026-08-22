import assert from "node:assert/strict";
import test from "node:test";
import { RunnerJobOwnershipLostError } from "../execution-context.js";

process.env.SUPABASE_URL ??= "https://takeover-test.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "takeover-test-key";
delete process.env.SLACK_WEBHOOK_URL;
delete process.env.RESEND_OPS_ALERT_TO;
delete process.env.RESEND_API_KEY;

interface RpcCall {
  functionName: string;
  args: unknown;
}

interface MockSetup {
  rpcCalls: RpcCall[];
  fromCalls: string[];
  setResult(result: { data: unknown; error: { message: string } | null }): void;
  restore(): void;
}

type SupabaseLike = {
  rpc: (functionName: string, args: unknown) => Promise<unknown>;
  from: (table: string) => unknown;
};

async function loadTakeover(): Promise<{
  requestHumanTakeover: typeof import("../takeover.js").requestHumanTakeover;
  setup: (result: { data: unknown; error: { message: string } | null }) => MockSetup;
}> {
  const [{ supabase }, { requestHumanTakeover }] = await Promise.all([
    import("../../supabase.js"),
    import("../takeover.js"),
  ]);
  const client = supabase as unknown as SupabaseLike;
  const originalRpc = client.rpc;
  const originalFrom = client.from;
  const setup = (initialResult: { data: unknown; error: { message: string } | null }): MockSetup => {
    const rpcCalls: RpcCall[] = [];
    const fromCalls: string[] = [];
    let currentResult = initialResult;
    client.rpc = (functionName, args) => {
      rpcCalls.push({ functionName, args });
      return Promise.resolve(currentResult);
    };
    client.from = (table) => {
      fromCalls.push(table);
      if (table === "alert_throttle") {
        const builder: Record<string, (...args: unknown[]) => unknown> = {};
        builder.select = () => builder;
        builder.eq = () => builder;
        builder.maybeSingle = async () => ({ data: null, error: null });
        builder.insert = () => builder;
        builder.update = () => builder;
        return builder;
      }
      throw new Error(`direct table access is forbidden: ${table}`);
    };
    return {
      rpcCalls,
      fromCalls,
      setResult: (result) => {
        currentResult = result;
      },
      restore: () => {
        client.rpc = originalRpc;
        client.from = originalFrom;
      },
    };
  };
  return { requestHumanTakeover, setup };
}

function input(workerId = "worker-1"): {
  jobId: string;
  workerId: string;
  applicationId: string;
  applicantId: string;
  reason: string;
  remoteDebugUrl: string;
  vncUrl?: string;
} {
  return {
    jobId: "job-active",
    workerId,
    applicationId: "app-1",
    applicantId: "user-1",
    reason: "operator needed",
    remoteDebugUrl: "wss://debug.invalid/session",
    vncUrl: "https://vnc.invalid/session",
  };
}

test("human takeover calls the ownership RPC with the exact argument names", async () => {
  const { requestHumanTakeover, setup } = await loadTakeover();
  const mock = setup({ data: { takeover_id: "takeover-1" }, error: null });
  try {
    const result = await requestHumanTakeover(input());
    assert.deepEqual(result, { takeoverId: "takeover-1" });
    assert.deepEqual(mock.rpcCalls, [
      {
        functionName: "open_runner_job_takeover",
        args: {
          p_job_id: "job-active",
          p_worker_id: "worker-1",
          p_application_id: "app-1",
          p_applicant_id: "user-1",
          p_reason: "operator needed",
          p_remote_debug_url: "wss://debug.invalid/session",
          p_vnc_url: "https://vnc.invalid/session",
        },
      },
    ]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.deepEqual(mock.fromCalls.filter((table) => table !== "alert_throttle"), []);
  } finally {
    mock.restore();
  }
});

test("human takeover normalizes a one-row RPC array", async () => {
  const { requestHumanTakeover, setup } = await loadTakeover();
  const mock = setup({ data: [{ takeover_id: "takeover-array" }], error: null });
  try {
    await assert.doesNotReject(async () => {
      assert.deepEqual(await requestHumanTakeover(input()), { takeoverId: "takeover-array" });
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
  } finally {
    mock.restore();
  }
});

test("human takeover fails closed when the RPC returns zero rows without side effects", async () => {
  const { requestHumanTakeover, setup } = await loadTakeover();
  const mock = setup({ data: [], error: null });
  try {
    await assert.rejects(
      () => requestHumanTakeover(input("worker-reclaimed")),
      (error: unknown) => error instanceof RunnerJobOwnershipLostError,
    );
    assert.equal(mock.rpcCalls.length, 1);
    assert.deepEqual(mock.fromCalls, []);
  } finally {
    mock.restore();
  }
});

test("human takeover surfaces an ordinary bounded RPC error", async () => {
  const { requestHumanTakeover, setup } = await loadTakeover();
  const mock = setup({ data: null, error: { message: "database unavailable" } });
  try {
    await assert.rejects(
      () => requestHumanTakeover(input()),
      (error: unknown) => error instanceof Error && !(error instanceof RunnerJobOwnershipLostError)
        && error.message === "open_runner_job_takeover: database unavailable",
    );
    assert.deepEqual(mock.fromCalls, []);
  } finally {
    mock.restore();
  }
});
