import { describe, expect, it } from "vitest";

import {
  SupabaseCircuitBreaker,
  SupabaseCircuitOpenError,
} from "./circuit-breaker";

describe("SupabaseCircuitBreaker", () => {
  it("opens after the threshold and permits only one half-open probe", () => {
    let now = 1_000;
    const circuit = new SupabaseCircuitBreaker(3, 5_000, () => now);

    circuit.recordFailure();
    circuit.recordFailure();
    circuit.recordFailure();
    expect(circuit.snapshot().state).toBe("open");
    expect(() => circuit.beforeRequest()).toThrow(SupabaseCircuitOpenError);

    now += 5_000;
    circuit.beforeRequest();
    expect(circuit.snapshot().state).toBe("half_open");
    expect(() => circuit.beforeRequest()).toThrow(SupabaseCircuitOpenError);

    circuit.recordSuccess();
    expect(circuit.snapshot()).toMatchObject({ state: "closed", consecutiveFailures: 0 });
  });

  it("reopens immediately when the half-open probe fails", () => {
    let now = 10_000;
    const circuit = new SupabaseCircuitBreaker(1, 100, () => now);
    circuit.recordFailure();
    now += 100;
    circuit.beforeRequest();
    circuit.recordFailure();
    expect(circuit.snapshot().state).toBe("open");
  });
});
