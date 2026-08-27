import { describe, expect, it, vi } from "vitest";

import {
  ProviderCapacityError,
  ProviderConcurrencyGate,
  readProviderCapacityLimits,
} from "./provider-capacity.js";

describe("ProviderConcurrencyGate", () => {
  it("bounds environment configuration", () => {
    expect(readProviderCapacityLimits({})).toEqual({
      maxActive: 8,
      maxQueued: 32,
      queueTimeoutMs: 5_000,
    });
    expect(readProviderCapacityLimits({
      VIZA_PROVIDER_MAX_CONCURRENCY: "999",
      VIZA_PROVIDER_MAX_QUEUE: "9999",
      VIZA_PROVIDER_QUEUE_TIMEOUT_MS: "999999",
    })).toEqual({
      maxActive: 64,
      maxQueued: 512,
      queueTimeoutMs: 60_000,
    });
  });

  it("hands a released slot to the oldest waiter and rejects overflow", async () => {
    const gate = new ProviderConcurrencyGate(1, 1, 1_000);
    const releaseFirst = await gate.acquire();
    const second = gate.acquire();

    await expect(gate.acquire()).rejects.toMatchObject<ProviderCapacityError>({
      code: "QUEUE_FULL",
    });

    releaseFirst({ failed: false, durationMs: 20 });
    const releaseSecond = await second;
    expect(gate.getStats()).toMatchObject({ active: 1, queued: 0, rejectedFull: 1 });
    releaseSecond({ failed: false, durationMs: 10 });
    expect(gate.getStats()).toMatchObject({ active: 0, completed: 2, failed: 0 });
  });

  it("times out queued work without leaking a slot", async () => {
    vi.useFakeTimers();
    try {
      const gate = new ProviderConcurrencyGate(1, 1, 50);
      const release = await gate.acquire();
      const queued = gate.acquire();
      const rejection = expect(queued).rejects.toMatchObject<ProviderCapacityError>({
        code: "QUEUE_TIMEOUT",
      });

      await vi.advanceTimersByTimeAsync(50);
      await rejection;
      release({ failed: false, durationMs: 1 });
      expect(gate.getStats()).toMatchObject({ active: 0, queued: 0, timedOut: 1 });
    } finally {
      vi.useRealTimers();
    }
  });

  it("removes aborted queued work", async () => {
    const gate = new ProviderConcurrencyGate(1, 1, 1_000);
    const release = await gate.acquire();
    const controller = new AbortController();
    const queued = gate.acquire(controller.signal);
    const rejection = expect(queued).rejects.toMatchObject<ProviderCapacityError>({
      code: "ABORTED",
    });

    controller.abort();
    await rejection;
    release({ failed: false, durationMs: 1 });
    expect(gate.getStats()).toMatchObject({ active: 0, queued: 0, aborted: 1 });
  });

  it("releases capacity and records aggregate latency when provider work fails", async () => {
    const gate = new ProviderConcurrencyGate(1, 1, 1_000);
    await expect(gate.run(async () => {
      throw new Error("provider unavailable");
    })).rejects.toThrow("provider unavailable");

    expect(gate.getStats()).toMatchObject({
      active: 0,
      completed: 1,
      failed: 1,
      executionP50Ms: expect.any(Number),
      executionP95Ms: expect.any(Number),
    });
  });
});
