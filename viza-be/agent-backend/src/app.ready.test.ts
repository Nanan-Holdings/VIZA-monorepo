import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const readinessMocks = vi.hoisted(() => ({
  testSupabaseConnection: vi.fn(),
  testActiveKnowledgeRelease: vi.fn(),
  socketStatus: vi.fn(),
}));

vi.mock("./db/supabase-client.js", async () => {
  const actual = await vi.importActual<typeof import("./db/supabase-client.js")>(
    "./db/supabase-client.js",
  );
  return {
    ...actual,
    testSupabaseConnection: readinessMocks.testSupabaseConnection,
    testActiveKnowledgeRelease: readinessMocks.testActiveKnowledgeRelease,
  };
});

vi.mock("./db/index.js", () => ({
  db: { execute: vi.fn() },
  getDatabasePoolMetrics: vi.fn(),
  getDatabaseQueryMetrics: vi.fn(),
}));

vi.mock("./socket/socket-scaling.js", () => ({
  getSocketScalingStatus: readinessMocks.socketStatus,
}));

import app from "./app.js";

describe("GET /ready", () => {
  beforeEach(() => {
    readinessMocks.testSupabaseConnection.mockResolvedValue({
      success: true,
      message: "ok",
      latencyMs: 5,
    });
    readinessMocks.socketStatus.mockReturnValue({
      mode: "memory",
      multiReplicaEnabled: false,
      adapterReady: true,
      transports: ["polling", "websocket"],
    });
    readinessMocks.testActiveKnowledgeRelease.mockResolvedValue({
      success: true,
      message: "ok",
      latencyMs: 5,
      releaseId: "release-id",
      releaseKey: "release-key",
    });
  });

  it("keeps legacy health at 200 for a single replica but removes a multi-replica instance when its adapter is down", async () => {
    readinessMocks.testActiveKnowledgeRelease.mockResolvedValueOnce({
      success: false,
      message: "supabase unavailable",
      latencyMs: 5,
      releaseId: null,
      releaseKey: null,
    });
    await request(app).get("/health").expect(200);

    readinessMocks.socketStatus.mockReturnValue({
      mode: "redis",
      multiReplicaEnabled: true,
      adapterReady: false,
      transports: ["websocket"],
    });
    const response = await request(app).get("/health").expect(503);
    expect(response.body).toMatchObject({
      status: "degraded",
      error: "socket_adapter_unavailable",
      socket: {
        mode: "redis",
        adapterStatus: "unavailable",
        transports: ["websocket"],
      },
    });
  });

  it("is ready when Supabase and the configured socket adapter are ready", async () => {
    const response = await request(app).get("/ready").expect(200);

    expect(response.body).toMatchObject({
      status: "ready",
      dependencyStatus: "ok",
      error: null,
      socket: {
        mode: "memory",
        adapterStatus: "ok",
        transports: ["polling", "websocket"],
      },
    });
  });

  it("fails closed without exposing Redis configuration when the shared adapter is unavailable", async () => {
    readinessMocks.socketStatus.mockReturnValue({
      mode: "redis",
      multiReplicaEnabled: true,
      adapterReady: false,
      transports: ["websocket"],
    });

    const response = await request(app).get("/ready").expect(503);

    expect(response.body).toMatchObject({
      status: "not_ready",
      dependencyStatus: "ok",
      error: "socket_adapter_unavailable",
      socket: {
        mode: "redis",
        multiReplicaEnabled: true,
        adapterStatus: "unavailable",
        transports: ["websocket"],
      },
    });
    expect(JSON.stringify(response.body)).not.toMatch(/redisUrl|password|secret|host/u);
  });
});
