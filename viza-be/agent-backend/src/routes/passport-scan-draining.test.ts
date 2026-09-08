import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

const provider = vi.hoisted(() => ({
  create: vi.fn<[], Promise<{ output_text: string }>>(),
}));

vi.mock("../utils/openai-client.js", () => ({
  createOpenAiClient: () => ({ responses: { create: provider.create } }),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  provider.create.mockReset();
});

describe("passport scan with draining provider work", () => {
  it("returns retryable HTTP errors without starting more work until the old provider settles", async () => {
    vi.resetModules();
    vi.stubEnv("OPENAI_API_KEY", "local-test-key");
    vi.stubEnv("VIZA_PROVIDER_MAX_CONCURRENCY", "1");
    vi.stubEnv("VIZA_PROVIDER_MAX_QUEUE", "1");
    vi.stubEnv("VIZA_PROVIDER_QUEUE_TIMEOUT_MS", "50");
    vi.stubEnv("VIZA_PROVIDER_EXECUTION_TIMEOUT_MS", "50");

    let finishProvider: (value: { output_text: string }) => void = () => {};
    const draining = new Promise<{ output_text: string }>((resolve) => {
      finishProvider = resolve;
    });
    // Simulate a transport that finishes cleanup after its caller timed out.
    provider.create.mockReturnValueOnce(draining).mockResolvedValue({
      output_text: JSON.stringify({ confidence: "high", warnings: [] }),
    });

    const { passportScanRouter } = await import("./passport-scan.routes.js");
    const { getLatestProviderCapacityStats } = await import("../utils/provider-capacity.js");
    const app = express().use(express.json()).use("/api/passport-scan", passportScanRouter);
    const scan = () => request(app)
      .post("/api/passport-scan/extract")
      .send({ imageBase64: "ZmFrZQ==", mediaType: "image/jpeg" });

    try {
      const timedOut = await scan().expect(503);
      expect(timedOut.headers["retry-after"]).toBe("2");
      expect(timedOut.body).toEqual({ error: true, message: "OCR service is busy; retry shortly" });
      expect(getLatestProviderCapacityStats()).toMatchObject({
        active: 1, completed: 0, executionTimedOut: 1,
      });

      const queued = await scan().expect(503);
      expect(queued.headers["retry-after"]).toBe("2");
      expect(queued.body).toEqual(timedOut.body);
      expect(provider.create).toHaveBeenCalledTimes(1);
      expect(getLatestProviderCapacityStats()).toMatchObject({
        active: 1, queued: 0, completed: 0, timedOut: 1,
      });

      finishProvider({ output_text: "ignored late result" });
      const recovered = await scan().expect(200);
      expect(recovered.body).toEqual({
        error: false, extracted: { confidence: "high", warnings: [] },
      });
      expect(provider.create).toHaveBeenCalledTimes(2);
      expect(getLatestProviderCapacityStats()).toMatchObject({
        active: 0, queued: 0, peakActive: 1, completed: 2, failed: 1,
      });
    } finally {
      finishProvider({ output_text: "cleanup" });
    }
  });
});
