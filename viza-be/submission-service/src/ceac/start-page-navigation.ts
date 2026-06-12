import type { Page } from "@playwright/test";
import { CEAC_HEADING_SELECTOR, CEAC_URLS } from "./selectors";

export async function gotoCeacStartPage(
  page: Page,
  navigationTimeoutMs: number,
): Promise<void> {
  await page.goto(CEAC_URLS.START, {
    waitUntil: "commit",
    timeout: navigationTimeoutMs,
  });
  await page.waitForSelector(CEAC_HEADING_SELECTOR, {
    state: "attached",
    timeout: navigationTimeoutMs,
  });
}
