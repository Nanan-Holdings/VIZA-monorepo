import type { Page } from "@playwright/test";
import { CEAC_URLS } from "./selectors";
import { LOCATION_SELECT_SELECTOR } from "./start-page-location";

export async function gotoCeacStartPage(
  page: Page,
  navigationTimeoutMs: number,
): Promise<void> {
  await page.goto(CEAC_URLS.START, {
    waitUntil: "commit",
    timeout: navigationTimeoutMs,
  });
  // The security-verification interstitial also has an h2. Wait for the
  // actual CEAC form, or a definitive block for the caller's gate classifier.
  await page.waitForFunction((locationSelector) => {
    const text = document.body?.innerText ?? "";
    return (Boolean(document.querySelector(locationSelector))
      && /apply for a nonimmigrant visa|start an application|welcome/i.test(text))
      || /sorry, you have been blocked|access denied|request rejected/i.test(text);
  }, LOCATION_SELECT_SELECTOR, { timeout: navigationTimeoutMs });
}
