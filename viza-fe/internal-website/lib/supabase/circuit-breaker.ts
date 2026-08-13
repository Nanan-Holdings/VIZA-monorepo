type CircuitState = "closed" | "open" | "half_open";

export class SupabaseCircuitOpenError extends Error {
  constructor(public readonly retryAfterMs: number) {
    super("Supabase request blocked: circuit open after timeout or network failures");
    this.name = "SupabaseCircuitOpenError";
  }
}

export interface CircuitSnapshot {
  state: CircuitState;
  consecutiveFailures: number;
  openedAt: number | null;
}

export class SupabaseCircuitBreaker {
  private consecutiveFailures = 0;
  private openedAt: number | null = null;
  private halfOpenProbeInFlight = false;

  constructor(
    private readonly failureThreshold = 5,
    private readonly openDurationMs = 20_000,
    private readonly now: () => number = Date.now,
  ) {}

  beforeRequest(): void {
    if (this.openedAt === null) return;

    const elapsed = this.now() - this.openedAt;
    if (elapsed < this.openDurationMs) {
      throw new SupabaseCircuitOpenError(this.openDurationMs - elapsed);
    }

    if (this.halfOpenProbeInFlight) {
      throw new SupabaseCircuitOpenError(1_000);
    }
    this.halfOpenProbeInFlight = true;
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.openedAt = null;
    this.halfOpenProbeInFlight = false;
  }

  recordFailure(): void {
    this.halfOpenProbeInFlight = false;
    this.consecutiveFailures += 1;
    if (this.openedAt !== null || this.consecutiveFailures >= this.failureThreshold) {
      this.openedAt = this.now();
    }
  }

  snapshot(): CircuitSnapshot {
    const halfOpen = this.openedAt !== null && this.now() - this.openedAt >= this.openDurationMs;
    return {
      state: this.openedAt === null ? "closed" : halfOpen ? "half_open" : "open",
      consecutiveFailures: this.consecutiveFailures,
      openedAt: this.openedAt,
    };
  }
}

const globalCircuitKey = Symbol.for("viza.supabase.circuit-breaker");
type GlobalWithCircuit = typeof globalThis & {
  [globalCircuitKey]?: SupabaseCircuitBreaker;
};

export function getSupabaseCircuitBreaker(): SupabaseCircuitBreaker {
  const sharedGlobal = globalThis as GlobalWithCircuit;
  sharedGlobal[globalCircuitKey] ??= new SupabaseCircuitBreaker();
  return sharedGlobal[globalCircuitKey];
}
