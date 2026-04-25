/**
 * Page-identity detection for the France-Visas flow.
 *
 * Pre-auth pages (registration, check_mailbox) live on connect.france-visas.gouv.fr.
 * Post-auth pages live on application-form.france-visas.gouv.fr and follow
 * a predictable step1.xhtml..step12.xhtml URL pattern aligned to Annex I steps.
 *
 * URL heuristics drive primary identity (cheap, stable). Body-text markers
 * override for session-expired and check_mailbox because those states can
 * appear under a URL that still looks like a prior step.
 */

import type { Page } from "@playwright/test";
import { FV_SESSION_EXPIRED_MARKERS, FV_CHECK_MAILBOX_MARKERS } from "./selectors";
import { UnexpectedPageError, SessionExpiredError } from "./errors";

/**
 * France-Visas Schengen Type C form has **6 steps**, not the 12 logical
 * sections the Annex I seed assumes. Confirmed via live walk 2026-04-24 —
 * page heading on step1.xhtml reads "Step 1 of 6 Form: Your plans".
 *
 * Observed step map:
 *   step1  — Your plans (nationality + travel doc + purpose triage; "Verify" button)
 *   step2  — Your information ("Next step: Your information" — seen as hint text on step1)
 *   step3..step6 — TBD (walk interrupted by session crash)
 *
 * URLs still follow `/fv-fo-dde/stepN.xhtml` — the 12-slot union is retained
 * so future country variants (if any) can reuse the type, but step7-step12
 * are marked out-of-range for France.
 */
export type FvPageId =
  | "registration"
  | "check_mailbox"
  | "email_verified"
  | "login"
  | "accueil"
  | "step1"
  | "step2"
  | "step3"
  | "step4"
  | "step5"
  | "step6"
  | "review"
  | "confirmation"
  | "session_expired";

/**
 * URL → FvPageId. First match wins. Ordered with the most specific matches
 * first; step11/step12 before step1 etc is unnecessary because the regex
 * is anchored by trailing `.xhtml`.
 *
 * TODO(walk): verify exact review/confirmation filenames — French portals
 * commonly use "recapitulatif" (review) and "confirmation".
 */
const URL_PATTERNS: ReadonlyArray<[FvPageId, RegExp]> = [
  ["registration", /login-actions\/registration/i],
  ["login", /login-actions\/authenticate/i],
  ["email_verified", /execute-actions|verify-email/i],
  ["accueil", /accueil\.xhtml/i],
  ["step1", /step1\.xhtml/i],
  ["step2", /step2\.xhtml/i],
  ["step3", /step3\.xhtml/i],
  ["step4", /step4\.xhtml/i],
  ["step5", /step5\.xhtml/i],
  ["step6", /step6\.xhtml/i],
  ["review", /recapitulatif\.xhtml|review\.xhtml/i],
  ["confirmation", /confirmation\.xhtml/i],
];

export interface PageIdentityResult {
  id: FvPageId | "unknown";
  heading: string | null;
  url: string;
}

export async function detectPage(page: Page): Promise<PageIdentityResult> {
  const url = page.url();

  // Body-text probes come first: Keycloak sometimes flashes "Check mailbox"
  // under a URL that still resembles /registration, and the JSF session-
  // expired banner can linger on a step URL right before redirecting.
  let bodyText = "";
  try {
    bodyText = await page.locator("body").innerText({ timeout: 2_000 });
  } catch {
    // Navigation mid-flight — fall through to URL matching.
  }

  if (FV_SESSION_EXPIRED_MARKERS.some((re) => re.test(bodyText))) {
    return { id: "session_expired", heading: null, url };
  }

  if (FV_CHECK_MAILBOX_MARKERS.some((re) => re.test(bodyText))) {
    return { id: "check_mailbox", heading: null, url };
  }

  for (const [id, pattern] of URL_PATTERNS) {
    if (pattern.test(url)) {
      return { id, heading: await readFirstHeading(page), url };
    }
  }

  return { id: "unknown", heading: await readFirstHeading(page), url };
}

async function readFirstHeading(page: Page): Promise<string | null> {
  const locator = page.locator("h1, h2");
  const count = await locator.count();
  for (let i = 0; i < count; i += 1) {
    const text = (await locator.nth(i).textContent())?.trim() ?? "";
    if (text.length > 0) return text;
  }
  return null;
}

export async function assertPage(
  page: Page,
  expected: FvPageId | FvPageId[],
): Promise<FvPageId> {
  const expectedList = Array.isArray(expected) ? expected : [expected];
  const result = await detectPage(page);

  if (result.id === "session_expired" && !expectedList.includes("session_expired")) {
    throw new SessionExpiredError("France-Visas session expired before assertion", {
      expected: expectedList,
      detected: "session_expired",
      url: result.url,
    });
  }

  if (result.id === "unknown" || !expectedList.includes(result.id)) {
    throw new UnexpectedPageError(
      `Expected France-Visas page [${expectedList.join(", ")}] but detected "${result.id}"` +
        (result.heading ? ` (heading: "${result.heading}")` : ""),
      {
        expected: expectedList,
        detected: result.id,
        url: result.url,
        details: { heading: result.heading },
      },
    );
  }

  return result.id;
}

export async function waitForPage(
  page: Page,
  expected: FvPageId | FvPageId[],
  options: { timeoutMs?: number; pollIntervalMs?: number } = {},
): Promise<FvPageId> {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const pollIntervalMs = options.pollIntervalMs ?? 500;
  const expectedList = Array.isArray(expected) ? expected : [expected];
  const deadline = Date.now() + timeoutMs;

  let last: PageIdentityResult | null = null;
  while (Date.now() < deadline) {
    last = await detectPage(page);

    if (last.id === "session_expired" && !expectedList.includes("session_expired")) {
      throw new SessionExpiredError("France-Visas session expired while waiting for page", {
        expected: expectedList,
        detected: "session_expired",
        url: last.url,
      });
    }

    if (last.id !== "unknown" && expectedList.includes(last.id)) {
      return last.id;
    }

    await page.waitForTimeout(pollIntervalMs);
  }

  throw new UnexpectedPageError(
    `Timed out waiting for France-Visas page [${expectedList.join(", ")}] after ${timeoutMs}ms`,
    {
      expected: expectedList,
      detected: last?.id ?? "unknown",
      url: last?.url,
      details: { heading: last?.heading ?? null, timeoutMs },
    },
  );
}
