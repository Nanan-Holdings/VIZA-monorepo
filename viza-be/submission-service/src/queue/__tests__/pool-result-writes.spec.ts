import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

function source(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), "src", relativePath), "utf8");
}

test("worker execution context carries the claimed job and worker identity", () => {
  const worker = source("queue/worker.ts");
  assert.match(worker, /jobId:\s*job\.id/);
  assert.match(worker, /workerId:\s*opts\.workerId/);
});

test("pool SG, arrival-card, and Korea e-Form paths use the fenced result writer", () => {
  const sg = source("sg/runner.ts");
  const arrivalCards = source("queue/arrival-card-runners.ts");
  const korea = source("queue/korea-eform-runner.ts");
  const vietnam = source("vietnam/runner.ts");

  assert.match(sg, /writeRunnerPoolSubmissionResult/);
  assert.match(sg, /requirePoolExecutionIdentity/);
  assert.match(sg, /writeRunnerPoolSubmissionResult\(poolExecutionContext/);
  assert.match(sg, /idempotencyKey:\s*`runner-job:\$\{identity\.jobId\}`/);
  assert.doesNotMatch(sg, /\.from\(["']applications["']\)/);

  assert.match(arrivalCards, /writeRunnerPoolSubmissionResult/);
  assert.match(arrivalCards, /requirePoolExecutionIdentity/);
  const arrivalWriterCalls = arrivalCards.match(/writeRunnerPoolSubmissionResult\(executionContext/g) ?? [];
  assert.ok(arrivalWriterCalls.length === 0);
  assert.match(arrivalCards, /writeRunnerPoolSubmissionResult\(poolExecutionContext/g);
  assert.doesNotMatch(arrivalCards, /\.from\(["']applications["']\)/);

  assert.match(korea, /writeRunnerPoolSubmissionResult/);
  assert.match(korea, /requirePoolExecutionIdentity/);
  assert.match(korea, /writeRunnerPoolSubmissionResult\((?:executionContext|poolExecutionContext)/);
  assert.doesNotMatch(korea, /\.from\(["']applications["']\)/);

  assert.match(vietnam, /requirePoolExecutionIdentity/);
  assert.match(vietnam, /runId:\s*jobId/);
  assert.match(vietnam, /export async function runLegacy/);
});

test("Korea pool dispatch forwards the claimed job identity", () => {
  const dispatch = source("queue/dispatch.ts");
  assert.match(
    dispatch,
    /kr_eform:\s*\(applicationId,\s*jobId,\s*execution\)[\s\S]{0,240}requirePoolExecutionIdentity\(execution,\s*jobId[\s\S]{0,200}runKoreaEformBackground\(/,
  );
  assert.doesNotMatch(dispatch, /jobId\s*\?\?\s*applicationId/);
});
