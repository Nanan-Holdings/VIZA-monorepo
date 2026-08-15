import assert from "node:assert/strict";
import test from "node:test";
import { RunnerJobOwnershipLostError, type RunnerExecutionContext } from "../queue/execution-context.js";
import type { SubmissionResult } from "../submission-result.js";

process.env.SUPABASE_URL ??= "https://result-writer-test.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "result-writer-test-key";

type RpcResult = { data: unknown; error: { message: string } | null };

function execution(overrides: Partial<RunnerExecutionContext> = {}): RunnerExecutionContext {
  return {
    jobId: "job-42",
    workerId: "worker-7",
    signal: new AbortController().signal,
    assertOwned: () => undefined,
    checkpoint: () => undefined,
    ...overrides,
  };
}

function result(): SubmissionResult {
  return {
    country: "SG",
    visaType: "SG_ARRIVAL_CARD",
    status: "submitted",
    mode: "live_assisted",
    provider: "sg_arrival_card_live",
    applicationId: "app-42",
    submitted: true,
    portalUrl: "https://example.invalid/confirmation",
    portalResponseSummary: "confirmed",
  };
}

async function loadWriter(): Promise<{
  writer: typeof import("../result-writer.js");
  client: { rpc: (name: string, args: Record<string, unknown>) => Promise<RpcResult> };
}> {
  const [{ supabase }, writer] = await Promise.all([
    import("../supabase.js"),
    import("../result-writer.js"),
  ]);
  return {
    writer,
    client: supabase as unknown as { rpc: (name: string, args: Record<string, unknown>) => Promise<RpcResult> },
  };
}

test("pool result writer calls the ownership RPC with exact identity and payload args", async () => {
  const { writer, client } = await loadWriter();
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const originalRpc = client.rpc;
  client.rpc = async (name, args) => {
    calls.push({ name, args });
    return {
      data: {
        runner_job_id: "job-42",
        application_id: "app-42",
        submission_result_updated_at: "2026-08-15T00:00:00.000Z",
      },
      error: null,
    };
  };
  try {
    const payload = result();
    await writer.writeRunnerPoolSubmissionResult(execution(), payload, "submitted");
    assert.deepEqual(calls, [{
      name: "write_runner_pool_submission_result",
      args: {
        p_job_id: "job-42",
        p_worker_id: "worker-7",
        p_submission_result: payload,
        p_submission_result_status: "submitted",
      },
    }]);
  } finally {
    client.rpc = originalRpc;
  }
});

test("pool result writer maps an empty RPC result to ownership loss", async () => {
  const { writer, client } = await loadWriter();
  const originalRpc = client.rpc;
  client.rpc = async () => ({ data: [], error: null });
  try {
    await assert.rejects(
      () => writer.writeRunnerPoolSubmissionResult(execution(), result(), "submitted"),
      (error: unknown) => error instanceof RunnerJobOwnershipLostError,
    );
  } finally {
    client.rpc = originalRpc;
  }
});

test("pool result writer preserves ordinary bounded RPC failures", async () => {
  const { writer, client } = await loadWriter();
  const originalRpc = client.rpc;
  client.rpc = async () => ({ data: null, error: { message: "database unavailable" } });
  try {
    await assert.rejects(
      () => writer.writeRunnerPoolSubmissionResult(execution(), result(), "submitted"),
      (error: unknown) => error instanceof Error
        && !(error instanceof RunnerJobOwnershipLostError)
        && error.message.includes("database unavailable"),
    );
  } finally {
    client.rpc = originalRpc;
  }
});

test("pool result writer bounds rejected network failures without converting them to ownership loss", async () => {
  const { writer, client } = await loadWriter();
  const originalRpc = client.rpc;
  client.rpc = async () => {
    throw new Error(`${"x".repeat(900)} network unavailable`);
  };
  try {
    await assert.rejects(
      () => writer.writeRunnerPoolSubmissionResult(execution(), result(), "submitted"),
      (error: unknown) => error instanceof Error
        && !(error instanceof RunnerJobOwnershipLostError)
        && error.message.startsWith("write_runner_pool_submission_result failed: ")
        && error.message.length <= "write_runner_pool_submission_result failed: ".length + 500,
    );
  } finally {
    client.rpc = originalRpc;
  }
});

test("pool result writer fails closed before RPC when identity is missing", async () => {
  const { writer, client } = await loadWriter();
  const originalRpc = client.rpc;
  let rpcCalls = 0;
  client.rpc = async () => {
    rpcCalls += 1;
    return { data: { runner_job_id: "unexpected" }, error: null };
  };
  try {
    const missingIdentity = execution({ jobId: "" });
    await assert.rejects(
      () => writer.writeRunnerPoolSubmissionResult(missingIdentity, result(), "submitted"),
      (error: unknown) => error instanceof Error
        && !(error instanceof RunnerJobOwnershipLostError)
        && error.message.includes("job and worker identity"),
    );
    assert.equal(rpcCalls, 0);
  } finally {
    client.rpc = originalRpc;
  }
});
