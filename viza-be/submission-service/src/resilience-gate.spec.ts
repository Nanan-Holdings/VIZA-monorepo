import assert from "node:assert/strict";
import test from "node:test";
import { createHash, createHmac } from "node:crypto";

import {
  acquireResilienceGate,
  releaseResilienceGate,
  renewResilienceGate,
  RESILIENCE_GATE_REQUEST_TIMEOUT_MS,
  ResilienceGateOwnershipLostError,
  type GateLease,
} from "./resilience-gate.js";

const envKeys = [
  "VIZA_RESILIENCE_GATEWAY_URL",
  "VIZA_RESILIENCE_HMAC_KEY_ID",
  "VIZA_RESILIENCE_HMAC_SECRET",
  "RESILIENCE_VN_STATUS_GATE_ENABLED",
  "RESILIENCE_VN_STATUS_GATE_CAPACITY",
] as const;

function withEnv(values: Partial<Record<(typeof envKeys)[number], string | undefined>>): void {
  for (const key of envKeys) {
    const value = values[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function enabledEnv(): void {
  withEnv({
    VIZA_RESILIENCE_GATEWAY_URL: "https://gateway.example.test",
    VIZA_RESILIENCE_HMAC_KEY_ID: "viza-test-key",
    VIZA_RESILIENCE_HMAC_SECRET: "test-secret",
    RESILIENCE_VN_STATUS_GATE_ENABLED: "true",
    RESILIENCE_VN_STATUS_GATE_CAPACITY: "1",
  });
}

function response(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("gate requests use the bounded three-second abort timeout", () => {
  assert.equal(RESILIENCE_GATE_REQUEST_TIMEOUT_MS, 3_000);
});

test("acquire signs the exact request body and returns a fenced lease", async () => {
  enabledEnv();
  let seenRequest: Request | undefined;
  const leaseUntil = Date.now() + 120_000;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    seenRequest = new Request(input, init);
    return response({
      ok: true,
      shard: "v1:vietnam:evisa%2Fstatus",
      acquired: true,
      capacity: 1,
      active: 1,
      leaseId: "lease-1",
      fencingToken: 7,
      leaseUntil,
    });
  };
  try {
    const lease = await acquireResilienceGate({
      scope: "vietnam",
      resourceKey: "evisa/status",
      capacity: 1,
      leaseSeconds: 120,
      ownerRef: "worker-1",
    });
    assert.deepEqual(lease, {
      scope: "vietnam",
      resourceKey: "evisa/status",
      leaseId: "lease-1",
      fencingToken: 7,
      leaseUntil,
    });
    assert.ok(seenRequest);
    assert.equal(seenRequest.method, "POST");
    assert.equal(new URL(seenRequest.url).pathname, "/v1/concurrency/acquire");
    const rawBody = await seenRequest.text();
    const timestamp = seenRequest.headers.get("X-Viza-Timestamp");
    const nonce = seenRequest.headers.get("X-Viza-Nonce");
    assert.ok(timestamp);
    assert.ok(nonce);
    const bodyHash = createHash("sha256").update(rawBody).digest("hex");
    const canonical = ["POST", "/v1/concurrency/acquire", timestamp, nonce, bodyHash].join("\n");
    const expected = createHmac("sha256", "test-secret").update(canonical).digest("hex");
    assert.equal(seenRequest.headers.get("X-Viza-Key-Id"), "viza-test-key");
    assert.equal(seenRequest.headers.get("X-Viza-Signature"), expected);
    assert.deepEqual(JSON.parse(rawBody), {
      scope: "vietnam",
      resourceKey: "evisa/status",
      capacity: 1,
      leaseSeconds: 120,
      ownerRef: "worker-1",
    });
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("disabled acquire is a no-op and does not call the gateway", async () => {
  withEnv({ RESILIENCE_VN_STATUS_GATE_ENABLED: "false" });
  const previousFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return response({});
  };
  try {
    assert.equal(
      await acquireResilienceGate({
        scope: "vietnam",
        resourceKey: "evisa/status",
        capacity: 1,
        leaseSeconds: 120,
        ownerRef: "worker-1",
      }),
      null,
    );
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("invalid capacity configuration falls back to the bounded default", async () => {
  enabledEnv();
  process.env.RESILIENCE_VN_STATUS_GATE_CAPACITY = "not-a-number";
  let seenBody: Record<string, unknown> | undefined;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    seenBody = JSON.parse(await request.text()) as Record<string, unknown>;
    return response({
      ok: true,
      shard: "v1:vietnam:evisa%2Fstatus",
      acquired: false,
      capacity: 1,
      active: 1,
    });
  };
  try {
    await acquireResilienceGate({
      scope: "vietnam",
      resourceKey: "evisa/status",
      leaseSeconds: 120,
      ownerRef: "worker-1",
    });
    assert.equal(seenBody?.capacity, 1);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("production gate configuration refuses an http gateway", async () => {
  enabledEnv();
  process.env.VIZA_RESILIENCE_GATEWAY_URL = "http://gateway.example.test";
  const previousFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return response({});
  };
  try {
    assert.equal(
      await acquireResilienceGate({
        scope: "vietnam",
        resourceKey: "evisa/status",
        capacity: 1,
        leaseSeconds: 120,
        ownerRef: "worker-1",
      }),
      null,
    );
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("temporary acquire responses fail open without a lease", async () => {
  enabledEnv();
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    const request = new Request(_input, init);
    return response({}, request.url.endsWith("/acquire") ? 429 : 503);
  };
  try {
    assert.equal(
      await acquireResilienceGate({
        scope: "vietnam",
        resourceKey: "evisa/status",
        capacity: 1,
        leaseSeconds: 120,
        ownerRef: "worker-1",
      }),
      null,
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("renew rejects stale ownership and validates the response shape", async () => {
  enabledEnv();
  const lease: GateLease = {
    scope: "vietnam",
    resourceKey: "evisa/status",
    leaseId: "lease-1",
    fencingToken: 7,
    leaseUntil: Date.now() + 120_000,
  };
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => response({ ok: true, renewed: false, reason: "stale_lease" });
  try {
    await assert.rejects(
      renewResilienceGate(lease, 120),
      (error: unknown) => error instanceof ResilienceGateOwnershipLostError,
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("release sends the exact lease and fencing token", async () => {
  enabledEnv();
  const lease: GateLease = {
    scope: "vietnam",
    resourceKey: "evisa/status",
    leaseId: "lease-1",
    fencingToken: 7,
    leaseUntil: Date.now() + 120_000,
  };
  let seenBody: Record<string, unknown> | undefined;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    seenBody = JSON.parse(await request.text()) as Record<string, unknown>;
    return response({ ok: true, released: true });
  };
  try {
    assert.equal(await releaseResilienceGate(lease), true);
    assert.deepEqual(seenBody, {
      scope: "vietnam",
      resourceKey: "evisa/status",
      leaseId: "lease-1",
      fencingToken: 7,
    });
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("malformed acquire responses are rejected", async () => {
  enabledEnv();
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => response({ ok: true, acquired: true, leaseId: "missing-fields" });
  try {
    await assert.rejects(
      acquireResilienceGate({
        scope: "vietnam",
        resourceKey: "evisa/status",
        capacity: 1,
        leaseSeconds: 120,
        ownerRef: "worker-1",
      }),
      /invalid resilience gate response/i,
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});
