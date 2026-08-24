export type ChatCapacityErrorCode = 'QUEUE_FULL' | 'QUEUE_TIMEOUT' | 'ABORTED';

export class ChatCapacityError extends Error {
  constructor(public readonly code: ChatCapacityErrorCode) {
    super(code);
    this.name = 'ChatCapacityError';
  }
}
type Release = () => void;

interface Waiter {
  resolve: (release: Release) => void;
  reject: (error: ChatCapacityError) => void;
  timeout: ReturnType<typeof setTimeout>;
  signal?: AbortSignal;
  abortListener?: () => void;
  enqueuedAt: number;
}

export interface ChatCapacityStats {
  active: number;
  queued: number;
  peakActive: number;
  peakQueued: number;
  maxActive: number;
  maxQueued: number;
  queueTimeoutMs: number;
  accepted: number;
  completed: number;
  rejectedFull: number;
  timedOut: number;
  aborted: number;
  queueWaitP50Ms: number;
  queueWaitP95Ms: number;
}

const MAX_WAIT_SAMPLES = 1_024;
let latestChatCapacityStats: ChatCapacityStats | null = null;

function boundedPositiveInteger(
  env: Readonly<Record<string, string | undefined>>,
  name: string,
  fallback: number,
  maximum: number,
): number {
  const parsed = Number.parseInt(env[name] ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

export function readChatCapacityLimits(
  env: Readonly<Record<string, string | undefined>> = process.env,
): { maxActive: number; maxQueued: number; queueTimeoutMs: number } {
  return {
    maxActive: boundedPositiveInteger(env, 'VISA_CHAT_MAX_CONCURRENCY', 16, 100),
    maxQueued: boundedPositiveInteger(env, 'VISA_CHAT_MAX_QUEUE', 64, 1_000),
    queueTimeoutMs: boundedPositiveInteger(env, 'VISA_CHAT_QUEUE_TIMEOUT_MS', 8_000, 60_000),
  };
}

function percentile(samples: readonly number[], quantile: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1);
  return Math.round((sorted[Math.max(0, index)] ?? 0) * 100) / 100;
}

export function getLatestChatCapacityStats(): ChatCapacityStats {
  if (latestChatCapacityStats) return { ...latestChatCapacityStats };
  const limits = readChatCapacityLimits();
  return {
    active: 0,
    queued: 0,
    peakActive: 0,
    peakQueued: 0,
    ...limits,
    accepted: 0,
    completed: 0,
    rejectedFull: 0,
    timedOut: 0,
    aborted: 0,
    queueWaitP50Ms: 0,
    queueWaitP95Ms: 0,
  };
}

export class ChatConcurrencyGate {
  private active = 0;
  private readonly waiters: Waiter[] = [];
  private peakActive = 0;
  private peakQueued = 0;
  private accepted = 0;
  private completed = 0;
  private rejectedFull = 0;
  private timedOut = 0;
  private aborted = 0;
  private readonly queueWaitSamples: number[] = [];

  constructor(
    private readonly maxActive: number,
    private readonly maxQueued: number,
    private readonly queueTimeoutMs: number
  ) {
    if (maxActive < 1 || maxQueued < 0 || queueTimeoutMs < 1) {
      throw new Error('Invalid chat concurrency gate configuration');
    }
    this.publishStats();
  }

  acquire(signal?: AbortSignal): Promise<Release> {
    if (signal?.aborted) {
      this.aborted += 1;
      this.publishStats();
      return Promise.reject(new ChatCapacityError('ABORTED'));
    }

    if (this.active < this.maxActive) {
      this.active += 1;
      this.accepted += 1;
      this.peakActive = Math.max(this.peakActive, this.active);
      this.publishStats();
      return Promise.resolve(this.createRelease());
    }

    if (this.waiters.length >= this.maxQueued) {
      this.rejectedFull += 1;
      this.publishStats();
      return Promise.reject(new ChatCapacityError('QUEUE_FULL'));
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
            this.publishStats();
            reject(new ChatCapacityError('QUEUE_TIMEOUT'));
          }
        }, this.queueTimeoutMs),
      };

      if (signal) {
        waiter.abortListener = () => {
          if (this.removeWaiter(waiter)) {
            this.aborted += 1;
            this.publishStats();
            reject(new ChatCapacityError('ABORTED'));
          }
        };
        signal.addEventListener('abort', waiter.abortListener, { once: true });
      }

      this.waiters.push(waiter);
      this.peakQueued = Math.max(this.peakQueued, this.waiters.length);
      this.publishStats();
    });
  }

  getStats(): ChatCapacityStats {
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
      rejectedFull: this.rejectedFull,
      timedOut: this.timedOut,
      aborted: this.aborted,
      queueWaitP50Ms: percentile(this.queueWaitSamples, 0.5),
      queueWaitP95Ms: percentile(this.queueWaitSamples, 0.95),
    };
  }

  private createRelease(): Release {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.completed += 1;

      while (this.waiters.length > 0) {
        const waiter = this.waiters.shift();
        if (!waiter) break;
        this.cleanupWaiter(waiter);
        if (waiter.signal?.aborted) {
          this.aborted += 1;
          waiter.reject(new ChatCapacityError('ABORTED'));
          continue;
        }
        this.accepted += 1;
        this.recordQueueWait(Date.now() - waiter.enqueuedAt);
        waiter.resolve(this.createRelease());
        this.publishStats();
        return;
      }

      this.active = Math.max(0, this.active - 1);
      this.publishStats();
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
      waiter.signal.removeEventListener('abort', waiter.abortListener);
    }
  }

  private recordQueueWait(durationMs: number): void {
    this.queueWaitSamples.push(Math.max(0, durationMs));
    if (this.queueWaitSamples.length > MAX_WAIT_SAMPLES) this.queueWaitSamples.shift();
  }

  private publishStats(): void {
    latestChatCapacityStats = this.getStats();
  }
}
