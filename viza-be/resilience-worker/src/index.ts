import { DurableObject } from "cloudflare:workers";

type RuntimeEnv = Env & {
  readonly VIZA_RESILIENCE_HMAC_SECRET: string;
  readonly SUPABASE_MANAGEMENT_API_TOKEN: string;
  readonly SUPABASE_ANON_KEY: string;
};

type Circuit = "closed" | "open" | "half_open";
type CacheKey = { userRef: string; scope: string; key: string };
type ProbeResult = { auth: Probe; rest: Probe; control: Probe; healthy: boolean };
type Probe = { ok: boolean; transient: boolean; status: number | null; latencyMs: number };

type CachePutCommand = CacheKey & {
  blob: string;
  ttlSeconds: number;
  oneTime?: boolean;
};

type OutboxItem = {
  idempotencyKey: string;
  userRef?: string;
  scope: string;
  eventType: string;
  blob: string;
  availableAt?: number;
};

type ClaimedItem = OutboxItem & {
  attempts: number;
  leaseId: string;
  leaseUntil: number;
};

const DO_NAME = "global";
const MAX_TTL_SECONDS = 30 * 24 * 60 * 60;
const MAX_RETRY_AFTER_SECONDS = 24 * 60 * 60;
const MAX_OUTBOX_ATTEMPTS = 20;
const DEFAULT_MAX_BODY_BYTES = 524_288;
const DEFAULT_CONFIRMATIONS = 3;
const DEFAULT_CONFIRMATION_INTERVAL_MS = 5_000;
const DEFAULT_PROBE_TIMEOUT_MS = 4_000;
const DEFAULT_RESTART_COOLDOWN_SECONDS = 1_800;
const DEFAULT_RESTART_WINDOW_SECONDS = 3_600;
const DEFAULT_MAX_RESTARTS_PER_WINDOW = 1;
const DEFAULT_RESTART_LEASE_SECONDS = 300;
const DEFAULT_REPLAY_BATCH_SIZE = 25;
const DEFAULT_REPLAY_LEASE_SECONDS = 120;
const DEFAULT_REPLAY_TIMEOUT_MS = 8_000;
const DEFAULT_AUTH_WINDOW_SECONDS = 300;

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function log(level: "info" | "warn" | "error", event: string, fields: Record<string, unknown> = {}): void {
  // Never include request bodies, user references, cache keys, or encrypted
  // blobs. Structured logs make the Worker safe to tail and aggregate.
  const payload = { level, event, ts: new Date().toISOString(), ...fields };
  if (level === "error") console.error(JSON.stringify(payload));
  else console.log(JSON.stringify(payload));
}

function numberVar(value: string | undefined, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function boolVar(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

function boundedString(value: unknown, name: string, max = 256): string {
  if (typeof value !== "string" || value.length === 0 || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new InputError(`${name} is invalid`);
  }
  return value;
}

function optionalBoundedString(value: unknown, name: string, max = 256): string | undefined {
  if (value === undefined || value === null) return undefined;
  return boundedString(value, name, max);
}

class InputError extends Error {}

async function readBody(request: Request, maxBytes: number): Promise<{ bytes: Uint8Array; text: string }> {
  const length = request.headers.get("content-length");
  if (length && Number.parseInt(length, 10) > maxBytes) throw new InputError("request body too large");
  const buffer = await request.arrayBuffer();
  if (buffer.byteLength > maxBytes) throw new InputError("request body too large");
  const bytes = new Uint8Array(buffer);
  return { bytes, text: new TextDecoder().decode(bytes) };
}

async function sha256Hex(value: Uint8Array | string): Promise<string> {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(value: string): Uint8Array | null {
  if (!/^[0-9a-f]{64}$/i.test(value)) return null;
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i += 1) bytes[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function verifyHmac(request: Request, path: string, body: Uint8Array, env: RuntimeEnv, state: DurableObjectStub<ResilienceState>): Promise<Response | null> {
  const timestamp = request.headers.get("X-Viza-Timestamp") ?? "";
  const nonce = request.headers.get("X-Viza-Nonce") ?? "";
  const signature = request.headers.get("X-Viza-Signature") ?? "";
  const keyId = request.headers.get("X-Viza-Key-Id") ?? "";
  const timestampSeconds = Number.parseInt(timestamp, 10);
  if (!keyId || keyId !== env.VIZA_RESILIENCE_KEY_ID || !/^\d{10,}$/.test(timestamp) || !nonce || !/^[0-9a-f]{64}$/i.test(signature)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  if (Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds) > DEFAULT_AUTH_WINDOW_SECONDS) {
    return json({ ok: false, error: "stale_request" }, 401);
  }
  const bodyHash = await sha256Hex(body);
  const canonical = `${request.method}\n${path}\n${timestamp}\n${nonce}\n${bodyHash}`;
  const expected = await hmacHex(env.VIZA_RESILIENCE_HMAC_SECRET, canonical);
  const expectedBytes = new TextEncoder().encode(expected.toLowerCase());
  const signatureBytes = new TextEncoder().encode(signature.toLowerCase());
  if (expectedBytes.byteLength !== signatureBytes.byteLength || !crypto.subtle.timingSafeEqual?.(expectedBytes, signatureBytes)) {
    // timingSafeEqual is not present in every Workers compatibility version;
    // HMAC verification below is the constant-time primitive when available.
    const hmacKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.VIZA_RESILIENCE_HMAC_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const valid = hexToBytes(signature);
    const verified = valid ? await crypto.subtle.verify("HMAC", hmacKey, valid, new TextEncoder().encode(canonical)) : false;
    if (!verified) return json({ ok: false, error: "unauthorized" }, 401);
  }
  const nonceResult = await doCall(state, { op: "claimNonce", nonce, expiresAt: (timestampSeconds + DEFAULT_AUTH_WINDOW_SECONDS) * 1000 });
  if (nonceResult.accepted !== true) return json({ ok: false, error: "replayed_request" }, 409);
  return null;
}

function parseJson(text: string): Record<string, unknown> {
  if (!text) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new InputError("invalid JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new InputError("JSON object required");
  return parsed as Record<string, unknown>;
}

function cacheKey(body: Record<string, unknown>): CacheKey {
  return {
    userRef: boundedString(body.userRef, "userRef"),
    scope: boundedString(body.scope, "scope", 128),
    key: boundedString(body.key, "key", 256),
  };
}

function positiveInteger(value: unknown, name: string, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) throw new InputError(`${name} is invalid`);
  return parsed;
}

function cachePut(body: Record<string, unknown>): CachePutCommand {
  const key = cacheKey(body);
  const blob = boundedString(body.blob, "blob", 450_000);
  const ttlSeconds = positiveInteger(body.ttlSeconds, "ttlSeconds", 1, MAX_TTL_SECONDS);
  return { ...key, blob, ttlSeconds, oneTime: body.oneTime === true };
}

function outboxItem(body: Record<string, unknown>): OutboxItem {
  const item: OutboxItem = {
    idempotencyKey: boundedString(body.idempotencyKey, "idempotencyKey", 256),
    userRef: optionalBoundedString(body.userRef, "userRef"),
    scope: boundedString(body.scope, "scope", 128),
    eventType: boundedString(body.eventType, "eventType", 128),
    blob: boundedString(body.blob, "blob", 450_000),
  };
  if (body.availableAt !== undefined) {
    const availableAt = Number(body.availableAt);
    if (!Number.isFinite(availableAt) || availableAt < 0) throw new InputError("availableAt is invalid");
    item.availableAt = Math.min(availableAt, Date.now() + 365 * 24 * 60 * 60 * 1000);
  }
  return item;
}

async function doCall(stub: DurableObjectStub<ResilienceState>, command: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await stub.fetch("https://resilience-state/internal", {
    method: "POST",
    body: JSON.stringify(command),
    headers: { "Content-Type": "application/json" },
  });
  const payload: unknown = await response.json();
  if (!response.ok || !payload || typeof payload !== "object") throw new Error("durable state request failed");
  return payload as Record<string, unknown>;
}

function stateStub(env: RuntimeEnv): DurableObjectStub<ResilienceState> {
  return env.RESILIENCE_STATE.getByName(DO_NAME);
}

async function probe(url: string, headers: HeadersInit, timeoutMs: number): Promise<Probe> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { headers, signal: controller.signal, method: "GET" });
    return {
      ok: response.status >= 200 && response.status < 300,
      transient: response.status === 408 || response.status === 429 || response.status >= 500,
      status: response.status,
      latencyMs: Date.now() - started,
    };
  } catch {
    return { ok: false, transient: true, status: null, latencyMs: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

async function watchdogRun(env: RuntimeEnv): Promise<void> {
  const baseUrl = env.SUPABASE_URL.trim().replace(/\/$/, "");
  const projectRef = env.SUPABASE_PROJECT_REF.trim();
  let parsedBase: URL;
  try {
    parsedBase = new URL(baseUrl);
  } catch {
    log("warn", "watchdog_skipped", { reason: "SUPABASE_URL_invalid" });
    return;
  }
  if (!baseUrl || parsedBase.protocol !== "https:" || !/^[a-z0-9]{20}$/.test(projectRef) || parsedBase.hostname !== `${projectRef}.supabase.co` || !env.SUPABASE_ANON_KEY.trim()) {
    log("warn", "watchdog_skipped", { reason: "watchdog_probe_configuration_invalid" });
    return;
  }
  const state = stateStub(env);
  const rounds = numberVar(env.WATCHDOG_CONFIRMATIONS, DEFAULT_CONFIRMATIONS, 1, 5);
  const intervalMs = numberVar(env.WATCHDOG_CONFIRMATION_INTERVAL_MS, DEFAULT_CONFIRMATION_INTERVAL_MS, 100, 60_000);
  const timeoutMs = numberVar(env.WATCHDOG_PROBE_TIMEOUT_MS, DEFAULT_PROBE_TIMEOUT_MS, 250, 30_000);
  const headers: HeadersInit = env.SUPABASE_ANON_KEY ? { apikey: env.SUPABASE_ANON_KEY } : {};
  const controlHeaders: HeadersInit = { apikey: "sb_publishable_viza_healthcheck_invalid" };
  let confirmedFailures = 0;
  let lastProbe: ProbeResult | null = null;
  for (let round = 0; round < rounds; round += 1) {
    const [auth, rest, control] = await Promise.all([
      // Settings is a lightweight, authenticated Auth data-plane endpoint.
      probe(`${baseUrl}/auth/v1/settings`, headers, timeoutMs),
      // A zero-row query exercises PostgREST, routing, and the project DB
      // without returning applicant data.
      probe(`${baseUrl}/rest/v1/applicant_profiles?select=id&limit=0`, headers, timeoutMs),
      // An intentionally invalid key distinguishes a reachable edge/control
      // plane from a project data-plane outage. Never log the key or response.
      probe(`${baseUrl}/auth/v1/settings`, controlHeaders, timeoutMs),
    ]);
    const controlReachable = control.status === 401 || control.status === 403;
    const confirmedFailure = auth.transient && rest.transient && controlReachable;
    lastProbe = { auth, rest, control: { ...control, ok: controlReachable }, healthy: auth.ok && rest.ok && controlReachable };
    if (lastProbe.healthy || !confirmedFailure) confirmedFailures = 0;
    else confirmedFailures += 1;
    await doCall(state, {
      op: "recordProbe",
      probe: lastProbe,
      circuit: lastProbe.healthy || !confirmedFailure || confirmedFailures < rounds ? "closed" : "open",
      now: Date.now(),
    });
    log(lastProbe.healthy ? "info" : "warn", "supabase_probe", { round: round + 1, healthy: lastProbe.healthy, authStatus: auth.status, restStatus: rest.status, controlStatus: control.status });
    if (lastProbe.healthy || round + 1 < rounds) {
      if (round + 1 < rounds) await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));
    }
  }
  if (!lastProbe || confirmedFailures < rounds || lastProbe.healthy || !boolVar(env.WATCHDOG_AUTO_RESTART)) return;
  const managementUrl = env.SUPABASE_MANAGEMENT_API_URL.trim().replace(/\/$/, "");
  const ref = env.SUPABASE_PROJECT_REF.trim();
  const token = env.SUPABASE_MANAGEMENT_API_TOKEN?.trim();
  if (!managementUrl || !ref || !token || !managementUrl.startsWith("https://")) {
    log("warn", "watchdog_restart_suppressed", { reason: "management_credentials_missing" });
    return;
  }
  const statusController = new AbortController();
  const statusTimer = setTimeout(() => statusController.abort(), timeoutMs * 2);
  let projectStatus: string | null = null;
  try {
    const statusResponse = await fetch(`${managementUrl}/v1/projects/${encodeURIComponent(ref)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: statusController.signal,
    });
    if (statusResponse.status === 200) {
      const statusBody: unknown = await statusResponse.json();
      if (statusBody && typeof statusBody === "object" && !Array.isArray(statusBody) && typeof (statusBody as { status?: unknown }).status === "string") {
        projectStatus = (statusBody as { status: string }).status;
      }
    }
  } catch {
    projectStatus = null;
  } finally {
    clearTimeout(statusTimer);
  }
  // Management status is a false-positive guard: do not try to restart a
  // deliberately paused, restoring, or otherwise non-healthy project.
  if (projectStatus !== "ACTIVE_HEALTHY") {
    log("warn", "watchdog_restart_suppressed", { reason: "project_status_not_active_healthy" });
    return;
  }
  const lease = await doCall(state, {
    op: "acquireRestart",
    now: Date.now(),
    cooldownMs: numberVar(env.WATCHDOG_RESTART_COOLDOWN_SECONDS, DEFAULT_RESTART_COOLDOWN_SECONDS, 60, 86_400) * 1000,
    windowMs: numberVar(env.WATCHDOG_RESTART_WINDOW_SECONDS, DEFAULT_RESTART_WINDOW_SECONDS, 60, 86_400) * 1000,
    maxRestarts: numberVar(env.WATCHDOG_MAX_RESTARTS_PER_WINDOW, DEFAULT_MAX_RESTARTS_PER_WINDOW, 1, 5),
    leaseMs: numberVar(env.WATCHDOG_RESTART_LEASE_SECONDS, DEFAULT_RESTART_LEASE_SECONDS, 30, 3_600) * 1000,
  });
  if (lease.acquired !== true) {
    log("info", "watchdog_restart_suppressed", { reason: String(lease.reason ?? "cooldown") });
    return;
  }
  let ok = false;
  let status: number | null = null;
  let errorCode: string | null = null;
  {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs * 2);
    try {
      const response = await fetch(`${managementUrl}/v1/projects/${encodeURIComponent(ref)}/restart`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: "{}",
        signal: controller.signal,
      });
      status = response.status;
      ok = response.status >= 200 && response.status < 300;
      if (!ok) errorCode = `management_http_${response.status}`;
    } catch {
      errorCode = "management_fetch_failed";
    } finally {
      clearTimeout(timer);
    }
  }
  await doCall(state, { op: "completeRestart", leaseId: lease.leaseId, now: Date.now(), ok, status, errorCode });
  log(ok ? "info" : "error", "supabase_restart", { ok, status, errorCode });
}

async function replayOutbox(env: RuntimeEnv): Promise<void> {
  const replayUrl = env.VIZA_RESILIENCE_REPLAY_URL.trim();
  if (!replayUrl || !env.VIZA_RESILIENCE_HMAC_SECRET?.trim()) return;
  const state = stateStub(env);
  const claim = await doCall(state, {
    op: "claimOutbox",
    now: Date.now(),
    limit: numberVar(env.WATCHDOG_REPLAY_BATCH_SIZE, DEFAULT_REPLAY_BATCH_SIZE, 1, 100),
    leaseMs: numberVar(env.WATCHDOG_REPLAY_LEASE_SECONDS, DEFAULT_REPLAY_LEASE_SECONDS, 15, 900) * 1000,
  });
  const items = Array.isArray(claim.items) ? claim.items : [];
  if (!items.length) return;
  const body = JSON.stringify({ items });
  const url = new URL(replayUrl);
  if (url.protocol !== "https:") {
    log("warn", "outbox_replay_skipped", { reason: "replay_url_must_use_https" });
    return;
  }
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomUUID();
  const signature = await hmacHex(env.VIZA_RESILIENCE_HMAC_SECRET, `POST\n${url.pathname}\n${timestamp}\n${nonce}\n${await sha256Hex(body)}`);
  let responsePayload: unknown;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_REPLAY_TIMEOUT_MS);
    const response = await fetch(url, {
      method: "POST",
      body,
      headers: {
        "Content-Type": "application/json",
        "X-Viza-Key-Id": env.VIZA_RESILIENCE_KEY_ID,
        "X-Viza-Timestamp": timestamp,
        "X-Viza-Nonce": nonce,
        "X-Viza-Signature": signature,
      },
      signal: controller.signal,
    });
    responsePayload = response.ok ? await response.json() : null;
    clearTimeout(timer);
  } catch {
    responsePayload = null;
  }
  const result = responsePayload && typeof responsePayload === "object" ? responsePayload as { results?: unknown; items?: unknown } : {};
  // The replay contract uses `results` and `outcome`; `items`/`status` is
  // accepted as a backwards-compatible read path for an in-flight rollout.
  const results = Array.isArray(result.results) ? result.results : Array.isArray(result.items) ? result.items : [];
  const ack: Array<{ idempotencyKey: string; leaseId?: string }> = [];
  const nack: Array<{ idempotencyKey: string; leaseId?: string; errorCode?: string; retryAfterSeconds?: number }> = [];
  const claimedLeases = new Map(items.map((value) => {
    const item = value as Record<string, unknown>;
    return [String(item.idempotencyKey), String(item.leaseId)] as const;
  }));
  for (const entry of results) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    if (typeof item.idempotencyKey !== "string") continue;
    const leaseId = typeof item.leaseId === "string" ? item.leaseId : "";
    if (!leaseId || claimedLeases.get(item.idempotencyKey) !== leaseId) continue;
    const base = { idempotencyKey: item.idempotencyKey, leaseId };
    const outcome = item.outcome ?? item.status;
    if (outcome === "ack") ack.push(base);
    else if (outcome === "nack") nack.push({ ...base, ...(typeof item.errorCode === "string" ? { errorCode: item.errorCode } : {}), ...(typeof item.retryAfterSeconds === "number" ? { retryAfterSeconds: item.retryAfterSeconds } : {}) });
  }
  if (ack.length) await doCall(state, { op: "ackOutbox", items: ack });
  if (nack.length) await doCall(state, { op: "nackOutbox", items: nack, now: Date.now() });
  if (!ack.length && !nack.length) await doCall(state, { op: "nackOutbox", items: items.map((item) => ({ idempotencyKey: String((item as Record<string, unknown>).idempotencyKey), leaseId: String((item as Record<string, unknown>).leaseId), errorCode: "replay_unavailable", retryAfterSeconds: 60 })), now: Date.now() });
  log("info", "outbox_replay", { claimed: items.length, acked: ack.length, nacked: nack.length });
}

async function handleRequest(request: Request, env: RuntimeEnv): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/health") {
    const status = await doCall(stateStub(env), { op: "health", now: Date.now() });
    return json({ ok: true, service: "viza-resilience-worker", ...status });
  }
  if (request.method !== "POST" || !url.pathname.startsWith("/v1/")) return json({ ok: false, error: "not_found" }, 404);
  const maxBody = numberVar(env.WATCHDOG_MAX_BODY_BYTES, DEFAULT_MAX_BODY_BYTES, 1024, 2_000_000);
  let body: { bytes: Uint8Array; text: string };
  try {
    body = await readBody(request, maxBody);
  } catch (error) {
    return json({ ok: false, error: error instanceof InputError ? error.message : "body_read_failed" }, 413);
  }
  if (!env.VIZA_RESILIENCE_HMAC_SECRET?.trim()) return json({ ok: false, error: "gateway_not_configured" }, 503);
  const authError = await verifyHmac(request, url.pathname, body.bytes, env, stateStub(env));
  if (authError) return authError;
  let parsed: Record<string, unknown>;
  try {
    parsed = parseJson(body.text);
    const state = stateStub(env);
    if (url.pathname === "/v1/cache/put") {
      const command = cachePut(parsed);
      const result = await doCall(state, { op: "cachePut", ...command, now: Date.now() });
      return json({ ok: true, ...result });
    }
    if (url.pathname === "/v1/cache/get" || url.pathname === "/v1/cache/consume") {
      const command = cacheKey(parsed);
      const result = await doCall(state, { op: url.pathname.endsWith("consume") ? "cacheConsume" : "cacheGet", ...command, now: Date.now() });
      return json({ ok: true, ...result });
    }
    if (url.pathname === "/v1/outbox/enqueue") {
      const command = outboxItem(parsed);
      const result = await doCall(state, { op: "enqueueOutbox", ...command, now: Date.now() });
      return json({ ok: true, ...result });
    }
    if (url.pathname === "/v1/outbox/claim") {
      const result = await doCall(state, { op: "claimOutbox", now: Date.now(), limit: numberVar(String(parsed.limit ?? ""), DEFAULT_REPLAY_BATCH_SIZE, 1, 100), leaseMs: numberVar(String(parsed.leaseSeconds ?? ""), DEFAULT_REPLAY_LEASE_SECONDS, 15, 900) * 1000 });
      return json({ ok: true, ...result });
    }
    if (url.pathname === "/v1/outbox/ack") {
      const keys = Array.isArray(parsed.idempotencyKeys) ? parsed.idempotencyKeys.map((value) => boundedString(value, "idempotencyKey")) : [];
      const items = Array.isArray(parsed.items) ? parsed.items : keys.map((idempotencyKey) => ({ idempotencyKey }));
      const result = await doCall(state, { op: "ackOutbox", items, now: Date.now() });
      return json({ ok: true, ...result });
    }
    if (url.pathname === "/v1/outbox/nack") {
      if (!Array.isArray(parsed.items)) throw new InputError("items is required");
      const result = await doCall(state, { op: "nackOutbox", items: parsed.items, now: Date.now() });
      return json({ ok: true, ...result });
    }
    return json({ ok: false, error: "not_found" }, 404);
  } catch (error) {
    if (error instanceof InputError) return json({ ok: false, error: error.message }, 400);
    log("error", "request_failed", { path: url.pathname, reason: error instanceof Error ? error.message : "unknown" });
    return json({ ok: false, error: "internal_error" }, 500);
  }
}

export class ResilienceState extends DurableObject<RuntimeEnv> {
  constructor(ctx: DurableObjectState, env: RuntimeEnv) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS nonces (nonce TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS cache (
          user_ref TEXT NOT NULL, scope TEXT NOT NULL, cache_key TEXT NOT NULL,
          blob TEXT NOT NULL, expires_at INTEGER NOT NULL, one_time INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (user_ref, scope, cache_key)
        );
        CREATE TABLE IF NOT EXISTS outbox (
          idempotency_key TEXT PRIMARY KEY, user_ref TEXT, scope TEXT NOT NULL,
          event_type TEXT NOT NULL, blob TEXT NOT NULL, available_at INTEGER NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending',
          lease_id TEXT, lease_until INTEGER, last_error TEXT, created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS restart_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT, lease_id TEXT UNIQUE NOT NULL,
          started_at INTEGER NOT NULL, lease_until INTEGER NOT NULL,
          completed_at INTEGER, ok INTEGER, status INTEGER, error_code TEXT
        );
      `);
    });
  }

  async fetch(request: Request): Promise<Response> {
    let command: Record<string, unknown>;
    try {
      command = (await request.json()) as Record<string, unknown>;
    } catch {
      return json({ ok: false, error: "invalid_command" }, 400);
    }
    try {
      switch (command.op) {
        case "claimNonce": return this.claimNonce(command);
        case "cachePut": return this.cachePut(command);
        case "cacheGet": return this.cacheGet(command, false);
        case "cacheConsume": return this.cacheGet(command, true);
        case "enqueueOutbox": return this.enqueueOutbox(command);
        case "claimOutbox": return this.claimOutbox(command);
        case "ackOutbox": return this.ackOutbox(command);
        case "nackOutbox": return this.nackOutbox(command);
        case "recordProbe": return this.recordProbe(command);
        case "acquireRestart": return this.acquireRestart(command);
        case "completeRestart": return this.completeRestart(command);
        case "health": return this.health(command);
        default: return json({ ok: false, error: "unknown_command" }, 400);
      }
    } catch (error) {
      log("error", "state_command_failed", { op: String(command.op), reason: error instanceof Error ? error.message : "unknown" });
      return json({ ok: false, error: "state_command_failed" }, 500);
    }
  }

  private claimNonce(command: Record<string, unknown>): Response {
    const nonce = boundedString(command.nonce, "nonce", 128);
    const expiresAt = Number(command.expiresAt);
    const now = Date.now();
    this.ctx.storage.sql.exec("DELETE FROM nonces WHERE expires_at <= ?", now);
    const result = this.ctx.storage.sql.exec("INSERT OR IGNORE INTO nonces (nonce, expires_at) VALUES (?, ?)", nonce, Math.max(expiresAt, now + 1_000));
    return json({ accepted: result.rowsWritten > 0 });
  }

  private cachePut(command: Record<string, unknown>): Response {
    const userRef = boundedString(command.userRef, "userRef");
    const scope = boundedString(command.scope, "scope", 128);
    const cacheKey = boundedString(command.key, "key");
    const blob = boundedString(command.blob, "blob", 450_000);
    const now = Number(command.now);
    const expiresAt = now + numberVar(String(command.ttlSeconds ?? ""), 0, 1, MAX_TTL_SECONDS) * 1000;
    if (expiresAt <= now) throw new InputError("ttlSeconds is invalid");
    this.ctx.storage.sql.exec("INSERT INTO cache (user_ref, scope, cache_key, blob, expires_at, one_time) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(user_ref, scope, cache_key) DO UPDATE SET blob=excluded.blob, expires_at=excluded.expires_at, one_time=excluded.one_time", userRef, scope, cacheKey, blob, expiresAt, command.oneTime === true ? 1 : 0);
    return json({ expiresAt });
  }

  private cacheGet(command: Record<string, unknown>, consume: boolean): Response {
    const userRef = boundedString(command.userRef, "userRef");
    const scope = boundedString(command.scope, "scope", 128);
    const cacheKey = boundedString(command.key, "key");
    const now = Number(command.now);
    const rows = this.ctx.storage.sql.exec<{ blob: string; expires_at: number }>("SELECT blob, expires_at FROM cache WHERE user_ref=? AND scope=? AND cache_key=? AND expires_at>?", userRef, scope, cacheKey, now).toArray();
    if (!rows.length) {
      this.ctx.storage.sql.exec("DELETE FROM cache WHERE user_ref=? AND scope=? AND cache_key=? AND expires_at<=?", userRef, scope, cacheKey, now);
      return json({ hit: false });
    }
    const row = rows[0];
    if (consume) this.ctx.storage.sql.exec("DELETE FROM cache WHERE user_ref=? AND scope=? AND cache_key=?", userRef, scope, cacheKey);
    return json({ hit: true, blob: row.blob, expiresAt: row.expires_at });
  }

  private enqueueOutbox(command: Record<string, unknown>): Response {
    const idempotencyKey = boundedString(command.idempotencyKey, "idempotencyKey");
    const scope = boundedString(command.scope, "scope", 128);
    const eventType = boundedString(command.eventType, "eventType", 128);
    const blob = boundedString(command.blob, "blob", 450_000);
    const userRef = optionalBoundedString(command.userRef, "userRef");
    const now = Number(command.now);
    const availableAt = Number(command.availableAt ?? now);
    const result = this.ctx.storage.sql.exec("INSERT OR IGNORE INTO outbox (idempotency_key, user_ref, scope, event_type, blob, available_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", idempotencyKey, userRef ?? null, scope, eventType, blob, Number.isFinite(availableAt) ? availableAt : now, now, now);
    return json({ accepted: result.rowsWritten > 0, duplicate: result.rowsWritten === 0 });
  }

  private claimOutbox(command: Record<string, unknown>): Response {
    const now = Number(command.now);
    const limit = numberVar(String(command.limit ?? ""), DEFAULT_REPLAY_BATCH_SIZE, 1, 100);
    const leaseMs = numberVar(String(command.leaseMs ?? ""), DEFAULT_REPLAY_LEASE_SECONDS * 1000, 15_000, 900_000);
    // Scheduled runs are also the garbage collector. This bounds storage
    // without an operator or a second alarm while retaining recent forensic
    // state and all pending/dead work needed for replay semantics.
    const retentionMs = 30 * 24 * 60 * 60 * 1000;
    this.ctx.storage.sql.exec("DELETE FROM cache WHERE expires_at<=?", now);
    this.ctx.storage.sql.exec("DELETE FROM outbox WHERE status IN ('acked','dead') AND updated_at<?", now - retentionMs);
    this.ctx.storage.sql.exec("DELETE FROM restart_events WHERE started_at<?", now - retentionMs);
    this.ctx.storage.sql.exec("UPDATE outbox SET lease_id=NULL, lease_until=NULL, updated_at=? WHERE status='pending' AND lease_until IS NOT NULL AND lease_until<=?", now, now);
    const candidates = this.ctx.storage.sql.exec<{ idempotency_key: string; user_ref: string | null; scope: string; event_type: string; blob: string; attempts: number }>("SELECT idempotency_key,user_ref,scope,event_type,blob,attempts FROM outbox WHERE status='pending' AND available_at<=? AND lease_id IS NULL AND attempts<? ORDER BY created_at ASC LIMIT ?", now, MAX_OUTBOX_ATTEMPTS, limit).toArray();
    const items: ClaimedItem[] = [];
    for (const candidate of candidates) {
      const leaseId = crypto.randomUUID();
      const leaseUntil = now + leaseMs;
      this.ctx.storage.sql.exec("UPDATE outbox SET lease_id=?, lease_until=?, attempts=attempts+1, updated_at=? WHERE idempotency_key=? AND status='pending' AND lease_id IS NULL", leaseId, leaseUntil, now, candidate.idempotency_key);
      items.push({ idempotencyKey: candidate.idempotency_key, ...(candidate.user_ref ? { userRef: candidate.user_ref } : {}), scope: candidate.scope, eventType: candidate.event_type, blob: candidate.blob, attempts: candidate.attempts + 1, leaseId, leaseUntil });
    }
    return json({ items });
  }

  private ackOutbox(command: Record<string, unknown>): Response {
    const rawItems = Array.isArray(command.items) ? command.items : [];
    let acknowledged = 0;
    for (const value of rawItems) {
      if (!value || typeof value !== "object") continue;
      const item = value as Record<string, unknown>;
      const key = optionalBoundedString(item.idempotencyKey, "idempotencyKey");
      if (!key) continue;
      const leaseId = optionalBoundedString(item.leaseId, "leaseId");
      const result = leaseId
        ? this.ctx.storage.sql.exec("UPDATE outbox SET status='acked', lease_id=NULL, lease_until=NULL, updated_at=? WHERE idempotency_key=? AND lease_id=? AND status='pending'", Number(command.now ?? Date.now()), key, leaseId)
        : this.ctx.storage.sql.exec("UPDATE outbox SET status='acked', lease_id=NULL, lease_until=NULL, updated_at=? WHERE idempotency_key=? AND status='pending'", Number(command.now ?? Date.now()), key);
      acknowledged += result.rowsWritten;
    }
    return json({ acknowledged });
  }

  private nackOutbox(command: Record<string, unknown>): Response {
    const rawItems = Array.isArray(command.items) ? command.items : [];
    let retried = 0;
    let dead = 0;
    const now = Number(command.now ?? Date.now());
    for (const value of rawItems) {
      if (!value || typeof value !== "object") continue;
      const item = value as Record<string, unknown>;
      const key = optionalBoundedString(item.idempotencyKey, "idempotencyKey");
      if (!key) continue;
      const leaseId = optionalBoundedString(item.leaseId, "leaseId");
      const retryAfter = Math.min(numberVar(String(item.retryAfterSeconds ?? ""), 60, 1, MAX_RETRY_AFTER_SECONDS), MAX_RETRY_AFTER_SECONDS);
      const errorCode = optionalBoundedString(item.errorCode, "errorCode", 128) ?? "replay_failed";
      const current = this.ctx.storage.sql.exec<{ attempts: number }>("SELECT attempts FROM outbox WHERE idempotency_key=? AND status='pending' AND (? IS NULL OR lease_id=?)", key, leaseId ?? null, leaseId ?? null).toArray()[0];
      if (!current) continue;
      if (current.attempts >= MAX_OUTBOX_ATTEMPTS) {
        this.ctx.storage.sql.exec("UPDATE outbox SET status='dead', lease_id=NULL, lease_until=NULL, last_error=?, updated_at=? WHERE idempotency_key=?", errorCode, now, key);
        dead += 1;
      } else {
        this.ctx.storage.sql.exec("UPDATE outbox SET status='pending', lease_id=NULL, lease_until=NULL, available_at=?, last_error=?, updated_at=? WHERE idempotency_key=? AND status='pending'", now + retryAfter * 1000, errorCode, now, key);
        retried += 1;
      }
    }
    return json({ retried, dead });
  }

  private recordProbe(command: Record<string, unknown>): Response {
    const now = Number(command.now ?? Date.now());
    this.ctx.storage.sql.exec("INSERT INTO meta(key,value) VALUES('last_probe',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", JSON.stringify({ at: now, probe: command.probe }));
    this.ctx.storage.sql.exec("INSERT INTO meta(key,value) VALUES('circuit',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", command.circuit === "closed" ? "closed" : "open");
    return json({ saved: true });
  }

  private acquireRestart(command: Record<string, unknown>): Response {
    const now = Number(command.now ?? Date.now());
    const cooldownMs = numberVar(String(command.cooldownMs ?? ""), DEFAULT_RESTART_COOLDOWN_SECONDS * 1000, 60_000, 86_400_000);
    const windowMs = numberVar(String(command.windowMs ?? ""), DEFAULT_RESTART_WINDOW_SECONDS * 1000, 60_000, 86_400_000);
    const maxRestarts = numberVar(String(command.maxRestarts ?? ""), DEFAULT_MAX_RESTARTS_PER_WINDOW, 1, 5);
    const latest = this.ctx.storage.sql.exec<{ started_at: number }>("SELECT started_at FROM restart_events ORDER BY started_at DESC LIMIT 1").toArray()[0];
    if (latest && latest.started_at + cooldownMs > now) return json({ acquired: false, reason: "cooldown" });
    const count = this.ctx.storage.sql.exec<{ count: number }>("SELECT COUNT(*) AS count FROM restart_events WHERE started_at>?", now - windowMs).toArray()[0]?.count ?? 0;
    if (count >= maxRestarts) return json({ acquired: false, reason: "window_limit" });
    const leaseId = crypto.randomUUID();
    const leaseUntil = now + numberVar(String(command.leaseMs ?? ""), DEFAULT_RESTART_LEASE_SECONDS * 1000, 30_000, 3_600_000);
    this.ctx.storage.sql.exec("INSERT INTO restart_events(lease_id,started_at,lease_until) VALUES(?,?,?)", leaseId, now, leaseUntil);
    this.ctx.storage.sql.exec("INSERT INTO meta(key,value) VALUES('circuit',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", "open");
    return json({ acquired: true, leaseId });
  }

  private completeRestart(command: Record<string, unknown>): Response {
    const leaseId = boundedString(command.leaseId, "leaseId");
    const now = Number(command.now ?? Date.now());
    this.ctx.storage.sql.exec("UPDATE restart_events SET completed_at=?, ok=?, status=?, error_code=? WHERE lease_id=?", now, command.ok === true ? 1 : 0, typeof command.status === "number" ? command.status : null, optionalBoundedString(command.errorCode, "errorCode", 128) ?? null, leaseId);
    return json({ saved: true });
  }

  private health(command: Record<string, unknown>): Response {
    const now = Number(command.now ?? Date.now());
    this.ctx.storage.sql.exec("DELETE FROM nonces WHERE expires_at<=?", now);
    const circuit = this.ctx.storage.sql.exec<{ value: string }>("SELECT value FROM meta WHERE key='circuit'").toArray()[0]?.value ?? "closed";
    const lastProbeRaw = this.ctx.storage.sql.exec<{ value: string }>("SELECT value FROM meta WHERE key='last_probe'").toArray()[0]?.value;
    const latestRestart = this.ctx.storage.sql.exec<{ started_at: number; completed_at: number | null; ok: number | null; status: number | null }>("SELECT started_at,completed_at,ok,status FROM restart_events ORDER BY started_at DESC LIMIT 1").toArray()[0];
    const pending = this.ctx.storage.sql.exec<{ count: number }>("SELECT COUNT(*) AS count FROM outbox WHERE status='pending'").toArray()[0]?.count ?? 0;
    const dead = this.ctx.storage.sql.exec<{ count: number }>("SELECT COUNT(*) AS count FROM outbox WHERE status='dead'").toArray()[0]?.count ?? 0;
    return json({ circuit: (circuit === "open" || circuit === "half_open" ? circuit : "closed") as Circuit, lastProbe: lastProbeRaw ? JSON.parse(lastProbeRaw) : null, lastRestart: latestRestart ?? null, outbox: { pending, dead } });
  }
}

export default {
  async fetch(request: Request, env: RuntimeEnv): Promise<Response> {
    return handleRequest(request, env);
  },
  async scheduled(_controller: ScheduledController, env: RuntimeEnv, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil((async () => {
      try {
        await watchdogRun(env);
        await replayOutbox(env);
      } catch (error) {
        log("error", "scheduled_run_failed", { reason: error instanceof Error ? error.message : "unknown" });
      }
    })());
  },
} satisfies ExportedHandler<RuntimeEnv>;
