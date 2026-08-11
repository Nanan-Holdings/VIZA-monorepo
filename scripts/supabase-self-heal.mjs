#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { appendFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const DEFAULT_TIMEOUT_MS = 4_000;
export const DEFAULT_ROUNDS = 3;
export const DEFAULT_INTERVAL_MS = 5_000;
export const DEFAULT_COOLDOWN_MS = 45 * 60 * 1_000;
export const DEFAULT_FAILURE_RUN_THRESHOLD = 3;
export const DEFAULT_STATE_VERSION = 2;
export const DEFAULT_SCHEDULE_WINDOW_MS = 5 * 60 * 1_000;
export const PRODUCTION_PROJECT_REF = "oyjxdzsoejraedqghndi";
export const MANAGEMENT_API_URL = "https://api.supabase.com";
export const GITHUB_API_URL = "https://api.github.com";
export const ALLOWED_PROJECT_STATUSES = new Set(["ACTIVE_HEALTHY"]);
export const TRANSIENT_HTTP_STATUSES = new Set([
  500,
  502,
  503,
  504,
  520,
  521,
  522,
  523,
  524,
  544,
]);
export const STATE_MARKER_START = "<!-- supabase-self-heal-state:start -->";
export const STATE_MARKER_END = "<!-- supabase-self-heal-state:end -->";

const ACTIONS = new Set([
  "healthy",
  "dry_run",
  "restart_requested",
  "restart_unknown",
  "suppressed",
  "config_error",
]);
const STATE_OUTCOMES = new Set([
  "healthy",
  "suppressed",
  "probe_failure",
  "restart_pending",
  "restart_requested",
  "restart_unknown",
  "restart_rejected",
]);
const STATE_KEYS = [
  "version",
  "incidentId",
  "consecutiveFailureRuns",
  "firstFailureAt",
  "lastFailureAt",
  "lastSuccessAt",
  "restartRequestedAt",
  "lastOutcome",
  "lastProcessedRunId",
  "lastProcessedWindow",
];

function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseBoolean(value, fallback = false) {
  const normalized = asString(value).toLowerCase();
  if (!normalized) return { value: fallback, error: null };
  if (normalized === "true") return { value: true, error: null };
  if (normalized === "false") return { value: false, error: null };
  return { value: fallback, error: "expected true or false" };
}

function parseInteger(value, fallback, { minimum = 0, maximum = Number.MAX_SAFE_INTEGER } = {}) {
  const normalized = asString(value);
  if (!normalized) return { value: fallback, error: null };
  if (!/^\d+$/u.test(normalized)) {
    return { value: fallback, error: "expected a non-negative integer" };
  }

  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    return { value: fallback, error: `must be between ${minimum} and ${maximum}` };
  }
  return { value: parsed, error: null };
}

function validateProjectRef(projectRef) {
  return /^[a-z0-9]{20}$/u.test(projectRef);
}

function validateRepository(repository) {
  return /^[^/\s]+\/[^/\s]+$/u.test(repository);
}

export function validateSupabaseUrl(supabaseUrl, projectRef) {
  const value = asString(supabaseUrl);
  const ref = asString(projectRef);
  if (!value) return { ok: false, error: "SUPABASE_URL is required" };
  if (!ref || !validateProjectRef(ref)) {
    return { ok: false, error: "SUPABASE_PROJECT_REF must be 20 lowercase alphanumeric characters" };
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, error: "SUPABASE_URL must be a valid URL" };
  }

  const expectedHost = `${ref}.supabase.co`;
  if (parsed.protocol !== "https:") {
    return { ok: false, error: "SUPABASE_URL must use https" };
  }
  if (parsed.username || parsed.password || parsed.port || parsed.search || parsed.hash) {
    return { ok: false, error: "SUPABASE_URL must not contain credentials, a port, query, or fragment" };
  }
  if (parsed.hostname !== expectedHost) {
    return { ok: false, error: "SUPABASE_URL host does not match SUPABASE_PROJECT_REF" };
  }
  if (parsed.pathname !== "/" && parsed.pathname !== "") {
    return { ok: false, error: "SUPABASE_URL must not contain a path" };
  }

  return { ok: true, url: `https://${parsed.hostname}` };
}

export function loadConfig(env = process.env) {
  const source = env ?? {};
  const errors = [];
  const supabaseUrl = asString(source.SUPABASE_URL);
  const projectRef = asString(source.SUPABASE_PROJECT_REF);
  const publishableKey = asString(source.SUPABASE_PUBLISHABLE_KEY);
  const accessToken = asString(source.SUPABASE_ACCESS_TOKEN);
  const githubToken = asString(source.GITHUB_TOKEN);
  const githubRepository = asString(source.GITHUB_REPOSITORY);
  const githubRunId = asString(source.GITHUB_RUN_ID);
  const issueNumberRaw = asString(source.SUPABASE_SELF_HEAL_ISSUE_NUMBER);

  if (!supabaseUrl) errors.push("SUPABASE_URL is required");
  if (!projectRef) errors.push("SUPABASE_PROJECT_REF is required");
  if (!publishableKey) errors.push("SUPABASE_PUBLISHABLE_KEY is required");
  if (!accessToken) errors.push("SUPABASE_ACCESS_TOKEN is required");
  if (!githubToken) errors.push("GITHUB_TOKEN is required");
  if (!githubRepository) errors.push("GITHUB_REPOSITORY is required");
  if (!githubRunId) errors.push("GITHUB_RUN_ID is required");
  if (!issueNumberRaw) errors.push("SUPABASE_SELF_HEAL_ISSUE_NUMBER is required");
  if (githubRepository && !validateRepository(githubRepository)) {
    errors.push("GITHUB_REPOSITORY must be owner/repository");
  }
  if (githubRunId && !/^\d+$/u.test(githubRunId)) {
    errors.push("GITHUB_RUN_ID must contain only decimal digits");
  }
  if (projectRef && projectRef !== PRODUCTION_PROJECT_REF) {
    errors.push("SUPABASE_PROJECT_REF is not the allow-listed production project");
  }

  const issueNumber = parseInteger(issueNumberRaw, 0, { minimum: 1, maximum: 2_000_000_000 });
  if (issueNumber.error) errors.push(`SUPABASE_SELF_HEAL_ISSUE_NUMBER ${issueNumber.error}`);

  const urlValidation = validateSupabaseUrl(supabaseUrl, projectRef);
  if (!urlValidation.ok && !errors.includes(urlValidation.error)) errors.push(urlValidation.error);

  const autoRestart = parseBoolean(source.SUPABASE_AUTO_RESTART_ENABLED, false);
  if (autoRestart.error) errors.push(`SUPABASE_AUTO_RESTART_ENABLED ${autoRestart.error}`);
  const dryRun = parseBoolean(source.SUPABASE_SELF_HEAL_DRY_RUN, false);
  if (dryRun.error) errors.push(`SUPABASE_SELF_HEAL_DRY_RUN ${dryRun.error}`);

  const timeout = parseInteger(source.SUPABASE_SELF_HEAL_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, {
    minimum: 1,
    maximum: 30_000,
  });
  if (timeout.error) errors.push(`SUPABASE_SELF_HEAL_TIMEOUT_MS ${timeout.error}`);
  const rounds = parseInteger(source.SUPABASE_SELF_HEAL_ROUNDS, DEFAULT_ROUNDS, {
    minimum: 1,
    maximum: 10,
  });
  if (rounds.error) errors.push(`SUPABASE_SELF_HEAL_ROUNDS ${rounds.error}`);
  const interval = parseInteger(source.SUPABASE_SELF_HEAL_INTERVAL_MS, DEFAULT_INTERVAL_MS, {
    minimum: 0,
    maximum: 300_000,
  });
  if (interval.error) errors.push(`SUPABASE_SELF_HEAL_INTERVAL_MS ${interval.error}`);
  const cooldown = parseInteger(source.SUPABASE_SELF_HEAL_COOLDOWN_MS, DEFAULT_COOLDOWN_MS, {
    minimum: 0,
    maximum: 7 * 24 * 60 * 60 * 1_000,
  });
  if (cooldown.error) errors.push(`SUPABASE_SELF_HEAL_COOLDOWN_MS ${cooldown.error}`);

  return {
    ok: errors.length === 0,
    errors,
    supabaseUrl: urlValidation.url ?? supabaseUrl,
    projectRef,
    publishableKey,
    accessToken,
    githubToken,
    githubRepository,
    githubRunId,
    issueNumber: issueNumber.value,
    autoRestart: autoRestart.value,
    dryRun: dryRun.value,
    timeoutMs: timeout.value,
    rounds: rounds.value,
    intervalMs: interval.value,
    cooldownMs: cooldown.value,
    githubApiUrl: asString(source.GITHUB_API_URL) || GITHUB_API_URL,
    githubOutputPath: asString(source.GITHUB_OUTPUT) || null,
  };
}

export function buildProbeUrls(supabaseUrl) {
  const base = asString(supabaseUrl).replace(/\/$/u, "");
  return {
    auth: `${base}/auth/v1/settings`,
    rest: `${base}/rest/v1/applicant_profiles?select=id&limit=0`,
    control: `${base}/auth/v1/settings`,
  };
}

export function buildManagementProjectUrl(projectRef, baseUrl = MANAGEMENT_API_URL) {
  return `${baseUrl.replace(/\/$/u, "")}/v1/projects/${encodeURIComponent(projectRef)}`;
}

export function buildManagementRestartUrl(projectRef, baseUrl = MANAGEMENT_API_URL) {
  return `${baseUrl.replace(/\/$/u, "")}/v1/projects/${encodeURIComponent(projectRef)}/restart`;
}

export function buildGitHubIssueUrl(repository, issueNumber, baseUrl = GITHUB_API_URL) {
  const [owner, repo] = asString(repository).split("/");
  return `${baseUrl.replace(/\/$/u, "")}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${encodeURIComponent(issueNumber)}`;
}

function validTimestamp(value) {
  return value === null || (typeof value === "string" && Number.isFinite(Date.parse(value)));
}

export function createInitialState() {
  return {
    version: DEFAULT_STATE_VERSION,
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

function validateState(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)) return "state must be an object";
  for (const key of STATE_KEYS) {
    if (!(key in state)) return `state missing ${key}`;
  }
  if (state.version !== DEFAULT_STATE_VERSION) return "state version is unsupported";
  if (state.incidentId !== null && (typeof state.incidentId !== "string" || !state.incidentId)) {
    return "state incidentId is invalid";
  }
  if (
    !Number.isSafeInteger(state.consecutiveFailureRuns) ||
    state.consecutiveFailureRuns < 0 ||
    state.consecutiveFailureRuns > 1_000
  ) {
    return "state consecutiveFailureRuns is invalid";
  }
  for (const key of ["firstFailureAt", "lastFailureAt", "lastSuccessAt", "restartRequestedAt"]) {
    if (!validTimestamp(state[key])) return `state ${key} is invalid`;
  }
  if (!STATE_OUTCOMES.has(state.lastOutcome)) return "state lastOutcome is invalid";
  for (const key of ["lastProcessedRunId", "lastProcessedWindow"]) {
    if (state[key] !== null && (typeof state[key] !== "string" || !/^\d+$/u.test(state[key]))) {
      return `state ${key} is invalid`;
    }
  }
  return null;
}

export function serializeStateForIssue(state) {
  const error = validateState(state);
  if (error) throw new TypeError(error);
  return `${STATE_MARKER_START}\n${JSON.stringify(state, null, 2)}\n${STATE_MARKER_END}`;
}

export function parseStateFromIssueBody(body) {
  if (typeof body !== "string") throw new Error("issue body is not a string");
  const start = body.indexOf(STATE_MARKER_START);
  const end = body.indexOf(STATE_MARKER_END);
  if (start < 0 || end < 0 || end < start) throw new Error("state markers are missing");
  const jsonText = body.slice(start + STATE_MARKER_START.length, end).trim();
  if (!jsonText) throw new Error("state marker JSON is empty");
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("state marker JSON is invalid");
  }
  const error = validateState(parsed);
  if (error) throw new Error(error);
  return parsed;
}

function errorKind(error, signal) {
  if (signal?.aborted || error?.name === "AbortError" || error?.code === "ABORT_ERR") return "timeout";
  const message = typeof error?.message === "string" ? error.message.toLowerCase() : "";
  const code = typeof error?.code === "string" ? error.code.toUpperCase() : "";
  const causeCode = typeof error?.cause?.code === "string" ? error.cause.code.toUpperCase() : "";
  const networkCodes = new Set([
    "ECONNREFUSED",
    "ECONNRESET",
    "EHOSTUNREACH",
    "ENETUNREACH",
    "ENOTFOUND",
    "EAI_AGAIN",
    "ETIMEDOUT",
    "UND_ERR_CONNECT_TIMEOUT",
    "UND_ERR_SOCKET",
  ]);
  if (
    networkCodes.has(code) ||
    networkCodes.has(causeCode) ||
    /fetch failed|network|socket|econn|enotfound|dns|timed out/u.test(message)
  ) {
    return "network";
  }
  return "error";
}

export async function fetchWithTimeout(
  url,
  {
    fetchImpl = globalThis.fetch,
    headers = {},
    timeoutMs = DEFAULT_TIMEOUT_MS,
    method = "GET",
    body,
    parseJson = false,
    parseJsonStatuses = [200],
  } = {},
) {
  const startedAt = Date.now();
  const elapsed = () => Math.max(0, Date.now() - startedAt);
  if (typeof fetchImpl !== "function") return { kind: "config", status: null, elapsedMs: elapsed() };

  const controller = new AbortController();
  let timer;
  let timedOut = false;
  let responseStatus = null;
  const request = Promise.resolve()
    .then(async () => {
      let response;
      try {
        response = await fetchImpl(url, {
          method,
          headers,
          signal: controller.signal,
          redirect: "manual",
          ...(body === undefined ? {} : { body }),
        });
      } catch (error) {
        return { kind: errorKind(error, controller.signal), status: null, elapsedMs: elapsed() };
      }
      if (!response || !Number.isInteger(response.status)) {
        return { kind: "network", status: null, elapsedMs: elapsed() };
      }
      responseStatus = response.status;
      const result = { kind: "http", status: response.status, elapsedMs: elapsed() };
      if (!parseJson || !parseJsonStatuses.includes(response.status)) return result;
      if (typeof response.json !== "function") return { kind: "parse_error", status: response.status, elapsedMs: elapsed() };
      try {
        const body = await response.json();
        return { ...result, body, elapsedMs: elapsed() };
      } catch (error) {
        return {
          kind: errorKind(error, controller.signal) === "timeout" ? "timeout" : "parse_error",
          status: response.status,
          elapsedMs: elapsed(),
        };
      }
    })
    .catch((error) => ({ kind: errorKind(error, controller.signal), status: null, elapsedMs: elapsed() }));

  const timeout = new Promise((resolveTimeout) => {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      resolveTimeout({ kind: "timeout", status: null, elapsedMs: elapsed() });
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([request, timeout]);
    if (timedOut) return { kind: "timeout", status: responseStatus, elapsedMs: result.elapsedMs };
    return result;
  } finally {
    clearTimeout(timer);
  }
}

export function classifyProbeResult(result) {
  if (result?.kind === "http") {
    if (result.status === 200) return "healthy";
    if (TRANSIENT_HTTP_STATUSES.has(result.status)) return "transient";
    return "non_transient";
  }
  if (result?.kind === "timeout" || result?.kind === "network") return "transient";
  return "non_transient";
}

function resultCategory(result) {
  if (!result) return "unknown";
  if (result.kind === "http") {
    if (result.status === 200) return "healthy";
    if (TRANSIENT_HTTP_STATUSES.has(result.status)) return `http_${result.status}`;
    return `http_${result.status}`;
  }
  return result.kind;
}

function probeHeaders(publishableKey) {
  return {
    accept: "application/json",
    apikey: publishableKey,
    "cache-control": "no-store",
  };
}

function controlProbeHeaders() {
  return {
    accept: "application/json",
    apikey: "sb_publishable_viza_healthcheck_invalid",
    "cache-control": "no-store",
  };
}

function normalizeProbeResult(result, endpoint) {
  if (result.kind !== "http") return result;
  if (result.status !== 200) return { kind: "http", status: result.status, elapsedMs: result.elapsedMs };
  const valid = endpoint === "auth"
    ? Boolean(result.body && typeof result.body === "object" && !Array.isArray(result.body))
    : Array.isArray(result.body) && result.body.length === 0;
  if (!valid) return { kind: "invalid_payload", status: result.status, elapsedMs: result.elapsedMs };
  return { kind: "http", status: result.status, elapsedMs: result.elapsedMs };
}

export async function probeSupabase(
  supabaseUrl,
  publishableKey,
  { fetchImpl = globalThis.fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {},
) {
  const urls = buildProbeUrls(supabaseUrl);
  const headers = probeHeaders(publishableKey);
  const [authResponse, restResponse, controlResponse] = await Promise.all([
    fetchWithTimeout(urls.auth, {
      fetchImpl,
      headers,
      timeoutMs,
      parseJson: true,
    }),
    fetchWithTimeout(urls.rest, {
      fetchImpl,
      headers,
      timeoutMs,
      parseJson: true,
    }),
    fetchWithTimeout(urls.control, {
      fetchImpl,
      headers: controlProbeHeaders(),
      timeoutMs,
    }),
  ]);
  return {
    auth: normalizeProbeResult(authResponse, "auth"),
    rest: normalizeProbeResult(restResponse, "rest"),
    control: controlResponse,
  };
}

function isControlPlaneReachable(probeResult) {
  return probeResult?.control?.kind === "http" &&
    (probeResult.control.status === 401 || probeResult.control.status === 403);
}

function isConfirmedDataPlaneFailure(probeResult) {
  return classifyProbeResult(probeResult.auth) === "transient" &&
    classifyProbeResult(probeResult.rest) === "transient" &&
    isControlPlaneReachable(probeResult);
}

function isHealthyProbe(probeResult) {
  return classifyProbeResult(probeResult.auth) === "healthy" &&
    classifyProbeResult(probeResult.rest) === "healthy" &&
    isControlPlaneReachable(probeResult);
}

function safeNow(now) {
  const value = typeof now === "function" ? now() : now;
  return Number.isFinite(value) ? value : Date.now();
}

function timestamp(nowMs) {
  return new Date(nowMs).toISOString();
}

function createIncidentId(nowMs, idFactory = randomUUID) {
  return `${timestamp(nowMs)}-${idFactory()}`;
}

function failureState(state, nowMs, idFactory, runId, runWindow) {
  const now = timestamp(nowMs);
  const isNewIncident = state.consecutiveFailureRuns === 0 || !state.incidentId;
  return {
    ...state,
    incidentId: isNewIncident ? createIncidentId(nowMs, idFactory) : state.incidentId,
    consecutiveFailureRuns: state.consecutiveFailureRuns + 1,
    firstFailureAt: isNewIncident ? now : state.firstFailureAt,
    lastFailureAt: now,
    lastOutcome: "probe_failure",
    lastProcessedRunId: runId,
    lastProcessedWindow: runWindow,
  };
}

function recoveredState(state, nowMs, outcome, runId, runWindow) {
  return {
    ...state,
    consecutiveFailureRuns: 0,
    firstFailureAt: null,
    lastFailureAt: null,
    lastSuccessAt: timestamp(nowMs),
    lastOutcome: outcome,
    lastProcessedRunId: runId,
    lastProcessedWindow: runWindow,
  };
}

function unresolvedRestartState(state, nowMs, runId, runWindow) {
  return {
    ...state,
    lastFailureAt: timestamp(nowMs),
    lastProcessedRunId: runId,
    lastProcessedWindow: runWindow,
  };
}

function leaseState(state, nowMs) {
  return {
    ...state,
    restartRequestedAt: timestamp(nowMs),
    lastOutcome: "restart_pending",
  };
}

function outcomeState(state, outcome) {
  return { ...state, lastOutcome: outcome };
}

export function isCooldownElapsed(lastRestartAt, nowMs, cooldownMs = DEFAULT_COOLDOWN_MS) {
  if (lastRestartAt === null || lastRestartAt === undefined) return true;
  const parsed = typeof lastRestartAt === "string" ? Date.parse(lastRestartAt) : lastRestartAt;
  if (!Number.isFinite(parsed) || !Number.isFinite(nowMs)) return false;
  return nowMs >= parsed && nowMs - parsed >= cooldownMs;
}

function githubHeaders(token, includeJson = false) {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "x-github-api-version": "2022-11-28",
    ...(includeJson ? { "content-type": "application/json" } : {}),
  };
}

async function requestGitHubIssue(
  config,
  { fetchImpl = globalThis.fetch, timeoutMs = DEFAULT_TIMEOUT_MS, method = "GET", body } = {},
) {
  return fetchWithTimeout(buildGitHubIssueUrl(config.githubRepository, config.issueNumber, config.githubApiUrl), {
    fetchImpl,
    timeoutMs,
    method,
    headers: githubHeaders(config.githubToken, method === "PATCH"),
    body,
    parseJson: method === "GET",
  });
}

export async function readIssueState(
  config,
  { fetchImpl = globalThis.fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {},
) {
  const result = await requestGitHubIssue(config, { fetchImpl, timeoutMs, method: "GET" });
  if (result.kind !== "http" || result.status < 200 || result.status >= 300) {
    return { ok: false, result, reason: "issue_read_failed" };
  }
  try {
    const state = parseStateFromIssueBody(result.body?.body);
    return { ok: true, state, result };
  } catch {
    return { ok: false, result, reason: "issue_state_invalid" };
  }
}

export async function writeIssueState(
  config,
  state,
  { fetchImpl = globalThis.fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {},
) {
  let body;
  try {
    body = JSON.stringify({ body: serializeStateForIssue(state) });
  } catch {
    return { ok: false, result: { kind: "config", status: null, elapsedMs: 0 }, reason: "state_invalid" };
  }
  const result = await requestGitHubIssue(config, {
    fetchImpl,
    timeoutMs,
    method: "PATCH",
    body,
  });
  if (result.kind !== "http" || result.status < 200 || result.status >= 300) {
    return { ok: false, result, reason: "issue_write_failed" };
  }
  return { ok: true, result };
}

async function fetchManagementProjectStatus(
  config,
  { fetchImpl = globalThis.fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {},
) {
  const result = await fetchWithTimeout(buildManagementProjectUrl(config.projectRef), {
    fetchImpl,
    timeoutMs,
    headers: {
      accept: "application/json",
      authorization: `Bearer ${config.accessToken}`,
    },
    parseJson: true,
  });
  if (result.kind !== "http" || result.status < 200 || result.status >= 300) {
    return { ok: false, reason: "management_status_error", result };
  }
  const body = result.body;
  if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.status !== "string") {
    return { ok: false, reason: "management_status_invalid", result };
  }
  if (body.ref && body.ref !== config.projectRef) {
    return { ok: false, reason: "management_status_mismatch", result };
  }
  const allowed = ALLOWED_PROJECT_STATUSES.has(body.status);
  return {
    ok: allowed,
    status: body.status,
    reason: allowed ? null : "management_status_not_allowed",
    result,
  };
}

async function postManagementRestart(
  config,
  { fetchImpl = globalThis.fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {},
) {
  const result = await fetchWithTimeout(buildManagementRestartUrl(config.projectRef), {
    fetchImpl,
    timeoutMs,
    method: "POST",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${config.accessToken}`,
    },
  });
  if (result.kind === "timeout" || result.kind === "network") return { outcome: "unknown", result };
  if (result.kind === "http" && result.status >= 200 && result.status < 300) {
    return { outcome: "requested", result };
  }
  if (
    result.kind === "http" &&
    (result.status === 408 || result.status === 429 || TRANSIENT_HTTP_STATUSES.has(result.status))
  ) {
    return { outcome: "unknown", result };
  }
  return { outcome: "error", result };
}

function emitLog(logger, entry) {
  if (typeof logger === "function") logger({ event: "supabase_self_heal", ...entry });
}

function logResult(logger, {
  phase,
  incidentId = null,
  result = null,
  category = null,
  round = null,
  endpoint = null,
}) {
  emitLog(logger, {
    phase,
    incident_id: incidentId,
    elapsed_ms: result?.elapsedMs ?? null,
    http_status: result?.status ?? null,
    category: category ?? resultCategory(result),
    ...(round === null ? {} : { round }),
    ...(endpoint === null ? {} : { endpoint }),
  });
}

function decisionResult(action, stateChanged, reason, state, extra = {}) {
  return {
    action: ACTIONS.has(action) ? action : "config_error",
    stateChanged: Boolean(stateChanged),
    reason,
    incidentId: state?.incidentId ?? null,
    ...extra,
  };
}

export async function writeGithubOutput(outputPath, action, stateChanged, fsApi = { appendFile }) {
  if (!outputPath) return false;
  await fsApi.appendFile(
    outputPath,
    `action=${ACTIONS.has(action) ? action : "config_error"}\nstate_changed=${stateChanged ? "true" : "false"}\n`,
    "utf8",
  );
  return true;
}

async function finalizeResult(result, config, logger) {
  emitLog(logger, {
    action: result.action,
    reason: result.reason,
    incident_id: result.incidentId ?? null,
    elapsed_ms: 0,
    http_status: null,
    category: result.action,
  });
  if (config.githubOutputPath) await writeGithubOutput(config.githubOutputPath, result.action, result.stateChanged);
  return result;
}

export async function runSelfHeal(options = {}) {
  const env = options.env ?? process.env;
  const loaded = loadConfig(env);
  const logger = options.logger ?? ((entry) => console.log(JSON.stringify(entry)));
  if (!loaded.ok) {
    const result = decisionResult("config_error", false, "invalid_configuration", null);
    emitLog(logger, {
      action: result.action,
      reason: result.reason,
      incident_id: null,
      elapsed_ms: 0,
      http_status: null,
      category: result.action,
    });
    if (loaded.githubOutputPath) await writeGithubOutput(loaded.githubOutputPath, result.action, false);
    return result;
  }

  const config = {
    ...loaded,
    githubApiUrl: options.githubApiUrl ?? loaded.githubApiUrl,
    rounds: options.rounds ?? loaded.rounds,
    intervalMs: options.intervalMs ?? loaded.intervalMs,
    timeoutMs: options.timeoutMs ?? loaded.timeoutMs,
    cooldownMs: options.cooldownMs ?? loaded.cooldownMs,
  };
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const sleep = options.sleep ?? ((duration) => new Promise((resolveSleep) => setTimeout(resolveSleep, duration)));
  const nowMs = safeNow(options.now ?? Date.now);
  const idFactory = options.idFactory ?? randomUUID;
  const runWindow = String(Math.floor(nowMs / DEFAULT_SCHEDULE_WINDOW_MS));

  const issue = await readIssueState(config, { fetchImpl, timeoutMs: config.timeoutMs });
  logResult(logger, {
    phase: "issue_read",
    incidentId: issue.state?.incidentId ?? null,
    result: issue.result,
    category: issue.ok ? "ok" : issue.reason,
  });
  if (!issue.ok) {
    return finalizeResult(decisionResult("config_error", false, issue.reason, null), config, logger);
  }

  let state = issue.state;
  let stateChanged = false;
  if (
    state.lastProcessedRunId === config.githubRunId ||
    state.lastProcessedWindow === runWindow
  ) {
    return finalizeResult(
      decisionResult("suppressed", false, "duplicate_schedule", state),
      config,
      logger,
    );
  }
  const rounds = [];
  for (let round = 0; round < config.rounds; round += 1) {
    const probes = await probeSupabase(config.supabaseUrl, config.publishableKey, {
      fetchImpl,
      timeoutMs: config.timeoutMs,
    });
    rounds.push(probes);
    logResult(logger, {
      phase: "probe",
      incidentId: state.incidentId,
      result: probes.auth,
      round: round + 1,
      endpoint: "auth",
    });
    logResult(logger, {
      phase: "probe",
      incidentId: state.incidentId,
      result: probes.rest,
      round: round + 1,
      endpoint: "rest",
    });
    logResult(logger, {
      phase: "probe",
      incidentId: state.incidentId,
      result: probes.control,
      round: round + 1,
      endpoint: "control",
      category: isControlPlaneReachable(probes) ? "edge_reachable" : null,
    });
    if (round < config.rounds - 1) await sleep(config.intervalMs);
  }

  const allHealthy = rounds.every(isHealthyProbe);
  const allConfirmedFailure = rounds.every(isConfirmedDataPlaneFailure);
  if (
    !allHealthy &&
    ["restart_pending", "restart_unknown", "restart_requested"].includes(state.lastOutcome)
  ) {
    const pendingState = unresolvedRestartState(
      state,
      nowMs,
      config.githubRunId,
      runWindow,
    );
    const pendingSaved = await writeIssueState(config, pendingState, { fetchImpl, timeoutMs: config.timeoutMs });
    logResult(logger, {
      phase: "issue_write",
      incidentId: pendingState.incidentId,
      result: pendingSaved.result,
      category: pendingSaved.ok ? state.lastOutcome : pendingSaved.reason,
    });
    if (!pendingSaved.ok) {
      return finalizeResult(decisionResult("config_error", false, pendingSaved.reason, state, { rounds }), config, logger);
    }
    return finalizeResult(
      decisionResult("suppressed", true, "restart_confirmation_pending", pendingState, { rounds }),
      config,
      logger,
    );
  }

  if (!allConfirmedFailure) {
    const nextState = recoveredState(
      state,
      nowMs,
      allHealthy ? "healthy" : "suppressed",
      config.githubRunId,
      runWindow,
    );
    const saved = await writeIssueState(config, nextState, { fetchImpl, timeoutMs: config.timeoutMs });
    logResult(logger, {
      phase: "issue_write",
      incidentId: nextState.incidentId,
      result: saved.result,
      category: saved.ok ? "ok" : saved.reason,
    });
    if (!saved.ok) return finalizeResult(decisionResult("config_error", false, saved.reason, state), config, logger);
    state = nextState;
    stateChanged = true;
    return finalizeResult(
      decisionResult(allHealthy ? "healthy" : "suppressed", stateChanged, allHealthy ? "probes_healthy" : "probes_not_confirmed_transient", state, { rounds }),
      config,
      logger,
    );
  }

  const nextFailureState = failureState(
    state,
    nowMs,
    idFactory,
    config.githubRunId,
    runWindow,
  );
  const failureSaved = await writeIssueState(config, nextFailureState, { fetchImpl, timeoutMs: config.timeoutMs });
  logResult(logger, {
    phase: "issue_write",
    incidentId: nextFailureState.incidentId,
    result: failureSaved.result,
    category: failureSaved.ok ? "ok" : failureSaved.reason,
  });
  if (!failureSaved.ok) return finalizeResult(decisionResult("config_error", false, failureSaved.reason, nextFailureState, { rounds }), config, logger);
  state = nextFailureState;
  stateChanged = true;

  if (state.consecutiveFailureRuns < DEFAULT_FAILURE_RUN_THRESHOLD) {
    return finalizeResult(decisionResult("suppressed", stateChanged, "failure_confirmation", state, { rounds }), config, logger);
  }
  if (!config.autoRestart && !config.dryRun) {
    return finalizeResult(decisionResult("suppressed", stateChanged, "auto_restart_disabled", state, { rounds }), config, logger);
  }
  if (!isCooldownElapsed(state.restartRequestedAt, nowMs, config.cooldownMs)) {
    return finalizeResult(decisionResult("suppressed", stateChanged, "restart_cooldown", state, { rounds }), config, logger);
  }

  const status = await fetchManagementProjectStatus(config, { fetchImpl, timeoutMs: config.timeoutMs });
  logResult(logger, {
    phase: "management_status",
    incidentId: state.incidentId,
    result: status.result,
    category: status.ok ? "ok" : status.reason,
  });
  if (!status.ok) {
    return finalizeResult(decisionResult("suppressed", stateChanged, status.reason, state, { rounds, projectStatus: status.status ?? null }), config, logger);
  }
  if (config.dryRun) {
    return finalizeResult(decisionResult("dry_run", stateChanged, "restart_would_be_requested", state, { rounds, projectStatus: status.status }), config, logger);
  }

  const lease = leaseState(state, nowMs);
  const leaseSaved = await writeIssueState(config, lease, { fetchImpl, timeoutMs: config.timeoutMs });
  logResult(logger, {
    phase: "issue_write",
    incidentId: lease.incidentId,
    result: leaseSaved.result,
    category: leaseSaved.ok ? "restart_pending" : leaseSaved.reason,
  });
  if (!leaseSaved.ok) {
    return finalizeResult(decisionResult("config_error", stateChanged, leaseSaved.reason, state, { rounds, projectStatus: status.status }), config, logger);
  }
  state = lease;

  const restart = await postManagementRestart(config, { fetchImpl, timeoutMs: config.timeoutMs });
  logResult(logger, {
    phase: "management_restart",
    incidentId: state.incidentId,
    result: restart.result,
    category: restart.outcome,
  });
  const outcome = restart.outcome === "requested" ? "restart_requested" : restart.outcome === "unknown" ? "restart_unknown" : "restart_rejected";
  const outcomeStateValue = outcomeState(state, outcome);
  const outcomeSaved = await writeIssueState(config, outcomeStateValue, { fetchImpl, timeoutMs: config.timeoutMs });
  logResult(logger, {
    phase: "issue_write",
    incidentId: outcomeStateValue.incidentId,
    result: outcomeSaved.result,
    category: outcomeSaved.ok ? outcome : outcomeSaved.reason,
  });
  if (outcome === "restart_rejected") {
    return finalizeResult(decisionResult("suppressed", stateChanged, "management_restart_rejected", outcomeStateValue, { rounds, projectStatus: status.status }), config, logger);
  }
  return finalizeResult(
    decisionResult(outcome, stateChanged, outcome === "restart_unknown" ? "management_restart_timeout" : "management_restart_requested", outcomeStateValue, { rounds, projectStatus: status.status }),
    config,
    logger,
  );
}

export async function main(options = {}) {
  try {
    return await runSelfHeal(options);
  } catch {
    const result = decisionResult("config_error", false, "unexpected_error", null);
    const logger = options.logger ?? ((entry) => console.log(JSON.stringify(entry)));
    emitLog(logger, {
      action: result.action,
      reason: result.reason,
      incident_id: null,
      elapsed_ms: null,
      http_status: null,
      category: result.action,
    });
    const outputPath = asString((options.env ?? process.env).GITHUB_OUTPUT);
    if (outputPath) {
      try {
        await writeGithubOutput(outputPath, result.action, false);
      } catch {
        // Preserve the fail-closed result when the runner output is unavailable.
      }
    }
    return result;
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
const modulePath = resolve(fileURLToPath(import.meta.url));
if (invokedPath && invokedPath === modulePath) {
  const result = await main();
  if (result.action === "config_error") process.exitCode = 1;
}
