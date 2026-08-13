import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "./index";

const secret = "test-only-secret";
const keyId = "primary";

async function sign(path: string, body: string, timestamp = Math.floor(Date.now() / 1000).toString(), nonce = crypto.randomUUID()): Promise<Headers> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signatureBytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`POST\n${path}\n${timestamp}\n${nonce}\n${hash}`));
  const signature = [...new Uint8Array(signatureBytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return new Headers({ "Content-Type": "application/json", "X-Viza-Key-Id": keyId, "X-Viza-Timestamp": timestamp, "X-Viza-Nonce": nonce, "X-Viza-Signature": signature });
}

async function request(path: string, value: Record<string, unknown>, nonce?: string): Promise<Response> {
  const body = JSON.stringify(value);
  const headers = await sign(path, body, undefined, nonce);
  return worker.fetch(new Request(`https://worker.test${path}`, { method: "POST", headers, body }), env);
}

describe("resilience gateway", () => {
  it("exposes a secret-free read-only health endpoint", async () => {
    const response = await worker.fetch(new Request("https://worker.test/health"), env);
    expect(response.status).toBe(200);
    const payload = await response.json() as Record<string, unknown>;
    expect(payload).toMatchObject({ ok: true, service: "viza-resilience-worker" });
    expect(JSON.stringify(payload)).not.toContain("test-only-secret");
  });

  it("requires HMAC and rejects a replayed nonce", async () => {
    const body = { userRef: "u-test", scope: "auth", key: "otp", blob: "encrypted", ttlSeconds: 60 };
    const unauthorized = await worker.fetch(new Request("https://worker.test/v1/cache/put", { method: "POST", body: JSON.stringify(body) }), env);
    expect(unauthorized.status).toBe(401);
    const nonce = crypto.randomUUID();
    const first = await request("/v1/cache/put", body, nonce);
    expect(first.status).toBe(200);
    const replay = await request("/v1/cache/put", body, nonce);
    expect(replay.status).toBe(409);
  });

  it("atomically consumes a one-time cache value under concurrency", async () => {
    await request("/v1/cache/put", { userRef: "u-consume", scope: "auth", key: "otp", blob: "ciphertext", ttlSeconds: 60, oneTime: true });
    const responses = await Promise.all([
      request("/v1/cache/consume", { userRef: "u-consume", scope: "auth", key: "otp" }),
      request("/v1/cache/consume", { userRef: "u-consume", scope: "auth", key: "otp" }),
    ]);
    const payloads = await Promise.all(responses.map((response) => response.json() as Promise<{ hit: boolean; blob?: string }>));
    expect(payloads.filter((payload) => payload.hit && payload.blob === "ciphertext")).toHaveLength(1);
    expect(payloads.filter((payload) => !payload.hit)).toHaveLength(1);
  });

  it("deduplicates outbox events and returns encrypted blobs without parsing", async () => {
    const item = { idempotencyKey: "event-1", userRef: "u-test", scope: "application", eventType: "write", blob: "{encrypted:blob}" };
    const first = await request("/v1/outbox/enqueue", item);
    const duplicate = await request("/v1/outbox/enqueue", item);
    expect((await first.json() as { accepted: boolean }).accepted).toBe(true);
    expect((await duplicate.json() as { duplicate: boolean }).duplicate).toBe(true);
    const claimed = await request("/v1/outbox/claim", { limit: 1, leaseSeconds: 60 });
    const payload = await claimed.json() as { items: Array<{ idempotencyKey: string; blob: string; leaseId: string; attempts: number }> };
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0]).toMatchObject({ idempotencyKey: "event-1", blob: "{encrypted:blob}", attempts: 1 });
    expect(payload.items[0].leaseId).toEqual(expect.any(String));
  });
});
