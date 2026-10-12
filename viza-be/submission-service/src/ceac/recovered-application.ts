import type { Locator, Page } from "@playwright/test";
import { captureApplicationId } from "./checkpoints";
import { detectPage, waitForPage, type CeacPageId } from "./pages";
import { CEAC_URLS } from "./selectors";
import type { CeacSession } from "./session";

/**
 * CEAC pages on which a retrieved, still-in-progress DS-160 can safely
 * resume. The retrieve postback can briefly expose an incomplete/unknown DOM;
 * callers must wait for one of these identities before checking the
 * application ID. The ID itself can render a little later than the heading,
 * so the guard below waits for a missing value within a bounded window.
 */
export const RECOVERABLE_DS160_PAGE_IDS = [
  "personal_information_1",
  "personal_information_2",
  "travel_information",
  "travel_companions",
  "previous_us_travel",
  "address_and_phone",
  "passport",
  "us_contact",
  "family_relatives",
  "family_spouse",
  "work_education_present",
  "work_education_previous",
  "work_education_additional",
  "security_background_1",
  "security_background_2",
  "security_background_3",
  "security_background_4",
  "security_background_5",
  "upload_photo",
  "confirm_photo",
  "save_confirmation",
  "review",
  "sign_and_submit",
] as const satisfies readonly CeacPageId[];

export interface RecoveredDs160LandingOptions {
  timeoutMs?: number;
  pollIntervalMs?: number;
}

export interface RewindRecoveredDs160Options extends RecoveredDs160LandingOptions {
  /** Page identity already verified by assertRecoveredDs160Application. */
  currentPageId?: CeacPageId;
}

/** Reconnect only a dropped transport, preserving the exact draft and page. */
export async function reconnectVerifiedCeacPage(
  session: CeacSession,
  expectedApplicationId: string,
  allowedPageIds: readonly CeacPageId[],
  options: RecoveredDs160LandingOptions = {},
): Promise<boolean> {
  if (session.browser.isConnected() || !session.reconnect) return false;
  await session.reconnect();
  assertOfficialCeacOrigin(session.page.url());
  const pageId = await assertRecoveredDs160Application(session.page, expectedApplicationId, options);
  if (!allowedPageIds.includes(pageId)) {
    throw new Error("DS-160 browser reconnection returned an unexpected official page.");
  }
  return true;
}

const RECOVERED_APPLICATION_ID_TIMEOUT_MS = 10_000;
const RECOVERED_APPLICATION_ID_POLL_INTERVAL_MS = 100;
const RECOVERED_APPLICATION_ID_ERROR =
  "DS-160 captured resume returned a different or missing CEAC Application ID.";

/**
 * Wait for CEAC's retrieve navigation and Application ID to settle, then
 * enforce the same official ID before a captured resume can continue.
 * Unknown, start, retrieve, session-expired, and confirmation surfaces never
 * satisfy this guard because they are not in the allowlist above.
 */
export async function assertRecoveredDs160Application(
  page: Page,
  expectedApplicationId: string,
  options: RecoveredDs160LandingOptions = {},
): Promise<CeacPageId> {
  const pageId = await waitForPage(page, [...RECOVERABLE_DS160_PAGE_IDS], options);
  await waitForExpectedApplicationId(page, expectedApplicationId, options);
  return pageId;
}

/**
 * Rewind a retrieved, incomplete CEAC draft to Personal Information 1.
 *
 * CEAC resumes at the last saved section. Before the normal fill loop starts,
 * use the visible official sidebar link to return to the first editable page
 * so current VIZA answers can refresh earlier fields. The link target is read
 * from the current DOM and must stay on the official CEAC origin; this helper
 * never invents a draft or start URL.
 */
export async function rewindRecoveredDs160ApplicationToPersonalInformation1(
  page: Page,
  expectedApplicationId: string,
  options: RewindRecoveredDs160Options = {},
): Promise<"personal_information_1"> {
  const currentPageId = options.currentPageId ?? (await detectPage(page)).id;

  if (
    currentPageId === "unknown" ||
    currentPageId === "confirmation" ||
    !RECOVERABLE_DS160_PAGE_IDS.some((pageId) => pageId === currentPageId)
  ) {
    throw new Error(
      `DS-160 captured resume cannot rewind from unsafe CEAC page "${currentPageId}".`,
    );
  }

  const currentUrl = page.url();
  const currentOrigin = assertOfficialCeacOrigin(currentUrl);
  await assertCurrentApplicationId(page, expectedApplicationId, options);

  if (currentPageId === "personal_information_1") {
    return currentPageId;
  }

  const personalInfoLink = await findPersonalInformation1Link(page, currentUrl, currentOrigin);
  if (personalInfoLink) {
    const href = (await personalInfoLink.getAttribute("href")) ?? "";
    const target = new URL(href, currentUrl);
    if (target.origin !== currentOrigin) {
      throw new Error("DS-160 captured resume Personal Information 1 link is not same-origin.");
    }

    const targetWindow = (await personalInfoLink.getAttribute("target"))?.trim().toLowerCase();
    if (targetWindow && targetWindow !== "_self") {
      throw new Error("DS-160 captured resume Personal Information 1 link opens another window.");
    }
    await personalInfoLink.click({ timeout: options.timeoutMs ?? 30_000 });
  } else if (currentPageId === "personal_information_2") {
    const backControl = await findBackToPersonalInformation1Control(page);
    if (!backControl) {
      throw new Error("DS-160 captured resume has no visible Personal Information 1 sidebar link or Back: Personal 1 control.");
    }
    await backControl.click({ timeout: options.timeoutMs ?? 30_000 });
  } else {
    throw new Error("DS-160 captured resume has no visible Personal Information 1 sidebar link.");
  }
  await waitForPage(page, "personal_information_1", {
    timeoutMs: options.timeoutMs,
    pollIntervalMs: options.pollIntervalMs,
  });
  assertOfficialCeacOrigin(page.url());
  await assertCurrentApplicationId(page, expectedApplicationId, options);
  return "personal_information_1";
}

async function assertCurrentApplicationId(
  page: Page,
  expectedApplicationId: string,
  options: RecoveredDs160LandingOptions,
): Promise<void> {
  await waitForExpectedApplicationId(page, expectedApplicationId, options);
}

export async function waitForExpectedApplicationId(
  page: Page,
  expectedApplicationId: string,
  options: RecoveredDs160LandingOptions = {},
  errorMessage = RECOVERED_APPLICATION_ID_ERROR,
): Promise<string> {
  const expected = expectedApplicationId.trim().toUpperCase();
  const timeoutMs = Math.max(
    0,
    options.timeoutMs ?? RECOVERED_APPLICATION_ID_TIMEOUT_MS,
  );
  const pollIntervalMs = Math.max(
    0,
    options.pollIntervalMs ?? RECOVERED_APPLICATION_ID_POLL_INTERVAL_MS,
  );
  const deadline = Date.now() + timeoutMs;

  while (true) {
    const captured = await captureApplicationId(page);
    const actual = captured.applicationId?.trim().toUpperCase() ?? "";

    if (actual) {
      if (actual !== expected) {
        throw new Error(errorMessage);
      }
      return actual;
    }

    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      throw new Error(errorMessage);
    }

    await page.waitForTimeout(Math.min(pollIntervalMs, remainingMs));
  }
}

function assertOfficialCeacOrigin(currentUrl: string): string {
  let currentOrigin: string;
  try {
    currentOrigin = new URL(currentUrl).origin;
  } catch {
    throw new Error("DS-160 captured resume cannot rewind from a non-official CEAC origin.");
  }

  const officialOrigin = new URL(CEAC_URLS.START).origin;
  if (currentOrigin !== officialOrigin) {
    throw new Error("DS-160 captured resume cannot rewind from a non-official CEAC origin.");
  }
  return currentOrigin;
}

async function findPersonalInformation1Link(
  page: Page,
  currentUrl: string,
  currentOrigin: string,
): Promise<Locator | null> {
  const links = page.locator("a[href]");
  const count = await links.count();
  for (let index = 0; index < count; index += 1) {
    const link = links.nth(index);
    if (!(await link.isVisible().catch(() => false))) continue;

    const label = [
      await link.textContent().catch(() => null),
      await link.getAttribute("aria-label"),
      await link.getAttribute("title"),
    ]
      .filter((value): value is string => Boolean(value))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    const href = (await link.getAttribute("href"))?.trim() ?? "";
    let target: URL | null = null;
    if (href) {
      try {
        target = new URL(href, currentUrl);
      } catch {
        throw new Error("DS-160 captured resume Personal Information 1 link is not same-origin.");
      }
    }
    const pointsToPersonalInfo1 =
      /\bpersonal\s+(?:information|info)\s*1\b/i.test(label) ||
      Boolean(target && /\/complete_personal\.aspx(?:$|[?#])/i.test(target.pathname + target.search + target.hash));
    if (!pointsToPersonalInfo1) continue;

    if (!href || /^#|^javascript:/i.test(href)) {
      throw new Error("DS-160 captured resume has no navigable Personal Information 1 sidebar link.");
    }
    if (!target || target.origin !== currentOrigin) {
      throw new Error("DS-160 captured resume Personal Information 1 link is not same-origin.");
    }
    return link;
  }

  return null;
}

async function findBackToPersonalInformation1Control(page: Page): Promise<Locator | null> {
  const controls = page.locator('input[type="submit"], button');
  const count = await controls.count();
  for (let index = 0; index < count; index += 1) {
    const control = controls.nth(index);
    if (!(await control.isVisible().catch(() => false))) continue;
    const label = [
      await control.getAttribute("value"),
      await control.textContent().catch(() => null),
      await control.getAttribute("aria-label"),
      await control.getAttribute("title"),
    ]
      .filter((value): value is string => Boolean(value))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (/^back\s*:\s*personal(?:\s+information)?\s*1\b/i.test(label)) {
      return control;
    }
  }
  return null;
}
