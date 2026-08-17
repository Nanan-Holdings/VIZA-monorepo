import assert from "node:assert/strict";
import test from "node:test";
import { createHash, createHmac } from "node:crypto";

import {
  acquireResilienceGate,
  createResilienceGateClient,
  releaseResilienceGate,
  renewResilienceGate,
  RESILIENCE_GATE_REQUEST_TIMEOUT_MS,
  ResilienceGateCapacityDeniedError,
  ResilienceGateConfigurationError,
  ResilienceGateOwnershipLostError,
  ResilienceGateResponseError,
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

test("missing capacity configuration uses the bounded default", async () => {
  enabledEnv();
  delete process.env.RESILIENCE_VN_STATUS_GATE_CAPACITY;
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
      reason: "at_capacity",
    });
  };
  try {
    await assert.rejects(
      acquireResilienceGate({
        scope: "vietnam",
        resourceKey: "evisa/status",
        leaseSeconds: 120,
        ownerRef: "worker-1",
      }),
      ResilienceGateCapacityDeniedError,
    );
    assert.equal(seenBody?.capacity, 1);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("invalid capacity configuration fails loudly before fetch", async () => {
  enabledEnv();
  process.env.RESILIENCE_VN_STATUS_GATE_CAPACITY = "not-a-number";
  const previousFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return response({});
  };
  try {
    await assert.rejects(
      acquireResilienceGate({
        scope: "vietnam",
        resourceKey: "evisa/status",
        leaseSeconds: 120,
        ownerRef: "worker-1",
      }),
      ResilienceGateConfigurationError,
    );
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("production gate configuration refuses an http gateway", async () => {
  enabledEnv();
  process.env.VIZA_RESILIENCE_GATEWAY_URL = "http://gateway.example.test";
  const { ResilienceGateConfigurationError } = await import("./resilience-gate.js");
  const previousFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return response({});
  };
  try {
    await assert.rejects(
      acquireResilienceGate({
        scope: "vietnam",
        resourceKey: "evisa/status",
        capacity: 1,
        leaseSeconds: 120,
        ownerRef: "worker-1",
      }),
      (error: unknown) => error instanceof ResilienceGateConfigurationError,
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

test("503 acquire responses fail open without a lease", async () => {
  enabledEnv();
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => response({}, 503);
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

test("network acquire failures fail open without a lease", async () => {
  enabledEnv();
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("network unavailable");
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

test("capacity denial is typed and preserves the retry hint", async () => {
  enabledEnv();
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => response({
    ok: true,
    acquired: false,
    reason: "at_capacity",
    retryAt: 1_800_000_000_000,
  });
  try {
    await assert.rejects(
      acquireResilienceGate({
        scope: "vietnam",
        resourceKey: "evisa/status",
        capacity: 1,
        leaseSeconds: 120,
        ownerRef: "worker-1",
      }),
      (error: unknown) =>
        error instanceof ResilienceGateCapacityDeniedError &&
        error.reason === "at_capacity" &&
        error.retryAt === 1_800_000_000_000,
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("capacity mismatch denial is typed without exposing response details", async () => {
  enabledEnv();
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => response({ ok: true, acquired: false, reason: "capacity_mismatch" });
  try {
    await assert.rejects(
      acquireResilienceGate({
        scope: "vietnam",
        resourceKey: "evisa/status",
        capacity: 1,
        leaseSeconds: 120,
        ownerRef: "worker-1",
      }),
      (error: unknown) =>
        error instanceof ResilienceGateCapacityDeniedError &&
        error.reason === "capacity_mismatch" &&
        error.retryAt === undefined &&
        !error.message.includes("owner"),
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("unknown capacity denial reasons fail response validation", async () => {
  enabledEnv();
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => response({ ok: true, acquired: false, reason: "busy" });
  try {
    await assert.rejects(
      acquireResilienceGate({
        scope: "vietnam",
        resourceKey: "evisa/status",
        capacity: 1,
        leaseSeconds: 120,
        ownerRef: "worker-1",
      }),
      ResilienceGateResponseError,
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("enabled gate with missing configuration fails closed", async () => {
  withEnv({
    RESILIENCE_VN_STATUS_GATE_ENABLED: "true",
    VIZA_RESILIENCE_GATEWAY_URL: undefined,
    VIZA_RESILIENCE_HMAC_KEY_ID: "viza-test-key",
    VIZA_RESILIENCE_HMAC_SECRET: "test-secret",
  });
  await assert.rejects(
    acquireResilienceGate({
      scope: "vietnam",
      resourceKey: "evisa/status",
      capacity: 1,
      leaseSeconds: 120,
      ownerRef: "worker-1",
    }),
    (error: unknown) => error instanceof ResilienceGateConfigurationError,
  );
});

test("each required enabled-gate secret fails closed when absent", async () => {
  for (const missing of [
    "VIZA_RESILIENCE_GATEWAY_URL",
    "VIZA_RESILIENCE_HMAC_KEY_ID",
    "VIZA_RESILIENCE_HMAC_SECRET",
  ] as const) {
    enabledEnv();
    delete process.env[missing];
    await assert.rejects(
      acquireResilienceGate({
        scope: "vietnam",
        resourceKey: "evisa/status",
        capacity: 1,
        leaseSeconds: 120,
        ownerRef: "worker-1",
      }),
      ResilienceGateConfigurationError,
    );
  }
});

test("non-retryable and malformed responses fail with typed response errors", async () => {
  enabledEnv();
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => response({ ok: false, error: "unauthorized" }, 401);
  try {
    await assert.rejects(
      acquireResilienceGate({
        scope: "vietnam",
        resourceKey: "evisa/status",
        capacity: 1,
        leaseSeconds: 120,
        ownerRef: "worker-1",
      }),
      (error: unknown) => error instanceof ResilienceGateResponseError,
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
  const malformedFetch = globalThis.fetch;
  globalThis.fetch = async () => response({ ok: true, acquired: true });
  try {
    await assert.rejects(
      acquireResilienceGate({
        scope: "vietnam",
        resourceKey: "evisa/status",
        capacity: 1,
        leaseSeconds: 120,
        ownerRef: "worker-1",
      }),
      (error: unknown) => error instanceof ResilienceGateResponseError,
    );
  } finally {
    globalThis.fetch = malformedFetch;
  }
});

test("acquire aborts a hanging transport with an injectable short timeout", async () => {
  enabledEnv();
  let aborted = false;
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  let timeoutCleared = false;
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  globalThis.setTimeout = ((callback: () => void, delay?: number) => {
    timeoutHandle = originalSetTimeout(callback, delay);
    return timeoutHandle;
  }) as typeof setTimeout;
  globalThis.clearTimeout = ((value: ReturnType<typeof setTimeout>) => {
    if (value === timeoutHandle) timeoutCleared = true;
    originalClearTimeout(value);
  }) as typeof clearTimeout;
  const client = createResilienceGateClient({
    requestTimeoutMs: 10,
    fetchImpl: async (_input, init) => {
      await new Promise<void>((resolve) => {
        init?.signal?.addEventListener("abort", () => {
          aborted = true;
          resolve();
        }, { once: true });
      });
      return response({}, 503);
    },
  });
  try {
    const lease = await client.acquire({
      scope: "vietnam",
      resourceKey: "evisa/status",
      capacity: 1,
      leaseSeconds: 120,
      ownerRef: "worker-1",
    });
    assert.equal(lease, null);
    assert.equal(aborted, true);
    assert.equal(timeoutCleared, true);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});

test("renew returns the latest strict lease expiry and fencing token", async () => {
  enabledEnv();
  const lease: GateLease = {
    scope: "vietnam",
    resourceKey: "evisa/status",
    leaseId: "lease-1",
    fencingToken: 7,
    leaseUntil: Date.now() + 120_000,
  };
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => response({
    ok: true,
    renewed: true,
    fencingToken: 7,
    leaseUntil: 1_800_000_000_000,
  });
  try {
    assert.deepEqual(await renewResilienceGate(lease, 120), {
      ...lease,
      leaseUntil: 1_800_000_000_000,
    });
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

test("release rejects a non-retryable gateway response", async () => {
  enabledEnv();
  const lease: GateLease = {
    scope: "vietnam",
    resourceKey: "evisa/status",
    leaseId: "lease-1",
    fencingToken: 7,
    leaseUntil: Date.now() + 120_000,
  };
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => response({ ok: false }, 403);
  try {
    await assert.rejects(releaseResilienceGate(lease), ResilienceGateResponseError);
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
