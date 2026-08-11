import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  ALLOWED_PROJECT_STATUSES,
  buildProbeUrls,
  classifyProbeResult,
  loadConfig,
  parseStateFromIssueBody,
  runSelfHeal,
  serializeStateForIssue,
} from "../supabase-self-heal.mjs";

const PROJECT_REF = "oyjxdzsoejraedqghndi";
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;
const PUBLISHABLE_KEY = "sb_publishable_test_key";
const ACCESS_TOKEN = "sbp_management_test_token";
const GITHUB_TOKEN = "github_test_token";
const REPOSITORY = "viza/test-repo";
const ISSUE_NUMBER = "42";

function baseEnv(overrides = {}) {
  return {
    SUPABASE_URL,
    SUPABASE_PROJECT_REF: PROJECT_REF,
    SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE_KEY,
    SUPABASE_ACCESS_TOKEN: ACCESS_TOKEN,
    SUPABASE_AUTO_RESTART_ENABLED: "true",
    SUPABASE_SELF_HEAL_DRY_RUN: "false",
    GITHUB_TOKEN,
    GITHUB_REPOSITORY: REPOSITORY,
    GITHUB_RUN_ID: "1001",
    SUPABASE_SELF_HEAL_ISSUE_NUMBER: ISSUE_NUMBER,
    ...overrides,
  };
}

function response(status, body, { stalled = false } = {}) {
  return {
    status,
    async json() {
      if (stalled) return new Promise(() => {});
      return body;
    },
  };
}

function emptyState() {
  return {
    version: 2,
    incidentId: null,
    consecutiveFailureRuns: 0,
    firstFailureAt: null,
    lastFailureAt: null,
    lastSuccessAt: null,
    restartRequestedAt: null,
    lastOutcome: "healthy",
    lastProcessedRunId: null,
    lastProcessedWindow: null,
  };
}

function issueBody(state = emptyState()) {
  return {
    body: serializeStateForIssue(state),
    title: "Supabase self-heal state",
  };
}

function createFetch({
  state = emptyState(),
  probeStatus = 503,
  authStatus = probeStatus,
  restStatus = probeStatus,
  authBody = {},
  restBody = [],
  controlStatus = 401,
  projectStatus = "ACTIVE_HEALTHY",
  restartStatus = 200,
  issueGetStatus = 200,
  issuePatchStatus = 200,
  issueGetBody = null,
  issuePatchBody = null,
  stalledAuthBody = false,
  stalledRestBody = false,
} = {}) {
  const calls = [];
  let currentIssueBody = issueGetBody ?? issueBody(state);
  const fetchImpl = async (url, options = {}) => {
    const call = { url: String(url), options };
    calls.push(call);

    if (
      String(url).includes("/auth/v1/settings") &&
      options.headers?.apikey === PUBLISHABLE_KEY
    ) {
      return response(authStatus, authBody, { stalled: stalledAuthBody });
    }
    if (String(url).includes("/auth/v1/settings")) {
      return response(controlStatus, { message: "Invalid API key" });
    }
    if (String(url).includes("/rest/v1/applicant_profiles")) {
      return response(restStatus, restBody, { stalled: stalledRestBody });
    }
    if (String(url).includes("api.github.com/repos/")) {
      if (options.method === "GET") {
        return response(issueGetStatus, currentIssueBody);
      }
      if (options.method === "PATCH") {
        if (issuePatchStatus >= 200 && issuePatchStatus < 300 && options.body) {
          currentIssueBody = { ...currentIssueBody, body: JSON.parse(options.body).body };
        }
        return response(issuePatchStatus, issuePatchBody);
      }
      throw new Error(`unexpected GitHub method: ${options.method}`);
    }
    if (String(url).endsWith(`/v1/projects/${PROJECT_REF}`)) {
      return response(200, { ref: PROJECT_REF, status: projectStatus });
    }
    if (String(url).endsWith(`/v1/projects/${PROJECT_REF}/restart`)) {
      return response(restartStatus);
    }
    throw new Error(`unexpected URL: ${url}`);
  };
  return { calls, fetchImpl, getIssueBody: () => currentIssueBody };
}

function probeCalls(calls) {
  return calls.filter((call) =>
    call.url.includes("/auth/v1/settings") || call.url.includes("/rest/v1/applicant_profiles"),
  );
}

test("validates Supabase host/ref and durable Issue configuration", () => {
  const valid = loadConfig(baseEnv());
  assert.equal(valid.ok, true);
  assert.equal(valid.issueNumber, 42);

  const mismatch = loadConfig(baseEnv({ SUPABASE_URL: "https://different-project.supabase.co" }));
  assert.equal(mismatch.ok, false);
  assert.match(mismatch.errors.join(" "), /host|project ref/i);

  const missingIssue = loadConfig(baseEnv({ SUPABASE_SELF_HEAL_ISSUE_NUMBER: "" }));
  assert.equal(missingIssue.ok, false);
  assert.match(missingIssue.errors.join(" "), /ISSUE_NUMBER/i);

  const otherRef = "abcdefghijklmnopqrst";
  const notAllowListed = loadConfig(baseEnv({
    SUPABASE_PROJECT_REF: otherRef,
    SUPABASE_URL: `https://${otherRef}.supabase.co`,
  }));
  assert.equal(notAllowListed.ok, false);
  assert.match(notAllowListed.errors.join(" "), /allow-listed production project/i);
});

test("serializes and parses state only inside explicit HTML markers", () => {
  const state = emptyState();
  const body = `context\n${serializeStateForIssue(state)}\ntrailer`;
  assert.deepEqual(parseStateFromIssueBody(body), state);
  assert.throws(() => parseStateFromIssueBody("missing marker"), /marker/i);
  assert.throws(() => parseStateFromIssueBody("<!-- supabase-self-heal-state:start -->{}<!-- supabase-self-heal-state:end -->"), /version|state/i);
  assert.throws(
    () => parseStateFromIssueBody(serializeStateForIssue({ ...state, consecutiveFailureRuns: 1_001 })),
    /consecutiveFailureRuns/i,
  );
});

test("builds GET read-only Auth and REST probe URLs", () => {
  assert.deepEqual(buildProbeUrls(SUPABASE_URL), {
    auth: `${SUPABASE_URL}/auth/v1/settings`,
    rest: `${SUPABASE_URL}/rest/v1/applicant_profiles?select=id&limit=0`,
    control: `${SUPABASE_URL}/auth/v1/settings`,
  });
});

test("classifies only the explicit transient HTTP statuses", () => {
  for (const status of [500, 502, 503, 504, 520, 521, 522, 523, 524, 544]) {
    assert.equal(classifyProbeResult({ kind: "http", status }), "transient", String(status));
  }
  for (const status of [501, 505, 400, 401, 429]) {
    assert.equal(classifyProbeResult({ kind: "http", status }), "non_transient", String(status));
  }
  assert.equal(classifyProbeResult({ kind: "timeout" }), "transient");
  assert.equal(classifyProbeResult({ kind: "network" }), "transient");
  assert.equal(ALLOWED_PROJECT_STATUSES.has("ACTIVE_HEALTHY"), true);
});

test("GET probes include no-store and strictly validate bounded JSON payloads", async () => {
  const { calls, fetchImpl } = createFetch({ probeStatus: 200, authBody: { external: true }, restBody: [] });
  const result = await runSelfHeal({
    env: baseEnv({ SUPABASE_AUTO_RESTART_ENABLED: "false" }),
    fetchImpl,
    rounds: 3,
    intervalMs: 0,
    sleep: async () => {},
  });
  assert.equal(result.action, "healthy");
  assert.equal(
    probeCalls(calls).every((call) => call.options.method === "GET"),
    true,
  );
  assert.equal(
    probeCalls(calls).every((call) => call.options.headers["cache-control"] === "no-store"),
    true,
  );
  assert.equal(
    probeCalls(calls).every((call) => !("authorization" in call.options.headers)),
    true,
    "opaque publishable keys must not be sent as Bearer JWTs",
  );
  assert.equal(
    probeCalls(calls).some((call) => call.url.includes("limit=0")),
    true,
  );

  const nonEmpty = createFetch({ probeStatus: 200, authBody: {}, restBody: [{ id: 1 }] });
  const nonEmptyResult = await runSelfHeal({
    env: baseEnv({ SUPABASE_AUTO_RESTART_ENABLED: "false" }),
    fetchImpl: nonEmpty.fetchImpl,
    rounds: 3,
    intervalMs: 0,
    sleep: async () => {},
  });
  assert.equal(nonEmptyResult.action, "suppressed");
});

test("requires three independent confirmed data-plane failure runs before one restart", async () => {
  const shared = createFetch({ probeStatus: 503 });
  const logs = [];
  const common = {
    fetchImpl: shared.fetchImpl,
    sleep: async () => {},
    rounds: 3,
    intervalMs: 0,
    logger: (entry) => logs.push(entry),
  };

  const first = await runSelfHeal({
    ...common,
    env: baseEnv({ GITHUB_RUN_ID: "2001" }),
    now: () => 300_000,
  });
  assert.equal(first.action, "suppressed");
  assert.equal(first.reason, "failure_confirmation");
  const second = await runSelfHeal({
    ...common,
    env: baseEnv({ GITHUB_RUN_ID: "2002" }),
    now: () => 600_000,
  });
  assert.equal(second.action, "suppressed");
  assert.equal(second.reason, "failure_confirmation");
  const third = await runSelfHeal({
    ...common,
    env: baseEnv({ GITHUB_RUN_ID: "2003" }),
    now: () => 900_000,
  });
  assert.equal(third.action, "restart_requested");
  assert.equal(shared.calls.filter((call) => call.url.endsWith("/restart")).length, 1);

  const issuePatches = shared.calls.filter((call) =>
    call.url.includes("api.github.com") && call.options.method === "PATCH",
  );
  assert.ok(issuePatches.length >= 4);
  assert.equal(issuePatches.every((call) => typeof call.options.body === "string"), true);
  assert.equal(issuePatches.every((call) => call.options.body.includes("supabase-self-heal-state:start")), true);
  const finalState = parseStateFromIssueBody(shared.getIssueBody().body);
  assert.equal(finalState.consecutiveFailureRuns, 3);
  assert.equal(finalState.lastOutcome, "restart_requested");
  assert.equal(typeof finalState.incidentId, "string");
  assert.equal(logs.every((entry) => !JSON.stringify(entry).includes(PUBLISHABLE_KEY)), true);
  assert.equal(logs.every((entry) => !JSON.stringify(entry).includes(ACCESS_TOKEN)), true);
  assert.equal(logs.every((entry) => !JSON.stringify(entry).includes(GITHUB_TOKEN)), true);
  assert.equal(logs.every((entry) => "incident_id" in entry || entry.action === "config_error"), true);
});

test("healthy workflow clears failure count and persists success state", async () => {
  const prior = {
    ...emptyState(),
    incidentId: "incident-1",
    consecutiveFailureRuns: 2,
    firstFailureAt: new Date(1_000).toISOString(),
    lastFailureAt: new Date(2_000).toISOString(),
    lastOutcome: "probe_failure",
  };
  const shared = createFetch({ state: prior, probeStatus: 200, authBody: {}, restBody: [] });
  const result = await runSelfHeal({
    env: baseEnv({ SUPABASE_AUTO_RESTART_ENABLED: "false" }),
    fetchImpl: shared.fetchImpl,
    now: () => 10_000,
    rounds: 3,
    intervalMs: 0,
    sleep: async () => {},
  });
  assert.equal(result.action, "healthy");
  const state = parseStateFromIssueBody(shared.getIssueBody().body);
  assert.equal(state.consecutiveFailureRuns, 0);
  assert.equal(state.lastOutcome, "healthy");
  assert.equal(state.lastSuccessAt, new Date(10_000).toISOString());
});

test("Issue read and write failures fail closed without restart", async () => {
  const readFailure = createFetch({ probeStatus: 503, issueGetStatus: 500 });
  const readResult = await runSelfHeal({
    env: baseEnv(),
    fetchImpl: readFailure.fetchImpl,
    rounds: 3,
    intervalMs: 0,
    sleep: async () => {},
  });
  assert.equal(readResult.action, "config_error");
  assert.equal(readFailure.calls.some((call) => call.url.endsWith("/restart")), false);

  const writeFailure = createFetch({ probeStatus: 503, issuePatchStatus: 500 });
  const writeResult = await runSelfHeal({
    env: baseEnv(),
    fetchImpl: writeFailure.fetchImpl,
    rounds: 3,
    intervalMs: 0,
    sleep: async () => {},
  });
  assert.equal(writeResult.action, "config_error");
  assert.equal(writeFailure.calls.some((call) => call.url.endsWith("/restart")), false);
});

test("requires the pre-POST restart_pending lease and never posts when lease PATCH fails", async () => {
  const failLease = createFetch({ probeStatus: 503, issuePatchStatus: 500 });
  const result = await runSelfHeal({
    env: baseEnv(),
    fetchImpl: failLease.fetchImpl,
    now: () => 30_000,
    rounds: 3,
    intervalMs: 0,
    sleep: async () => {},
  });
  assert.equal(result.action, "config_error");
  assert.equal(failLease.calls.some((call) => call.url.endsWith("/restart")), false);

  const leased = createFetch({
    probeStatus: 503,
    state: {
      ...emptyState(),
      incidentId: "incident-lease",
      consecutiveFailureRuns: 2,
      firstFailureAt: new Date(1_000).toISOString(),
      lastFailureAt: new Date(2_000).toISOString(),
      lastOutcome: "probe_failure",
    },
  });
  const leasedResult = await runSelfHeal({
    env: baseEnv(),
    fetchImpl: leased.fetchImpl,
    now: () => 30_000,
    rounds: 3,
    intervalMs: 0,
    sleep: async () => {},
  });
  assert.equal(leasedResult.action, "restart_requested");
  const patchIndex = leased.calls.findIndex((call) =>
    call.options.method === "PATCH" && JSON.parse(call.options.body).body.includes('"lastOutcome": "restart_pending"'),
  );
  const postIndex = leased.calls.findIndex((call) => call.url.endsWith("/restart"));
  assert.ok(patchIndex >= 0 && postIndex > patchIndex);
});

test("treats a Management API 5xx as unknown and never repeats it", async () => {
  const shared = createFetch({
    probeStatus: 503,
    restartStatus: 503,
    state: {
      ...emptyState(),
      incidentId: "incident-management-unknown",
      consecutiveFailureRuns: 2,
      firstFailureAt: new Date(300_000).toISOString(),
      lastFailureAt: new Date(600_000).toISOString(),
      lastOutcome: "probe_failure",
      lastProcessedRunId: "3900",
      lastProcessedWindow: "2",
    },
  });
  const first = await runSelfHeal({
    env: baseEnv({ GITHUB_RUN_ID: "3901" }),
    fetchImpl: shared.fetchImpl,
    now: () => 900_000,
    rounds: 3,
    intervalMs: 0,
    sleep: async () => {},
  });
  assert.equal(first.action, "restart_unknown");
  assert.equal(parseStateFromIssueBody(shared.getIssueBody().body).lastOutcome, "restart_unknown");

  const second = await runSelfHeal({
    env: baseEnv({ GITHUB_RUN_ID: "3902" }),
    fetchImpl: shared.fetchImpl,
    now: () => 4_000_000,
    rounds: 3,
    intervalMs: 0,
    sleep: async () => {},
  });
  assert.equal(second.action, "suppressed");
  assert.equal(second.reason, "restart_confirmation_pending");
  assert.equal(shared.calls.filter((call) => call.url.endsWith("/restart")).length, 1);
});

test("stalled JSON body is a transient timeout and cannot trigger a restart by itself", async () => {
  const stalled = createFetch({ probeStatus: 200, stalledAuthBody: true, restBody: [] });
  const result = await runSelfHeal({
    env: baseEnv({ SUPABASE_AUTO_RESTART_ENABLED: "false" }),
    fetchImpl: stalled.fetchImpl,
    timeoutMs: 5,
    rounds: 3,
    intervalMs: 0,
    sleep: async () => {},
  });
  assert.equal(result.action, "suppressed");
  assert.equal(stalled.calls.some((call) => call.url.endsWith("/restart")), false);
});

test("an ordinary TypeError is fail-closed and does not count as a transient outage", async () => {
  const prior = {
    ...emptyState(),
    incidentId: "incident-type-error",
    consecutiveFailureRuns: 2,
    firstFailureAt: new Date(1_000).toISOString(),
    lastFailureAt: new Date(2_000).toISOString(),
    lastOutcome: "probe_failure",
  };
  const base = createFetch({ state: prior, probeStatus: 503 });
  const fetchImpl = async (url, options) => {
    if (String(url).includes("/auth/v1/settings")) throw new TypeError("invalid request shape");
    return base.fetchImpl(url, options);
  };
  const result = await runSelfHeal({
    env: baseEnv(),
    fetchImpl,
    rounds: 3,
    intervalMs: 0,
    sleep: async () => {},
  });
  assert.equal(result.action, "suppressed");
  assert.equal(result.reason, "probes_not_confirmed_transient");
  assert.equal(base.calls.some((call) => call.url.endsWith("/restart")), false);
});

test("does not count failures when the invalid-key edge control is also unavailable", async () => {
  const shared = createFetch({ probeStatus: 503, controlStatus: 503 });
  const result = await runSelfHeal({
    env: baseEnv({ GITHUB_RUN_ID: "5001" }),
    fetchImpl: shared.fetchImpl,
    now: () => 1_500_000,
    rounds: 3,
    intervalMs: 0,
    sleep: async () => {},
  });
  assert.equal(result.action, "suppressed");
  assert.equal(result.reason, "probes_not_confirmed_transient");
  assert.equal(shared.calls.some((call) => call.url.endsWith("/restart")), false);
  assert.equal(parseStateFromIssueBody(shared.getIssueBody().body).consecutiveFailureRuns, 0);
});

test("deduplicates the same run and five-minute schedule window", async () => {
  const prior = {
    ...emptyState(),
    incidentId: "incident-deduplicated",
    consecutiveFailureRuns: 1,
    firstFailureAt: new Date(300_000).toISOString(),
    lastFailureAt: new Date(300_000).toISOString(),
    lastOutcome: "probe_failure",
    lastProcessedRunId: "6001",
    lastProcessedWindow: "1",
  };
  const shared = createFetch({ state: prior, probeStatus: 503 });
  const result = await runSelfHeal({
    env: baseEnv({ GITHUB_RUN_ID: "6001" }),
    fetchImpl: shared.fetchImpl,
    now: () => 599_999,
    rounds: 3,
    intervalMs: 0,
    sleep: async () => {},
  });
  assert.equal(result.action, "suppressed");
  assert.equal(result.reason, "duplicate_schedule");
  assert.equal(probeCalls(shared.calls).length, 0);
  assert.equal(parseStateFromIssueBody(shared.getIssueBody().body).consecutiveFailureRuns, 1);
});

test("never repeats an unresolved restart even after the cooldown", async () => {
  const prior = {
    ...emptyState(),
    incidentId: "incident-pending",
    consecutiveFailureRuns: 3,
    firstFailureAt: new Date(300_000).toISOString(),
    lastFailureAt: new Date(900_000).toISOString(),
    restartRequestedAt: new Date(900_000).toISOString(),
    lastOutcome: "restart_pending",
    lastProcessedRunId: "7000",
    lastProcessedWindow: "3",
  };
  const shared = createFetch({ state: prior, probeStatus: 503 });
  const result = await runSelfHeal({
    env: baseEnv({ GITHUB_RUN_ID: "7001" }),
    fetchImpl: shared.fetchImpl,
    now: () => 4_000_000,
    rounds: 3,
    intervalMs: 0,
    sleep: async () => {},
  });
  assert.equal(result.action, "suppressed");
  assert.equal(result.reason, "restart_confirmation_pending");
  assert.equal(shared.calls.some((call) => call.url.endsWith("/restart")), false);
  const state = parseStateFromIssueBody(shared.getIssueBody().body);
  assert.equal(state.lastOutcome, "restart_pending");
  assert.equal(state.lastProcessedRunId, "7001");
});

test("keeps an unresolved restart lease through ambiguous non-healthy probes", async () => {
  const prior = {
    ...emptyState(),
    incidentId: "incident-ambiguous-pending",
    consecutiveFailureRuns: 3,
    firstFailureAt: new Date(300_000).toISOString(),
    lastFailureAt: new Date(900_000).toISOString(),
    restartRequestedAt: new Date(900_000).toISOString(),
    lastOutcome: "restart_unknown",
    lastProcessedRunId: "7100",
    lastProcessedWindow: "3",
  };
  const shared = createFetch({ state: prior, authStatus: 400, restStatus: 503 });
  const result = await runSelfHeal({
    env: baseEnv({ GITHUB_RUN_ID: "7101" }),
    fetchImpl: shared.fetchImpl,
    now: () => 4_300_000,
    rounds: 3,
    intervalMs: 0,
    sleep: async () => {},
  });
  assert.equal(result.action, "suppressed");
  assert.equal(result.reason, "restart_confirmation_pending");
  assert.equal(shared.calls.some((call) => call.url.endsWith("/restart")), false);
  const state = parseStateFromIssueBody(shared.getIssueBody().body);
  assert.equal(state.lastOutcome, "restart_unknown");
  assert.equal(state.lastProcessedRunId, "7101");
});

test("emits action and state_changed through GITHUB_OUTPUT", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "supabase-self-heal-"));
  const outputPath = path.join(tempDir, "github-output");
  const { fetchImpl } = createFetch({ probeStatus: 200, authBody: {}, restBody: [] });

  try {
    const result = await runSelfHeal({
      env: baseEnv({ SUPABASE_AUTO_RESTART_ENABLED: "false", GITHUB_OUTPUT: outputPath }),
      fetchImpl,
      rounds: 3,
      intervalMs: 0,
      sleep: async () => {},
    });
    assert.equal(result.action, "healthy");
    assert.equal(await readFile(outputPath, "utf8"), "action=healthy\nstate_changed=true\n");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
