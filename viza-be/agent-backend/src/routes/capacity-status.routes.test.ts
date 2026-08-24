import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db/index.js", () => ({
  getDatabasePoolMetrics: () => ({
    state: "open",
    maxConnections: 3,
    totalConnections: 2,
    activeConnections: 1,
    idleConnections: 1,
    waitingRequests: 0,
    utilizationPercent: 33.33,
  }),
  getDatabaseQueryMetrics: () => ({
    totalQueries: 4,
    failedQueries: 0,
    slowQueries: 1,
    slowThresholdMs: 500,
    p95DurationMs: 520,
    maxDurationMs: 520,
    topSlowFingerprints: [{ fingerprint: "a".repeat(64), count: 1, p95DurationMs: 520 }],
  }),
}));

vi.mock("../socket/chat-concurrency.js", async () => {
  const actual = await vi.importActual<typeof import("../socket/chat-concurrency.js")>(
    "../socket/chat-concurrency.js",
  );
  return {
    ...actual,
    getLatestChatCapacityStats: () => ({
      active: 2,
      queued: 3,
      peakActive: 4,
      peakQueued: 5,
      maxActive: 16,
      maxQueued: 64,
      accepted: 10,
      completed: 8,
      rejectedFull: 0,
      timedOut: 0,
      aborted: 0,
      queueWaitP50Ms: 10,
      queueWaitP95Ms: 20,
    }),
  };
});

vi.mock("../services/portal-health.service.js", () => ({
  getPublicPortalStatus: vi.fn(),
  runPortalHealthProbes: vi.fn(),
}));

describe("capacity status route", () => {
  const originalSecret = process.env.STATUS_CRON_SECRET;

  beforeEach(() => {
    process.env.STATUS_CRON_SECRET = "capacity-test-secret";
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.STATUS_CRON_SECRET;
    else process.env.STATUS_CRON_SECRET = originalSecret;
  });

  it("requires the status bearer secret", async () => {
    const { statusOperationsRouter } = await import("./public-status.routes.js");
    const app = express().use(statusOperationsRouter);
    await request(app).get("/capacity").expect(401);
  });

  it("returns only aggregate chat and database capacity metrics", async () => {
    const { statusOperationsRouter } = await import("./public-status.routes.js");
    const app = express().use(statusOperationsRouter);
    const response = await request(app)
      .get("/capacity")
      .set("Authorization", "Bearer capacity-test-secret")
      .expect(200);

    expect(response.body).toMatchObject({
      ok: true,
      chat: { active: 2, queued: 3 },
      database: { pool: { activeConnections: 1 }, queries: { totalQueries: 4 } },
    });
    expect(JSON.stringify(response.body)).not.toMatch(/userId|sessionId|queryText|parameters/i);
  });
});
