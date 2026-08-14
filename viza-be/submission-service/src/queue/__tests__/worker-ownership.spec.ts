import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const workerSource = readFileSync(path.join(process.cwd(), "src", "queue", "worker.ts"), "utf8");

test("runner success settlement uses the fenced completion RPC and emits metrics from its row", () => {
  assert.match(workerSource, /complete_runner_pool_job/);
  assert.match(workerSource, /p_job_id:\s*jobId/);
  assert.match(workerSource, /p_worker_id:\s*workerId/);
  assert.match(workerSource, /runner_job_ownership_lost/);
  assert.match(workerSource, /application_id[\s\S]*country[\s\S]*started_at/);
  assert.doesNotMatch(workerSource, /markSucceeded\(jobId: string\)[\s\S]*?\.from\("runner_job"\)/);
});

test("failure settlement and lease renewal require live ownership", () => {
  assert.match(workerSource, /\.eq\("status",\s*"running"\)/);
  assert.match(workerSource, /\.eq\("leased_by",\s*workerId\)/);
  assert.match(workerSource, /\.gt\("leased_until",/);
  assert.match(workerSource, /markFailedWithRetry\([\s\S]*?workerId/);
});

test("drain passes worker ownership and does not retry a lost success lease", () => {
  assert.match(workerSource, /markSucceeded\(job\.id,\s*opts\.workerId\)/);
  assert.match(workerSource, /markFailedWithRetry\(job,\s*error,\s*opts\.workerId\)/);
  assert.match(workerSource, /isRunnerJobOwnershipLost\(error\)/);
});
