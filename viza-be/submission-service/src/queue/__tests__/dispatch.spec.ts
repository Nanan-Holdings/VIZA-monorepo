import { test } from "node:test";
import assert from "node:assert/strict";
import { RunnerJobOwnershipLostError, type RunnerExecutionContext } from "../execution-context.js";

process.env.SUPABASE_URL ??= "http://localhost";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-key";

let getRunOne: typeof import("../dispatch.js").getRunOne;
let normalizeCountry: typeof import("../dispatch.js").normalizeCountry;
let DISPATCH_META: typeof import("../dispatch.js").DISPATCH_META;
let UnsupportedCountryError: typeof import("../dispatch.js").UnsupportedCountryError;
let createPoolFlowDispatch: typeof import("../dispatch.js").createPoolFlowDispatch;

test.before(async () => {
  const dispatch = await import("../dispatch.js");
  getRunOne = dispatch.getRunOne;
  normalizeCountry = dispatch.normalizeCountry;
  DISPATCH_META = dispatch.DISPATCH_META;
  UnsupportedCountryError = dispatch.UnsupportedCountryError;
  createPoolFlowDispatch = dispatch.createPoolFlowDispatch;
});

test("dispatch: India job routes to runInPrefill", () => {
  // Routing metadata asserts the binding without executing the runner
  // (which would hit the DB + launch a browser).
  assert.equal(DISPATCH_META.india.runner, "runInPrefill");
  assert.equal(DISPATCH_META.india.implemented, true);
  const runOne = getRunOne("india");
  assert.equal(typeof runOne, "function");
});

test("dispatch: ISO alias 'in' normalizes to india and resolves", () => {
  assert.equal(normalizeCountry("in"), "india");
  assert.equal(getRunOne("in"), getRunOne("india"));
});

test("dispatch: country code normalization handles gb/uk/us", () => {
  assert.equal(normalizeCountry("gb"), "united_kingdom");
  assert.equal(normalizeCountry("UK"), "united_kingdom");
  assert.equal(normalizeCountry("United States"), "united_states");
});

test("dispatch: unwired country throws UnsupportedCountryError", () => {
  assert.throws(() => getRunOne("atlantis"), UnsupportedCountryError);
});

test("dispatch: all launch countries resolve to a runOne", () => {
  const launch = [
    "indonesia", "egypt", "australia", "saudi_arabia", "united_kingdom", "vietnam",
    "malaysia", "japan", "united_states", "canada", "turkey", "thailand",
    "singapore", "united_arab_emirates", "france", "italy", "india", "taiwan", "south_korea",
  ];
  for (const c of launch) {
    if (c === "indonesia") continue;
    assert.equal(typeof getRunOne(c), "function", `${c} resolves`);
  }
});

test("dispatch: Taiwan aliases route to canonical tw runner", () => {
  assert.equal(normalizeCountry("TW"), "taiwan");
  assert.equal(getRunOne("tw"), getRunOne("taiwan"));
  assert.equal(DISPATCH_META.taiwan.runner, "tw/runner.runOne");
  assert.equal(DISPATCH_META.taiwan.implemented, true);
});

test("dispatch: Philippines arrival aliases route to the canonical fail-closed runner_job handler", () => {
  assert.equal(normalizeCountry("PH"), "philippines");
  assert.equal(getRunOne("ph"), getRunOne("philippines"));
  assert.equal(DISPATCH_META.philippines.runner, "ph-etravel/runner-job.runOne (arrival review/recovery only)");
  assert.equal(DISPATCH_META.philippines.implemented, true);
});

test("dispatch: Singapore aliases normalize and resolve", () => {
  assert.equal(normalizeCountry("SG"), "singapore");
  assert.equal(getRunOne("sg"), getRunOne("singapore"));
});

test("dispatch: Korea aliases normalize and resolve", () => {
  assert.equal(normalizeCountry("KR"), "south_korea");
  assert.equal(normalizeCountry("Korea"), "south_korea");
  assert.equal(getRunOne("kr"), getRunOne("south_korea"));
});

test("dispatch: shared-pool flow keys resolve only for their country", () => {
  const flows = [
    ["vietnam", "vn_evisa"],
    ["vietnam", "vn_prearrival"],
    ["singapore", "sgac"],
    ["malaysia", "mdac"],
    ["thailand", "tdac"],
    ["south_korea", "kr_eform"],
    ["taiwan", "tw_entry_permit"],
  ] as const;
  for (const [country, flow] of flows) {
    assert.equal(typeof getRunOne(country, flow), "function", `${country}/${flow}`);
  }
  assert.throws(
    () => getRunOne("malaysia", "tdac"),
    UnsupportedCountryError,
  );
});

test("dispatch: every shared-pool flow forwards the ownership execution context", async () => {
  const calls: Array<{ kind: string; applicationId: string; jobId?: string; flow?: string; execution: unknown }> = [];
  const outcome = {
    outcome: "halted_before_pay" as const,
    reachedStep: "test",
    artefacts: [],
  };
  const runCountry = (kind: string) => async (
    applicationId: string,
    jobId?: string,
    execution?: unknown,
  ) => {
    calls.push({ kind, applicationId, jobId, execution });
    return outcome;
  };
  const runArrival = async (
    applicationId: string,
    jobId: string,
    flow: string,
    execution?: unknown,
  ) => {
    calls.push({ kind: "arrival", applicationId, jobId, flow, execution });
    return outcome;
  };
  const runTaiwan = runCountry("taiwan");
  const runKorea = async (
    applicationId: string,
    jobIdOrExecution?: string | RunnerExecutionContext,
    maybeExecution?: RunnerExecutionContext,
  ) => {
    const jobId = typeof jobIdOrExecution === "string" ? jobIdOrExecution : undefined;
    const execution = typeof jobIdOrExecution === "string" ? maybeExecution : jobIdOrExecution;
    calls.push({ kind: "korea", applicationId, jobId, execution });
    return outcome;
  };
  const dispatch = createPoolFlowDispatch({
    runVietnam: runCountry("vietnam"),
    runSingapore: runCountry("singapore"),
    runArrivalCardPoolFlow: runArrival,
    runKoreaEformBackground: runKorea,
    runTaiwan,
  });
  const executionFor = (jobId: string) => ({
    jobId,
    workerId: `worker-${jobId}`,
    signal: new AbortController().signal,
    assertOwned: () => undefined,
    checkpoint: () => undefined,
  });

  const executionVn = executionFor("job-vn");
  const executionVnPrearrival = executionFor("job-vn-pre");
  const executionSg = executionFor("job-sg");
  const executionMy = executionFor("job-my");
  const executionTh = executionFor("job-th");
  const executionKr = executionFor("job-kr");
  const executionTw = executionFor("job-tw");
  await dispatch.vn_evisa("app-vn", "job-vn", executionVn);
  await dispatch.vn_prearrival("app-vn", "job-vn-pre", executionVnPrearrival);
  await dispatch.sgac("app-sg", "job-sg", executionSg);
  await dispatch.mdac("app-my", "job-my", executionMy);
  await dispatch.tdac("app-th", "job-th", executionTh);
  await dispatch.kr_eform("app-kr", "job-kr", executionKr);
  await dispatch.tw_entry_permit("app-tw", "job-tw", executionTw);

  assert.deepEqual(calls, [
    { kind: "vietnam", applicationId: "app-vn", jobId: "job-vn", execution: executionVn },
    { kind: "arrival", applicationId: "app-vn", jobId: "job-vn-pre", flow: "vn_prearrival", execution: executionVnPrearrival },
    { kind: "singapore", applicationId: "app-sg", jobId: "job-sg", execution: executionSg },
    { kind: "arrival", applicationId: "app-my", jobId: "job-my", flow: "mdac", execution: executionMy },
    { kind: "arrival", applicationId: "app-th", jobId: "job-th", flow: "tdac", execution: executionTh },
    { kind: "korea", applicationId: "app-kr", jobId: "job-kr", execution: executionKr },
    { kind: "taiwan", applicationId: "app-tw", jobId: "job-tw", execution: executionTw },
  ]);
});

test("dispatch: every pool flow rejects missing or mismatched ownership before invoking a runner", () => {
  let invoked = 0;
  const outcome = {
    outcome: "halted_before_pay" as const,
    reachedStep: "test",
    artefacts: [],
  };
  const runCountry = async () => {
    invoked += 1;
    return outcome;
  };
  const runArrival = async () => {
    invoked += 1;
    return outcome;
  };
  const runKorea = async () => {
    invoked += 1;
    return outcome;
  };
  const dispatch = createPoolFlowDispatch({
    runVietnam: runCountry,
    runSingapore: runCountry,
    runArrivalCardPoolFlow: runArrival,
    runKoreaEformBackground: runKorea,
    runTaiwan: runCountry,
  });
  const mismatched = {
    jobId: "job-other",
    workerId: "worker-test",
    signal: new AbortController().signal,
    assertOwned: () => undefined,
    checkpoint: () => undefined,
  };
  const cases: Array<[string, () => Promise<unknown>]> = [
    ["vn_evisa", () => dispatch.vn_evisa("app", "job-vn", mismatched)],
    ["vn_prearrival", () => dispatch.vn_prearrival("app", "job-vn-pre", mismatched)],
    ["sgac", () => dispatch.sgac("app", "job-sg", mismatched)],
    ["mdac", () => dispatch.mdac("app", "job-my", mismatched)],
    ["tdac", () => dispatch.tdac("app", "job-th", mismatched)],
    ["kr_eform", () => dispatch.kr_eform("app", "job-kr", mismatched)],
    ["tw_entry_permit", () => dispatch.tw_entry_permit("app", "job-tw", mismatched)],
  ];
  for (const [flow, invoke] of cases) {
    assert.throws(invoke, RunnerJobOwnershipLostError, `${flow} mismatch`);
  }
  const missingCases: Array<[string, () => Promise<unknown>]> = [
    ["vn_evisa", () => dispatch.vn_evisa("app", undefined, undefined)],
    ["vn_prearrival", () => dispatch.vn_prearrival("app", undefined, undefined)],
    ["sgac", () => dispatch.sgac("app", undefined, undefined)],
    ["mdac", () => dispatch.mdac("app", undefined, undefined)],
    ["tdac", () => dispatch.tdac("app", undefined, undefined)],
    ["kr_eform", () => dispatch.kr_eform("app", undefined, undefined)],
    ["tw_entry_permit", () => dispatch.tw_entry_permit("app", undefined, undefined)],
  ];
  for (const [flow, invoke] of missingCases) {
    assert.throws(invoke, RunnerJobOwnershipLostError, `${flow} missing`);
  }
  assert.equal(invoked, 0);
});

test("dispatch: Indonesia cannot run through the simplified runner_job transport", () => {
  assert.throws(
    () => getRunOne("indonesia"),
    UnsupportedCountryError,
  );
});
