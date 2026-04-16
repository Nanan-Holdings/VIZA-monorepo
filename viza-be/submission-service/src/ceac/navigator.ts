/**
 * CEAC DS-160 page navigation.
 *
 * This module is the single choke point for moving between DS-160 pages. All
 * forward/back/save transitions must go through it so that:
 *
 *  1. The current page identity is asserted before the click, catching cases
 *     where a prior step silently landed on the wrong page.
 *  2. Validation failures raised by CEAC are detected and surfaced with page
 *     context instead of being swallowed and interpreted as a stuck worker.
 *  3. The destination page identity is verified after the click — navigation
 *     never depends on timing alone.
 *
 * This file adds behavior; it does not replace anything. The legacy worker in
 * `src/index.ts` is left untouched per the US-003 scope note. Downstream
 * stories (US-004+) should route their transitions through `advance` /
 * `goBack` / `saveCurrent` rather than clicking Next directly.
 */

import type { Locator, Page } from "@playwright/test";
import {
  CEAC_FIELD_ERROR_SELECTOR,
  CEAC_NAV_SELECTORS,
  CEAC_VALIDATION_SUMMARY_SELECTOR,
} from "./selectors";
import { assertPage, detectPage, waitForPage, type CeacPageId } from "./pages";
import { NavigationError, ValidationFailedError } from "./errors";

/**
 * Subset of CEAC navigation buttons the navigator knows how to click.
 *
 * `save` is a "soft" transition: it persists the current page and usually
 * keeps us on the same page rather than advancing. `next` / `back` are
 * "hard" transitions that are expected to change the page identity.
 */
export type CeacNavAction = "next" | "back" | "save";

/**
 * Options shared by all nav-action helpers. Every field is optional so callers
 * can stick to sane defaults.
 */
export interface NavigateOptions {
  /** Upper bound for destination-page detection (ms). Default: 45_000. */
  timeoutMs?: number;
  /** Poll interval while waiting for destination identity (ms). Default: 500. */
  pollIntervalMs?: number;
  /**
   * If true, assert the current page matches `from` before clicking. Callers
   * already on a known page can skip this for speed. Default: true.
   */
  assertFrom?: boolean;
}

/**
 * Validation messages surfaced by CEAC on the current page, separated into
 * the summary block (rendered by `asp:ValidationSummary`) and the per-field
 * validators (`asp:RequiredFieldValidator` etc).
 */
export interface CeacValidationReport {
  /** Any non-empty messages pulled from the ValidationSummary container(s). */
  summary: string[];
  /** Any non-empty per-field validator messages currently visible. */
  fieldErrors: string[];
  /** Combined list, preserving summary-then-field order, duplicates removed. */
  all: string[];
}

const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_POLL_INTERVAL_MS = 500;

/**
 * Read all visible validation messages on the current page.
 *
 * Only visible nodes are considered — CEAC leaves inactive validator spans in
 * the DOM with `display: none` until the server round-trips a failure.
 */
export async function readValidationMessages(page: Page): Promise<CeacValidationReport> {
  const summary = await collectVisibleTexts(page.locator(CEAC_VALIDATION_SUMMARY_SELECTOR));
  const fieldErrors = await collectVisibleTexts(page.locator(CEAC_FIELD_ERROR_SELECTOR));
  const all = dedupe([...summary, ...fieldErrors]);
  return { summary, fieldErrors, all };
}

/**
 * Convenience predicate over `readValidationMessages`.
 */
export async function hasValidationErrors(page: Page): Promise<boolean> {
  const report = await readValidationMessages(page);
  return report.all.length > 0;
}

/**
 * Click Next and verify we land on `to`.
 *
 * This is the canonical forward-transition primitive — downstream code that
 * needs to advance a single DS-160 page should call this instead of clicking
 * the Next button directly. Raises `ValidationFailedError` when CEAC rejects
 * the submission and `NavigationError` when the destination identity never
 * appears within the timeout.
 */
export async function advance(
  page: Page,
  params: { from: CeacPageId; to: CeacPageId | CeacPageId[] } & NavigateOptions,
): Promise<CeacPageId> {
  return runTransition(page, {
    action: "next",
    from: params.from,
    to: params.to,
    options: params,
  });
}

/**
 * Click Back and verify we land on `to`. Same error surface as `advance`.
 */
export async function goBack(
  page: Page,
  params: { from: CeacPageId; to: CeacPageId | CeacPageId[] } & NavigateOptions,
): Promise<CeacPageId> {
  return runTransition(page, {
    action: "back",
    from: params.from,
    to: params.to,
    options: params,
  });
}

/**
 * Click Save and verify we stayed on (or landed back on) `at`.
 *
 * CEAC's Save flow typically re-renders the same page; some versions show a
 * brief "Your application has been saved" interstitial before returning. We
 * accept `at` as either the origin page or an explicit list of acceptable
 * destinations to cover both cases.
 */
export async function saveCurrent(
  page: Page,
  params: { at: CeacPageId | CeacPageId[] } & NavigateOptions,
): Promise<CeacPageId> {
  // `from` for the assertion is the first entry of `at`; this works whether
  // callers pass a single id or a list.
  const atList = Array.isArray(params.at) ? params.at : [params.at];
  if (atList.length === 0) {
    throw new NavigationError("saveCurrent requires at least one expected page id", {
      expected: [],
    });
  }
  return runTransition(page, {
    action: "save",
    from: atList[0],
    to: atList,
    options: { ...params, assertFrom: params.assertFrom ?? false },
  });
}

/**
 * Lower-level transition primitive. Most callers should prefer `advance`,
 * `goBack`, or `saveCurrent`.
 */
async function runTransition(
  page: Page,
  params: {
    action: CeacNavAction;
    from: CeacPageId;
    to: CeacPageId | CeacPageId[];
    options: NavigateOptions;
  },
): Promise<CeacPageId> {
  const timeoutMs = params.options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pollIntervalMs = params.options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const assertFrom = params.options.assertFrom ?? true;

  if (assertFrom) {
    // If the page is not where we thought it was, fail loudly with origin
    // context before clicking anything CEAC-side.
    await assertPage(page, params.from);
  }

  const navButton = await resolveNavButton(page, params.action);
  if (!navButton) {
    throw new NavigationError(
      `CEAC navigation button for action "${params.action}" not found on page "${params.from}"`,
      {
        expected: params.from,
        url: page.url(),
        details: { action: params.action },
      },
    );
  }

  // Click + wait for either the destination identity or a ValidationSummary
  // to appear. `Promise.race` is not quite right here because we want to
  // prefer validation failures — if CEAC short-circuits the submit with
  // errors, the URL/heading may not change at all.
  try {
    await navButton.click();
  } catch (err) {
    throw new NavigationError(
      `Failed to click CEAC ${params.action} button on page "${params.from}"`,
      {
        expected: params.from,
        url: page.url(),
        details: {
          action: params.action,
          cause: err instanceof Error ? err.message : String(err),
        },
      },
    );
  }

  // Give CEAC a moment to either navigate or render validators. Using
  // `waitForLoadState('networkidle')` with a short budget is safe: if the
  // server bounced us with inline validation, load is already idle; if it
  // actually navigated, we'll pick that up on the next probe.
  try {
    await page.waitForLoadState("networkidle", { timeout: Math.min(5_000, timeoutMs) });
  } catch {
    // non-fatal; page-identity polling below will still run.
  }

  // Short-circuit on validation failure before spending the full timeout
  // budget polling for a page identity that will never change.
  const probe = await detectPage(page);
  const expectedList = Array.isArray(params.to) ? params.to : [params.to];
  const alreadyOnDestination = probe.id !== "unknown" && expectedList.includes(probe.id);

  if (!alreadyOnDestination) {
    const validation = await readValidationMessages(page);
    if (validation.all.length > 0) {
      throw new ValidationFailedError(
        `CEAC ${params.action} rejected on page "${params.from}": ${validation.all[0]}`,
        {
          expected: params.from,
          detected: probe.id,
          url: probe.url,
          validationMessages: validation.all,
          details: {
            action: params.action,
            heading: probe.heading,
            summary: validation.summary,
            fieldErrors: validation.fieldErrors,
          },
        },
      );
    }
  }

  // No validation failure and not yet on destination — poll until identity
  // settles or we time out. `waitForPage` throws `UnexpectedPageError` on
  // timeout; translate that into `NavigationError` so the failure class
  // reflects "navigation didn't land" rather than "page identity mismatch".
  try {
    return await waitForPage(page, expectedList, { timeoutMs, pollIntervalMs });
  } catch (err) {
    const detected = (err as { context?: { detected?: CeacPageId | "unknown" } })?.context?.detected;
    throw new NavigationError(
      `CEAC ${params.action} from "${params.from}" did not reach [${expectedList.join(", ")}] within ${timeoutMs}ms`,
      {
        expected: expectedList,
        detected: detected ?? "unknown",
        url: page.url(),
        details: {
          action: params.action,
          from: params.from,
          cause: err instanceof Error ? err.message : String(err),
        },
      },
    );
  }
}

/**
 * Resolve the first visible nav button for the given action. Returns `null`
 * if no matching button is present, which `runTransition` converts into a
 * `NavigationError` with context.
 */
async function resolveNavButton(page: Page, action: CeacNavAction): Promise<Locator | null> {
  const selector = navSelectorFor(action);
  const candidates = page.locator(selector);
  const count = await candidates.count();
  for (let i = 0; i < count; i += 1) {
    const candidate = candidates.nth(i);
    if (await candidate.isVisible()) {
      return candidate;
    }
  }
  return null;
}

function navSelectorFor(action: CeacNavAction): string {
  switch (action) {
    case "next":
      return CEAC_NAV_SELECTORS.next;
    case "back":
      return CEAC_NAV_SELECTORS.back;
    case "save":
      return CEAC_NAV_SELECTORS.save;
  }
}

async function collectVisibleTexts(locator: Locator): Promise<string[]> {
  const count = await locator.count();
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const node = locator.nth(i);
    // Invisible validators are spans with `display: none` until triggered;
    // `isVisible` filters those out without a `getComputedStyle` round-trip.
    if (!(await node.isVisible())) continue;
    const text = (await node.textContent())?.trim() ?? "";
    if (text.length > 0) out.push(text);
  }
  return out;
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      out.push(value);
    }
  }
  return out;
}
