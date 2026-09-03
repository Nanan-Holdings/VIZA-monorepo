import { expect, test } from "@playwright/test";

const email = process.env.STAGING_TEST_EMAIL;
const password = process.env.STAGING_TEST_PASSWORD;

const resultCases = [
  { name: "Singapore", country: "singapore", visaType: "SG_ARRIVAL_CARD", id: process.env.VIZA_E2E_SG_SUCCESS_APPLICATION_ID, confirmation: true },
  { name: "Philippines", country: "philippines", visaType: "PH_ETRAVEL_ARRIVAL_CARD", id: process.env.VIZA_E2E_PH_SUCCESS_APPLICATION_ID, confirmation: true },
  { name: "generic e-visa", country: "indonesia", visaType: "ID_B1_EVOA", id: process.env.VIZA_E2E_GENERIC_SUCCESS_APPLICATION_ID, confirmation: true },
  { name: "manual / failed", country: "vietnam", visaType: "VN_E_VISA", id: process.env.VIZA_E2E_MANUAL_APPLICATION_ID, confirmation: false },
] as const;

test.describe("submission result placement", () => {
  test.skip(!email || !password, "STAGING_TEST_EMAIL/PASSWORD must be set");

  for (const resultCase of resultCases) {
    test(`${resultCase.name} keeps terminal result in the expected region`, async ({ page }) => {
      test.skip(!resultCase.id, `Set an authenticated seeded application id for ${resultCase.name}`);
      await page.goto("/login");
      await page.getByLabel(/email/i).fill(email!);
      await page.getByLabel(/password/i).fill(password!);
      await page.getByRole("button", { name: /sign in/i }).click();

      await page.goto(
        `/client/application/long-form?country=${resultCase.country}&visaType=${resultCase.visaType}&applicationId=${resultCase.id}`,
      );
      await expect(page.getByRole("heading", { name: /review/i })).toBeVisible();

      const confirmation = page.locator('[id^="application-step-"]').filter({ hasText: /Submission result|提交结果/i });
      if (resultCase.confirmation) {
        await expect(confirmation).toHaveCount(1);
      } else {
        await expect(confirmation).toHaveCount(0);
        await expect(page.getByRole("heading", { name: /review/i }).locator("..")).toContainText(/submission|payment|action|required|failed/i);
      }
    });
  }
});
