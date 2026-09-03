/**
 * Server-side stage timer for the portal's data loaders.
 *
 * The client portal's slow tab switches are dominated by sequential waves of
 * Supabase reads, and "the page took 3s" is not actionable without knowing
 * which wave owned the time. `traceStage` wraps a wave and, when tracing is
 * enabled, prints one compact line per loader:
 *
 *   [perf] client-status 2841ms  session=412 profiles=298 packages=274 …
 *
 * Enabled by VIZA_PERF_TRACE=1 (and on by default in development, where this
 * is exactly the signal you want while optimizing). It is a plain
 * console.log — no transport, no PII: stage names and durations only.
 */

const ENABLED =
  process.env.VIZA_PERF_TRACE === "1" ||
  (process.env.NODE_ENV !== "production" && process.env.VIZA_PERF_TRACE !== "0");

type Stage = { name: string; ms: number };

export type PerfTrace = {
  enabled: boolean;
  stages: Stage[];
  startedAt: number;
};

export function startTrace(): PerfTrace {
  return { enabled: ENABLED, stages: [], startedAt: performance.now() };
}

/** Times `fn`, records it under `name`, and returns its result untouched. */
export async function traceStage<T>(
  trace: PerfTrace | null,
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (!trace?.enabled) return fn();
  const startedAt = performance.now();
  try {
    return await fn();
  } finally {
    trace.stages.push({ name, ms: performance.now() - startedAt });
  }
}

/** Prints the collected stages as a single line. */
export function endTrace(trace: PerfTrace | null, label: string, extra?: Record<string, unknown>) {
  if (!trace?.enabled) return;
  const total = Math.round(performance.now() - trace.startedAt);
  const stages = trace.stages
    .map((stage) => `${stage.name}=${Math.round(stage.ms)}`)
    .join(" ");
  const suffix = extra
    ? " " +
      Object.entries(extra)
        .map(([key, value]) => `${key}=${String(value)}`)
        .join(" ")
    : "";
  console.log(`[perf] ${label} ${total}ms  ${stages}${suffix}`);
}
