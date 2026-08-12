import { describe, expect, it, vi } from "vitest";
import { ensureVietnamCardWorkerReady } from "./cloud-worker-ready";

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
