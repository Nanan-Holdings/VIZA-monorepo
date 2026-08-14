import { describe, expect, it, vi } from "vitest";
import {
  ensureVietnamCardWorkerReady,
  recoverVietnamCardHandoff,
  vietnamCardPostTimeoutMs,
  vietnamCardReadinessTimeoutMs,
  vietnamCardWakeTimeoutMs,
  wakeQueuedVietnamPaymentJob,
} from "./cloud-worker-ready";

describe("Vietnam queued payment wake", () => {
  it("explicitly wakes the legacy submission queue after the durable enqueue", async () => {
    const wakeSubmissionJob = vi.fn().mockResolvedValue({ ok: true });

    await expect(wakeQueuedVietnamPaymentJob(
      "queue-id",
      wakeSubmissionJob,
    )).resolves.toEqual({ ok: true });

    expect(wakeSubmissionJob).toHaveBeenCalledWith("queue-id", {
      target: "legacy",
    });
  });
});

describe("ensureVietnamCardWorkerReady", () => {
  it("waits for the legacy worker readiness endpoint after a cold start", async () => {
    const waitUntilReady = vi.fn().mockResolvedValue({ ok: true, attempts: 4 });

    await expect(ensureVietnamCardWorkerReady({
      baseUrl: "https://worker.example.test",
      wakeLegacy: vi.fn().mockResolvedValue({
        ok: true,
        target: "legacy",
        app: "legacy-worker",
        state: "start_requested",
      }),
      waitUntilReady,
    })).resolves.toEqual({ ok: true });

    expect(waitUntilReady).toHaveBeenCalledWith("https://worker.example.test/ready");
  });

  it("does not poll readiness when the Fly start request fails", async () => {
    const waitUntilReady = vi.fn();

    await expect(ensureVietnamCardWorkerReady({
      baseUrl: "https://worker.example.test",
      wakeLegacy: vi.fn().mockResolvedValue({
        ok: false,
        target: "legacy",
        reason: "request_failed",
      }),
      waitUntilReady,
    })).resolves.toEqual({
      ok: false,
      reason: "wake_failed",
      wakeReason: "request_failed",
    });

    expect(waitUntilReady).not.toHaveBeenCalled();
  });

  it("bounds a stalled Fly wake request before polling readiness", async () => {
    vi.useFakeTimers();
    try {
      const waitUntilReady = vi.fn();
      const operation = ensureVietnamCardWorkerReady({
        baseUrl: "https://worker.example.test",
        wakeLegacy: () => new Promise(() => undefined),
        waitUntilReady,
        wakeTimeoutMs: 5_000,
      });
      let settled = false;
      void operation.finally(() => {
        settled = true;
      });

      await vi.advanceTimersByTimeAsync(5_000);

      expect(settled).toBe(true);
      await expect(operation).resolves.toEqual({
        ok: false,
        reason: "wake_failed",
        wakeReason: "timeout",
      });
      expect(waitUntilReady).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns a bounded failure when the HTTP service never becomes ready", async () => {
    await expect(ensureVietnamCardWorkerReady({
      baseUrl: "https://worker.example.test",
      wakeLegacy: vi.fn().mockResolvedValue({
        ok: true,
        target: "legacy",
        app: "legacy-worker",
        state: "already_running",
      }),
      waitUntilReady: vi.fn().mockResolvedValue({
        ok: false,
        attempts: 8,
        reason: "readiness_timeout",
      }),
    })).resolves.toEqual({
      ok: false,
      reason: "readiness_timeout",
      attempts: 8,
    });
  });
});

describe("Vietnam card handoff deadline", () => {
  it("gives a cold Fly wake enough time to list, reserve, and start the Machine", () => {
    const now = 1_000_000;

    expect(vietnamCardWakeTimeoutMs(now + 40_000, now)).toBe(15_000);
    expect(vietnamCardWakeTimeoutMs(now + 15_000, now)).toBe(5_000);
    expect(vietnamCardWakeTimeoutMs(now + 9_000, now)).toBe(0);
  });

  it("reserves time for the card post and the durable queue write", () => {
    const now = 1_000_000;

    expect(vietnamCardReadinessTimeoutMs(now + 40_000, now)).toBe(20_000);
    expect(vietnamCardReadinessTimeoutMs(now + 15_000, now)).toBe(5_000);
    expect(vietnamCardReadinessTimeoutMs(now + 9_000, now)).toBe(0);
  });

  it("bounds each card-session request by the remaining handoff budget", () => {
    const now = 1_000_000;

    expect(vietnamCardPostTimeoutMs(now + 40_000, now)).toBe(8_000);
    expect(vietnamCardPostTimeoutMs(now + 3_000, now)).toBe(3_000);
    expect(vietnamCardPostTimeoutMs(now - 1, now)).toBe(0);
  });
});

describe("Vietnam card handoff lifecycle recovery", () => {
  it("re-wakes and re-checks readiness after a card POST loses the worker", async () => {
    const ensureReady = vi.fn().mockResolvedValue({ ok: true });
    const postCardSession = vi.fn()
      .mockResolvedValueOnce({ ok: false, error: "request_timeout" })
      .mockResolvedValueOnce({
        ok: true,
        redactedCard: { last4: "0000" },
        expiresAtIso: "2026-08-14T08:00:00.000Z",
      });

    await expect(recoverVietnamCardHandoff({
      ensureReady,
      postCardSession,
      maxAttempts: 3,
    })).resolves.toEqual({
      ok: true,
      redactedCard: { last4: "0000" },
      expiresAtIso: "2026-08-14T08:00:00.000Z",
    });

    expect(ensureReady).toHaveBeenCalledTimes(2);
    expect(postCardSession).toHaveBeenCalledTimes(2);
  });

  it("does not start another wake cycle after the handoff budget is exhausted", async () => {
    let now = 1_000;
    const ensureReady = vi.fn().mockResolvedValue({ ok: true });
    const postCardSession = vi.fn().mockImplementation(async () => {
      now = 31_000;
      return { ok: false, error: "request_timeout" };
    });

    await expect(recoverVietnamCardHandoff({
      ensureReady,
      postCardSession,
      maxAttempts: 3,
      deadlineAt: 40_000,
      now: () => now,
    })).resolves.toEqual({
      ok: false,
      stage: "post",
      error: "request_timeout",
    });

    expect(ensureReady).toHaveBeenCalledTimes(1);
    expect(postCardSession).toHaveBeenCalledTimes(1);
  });

  it("does not POST card data when readiness completes after the deadline", async () => {
    let now = 1_000;
    const ensureReady = vi.fn().mockImplementation(async () => {
      now = 40_001;
      return { ok: true };
    });
    const postCardSession = vi.fn().mockResolvedValue({
      ok: true,
      redactedCard: { last4: "0000" },
      expiresAtIso: null,
    });

    await expect(recoverVietnamCardHandoff({
      ensureReady,
      postCardSession,
      maxAttempts: 3,
      deadlineAt: 40_000,
      now: () => now,
    })).resolves.toEqual({
      ok: false,
      stage: "post",
      error: "card_session_handoff_timeout",
    });

    expect(ensureReady).toHaveBeenCalledTimes(1);
    expect(postCardSession).not.toHaveBeenCalled();
  });

  it("does not re-wake for a non-retryable card-session response", async () => {
    const ensureReady = vi.fn().mockResolvedValue({ ok: true });
    const postCardSession = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        error: "forbidden",
        retryable: false,
      })
      .mockResolvedValueOnce({
        ok: true,
        redactedCard: { last4: "0000" },
        expiresAtIso: null,
      });

    await expect(recoverVietnamCardHandoff({
      ensureReady,
      postCardSession,
      maxAttempts: 3,
    })).resolves.toEqual({
      ok: false,
      stage: "post",
      error: "forbidden",
    });

    expect(ensureReady).toHaveBeenCalledTimes(1);
    expect(postCardSession).toHaveBeenCalledTimes(1);
  });
});
