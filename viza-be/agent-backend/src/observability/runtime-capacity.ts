import {
  monitorEventLoopDelay,
  performance,
  type EventLoopUtilization,
} from "node:perf_hooks";
import { getHeapStatistics } from "node:v8";

interface DelayMonitor {
  readonly mean: number;
  readonly max: number;
  percentile(value: number): number;
  reset(): void;
  enable(): void;
  disable(): void;
}

interface RuntimeMemoryUsage {
  rss: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
}

interface RuntimeCapacityDependencies {
  delayMonitor: DelayMonitor;
  readEventLoopSnapshot: () => EventLoopUtilization;
  calculateEventLoopDelta: (
    current: EventLoopUtilization,
    previous: EventLoopUtilization,
  ) => EventLoopUtilization;
  readMemoryUsage: () => RuntimeMemoryUsage;
  readHeapLimit: () => number;
  readUptime: () => number;
}

export interface RuntimeCapacityMetrics {
  monitoring: boolean;
  uptimeSeconds: number;
  eventLoop: {
    delayMeanMs: number;
    delayP95Ms: number;
    delayP99Ms: number;
    delayMaxMs: number;
    utilizationPercent: number;
  };
  memory: {
    rssBytes: number;
    heapUsedBytes: number;
    heapTotalBytes: number;
    heapLimitBytes: number;
    externalBytes: number;
    arrayBuffersBytes: number;
    heapUtilizationPercent: number;
  };
}

export interface RuntimeCapacityMonitor {
  start(): void;
  stop(): void;
  read(): RuntimeCapacityMetrics;
}

function nonNegativeFinite(value: number): number {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function rounded(value: number, digits = 2): number {
  const multiplier = 10 ** digits;
  return Math.round(nonNegativeFinite(value) * multiplier) / multiplier;
}

function bytes(value: number): number {
  return Math.round(nonNegativeFinite(value));
}

function nanosecondsToMilliseconds(value: number): number {
  return rounded(value / 1_000_000);
}

export function createRuntimeCapacityMonitor(
  dependencies: RuntimeCapacityDependencies,
): RuntimeCapacityMonitor {
  let monitoring = false;
  let previousEventLoopSnapshot: EventLoopUtilization | null = null;

  return {
    start() {
      if (monitoring) return;
      dependencies.delayMonitor.reset();
      dependencies.delayMonitor.enable();
      previousEventLoopSnapshot = dependencies.readEventLoopSnapshot();
      monitoring = true;
    },
    stop() {
      if (!monitoring) return;
      dependencies.delayMonitor.disable();
      monitoring = false;
      previousEventLoopSnapshot = null;
    },
    read() {
      let utilizationPercent = 0;
      if (monitoring && previousEventLoopSnapshot) {
        const currentEventLoopSnapshot = dependencies.readEventLoopSnapshot();
        const eventLoopDelta = dependencies.calculateEventLoopDelta(
          currentEventLoopSnapshot,
          previousEventLoopSnapshot,
        );
        previousEventLoopSnapshot = currentEventLoopSnapshot;
        utilizationPercent = rounded(eventLoopDelta.utilization * 100);
      }

      const memory = dependencies.readMemoryUsage();
      const heapLimitBytes = bytes(dependencies.readHeapLimit());
      const heapUsedBytes = bytes(memory.heapUsed);
      const metrics: RuntimeCapacityMetrics = {
        monitoring,
        uptimeSeconds: rounded(dependencies.readUptime()),
        eventLoop: {
          delayMeanMs: monitoring ? nanosecondsToMilliseconds(dependencies.delayMonitor.mean) : 0,
          delayP95Ms: monitoring
            ? nanosecondsToMilliseconds(dependencies.delayMonitor.percentile(95))
            : 0,
          delayP99Ms: monitoring
            ? nanosecondsToMilliseconds(dependencies.delayMonitor.percentile(99))
            : 0,
          delayMaxMs: monitoring ? nanosecondsToMilliseconds(dependencies.delayMonitor.max) : 0,
          utilizationPercent,
        },
        memory: {
          rssBytes: bytes(memory.rss),
          heapUsedBytes,
          heapTotalBytes: bytes(memory.heapTotal),
          heapLimitBytes,
          externalBytes: bytes(memory.external),
          arrayBuffersBytes: bytes(memory.arrayBuffers),
          heapUtilizationPercent: heapLimitBytes > 0
            ? rounded((heapUsedBytes / heapLimitBytes) * 100)
            : 0,
        },
      };
      if (monitoring) dependencies.delayMonitor.reset();
      return metrics;
    },
  };
}

const eventLoopDelayMonitor = monitorEventLoopDelay({ resolution: 50 });
const runtimeCapacityMonitor = createRuntimeCapacityMonitor({
  delayMonitor: eventLoopDelayMonitor,
  readEventLoopSnapshot: () => performance.eventLoopUtilization(),
  calculateEventLoopDelta: (current, previous) =>
    performance.eventLoopUtilization(current, previous),
  readMemoryUsage: () => process.memoryUsage(),
  readHeapLimit: () => getHeapStatistics().heap_size_limit,
  readUptime: () => process.uptime(),
});

export const startRuntimeCapacityMonitor = () => runtimeCapacityMonitor.start();
export const stopRuntimeCapacityMonitor = () => runtimeCapacityMonitor.stop();
export const getRuntimeCapacityMetrics = () => runtimeCapacityMonitor.read();
