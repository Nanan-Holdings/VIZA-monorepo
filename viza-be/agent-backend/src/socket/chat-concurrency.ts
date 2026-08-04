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
}

export class ChatConcurrencyGate {
  private active = 0;
  private readonly waiters: Waiter[] = [];

  constructor(
    private readonly maxActive: number,
    private readonly maxQueued: number,
    private readonly queueTimeoutMs: number
  ) {
    if (maxActive < 1 || maxQueued < 0 || queueTimeoutMs < 1) {
      throw new Error('Invalid chat concurrency gate configuration');
    }
  }

  acquire(signal?: AbortSignal): Promise<Release> {
    if (signal?.aborted) {
      return Promise.reject(new ChatCapacityError('ABORTED'));
    }

    if (this.active < this.maxActive) {
      this.active += 1;
      return Promise.resolve(this.createRelease());
    }

    if (this.waiters.length >= this.maxQueued) {
      return Promise.reject(new ChatCapacityError('QUEUE_FULL'));
    }

    return new Promise<Release>((resolve, reject) => {
      const waiter: Waiter = {
        resolve,
        reject,
        signal,
        timeout: setTimeout(() => {
          this.removeWaiter(waiter);
          reject(new ChatCapacityError('QUEUE_TIMEOUT'));
        }, this.queueTimeoutMs),
      };

      if (signal) {
        waiter.abortListener = () => {
          this.removeWaiter(waiter);
          reject(new ChatCapacityError('ABORTED'));
        };
        signal.addEventListener('abort', waiter.abortListener, { once: true });
      }

      this.waiters.push(waiter);
    });
  }

  getStats(): { active: number; queued: number } {
    return { active: this.active, queued: this.waiters.length };
  }

  private createRelease(): Release {
    let released = false;
    return () => {
      if (released) return;
      released = true;

      while (this.waiters.length > 0) {
        const waiter = this.waiters.shift();
        if (!waiter) break;
        this.cleanupWaiter(waiter);
        if (waiter.signal?.aborted) {
          waiter.reject(new ChatCapacityError('ABORTED'));
          continue;
        }
        waiter.resolve(this.createRelease());
        return;
      }

      this.active = Math.max(0, this.active - 1);
    };
  }

  private removeWaiter(waiter: Waiter): void {
    const index = this.waiters.indexOf(waiter);
    if (index >= 0) this.waiters.splice(index, 1);
    this.cleanupWaiter(waiter);
  }

  private cleanupWaiter(waiter: Waiter): void {
    clearTimeout(waiter.timeout);
    if (waiter.signal && waiter.abortListener) {
      waiter.signal.removeEventListener('abort', waiter.abortListener);
    }
  }
}
