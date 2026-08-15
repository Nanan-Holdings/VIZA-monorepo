import assert from "node:assert/strict";
import test from "node:test";
import { RunnerJobOwnershipLostError } from "../execution-context.js";

process.env.SUPABASE_URL ??= "https://takeover-test.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "takeover-test-key";
delete process.env.SLACK_WEBHOOK_URL;
delete process.env.RESEND_OPS_ALERT_TO;
delete process.env.RESEND_API_KEY;

interface Call {
  table: string;
  method: string;
  args: unknown[];
}

interface MockSetup {
  calls: Call[];
  setRunnerJobResult(result: { data: { id: string } | null; error: { message: string } | null }): void;
  restore(): void;
}

async function loadTakeover(): Promise<{
  requestHumanTakeover: typeof import("../takeover.js").requestHumanTakeover;
  setup: (runnerJobResult: { data: { id: string } | null; error: { message: string } | null }) => Promise<MockSetup>;
}> {
  const [{ supabase }, { requestHumanTakeover }] = await Promise.all([
    import("../../supabase.js"),
    import("../takeover.js"),
  ]);
  const client = supabase as unknown as {
    from: (table: string) => Record<string, (...args: unknown[]) => unknown>;
  };
  const originalFrom = client.from;
  const setup = async (
    runnerJobResult: { data: { id: string } | null; error: { message: string } | null },
  ): Promise<MockSetup> => {
    const calls: Call[] = [];
    let currentRunnerJobResult = runnerJobResult;
    const setRunnerJobResult = (result: typeof runnerJobResult): void => {
      currentRunnerJobResult = result;
    };
    client.from = ((table: string) => {
      const builder: Record<string, (...args: unknown[]) => unknown> = {
        update: (...args) => {
          calls.push({ table, method: "update", args });
          return builder;
        },
        eq: (...args) => {
          calls.push({ table, method: "eq", args });
          return builder;
        },
        select: (...args) => {
          calls.push({ table, method: "select", args });
          return builder;
        },
        maybeSingle: async (...args) => {
          calls.push({ table, method: "maybeSingle", args });
          if (table === "runner_job") return currentRunnerJobResult;
          return { data: null, error: null };
        },
        insert: (...args) => {
          calls.push({ table, method: "insert", args });
          return builder;
        },
        single: async (...args) => {
          calls.push({ table, method: "single", args });
          return { data: { id: "takeover-1" }, error: null };
        },
      };
      return builder;
    }) as typeof client.from;
    return {
      calls,
      setRunnerJobResult,
      restore: () => {
        client.from = originalFrom;
      },
    };
  };
  return { requestHumanTakeover, setup };
}

function input(workerId: string): {
  jobId: string;
  workerId: string;
  applicationId: string;
  applicantId: string;
  reason: string;
  remoteDebugUrl: string;
} {
  return {
    jobId: "job-active",
    workerId,
    applicationId: "app-1",
    applicantId: "user-1",
    reason: "operator needed",
    remoteDebugUrl: "https://debug.invalid/session",
  };
}

function runnerJobCalls(calls: Call[]): Call[] {
  return calls.filter((call) => call.table === "runner_job");
}

test("human takeover filters the update by exact job, running status, and worker", async () => {
  const { requestHumanTakeover, setup } = await loadTakeover();
  const mock = await setup({ data: { id: "job-active" }, error: null });
  try {
    await requestHumanTakeover(input("worker-1"));
    assert.deepEqual(runnerJobCalls(mock.calls), [
      {
        table: "runner_job",
        method: "update",
        args: [{ status: "needs_human", last_error: "operator needed" }],
      },
      { table: "runner_job", method: "eq", args: ["id", "job-active"] },
      { table: "runner_job", method: "eq", args: ["status", "running"] },
      { table: "runner_job", method: "eq", args: ["leased_by", "worker-1"] },
      { table: "runner_job", method: "select", args: ["id"] },
      { table: "runner_job", method: "maybeSingle", args: [] },
    ]);
    assert.deepEqual([...new Set(mock.calls.map((call) => call.table))], [
      "runner_job",
      "takeover_session",
      "takeover_action_log",
      "alert_throttle",
    ]);
  } finally {
    mock.restore();
  }
});

test("human takeover fails closed for an expired or reclaimed worker with no side effects", async () => {
  const { requestHumanTakeover, setup } = await loadTakeover();
  const mock = await setup({ data: null, error: null });
  try {
    await assert.rejects(
      () => requestHumanTakeover(input("worker-reclaimed")),
      (error: unknown) => error instanceof RunnerJobOwnershipLostError,
    );
    assert.deepEqual(runnerJobCalls(mock.calls).slice(1), [
      { table: "runner_job", method: "eq", args: ["id", "job-active"] },
      { table: "runner_job", method: "eq", args: ["status", "running"] },
      { table: "runner_job", method: "eq", args: ["leased_by", "worker-reclaimed"] },
      { table: "runner_job", method: "select", args: ["id"] },
      { table: "runner_job", method: "maybeSingle", args: [] },
    ]);
    assert.equal(mock.calls.some((call) => call.table !== "runner_job"), false);
  } finally {
    mock.restore();
  }
});

test("human takeover opens the session only after the active worker update returns its id", async () => {
  const { requestHumanTakeover, setup } = await loadTakeover();
  const mock = await setup({ data: { id: "job-active" }, error: null });
  try {
    const result = await requestHumanTakeover(input("worker-active"));
    assert.deepEqual(result, { takeoverId: "takeover-1" });
    assert.equal(mock.calls.some((call) => call.table === "takeover_session"), true);
    assert.equal(mock.calls.some((call) => call.table === "takeover_action_log"), true);
  } finally {
    mock.restore();
  }
});
