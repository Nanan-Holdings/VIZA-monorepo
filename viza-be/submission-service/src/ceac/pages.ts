/**
 * Page-identity detection for the CEAC DS-160 flow.
 *
 * Every CEAC DS-160 page has a distinctive H2 heading. We match the heading
 * text against known patterns to produce a `CeacPageId` — an explicit enum
 * that the rest of the automation can switch on without relying on timing
 * or implicit page-load assumptions.
 */

import type { Page } from "@playwright/test";
import {
  CEAC_HEADING_SELECTOR,
  CEAC_SESSION_EXPIRED_MARKERS,
  CEAC_SIGN_AND_SUBMIT_MARKERS,
} from "./selectors";
import { UnexpectedPageError, SessionExpiredError } from "./errors";

/**
 * The canonical set of DS-160 page identities the automation cares about.
 * Additions here should also extend `PAGE_HEADING_PATTERNS` below.
 */
export type CeacPageId =
  | "start"
  | "security_notice"
  | "retrieve_application"
  | "personal_information_1"
  | "personal_information_2"
  | "travel_information"
  | "travel_companions"
  | "previous_us_travel"
  | "address_and_phone"
  | "passport"
  | "us_contact"
  | "family_relatives"
  | "family_spouse"
  | "work_education_present"
  | "work_education_previous"
  | "work_education_additional"
  | "security_background_1"
  | "security_background_2"
  | "security_background_3"
  | "security_background_4"
  | "security_background_5"
  | "upload_photo"
  | "confirm_photo"
  | "save_confirmation"
  | "review"
  | "sign_and_submit"
  | "confirmation"
  | "session_expired";

/**
 * URL-path patterns as a fallback when heading detection returns null
 * (some CEAC pages render the section title as a `<span>` or inside a
 * non-standard element). Order is not sensitive — URLs are unique per
 * section.
 */
const PAGE_URL_PATTERNS: ReadonlyArray<[CeacPageId, RegExp]> = [
  ["personal_information_1", /complete_personal\.aspx/i],
  ["personal_information_2", /complete_personalcont\.aspx/i],
  ["travel_information", /complete_travel\.aspx/i],
  ["travel_companions", /complete_travelcompanions\.aspx/i],
  ["previous_us_travel", /complete_previousustravel\.aspx/i],
  ["address_and_phone", /complete_contact\.aspx/i],
  ["passport", /Passport_Visa_Info\.aspx|complete_passport/i],
  ["us_contact", /complete_uscontact\.aspx/i],
  ["family_relatives", /complete_family1\.aspx|complete_relatives/i],
  ["family_spouse", /complete_family2\.aspx|complete_spouse/i],
  ["work_education_present", /complete_workeducation1\.aspx|node=WorkEducation1/i],
  ["work_education_previous", /complete_workeducation2\.aspx|node=WorkEducationPrevious/i],
  ["work_education_additional", /complete_workeducation3\.aspx|node=WorkEducationAddl/i],
  ["security_background_1", /complete_securityandbackground1\.aspx/i],
  ["security_background_2", /complete_securityandbackground2\.aspx/i],
  ["security_background_3", /complete_securityandbackground3\.aspx/i],
  ["security_background_4", /complete_securityandbackground4\.aspx/i],
  ["security_background_5", /complete_securityandbackground5\.aspx/i],
  ["confirm_photo", /photo_confirmphoto\.aspx|node=ConfirmPhoto/i],
  ["upload_photo", /complete_uploadphoto\.aspx|photo_uploadthephoto\.aspx|node=UploadPhoto/i],
  ["review", /Complete_Review\.aspx|complete_review|review_review|node=Review/i],
  ["sign_and_submit", /complete_signandsubmit\.aspx|node=SignSubmit/i],
  ["confirmation", /complete_confirmation\.aspx|Confirmation\.aspx/i],
];

/**
 * Regex patterns that match the H2 heading text for each page identity.
 * Order matters: more specific patterns must appear before more general
 * ones (e.g. "Personal Information 2" before "Personal Information").
 */
const PAGE_HEADING_PATTERNS: ReadonlyArray<[CeacPageId, RegExp]> = [
  ["start", /start an application|welcome|apply for a nonimmigrant visa/i],
  ["security_notice", /privacy (act|notice)|security notice/i],
  ["retrieve_application", /retrieve (an )?application/i],
  ["personal_information_2", /personal information\s*2/i],
  ["personal_information_1", /personal information(\s*1)?/i],
  ["travel_companions", /travel companions/i],
  ["previous_us_travel", /previous u\.?s\.? travel/i],
  ["travel_information", /travel information/i],
  ["address_and_phone", /address and phone/i],
  ["passport", /passport/i],
  ["us_contact", /u\.?s\.? (point of )?contact/i],
  ["family_relatives", /family information: relatives/i],
  ["family_spouse", /family information: spouse|spouse information/i],
  ["work_education_present", /present work\/education\/training/i],
  ["work_education_previous", /previous work\/education\/training/i],
  ["work_education_additional", /additional work\/education\/training/i],
  ["security_background_5", /security and background:?\s*part\s*5/i],
  ["security_background_4", /security and background:?\s*part\s*4/i],
  ["security_background_3", /security and background:?\s*part\s*3/i],
  ["security_background_2", /security and background:?\s*part\s*2/i],
  ["security_background_1", /security and background(:?\s*part\s*1)?/i],
  ["save_confirmation", /^save confirmation$/i],
  ["confirm_photo", /^confirm photo$/i],
  ["upload_photo", /upload photo/i],
  ["review", /review/i],
  ["sign_and_submit", CEAC_SIGN_AND_SUBMIT_MARKERS.headingPattern],
  ["confirmation", /thank you|confirmation|your application id is/i],
];

/**
 * Result of a page-identity probe. `id` is "unknown" when no heading pattern
 * matched — callers should usually treat that as an error via `assertPage`.
 */
export interface PageIdentityResult {
  id: CeacPageId | "unknown";
  heading: string | null;
  url: string;
}

/**
 * Read the current page's heading and resolve it to a `CeacPageId`. This is
 * an explicit DOM-based check — it does not rely on timing or implicit
 * `waitForLoadState` side effects. It also detects session-expired states
 * and reports them as their own identity so callers can branch cleanly.
 */
export async function detectPage(page: Page): Promise<PageIdentityResult> {
  const url = page.url();

  // Pick the first non-empty heading text from any matching heading node.
  // Using the locator API (instead of `page.evaluate`) keeps this file free
  // of DOM lib dependencies in tsconfig.
  const headingLocator = page.locator(CEAC_HEADING_SELECTOR);
  const headingCount = await headingLocator.count();
  let heading: string | null = null;
  for (let i = 0; i < headingCount; i += 1) {
    const text = (await headingLocator.nth(i).textContent())?.trim() ?? "";
    if (text.length > 0) {
      heading = text;
      break;
    }
  }

  // Session-expired detection takes precedence: CEAC sometimes preserves the
  // old heading but stamps an expiry banner onto the page. `innerText()` on
  // the body returns visible text only, which is what we need for markers.
  let bodyText = "";
  try {
    bodyText = await page.locator("body").innerText({ timeout: 2_000 });
  } catch {
    // If the body is not yet attached (e.g. navigation mid-flight), treat
    // the page as unknown rather than throwing — the caller will retry via
    // `waitForPage` if appropriate.
  }

  if (CEAC_SESSION_EXPIRED_MARKERS.some((re) => re.test(bodyText))) {
    return { id: "session_expired", heading, url };
  }

  // URL takes precedence for Review pages because their headings echo
  // the original form-section names (e.g. "Personal, Address, Phone,
  // and Passport Information") and would otherwise match earlier
  // section patterns. Sign-and-submit and the photo subsystem also
  // benefit from URL-first detection.
  const REVIEW_URL_RE = /\/review\/review_|node=Review/i;
  const PHOTO_URL_RE = /\/photo\/photo_|node=ConfirmPhoto|node=UploadPhoto/i;
  const SIGN_URL_RE = /complete_signandsubmit|node=SignSubmit/i;
  if (REVIEW_URL_RE.test(url)) {
    return { id: "review", heading, url };
  }
  if (PHOTO_URL_RE.test(url)) {
    if (/photo_confirmphoto/i.test(url)) return { id: "confirm_photo", heading, url };
    return { id: "upload_photo", heading, url };
  }
  if (SIGN_URL_RE.test(url)) {
    return { id: "sign_and_submit", heading, url };
  }

  if (heading) {
    for (const [id, pattern] of PAGE_HEADING_PATTERNS) {
      if (pattern.test(heading)) {
        return { id, heading, url };
      }
    }
  }

  // Heading missing or not recognized — fall back to URL-based ID. CEAC
  // pages that render their title as a <span> (rather than <h2>) are
  // indistinguishable via the heading locator; URL is authoritative.
  for (const [id, pattern] of PAGE_URL_PATTERNS) {
    if (pattern.test(url)) {
      return { id, heading, url };
    }
  }

  return { id: "unknown", heading, url };
}

/**
 * Assert that the current page matches one of the `expected` identities.
 * Throws `UnexpectedPageError` (or `SessionExpiredError` when that's what we
 * found) with full diagnostic context. Returns the resolved identity on
 * success so callers can narrow the union.
 */
export async function assertPage(
  page: Page,
  expected: CeacPageId | CeacPageId[],
): Promise<CeacPageId> {
  const expectedList = Array.isArray(expected) ? expected : [expected];
  const result = await detectPage(page);

  if (result.id === "session_expired" && !expectedList.includes("session_expired")) {
    throw new SessionExpiredError("CEAC session expired before assertion", {
      expected: expectedList,
      detected: "session_expired",
      url: result.url,
    });
  }

  if (result.id === "unknown" || !expectedList.includes(result.id)) {
    throw new UnexpectedPageError(
      `Expected CEAC page [${expectedList.join(", ")}] but detected "${result.id}"` +
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

/**
 * Wait for the page identity to settle on one of the `expected` values.
 *
 * Polling is explicit — we re-probe the DOM at `pollIntervalMs` until either
 * a match is found or `timeoutMs` elapses. This is how callers advance after
 * a Next-button click without depending solely on `waitForLoadState`.
 */
export async function waitForPage(
  page: Page,
  expected: CeacPageId | CeacPageId[],
  options: { timeoutMs?: number; pollIntervalMs?: number } = {},
): Promise<CeacPageId> {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const pollIntervalMs = options.pollIntervalMs ?? 500;
  const expectedList = Array.isArray(expected) ? expected : [expected];
  const deadline = Date.now() + timeoutMs;

  let last: PageIdentityResult | null = null;
  while (Date.now() < deadline) {
    last = await detectPage(page);

    if (last.id === "session_expired" && !expectedList.includes("session_expired")) {
      throw new SessionExpiredError("CEAC session expired while waiting for page", {
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
    `Timed out waiting for CEAC page [${expectedList.join(", ")}] after ${timeoutMs}ms`,
    {
      expected: expectedList,
      detected: last?.id ?? "unknown",
      url: last?.url,
      details: { heading: last?.heading ?? null, timeoutMs },
    },
  );
}
