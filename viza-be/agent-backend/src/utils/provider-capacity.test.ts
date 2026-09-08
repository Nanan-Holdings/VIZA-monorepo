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
      executionTimeoutMs: 60_000,
    });
    expect(readProviderCapacityLimits({
      VIZA_PROVIDER_MAX_CONCURRENCY: "999",
      VIZA_PROVIDER_MAX_QUEUE: "9999",
      VIZA_PROVIDER_QUEUE_TIMEOUT_MS: "999999",
      VIZA_PROVIDER_EXECUTION_TIMEOUT_MS: "999999",
    })).toEqual({
      maxActive: 64,
      maxQueued: 512,
      queueTimeoutMs: 60_000,
      executionTimeoutMs: 180_000,
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

  it("aborts and releases provider work that exceeds the execution deadline", async () => {
    vi.useFakeTimers();
    try {
      const gate = new ProviderConcurrencyGate(1, 1, 1_000, 50);
      const operation = gate.run((signal) => new Promise<never>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      }));
      const rejection = expect(operation).rejects.toMatchObject<ProviderCapacityError>({
        code: "EXECUTION_TIMEOUT",
      });

      await vi.advanceTimersByTimeAsync(50);
      await rejection;
      expect(gate.getStats()).toMatchObject({
        active: 0,
        completed: 1,
        failed: 1,
        executionTimedOut: 1,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the slot until a stalled response body is aborted", async () => {
    vi.useFakeTimers();
    try {
      const gate = new ProviderConcurrencyGate(1, 1, 1_000, 50);
      let headersReceived = false;
      const operation = gate.run(async (signal) => {
        headersReceived = true;
        return await new Promise<never>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        });
      });
      const rejection = expect(operation).rejects.toMatchObject<ProviderCapacityError>({
        code: "EXECUTION_TIMEOUT",
      });

      await vi.advanceTimersByTimeAsync(25);
      expect(headersReceived).toBe(true);
      expect(gate.getStats()).toMatchObject({ active: 1, completed: 0 });
      await vi.advanceTimersByTimeAsync(25);
      await rejection;
      expect(gate.getStats()).toMatchObject({ active: 0, completed: 1, executionTimedOut: 1 });
    } finally {
      vi.useRealTimers();
    }
  });

  it("propagates an active caller abort and releases the slot", async () => {
    const gate = new ProviderConcurrencyGate(1, 1, 1_000, 5_000);
    const controller = new AbortController();
    const operation = gate.run((signal) => new Promise<never>((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    }), controller.signal);
    const rejection = expect(operation).rejects.toMatchObject<ProviderCapacityError>({
      code: "ABORTED",
    });

    controller.abort();
    await rejection;
    expect(gate.getStats()).toMatchObject({
      active: 0,
      completed: 1,
      executionAborted: 1,
    });
  });

  it("keeps a timed-out slot until the provider settles, then grants the FIFO waiter", async () => {
    vi.useFakeTimers();
    try {
      const gate = new ProviderConcurrencyGate(1, 1, 1_000, 50);
      let resolveProvider!: (value: string) => void;
      const providerResult = new Promise<string>((resolve) => {
        resolveProvider = resolve;
      });
      let providerStarted = false;
      let waiterStarted = false;
      const operation = gate.run(() => {
        providerStarted = true;
        return providerResult;
      });
      const rejection = expect(operation).rejects.toMatchObject<ProviderCapacityError>({
        code: "EXECUTION_TIMEOUT",
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(providerStarted).toBe(true);

      const waiter = gate.run(async () => {
        waiterStarted = true;
        return "waiter";
      });

      await vi.advanceTimersByTimeAsync(50);
      await rejection;
      expect(waiterStarted).toBe(false);
      expect(gate.getStats()).toMatchObject({
        active: 1,
        queued: 1,
        completed: 0,
        executionTimedOut: 1,
      });

      await vi.advanceTimersByTimeAsync(100);
      expect(waiterStarted).toBe(false);
      expect(gate.getStats()).toMatchObject({ active: 1, completed: 0 });
      resolveProvider("provider-result");
      await expect(waiter).resolves.toBe("waiter");
      expect(waiterStarted).toBe(true);
      expect(gate.getStats()).toMatchObject({
        active: 0,
        queued: 0,
        completed: 2,
        failed: 1,
        queueWaitP50Ms: expect.any(Number),
        executionP95Ms: expect.any(Number),
      });
      expect(gate.getStats().queueWaitP50Ms).toBeGreaterThanOrEqual(150);
      expect(gate.getStats().executionP95Ms).toBeGreaterThanOrEqual(150);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps an aborted slot until a late provider rejection settles and is observed", async () => {
    vi.useFakeTimers();
    try {
      const gate = new ProviderConcurrencyGate(1, 1, 1_000, 5_000);
      const controller = new AbortController();
      let rejectProvider!: (error: Error) => void;
      const providerResult = new Promise<never>((_resolve, reject) => {
        rejectProvider = reject;
      });
      let waiterStarted = false;
      const operation = gate.run(() => providerResult, controller.signal);
      const rejection = expect(operation).rejects.toMatchObject<ProviderCapacityError>({
        code: "ABORTED",
      });
      await vi.advanceTimersByTimeAsync(0);
      const waiter = gate.run(async () => {
        waiterStarted = true;
        return "waiter";
      });

      controller.abort();
      await rejection;
      expect(waiterStarted).toBe(false);
      expect(gate.getStats()).toMatchObject({
        active: 1,
        queued: 1,
        completed: 0,
        executionAborted: 1,
      });

      rejectProvider(new Error("late provider failure"));
      await expect(waiter).resolves.toBe("waiter");
      expect(waiterStarted).toBe(true);
      expect(gate.getStats()).toMatchObject({
        active: 0,
        queued: 0,
        completed: 2,
        failed: 1,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not start work when a synchronously aborted run has only acquired a slot", async () => {
    vi.useFakeTimers();
    try {
      const gate = new ProviderConcurrencyGate(1, 1, 1_000, 5_000);
      const controller = new AbortController();
      let workStarted = false;
      const operation = gate.run(async () => {
        workStarted = true;
        return "unexpected";
      }, controller.signal);
      const rejection = expect(operation).rejects.toMatchObject<ProviderCapacityError>({
        code: "ABORTED",
      });

      controller.abort();
      await rejection;
      expect(workStarted).toBe(false);
      expect(gate.getStats()).toMatchObject({
        active: 0,
        queued: 0,
        completed: 1,
        failed: 1,
        executionAborted: 1,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("skips a waiter aborted after grant and lets the next waiter continue", async () => {
    vi.useFakeTimers();
    try {
      const gate = new ProviderConcurrencyGate(1, 2, 1_000, 5_000);
      const releaseFirst = await gate.acquire();
      const grantedController = new AbortController();
      let grantedWorkStarted = false;
      let nextWorkStarted = false;
      const granted = gate.run(async () => {
        grantedWorkStarted = true;
        return "unexpected";
      }, grantedController.signal);
      const grantedRejection = expect(granted).rejects.toMatchObject<ProviderCapacityError>({
        code: "ABORTED",
      });
      const next = gate.run(async () => {
        nextWorkStarted = true;
        return "next";
      });
      await vi.advanceTimersByTimeAsync(0);

      releaseFirst({ failed: false, durationMs: 1 });
      grantedController.abort();
      await grantedRejection;
      expect(grantedWorkStarted).toBe(false);

      await expect(next).resolves.toBe("next");
      expect(nextWorkStarted).toBe(true);
      expect(gate.getStats()).toMatchObject({
        active: 0,
        queued: 0,
        completed: 3,
        failed: 1,
        aborted: 0,
        executionAborted: 1,
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
