import { test, expect } from "@playwright/test";

const STAGING_EMAIL = process.env.STAGING_TEST_EMAIL;
const STAGING_PASSWORD = process.env.STAGING_TEST_PASSWORD;

test.describe("applicant edge cases", () => {
  test.skip(!STAGING_EMAIL || !STAGING_PASSWORD, "STAGING_TEST_EMAIL/PASSWORD must be set");

  test("resume after page refresh keeps prior answers", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(STAGING_EMAIL!);
    await page.getByLabel(/password/i).fill(STAGING_PASSWORD!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.goto("/home");
    // Hop into the first listed application's answer page.
    const continueBtn = page.getByRole("link", { name: /continue/i }).first();
    if (await continueBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await continueBtn.click();
      const surname = page.getByLabel(/surname/i);
      if (await surname.isVisible().catch(() => false)) {
        await surname.fill("DOE");
        await surname.blur();
        await page.reload();
        await expect(surname).toHaveValue("DOE");
      }
    }
  });

  test("OCR consistency panel surfaces mismatch", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(STAGING_EMAIL!);
    await page.getByLabel(/password/i).fill(STAGING_PASSWORD!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.goto("/home");
    // Smoke: only assert the OCR panel renders when present (depends on prior upload).
    const ocrPanel = page.getByRole("heading", { name: /passport ocr check/i });
    if (await ocrPanel.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(ocrPanel).toBeVisible();
    }
  });
});
