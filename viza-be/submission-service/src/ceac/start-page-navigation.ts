import type { Page } from "@playwright/test";
import { CEAC_GATE_MARKERS, CEAC_URLS } from "./selectors";
import { assertNoGate } from "./gates";
import { LOCATION_SELECT_SELECTOR } from "./start-page-location";

export const CEAC_START_PAGE_VERIFICATION_GRACE_MS = 120_000;

export interface CeacStartPageNavigationOptions {
  /** Test-only shortening hook; production defaults to the capped 120s grace. */
  verificationGraceMs?: number;
}

export async function gotoCeacStartPage(
  page: Page,
  navigationTimeoutMs: number,
  options: CeacStartPageNavigationOptions = {},
): Promise<void> {
  await page.goto(CEAC_URLS.START, {
    waitUntil: "commit",
    timeout: navigationTimeoutMs,
  });
  // The security-verification interstitial also has an h2. Wait for the
  // actual CEAC form, or a definitive block for the caller's gate classifier.
  try {
    await waitForCeacStartPageReady(page, navigationTimeoutMs);
  } catch (initialError) {
    // CEAC can keep this same document open while its verification completes.
    // Do not extend unrelated navigation failures or make another request.
    if (!(await hasTransientVerificationSurface(page))) throw initialError;

    const graceMs = boundedVerificationGraceMs(options.verificationGraceMs);
    if (graceMs === 0) {
      await assertNoGate(page);
      throw initialError;
    }
    try {
      await waitForCeacStartPageReady(page, graceMs);
    } catch (graceError) {
      // A persistent recognized verification surface is an external gate. If
      // the page no longer has a gate marker, retain the ordinary timeout.
      try {
        await assertNoGate(page);
      } catch (gateError) {
        throw gateError;
      }
      throw graceError;
    }
  }
}

async function waitForCeacStartPageReady(page: Page, timeoutMs: number): Promise<void> {
  await page.waitForFunction((locationSelector) => {
    const text = document.body?.innerText ?? "";
    return (Boolean(document.querySelector(locationSelector))
      && /apply for a nonimmigrant visa|start an application|welcome/i.test(text))
      || /sorry, you have been blocked|access denied|request rejected/i.test(text);
  }, LOCATION_SELECT_SELECTOR, { timeout: timeoutMs });
}

async function hasTransientVerificationSurface(page: Page): Promise<boolean> {
  try {
    const visibleText = await page.locator("body").innerText({ timeout: 5_000 });
    return CEAC_GATE_MARKERS.transientVerificationTextPatterns.some((pattern) => pattern.test(visibleText));
  } catch {
    return false;
  }
}

function boundedVerificationGraceMs(value: number | undefined): number {
  if (value === undefined) return CEAC_START_PAGE_VERIFICATION_GRACE_MS;
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(value, CEAC_START_PAGE_VERIFICATION_GRACE_MS);
}
