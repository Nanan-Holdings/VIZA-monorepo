import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db/index.js", () => ({
  db: { execute: vi.fn(async () => ({ rows: [{ "?column?": 1 }] })) },
  getDatabasePoolMetrics: () => ({
    state: "open",
    maxConnections: 3,
    totalConnections: 2,
    activeConnections: 1,
    idleConnections: 1,
    waitingRequests: 0,
    utilizationPercent: 33.33,
    peakActiveConnections: 2,
    peakWaitingRequests: 0,
    peakUtilizationPercent: 66.67,
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

vi.mock("../utils/provider-capacity.js", () => ({
  getLatestProviderCapacityStats: () => ({
    active: 1,
    queued: 2,
    peakActive: 3,
    peakQueued: 4,
    maxActive: 8,
    maxQueued: 32,
    queueTimeoutMs: 5_000,
    executionTimeoutMs: 60_000,
    accepted: 12,
    completed: 9,
    failed: 1,
    rejectedFull: 1,
    timedOut: 0,
    aborted: 0,
    executionTimedOut: 0,
    executionAborted: 0,
    queueWaitP50Ms: 5,
    queueWaitP95Ms: 12,
    executionP50Ms: 300,
    executionP95Ms: 800,
  }),
}));

vi.mock("../observability/runtime-capacity.js", () => ({
  getRuntimeCapacityMetrics: () => ({
    monitoring: true,
    uptimeSeconds: 120,
    eventLoop: {
      delayMeanMs: 1,
      delayP95Ms: 4,
      delayP99Ms: 7,
      delayMaxMs: 10,
      utilizationPercent: 25,
    },
    memory: {
      rssBytes: 100_000_000,
      heapUsedBytes: 25_000_000,
      heapTotalBytes: 50_000_000,
      heapLimitBytes: 100_000_000,
      externalBytes: 4_000_000,
      arrayBuffersBytes: 1_000_000,
      heapUtilizationPercent: 25,
    },
  }),
}));

vi.mock("../services/portal-health.service.js", () => ({
  getPublicPortalStatus: vi.fn(),
  runPortalHealthProbes: vi.fn(),
}));

describe("capacity status route", () => {
  const originalSecret = process.env.STATUS_CRON_SECRET;
  const originalCapacitySecret = process.env.CAPACITY_STATUS_SECRET;
  const originalTargetEnabled = process.env.ONLINE_CAPACITY_TARGET_ENABLED;

  beforeEach(() => {
    process.env.STATUS_CRON_SECRET = "capacity-test-secret";
    process.env.CAPACITY_STATUS_SECRET = "capacity-metrics-secret";
    process.env.ONLINE_CAPACITY_TARGET_ENABLED = "true";
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.STATUS_CRON_SECRET;
    else process.env.STATUS_CRON_SECRET = originalSecret;
    if (originalCapacitySecret === undefined) delete process.env.CAPACITY_STATUS_SECRET;
    else process.env.CAPACITY_STATUS_SECRET = originalCapacitySecret;
    if (originalTargetEnabled === undefined) delete process.env.ONLINE_CAPACITY_TARGET_ENABLED;
    else process.env.ONLINE_CAPACITY_TARGET_ENABLED = originalTargetEnabled;
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
      .set("Authorization", "Bearer capacity-metrics-secret")
      .expect(200);

    expect(response.body).toMatchObject({
      ok: true,
      instanceId: expect.stringMatching(/^[0-9a-f-]{36}$/u),
      chat: { active: 2, queued: 3 },
      provider: { active: 1, queued: 2, failed: 1 },
      runtime: {
        monitoring: true,
        eventLoop: { delayP95Ms: 4, utilizationPercent: 25 },
        memory: { heapUtilizationPercent: 25 },
      },
      database: { pool: { activeConnections: 1 }, queries: { totalQueries: 4 } },
    });
    expect(JSON.stringify(response.body)).not.toMatch(/userId|sessionId|queryText|parameters/i);
  });

  it("uses a dedicated secret and runs only a synthetic read while enabled", async () => {
    const { statusOperationsRouter } = await import("./public-status.routes.js");
    const app = express().use(statusOperationsRouter);
    await request(app)
      .get("/capacity")
      .set("Authorization", "Bearer capacity-test-secret")
      .expect(401);
    await request(app)
      .get("/capacity/database-read")
      .set("Authorization", "Bearer capacity-metrics-secret")
      .expect(200, { ok: true });
  });
});
