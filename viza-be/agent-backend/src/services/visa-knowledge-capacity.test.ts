import { describe, expect, it } from "vitest";
import { VisaKnowledgeCapacityMonitor } from "./visa-knowledge-capacity.js";

describe("visa knowledge capacity metrics", () => {
  it("tracks only bounded low-cardinality request and cancellation aggregates", () => {
    const monitor = new VisaKnowledgeCapacityMonitor();
    const completed = monitor.start();
    const aborted = monitor.start();

    monitor.markExternalStart(completed, "embedding");
    monitor.markBetween(completed);
    monitor.markExternalStart(completed, "vector");
    monitor.markExternalFailure(completed, "vector");
    monitor.markBetween(completed);
    monitor.markBroadFallback(completed, "rest");
    monitor.markExternalStart(completed, "rest");
    monitor.markBetween(completed);
    monitor.finish(completed, "completed", 100, "rest");

    monitor.markExternalStart(aborted, "vector");
    monitor.finish(aborted, "aborted", 400);

    expect(monitor.read()).toEqual({
      active: 0,
      peakActive: 2,
      total: 2,
      completed: 1,
      degraded: 1,
      failed: 0,
      aborted: 1,
      externalRequests: { embedding: 1, vector: 2, rest: 1 },
      externalFailures: { embedding: 0, vector: 1, rest: 0 },
      broadFallbacks: { vector: 0, rest: 1 },
      results: { vector: 0, rest: 1, empty: 0 },
      abortedByPhase: {
        beforeExternal: 0,
        embedding: 0,
        vector: 1,
        rest: 0,
        between: 0,
      },
      durationP50Ms: 100,
      durationP95Ms: 400,
      durationMaxMs: 400,
    });
    expect(JSON.stringify(monitor.read())).not.toMatch(
      /user|session|query|country|visa|message|content|sql|parameter/i,
    );
  });

  it("finishes each trace once and never makes the active count negative", () => {
    const monitor = new VisaKnowledgeCapacityMonitor();
    const trace = monitor.start();

    monitor.finish(trace, "failed", Number.NaN);
    monitor.finish(trace, "completed", 500, "vector");

    expect(monitor.read()).toMatchObject({
      active: 0,
      total: 1,
      completed: 0,
      degraded: 0,
      failed: 1,
      aborted: 0,
      results: { vector: 0, rest: 0, empty: 0 },
      durationP50Ms: 0,
      durationP95Ms: 0,
      durationMaxMs: 0,
    });
  });

  it("classifies aborts before external work and between fallback stages", () => {
    const monitor = new VisaKnowledgeCapacityMonitor();
    const beforeExternal = monitor.start();
    monitor.finish(beforeExternal, "aborted", 1);

    const between = monitor.start();
    monitor.markExternalStart(between, "embedding");
    monitor.markBetween(between);
    monitor.finish(between, "aborted", 2);

    expect(monitor.read().abortedByPhase).toEqual({
      beforeExternal: 1,
      embedding: 0,
      vector: 0,
      rest: 0,
      between: 1,
    });
  });

  it("returns immutable snapshots and drains 100 concurrent requests", () => {
    const monitor = new VisaKnowledgeCapacityMonitor();
    const traces = Array.from({ length: 100 }, () => monitor.start());
    expect(monitor.read()).toMatchObject({ active: 100, peakActive: 100 });

    for (const trace of traces) {
      monitor.finish(trace, "completed", 10, "vector");
    }
    const snapshot = monitor.read();
    snapshot.externalRequests.vector = 999;

    expect(monitor.read()).toMatchObject({
      active: 0,
      peakActive: 100,
      total: 100,
      completed: 100,
      degraded: 0,
      failed: 0,
      aborted: 0,
      externalRequests: { vector: 0 },
      results: { vector: 100 },
      durationP50Ms: 10,
      durationP95Ms: 10,
      durationMaxMs: 10,
    });
  });

  it("keeps only the latest bounded duration window", () => {
    const monitor = new VisaKnowledgeCapacityMonitor();
    for (let durationMs = 0; durationMs < 1_100; durationMs += 1) {
      const trace = monitor.start();
      monitor.finish(trace, "completed", durationMs, "empty");
    }

    expect(monitor.read()).toMatchObject({
      total: 1_100,
      completed: 1_100,
      durationP50Ms: 587,
      durationP95Ms: 1_048,
      durationMaxMs: 1_099,
    });
  });
});
