/**
 * CEAC DS-160 `.dat` artifact capture and recovery metadata.
 *
 * CEAC offers a "Save Application to File" control that downloads a `.dat`
 * blob — the definitive offline backup of a partial DS-160. When a run
 * fails mid-flow, that file plus the Application ID and last-known-good
 * checkpoint are what ops need to resume.
 *
 * This module provides three things:
 *
 *   1. `captureDatArtifact` — trigger Save-to-File, await the Playwright
 *      download event, and persist the blob to disk with structured metadata.
 *   2. `RecoveryTracker` — a `CheckpointSink` that accumulates recovery
 *      state (Application ID, last successful checkpoint, `.dat` artifact)
 *      across a run and can be snapshotted at any point.
 *   3. `preserveRecoveryOnFailure` — snapshot the tracker on an error path
 *      and emit a final structured checkpoint so recovery info is preserved
 *      even when the caller re-throws.
 *
 * Per the US-005 scope note, this lands the capture + metadata shape. Full
 * upload/replay of the `.dat` (resuming a new CEAC session from the file)
 * is deliberately out of scope for this story — the artifact path and
 * recovery metadata are sufficient for an ops-driven resume.
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { Download, Locator, Page } from "@playwright/test";
import { CEAC_NAV_SELECTORS } from "./selectors";
import { assertPage, detectPage, type CeacPageId } from "./pages";
import { NavigationError, serializeError } from "./errors";
import { tryCaptureScreenshot, type ScreenshotArtifact } from "./diagnostics";
import {
  buildCheckpoint,
  captureApplicationId,
  consoleCheckpointSink,
  type CeacCheckpoint,
  type CheckpointEmitOptions,
  type CheckpointSink,
} from "./checkpoints";

const DEFAULT_DOWNLOAD_TIMEOUT_MS = 60_000;

/**
 * A persisted `.dat` artifact from CEAC's Save-to-File control. Every field
 * is serializable so the record can be logged, stamped onto a checkpoint,
 * or written into a recovery payload without further transformation.
 */
export interface DatArtifact {
  /** Absolute path to the `.dat` file on disk. */
  path: string;
  /** Filename CEAC suggested for the download (typically `<AppID>.dat`). */
  suggestedFilename: string;
  /** File size in bytes at capture time. */
  sizeBytes: number;
  /** ISO-8601 timestamp at capture. */
  capturedAt: string;
  /** Page identity where Save-to-File was triggered. */
  sourcePageId: CeacPageId | "unknown";
  /** Application ID associated with the artifact, if known at capture time. */
  applicationId: string | null;
}

/**
 * Inputs for `captureDatArtifact`. `applicationId` follows the same
 * three-state convention as `buildCheckpoint`:
 *  - `undefined`: scan the page now (default).
 *  - `string`:   use the caller's cached value.
 *  - `null`:     record that the ID is explicitly not yet available.
 */
export interface CaptureDatOptions {
  /** Directory to save the artifact into. Created if missing. */
  outputDir: string;
  /** Filename override. Default: the CEAC-suggested filename. */
  filename?: string;
  /** Timeout (ms) to wait for the download event to fire. Default: 60_000. */
  downloadTimeoutMs?: number;
  /**
   * Expected current page. When provided, an identity assertion runs
   * before Save-to-File is clicked. Default: no assertion.
   */
  expectPage?: CeacPageId | CeacPageId[];
  /** Application ID associated with this capture. See interface comment. */
  applicationId?: string | null;
}

/**
 * Trigger CEAC's Save-to-File control and persist the resulting `.dat` blob
 * to disk.
 *
 * Throws `NavigationError` when the Save-to-File button is missing, the
 * click fails, or the download event does not fire within the timeout —
 * those are the three failures a caller can meaningfully react to. Page
 * identity on exit is left to the caller: CEAC normally stays on the same
 * page after a download, but a small number of flows redirect.
 */
export async function captureDatArtifact(
  page: Page,
  opts: CaptureDatOptions,
): Promise<DatArtifact> {
  if (opts.expectPage) {
    await assertPage(page, opts.expectPage);
  }

  const button = await resolveSaveToFileButton(page);
  if (!button) {
    throw new NavigationError(
      "CEAC Save to File button not found on current page",
      {
        url: page.url(),
        details: { action: "save_to_file" },
      },
    );
  }

  const downloadTimeoutMs = opts.downloadTimeoutMs ?? DEFAULT_DOWNLOAD_TIMEOUT_MS;
  // Register the download listener BEFORE clicking. CEAC sometimes fires the
  // response quickly enough that attaching the listener after the click
  // causes the event to be missed.
  const downloadPromise = page.waitForEvent("download", {
    timeout: downloadTimeoutMs,
  });

  try {
    await button.click();
  } catch (err) {
    throw new NavigationError("Failed to click CEAC Save to File button", {
      url: page.url(),
      details: {
        action: "save_to_file",
        cause: err instanceof Error ? err.message : String(err),
      },
    });
  }

  let download: Download;
  try {
    download = await downloadPromise;
  } catch (err) {
    throw new NavigationError(
      `CEAC Save to File did not produce a download within ${downloadTimeoutMs}ms`,
      {
        url: page.url(),
        details: {
          action: "save_to_file",
          cause: err instanceof Error ? err.message : String(err),
        },
      },
    );
  }

  await fs.mkdir(opts.outputDir, { recursive: true });
  const suggested = download.suggestedFilename();
  const filename = opts.filename ?? suggested;
  const destination = path.resolve(opts.outputDir, filename);
  await download.saveAs(destination);

  const stats = await fs.stat(destination);
  const probe = await detectPage(page);

  const applicationId =
    opts.applicationId === undefined
      ? (await captureApplicationId(page)).applicationId
      : opts.applicationId;

  return {
    path: destination,
    suggestedFilename: suggested,
    sizeBytes: stats.size,
    capturedAt: new Date().toISOString(),
    sourcePageId: probe.id,
    applicationId,
  };
}

/**
 * Immutable snapshot of a run's recovery state. Fully serializable.
 *
 * `lastCheckpoint` is the most recently observed checkpoint from any action
 * (section boundary, save, save-to-file, bootstrap, manual). `datArtifact`
 * is the latest captured `.dat`; we keep only one because resume flows
 * should use the newest file.
 */
export interface RecoveryMetadata {
  runId?: string;
  applicationId: string | null;
  lastCheckpoint: CeacCheckpoint | null;
  datArtifact: DatArtifact | null;
  /** ISO-8601 timestamp when this snapshot was taken. */
  updatedAt: string;
}

/**
 * Accumulates recovery state across a run. Implements `CheckpointSink` so it
 * can be plugged straight into the US-004 checkpoint helpers: every
 * checkpoint emitted through the tracker updates `lastCheckpoint` (and
 * promotes any non-null `applicationId` to the tracker-wide value) before
 * being forwarded to the delegate sink.
 */
export interface RecoveryTracker extends CheckpointSink {
  /** Get an immutable snapshot of the current recovery state. */
  snapshot(): RecoveryMetadata;
  /** Manual override — useful when the ID was captured outside a checkpoint. */
  setApplicationId(id: string | null): void;
  /** Attach a newly captured `.dat` artifact; replaces any prior artifact. */
  attachDatArtifact(artifact: DatArtifact): void;
}

export interface CreateRecoveryTrackerOptions {
  runId?: string;
  /** Inner sink to which checkpoints are forwarded. Default: console. */
  delegate?: CheckpointSink;
}

/**
 * Create a recovery tracker. Pass the returned object as the `sink` for
 * checkpoint emission helpers and it will observe every checkpoint while
 * still forwarding to the delegate sink.
 */
export function createRecoveryTracker(
  options: CreateRecoveryTrackerOptions = {},
): RecoveryTracker {
  const delegate = options.delegate ?? consoleCheckpointSink;
  let applicationId: string | null = null;
  let lastCheckpoint: CeacCheckpoint | null = null;
  let datArtifact: DatArtifact | null = null;

  return {
    async record(cp: CeacCheckpoint): Promise<void> {
      lastCheckpoint = cp;
      // A checkpoint carrying a non-null Application ID is authoritative —
      // CEAC surfaced the ID on the page at that moment.
      if (cp.applicationId) {
        applicationId = cp.applicationId;
      }
      await delegate.record(cp);
    },
    snapshot(): RecoveryMetadata {
      return {
        runId: options.runId,
        applicationId,
        lastCheckpoint,
        datArtifact,
        updatedAt: new Date().toISOString(),
      };
    },
    setApplicationId(id: string | null): void {
      applicationId = id;
    },
    attachDatArtifact(artifact: DatArtifact): void {
      datArtifact = artifact;
      // If the artifact was captured with an ID, promote it — capture-time
      // is the canonical moment for ID provenance on the .dat.
      if (artifact.applicationId) {
        applicationId = artifact.applicationId;
      }
    },
  };
}

/**
 * Options for `captureDatAndCheckpoint`. Mirrors `saveAndCheckpoint`: the
 * caller provides capture knobs + checkpoint emission options, and the
 * helper produces both a `DatArtifact` and its corresponding checkpoint.
 *
 * `applicationId` from `CaptureDatOptions` is intentionally omitted here —
 * when a tracker is provided, the Application ID comes from the tracker's
 * current state via `knownApplicationId`; otherwise it defaults to a DOM
 * scan inside `captureDatArtifact`.
 */
export interface CaptureDatAndCheckpointOptions
  extends Omit<CaptureDatOptions, "applicationId">,
    CheckpointEmitOptions {
  /** Tracker to attach the artifact to and to use as the checkpoint sink. */
  tracker?: RecoveryTracker;
}

/**
 * Canonical "Save to File + checkpoint" primitive.
 *
 * Captures the `.dat`, attaches it to the tracker (if provided), then
 * emits a `save_to_file` checkpoint carrying the artifact metadata. When a
 * tracker is supplied it takes precedence over `sink` — the tracker is the
 * recommended way to keep recovery state in sync and already forwards to
 * its own delegate sink.
 */
export async function captureDatAndCheckpoint(
  page: Page,
  opts: CaptureDatAndCheckpointOptions,
): Promise<{ artifact: DatArtifact; checkpoint: CeacCheckpoint }> {
  const knownApplicationId = opts.knownApplicationId;
  const artifact = await captureDatArtifact(page, {
    outputDir: opts.outputDir,
    filename: opts.filename,
    downloadTimeoutMs: opts.downloadTimeoutMs,
    expectPage: opts.expectPage,
    applicationId: knownApplicationId,
  });

  if (opts.tracker) {
    opts.tracker.attachDatArtifact(artifact);
  }

  const sink: CheckpointSink =
    opts.tracker ?? opts.sink ?? consoleCheckpointSink;

  const checkpoint = await buildCheckpoint(page, {
    action: "save_to_file",
    applicationId: artifact.applicationId ?? knownApplicationId ?? undefined,
    runId: opts.runId,
    details: {
      datArtifact: artifact,
      ...opts.details,
    },
  });
  await sink.record(checkpoint);

  return { artifact, checkpoint };
}

/**
 * Options for `preserveRecoveryOnFailure`. The tracker is required; the
 * optional sink receives a final `manual` checkpoint with `reason:
 * run_failed` so the recovery state is committed to the log even when the
 * caller re-throws immediately after.
 */
export interface PreserveRecoveryOptions extends CheckpointEmitOptions {
  tracker: RecoveryTracker;
  /** The error that caused the failure, if available. */
  error?: unknown;
  /**
   * Page reference for last-known identity/URL. Pass `null` when the
   * browser has already closed or is otherwise unusable.
   */
  page?: Page | null;
  /**
   * When provided, capture a failure screenshot into this directory. The
   * resulting `ScreenshotArtifact` is attached to the failure checkpoint's
   * `details.failureScreenshot` and included in this function's return.
   * Capture is non-throwing: if the page is gone or the write fails, the
   * screenshot field is simply `null` — the rest of the recovery record
   * still lands. See US-007.
   */
  screenshotDir?: string;
  /** Optional filename override for the failure screenshot. */
  screenshotFilename?: string;
}

/**
 * Result of `preserveRecoveryOnFailure`. Combines the recovery snapshot with
 * any failure screenshot captured on the error path, so callers constructing
 * a failure-result payload (US-008) don't have to correlate through the log.
 */
export interface PreservedRecovery extends RecoveryMetadata {
  /** Failure screenshot, if `screenshotDir` was provided and capture succeeded. */
  failureScreenshot: ScreenshotArtifact | null;
}

/**
 * Snapshot the recovery state at a failure point and emit a final
 * structured checkpoint so ops can reconstruct the last-known-good run
 * context (Application ID + last checkpoint + `.dat` path).
 *
 * When `screenshotDir` is provided, a best-effort failure screenshot is also
 * captured and attached to the emitted checkpoint's details (US-007). The
 * capture is non-throwing, so screenshot absence never masks the original
 * failure.
 *
 * Never throws. Failure preservation runs on the error path and must not
 * itself raise an error that would mask the original.
 */
export async function preserveRecoveryOnFailure(
  options: PreserveRecoveryOptions,
): Promise<PreservedRecovery> {
  const snapshot = options.tracker.snapshot();
  const sink: CheckpointSink = options.sink ?? consoleCheckpointSink;
  const errorSerialized = serializeError(options.error);

  // Capture screenshot BEFORE the checkpoint so its path can land in the
  // checkpoint details — then a single log record carries both the error
  // context and the screenshot reference.
  const failureScreenshot = options.screenshotDir
    ? await tryCaptureScreenshot(options.page ?? null, {
        outputDir: options.screenshotDir,
        filename: options.screenshotFilename,
      })
    : null;

  const commonDetails: Record<string, unknown> = {
    reason: "run_failed",
    error: errorSerialized,
    recovery: snapshot,
    failureScreenshot,
    ...options.details,
  };

  try {
    if (options.page) {
      const checkpoint = await buildCheckpoint(options.page, {
        action: "manual",
        applicationId: snapshot.applicationId,
        runId: snapshot.runId ?? options.runId,
        details: commonDetails,
      });
      await sink.record(checkpoint);
    } else {
      // No usable page — synthesize a checkpoint so the snapshot still
      // lands in the sink with correlating metadata.
      await sink.record({
        at: new Date().toISOString(),
        action: "manual",
        pageId: "unknown",
        heading: null,
        url: snapshot.lastCheckpoint?.url ?? "",
        applicationId: snapshot.applicationId,
        runId: snapshot.runId ?? options.runId,
        details: commonDetails,
      });
    }
  } catch {
    // Swallow — preserving recovery must never itself throw.
  }

  return {
    ...snapshot,
    failureScreenshot,
  };
}

async function resolveSaveToFileButton(page: Page): Promise<Locator | null> {
  const candidates = page.locator(CEAC_NAV_SELECTORS.saveToFile);
  const count = await candidates.count();
  for (let i = 0; i < count; i += 1) {
    const node = candidates.nth(i);
    if (await node.isVisible()) return node;
  }
  return null;
}
