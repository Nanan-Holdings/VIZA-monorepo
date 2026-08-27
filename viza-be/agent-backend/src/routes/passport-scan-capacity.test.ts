import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const providerMock = vi.hoisted(() => {
  class CapacityError extends Error {
    readonly code = "QUEUE_FULL";

    constructor() {
      super("QUEUE_FULL");
      this.name = "ProviderCapacityError";
    }
  }
  return {
    CapacityError,
    run: vi.fn<() => Promise<never>>(),
  };
});

vi.mock("../utils/provider-capacity.js", () => ({
  ProviderCapacityError: providerMock.CapacityError,
  runWithProviderCapacity: providerMock.run,
}));

vi.mock("../utils/openai-client.js", () => ({
  createOpenAiClient: () => ({ responses: { create: vi.fn() } }),
}));

describe("passport scan provider backpressure", () => {
  const originalKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    vi.resetModules();
    process.env.OPENAI_API_KEY = "test-key";
    providerMock.run.mockRejectedValue(new providerMock.CapacityError());
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
    providerMock.run.mockReset();
  });

  it("returns a redacted retryable 503 without invoking unbounded provider work", async () => {
    const { passportScanRouter } = await import("./passport-scan.routes.js");
    const app = express().use(express.json()).use(passportScanRouter);

    const response = await request(app)
      .post("/extract")
      .send({ imageBase64: "ZmFrZQ==", mediaType: "image/jpeg" })
      .expect(503);

    expect(response.headers["retry-after"]).toBe("2");
    expect(response.body).toEqual({
      error: true,
      message: "OCR service is busy; retry shortly",
    });
    expect(JSON.stringify(response.body)).not.toMatch(/QUEUE_FULL|OpenAI|provider unavailable/u);
  });

  it("redacts ordinary provider failures and marks them retryable", async () => {
    providerMock.run.mockRejectedValue(new Error("upstream request secret detail"));
    const { passportScanRouter } = await import("./passport-scan.routes.js");
    const app = express().use(express.json()).use(passportScanRouter);

    const response = await request(app)
      .post("/extract")
      .send({ imageBase64: "ZmFrZQ==", mediaType: "image/jpeg" })
      .expect(502);

    expect(response.headers["retry-after"]).toBe("2");
    expect(response.body).toEqual({
      error: true,
      message: "OCR service is temporarily unavailable; retry shortly",
    });
    expect(JSON.stringify(response.body)).not.toContain("upstream request secret detail");
  });
});
