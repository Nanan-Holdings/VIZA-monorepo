import { describe, expect, it, vi } from "vitest";

import { createRuntimeCapacityMonitor } from "./runtime-capacity.js";

describe("runtime capacity metrics", () => {
  it("returns bounded low-cardinality event-loop and memory aggregates", () => {
    const reset = vi.fn();
    const enable = vi.fn();
    const disable = vi.fn();
    const snapshots = [
      { idle: 10, active: 5, utilization: 1 / 3 },
      { idle: 20, active: 20, utilization: 0.5 },
    ];
    let snapshotIndex = 0;
    const monitor = createRuntimeCapacityMonitor({
      delayMonitor: {
        mean: 2_500_000,
        max: 12_250_000,
        percentile: (value) => value === 95 ? 8_750_000 : 10_500_000,
        reset,
        enable,
        disable,
      },
      readEventLoopSnapshot: () => snapshots[Math.min(snapshotIndex++, 1)]!,
      calculateEventLoopDelta: (current) => current,
      readMemoryUsage: () => ({
        rss: 120_000_000,
        heapUsed: 40_000_000,
        heapTotal: 64_000_000,
        external: 5_000_000,
        arrayBuffers: 2_000_000,
      }),
      readHeapLimit: () => 100_000_000,
      readUptime: () => 123.456,
    });
    monitor.start();

    expect(monitor.read()).toEqual({
      monitoring: true,
      uptimeSeconds: 123.46,
      eventLoop: {
        delayMeanMs: 2.5,
        delayP95Ms: 8.75,
        delayP99Ms: 10.5,
        delayMaxMs: 12.25,
        utilizationPercent: 50,
      },
      memory: {
        rssBytes: 120_000_000,
        heapUsedBytes: 40_000_000,
        heapTotalBytes: 64_000_000,
        heapLimitBytes: 100_000_000,
        externalBytes: 5_000_000,
        arrayBuffersBytes: 2_000_000,
        heapUtilizationPercent: 40,
      },
    });
    expect(reset).toHaveBeenCalledTimes(2);
    expect(enable).toHaveBeenCalledOnce();
    monitor.stop();
    expect(disable).toHaveBeenCalledOnce();
  });

  it("normalizes empty or non-finite delay samples to zero", () => {
    const monitor = createRuntimeCapacityMonitor({
      delayMonitor: {
        mean: Number.NaN,
        max: Number.POSITIVE_INFINITY,
        percentile: () => Number.NaN,
        reset: vi.fn(),
        enable: vi.fn(),
        disable: vi.fn(),
      },
      readEventLoopSnapshot: () => ({ idle: 0, active: 0, utilization: Number.NaN }),
      calculateEventLoopDelta: (current) => current,
      readMemoryUsage: () => ({ rss: 0, heapUsed: 0, heapTotal: 0, external: 0, arrayBuffers: 0 }),
      readHeapLimit: () => 0,
      readUptime: () => 0,
    });
    monitor.start();

    expect(monitor.read()).toMatchObject({
      eventLoop: {
        delayMeanMs: 0,
        delayP95Ms: 0,
        delayP99Ms: 0,
        delayMaxMs: 0,
        utilizationPercent: 0,
      },
      memory: { heapUtilizationPercent: 0 },
    });
  });

  it("starts and stops the histogram idempotently", () => {
    const enable = vi.fn();
    const disable = vi.fn();
    const monitor = createRuntimeCapacityMonitor({
      delayMonitor: {
        mean: 0,
        max: 0,
        percentile: () => 0,
        reset: vi.fn(),
        enable,
        disable,
      },
      readEventLoopSnapshot: () => ({ idle: 0, active: 0, utilization: 0 }),
      calculateEventLoopDelta: (current) => current,
      readMemoryUsage: () => ({ rss: 0, heapUsed: 0, heapTotal: 0, external: 0, arrayBuffers: 0 }),
      readHeapLimit: () => 0,
      readUptime: () => 0,
    });

    monitor.start();
    monitor.start();
    monitor.stop();
    monitor.stop();
    expect(enable).toHaveBeenCalledOnce();
    expect(disable).toHaveBeenCalledOnce();
    expect(monitor.read().monitoring).toBe(false);
  });
});
