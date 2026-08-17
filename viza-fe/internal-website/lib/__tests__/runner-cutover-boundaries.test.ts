import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

function expectGuardBefore(
  relativePath: string,
  guard: string,
  sideEffect: string,
  startAt = "",
): void {
  const complete = source(relativePath);
  const start = startAt ? complete.indexOf(startAt) : 0;
  expect(start, `${relativePath} missing boundary start`).toBeGreaterThanOrEqual(0);
  const boundary = complete.slice(start);
  const guardIndex = boundary.indexOf(guard);
  const sideEffectIndex = boundary.indexOf(sideEffect);
  expect(guardIndex, `${relativePath} missing cutover guard`).toBeGreaterThanOrEqual(0);
  expect(sideEffectIndex, `${relativePath} missing expected side effect`).toBeGreaterThanOrEqual(0);
  expect(guardIndex, `${relativePath} guard must precede ${sideEffect}`).toBeLessThan(sideEffectIndex);
}

describe("runner cutover guarded boundary source contract", () => {
  it("keeps the flag server-only and documented as default-off", () => {
    const example = source(".env.example");
    expect(example).toContain("RUNNER_CUTOVER_PAUSED=false");
    expect(example).not.toContain("NEXT_PUBLIC_RUNNER_CUTOVER_PAUSED");

    const files = [
      "lib/runner-cutover-pause.server.ts",
      "lib/queue/enqueue.ts",
      "lib/fly-machine-wake.server.ts",
      "lib/submission-worker-wake.server.ts",
      "lib/resilience/runner-job-wakeup.ts",
      "app/api/resilience/replay/route.ts",
    ];
    for (const file of files) {
      expect(source(file)).not.toContain("NEXT_PUBLIC_RUNNER_CUTOVER_PAUSED");
    }
  });

  it("routes every browser submission enqueue through the guarded server boundary", () => {
    const longForm = source("app/client/application/long-form/page.tsx");
    expect(longForm).toContain("/retry-submission");
    expect(longForm).not.toContain('from("submission_queue")');
    expect(longForm).not.toContain("/api/submission-worker/wake");
  });

  it("guards direct Korea and local submission-service routes before worker side effects", () => {
    expectGuardBefore(
      "app/api/applications/[id]/korea-official-eform/route.ts",
      "isRunnerCutoverPaused()",
      "readAnswerMap(auth.admin",
      "export async function POST",
    );
    expectGuardBefore(
      "app/api/applications/[id]/korea-official-eform/route.ts",
      "assertRunnerCutoverActive();",
      "ensureFlyMachineStarted(\"south_korea\")",
      "async function postSubmissionService",
    );
    expect(source("app/api/applications/[id]/korea-official-eform/route.ts"))
      .toContain("if (!wakeResult.ok)");

    expectGuardBefore(
      "app/api/applications/[id]/korea-appointment/route.ts",
      "isRunnerCutoverPaused()",
      "req.json()",
      "export async function POST",
    );
    expectGuardBefore(
      "app/api/applications/[id]/korea-appointment/route.ts",
      "assertRunnerCutoverActive();",
      "submissionServiceBaseUrl()",
      "async function postSubmissionService",
    );
    expectGuardBefore(
      "app/api/applications/[id]/local-submission-worker/route.ts",
      "isRunnerCutoverPaused()",
      "request.json()",
      "export async function POST",
    );
  });

  it("guards the centralized Queue, Fly, authenticated wake, and replay sinks", () => {
    expectGuardBefore(
      "lib/resilience/runner-job-wakeup.ts",
      "assertRunnerCutoverActive();",
      "enqueueResilienceQueueEvent({",
      "export async function enqueueRunnerJobWake",
    );
    expectGuardBefore(
      "lib/fly-machine-wake.server.ts",
      "isRunnerCutoverPaused(env)",
      "reconcileCapacity(",
      "export async function ensureFlyMachineCapacity",
    );
    expectGuardBefore(
      "lib/submission-worker-wake.server.ts",
      "isRunnerCutoverPaused(env)",
      "ensureFlyMachineStarted(target",
      "export async function wakeCloudSubmissionWorker",
    );
    expectGuardBefore(
      "app/api/resilience/replay/route.ts",
      "isRunnerCutoverPaused()",
      "loadRunnerWakeRecord(event)",
      "async function replayRunnerJobWake",
    );
  });

  it.each([
    ["enqueueRunnerPoolJob", "admin.rpc(\"enqueue_runner_pool_job\""],
    ["enqueueSgacRunnerRetry", "admin.rpc(\"enqueue_sgac_country_runner_retry\""],
    ["enqueueRunnerJob", "withAdmin(\"system\", \"lib/queue:application-flow\""],
  ])("guards %s before its first database operation", (functionName, mutation) => {
    expectGuardBefore(
      "lib/queue/enqueue.ts",
      "assertRunnerCutoverActive();",
      mutation,
      `export async function ${functionName}`,
    );
  });

  it.each([
    [
      "app/api/applications/[id]/retry-submission/route.ts",
      "isRunnerCutoverPaused()",
      "rotateLegacyManagedInboxAlias(",
      "export async function POST",
    ],
    [
      "app/api/applications/[id]/ds160-proof/route.ts",
      "isRunnerCutoverPaused()",
      "enqueueProofJob(loaded.admin, applicationId)",
      "export async function POST",
    ],
    [
      "app/api/applications/[id]/official-fee/pay/route.ts",
      "isRunnerCutoverPaused()",
      "relayIndonesiaOfficialFeePayment({",
      "export async function POST",
    ],
    [
      "app/actions/submit-signature.ts",
      "isRunnerCutoverPaused()",
      ".upload(storagePath, buffer",
      "export async function submitSignature",
    ],
    [
      "app/api/applications/[id]/official-status/refresh/route.ts",
      "isRunnerCutoverPaused()",
      ".insert({",
      "export async function POST",
    ],
    [
      "app/api/submissions/[jobId]/manual-actions/[actionId]/complete/route.ts",
      "isRunnerCutoverPaused()",
      ".update({",
      "export async function POST",
    ],
    [
      "app/admin/(dashboard)/applications/actions.ts",
      "assertRunnerCutoverActive();",
      ".update({ status: \"completed\"",
      "export async function completeLiveManualAction",
    ],
  ])("places the direct mutation guard before partial side effects in %s", (
    relativePath,
    guard,
    mutation,
    startAt,
  ) => {
    expectGuardBefore(relativePath, guard, mutation, startAt);
  });
});
