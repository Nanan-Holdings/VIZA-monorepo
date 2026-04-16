/**
 * CEAC DS-160 stop-at-sign-page contract (US-006).
 *
 * This module owns the core product boundary of the CEAC autofill flow:
 * when the worker reaches the final **Sign and Submit** page, it stops.
 * It does NOT type into the passport-number signature field, it does NOT
 * fill the CAPTCHA, and it does NOT click the final "Sign and Submit
 * Application" button. The run concludes in a handoff-ready state — the
 * applicant's Application ID plus any `.dat` / checkpoint artifacts are
 * sufficient for a human to finalize the submission.
 *
 * The contract has two halves:
 *
 *   1. **Detection.** `assertSignAndSubmit` verifies the sign page using
 *      explicit DOM markers (heading + passport-signature input + final
 *      submit button). Heading-only detection is not enough — CEAC could
 *      redirect to a look-alike page during outages, and misidentifying a
 *      different page as the stop state would risk accidental submission
 *      attempts downstream.
 *
 *   2. **Termination.** `stopAtSignAndSubmit` is the terminal primitive. It
 *      asserts the page identity, emits a `handoff_ready` checkpoint with
 *      the full recovery context, and returns a `HandoffReadyOutcome`. The
 *      function contains no code that could type into the signature field,
 *      fill the CAPTCHA, or click the final submit — the absence of those
 *      calls is the guarantee, not a runtime flag.
 *
 * Legacy worker (`src/index.ts`) is intentionally untouched; US-008 is the
 * story that wires this outcome into the worker's success path.
 */

import type { Page } from "@playwright/test";
import {
  CEAC_HEADING_SELECTOR,
  CEAC_SIGN_AND_SUBMIT_MARKERS,
} from "./selectors";
import { detectPage } from "./pages";
import { UnexpectedPageError } from "./errors";
import {
  buildCheckpoint,
  consoleCheckpointSink,
  type CeacCheckpoint,
  type CheckpointEmitOptions,
  type CheckpointSink,
} from "./checkpoints";
import type { DatArtifact, RecoveryTracker } from "./artifacts";

/**
 * Presence of each DOM marker that defines the Sign and Submit page.
 *
 * `headingMatches`, `signatureFieldPresent`, and `finalSubmitPresent` are
 * all required for a positive identification. `captchaPresent` is informational
 * — CEAC occasionally defers CAPTCHA rendering until the signature field is
 * focused, so its absence is not disqualifying on its own.
 */
export interface SignPageMarkers {
  /** H2 heading matches `CEAC_SIGN_AND_SUBMIT_MARKERS.headingPattern`. */
  headingMatches: boolean;
  /** The passport-number signature input is present in the DOM. */
  signatureFieldPresent: boolean;
  /** The final "Sign and Submit Application" button is present in the DOM. */
  finalSubmitPresent: boolean;
  /** A CAPTCHA image is present (not required for identification). */
  captchaPresent: boolean;
}

/**
 * Result of a positive Sign and Submit identification.
 *
 * `pageId` is typed as the literal `"sign_and_submit"` so consumers can
 * statically distinguish this from any other page state.
 */
export interface SignPageIdentity {
  pageId: "sign_and_submit";
  heading: string | null;
  url: string;
  markers: SignPageMarkers;
}

/**
 * Structured, serializable outcome for a handoff-ready stop.
 *
 * The `status` literal is deliberately `"handoff_ready"` — never
 * `"submitted"`. Downstream consumers (worker result emission, ops tooling)
 * can discriminate on this field to assert that no final submission occurred.
 */
export interface HandoffReadyOutcome {
  /** Terminal state discriminator — never `"submitted"`. */
  status: "handoff_ready";
  /** Application ID, if CEAC has issued one by this point. */
  applicationId: string | null;
  /** Always `"sign_and_submit"` for a successful handoff. */
  pageId: "sign_and_submit";
  heading: string | null;
  url: string;
  /** DOM markers that were verified before the stop. */
  signPageMarkers: SignPageMarkers;
  /** ISO-8601 timestamp when the stop state was reached. */
  reachedAt: string;
  runId?: string;
  /** The `handoff_ready` checkpoint emitted for this stop. */
  checkpoint: CeacCheckpoint;
  /** Most recent recovery checkpoint observed on the tracker, if any. */
  lastCheckpoint: CeacCheckpoint | null;
  /** Most recent `.dat` artifact captured on the tracker, if any. */
  datArtifact: DatArtifact | null;
}

/**
 * Options for `stopAtSignAndSubmit`. The tracker is the recommended way to
 * keep recovery state in sync — when supplied, it takes precedence over
 * `sink` (the tracker already forwards to its own delegate sink).
 */
export interface StopAtSignOptions extends CheckpointEmitOptions {
  /** Tracker to read recovery state from and to use as the checkpoint sink. */
  tracker?: RecoveryTracker;
}

/**
 * Detect the Sign and Submit page using explicit DOM markers.
 *
 * Never types, fills, or clicks anything — pure read-only identification.
 * Returns `null` when the page is not the sign page, so callers can branch
 * without catching an error.
 */
export async function detectSignAndSubmit(
  page: Page,
): Promise<SignPageIdentity | null> {
  const probe = await detectPage(page);

  const markers = await readSignPageMarkers(page);

  // A positive identification requires the heading plus both of the
  // control-level markers. Being strict here is the whole point of US-006:
  // we cannot rely on the heading alone, because CEAC could route to a
  // look-alike page during outages or server errors.
  const isSignPage =
    probe.id === "sign_and_submit" &&
    markers.headingMatches &&
    markers.signatureFieldPresent &&
    markers.finalSubmitPresent;

  if (!isSignPage) return null;

  return {
    pageId: "sign_and_submit",
    heading: probe.heading,
    url: probe.url,
    markers,
  };
}

/**
 * Assert that the current page is the Sign and Submit page.
 *
 * Raises `UnexpectedPageError` with full marker diagnostics when the
 * identification fails — either the heading doesn't match, or the
 * control-level markers are missing.
 */
export async function assertSignAndSubmit(
  page: Page,
): Promise<SignPageIdentity> {
  const probe = await detectPage(page);
  const markers = await readSignPageMarkers(page);

  const missingRequired: string[] = [];
  if (!markers.headingMatches) missingRequired.push("heading");
  if (!markers.signatureFieldPresent) missingRequired.push("signature_field");
  if (!markers.finalSubmitPresent) missingRequired.push("final_submit_button");

  if (probe.id !== "sign_and_submit" || missingRequired.length > 0) {
    throw new UnexpectedPageError(
      `Expected Sign and Submit page but markers missing: [${missingRequired.join(", ") || "identity_mismatch"}]` +
        (probe.heading ? ` (heading: "${probe.heading}")` : ""),
      {
        expected: "sign_and_submit",
        detected: probe.id,
        url: probe.url,
        details: {
          heading: probe.heading,
          markers,
          missingRequired,
        },
      },
    );
  }

  return {
    pageId: "sign_and_submit",
    heading: probe.heading,
    url: probe.url,
    markers,
  };
}

/**
 * The terminal primitive. Assert we're on the Sign and Submit page, emit a
 * `handoff_ready` checkpoint, and return a structured outcome.
 *
 * This function performs no destructive DOM actions. In particular:
 *
 *   - It never calls `fill()` / `type()` on the passport-signature input.
 *   - It never calls `fill()` / `type()` on the CAPTCHA input.
 *   - It never calls `click()` on the final Sign and Submit button.
 *
 * The guarantee is structural: those call sites do not exist in this file.
 * Preserving that invariant is how US-006's stop contract holds.
 */
export async function stopAtSignAndSubmit(
  page: Page,
  options: StopAtSignOptions = {},
): Promise<HandoffReadyOutcome> {
  const identity = await assertSignAndSubmit(page);

  const tracker = options.tracker;
  // Tracker precedence mirrors `captureDatAndCheckpoint` in artifacts.ts:
  // the tracker observes every checkpoint and forwards to its delegate, so
  // passing it as the sink keeps recovery state in sync without double-wiring.
  const sink: CheckpointSink =
    tracker ?? options.sink ?? consoleCheckpointSink;

  const trackerSnapshot = tracker?.snapshot();

  const checkpoint = await buildCheckpoint(page, {
    action: "handoff_ready",
    // `knownApplicationId` is the three-state signal from US-004:
    //   undefined → scan the DOM now
    //   string    → use the cached value
    //   null      → record "confirmed not issued"
    // Prefer tracker state when available, then caller override, then scan.
    applicationId:
      options.knownApplicationId !== undefined
        ? options.knownApplicationId
        : (trackerSnapshot?.applicationId ?? undefined),
    runId: options.runId ?? trackerSnapshot?.runId,
    details: {
      signPageMarkers: identity.markers,
      ...options.details,
    },
  });

  await sink.record(checkpoint);

  // Re-read the tracker after emission so `lastCheckpoint` reflects this
  // stop (the tracker's `record` ran synchronously via the sink path).
  const finalSnapshot = tracker?.snapshot();

  return {
    status: "handoff_ready",
    applicationId: checkpoint.applicationId,
    pageId: "sign_and_submit",
    heading: identity.heading,
    url: identity.url,
    signPageMarkers: identity.markers,
    reachedAt: checkpoint.at,
    runId: checkpoint.runId,
    checkpoint,
    lastCheckpoint: finalSnapshot?.lastCheckpoint ?? checkpoint,
    datArtifact: finalSnapshot?.datArtifact ?? null,
  };
}

/**
 * Read the four Sign-and-Submit markers from the current page. Never throws
 * — a locator that errors on count is treated as "not present" so the caller
 * gets a complete marker snapshot even on a partially-loaded DOM.
 */
async function readSignPageMarkers(page: Page): Promise<SignPageMarkers> {
  const headingMatches = await matchesHeading(page);
  const signatureFieldPresent = await isAnyLocatorPresent(
    page,
    CEAC_SIGN_AND_SUBMIT_MARKERS.passportSignatureSelector,
  );
  // The final submit marker is the "Sign and Submit Application" control —
  // the single DOM signal whose presence proves we're on the irreversible-
  // action page. If this is missing, we are categorically NOT on the stop
  // page regardless of heading text.
  const finalSubmitPresent = await isAnyLocatorPresent(
    page,
    CEAC_SIGN_AND_SUBMIT_MARKERS.finalSubmitSelector,
  );
  const captchaPresent = await isAnyLocatorPresent(
    page,
    CEAC_SIGN_AND_SUBMIT_MARKERS.captchaSelector,
  );

  return {
    headingMatches,
    signatureFieldPresent,
    finalSubmitPresent,
    captchaPresent,
  };
}

/**
 * Does the current page's heading match the Sign-and-Submit heading pattern?
 * Uses the same heading selector as `detectPage` for consistency.
 */
async function matchesHeading(page: Page): Promise<boolean> {
  // `detectPage` already runs this match inside its pattern loop, but we
  // need a standalone boolean here (independent of the full page-identity
  // probe) so the marker diagnostic is usable even when `pageId` resolves
  // to `"unknown"` for unrelated reasons.
  const { headingPattern } = CEAC_SIGN_AND_SUBMIT_MARKERS;
  const headingLocator = page.locator(CEAC_HEADING_SELECTOR);
  const count = await headingLocator.count();
  for (let i = 0; i < count; i += 1) {
    const text = (await headingLocator.nth(i).textContent())?.trim() ?? "";
    if (text && headingPattern.test(text)) return true;
  }
  return false;
}

/**
 * True when at least one node matching `selector` is in the DOM. Does not
 * require the node to be visible — CEAC hides and shows sign-page controls
 * dynamically (e.g. CAPTCHA after signature focus), and we want to detect
 * their presence in the template, not their current visibility.
 */
async function isAnyLocatorPresent(page: Page, selector: string): Promise<boolean> {
  try {
    return (await page.locator(selector).count()) > 0;
  } catch {
    return false;
  }
}

/**
 * Narrow predicate for type guards / debug assertions. Exported for callers
 * that receive a possibly-other outcome from a higher-level worker result
 * and want to discriminate without importing the full outcome type.
 */
export function isHandoffReadyOutcome(
  value: unknown,
): value is HandoffReadyOutcome {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { status?: unknown }).status === "handoff_ready"
  );
}

