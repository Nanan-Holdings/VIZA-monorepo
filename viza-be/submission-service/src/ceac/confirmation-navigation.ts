import type { Locator, Page } from "@playwright/test";
import { assertCeacPostbackHealthy, waitForAspNetPostback } from "./aspnet";
import { detectPage, isOfficialDs160ConfirmationPage } from "./pages";
import { waitForExpectedApplicationId } from "./recovered-application";

const CONFIRMATION_NEXT = 'input[type="submit"][value="Next: Confirmation" i]';

export interface ConfirmationContinuation {
  controlId: string;
}

function assertOfficialOrigin(page: Page): void {
  if (new URL(page.url()).origin !== "https://ceac.state.gov") {
    throw new Error("DS-160 confirmation continuation left the official origin.");
  }
}

async function visibleContinuation(page: Page): Promise<Locator | null> {
  const candidates = page.locator(CONFIRMATION_NEXT);
  const visible: Locator[] = [];
  for (let index = 0; index < await candidates.count(); index += 1) {
    const candidate = candidates.nth(index);
    if (await candidate.isVisible()) visible.push(candidate);
  }
  if (visible.length > 1) {
    throw new Error("DS-160 Next: Confirmation controls are ambiguous.");
  }
  return visible[0] ?? null;
}

/** Observe the actual disabled continuation before reserving the final click. */
export async function prepareConfirmationContinuation(
  page: Page,
): Promise<ConfirmationContinuation | null> {
  const next = await visibleContinuation(page);
  if (!next) return null; // Other CEAC layouts proceed directly to confirmation.
  assertOfficialOrigin(page);
  const controlId = await next.getAttribute("id");
  if (!controlId || await next.isEnabled()) {
    throw new Error("DS-160 confirmation continuation must be identified and disabled before signing.");
  }
  return { controlId };
}

/**
 * After the caller's ONE guarded signature click, CEAC may enable its observed
 * Next: Confirmation button. That navigation is not another signature action.
 * Never replay either click; success still requires the exact official proof.
 */
export async function waitForDs160SubmissionConfirmation(
  page: Page,
  expectedApplicationId: string,
  timeoutMs: number,
  continuation: ConfirmationContinuation | null,
): Promise<boolean> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("confirmationTimeoutMs must be a positive number.");
  }
  const deadline = Date.now() + timeoutMs;
  let continued = false;
  while (Date.now() < deadline) {
    assertCeacPostbackHealthy(page);
    if (continuation) assertOfficialOrigin(page);
    if (await isOfficialDs160ConfirmationPage(page, expectedApplicationId)) return true;
    if (continuation && !continued) {
      const next = await visibleContinuation(page);
      if (next) {
        if (await next.getAttribute("id") !== continuation.controlId) {
          throw new Error("DS-160 confirmation continuation identity changed after signing.");
        }
        if (await next.isEnabled()) {
          await waitForAspNetPostback(page, Math.max(1, deadline - Date.now()));
          assertOfficialOrigin(page);
          await waitForExpectedApplicationId(page, expectedApplicationId, {
            timeoutMs: Math.max(1, Math.min(5_000, deadline - Date.now())),
          });
          if ((await detectPage(page)).id !== "sign_and_submit") {
            throw new Error("DS-160 confirmation continuation is not on the signature page.");
          }
          const settledNext = await visibleContinuation(page);
          if (!settledNext || await settledNext.getAttribute("id") !== continuation.controlId ||
              !(await settledNext.isEnabled())) {
            throw new Error("DS-160 confirmation continuation changed during settlement.");
          }
          assertCeacPostbackHealthy(page);
          continued = true;
          await settledNext.click({ timeout: Math.max(1, Math.min(10_000, deadline - Date.now())) });
          await waitForAspNetPostback(page, Math.max(1, deadline - Date.now()));
        }
      }
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await page.waitForTimeout(Math.min(250, remaining));
  }
  return false;
}
