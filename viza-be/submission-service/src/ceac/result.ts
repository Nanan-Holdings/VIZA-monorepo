/**
 * CEAC DS-160 worker result payload (US-008).
 *
 * This module defines the typed result contract for a CEAC autofill run.
 * Every run terminates in one of three states:
 *
 *   - `"handoff_ready"` — the worker reached the Sign and Submit page and
 *     stopped before any irreversible action. The result carries everything
 *     ops needs to hand off to the client: Application ID, recovery
 *     artifacts, and proof-of-reach screenshot.
 *
 *   - `"submitted"` — the worker completed the final Sign and Submit step
 *     and reached the CEAC confirmation page.
 *
 *   - `"failed"` — the run terminated with an error. The result preserves
 *     whatever recovery state was accumulated (Application ID, last
 *     checkpoint, `.dat` artifact, failure screenshot) so ops can attempt
 *     a resume.
 *
 * The discriminant is `status`.
 */

import type { ScreenshotArtifact } from "./diagnostics";
import type { CeacCheckpoint } from "./checkpoints";
import type { DatArtifact, RecoveryMetadata } from "./artifacts";
import type { HandoffReadyOutcome, SignPageMarkers } from "./stop-at-sign";

/**
 * Successful terminal state: worker reached Sign and Submit and stopped.
 *
 * This is the canonical success payload for internal ops. It provides:
 *   - Application ID for client communication
 *   - Recovery artifacts (.dat, screenshots) for handoff
 *   - Checkpoint trail for audit
 *
 * `status` is always `"handoff_ready"` — never `"submitted"`.
 */
export interface CeacRunSuccess {
  status: "handoff_ready";
  /** Application ID issued by CEAC, if available. */
  applicationId: string | null;
  /** Run identifier for correlation across logs/checkpoints. */
  runId?: string;
  /** ISO-8601 timestamp when the sign page was reached. */
  reachedAt: string;
  /** DOM markers verified on the sign page. */
  signPageMarkers: SignPageMarkers;
  /** The `handoff_ready` checkpoint emitted at stop. */
  checkpoint: CeacCheckpoint;
  /** Most recent `.dat` artifact, if captured during the run. */
  datArtifact: DatArtifact | null;
  /** Sign-page screenshot — proof of successful reach. */
  signPageScreenshot: ScreenshotArtifact | null;
}

export interface CeacRunSubmitted {
  status: "submitted";
  applicationId: string | null;
  confirmationNumber: string | null;
  runId?: string;
  submittedAt: string;
  url: string;
  captchaAttempts: number;
  checkpoint: CeacCheckpoint;
  datArtifact: DatArtifact | null;
}

/**
 * Failed terminal state: worker encountered an unrecoverable error.
 *
 * Preserves whatever recovery context was accumulated before the failure,
 * so ops can attempt a resume with the Application ID + `.dat` file.
 */
export interface CeacRunFailure {
  status: "failed";
  /** Application ID, if CEAC had issued one before the failure. */
  applicationId: string | null;
  /** Run identifier for correlation across logs/checkpoints. */
  runId?: string;
  /** ISO-8601 timestamp when the failure was recorded. */
  failedAt: string;
  /** Serialized error (name, message, code, context). */
  error: Record<string, unknown> | null;
  /** Last successful checkpoint before the failure. */
  lastCheckpoint: CeacCheckpoint | null;
  /** Most recent `.dat` artifact, if captured before the failure. */
  datArtifact: DatArtifact | null;
  /** Failure screenshot for ops diagnostics. */
  failureScreenshot: ScreenshotArtifact | null;
}

/**
 * Discriminated union of all CEAC run outcomes.
 *
 * The `status` field is the discriminant:
 *   - `"handoff_ready"`: success — ready for client handoff
 *   - `"failed"`: failure — recovery metadata preserved
 *
 */
export type CeacRunResult = CeacRunSuccess | CeacRunSubmitted | CeacRunFailure;

/**
 * Build a success result from a `HandoffReadyOutcome`.
 *
 * This is the bridge between the stop-at-sign module's internal outcome type
 * and the worker-facing result contract. The mapping is straightforward —
 * the outcome already carries every field the result needs.
 */
export function buildSuccessResult(outcome: HandoffReadyOutcome): CeacRunSuccess {
  return {
    status: "handoff_ready",
    applicationId: outcome.applicationId,
    runId: outcome.runId,
    reachedAt: outcome.reachedAt,
    signPageMarkers: outcome.signPageMarkers,
    checkpoint: outcome.checkpoint,
    datArtifact: outcome.datArtifact,
    signPageScreenshot: outcome.signPageScreenshot,
  };
}

/**
 * Build a failure result from recovery metadata and a serialized error.
 *
 * The `PreservedRecovery` from `preserveRecoveryOnFailure` provides the
 * recovery state; the caller provides the serialized error separately
 * because the preservation function does not retain it on the return type
 * (it's emitted in the checkpoint details instead).
 */
export function buildFailureResult(
  recovery: RecoveryMetadata,
  options: {
    error?: Record<string, unknown> | null;
    failureScreenshot?: ScreenshotArtifact | null;
  } = {},
): CeacRunFailure {
  return {
    status: "failed",
    applicationId: recovery.applicationId,
    runId: recovery.runId,
    failedAt: new Date().toISOString(),
    error: options.error ?? null,
    lastCheckpoint: recovery.lastCheckpoint,
    datArtifact: recovery.datArtifact,
    failureScreenshot: options.failureScreenshot ?? null,
  };
}

/**
 * Type guard: is this result a successful handoff-ready outcome?
 */
export function isSuccessResult(result: CeacRunResult): result is CeacRunSuccess {
  return result.status === "handoff_ready";
}

export function isSubmittedResult(result: CeacRunResult): result is CeacRunSubmitted {
  return result.status === "submitted";
}

/**
 * Type guard: is this result a failure?
 */
export function isFailureResult(result: CeacRunResult): result is CeacRunFailure {
  return result.status === "failed";
}
