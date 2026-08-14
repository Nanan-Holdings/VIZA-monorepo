import {
  createHash,
  createHmac,
  randomUUID,
} from "node:crypto";

const DEFAULT_CAPACITY = 1;
const MAX_CAPACITY = 1_000;
const MIN_LEASE_SECONDS = 1;
const MAX_LEASE_SECONDS = 60 * 60;
const REQUEST_TIMEOUT_MS = 3_000;

const ACQUIRE_PATH = "/v1/concurrency/acquire";
const RENEW_PATH = "/v1/concurrency/renew";
const RELEASE_PATH = "/v1/concurrency/release";

type EnvLike = NodeJS.ProcessEnv;

export interface GateLease {
  scope: string;
  resourceKey: string;
  leaseId: string;
  fencingToken: number;
  leaseUntil: number;
}

export interface AcquireResilienceGateInput {
  scope: string;
  resourceKey: string;
  capacity?: number;
  leaseSeconds: number;
  ownerRef: string;
}

export class ResilienceGateOwnershipLostError extends Error {
  readonly code = "resilience_gate_ownership_lost";

  constructor(message = "Resilience gate lease ownership was lost") {
    super(message);
    this.name = "ResilienceGateOwnershipLostError";
  }
}

export class ResilienceGateConfigurationError extends Error {
  readonly code = "resilience_gate_configuration_invalid";

  constructor(message: string) {
    super(message);
    this.name = "ResilienceGateConfigurationError";
  }
}

export class ResilienceGateResponseError extends Error {
  readonly code = "resilience_gate_response_invalid";

  constructor(message = "Invalid resilience gate response") {
    super(message);
    this.name = "ResilienceGateResponseError";
  }
}

interface ClientOptions {
  env?: EnvLike;
  fetchImpl?: typeof fetch;
  now?: () => number;
  nonceFactory?: () => string;
  requestTimeoutMs?: number;
  /** Only test doubles may opt into an HTTP endpoint. */
  allowInsecureHttpForTests?: boolean;
}

interface GateConfig {
  gatewayUrl: URL;
  keyId: string;
  secret: string;
  capacity: number;
}

interface HttpResult {
  response: Response;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new TypeError(`${field} must be a string`);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new RangeError(`${field} is invalid`);
  }
  return normalized;
}

function positiveInteger(value: unknown, field: string, maximum: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new RangeError(`${field} is invalid`);
  }
  return value;
}

function readCapacity(value: unknown, fallback: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > MAX_CAPACITY) return fallback;
  return parsed;
}

function isEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

function readConfig(options: ClientOptions): GateConfig | null {
  const env = options.env ?? process.env;
  if (!isEnabled(env.RESILIENCE_VN_STATUS_GATE_ENABLED)) return null;

  const rawUrl = env.VIZA_RESILIENCE_GATEWAY_URL?.trim();
  const keyId = env.VIZA_RESILIENCE_HMAC_KEY_ID?.trim();
  const secret = env.VIZA_RESILIENCE_HMAC_SECRET;
  if (!rawUrl || !keyId || !secret) return null;

  let gatewayUrl: URL;
  try {
    gatewayUrl = new URL(rawUrl);
  } catch {
    throw new ResilienceGateConfigurationError("VIZA_RESILIENCE_GATEWAY_URL is invalid");
  }
  if (
    gatewayUrl.protocol !== "https:" &&
    !(options.allowInsecureHttpForTests === true && gatewayUrl.protocol === "http:")
  ) {
    throw new ResilienceGateConfigurationError("VIZA_RESILIENCE_GATEWAY_URL must use https");
  }
  if (gatewayUrl.username || gatewayUrl.password) {
    throw new ResilienceGateConfigurationError("VIZA_RESILIENCE_GATEWAY_URL must not contain credentials");
  }
  return {
    gatewayUrl,
    keyId: boundedString(keyId, "VIZA_RESILIENCE_HMAC_KEY_ID", 128),
    secret,
    capacity: readCapacity(env.RESILIENCE_VN_STATUS_GATE_CAPACITY, DEFAULT_CAPACITY),
  };
}

function validateScope(scope: unknown): string {
  return boundedString(scope, "scope", 128).toLowerCase();
}

function validateResourceKey(resourceKey: unknown): string {
  return boundedString(resourceKey, "resourceKey", 256).toLowerCase();
}

function validateLeaseSeconds(value: unknown): number {
  return positiveInteger(value, "leaseSeconds", MAX_LEASE_SECONDS);
}

function validateOwnerRef(value: unknown): string {
  return boundedString(value, "ownerRef", 256);
}

function expectedShard(scope: string, resourceKey: string): string {
  return `v1:${encodeURIComponent(scope)}:${encodeURIComponent(resourceKey)}`;
}

function operationUrl(config: GateConfig, path: string): URL {
  const url = new URL(path, config.gatewayUrl);
  if (url.pathname !== path) {
    throw new ResilienceGateConfigurationError("Resilience gate operation path is invalid");
  }
  return url;
}

function canonicalSignature(
  method: string,
  url: URL,
  timestamp: string,
  nonce: string,
  rawBody: string,
  secret: string,
): string {
  const bodyHash = createHash("sha256").update(rawBody).digest("hex");
  const canonical = [method, url.pathname, timestamp, nonce, bodyHash].join("\n");
  return createHmac("sha256", secret).update(canonical).digest("hex");
}

function responseObject(payload: unknown): Record<string, unknown> {
  if (!isRecord(payload)) throw new ResilienceGateResponseError();
  return payload;
}

function leaseField(payload: Record<string, unknown>, field: string): string {
  if (typeof payload[field] !== "string" || payload[field].length === 0 || payload[field].length > 256) {
    throw new ResilienceGateResponseError();
  }
  return payload[field];
}

function fencingField(payload: Record<string, unknown>): number {
  const value = payload.fencingToken;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new ResilienceGateResponseError();
  }
  return value;
}

function leaseUntilField(payload: Record<string, unknown>): number {
  const value = payload.leaseUntil;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new ResilienceGateResponseError();
  }
  return value;
}

function validateGateLease(lease: GateLease): {
  scope: string;
  resourceKey: string;
  leaseId: string;
  fencingToken: number;
} {
  if (!isRecord(lease)) throw new TypeError("lease is invalid");
  const scope = validateScope(lease.scope);
  const resourceKey = validateResourceKey(lease.resourceKey);
  const leaseId = leaseField(lease, "leaseId");
  const fencingToken = fencingField(lease);
  leaseUntilField(lease);
  return { scope, resourceKey, leaseId, fencingToken };
}

async function sendRequest(
  config: GateConfig,
  options: ClientOptions,
  path: string,
  body: Record<string, unknown>,
): Promise<HttpResult | null> {
  const url = operationUrl(config, path);
  const rawBody = JSON.stringify(body);
  const timestamp = Math.floor((options.now?.() ?? Date.now()) / 1_000).toString();
  const nonce = options.nonceFactory?.() ?? randomUUID();
  boundedString(nonce, "nonce", 256);
  const signature = canonicalSignature(
    "POST",
    url,
    timestamp,
    nonce,
    rawBody,
    config.secret,
  );
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    options.requestTimeoutMs ?? REQUEST_TIMEOUT_MS,
  );
  try {
    const fetchImpl = options.fetchImpl ?? fetch;
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Viza-Key-Id": config.keyId,
        "X-Viza-Timestamp": timestamp,
        "X-Viza-Nonce": nonce,
        "X-Viza-Signature": signature,
      },
      body: rawBody,
      signal: controller.signal,
    });
    return { response };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function parseResponse(result: HttpResult): Promise<Record<string, unknown>> {
  let payload: unknown;
  try {
    payload = await result.response.json();
  } catch {
    throw new ResilienceGateResponseError();
  }
  return responseObject(payload);
}

export interface ResilienceGateClient {
  acquire(input: AcquireResilienceGateInput): Promise<GateLease | null>;
  renew(lease: GateLease, leaseSeconds: number): Promise<GateLease | null>;
  release(lease: GateLease): Promise<boolean>;
}

export function createResilienceGateClient(options: ClientOptions = {}): ResilienceGateClient {
  async function acquire(input: AcquireResilienceGateInput): Promise<GateLease | null> {
    let config: GateConfig | null;
    try {
      config = readConfig(options);
    } catch {
      return null;
    }
    if (!config) return null;
    const scope = validateScope(input.scope);
    const resourceKey = validateResourceKey(input.resourceKey);
    const capacity = input.capacity === undefined
      ? config.capacity
      : positiveInteger(input.capacity, "capacity", MAX_CAPACITY);
    const leaseSeconds = validateLeaseSeconds(input.leaseSeconds);
    const ownerRef = validateOwnerRef(input.ownerRef);
    const result = await sendRequest(config, options, ACQUIRE_PATH, {
      scope,
      resourceKey,
      capacity,
      leaseSeconds,
      ownerRef,
    });
    if (!result || result.response.status === 429 || result.response.status === 503 || result.response.status >= 500) {
      return null;
    }
    if (!result.response.ok) {
      throw new ResilienceGateResponseError();
    }
    const payload = await parseResponse(result);
    if (payload.ok !== true || typeof payload.acquired !== "boolean") {
      throw new ResilienceGateResponseError();
    }
    if (!payload.acquired) return null;
    if (typeof payload.shard !== "string" || payload.shard !== expectedShard(scope, resourceKey)) {
      throw new ResilienceGateResponseError();
    }
    const leaseId = leaseField(payload, "leaseId");
    const fencingToken = fencingField(payload);
    const leaseUntil = leaseUntilField(payload);
    return { scope, resourceKey, leaseId, fencingToken, leaseUntil };
  }

  async function renew(lease: GateLease, leaseSeconds: number): Promise<GateLease | null> {
    let config: GateConfig | null;
    try {
      config = readConfig(options);
    } catch {
      return null;
    }
    if (!config) return null;
    const { scope, resourceKey, leaseId, fencingToken } = validateGateLease(lease);
    const validLeaseSeconds = validateLeaseSeconds(leaseSeconds);
    const result = await sendRequest(config, options, RENEW_PATH, {
      scope,
      resourceKey,
      leaseId,
      fencingToken,
      leaseSeconds: validLeaseSeconds,
    });
    if (!result) return null;
    if (result.response.status === 429 || result.response.status === 503 || result.response.status >= 500) {
      return null;
    }
    if (!result.response.ok) {
      throw new ResilienceGateOwnershipLostError();
    }
    const payload = await parseResponse(result);
    if (payload.ok !== true || typeof payload.renewed !== "boolean") {
      throw new ResilienceGateResponseError();
    }
    if (!payload.renewed) throw new ResilienceGateOwnershipLostError();
    const renewedFencingToken = fencingField(payload);
    if (renewedFencingToken !== fencingToken) throw new ResilienceGateOwnershipLostError();
    return {
      scope,
      resourceKey,
      leaseId,
      fencingToken,
      leaseUntil: leaseUntilField(payload),
    };
  }

  async function release(lease: GateLease): Promise<boolean> {
    let config: GateConfig | null;
    try {
      config = readConfig(options);
    } catch {
      return false;
    }
    if (!config) return false;
    const { scope, resourceKey, leaseId, fencingToken } = validateGateLease(lease);
    const result = await sendRequest(config, options, RELEASE_PATH, {
      scope,
      resourceKey,
      leaseId,
      fencingToken,
    });
    if (!result || result.response.status === 429 || result.response.status === 503 || result.response.status >= 500) {
      return false;
    }
    if (!result.response.ok) return false;
    const payload = await parseResponse(result);
    if (payload.ok !== true || typeof payload.released !== "boolean") {
      throw new ResilienceGateResponseError();
    }
    return payload.released;
  }

  return { acquire, renew, release };
}

const defaultClient = createResilienceGateClient();

export function acquireResilienceGate(input: AcquireResilienceGateInput): Promise<GateLease | null> {
  return defaultClient.acquire(input);
}

export function renewResilienceGate(lease: GateLease, leaseSeconds: number): Promise<GateLease | null> {
  return defaultClient.renew(lease, leaseSeconds);
}

export function releaseResilienceGate(lease: GateLease): Promise<boolean> {
  return defaultClient.release(lease);
}

export const RESILIENCE_GATE_REQUEST_TIMEOUT_MS = REQUEST_TIMEOUT_MS;
