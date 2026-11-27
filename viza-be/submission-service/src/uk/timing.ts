/**
 * Redacted, process-local timing for the UK runner.
 *
 * The recorder deliberately accepts only a fixed stage, an optional fixed
 * page/phase slug, a duration/outcome, a count, and a fixed diagnostic code.
 * It must never be passed portal URLs, answers, email addresses, credentials,
 * labels, or error text.
 */

export type UkTimingStage =
  | "run"
  | "browser_launch"
  | "login"
  | "registration"
  | "page_goto"
  | "page_fill"
  | "page_save"
  | "validation"
  | "review"
  | "documents"
  | "inbox"
  | "captcha"
  | "cleanup";

export type UkTimingOutcome =
  | "success"
  | "failed"
  | "stopped"
  | "skipped"
  | "timeout";

export const UK_TIMING_DIAGNOSTIC_CODES = [
  "radio_group_missing",
  "radio_label_missing",
  "radio_option_unmatched",
  "radio_disabled",
  "radio_check_failed",
  "unknown",
] as const;

export type UkTimingDiagnosticCode = (typeof UK_TIMING_DIAGNOSTIC_CODES)[number];

export interface UkTimingClock {
  now(): number;
}

export interface UkTimingRecord {
  runId?: string;
  stage: UkTimingStage;
  slug?: string;
  durationMs?: number;
  outcome?: UkTimingOutcome;
  count?: number;
  diagnosticCode?: UkTimingDiagnosticCode;
}

export interface UkTimingSummary {
  runId?: string;
  records: readonly UkTimingRecord[];
}

export type UkTimingSink = (summary: UkTimingSummary) => void;

export interface UkTimingSpan {
  end(outcome: UkTimingOutcome, count?: number, diagnosticCode?: UkTimingDiagnosticCode): void;
}

export interface UkTimingRecorder {
  start(stage: UkTimingStage, slug?: string): UkTimingSpan;
  finish(outcome: UkTimingOutcome): UkTimingSummary;
}

export interface CreateUkTimingRecorderOptions {
  runId?: string;
  clock?: UkTimingClock;
  sink?: UkTimingSink;
}

const defaultClock: UkTimingClock = {
  now: () => (typeof performance === "undefined" ? Date.now() : performance.now()),
};

function boundedDurationMs(start: number, end: number): number {
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.round(end - start));
}

function defaultSink(summary: UkTimingSummary): void {
  // Every value in this JSON is produced by the fixed recorder contract.
  // Never add an error, URL, answer, email, label, or credential to this payload.
  try {
    console.info(`[uk-timing] ${JSON.stringify(summary)}`);
  } catch {
    // Observability must never change runner control flow.
  }
}

export function createUkTimingRecorder(
  options: CreateUkTimingRecorderOptions = {},
): UkTimingRecorder {
  const clock = options.clock ?? defaultClock;
  const records: UkTimingRecord[] = [];
  const runStartedAt = clock.now();
  let finished = false;
  let summary: UkTimingSummary | null = null;

  const append = (
    stage: UkTimingStage,
    slug: string | undefined,
    durationMs: number | undefined,
    outcome: UkTimingOutcome | undefined,
    count: number | undefined,
    diagnosticCode: UkTimingDiagnosticCode | undefined,
  ): void => {
    const record: UkTimingRecord = { stage };
    if (options.runId !== undefined) record.runId = options.runId;
    if (slug !== undefined) record.slug = slug;
    if (durationMs !== undefined) record.durationMs = Math.max(0, Math.round(durationMs));
    if (outcome !== undefined) record.outcome = outcome;
    if (count !== undefined) record.count = Math.max(0, Math.round(count));
    if (diagnosticCode !== undefined && UK_TIMING_DIAGNOSTIC_CODES.includes(diagnosticCode)) {
      record.diagnosticCode = diagnosticCode;
    }
    records.push(record);
  };

  return {
    start(stage, slug): UkTimingSpan {
      const startedAt = clock.now();
      let ended = false;
      return {
        end(outcome, count = 1, diagnosticCode): void {
          if (ended || finished) return;
          ended = true;
          append(stage, slug, boundedDurationMs(startedAt, clock.now()), outcome, count, diagnosticCode);
        },
      };
    },

    finish(outcome): UkTimingSummary {
      if (summary) return summary;
      if (!finished) {
        finished = true;
        append("run", undefined, boundedDurationMs(runStartedAt, clock.now()), outcome, 1, undefined);
        summary = {
          ...(options.runId !== undefined ? { runId: options.runId } : {}),
          records: records.map((record) => ({ ...record })),
        };
        try {
          (options.sink ?? defaultSink)(summary);
        } catch {
          // A custom metrics/log sink is best-effort and cannot mask the
          // runner's original result or exception.
        }
      }
      return summary ?? {
        ...(options.runId !== undefined ? { runId: options.runId } : {}),
        records: records.map((record) => ({ ...record })),
      };
    },
  };
}
