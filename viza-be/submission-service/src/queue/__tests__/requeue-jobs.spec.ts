import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const SCRIPT = resolve(process.cwd(), "scripts/queue/requeue-jobs.ts");

test("requeue tool only selects failed/dead-letter non-running rows", async () => {
  const source = await readFile(SCRIPT, "utf8");
  assert.match(source, /last_error/);
  assert.match(source, /\.in\("status",\s*\["failed",\s*"dead_letter"\]\)/);
  assert.doesNotMatch(source, /r\.status\s*===\s*"running"/);
  assert.match(source, /requeueRunnerJob\(supabase,\s*r\.id\)/);
  assert.doesNotMatch(source, /\.from\("runner_job"\)\s*\.update\(/);
});

test("requeue tool preserves the exact invalid-flow quarantine reason", async () => {
  const source = await readFile(SCRIPT, "utf8");
  assert.match(
    source,
    /Runner flow is retired or invalid; quarantined by concurrency fence\./,
  );
  assert.match(source, /INVALID_FLOW_QUARANTINE_REASON/);
  assert.match(source, /last_error\s*!==\s*INVALID_FLOW_QUARANTINE_REASON/);
});

test("requeue tool uses returned rows for counting and reports concurrent skips", async () => {
  const source = await readFile(SCRIPT, "utf8");
  assert.match(source, /requeueRunnerJob\(supabase,\s*r\.id\)/);
  assert.match(source, /requeue-runner-job/);
  assert.doesNotMatch(source, /\.from\("runner_job"\)\s*\.update\(/);
  assert.match(source, /concurrent|no longer eligible/i);
  assert.match(source, /requeued\s*\+=\s*1/);
});

test("requeue runner helper treats only an explicit true RPC result as success", async () => {
  const { requeueRunnerJob } = await import("../requeue-runner-job");
  const rpc = async (_fn: string, _args: unknown) => ({ data: true, error: null });
  assert.equal(await requeueRunnerJob({ rpc }, "job-id"), true);

  const conflictRpc = async (_fn: string, _args: unknown) => ({ data: false, error: null });
  assert.equal(await requeueRunnerJob({ rpc: conflictRpc }, "job-id"), false);
});

test("requeue runner helper forwards the exact job id and fails on RPC errors", async () => {
  let call: { fn: string; args: unknown } | undefined;
  const rpc = async (fn: string, args: unknown) => {
    call = { fn, args };
    return { data: null, error: { message: "rpc unavailable" } };
  };
  await assert.rejects(
    () => import("../requeue-runner-job").then(({ requeueRunnerJob }) => requeueRunnerJob({ rpc }, "job-id")),
    /requeue_runner_job: rpc unavailable/,
  );
  assert.deepEqual(call, { fn: "requeue_runner_job", args: { p_job_id: "job-id" } });
});
