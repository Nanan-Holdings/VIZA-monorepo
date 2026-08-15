import assert from "node:assert/strict";
import test from "node:test";
import type { Page } from "@playwright/test";
import { RunnerJobOwnershipLostError } from "../../queue/execution-context.js";
import {
  registerTwApplicantHandoff,
  waitForTwApplicantSubmission,
  TwApplicantHandoffExpiredError,
} from "../applicant-handoff.js";

process.env.SUPABASE_URL ??= "https://tw-handoff-test.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "tw-handoff-test-key";

interface RpcCall {
  name: string;
  args: Record<string, unknown>;
}

function execution(jobId = "job-1", workerId = "worker-1") {
  const controller = new AbortController();
  return {
    context: {
      jobId,
      workerId,
      signal: controller.signal,
      assertOwned: () => {
        if (controller.signal.aborted) throw new RunnerJobOwnershipLostError();
      },
      checkpoint: () => {
        if (controller.signal.aborted) throw new RunnerJobOwnershipLostError();
      },
    },
    controller,
  };
}

function fakePage(body: string, url = "https://official.example/success"): Page {
  return {
    locator: () => ({ innerText: async () => body }),
    url: () => url,
  } as unknown as Page;
}

test("Taiwan handoff open uses the exact RPC contract and never direct tables", async () => {
  const { supabase } = await import("../../supabase.js");
  const client = supabase as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => Promise<unknown>;
    from: (table: string) => unknown;
  };
  const originalRpc = client.rpc;
  const originalFrom = client.from;
  const calls: RpcCall[] = [];
  client.rpc = async (name, args) => {
    calls.push({ name, args });
    return {
      data: [{
        opened: true,
        takeover_id: "takeover-1",
        application_id: "app-1",
        expires_at: "2099-01-01T00:00:00.000Z",
      }],
      error: null,
    };
  };
  client.from = (table) => {
    throw new Error(`direct Taiwan handoff table access: ${table}`);
  };
  try {
    const { context } = execution();
    const result = await registerTwApplicantHandoff({
      jobId: "job-1",
      workerId: "worker-1",
      applicationId: "app-1",
      applicantId: "user-1",
      browserbaseSessionId: "browserbase-session",
      liveViewUrl: "https://live.example/session",
      expiresAt: "2099-01-01T00:00:00.000Z",
      stoppedResult: { country: "TW", status: "stopped_at_captcha" },
      execution: context,
    });
    assert.deepEqual(result, {
      takeoverId: "takeover-1",
      applicationId: "app-1",
      expiresAt: "2099-01-01T00:00:00.000Z",
    });
    assert.deepEqual(calls, [{
      name: "open_tw_applicant_handoff",
      args: {
        p_job_id: "job-1",
        p_worker_id: "worker-1",
        p_application_id: "app-1",
        p_applicant_id: "user-1",
        p_browserbase_session_id: "browserbase-session",
        p_vnc_url: "https://live.example/session",
        p_expires_at: "2099-01-01T00:00:00.000Z",
        p_stopped_result: { country: "TW", status: "stopped_at_captcha" },
      },
    }]);
  } finally {
    client.rpc = originalRpc;
    client.from = originalFrom;
  }
});

test("Taiwan handoff open fails closed on a zero-row response", async () => {
  const { supabase } = await import("../../supabase.js");
  const client = supabase as unknown as { rpc: (name: string, args: Record<string, unknown>) => Promise<unknown> };
  const originalRpc = client.rpc;
  client.rpc = async () => ({ data: [], error: null });
  try {
    const { context } = execution();
    await assert.rejects(
      () => registerTwApplicantHandoff({
        jobId: "job-1",
        workerId: "worker-1",
        applicationId: "app-1",
        applicantId: "user-1",
        browserbaseSessionId: "browserbase-session",
        liveViewUrl: "https://live.example/session",
        expiresAt: "2099-01-01T00:00:00.000Z",
        stoppedResult: {},
        execution: context,
      }),
      (error: unknown) => error instanceof RunnerJobOwnershipLostError,
    );
  } finally {
    client.rpc = originalRpc;
  }
});

test("Taiwan handoff open rejects a multi-row RPC response", async () => {
  const { supabase } = await import("../../supabase.js");
  const client = supabase as unknown as { rpc: (name: string, args: Record<string, unknown>) => Promise<unknown> };
  const originalRpc = client.rpc;
  client.rpc = async () => ({
    data: [
      { opened: true, takeover_id: "takeover-1", application_id: "app-1", expires_at: "2099-01-01T00:00:00.000Z" },
      { opened: true, takeover_id: "takeover-2", application_id: "app-1", expires_at: "2099-01-01T00:00:00.000Z" },
    ],
    error: null,
  });
  try {
    const { context } = execution();
    await assert.rejects(
      () => registerTwApplicantHandoff({
        jobId: "job-1",
        workerId: "worker-1",
        applicationId: "app-1",
        applicantId: "user-1",
        browserbaseSessionId: "browserbase-session",
        liveViewUrl: "https://live.example/session",
        expiresAt: "2099-01-01T00:00:00.000Z",
        stoppedResult: {},
        execution: context,
      }),
      (error: unknown) => error instanceof RunnerJobOwnershipLostError,
    );
  } finally {
    client.rpc = originalRpc;
  }
});

test("Taiwan handoff receipt settles through the exact completion RPC", async () => {
  const { supabase } = await import("../../supabase.js");
  const client = supabase as unknown as { rpc: (name: string, args: Record<string, unknown>) => Promise<unknown> };
  const originalRpc = client.rpc;
  const calls: RpcCall[] = [];
  client.rpc = async (name, args) => {
    calls.push({ name, args });
    return {
      data: [{ settled: true, job_id: "job-1", application_id: "app-1", handoff_status: "completed" }],
      error: null,
    };
  };
  try {
    const { context } = execution();
    const receipt = await waitForTwApplicantSubmission({
      page: fakePage("申請送出成功 申請案號: TW12345678"),
      takeoverId: "takeover-1",
      jobId: "job-1",
      workerId: "worker-1",
      applicationId: "app-1",
      expiresAt: "2099-01-01T00:00:00.000Z",
      execution: context,
      buildSubmissionResult: (captured) => ({ country: "TW", status: "submitted", officialReceipt: captured }),
      pollMs: 0,
    });
    assert.equal(receipt.caseNumber, "TW12345678");
    assert.equal(calls[0]?.name, "settle_tw_applicant_handoff");
    assert.deepEqual(calls[0]?.args, {
      p_takeover_id: "takeover-1",
      p_job_id: "job-1",
      p_worker_id: "worker-1",
      p_outcome: "completed",
      p_submission_result: { country: "TW", status: "submitted", officialReceipt: receipt },
    });
  } finally {
    client.rpc = originalRpc;
  }
});

test("Taiwan handoff expiry settles abandoned and ownership abort stops polling", async () => {
  const { supabase } = await import("../../supabase.js");
  const client = supabase as unknown as { rpc: (name: string, args: Record<string, unknown>) => Promise<unknown> };
  const originalRpc = client.rpc;
  const calls: RpcCall[] = [];
  client.rpc = async (name, args) => {
    calls.push({ name, args });
    return {
      data: [{ settled: true, job_id: "job-1", application_id: "app-1", handoff_status: "abandoned" }],
      error: null,
    };
  };
  try {
    const { context } = execution();
    await assert.rejects(
      () => waitForTwApplicantSubmission({
        page: fakePage("still waiting", "https://official.example/form"),
        takeoverId: "takeover-1",
        jobId: "job-1",
        workerId: "worker-1",
        applicationId: "app-1",
        expiresAt: "2000-01-01T00:00:00.000Z",
        execution: context,
        buildSubmissionResult: () => ({}),
      }),
      (error: unknown) => error instanceof TwApplicantHandoffExpiredError,
    );
    assert.deepEqual(calls[0]?.args, {
      p_takeover_id: "takeover-1",
      p_job_id: "job-1",
      p_worker_id: "worker-1",
      p_outcome: "abandoned",
      p_submission_result: null,
    });

    const aborted = execution();
    aborted.controller.abort();
    await assert.rejects(
      () => waitForTwApplicantSubmission({
        page: fakePage("still waiting"),
        takeoverId: "takeover-2",
        jobId: "job-1",
        workerId: "worker-1",
        applicationId: "app-1",
        expiresAt: "2099-01-01T00:00:00.000Z",
        execution: aborted.context,
        buildSubmissionResult: () => ({}),
        pollMs: 1_000,
      }),
      (error: unknown) => error instanceof RunnerJobOwnershipLostError,
    );
  } finally {
    client.rpc = originalRpc;
  }
});
