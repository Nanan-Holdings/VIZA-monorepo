import type { Page } from "@playwright/test";
import { twClickButtonOrLink, twSelectByNameStrict, type TwFieldVerificationEntry } from "./fillers";
import { assertTwPhotoSpecModalCleared } from "./photo-spec-modal";
import { assertTwTermsModalCleared } from "./terms-modal";
import { TwUnexpectedPageError } from "./errors";

const DELIVERY_LOCATION_NAMES = {
  continent: "continent",
  embassy_office: "overseaOfficeId",
} as const;

export async function fillTwDeliveryLocationTabStrict(
  page: Page,
  answers: Record<string, string>,
  audit: TwFieldVerificationEntry[],
): Promise<void> {
  await selectTwDeliveryLocationStrict(page, answers, audit);
  await twClickButtonOrLink(page, "下一步");
  await page.waitForLoadState("domcontentloaded", { timeout: 15_000 }).catch(() => undefined);
}

export async function selectTwDeliveryLocationStrict(
  page: Page,
  answers: Record<string, string>,
  audit: TwFieldVerificationEntry[],
): Promise<void> {
  await assertTwTermsModalCleared(page);
  await assertTwPhotoSpecModalCleared(page);
  await waitForSelectReady(page, DELIVERY_LOCATION_NAMES.continent, "continent");
  if (answers.continent) {
    await twSelectByNameStrict(page, "continent", DELIVERY_LOCATION_NAMES.continent, answers.continent, audit);
    await waitForSelectOptionValue(page, DELIVERY_LOCATION_NAMES.embassy_office, answers.embassy_office, "embassy_office");
  }
  await waitForSelectReady(page, DELIVERY_LOCATION_NAMES.embassy_office, "embassy_office");
  await twSelectByNameStrict(page, "embassy_office", DELIVERY_LOCATION_NAMES.embassy_office, answers.embassy_office, audit);
}

async function waitForSelectReady(page: Page, name: string, fieldName: string): Promise<void> {
  const select = page.locator(`[name="${name}"]`).first();
  const ok = await select
    .waitFor({ state: "visible", timeout: 10_000 })
    .then(async () => select.isEnabled())
    .catch(() => false);
  if (!ok) {
    throw new TwUnexpectedPageError(`Taiwan delivery-location ${fieldName} select is not visible and enabled`, {
      url: page.url(),
      details: { controlName: name },
    });
  }
}

async function waitForSelectOptionValue(page: Page, name: string, value: string | undefined, fieldName: string): Promise<void> {
  if (!value) return;
  const deadline = Date.now() + 10_000;
  const select = page.locator(`[name="${name}"]`).first();
  while (Date.now() < deadline) {
    const hasOption = await select
      .locator("option")
      .evaluateAll((options, wanted) => options.some((option) => option.getAttribute("value") === wanted), value)
      .catch(() => false);
    if (hasOption && (await select.isVisible().catch(() => false)) && (await select.isEnabled().catch(() => false))) return;
    await page.waitForTimeout(150);
  }
  throw new TwUnexpectedPageError(`Taiwan delivery-location ${fieldName} option is not available after bounded wait`, {
    url: page.url(),
    details: { controlName: name },
  });
}
