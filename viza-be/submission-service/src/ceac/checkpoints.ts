/**
 * CEAC DS-160 checkpoint + Application-ID capture helpers.
 *
 * The CEAC flow is long and interruptible: sessions can expire, a late page
 * can fail validation, or the worker host can crash. To keep a partially
 * completed run recoverable, two things must be durable:
 *
 *   1. The DS-160 **Application ID** — once CEAC issues it, every retrieval
 *      path depends on it. We capture it as early as it becomes visible.
 *   2. **Checkpoints** at natural section boundaries — each one records where
 *      the worker was when a save succeeded, so ops can reconstruct the last
 *      good state without scraping logs.
 *
 * The module is intentionally side-effect-light: Application-ID capture is
 * non-throwing (the ID simply is not visible on the start page), and
 * checkpoint emission is routed through a pluggable `CheckpointSink` so that
 * persistence (console JSON, Supabase, file) can be chosen per run without
 * leaking into this layer.
 *
 * Legacy worker (`src/index.ts`) is not modified here — per the US-004 scope
 * note, integration stays minimally invasive and lands in later stories.
 */

import type { Page } from "@playwright/test";
import {
  CEAC_APPLICATION_ID_PATTERN,
  CEAC_APPLICATION_ID_SELECTORS,
} from "./selectors";
import { detectPage, type CeacPageId } from "./pages";
import { saveCurrent, type NavigateOptions } from "./navigator";

/**
 * Result of an Application-ID capture attempt.
 *
 * `applicationId` is null when the ID has not yet been assigned/rendered,
 * which is a normal state on very early DS-160 pages. Callers should treat
 * "not found" as information, not as a failure.
 */
export interface ApplicationIdCapture {
  /** Captured Application ID (matches `CEAC_APPLICATION_ID_PATTERN`), or null. */
  applicationId: string | null;
  /**
   * Which strategy produced the match:
   *  - `selector`: one of the known Application-ID selectors matched
   *  - `body_scan`: the pattern was found by scanning visible body text
   *  - `none`: no match found yet
   */
  source: "selector" | "body_scan" | "none";
  /** Raw text the pattern was extracted from — kept for debugging. */
  raw?: string;
}

/**
 * The kind of event a checkpoint represents. Named enum-style strings so
 * downstream analytics can group on `action` without string-matching.
 */
export type CeacCheckpointAction =
  /** Recorded after the worker crosses into a new DS-160 section. */
  | "section_boundary"
  /** Recorded after CEAC's in-flow Save succeeds. */
  | "save"
  /** Recorded after a Save-to-File (.dat) capture succeeds (US-005). */
  | "save_to_file"
  /** Initial capture right after session bootstrap. */
  | "bootstrap"
  /** Caller-initiated checkpoint — use sparingly, prefer a specific action. */
  | "manual";

/**
 * A single structured checkpoint record. Every field is serializable so the
 * record can be JSON-encoded into a log line, a Supabase row, or a file.
 */
export interface CeacCheckpoint {
  /** ISO-8601 timestamp when the checkpoint was recorded. */
  at: string;
  /** What produced this checkpoint. */
  action: CeacCheckpointAction;
  /** Page identity at the moment of checkpoint. */
  pageId: CeacPageId | "unknown";
  /** Page heading text, if available (useful when `pageId === "unknown"`). */
  heading: string | null;
  /** Page URL at the moment of checkpoint. */
  url: string;
  /** Captured Application ID, if known at this point in the run. */
  applicationId: string | null;
  /** Optional run identifier — typically the `runId` from session bootstrap. */
  runId?: string;
  /** Arbitrary structured details (e.g. validation messages, download path). */
  details?: Record<string, unknown>;
}

/**
 * Sink that receives checkpoint records. Implementations should be fast and
 * non-throwing: checkpoints are a best-effort observability signal and must
 * never take down a run.
 */
export interface CheckpointSink {
  record(checkpoint: CeacCheckpoint): void | Promise<void>;
}

/**
 * Default sink: emits one JSON line per checkpoint to stdout. Greppable,
 * survives log aggregation, and has no external dependencies — a sensible
 * production default until a durable sink is wired in.
 */
export const consoleCheckpointSink: CheckpointSink = {
  record(cp: CeacCheckpoint): void {
    console.log(JSON.stringify({ event: "ceac.checkpoint", ...cp }));
  },
};

/**
 * Best-effort Application-ID capture.
 *
 * Tries each known Application-ID selector in order; if nothing matches,
 * falls back to scanning the visible body text for the canonical `AA...`
 * pattern. Never throws — if the ID is not yet visible (early pages), the
 * result is simply `{ applicationId: null, source: "none" }`.
 */
export async function captureApplicationId(page: Page): Promise<ApplicationIdCapture> {
  // Strategy 1: targeted selectors. The Application ID is rendered in a span
  // near the top of each page once issued; checking known selectors first
  // avoids reading the entire body on every checkpoint.
  for (const selector of CEAC_APPLICATION_ID_SELECTORS) {
    try {
      const node = page.locator(selector).first();
      if ((await node.count()) === 0) continue;
      const text = ((await node.textContent()) ?? "").trim();
      if (!text) continue;
      const match = text.match(CEAC_APPLICATION_ID_PATTERN);
      if (match) {
        return { applicationId: match[0], source: "selector", raw: text };
      }
    } catch {
      // Selector may be stale during navigation; keep trying others.
    }
  }

  // Strategy 2: body-text scan. The pattern `AA[A-Z0-9]{8,10}` is distinctive
  // enough that false positives on CEAC pages are effectively impossible.
  try {
    const bodyText = await page.locator("body").innerText({ timeout: 2_000 });
    const match = bodyText.match(CEAC_APPLICATION_ID_PATTERN);
    if (match) {
      return { applicationId: match[0], source: "body_scan", raw: match[0] };
    }
  } catch {
    // Body may not be attached during navigation; fall through to "none".
  }

  return { applicationId: null, source: "none" };
}

/**
 * Inputs for `buildCheckpoint`. `applicationId` semantics:
 *  - `undefined`: capture from the page now (default).
 *  - `string`:   use the caller's cached value (avoids re-scanning the DOM).
 *  - `null`:     record that the ID is explicitly not yet available.
 */
export interface BuildCheckpointInput {
  action: CeacCheckpointAction;
  applicationId?: string | null;
  runId?: string;
  details?: Record<string, unknown>;
}

/**
 * Build a structured checkpoint from the current page state, without any
 * navigation side effects. Useful for recording bootstrap, manual pauses, or
 * any state that does not come from a save/advance.
 */
export async function buildCheckpoint(
  page: Page,
  input: BuildCheckpointInput,
): Promise<CeacCheckpoint> {
  const probe = await detectPage(page);
  const applicationId =
    input.applicationId === undefined
      ? (await captureApplicationId(page)).applicationId
      : input.applicationId;

  return {
    at: new Date().toISOString(),
    action: input.action,
    pageId: probe.id,
    heading: probe.heading,
    url: probe.url,
    applicationId,
    runId: input.runId,
    details: input.details,
  };
}

/**
 * Options common to every checkpoint-emitting helper. Separated from
 * `NavigateOptions` so callers can emit standalone checkpoints without
 * pulling in navigation timing knobs they don't need.
 */
export interface CheckpointEmitOptions {
  /** Sink that receives the record. Defaults to `consoleCheckpointSink`. */
  sink?: CheckpointSink;
  /** Run identifier stamped onto the record for correlation. */
  runId?: string;
  /**
   * Previously-captured Application ID. When provided, skips the DOM scan
   * and stamps this value onto the checkpoint directly.
   */
  knownApplicationId?: string | null;
  /** Extra details merged into the checkpoint record. */
  details?: Record<string, unknown>;
}

/**
 * Options for `saveAndCheckpoint`: navigation knobs + checkpoint emission.
 */
export interface SaveAndCheckpointOptions
  extends NavigateOptions,
    CheckpointEmitOptions {}

/**
 * Save the current CEAC page via the navigator, then emit a structured
 * checkpoint. This is the canonical "natural-section-boundary save" primitive
 * — call it after finishing a DS-160 section rather than clicking Save
 * directly.
 *
 * Application-ID capture is performed as part of the checkpoint build so that
 * the ID is persisted in the record as soon as CEAC surfaces it.
 */
export async function saveAndCheckpoint(
  page: Page,
  params: { at: CeacPageId | CeacPageId[] } & SaveAndCheckpointOptions,
): Promise<CeacCheckpoint> {
  const {
    sink = consoleCheckpointSink,
    runId,
    knownApplicationId,
    details,
    timeoutMs,
    pollIntervalMs,
    assertFrom,
    ...rest
  } = params;
  // `rest` exists only to surface unexpected extra keys at the type layer; at
  // runtime it is discarded.
  void rest;

  const landed = await saveCurrent(page, {
    at: params.at,
    timeoutMs,
    pollIntervalMs,
    assertFrom,
  });

  const checkpoint = await buildCheckpoint(page, {
    action: "save",
    applicationId: knownApplicationId ?? undefined,
    runId,
    details: { landed, ...details },
  });

  await sink.record(checkpoint);
  return checkpoint;
}

/**
 * Emit a checkpoint after the worker has crossed into a new DS-160 section.
 *
 * This helper does **not** perform navigation — call `advance(...)` first,
 * then call this to record the new state. Keeping the checkpoint side effect
 * out of the navigator keeps that layer free of persistence concerns.
 */
export async function recordSectionCheckpoint(
  page: Page,
  params: CheckpointEmitOptions = {},
): Promise<CeacCheckpoint> {
  const sink = params.sink ?? consoleCheckpointSink;
  const checkpoint = await buildCheckpoint(page, {
    action: "section_boundary",
    applicationId: params.knownApplicationId ?? undefined,
    runId: params.runId,
    details: params.details,
  });
  await sink.record(checkpoint);
  return checkpoint;
}

/**
 * Emit a `bootstrap` checkpoint right after session start. Useful for tying
 * the run identifier to a page/URL baseline so later checkpoints have a
 * reference point even if the Application ID has not yet been issued.
 */
export async function recordBootstrapCheckpoint(
  page: Page,
  params: CheckpointEmitOptions = {},
): Promise<CeacCheckpoint> {
  const sink = params.sink ?? consoleCheckpointSink;
  const checkpoint = await buildCheckpoint(page, {
    action: "bootstrap",
    applicationId: params.knownApplicationId ?? undefined,
    runId: params.runId,
    details: params.details,
  });
  await sink.record(checkpoint);
  return checkpoint;
}
