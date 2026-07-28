import type { Page } from "@playwright/test";

/** Dismiss the gov.uk cookie banner if present. Best-effort — the banner
 *  can otherwise swallow the first form submit and leave the application
 *  on an early unanswered page. */
export async function dismissUkCookieBanner(page: Page): Promise<void> {
  try {
    const accept = page
      .locator(
        'button:has-text("Accept additional cookies"), button:has-text("Accept all"), button[name="cookies"][value="accept"]',
      )
      .first();
    if ((await accept.count()) > 0 && (await accept.isVisible().catch(() => false))) {
      await accept.click({ timeout: 3_000 }).catch(() => undefined);
      const hide = page
        .locator('button:has-text("Hide this message"), button:has-text("Hide"), a:has-text("Hide")')
        .first();
      if ((await hide.count()) > 0) await hide.click({ timeout: 2_000 }).catch(() => undefined);
    }
  } catch {
    /* best-effort */
  }
}
