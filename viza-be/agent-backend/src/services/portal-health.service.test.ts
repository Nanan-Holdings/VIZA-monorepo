import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { classifyPortalProbe } from "./portal-health.service.js";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("../db/supabase-client.js", () => ({ getSupabaseClient: () => mocks }));
vi.mock("../db/index.js", () => ({
  db: {}, getDatabasePoolMetrics: vi.fn(), getDatabaseQueryMetrics: vi.fn(),
}));
vi.mock("../utils/logger.js", () => ({
  Logger: class { info() {} error() {} warn() {} },
}));

interface RpcResult { data: object | null; error: { message: string } | null }
const snapshot = { version: 1, summary: { status: "operational" }, monitors: [] };

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.rpc.mockImplementation(() => ({
    abortSignal: () => Promise.resolve({ data: snapshot, error: null }),
  }));
});

afterEach(() => { vi.useRealTimers(); });

describe("classifyPortalProbe", () => {
  it("treats fast successful responses as operational", () => {
    expect(classifyPortalProbe(200, 120)).toBe("ok");
  });

  it("treats slow successes and access gates as degraded", () => {
    expect(classifyPortalProbe(200, 5_001)).toBe("degraded");
    expect(classifyPortalProbe(403, 120)).toBe("degraded");
  });

  it("treats upstream server failures as down", () => {
    expect(classifyPortalProbe(503, 120)).toBe("down");
  });
});

describe("public status concurrency", () => {
  it("coalesces 1,000 simultaneous reads into one RPC and refreshes after ten seconds", async () => {
    vi.useFakeTimers();
    const { getPublicPortalStatus } = await import("./portal-health.service.js");
    const results = await Promise.all(Array.from({ length: 1_000 }, () => getPublicPortalStatus()));
    expect(results.every((value) => value === snapshot)).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("get_public_portal_status", { p_days: 90 });
    await vi.advanceTimersByTimeAsync(9_999);
    await getPublicPortalStatus();
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await getPublicPortalStatus();
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });

  it("does not cache failed or empty RPC responses", async () => {
    const { getPublicPortalStatus } = await import("./portal-health.service.js");
    mocks.rpc.mockImplementationOnce(() => ({
      abortSignal: () => Promise.resolve({ data: null, error: { message: "unavailable" } }),
    }));
    await expect(getPublicPortalStatus()).rejects.toThrow("Public status snapshot failed");
    mocks.rpc.mockImplementationOnce(() => ({
      abortSignal: () => Promise.resolve({ data: null, error: null }),
    }));
    await expect(getPublicPortalStatus()).rejects.toThrow("Public status snapshot was empty");
    await expect(getPublicPortalStatus()).resolves.toEqual(snapshot);
    expect(mocks.rpc).toHaveBeenCalledTimes(3);
  });

  it("aborts a stalled shared RPC after eight seconds and permits recovery", async () => {
    vi.useFakeTimers();
    const { getPublicPortalStatus } = await import("./portal-health.service.js");
    let signal: AbortSignal | undefined;
    mocks.rpc.mockImplementationOnce(() => ({
      abortSignal: (requestSignal: AbortSignal) => new Promise<RpcResult>((resolve) => {
        signal = requestSignal;
        requestSignal.addEventListener("abort", () => resolve({
          data: null, error: { message: "aborted" },
        }), { once: true });
      }),
    }));
    const rejected = expect(getPublicPortalStatus()).rejects.toThrow("aborted");
    await vi.advanceTimersByTimeAsync(7_999);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await rejected;
    expect(signal?.aborted).toBe(true);
    await expect(getPublicPortalStatus()).resolves.toEqual(snapshot);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("invalidates the cached snapshot when a probe run finishes", async () => {
    const { getPublicPortalStatus, runPortalHealthProbes } = await import("./portal-health.service.js");
    const chain = { select: vi.fn(), eq: vi.fn(), order: vi.fn() };
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.order.mockResolvedValue({ data: [], error: null });
    mocks.from.mockReturnValue(chain);
    await getPublicPortalStatus();
    await runPortalHealthProbes();
    await getPublicPortalStatus();
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });

  it("serves 100 concurrent HTTP requests from one redacted snapshot lookup", async () => {
    const { publicStatusRouter } = await import("../routes/public-status.routes.js");
    const app = express().use("/api/public/status", publicStatusRouter);
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });
    try {
      const responses = await Promise.all(Array.from({ length: 100 }, () =>
        request(server).get("/api/public/status"),
      ));
      expect(responses.every((response) => response.status === 200)).toBe(true);
      expect(responses.every((response) => JSON.stringify(response.body) === JSON.stringify(snapshot))).toBe(true);
      expect(responses[0].headers["cache-control"]).toBe("public, max-age=30, stale-while-revalidate=120");
      expect(mocks.rpc).toHaveBeenCalledTimes(1);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("keeps a fresh probe result when the invalidated older snapshot finishes last", async () => {
    const { getPublicPortalStatus, runPortalHealthProbes } = await import("./portal-health.service.js");
    let releaseOld!: (value: RpcResult) => void;
    mocks.rpc.mockImplementationOnce(() => ({
      abortSignal: () => new Promise<RpcResult>((resolve) => { releaseOld = resolve; }),
    }));
    const chain = { select: vi.fn(), eq: vi.fn(), order: vi.fn() };
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.order.mockResolvedValue({ data: [], error: null });
    mocks.from.mockReturnValue(chain);

    const old = getPublicPortalStatus();
    await runPortalHealthProbes();
    await expect(getPublicPortalStatus()).resolves.toEqual(snapshot);
    const stale = { ...snapshot, summary: { status: "degraded" } };
    releaseOld({ data: stale, error: null });
    await expect(old).resolves.toEqual(stale);
    await expect(getPublicPortalStatus()).resolves.toEqual(snapshot);
    // At the explicit invalidation boundary a fresh RPC can overlap the old
    // bounded RPC, but no further lookup or stale cache write is allowed.
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });

  it("returns a non-cacheable 503 on RPC failure and recovers on the next HTTP request", async () => {
    const { publicStatusRouter } = await import("../routes/public-status.routes.js");
    const app = express().use("/api/public/status", publicStatusRouter);
    mocks.rpc.mockImplementationOnce(() => ({
      abortSignal: () => Promise.resolve({ data: null, error: { message: "private backend detail" } }),
    }));
    const failed = await request(app).get("/api/public/status");
    expect(failed.status).toBe(503);
    expect(failed.headers["cache-control"]).toBe("no-store");
    expect(failed.body).toEqual({ ok: false, error: "status_snapshot_unavailable" });
    expect((await request(app).get("/api/public/status")).status).toBe(200);
  });
});
