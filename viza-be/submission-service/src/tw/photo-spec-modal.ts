import type { Locator, Page } from "@playwright/test";
import { TwUnexpectedPageError } from "./errors";

const PHOTO_SPEC_TEXT = "照片規格";
const TW_APPLY_PATH = "/coa-frontend/overseas-foreign-china/apply";
const DELIVERY_READY_TIMEOUT_MS = 10_000;

function photoSpecModalCandidates(page: Page): Locator {
  return page
    .locator('[role="dialog"], .modal-dialog, .modal-content, .modal')
    .filter({ hasText: PHOTO_SPEC_TEXT });
}

async function visiblePhotoSpecModal(page: Page): Promise<Locator | null> {
  const candidates = photoSpecModalCandidates(page);
  const count = await candidates.count().catch(() => 0);
  for (let i = 0; i < count; i++) {
    const candidate = candidates.nth(i);
    if (await candidate.isVisible().catch(() => false)) return candidate;
  }
  return null;
}

async function uniqueVisibleOkButton(modal: Locator): Promise<Locator> {
  const candidates = modal.locator('button, input[type="button"], input[type="submit"]');
  const count = await candidates.count().catch(() => 0);
  const visible: Locator[] = [];
  for (let i = 0; i < count; i++) {
    const candidate = candidates.nth(i);
    if (!(await candidate.isVisible().catch(() => false))) continue;
    const text = `${(await candidate.innerText().catch(() => ""))} ${((await candidate.getAttribute("value").catch(() => null)) ?? "")}`.trim();
    if (/^(OK|Ok|ok|確定|确定)$/.test(text)) visible.push(candidate);
  }
  if (visible.length !== 1) {
    throw new TwUnexpectedPageError(`Photo-spec modal expected exactly one visible OK/確定 button; found ${visible.length}`);
  }
  return visible[0];
}

export async function assertTwPhotoSpecModalCleared(page: Page): Promise<void> {
  const deadline = Date.now() + deliveryReadyTimeoutMs();
  let lastModalVisible = false;
  let lastContinentCount = 0;
  let lastContinentVisible = false;
  let lastContinentEnabled = false;
  let lastPath = "";

  while (Date.now() < deadline) {
    lastPath = safePath(page.url());
    if (lastPath !== TW_APPLY_PATH) {
      await page.waitForTimeout(150);
      continue;
    }

    const modal = await visiblePhotoSpecModal(page);
    lastModalVisible = Boolean(modal);
    if (modal) {
      await page.waitForTimeout(150);
      continue;
    }

    const continent = page.locator('[name="continent"]');
    lastContinentCount = await continent.count().catch(() => 0);
    lastContinentVisible = lastContinentCount === 1 && await continent.first().isVisible().catch(() => false);
    lastContinentEnabled = lastContinentCount === 1 && await continent.first().isEnabled().catch(() => false);
    if (lastContinentCount === 1 && lastContinentVisible && lastContinentEnabled) return;

    await page.waitForTimeout(150);
  }

  throw new TwUnexpectedPageError("Delivery-location continent control is not ready after photo-spec modal handling", {
    url: page.url(),
    details: await buildDeliveryLocationDiagnostics(page, {
      path: lastPath,
      photoSpecModalVisible: lastModalVisible,
      continentCount: lastContinentCount,
      continentVisible: lastContinentVisible,
      continentEnabled: lastContinentEnabled,
    }),
  });
}

export async function dismissTwPhotoSpecModalIfPresent(page: Page): Promise<boolean> {
  const modal = await visiblePhotoSpecModal(page);
  if (!modal) {
    await assertTwPhotoSpecModalCleared(page);
    return false;
  }

  const okButton = await uniqueVisibleOkButton(modal);
  await okButton.click({ timeout: 5_000 });

  const stillVisible = await visiblePhotoSpecModal(page);
  if (stillVisible) {
    await stillVisible.waitFor({ state: "hidden", timeout: deliveryReadyTimeoutMs() }).catch(() => undefined);
  }
  await assertTwPhotoSpecModalCleared(page);
  return true;
}

function deliveryReadyTimeoutMs(): number {
  const raw = process.env.TW_DELIVERY_READY_TIMEOUT_MS;
  if (!raw) return DELIVERY_READY_TIMEOUT_MS;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DELIVERY_READY_TIMEOUT_MS;
}

function safePath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return "";
  }
}

async function buildDeliveryLocationDiagnostics(
  page: Page,
  observed: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const [title, modalCount, visibleDialogTexts, selectNames, buttonTexts] = await Promise.all([
    page.title().catch(() => ""),
    photoSpecModalCandidates(page).count().catch(() => 0),
    page.locator('[role="dialog"], .modal:visible, .modal-dialog:visible, .modal-content:visible')
      .evaluateAll((nodes) => nodes
        .map((node) => (node.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 120))
        .filter(Boolean)
        .slice(0, 5))
      .catch(() => []),
    page.locator("select")
      .evaluateAll((nodes) => nodes
        .map((node) => node.getAttribute("name") ?? "")
        .filter(Boolean)
        .slice(0, 20))
      .catch(() => []),
    page.locator("button, input[type='button'], input[type='submit']")
      .evaluateAll((nodes) => nodes
        .map((node) => ((node.textContent ?? "") || node.getAttribute("value") || "").replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .slice(0, 20))
      .catch(() => []),
  ]);

  return {
    ...observed,
    title,
    photoSpecModalCandidateCount: modalCount,
    visibleDialogTexts,
    selectNames,
    buttonTexts,
  };
}
