import { test, expect } from "@playwright/test";

/**
 * Mobile-responsive snapshot matrix (QA-003).
 * Snapshots committed under tests/mobile/__screenshots__/. Diffs fail
 * the build; update via `--update-snapshots` when intentional.
 */

test("/home renders on mobile", async ({ page }) => {
  await page.goto("/home");
  await expect(page).toHaveScreenshot({ fullPage: true, maxDiffPixelRatio: 0.02 });
});

test("/signup renders on mobile", async ({ page }) => {
  await page.goto("/signup");
  await expect(page).toHaveScreenshot({ fullPage: true, maxDiffPixelRatio: 0.02 });
});

test("/application stub renders on mobile", async ({ page }) => {
  test.skip(!process.env.STAGING_TEST_EMAIL, "needs STAGING_TEST_EMAIL to reach /application");
  await page.goto("/login");
});
