import assert from "node:assert/strict";
import test from "node:test";
import {
  RunnerJobOwnershipLostError,
  type RunnerExecutionContext,
} from "../execution-context.js";

process.env.SUPABASE_URL ??= "https://pool-identity-test.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "pool-identity-test-key";

function execution(jobId: string): RunnerExecutionContext {
  return {
    jobId,
    workerId: "worker-pool-identity-test",
    signal: new AbortController().signal,
    assertOwned: () => undefined,
    checkpoint: () => undefined,
  };
}

async function assertOwnershipRejected(
  invoke: () => Promise<unknown>,
  label: string,
): Promise<void> {
  await assert.rejects(
    invoke,
    (error: unknown) => error instanceof RunnerJobOwnershipLostError,
    label,
  );
}

test("every direct pool runner rejects missing and mismatched identity before portal work", async () => {
  const [{ runOne: runVietnam }, { runOne: runSingapore }, { runArrivalCardPoolFlow }, { runKoreaEformBackground }] = await Promise.all([
    import("../../vietnam/runner.js"),
    import("../../sg/runner.js"),
    import("../arrival-card-runners.js"),
    import("../korea-eform-runner.js"),
  ]);

  const missing: Array<[string, () => Promise<unknown>]> = [
    ["vn_evisa", () => runVietnam("app", "job", undefined)],
    ["vn_prearrival", () => runArrivalCardPoolFlow("app", "job", "vn_prearrival", undefined)],
    ["sgac", () => runSingapore("app", "job", undefined)],
    ["mdac", () => runArrivalCardPoolFlow("app", "job", "mdac", undefined)],
    ["tdac", () => runArrivalCardPoolFlow("app", "job", "tdac", undefined)],
    ["kr_arrival_card", () => runArrivalCardPoolFlow("app", "job", "kr_arrival_card", undefined)],
    ["kr_eform", () => runKoreaEformBackground("app", "job", undefined)],
  ];
  for (const [flow, invoke] of missing) {
    await assertOwnershipRejected(invoke, `${flow} missing identity`);
  }

  const mismatched = execution("job-other");
  const mismatch: Array<[string, () => Promise<unknown>]> = [
    ["vn_evisa", () => runVietnam("app", "job", mismatched)],
    ["vn_prearrival", () => runArrivalCardPoolFlow("app", "job", "vn_prearrival", mismatched)],
    ["sgac", () => runSingapore("app", "job", mismatched)],
    ["mdac", () => runArrivalCardPoolFlow("app", "job", "mdac", mismatched)],
    ["tdac", () => runArrivalCardPoolFlow("app", "job", "tdac", mismatched)],
    ["kr_arrival_card", () => runArrivalCardPoolFlow("app", "job", "kr_arrival_card", mismatched)],
    ["kr_eform", () => runKoreaEformBackground("app", "job", mismatched)],
  ];
  for (const [flow, invoke] of mismatch) {
    await assertOwnershipRejected(invoke, `${flow} mismatched identity`);
  }
});
