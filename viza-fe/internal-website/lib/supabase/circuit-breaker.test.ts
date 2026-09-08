import { describe, expect, it } from "vitest";

import {
  getSupabaseCircuitBreaker,
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

  it("isolates authentication failures from ordinary data requests", () => {
    const authCircuit = getSupabaseCircuitBreaker(`auth-${crypto.randomUUID()}`);
    const dataCircuit = getSupabaseCircuitBreaker(`data-${crypto.randomUUID()}`);

    for (let attempt = 0; attempt < 5; attempt += 1) authCircuit.recordFailure();

    expect(authCircuit.snapshot().state).toBe("open");
    expect(dataCircuit.snapshot().state).toBe("closed");
    expect(() => dataCircuit.beforeRequest()).not.toThrow();
  });

  it("admits one of 100 recovery requests and permits a new probe after cancellation", () => {
    let now = 1_000;
    const circuit = new SupabaseCircuitBreaker(1, 100, () => now);
    circuit.beforeRequest().recordFailure();
    now += 100;

    const probes: ReturnType<typeof circuit.beforeRequest>[] = [];
    let blocked = 0;
    for (let index = 0; index < 100; index += 1) {
      try {
        probes.push(circuit.beforeRequest());
      } catch (error) {
        expect(error).toBeInstanceOf(SupabaseCircuitOpenError);
        blocked += 1;
      }
    }
    expect(probes).toHaveLength(1);
    expect(blocked).toBe(99);
    const beforeCancellation = circuit.snapshot();
    probes[0].release();
    expect(circuit.snapshot()).toEqual(beforeCancellation);

    const replacementProbe = circuit.beforeRequest();
    // Cleanup and late callbacks from the cancelled probe cannot free its
    // replacement or falsely declare the database recovered.
    probes[0].release();
    probes[0].recordSuccess();
    probes[0].recordFailure();
    expect(() => circuit.beforeRequest()).toThrow(SupabaseCircuitOpenError);
    replacementProbe.recordSuccess();
    expect(circuit.snapshot()).toMatchObject({ state: "closed", consecutiveFailures: 0 });
  });

  it.each(["recordSuccess", "recordFailure", "release"] as const)(
    "ignores a late %s from before the outage while a new recovery probe runs",
    (outcome) => {
      let now = 1_000;
      const circuit = new SupabaseCircuitBreaker(1, 100, () => now);
      const oldRequest = circuit.beforeRequest();
      circuit.beforeRequest().recordFailure();
      now += 100;
      const recoveryProbe = circuit.beforeRequest();
      const beforeLateSettlement = circuit.snapshot();

      oldRequest[outcome]();

      expect(circuit.snapshot()).toEqual(beforeLateSettlement);
      expect(() => circuit.beforeRequest()).toThrow(SupabaseCircuitOpenError);
      recoveryProbe.recordSuccess();
      expect(circuit.snapshot().state).toBe("closed");
    },
  );

  it("does not reopen a recovered circuit because an older request failed late", () => {
    let now = 1_000;
    const circuit = new SupabaseCircuitBreaker(1, 100, () => now);
    const oldRequest = circuit.beforeRequest();
    circuit.beforeRequest().recordFailure();
    now += 100;
    circuit.beforeRequest().recordSuccess();

    oldRequest.recordFailure();

    expect(circuit.snapshot()).toMatchObject({ state: "closed", consecutiveFailures: 0 });
    expect(() => circuit.beforeRequest()).not.toThrow();
  });

  it("settles a failed probe once and retains its cooldown after cleanup", () => {
    let now = 1_000;
    const circuit = new SupabaseCircuitBreaker(1, 100, () => now);
    circuit.beforeRequest().recordFailure();
    now += 100;
    const probe = circuit.beforeRequest();
    probe.recordFailure();
    probe.release();
    probe.recordSuccess();

    expect(circuit.snapshot()).toMatchObject({ state: "open", consecutiveFailures: 2 });
    expect(() => circuit.beforeRequest()).toThrow(SupabaseCircuitOpenError);
    now += 100;
    expect(() => circuit.beforeRequest()).not.toThrow();
  });
});
