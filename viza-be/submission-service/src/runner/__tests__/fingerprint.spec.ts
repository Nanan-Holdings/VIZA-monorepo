import assert from "node:assert/strict";
import test from "node:test";
import { RunnerJobOwnershipLostError } from "../../queue/execution-context.js";

process.env.SUPABASE_URL ??= "https://fingerprint-test.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "fingerprint-test-key";

interface FetchCall {
  url: string;
  method: string;
  body: string;
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("recordFingerprintUsage appends through the exact owner RPC", async () => {
  const { recordFingerprintUsage } = await import("../fingerprint.js");
  const originalFetch = globalThis.fetch;
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (input, init) => {
    calls.push({
      url: String(input),
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? init.body : "",
    });
    return jsonResponse([{ job_id: "job-1", fingerprint_history: [] }]);
  }) as typeof fetch;
  try {
    await recordFingerprintUsage("job-1", "worker-1", "app-1", 2, "rotation-2");
    assert.equal(calls.length, 1);
    assert.match(calls[0]?.url ?? "", /\/rest\/v1\/rpc\/append_runner_job_fingerprint$/);
    assert.equal(calls[0]?.method, "POST");
    const body = JSON.parse(calls[0]?.body ?? "{}") as {
      p_job_id?: string;
      p_worker_id?: string;
      p_entry?: { rotation_key?: string; attempt?: number; ts?: string };
    };
    assert.deepEqual(body, {
      p_job_id: "job-1",
      p_worker_id: "worker-1",
      p_entry: {
        rotation_key: "rotation-2",
        attempt: 2,
        ts: body.p_entry?.ts,
      },
    });
    assert.match(body.p_entry?.ts ?? "", /T/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("recordFingerprintUsage maps an ownership miss to RunnerJobOwnershipLostError", async () => {
  const { recordFingerprintUsage } = await import("../fingerprint.js");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => jsonResponse([], 200)) as typeof fetch;
  try {
    await assert.rejects(
      () => recordFingerprintUsage("job-expired", "worker-stale", "app-1", 3, "rotation-3"),
      (error: unknown) => error instanceof RunnerJobOwnershipLostError,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("recordFingerprintUsage surfaces RPC errors as ordinary errors", async () => {
  const { recordFingerprintUsage } = await import("../fingerprint.js");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => jsonResponse({ message: "database unavailable" }, 503)) as typeof fetch;
  try {
    await assert.rejects(
      () => recordFingerprintUsage("job-1", "worker-1", "app-1", 1, "rotation-1"),
      (error: unknown) => error instanceof Error
        && !(error instanceof RunnerJobOwnershipLostError)
        && error.message.includes("append_runner_job_fingerprint"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
