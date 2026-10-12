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

export interface SupabaseCircuitRequest {
  recordSuccess(): void;
  recordFailure(): void;
  release(): void;
}

export class SupabaseCircuitBreaker {
  private consecutiveFailures = 0;
  private openedAt: number | null = null;
  private halfOpenProbeInFlight: symbol | null = null;
  private generation = 0;

  constructor(
    private readonly failureThreshold = 5,
    private readonly openDurationMs = 20_000,
    private readonly now: () => number = Date.now,
  ) {}

  beforeRequest(): SupabaseCircuitRequest {
    let probe: symbol | null = null;
    if (this.openedAt !== null) {
      const elapsed = this.now() - this.openedAt;
      if (elapsed < this.openDurationMs) {
        throw new SupabaseCircuitOpenError(this.openDurationMs - elapsed);
      }

      if (this.halfOpenProbeInFlight !== null) {
        throw new SupabaseCircuitOpenError(1_000);
      }
      probe = Symbol("supabase-recovery-probe");
      this.halfOpenProbeInFlight = probe;
    }

    const generation = this.generation;
    let settled = false;
    const settle = (outcome: "success" | "failure" | "release") => {
      if (settled) return;
      settled = true;
      // Late requests from before an outage must not unlock a newer probe or
      // overwrite the health established by a subsequent recovery attempt.
      if (generation !== this.generation) return;
      if (outcome === "success") this.recordSuccess();
      else if (outcome === "failure") this.recordFailure();
      else if (probe !== null && this.halfOpenProbeInFlight === probe) {
        this.halfOpenProbeInFlight = null;
      }
    };

    return {
      recordSuccess: () => settle("success"),
      recordFailure: () => settle("failure"),
      release: () => settle("release"),
    };
  }

  recordSuccess(): void {
    if (this.openedAt !== null) this.generation += 1;
    this.consecutiveFailures = 0;
    this.openedAt = null;
    this.halfOpenProbeInFlight = null;
  }

  recordFailure(): void {
    this.halfOpenProbeInFlight = null;
    this.consecutiveFailures += 1;
    if (this.openedAt !== null || this.consecutiveFailures >= this.failureThreshold) {
      this.openedAt = this.now();
      this.generation += 1;
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

// Version the process-local registry when the request-permit contract changes
// so development hot reload cannot reuse instances of the previous class.
const globalCircuitMapKey = Symbol.for("viza.supabase.circuit-breakers.v2");
type GlobalWithCircuits = typeof globalThis & {
  [globalCircuitMapKey]?: Map<string, SupabaseCircuitBreaker>;
};

export function getSupabaseCircuitBreaker(scope = "default"): SupabaseCircuitBreaker {
  const sharedGlobal = globalThis as GlobalWithCircuits;
  sharedGlobal[globalCircuitMapKey] ??= new Map();
  const circuits = sharedGlobal[globalCircuitMapKey];
  const existing = circuits.get(scope);
  if (existing) return existing;

  const circuit = new SupabaseCircuitBreaker();
  circuits.set(scope, circuit);
  return circuit;
}
