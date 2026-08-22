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
const PRIMARY_CLICK_SETTLE_MS = 10_000;
const REQUEST_SUBMIT_SETTLE_MS = 10_000;

interface ClientValidationDiagnostic {
  pageIsValid: boolean | null;
  invalidValidators: Array<{
    id: string;
    message: string;
    visible: boolean;
  }>;
}

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
  const navButtonId = (await navButton.getAttribute("id")) ?? "";
  const navButtonName = (await navButton.getAttribute("name")) ?? "";
  const navButtonValue = (await navButton.getAttribute("value")) ?? "";

  // Click + wait for either the destination identity or a ValidationSummary
  // to appear. `Promise.race` is not quite right here because we want to
  // prefer validation failures — if CEAC short-circuits the submit with
  // errors, the URL/heading may not change at all.
  let pageCompleteDialogHandled = false;
  try {
    pageCompleteDialogHandled = await performWithPageCompleteDialogAcceptance(
      page,
      params.from,
      () => navButton.click(),
    );
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

  let pageCompletePromptHandled = await continueAfterPageCompletePrompt(
    page,
    params.from,
  );

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

  // Allow the ordinary click a bounded window to settle. Passport has
  // occasionally remained on the same WebForms page even though all client
  // validators passed and Playwright reported a successful click. In that
  // narrow case, requestSubmit preserves the clicked button's name/value and
  // gives the browser a standards-based form-submit fallback.
  const primaryWindowMs = Math.min(PRIMARY_CLICK_SETTLE_MS, timeoutMs);
  try {
    return await waitForPage(page, expectedList, {
      timeoutMs: primaryWindowMs,
      pollIntervalMs,
    });
  } catch {
    // Continue into the same-page diagnostic/fallback path below.
  }

  let validationDiagnostic = await readClientValidationDiagnostic(page);
  let currentProbe = await detectPage(page);
  const canRetrySubmit =
    params.action === "next" &&
    currentProbe.id === params.from &&
    validationDiagnostic.pageIsValid !== false &&
    validationDiagnostic.invalidValidators.length === 0 &&
    timeoutMs > primaryWindowMs;

  let requestSubmitAttempted = false;
  if (canRetrySubmit) {
    requestSubmitAttempted = true;
    pageCompleteDialogHandled =
      (await performWithPageCompleteDialogAcceptance(
        page,
        params.from,
        () =>
          navButton.evaluate((node) => {
            const button = node as HTMLInputElement;
            if (button.form && typeof button.form.requestSubmit === "function") {
              button.form.requestSubmit(button);
            } else {
              button.click();
            }
          }),
      ).catch(() => false)) || pageCompleteDialogHandled;
    pageCompletePromptHandled =
      (await continueAfterPageCompletePrompt(page, params.from)) ||
      pageCompletePromptHandled;
  }

  if (requestSubmitAttempted) {
    try {
      return await waitForPage(page, expectedList, {
        timeoutMs: Math.min(
          REQUEST_SUBMIT_SETTLE_MS,
          timeoutMs - primaryWindowMs,
        ),
        pollIntervalMs,
      });
    } catch {
      // Continue into the WebForms-specific postback fallback below.
    }
  }

  validationDiagnostic = await readClientValidationDiagnostic(page);
  currentProbe = await detectPage(page);
  const canRetryWebFormsPostback =
    requestSubmitAttempted &&
    currentProbe.id === params.from &&
    validationDiagnostic.pageIsValid !== false &&
    validationDiagnostic.invalidValidators.length === 0;

  if (canRetryWebFormsPostback) {
    pageCompleteDialogHandled =
      (await performWithPageCompleteDialogAcceptance(
        page,
        params.from,
        () =>
          navButton.evaluate((node) => {
            type WebFormsWindow = Window & {
              __doPostBack?: (eventTarget: string, eventArgument: string) => void;
              ValidNavigation?: () => unknown;
            };
            const button = node as HTMLInputElement;
            const webFormsWindow = window as WebFormsWindow;
            if (typeof webFormsWindow.ValidNavigation === "function") {
              webFormsWindow.ValidNavigation();
            }
            if (typeof webFormsWindow.__doPostBack === "function" && button.name) {
              webFormsWindow.__doPostBack(button.name, "");
            } else {
              button.click();
            }
          }),
      ).catch(() => false)) || pageCompleteDialogHandled;
    pageCompletePromptHandled =
      (await continueAfterPageCompletePrompt(page, params.from)) ||
      pageCompletePromptHandled;
  }

  // Poll the remaining timeout budget after the optional WebForms postback.
  // `waitForPage` throws on timeout; translate it below.
  try {
    return await waitForPage(page, expectedList, {
      timeoutMs: Math.max(
        pollIntervalMs,
        timeoutMs - primaryWindowMs -
          (requestSubmitAttempted ? REQUEST_SUBMIT_SETTLE_MS : 0),
      ),
      pollIntervalMs,
    });
  } catch (err) {
    const detected = (err as { context?: { detected?: CeacPageId | "unknown" } })?.context?.detected;
    // ASP.NET validators can be rendered by a late UpdatePanel response after
    // the initial post-click probe. Re-read them at the failure boundary so a
    // rejected form is reported as validation, not a misleading timeout.
    const lateValidation = await readValidationMessages(page);
    if (lateValidation.all.length > 0) {
      const lateProbe = await detectPage(page);
      throw new ValidationFailedError(
        `CEAC ${params.action} rejected on page "${params.from}": ${lateValidation.all[0]}`,
        {
          expected: params.from,
          detected: lateProbe.id,
          url: lateProbe.url,
          validationMessages: lateValidation.all,
          details: {
            action: params.action,
            heading: lateProbe.heading,
            summary: lateValidation.summary,
            fieldErrors: lateValidation.fieldErrors,
          },
        },
      );
    }
    validationDiagnostic = await readClientValidationDiagnostic(page);
    currentProbe = await detectPage(page);
    throw new NavigationError(
      `CEAC ${params.action} from "${params.from}" did not reach [${expectedList.join(", ")}] within ${timeoutMs}ms`,
      {
        expected: expectedList,
        detected: detected ?? "unknown",
        url: page.url(),
        details: {
          action: params.action,
          from: params.from,
          navButtonId,
          navButtonName,
          navButtonValue,
          clientValidation: validationDiagnostic,
          requestSubmitAttempted,
          webFormsPostbackAttempted: canRetryWebFormsPostback,
          pageCompleteDialogHandled,
          pageCompletePromptHandled,
          cause: err instanceof Error ? err.message : String(err),
        },
      },
    );
  }
}

async function performWithPageCompleteDialogAcceptance(
  page: Page,
  from: CeacPageId,
  action: () => Promise<unknown>,
): Promise<boolean> {
  if (from !== "passport") {
    await action();
    return false;
  }

  let handled = false;
  const acceptDialog = async (dialog: {
    accept: () => Promise<void>;
  }): Promise<void> => {
    handled = true;
    await dialog.accept();
  };
  page.once("dialog", acceptDialog);
  try {
    await action();
  } finally {
    if (!handled) {
      page.off("dialog", acceptDialog);
    }
  }
  return handled;
}

async function continueAfterPageCompletePrompt(
  page: Page,
  from: CeacPageId,
): Promise<boolean> {
  // CEAC can show a section-boundary prompt or a passport-country warning
  // after Passport. "No – Continue Form" and "Save and Continue" both mean
  // continue to U.S. Contact; they are required second clicks, not the page's
  // primary Next button.
  if (from !== "passport") return false;

  const candidates = page.locator(CEAC_NAV_SELECTORS.continueAfterPageComplete);
  try {
    await candidates.first().waitFor({ state: "visible", timeout: 5_000 });
  } catch {
    return false;
  }

  const count = await candidates.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = candidates.nth(index);
    if (!(await candidate.isVisible().catch(() => false))) continue;
    await candidate.click({ timeout: 5_000 });
    return true;
  }
  return false;
}

async function readClientValidationDiagnostic(
  page: Page,
): Promise<ClientValidationDiagnostic> {
  return page.evaluate(() => {
    type ValidatorNode = HTMLElement & {
      isvalid?: boolean;
      errormessage?: string;
    };
    type CeacWindow = Window & {
      Page_ClientValidate?: () => boolean;
      Page_IsValid?: boolean;
      Page_Validators?: ValidatorNode[];
    };

    const ceacWindow = window as CeacWindow;
    let pageIsValid: boolean | null = null;
    try {
      if (typeof ceacWindow.Page_ClientValidate === "function") {
        pageIsValid = Boolean(ceacWindow.Page_ClientValidate());
      } else if (typeof ceacWindow.Page_IsValid === "boolean") {
        pageIsValid = ceacWindow.Page_IsValid;
      }
    } catch {
      pageIsValid = typeof ceacWindow.Page_IsValid === "boolean"
        ? ceacWindow.Page_IsValid
        : null;
    }

    const validators = Array.isArray(ceacWindow.Page_Validators)
      ? ceacWindow.Page_Validators
      : [];
    const invalidValidators = validators
      .filter((validator) => validator?.isvalid === false)
      .map((validator) => ({
        id: validator.id || "",
        message: (validator.errormessage || validator.textContent || "").trim(),
        visible: Boolean(
          validator.getClientRects().length &&
          window.getComputedStyle(validator).visibility !== "hidden",
        ),
      }));

    return { pageIsValid, invalidValidators };
  }).catch(() => ({ pageIsValid: null, invalidValidators: [] }));
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
  if (process.env.CEAC_FILL_DEBUG === "1") {
    console.log(`[nav] action=${action} url=${page.url()} selector=${selector} count=${count}`);
  }
  for (let i = 0; i < count; i += 1) {
    const candidate = candidates.nth(i);
    const visible = await candidate.isVisible();
    if (process.env.CEAC_FILL_DEBUG === "1") {
      const id = (await candidate.getAttribute("id")) ?? "";
      const val = (await candidate.getAttribute("value")) ?? "";
      console.log(`[nav]   [${i}] id="${id}" value="${val}" visible=${visible}`);
    }
    if (visible) return candidate;
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
