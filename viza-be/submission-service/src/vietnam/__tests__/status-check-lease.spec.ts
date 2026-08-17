import assert from "node:assert/strict";
import test from "node:test";

import {
  claimVietnamOfficialStatusChecks,
  completeVietnamOfficialStatusCheck,
  deferVietnamOfficialStatusCheck,
  failVietnamOfficialStatusCheck,
  renewVietnamOfficialStatusCheck,
  VietnamStatusCheckOwnershipLostError,
  VietnamStatusCheckRpcSchemaError,
  withVietnamStatusCheckLease,
} from "../status-check-lease.js";

test("Vietnam status claims include worker ownership and a bounded lease", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return {
        data: [{
          id: "check-1",
          lease_generation: 7,
          lease_expires_at: "2026-08-15T00:05:00.000Z",
        }],
        error: null,
      };
    },
  };

  const rows = await claimVietnamOfficialStatusChecks<{ id: string }>(client, {
    workerId: "worker-a",
    limit: 3,
    leaseSeconds: 300,
  });

  assert.deepEqual(rows, [{
    id: "check-1",
    lease_generation: 7,
    lease_expires_at: "2026-08-15T00:05:00.000Z",
    leaseGeneration: 7,
    leaseExpiresAt: "2026-08-15T00:05:00.000Z",
  }]);
  assert.deepEqual(calls, [{
    name: "claim_vn_official_status_checks",
    args: { p_worker_id: "worker-a", p_limit: 1, p_lease_seconds: 300 },
  }]);
});

test("Vietnam status completion is conditional on the same worker", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return { data: false, error: null };
    },
  };

  const completed = await completeVietnamOfficialStatusCheck(client, {
    checkId: "check-1",
    workerId: "worker-a",
    leaseGeneration: 7,
    patch: { status: "cancelled" },
  });

  assert.equal(completed, false);
  assert.deepEqual(calls[0], {
    name: "complete_vn_official_status_check",
    args: {
      p_check_id: "check-1",
      p_worker_id: "worker-a",
      p_lease_generation: 7,
      p_patch: { status: "cancelled" },
    },
  });
});

test("Vietnam status failure is conditional and carries failure evidence", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return { data: true, error: null };
    },
  };

  const failed = await failVietnamOfficialStatusCheck(client, {
    checkId: "check-1",
    workerId: "worker-a",
    leaseGeneration: 7,
    errorCode: "official_status_check_failed",
    errorMessage: "portal unavailable",
    rawStatusJson: { source: "vietnam_evisa_search", failed: true },
  });

  assert.equal(failed, true);
  assert.deepEqual(calls[0], {
    name: "fail_vn_official_status_check",
    args: {
      p_check_id: "check-1",
      p_worker_id: "worker-a",
      p_lease_generation: 7,
      p_error_code: "official_status_check_failed",
      p_error_message: "portal unavailable",
      p_raw_status_json: { source: "vietnam_evisa_search", failed: true },
    },
  });
});

test("Vietnam status defer calls the exact ownership-aware RPC and returns false on lost ownership", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return { data: false, error: null };
    },
  };

  const deferred = await deferVietnamOfficialStatusCheck(client, {
    checkId: "check-1",
    workerId: "worker-a",
    leaseGeneration: 7,
    retryAfterSeconds: 30,
  });

  assert.equal(deferred, false);
  assert.deepEqual(calls, [{
    name: "defer_vn_official_status_check",
    args: {
      p_check_id: "check-1",
      p_worker_id: "worker-a",
      p_lease_generation: 7,
      p_retry_after_seconds: 30,
    },
  }]);
});

test("Vietnam status claim fails closed on a malformed non-empty RPC row", async () => {
  const client = {
    rpc: async () => ({ data: [{}], error: null }),
  };
  await assert.rejects(
    claimVietnamOfficialStatusChecks(client, { workerId: "worker-a" }),
    VietnamStatusCheckRpcSchemaError,
  );
});

test("Vietnam status settlement treats a false/empty response as ownership loss and rejects truthy drift", async () => {
  const emptyClient = {
    rpc: async () => ({ data: [], error: null }),
  };
  assert.equal(
    await completeVietnamOfficialStatusCheck(emptyClient, {
      checkId: "check-1",
      workerId: "worker-a",
      leaseGeneration: 7,
      patch: { status: "cancelled" },
    }),
    false,
  );
  const malformedClient = {
    rpc: async () => ({ data: {}, error: null }),
  };
  await assert.rejects(
    completeVietnamOfficialStatusCheck(malformedClient, {
      checkId: "check-1",
      workerId: "worker-a",
      leaseGeneration: 7,
      patch: { status: "cancelled" },
    }),
    VietnamStatusCheckRpcSchemaError,
  );
});

test("Vietnam status settlement rejects oversized JSON before the RPC", async () => {
  let rpcCalls = 0;
  const client = {
    rpc: async () => {
      rpcCalls += 1;
      return { data: true, error: null };
    },
  };
  await assert.rejects(
    completeVietnamOfficialStatusCheck(client, {
      checkId: "check-large",
      workerId: "worker-a",
      leaseGeneration: 7,
      patch: { raw_status_json: { value: "x".repeat(524_289) } },
    }),
    /524288 bytes/,
  );
  await assert.rejects(
    failVietnamOfficialStatusCheck(client, {
      checkId: "check-large",
      workerId: "worker-a",
      leaseGeneration: 7,
      errorCode: "portal_error",
      errorMessage: "portal unavailable",
      rawStatusJson: { value: "x".repeat(524_289) },
    }),
    /524288 bytes/,
  );
  assert.equal(rpcCalls, 0);
});

test("Vietnam status heartbeat renews the exact generation and returns DB expiry", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return {
        data: [{
          id: "check-1",
          lease_generation: 7,
          lease_expires_at: "2026-08-15T00:05:00.000Z",
        }],
        error: null,
      };
    },
  };

  const renewed = await renewVietnamOfficialStatusCheck(client, {
    checkId: "check-1",
    workerId: "worker-a",
    leaseGeneration: 7,
    leaseSeconds: 300,
  });

  assert.deepEqual(renewed, {
    id: "check-1",
    leaseGeneration: 7,
    leaseExpiresAt: "2026-08-15T00:05:00.000Z",
  });
  assert.deepEqual(calls, [{
    name: "renew_vn_official_status_check",
    args: {
      p_check_id: "check-1",
      p_worker_id: "worker-a",
      p_lease_generation: 7,
      p_lease_seconds: 300,
    },
  }]);
});

test("Vietnam status lease refuses a pre-expired claim before starting portal work", async () => {
  let operationCalls = 0;
  let rpcCalls = 0;
  const client = {
    rpc: async () => {
      rpcCalls += 1;
      return { data: [], error: null };
    },
  };

  await assert.rejects(
    withVietnamStatusCheckLease({
      client,
      checkId: "check-expired",
      workerId: "worker-a",
      leaseGeneration: 1,
      leaseExpiresAt: new Date(Date.now() - 1).toISOString(),
      operation: async () => {
        operationCalls += 1;
        return undefined;
      },
    }),
    VietnamStatusCheckOwnershipLostError,
  );
  assert.equal(operationCalls, 0);
  assert.equal(rpcCalls, 0);
});

test("Vietnam status lease does not open a microtask window inside the safety lead", async () => {
  let operationCalls = 0;
  const client = {
    rpc: async () => ({ data: [], error: null }),
  };

  await assert.rejects(
    withVietnamStatusCheckLease({
      client,
      checkId: "check-safety",
      workerId: "worker-a",
      leaseGeneration: 2,
      leaseExpiresAt: new Date(Date.now() + 100).toISOString(),
      operation: async () => {
        operationCalls += 1;
        await Promise.resolve();
      },
    }),
    VietnamStatusCheckOwnershipLostError,
  );
  assert.equal(operationCalls, 0);
});

test("Vietnam status heartbeat resets its schedule from the DB expiry after RTT", async () => {
  const callbacks: Array<() => void> = [];
  const delays: number[] = [];
  let renewCalls = 0;
  const client = {
    rpc: async (name: string) => {
      if (name === "renew_vn_official_status_check") {
        renewCalls += 1;
        await new Promise<void>((resolve) => setImmediate(resolve));
        return {
          data: [{
            id: "check-renew",
            lease_generation: 3,
            lease_expires_at: new Date(Date.now() + 120_000).toISOString(),
          }],
          error: null,
        };
      }
      return { data: [], error: null };
    },
  };
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  globalThis.setTimeout = ((callback: () => void, delay?: number) => {
    callbacks.push(callback);
    delays.push(delay ?? 0);
    return callbacks.length as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;
  globalThis.clearTimeout = (() => undefined) as typeof clearTimeout;
  try {
    await withVietnamStatusCheckLease({
      client,
      checkId: "check-renew",
      workerId: "worker-a",
      leaseGeneration: 3,
      leaseExpiresAt: new Date(Date.now() + 10_000).toISOString(),
      heartbeatMs: 60_000,
      operation: async ({ stopRenewal }) => {
        assert.equal(callbacks.length, 1);
        callbacks[0]?.();
        for (let attempt = 0; attempt < 20 && callbacks.length < 2; attempt += 1) {
          await new Promise<void>((resolve) => setImmediate(resolve));
        }
        assert.equal(renewCalls, 1);
        assert.equal(callbacks.length, 2);
        assert.ok(delays[1] >= 59_000, `renewed delay ${delays[1]} should use DB expiry`);
        await stopRenewal();
      },
    });
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});

test("Vietnam status settlement waits for an in-flight renew before returning", async () => {
  const callbacks: Array<() => void> = [];
  let renewStarted = false;
  let resolveRenew: (() => void) | undefined;
  const client = {
    rpc: async (name: string) => {
      if (name === "renew_vn_official_status_check") {
        renewStarted = true;
        await new Promise<void>((resolve) => {
          resolveRenew = resolve;
        });
        return {
          data: [{
            id: "check-stop",
            lease_generation: 4,
            lease_expires_at: new Date(Date.now() + 120_000).toISOString(),
          }],
          error: null,
        };
      }
      return { data: [], error: null };
    },
  };
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  globalThis.setTimeout = ((callback: () => void) => {
    callbacks.push(callback);
    return callbacks.length as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;
  globalThis.clearTimeout = (() => undefined) as typeof clearTimeout;
  try {
    await withVietnamStatusCheckLease({
      client,
      checkId: "check-stop",
      workerId: "worker-a",
      leaseGeneration: 4,
      leaseExpiresAt: new Date(Date.now() + 10_000).toISOString(),
      operation: async ({ stopRenewal }) => {
        callbacks[0]?.();
        for (let attempt = 0; attempt < 20 && !renewStarted; attempt += 1) {
          await new Promise<void>((resolve) => setImmediate(resolve));
        }
        assert.equal(renewStarted, true);
        let stopped = false;
        const stopping = stopRenewal().then(() => {
          stopped = true;
        });
        await Promise.resolve();
        assert.equal(stopped, false);
        resolveRenew?.();
        await stopping;
        assert.equal(stopped, true);
      },
    });
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});

test("Vietnam status accepts a slow DB completion after local deadline once renewal is stopped", async () => {
  const client = {
    rpc: async () => ({ data: [], error: null }),
  };
  const originalNow = Date.now;
  try {
    await withVietnamStatusCheckLease({
      client,
      checkId: "check-slow-settlement",
      workerId: "worker-a",
      leaseGeneration: 5,
      leaseExpiresAt: new Date(originalNow() + 10_000).toISOString(),
      operation: async ({ stopRenewal }) => {
        await stopRenewal();
        Date.now = () => originalNow() + 60_000;
        return "db-complete";
      },
    });
  } finally {
    Date.now = originalNow;
  }
});

test("Vietnam gate ownership loss prevents final settlement and releases the exact lease", async () => {
  process.env.SUPABASE_URL ??= "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role";
  const {
    withVietnamStatusResilienceGate,
    VietnamStatusCheckOwnershipLostError,
  } = await import("../status-tracking.js");
  const lease = {
    scope: "vietnam",
    resourceKey: "evisa/status",
    leaseId: "lease-1",
    fencingToken: 9,
    leaseUntil: Date.now() + 120_000,
  };
  let releaseLease: unknown;
  let operationCalls = 0;
  const gateClient = {
    acquire: async () => lease,
    renew: async () => null,
    release: async (value: typeof lease) => {
      releaseLease = value;
      return true;
    },
  };
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  globalThis.setTimeout = ((callback: () => void) => {
    queueMicrotask(callback);
    return 1 as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;
  globalThis.clearTimeout = (() => undefined) as typeof clearTimeout;
  try {
    await assert.rejects(
      withVietnamStatusResilienceGate(
        {
          workerId: "worker-a",
          checkId: "check-1",
          operation: async ({ assertOwned }) => {
            operationCalls += 1;
            await Promise.resolve();
            assertOwned();
          },
        },
        gateClient,
      ),
      (error: unknown) => error instanceof VietnamStatusCheckOwnershipLostError,
    );
    assert.equal(operationCalls, 1);
    assert.deepEqual(releaseLease, lease);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});

test("Vietnam gate clears its renew timer and preserves a portal error while releasing the lease", async () => {
  process.env.SUPABASE_URL ??= "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role";
  const { withVietnamStatusResilienceGate } = await import("../status-tracking.js");
  const lease = {
    scope: "vietnam",
    resourceKey: "evisa/status",
    leaseId: "lease-2",
    fencingToken: 10,
    leaseUntil: Date.now() + 120_000,
  };
  let timerHandle: ReturnType<typeof setTimeout> | undefined;
  let clearedHandle: ReturnType<typeof setTimeout> | undefined;
  let releaseLease: unknown;
  const gateClient = {
    acquire: async () => lease,
    renew: async () => lease,
    release: async (value: typeof lease) => {
      releaseLease = value;
      return true;
    },
  };
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  globalThis.setTimeout = ((callback: () => void, _delay?: number) => {
    void callback;
    timerHandle = 2 as unknown as ReturnType<typeof setTimeout>;
    return timerHandle;
  }) as typeof setTimeout;
  globalThis.clearTimeout = ((value: ReturnType<typeof setTimeout>) => {
    clearedHandle = value;
  }) as typeof clearTimeout;
  try {
    await assert.rejects(
      withVietnamStatusResilienceGate(
        {
          workerId: "worker-a",
          checkId: "check-2",
          operation: async () => {
            throw new Error("portal unavailable");
          },
        },
        gateClient,
      ),
      /portal unavailable/,
    );
    assert.equal(clearedHandle, timerHandle);
    assert.deepEqual(releaseLease, lease);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});

test("Vietnam gate renewal failure racing with portal failure still skips failure settlement", async () => {
  process.env.SUPABASE_URL ??= "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role";
  const {
    withVietnamStatusResilienceGate,
    VietnamStatusCheckOwnershipLostError,
  } = await import("../status-tracking.js");
  const lease = {
    scope: "vietnam",
    resourceKey: "evisa/status",
    leaseId: "lease-3",
    fencingToken: 11,
    leaseUntil: Date.now() + 120_000,
  };
  let resolveRenew: (() => void) | undefined;
  const gateClient = {
    acquire: async () => lease,
    renew: async () => {
      await new Promise<void>((resolve) => {
        resolveRenew = resolve;
      });
      return null;
    },
    release: async () => true,
  };
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  globalThis.setTimeout = ((callback: () => void) => {
    queueMicrotask(callback);
    return 3 as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;
  globalThis.clearTimeout = (() => undefined) as typeof clearTimeout;
  try {
    const pending = withVietnamStatusResilienceGate(
      {
        workerId: "worker-a",
        checkId: "check-3",
        operation: async () => {
          throw new Error("portal unavailable");
        },
      },
      gateClient,
    );
    for (let attempt = 0; attempt < 10 && !resolveRenew; attempt += 1) {
      await new Promise<void>((resolve) => queueMicrotask(resolve));
    }
    resolveRenew?.();
    await assert.rejects(
      pending,
      (error: unknown) => error instanceof VietnamStatusCheckOwnershipLostError,
    );
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});

test("Vietnam capacity denial defers before portal, complete, or fail settlement", async () => {
  process.env.SUPABASE_URL ??= "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role";
  const {
    runVietnamStatusPortalCheckWithGate,
    VietnamStatusGateDeferredError,
  } = await import("../status-tracking.js");
  const { ResilienceGateCapacityDeniedError } = await import("../../resilience-gate.js");
  let portalCalls = 0;
  let completeCalls = 0;
  let failCalls = 0;
  const gateClient = {
    acquire: async () => {
      throw new ResilienceGateCapacityDeniedError("at_capacity", 1_800_000_000_000);
    },
    renew: async () => null,
    release: async () => true,
  };
  await assert.rejects(
    runVietnamStatusPortalCheckWithGate(
      {
        workerId: "worker-a",
        checkId: "check-denied",
        runPortal: async () => {
          portalCalls += 1;
          completeCalls += 1;
          failCalls += 1;
          return {
            status: "processing",
            summary: "processing",
            registrationCode: "VN-1",
            passportNumber: null,
            visaNumber: null,
            deniedReason: null,
            downloadAvailable: false,
            pdfBytes: null,
            rawText: "processing",
          };
        },
      },
      gateClient,
    ),
    (error: unknown) => error instanceof VietnamStatusGateDeferredError,
  );
  assert.equal(portalCalls, 0);
  assert.equal(completeCalls, 0);
  assert.equal(failCalls, 0);
});

test("Vietnam permanent gate configuration errors propagate without running portal work", async () => {
  process.env.SUPABASE_URL ??= "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role";
  const { runVietnamStatusPortalCheckWithGate } = await import("../status-tracking.js");
  const { ResilienceGateConfigurationError } = await import("../../resilience-gate.js");
  let portalCalls = 0;
  const gateClient = {
    acquire: async () => {
      throw new ResilienceGateConfigurationError("gateway config invalid");
    },
    renew: async () => null,
    release: async () => true,
  };
  await assert.rejects(
    runVietnamStatusPortalCheckWithGate(
      {
        workerId: "worker-a",
        checkId: "check-config",
        runPortal: async () => {
          portalCalls += 1;
          return {
            status: "processing",
            summary: "processing",
            registrationCode: "VN-1",
            passportNumber: null,
            visaNumber: null,
            deniedReason: null,
            downloadAvailable: false,
            pdfBytes: null,
            rawText: "processing",
          };
        },
      },
      gateClient,
    ),
    ResilienceGateConfigurationError,
  );
  assert.equal(portalCalls, 0);
});

test("Vietnam gate renews materially before half-life and asserts expiry", async () => {
  process.env.SUPABASE_URL ??= "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role";
  const { withVietnamStatusResilienceGate, VietnamStatusCheckOwnershipLostError } = await import("../status-tracking.js");
  const lease = {
    scope: "vietnam",
    resourceKey: "evisa/status",
    leaseId: "lease-4",
    fencingToken: 12,
    leaseUntil: Date.now() + 120_000,
  };
  let delayMs = 0;
  const gateClient = {
    acquire: async () => lease,
    renew: async () => null,
    release: async () => true,
  };
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  globalThis.setTimeout = ((_callback: () => void, delay?: number) => {
    delayMs = delay ?? 0;
    return 4 as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;
  globalThis.clearTimeout = (() => undefined) as typeof clearTimeout;
  try {
    await assert.rejects(
      withVietnamStatusResilienceGate(
        {
          workerId: "worker-a",
          checkId: "check-4",
          operation: async ({ assertOwned }) => {
            assertOwned();
            throw new VietnamStatusCheckOwnershipLostError();
          },
        },
        gateClient,
      ),
      VietnamStatusCheckOwnershipLostError,
    );
    assert.ok(delayMs < 50_000, `renew delay ${delayMs} should precede half-life`);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});

test("Vietnam gate treats an already-expired lease as lost before portal settlement", async () => {
  process.env.SUPABASE_URL ??= "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role";
  const {
    withVietnamStatusResilienceGate,
    VietnamStatusCheckOwnershipLostError,
  } = await import("../status-tracking.js");
  const lease = {
    scope: "vietnam",
    resourceKey: "evisa/status",
    leaseId: "lease-expired",
    fencingToken: 13,
    leaseUntil: Date.now() - 1,
  };
  const gateClient = {
    acquire: async () => lease,
    renew: async () => null,
    release: async () => true,
  };
  await assert.rejects(
    withVietnamStatusResilienceGate(
      {
        workerId: "worker-a",
        checkId: "check-expired",
        operation: async ({ assertOwned }) => {
          assertOwned();
        },
      },
      gateClient,
    ),
    VietnamStatusCheckOwnershipLostError,
  );
});
