import assert from "node:assert/strict";
import test from "node:test";
import { RunnerJobOwnershipLostError } from "../execution-context.js";

process.env.SUPABASE_URL ??= "https://worker-runtime-test.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "worker-runtime-test-key";

test("runnerJobHandler emits ownership_lost instead of ordinary failed on cancellation", async () => {
  const { runnerJobHandler } = await import("../handler.js");
  const controller = new AbortController();
  const ownershipLost = new RunnerJobOwnershipLostError("lease lost during dispatch");
  controller.abort(ownershipLost);
  const events: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    const line = args.map((arg) => String(arg)).join(" ");
    if (line.includes('"metric":"runner_job_event"')) events.push(line);
  };
  try {
    await assert.rejects(
      () => runnerJobHandler(
        {
          id: "job-ownership",
          application_id: "app-ownership",
          country: "vietnam",
          flow_key: "vn_evisa",
          attempts: 0,
          max_attempts: 3,
          correlation_id: null,
          metadata: null,
        },
        {
          jobId: "job-handler-test",
          workerId: "worker-handler-test",
          signal: controller.signal,
          assertOwned: () => {
            throw ownershipLost;
          },
          checkpoint: () => {
            throw ownershipLost;
          },
        },
      ),
      (error: unknown) => error === ownershipLost,
    );
  } finally {
    console.log = originalLog;
  }

  const eventNames = events.map((line) => {
    const parsed = JSON.parse(line) as { event?: unknown };
    return parsed.event;
  });
  assert.equal(eventNames.includes("ownership_lost"), true);
  assert.equal(eventNames.includes("failed"), false);
});
