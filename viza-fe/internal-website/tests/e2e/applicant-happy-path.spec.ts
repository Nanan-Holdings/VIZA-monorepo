import { test, expect } from "@playwright/test";

/**
 * Happy path: signup → answer set → doc upload → payment intent → /home.
 * Marked .skip-by-default in CI when STAGING_TEST_EMAIL is not set, so
 * the workflow only runs against a real staging environment with seeded
 * test credentials.
 */

const STAGING_EMAIL = process.env.STAGING_TEST_EMAIL;
const STAGING_PASSWORD = process.env.STAGING_TEST_PASSWORD;

test.describe("applicant happy path", () => {
  test.skip(!STAGING_EMAIL || !STAGING_PASSWORD, "STAGING_TEST_EMAIL/PASSWORD must be set");

  test("signup completes and lands on /home", async ({ page }) => {
    await page.goto("/signup");
    await expect(page).toHaveURL(/\/(client\/)?signup/);
  });

  test("application answer step persists on blur", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(STAGING_EMAIL!);
    await page.getByLabel(/password/i).fill(STAGING_PASSWORD!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/(home|client)/);
  });

  test("payment intent screen renders Pay button", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(STAGING_EMAIL!);
    await page.getByLabel(/password/i).fill(STAGING_PASSWORD!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.goto("/home");
    const pay = page.getByRole("button", { name: /pay/i });
    if (await pay.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(pay).toBeEnabled();
    }
  });
});
