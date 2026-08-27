export type ProviderCapacityErrorCode = "QUEUE_FULL" | "QUEUE_TIMEOUT" | "ABORTED";

export class ProviderCapacityError extends Error {
  constructor(public readonly code: ProviderCapacityErrorCode) {
    super(code);
    this.name = "ProviderCapacityError";
  }
}

type ReleaseOutcome = { failed: boolean; durationMs: number };
type Release = (outcome: ReleaseOutcome) => void;

interface Waiter {
  resolve: (release: Release) => void;
  reject: (error: ProviderCapacityError) => void;
  timeout: ReturnType<typeof setTimeout>;
  signal?: AbortSignal;
  abortListener?: () => void;
  enqueuedAt: number;
}

export interface ProviderCapacityStats {
  active: number;
  queued: number;
  peakActive: number;
  peakQueued: number;
  maxActive: number;
  maxQueued: number;
  queueTimeoutMs: number;
  accepted: number;
  completed: number;
  failed: number;
  rejectedFull: number;
  timedOut: number;
  aborted: number;
  queueWaitP50Ms: number;
  queueWaitP95Ms: number;
  executionP50Ms: number;
  executionP95Ms: number;
}

const MAX_SAMPLES = 1_024;
let sharedProviderGate: ProviderConcurrencyGate | null = null;

function boundedPositiveInteger(
  env: Readonly<Record<string, string | undefined>>,
  name: string,
  fallback: number,
  maximum: number,
): number {
  const parsed = Number.parseInt(env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

export function readProviderCapacityLimits(
  env: Readonly<Record<string, string | undefined>> = process.env,
): { maxActive: number; maxQueued: number; queueTimeoutMs: number } {
  return {
    maxActive: boundedPositiveInteger(env, "VIZA_PROVIDER_MAX_CONCURRENCY", 8, 64),
    maxQueued: boundedPositiveInteger(env, "VIZA_PROVIDER_MAX_QUEUE", 32, 512),
    queueTimeoutMs: boundedPositiveInteger(env, "VIZA_PROVIDER_QUEUE_TIMEOUT_MS", 5_000, 60_000),
  };
}

function percentile(samples: readonly number[], quantile: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1);
  return Math.round((sorted[Math.max(0, index)] ?? 0) * 100) / 100;
}

function appendBoundedSample(samples: number[], value: number): void {
  samples.push(Math.max(0, value));
  if (samples.length > MAX_SAMPLES) samples.shift();
}

export class ProviderConcurrencyGate {
  private active = 0;
  private readonly waiters: Waiter[] = [];
  private peakActive = 0;
  private peakQueued = 0;
  private accepted = 0;
  private completed = 0;
  private failed = 0;
  private rejectedFull = 0;
  private timedOut = 0;
  private aborted = 0;
  private readonly queueWaitSamples: number[] = [];
  private readonly executionSamples: number[] = [];

  constructor(
    private readonly maxActive: number,
    private readonly maxQueued: number,
    private readonly queueTimeoutMs: number,
  ) {
    if (maxActive < 1 || maxQueued < 0 || queueTimeoutMs < 1) {
      throw new Error("Invalid provider concurrency gate configuration");
    }
  }

  acquire(signal?: AbortSignal): Promise<Release> {
    if (signal?.aborted) {
      this.aborted += 1;
      return Promise.reject(new ProviderCapacityError("ABORTED"));
    }
    if (this.active < this.maxActive) {
      this.active += 1;
      this.accepted += 1;
      this.peakActive = Math.max(this.peakActive, this.active);
      return Promise.resolve(this.createRelease());
    }
    if (this.waiters.length >= this.maxQueued) {
      this.rejectedFull += 1;
      return Promise.reject(new ProviderCapacityError("QUEUE_FULL"));
    }

    return new Promise<Release>((resolve, reject) => {
      const waiter: Waiter = {
        resolve,
        reject,
        signal,
        enqueuedAt: Date.now(),
        timeout: setTimeout(() => {
          if (this.removeWaiter(waiter)) {
            this.timedOut += 1;
            reject(new ProviderCapacityError("QUEUE_TIMEOUT"));
          }
        }, this.queueTimeoutMs),
      };
      if (signal) {
        waiter.abortListener = () => {
          if (this.removeWaiter(waiter)) {
            this.aborted += 1;
            reject(new ProviderCapacityError("ABORTED"));
          }
        };
        signal.addEventListener("abort", waiter.abortListener, { once: true });
      }
      this.waiters.push(waiter);
      this.peakQueued = Math.max(this.peakQueued, this.waiters.length);
    });
  }

  async run<T>(work: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    const release = await this.acquire(signal);
    const startedAt = Date.now();
    try {
      const result = await work();
      release({ failed: false, durationMs: Date.now() - startedAt });
      return result;
    } catch (error) {
      release({ failed: true, durationMs: Date.now() - startedAt });
      throw error;
    }
  }

  getStats(): ProviderCapacityStats {
    return {
      active: this.active,
      queued: this.waiters.length,
      peakActive: this.peakActive,
      peakQueued: this.peakQueued,
      maxActive: this.maxActive,
      maxQueued: this.maxQueued,
      queueTimeoutMs: this.queueTimeoutMs,
      accepted: this.accepted,
      completed: this.completed,
      failed: this.failed,
      rejectedFull: this.rejectedFull,
      timedOut: this.timedOut,
      aborted: this.aborted,
      queueWaitP50Ms: percentile(this.queueWaitSamples, 0.5),
      queueWaitP95Ms: percentile(this.queueWaitSamples, 0.95),
      executionP50Ms: percentile(this.executionSamples, 0.5),
      executionP95Ms: percentile(this.executionSamples, 0.95),
    };
  }

  private createRelease(): Release {
    let released = false;
    return (outcome) => {
      if (released) return;
      released = true;
      this.completed += 1;
      if (outcome.failed) this.failed += 1;
      appendBoundedSample(this.executionSamples, outcome.durationMs);

      while (this.waiters.length > 0) {
        const waiter = this.waiters.shift();
        if (!waiter) break;
        this.cleanupWaiter(waiter);
        if (waiter.signal?.aborted) {
          this.aborted += 1;
          waiter.reject(new ProviderCapacityError("ABORTED"));
          continue;
        }
        this.accepted += 1;
        appendBoundedSample(this.queueWaitSamples, Date.now() - waiter.enqueuedAt);
        waiter.resolve(this.createRelease());
        return;
      }
      this.active = Math.max(0, this.active - 1);
    };
  }

  private removeWaiter(waiter: Waiter): boolean {
    const index = this.waiters.indexOf(waiter);
    if (index < 0) return false;
    this.waiters.splice(index, 1);
    this.cleanupWaiter(waiter);
    return true;
  }

  private cleanupWaiter(waiter: Waiter): void {
    clearTimeout(waiter.timeout);
    if (waiter.signal && waiter.abortListener) {
      waiter.signal.removeEventListener("abort", waiter.abortListener);
    }
  }

}

function getSharedProviderGate(): ProviderConcurrencyGate {
  if (!sharedProviderGate) {
    const limits = readProviderCapacityLimits();
    sharedProviderGate = new ProviderConcurrencyGate(
      limits.maxActive,
      limits.maxQueued,
      limits.queueTimeoutMs,
    );
  }
  return sharedProviderGate;
}

export function runWithProviderCapacity<T>(work: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  return getSharedProviderGate().run(work, signal);
}

export function getLatestProviderCapacityStats(): ProviderCapacityStats {
  if (sharedProviderGate) return sharedProviderGate.getStats();
  const limits = readProviderCapacityLimits();
  return {
    active: 0,
    queued: 0,
    peakActive: 0,
    peakQueued: 0,
    ...limits,
    accepted: 0,
    completed: 0,
    failed: 0,
    rejectedFull: 0,
    timedOut: 0,
    aborted: 0,
    queueWaitP50Ms: 0,
    queueWaitP95Ms: 0,
    executionP50Ms: 0,
    executionP95Ms: 0,
  };
}
