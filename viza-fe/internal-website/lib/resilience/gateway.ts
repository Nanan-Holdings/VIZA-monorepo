import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

const SIGNATURE_WINDOW_SECONDS = 300;
const REQUEST_TIMEOUT_MS = 3_000;

type EncryptedEnvelope = {
  v: 1;
  alg: "A256GCM";
  iv: string;
  tag: string;
  ciphertext: string;
};

type GatewayConfig = {
  baseUrl: string;
  keyId: string;
  hmacSecret: string;
  dataKey: Buffer;
};

function readConfig(): GatewayConfig | null {
  const baseUrl = process.env.VIZA_RESILIENCE_GATEWAY_URL?.trim().replace(/\/$/, "");
  const keyId = process.env.VIZA_RESILIENCE_HMAC_KEY_ID?.trim();
  const hmacSecret = process.env.VIZA_RESILIENCE_HMAC_SECRET?.trim();
  const encodedKey = process.env.VIZA_RESILIENCE_DATA_KEY?.trim();
  if (!baseUrl || !keyId || !hmacSecret || !encodedKey) return null;

  const dataKey = Buffer.from(encodedKey, "base64");
  if (dataKey.length !== 32) {
    throw new Error("VIZA_RESILIENCE_DATA_KEY must be a base64-encoded 32-byte key");
  }
  if (hmacSecret.length < 32) {
    throw new Error("VIZA_RESILIENCE_HMAC_SECRET must be at least 32 characters");
  }
  return { baseUrl, keyId, hmacSecret, dataKey };
}

export function isResilienceGatewayConfigured(): boolean {
  return readConfig() !== null;
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function createSignature({
  secret,
  method,
  path,
  timestamp,
  nonce,
  rawBody,
}: {
  secret: string;
  method: string;
  path: string;
  timestamp: string;
  nonce: string;
  rawBody: string;
}): string {
  const canonical = [method.toUpperCase(), path, timestamp, nonce, sha256Hex(rawBody)].join("\n");
  return createHmac("sha256", secret).update(canonical).digest("hex");
}

export function encryptResilienceValue(value: unknown, encodedKey?: string): string {
  const dataKey = encodedKey ? Buffer.from(encodedKey, "base64") : readConfig()?.dataKey;
  if (!dataKey || dataKey.length !== 32) throw new Error("Resilience data key is unavailable");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", dataKey, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const envelope: EncryptedEnvelope = {
    v: 1,
    alg: "A256GCM",
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
  return Buffer.from(JSON.stringify(envelope), "utf8").toString("base64");
}

export function decryptResilienceValue<T>(blob: string, encodedKey?: string): T {
  const dataKey = encodedKey ? Buffer.from(encodedKey, "base64") : readConfig()?.dataKey;
  if (!dataKey || dataKey.length !== 32) throw new Error("Resilience data key is unavailable");
  const envelope = JSON.parse(Buffer.from(blob, "base64").toString("utf8")) as EncryptedEnvelope;
  if (envelope.v !== 1 || envelope.alg !== "A256GCM") throw new Error("Unsupported resilience envelope");
  const decipher = createDecipheriv("aes-256-gcm", dataKey, Buffer.from(envelope.iv, "base64"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString("utf8")) as T;
}

async function gatewayPost<T>(path: string, body: unknown): Promise<T> {
  const config = readConfig();
  if (!config) throw new Error("VIZA resilience gateway is not configured");
  const rawBody = JSON.stringify(body);
  const timestamp = String(Math.floor(Date.now() / 1_000));
  const nonce = randomUUID();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${config.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Viza-Key-Id": config.keyId,
        "X-Viza-Timestamp": timestamp,
        "X-Viza-Nonce": nonce,
        "X-Viza-Signature": createSignature({
          secret: config.hmacSecret,
          method: "POST",
          path,
          timestamp,
          nonce,
          rawBody,
        }),
      },
      body: rawBody,
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Resilience gateway returned ${response.status}`);
    return await response.json() as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function putResilienceCache(input: {
  userRef: string;
  scope: string;
  key: string;
  value: unknown;
  ttlSeconds: number;
  oneTime?: boolean;
}): Promise<void> {
  await gatewayPost("/v1/cache/put", {
    userRef: input.userRef,
    scope: input.scope,
    key: input.key,
    blob: encryptResilienceValue(input.value),
    ttlSeconds: input.ttlSeconds,
    oneTime: input.oneTime ?? false,
  });
}

export async function getResilienceCache<T>(input: {
  userRef: string;
  scope: string;
  key: string;
}): Promise<T | null> {
  const result = await gatewayPost<{ hit: boolean; blob?: string }>("/v1/cache/get", input);
  return result.hit && result.blob ? decryptResilienceValue<T>(result.blob) : null;
}

export async function consumeResilienceCache<T>(input: {
  userRef: string;
  scope: string;
  key: string;
}): Promise<T | null> {
  const result = await gatewayPost<{ hit: boolean; blob?: string }>("/v1/cache/consume", input);
  return result.hit && result.blob ? decryptResilienceValue<T>(result.blob) : null;
}

export async function enqueueResilienceEvent(input: {
  idempotencyKey: string;
  userRef: string;
  scope: string;
  eventType: string;
  value: unknown;
}): Promise<{ accepted: boolean; duplicate: boolean }> {
  const result = await gatewayPost<{ accepted: boolean; duplicate: boolean }>("/v1/outbox/enqueue", {
    idempotencyKey: input.idempotencyKey,
    userRef: input.userRef,
    scope: input.scope,
    eventType: input.eventType,
    blob: encryptResilienceValue(input.value),
  });
  return result;
}

const replayNonces = new Map<string, number>();

export function verifyReplaySignature(request: Request, rawBody: string): boolean {
  const config = readConfig();
  if (!config) return false;
  const keyId = request.headers.get("X-Viza-Key-Id") ?? "";
  const timestamp = request.headers.get("X-Viza-Timestamp") ?? "";
  const nonce = request.headers.get("X-Viza-Nonce") ?? "";
  const signature = request.headers.get("X-Viza-Signature") ?? "";
  const now = Math.floor(Date.now() / 1_000);
  const parsedTimestamp = Number(timestamp);
  if (
    keyId !== config.keyId ||
    !nonce ||
    !Number.isFinite(parsedTimestamp) ||
    Math.abs(now - parsedTimestamp) > SIGNATURE_WINDOW_SECONDS ||
    replayNonces.has(nonce)
  ) return false;

  const expected = createSignature({
    secret: config.hmacSecret,
    method: request.method,
    path: new URL(request.url).pathname,
    timestamp,
    nonce,
    rawBody,
  });
  const actualBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    return false;
  }

  replayNonces.set(nonce, now);
  for (const [seenNonce, seenAt] of replayNonces) {
    if (now - seenAt > SIGNATURE_WINDOW_SECONDS) replayNonces.delete(seenNonce);
  }
  return true;
}
