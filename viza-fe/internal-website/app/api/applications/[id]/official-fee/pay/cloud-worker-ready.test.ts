import { describe, expect, it, vi } from "vitest";
import {
  ensureVietnamCardWorkerReady,
  vietnamCardPostTimeoutMs,
  vietnamCardReadinessTimeoutMs,
} from "./cloud-worker-ready";

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
    })).resolves.toEqual({ ok: false, reason: "wake_failed" });

    expect(waitUntilReady).not.toHaveBeenCalled();
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
