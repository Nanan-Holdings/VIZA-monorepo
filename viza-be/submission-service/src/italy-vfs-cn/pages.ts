/**
 * Page-identity detection for the VFS Global Italy China corridor.
 *
 * VFS Global runs a single SPA per origin-destination corridor under
 * `https://visa.vfsglobal.com/<origin>/<lang>/<destination>/`. For the
 * China-Italy corridor that's `https://visa.vfsglobal.com/chn/en/ita/`.
 *
 * The page-id enum and URL regexes here are CONJECTURAL until the live
 * recon walk runs. They follow the well-known VFS Global SPA pattern
 * observed across other VFS country sites; live walk will tighten the
 * URL patterns and may reshape the wizard page list (e.g. some
 * corridors render personal+passport on one page; others split them).
 *
 * TODO(walk): replace conjectural URL regexes with live-captured forms;
 * confirm the wizard page count and section split.
 */

import type { Page } from "@playwright/test";

export type ItVfsPageId =
  | "landing"
  | "login"
  | "register"
  | "dashboard"
  | "select_visa_type"
  | "applicant_personal"
  | "applicant_travel_document"
  | "applicant_contact"
  | "trip_details"
  | "purpose_details"
  | "accommodation"
  | "travel_history"
  | "cost_and_means"
  | "declaration"
  | "review"
  | "appointment_eligibility"
  | "session_expired";

/**
 * URL → ItVfsPageId. First match wins.
 *
 * The VFS SPA hash-routes most form sections, so URL alone is rarely
 * enough — `detectPage` falls back to body-text heading match for
 * fragment-only navigations.
 */
const URL_PATTERNS: ReadonlyArray<[ItVfsPageId, RegExp]> = [
  ["landing", /\/chn\/[a-z-]+\/ita\/?$/i],
  ["login", /\/account\/(login|signin)/i],
  ["register", /\/account\/(register|signup)/i],
  ["dashboard", /\/(dashboard|home|account-overview)/i],
  ["select_visa_type", /\/visa-type|\/select-(visa|category)/i],
  ["applicant_personal", /#\/?personal|\/applicant\/personal/i],
  ["applicant_travel_document", /#\/?travel-document|\/applicant\/passport/i],
  ["applicant_contact", /#\/?contact|\/applicant\/contact/i],
  ["trip_details", /#\/?trip|\/journey\/details/i],
  ["purpose_details", /#\/?purpose|\/journey\/purpose/i],
  ["accommodation", /#\/?accommodation|\/journey\/accommodation/i],
  ["travel_history", /#\/?travel-history|\/journey\/history/i],
  ["cost_and_means", /#\/?cost|\/journey\/cost/i],
  ["declaration", /#\/?declaration|\/journey\/declaration/i],
  ["review", /#\/?review|\/journey\/review/i],
  ["appointment_eligibility", /\/appointment(\/eligibility|-eligibility)?/i],
];

/**
 * Body-text markers for SPA fragment-only states where URL alone is
 * insufficient. Heading-based matchers are conjectural; tighten on walk.
 */
export const IT_VFS_HEADING_PATTERNS: ReadonlyArray<[ItVfsPageId, RegExp]> = [
  ["applicant_personal", /personal\s+(details|information)/i],
  ["applicant_travel_document", /(passport|travel\s+document)/i],
  ["applicant_contact", /contact\s+(details|information)/i],
  ["trip_details", /(trip|journey)\s+details/i],
  ["purpose_details", /purpose\s+of\s+(visit|travel|journey)/i],
  ["accommodation", /accommodation/i],
  ["travel_history", /travel\s+history/i],
  ["cost_and_means", /(cost|means|funds|financial)/i],
  ["declaration", /declaration|consent/i],
  ["review", /review|summary/i],
  ["appointment_eligibility", /appointment|book\s+slot|schedule/i],
];

export const IT_VFS_SESSION_EXPIRED_MARKERS: readonly string[] = [
  "session has expired",
  "your session has timed out",
  "please log in again",
];

export interface PageIdentityResult {
  id: ItVfsPageId | "unknown";
  heading: string | null;
  url: string;
}

export async function detectPage(page: Page): Promise<PageIdentityResult> {
  const url = page.url();

  // Body-text probes for session-expired override URL-based identity —
  // VFS sometimes flashes the timeout banner on a URL that still looks
  // like an in-progress wizard step.
  const bodyText = await page
    .evaluate(() => document.body?.innerText?.toLowerCase() ?? "")
    .catch(() => "");
  if (IT_VFS_SESSION_EXPIRED_MARKERS.some((m) => bodyText.includes(m))) {
    return { id: "session_expired", heading: null, url };
  }

  for (const [id, pattern] of URL_PATTERNS) {
    if (pattern.test(url)) {
      const heading = await readHeading(page);
      return { id, heading, url };
    }
  }

  const heading = await readHeading(page);
  if (heading) {
    const lower = heading.toLowerCase();
    for (const [id, pattern] of IT_VFS_HEADING_PATTERNS) {
      if (pattern.test(lower)) return { id, heading, url };
    }
  }

  return { id: "unknown", heading, url };
}

async function readHeading(page: Page): Promise<string | null> {
  return page
    .evaluate(() => {
      const h = document.querySelector("h1, h2");
      return h ? (h.textContent || "").trim() : null;
    })
    .catch(() => null);
}

export async function assertPage(
  page: Page,
  expected: ItVfsPageId | ItVfsPageId[],
): Promise<PageIdentityResult> {
  const result = await detectPage(page);
  const expectedList = Array.isArray(expected) ? expected : [expected];
  if (result.id === "unknown" || !expectedList.includes(result.id as ItVfsPageId)) {
    throw new Error(
      `Expected page ${expectedList.join(" or ")}; detected ${result.id} at ${result.url}`,
    );
  }
  return result;
}

export async function waitForPage(
  page: Page,
  expected: ItVfsPageId | ItVfsPageId[],
  options: { timeoutMs?: number } = {},
): Promise<PageIdentityResult> {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const expectedList = Array.isArray(expected) ? expected : [expected];
  const deadline = Date.now() + timeoutMs;
  let last: PageIdentityResult = { id: "unknown", heading: null, url: page.url() };
  while (Date.now() < deadline) {
    last = await detectPage(page);
    if (last.id !== "unknown" && expectedList.includes(last.id as ItVfsPageId)) {
      return last;
    }
    await page.waitForTimeout(500);
  }
  throw new Error(
    `Timed out waiting for ${expectedList.join(" or ")}; last seen ${last.id} at ${last.url}`,
  );
}
