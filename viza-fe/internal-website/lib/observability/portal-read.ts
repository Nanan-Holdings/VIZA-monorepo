import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { monitorEventLoopDelay, performance } from "node:perf_hooks";

type Operation = "session" | "home" | "status" | "timeline";
type Outcome = "ok" | "unauthenticated" | "unavailable" | "partial" | "cancelled" | "error";
type Stage = "auth" | "profile" | "applications" | "documents" | "payments" |
  "packages" | "timeline" | "storage" | "metadata" | "other";

const stages = new Set<Stage>([
  "auth", "profile", "applications", "documents", "payments", "packages",
  "timeline", "storage", "metadata", "other",
]);
const operations = new Set<Operation>(["session", "home", "status", "timeline"]);
const outcomes: Record<Outcome, number> = {
  ok: 0, unauthenticated: 1, partial: 2, unavailable: 3, cancelled: 4, error: 5,
};
// Only fixed resource names may become metric labels. Never retain URLs,
// filters, application IDs, query parameters, headers, errors or response bodies.
const resources = new Set([
  "applicant_profiles", "applications", "application_documents", "payment_records",
  "user_packages", "visa_packages", "visa_application_answers", "consent_events",
  "application_signatures", "application_packets", "application_events",
  "notification_events", "official_application_tracking", "submission_queue",
  "runner_jobs", "visa_form_schemas", "visa_document_requirements",
]);

type Timing = {
  calls: number;
  errors: number;
  cancelled: number;
  unavailable: number;
  totalMs: number;
  maxMs: number;
  declaredResponseBytes: number;
};
type ReadTrace = {
  requestId: string;
  operation: Operation;
  outcome: Outcome;
  startedAt: number;
  stages: Record<string, Timing>;
  http: Record<string, Timing>;
};
type ReadRuntime = {
  context: AsyncLocalStorage<ReadTrace>;
  windowStartedAt: number;
  emitted: number;
  dropped: number;
  stop?: () => void;
};

// Next may load instrumentation and route code in different server bundles.
// Share only the context carrier and numeric counters, never user data/cache.
const runtimeGlobal = globalThis as typeof globalThis & { __vizaPortalReadRuntime?: ReadRuntime };
const runtime = runtimeGlobal.__vizaPortalReadRuntime ??= {
  context: new AsyncLocalStorage<ReadTrace>(),
  windowStartedAt: performance.now(),
  emitted: 0,
  dropped: 0,
};

function enabled(): boolean {
  return process.env.VIZA_PORTAL_READ_METRICS === "true";
}

function rounded(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
}

function emit(value: Record<string, unknown>): void {
  try {
    console.info(JSON.stringify(value));
  } catch {
    // An optional diagnostic sink must never change the read's result.
  }
}

function errorOutcome(error: unknown): Outcome {
  if (error instanceof Error && error.name === "AbortError") return "cancelled";
  if (error instanceof Error && ["TimeoutError", "SupabaseCircuitOpenError"].includes(error.name)) {
    return "unavailable";
  }
  return "error";
}

function resultOutcome(result: unknown): Outcome {
  // Supabase normally resolves failures as { data, error, status }; a resolved
  // SDK promise must not turn a failed query into a successful timing sample.
  if (!result || typeof result !== "object") return "ok";
  if ("error" in result && result.error) {
    if (result.error instanceof Error) return errorOutcome(result.error);
    if ("status" in result && typeof result.status === "number" &&
      (result.status === 0 || result.status >= 500)) return "unavailable";
    return "error";
  }
  if ("failed" in result && result.failed === true) return "partial";
  return "ok";
}

function addTiming(
  group: Record<string, Timing>, label: string, elapsedMs: number,
  outcome: Outcome, declaredResponseBytes = 0,
): void {
  const metric = group[label] ??= {
    calls: 0, errors: 0, cancelled: 0, unavailable: 0,
    totalMs: 0, maxMs: 0, declaredResponseBytes: 0,
  };
  metric.calls += 1;
  metric.errors += outcome === "ok" ? 0 : 1;
  metric.cancelled += outcome === "cancelled" ? 1 : 0;
  metric.unavailable += outcome === "unavailable" ? 1 : 0;
  metric.totalMs = rounded(metric.totalMs + elapsedMs);
  metric.maxMs = Math.max(metric.maxMs, rounded(elapsedMs));
  metric.declaredResponseBytes += declaredResponseBytes;
}

export function recordPortalReadOutcome(outcome: Outcome): void {
  const trace = runtime.context.getStore();
  if (trace && Object.hasOwn(outcomes, outcome) && outcomes[outcome] > outcomes[trace.outcome]) {
    trace.outcome = outcome;
  }
}

export async function withPortalReadTrace<T>(
  operation: Operation, run: () => PromiseLike<T>,
): Promise<T> {
  if (!enabled() || runtime.context.getStore()) return await run();
  const trace: ReadTrace = {
    requestId: randomUUID(),
    operation: operations.has(operation) ? operation : "status",
    outcome: "ok", startedAt: performance.now(), stages: {}, http: {},
  };
  return runtime.context.run(trace, async () => {
    try {
      return await run();
    } catch (error) {
      recordPortalReadOutcome(errorOutcome(error));
      throw error;
    } finally {
      const now = performance.now();
      if (now - runtime.windowStartedAt >= 10_000) {
        if (runtime.dropped > 0) {
          emit({ event: "portal_read_log_limit", dropped: runtime.dropped });
        }
        runtime.windowStartedAt = now;
        runtime.emitted = 0;
        runtime.dropped = 0;
      }
      // Bound log volume as well as per-request memory during an overload.
      if (runtime.emitted < 1_000) {
        runtime.emitted += 1;
        emit({
          event: "portal_read", timestamp: new Date().toISOString(), requestId: trace.requestId, operation: trace.operation,
          outcome: trace.outcome, durationMs: rounded(now - trace.startedAt),
          stages: trace.stages, http: trace.http,
        });
      } else {
        runtime.dropped += 1;
      }
    }
  });
}

export async function tracePortalReadStage<T>(
  stage: Stage, run: () => PromiseLike<T>,
): Promise<T> {
  const trace = runtime.context.getStore();
  if (!trace) return await run();
  const startedAt = performance.now();
  let outcome: Outcome = "ok";
  try {
    const result = await run();
    outcome = resultOutcome(result);
    return result;
  } catch (error) {
    outcome = errorOutcome(error);
    throw error;
  } finally {
    addTiming(trace.stages, stages.has(stage) ? stage : "other", performance.now() - startedAt, outcome);
  }
}

function resourceLabel(input: RequestInfo | URL): string {
  try {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const pathname = new URL(raw).pathname;
    if (pathname.startsWith("/auth/v1/")) return "auth";
    if (pathname.startsWith("/storage/v1/")) return "storage";
    const resource = pathname.match(/^\/rest\/v1\/([^/]+)\/?$/)?.[1];
    return resource && resources.has(resource) ? resource : "other";
  } catch {
    return "other";
  }
}

/** Observes one real attempt; headers timing does not include SDK JSON parsing. */
export function observePortalFetch(
  nextFetch: typeof fetch = (input, init) => fetch(input, init),
): typeof fetch {
  return async (input, init) => {
    const trace = runtime.context.getStore();
    if (!trace) return nextFetch(input, init);
    const startedAt = performance.now();
    let outcome: Outcome = "ok";
    let declaredResponseBytes = 0;
    try {
      const response = await nextFetch(input, init);
      outcome = response.status >= 500 ? "unavailable" : response.ok ? "ok" : "error";
      const length = Number(response.headers.get("content-length"));
      if (Number.isSafeInteger(length) && length >= 0 && length <= 1_000_000_000) {
        declaredResponseBytes = length;
      }
      return response;
    } catch (error) {
      outcome = errorOutcome(error);
      throw error;
    } finally {
      addTiming(trace.http, resourceLabel(input), performance.now() - startedAt, outcome, declaredResponseBytes);
    }
  };
}

/** Opt-in Node-only process samples, separate from load-generator statistics. */
export function startPortalReadRuntimeMetrics(): () => void {
  if (!enabled()) return () => undefined;
  if (runtime.stop) return runtime.stop;
  const histogram = monitorEventLoopDelay({ resolution: 20 });
  histogram.enable();
  let previousCpu = process.cpuUsage();
  let previousTime = performance.now();
  let previousLoop = performance.eventLoopUtilization();
  const timer = setInterval(() => {
    const now = performance.now();
    const cpu = process.cpuUsage();
    const loop = performance.eventLoopUtilization();
    const loopDelta = performance.eventLoopUtilization(loop, previousLoop);
    const memory = process.memoryUsage();
    emit({
      event: "portal_read_runtime", timestamp: new Date().toISOString(), intervalMs: rounded(now - previousTime),
      cpuPercent: rounded(((cpu.user - previousCpu.user) + (cpu.system - previousCpu.system)) /
        Math.max(1, (now - previousTime) * 1_000) * 100),
      eventLoopUtilization: rounded(loopDelta.utilization),
      eventLoopP95Ms: rounded(histogram.percentile(95) / 1_000_000),
      eventLoopMaxMs: rounded(histogram.max / 1_000_000),
      rssBytes: memory.rss, heapUsedBytes: memory.heapUsed,
    });
    previousCpu = cpu;
    previousTime = now;
    previousLoop = loop;
    histogram.reset();
  }, 10_000);
  timer.unref();
  runtime.stop = () => {
    clearInterval(timer);
    histogram.disable();
    runtime.stop = undefined;
  };
  return runtime.stop;
}
