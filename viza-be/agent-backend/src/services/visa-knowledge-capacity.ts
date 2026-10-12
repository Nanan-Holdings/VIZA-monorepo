export type VisaKnowledgeExternalPhase =
  | "beforeExternal"
  | "embedding"
  | "vector"
  | "rest"
  | "between";

export type VisaKnowledgeExternalKind = "embedding" | "vector" | "rest";
export type VisaKnowledgeRequestOutcome = "completed" | "failed" | "aborted";
export type VisaKnowledgeResultSource = "vector" | "rest" | "empty";

export interface VisaKnowledgeRequestTrace {
  phase: VisaKnowledgeExternalPhase;
  finished: boolean;
  degraded: boolean;
}

export interface VisaKnowledgeCapacityMetrics {
  active: number;
  peakActive: number;
  total: number;
  completed: number;
  degraded: number;
  failed: number;
  aborted: number;
  externalRequests: Record<VisaKnowledgeExternalKind, number>;
  externalFailures: Record<VisaKnowledgeExternalKind, number>;
  broadFallbacks: {
    vector: number;
    rest: number;
  };
  results: Record<VisaKnowledgeResultSource, number>;
  abortedByPhase: Record<VisaKnowledgeExternalPhase, number>;
  durationP50Ms: number;
  durationP95Ms: number;
  durationMaxMs: number;
}

const MAX_DURATION_SAMPLES = 1_024;

function increment(value: number): number {
  return Math.min(Number.MAX_SAFE_INTEGER, value + 1);
}

function percentile(samples: readonly number[], quantile: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * quantile) - 1),
  );
  return Math.round((sorted[index] ?? 0) * 100) / 100;
}

function blankExternalCounts(): Record<VisaKnowledgeExternalKind, number> {
  return { embedding: 0, vector: 0, rest: 0 };
}

function blankAbortCounts(): Record<VisaKnowledgeExternalPhase, number> {
  return {
    beforeExternal: 0,
    embedding: 0,
    vector: 0,
    rest: 0,
    between: 0,
  };
}

export class VisaKnowledgeCapacityMonitor {
  private active = 0;
  private peakActive = 0;
  private total = 0;
  private completed = 0;
  private degraded = 0;
  private failed = 0;
  private aborted = 0;
  private readonly externalRequests = blankExternalCounts();
  private readonly externalFailures = blankExternalCounts();
  private readonly broadFallbacks = { vector: 0, rest: 0 };
  private readonly results: Record<VisaKnowledgeResultSource, number> = {
    vector: 0,
    rest: 0,
    empty: 0,
  };
  private readonly abortedByPhase = blankAbortCounts();
  private readonly durationSamples: number[] = [];

  start(): VisaKnowledgeRequestTrace {
    this.active = increment(this.active);
    this.peakActive = Math.max(this.peakActive, this.active);
    this.total = increment(this.total);
    return { phase: "beforeExternal", finished: false, degraded: false };
  }

  markExternalStart(
    trace: VisaKnowledgeRequestTrace,
    kind: VisaKnowledgeExternalKind,
  ): void {
    if (trace.finished) return;
    trace.phase = kind;
    this.externalRequests[kind] = increment(this.externalRequests[kind]);
  }

  markExternalFailure(
    trace: VisaKnowledgeRequestTrace,
    kind: VisaKnowledgeExternalKind,
  ): void {
    if (trace.finished) return;
    trace.degraded = true;
    this.externalFailures[kind] = increment(this.externalFailures[kind]);
  }

  markBetween(trace: VisaKnowledgeRequestTrace): void {
    if (!trace.finished) trace.phase = "between";
  }

  markBroadFallback(
    trace: VisaKnowledgeRequestTrace,
    kind: "vector" | "rest",
  ): void {
    if (trace.finished) return;
    this.broadFallbacks[kind] = increment(this.broadFallbacks[kind]);
  }

  finish(
    trace: VisaKnowledgeRequestTrace,
    outcome: VisaKnowledgeRequestOutcome,
    durationMs: number,
    resultSource?: VisaKnowledgeResultSource,
  ): void {
    if (trace.finished) return;
    trace.finished = true;
    this.active = Math.max(0, this.active - 1);

    if (outcome === "completed") {
      this.completed = increment(this.completed);
      if (trace.degraded) this.degraded = increment(this.degraded);
      if (resultSource) this.results[resultSource] = increment(this.results[resultSource]);
    } else if (outcome === "aborted") {
      this.aborted = increment(this.aborted);
      this.abortedByPhase[trace.phase] = increment(this.abortedByPhase[trace.phase]);
    } else {
      this.failed = increment(this.failed);
    }

    this.durationSamples.push(
      Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0,
    );
    if (this.durationSamples.length > MAX_DURATION_SAMPLES) {
      this.durationSamples.shift();
    }
  }

  read(): VisaKnowledgeCapacityMetrics {
    return {
      active: this.active,
      peakActive: this.peakActive,
      total: this.total,
      completed: this.completed,
      degraded: this.degraded,
      failed: this.failed,
      aborted: this.aborted,
      externalRequests: { ...this.externalRequests },
      externalFailures: { ...this.externalFailures },
      broadFallbacks: { ...this.broadFallbacks },
      results: { ...this.results },
      abortedByPhase: { ...this.abortedByPhase },
      durationP50Ms: percentile(this.durationSamples, 0.5),
      durationP95Ms: percentile(this.durationSamples, 0.95),
      durationMaxMs: this.durationSamples.length > 0
        ? Math.max(...this.durationSamples)
        : 0,
    };
  }
}

export const visaKnowledgeCapacityMonitor = new VisaKnowledgeCapacityMonitor();
export const getVisaKnowledgeCapacityMetrics = (): VisaKnowledgeCapacityMetrics =>
  visaKnowledgeCapacityMonitor.read();
