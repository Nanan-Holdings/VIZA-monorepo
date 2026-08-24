import type { Page } from "@playwright/test";
import { canadaUnsafePageUrl, isCanadaPageSafe } from "./browser.js";
import { isTrustedCanadaApplicationUrl } from "./readiness.js";

export const CANADA_TOURIST_APPLICATION_TYPE_PAGE = {
  continue: "#next_path",
} as const;

export const CANADA_REPRESENTATIVE_PAGE = {
  applyingForSomeoneElseYes: "#hasRepresentative_radio-button-01-input",
  applyingForSomeoneElseNo: "#hasRepresentative_radio-button-02-input",
} as const;

export type CanadaPostPurposeRoute =
  | "tourist_application_type"
  | "representative"
  | "other";

export type CanadaPostPurposeCheckpoint =
  | "unexpected_redirect"
  | "representative_status_required"
  | "representative_selector_drift"
  | "tourist_type_selector_drift"
  | "tourist_type_transition_failed"
  | "next_section_mapping_required";

export interface CanadaPostPurposeResult {
  checkpoint: CanadaPostPurposeCheckpoint;
  url: string;
  detail?: string;
}

export function classifyCanadaPostPurposeRoute(
  url: string,
): CanadaPostPurposeRoute {
  try {
    const parsed = new URL(url);
    if (!isTrustedCanadaApplicationUrl(parsed)) return "other";
    const path = parsed.pathname.replace(/\/$/, "");
    if (path === "/application-type/tourist") return "tourist_application_type";
    if (path === "/representative") return "representative";
    return "other";
  } catch {
    return "other";
  }
}

/**
 * Advances the field-free tourist application-type confirmation and stops at
 * the representative declaration. IRCC explicitly describes preparing an
 * application for another person as representation, so this helper never
 * selects either answer or fabricates representative details.
 */
export async function advanceCanadaPostPurpose(
  page: Page,
): Promise<CanadaPostPurposeResult> {
  if (!isCanadaPageSafe(page, "application")) {
    return {
      checkpoint: "unexpected_redirect",
      url: canadaUnsafePageUrl(page),
    };
  }
  let route = classifyCanadaPostPurposeRoute(page.url());
  if (route === "tourist_application_type") {
    const continueButton = page.locator(CANADA_TOURIST_APPLICATION_TYPE_PAGE.continue);
    await continueButton.waitFor({ state: "visible", timeout: 30_000 }).catch(() => undefined);
    if (!isCanadaPageSafe(page, "application")) {
      return { checkpoint: "unexpected_redirect", url: canadaUnsafePageUrl(page) };
    }
    if ((await continueButton.count()) !== 1 || !(await continueButton.isEnabled())) {
      return {
        checkpoint: "tourist_type_selector_drift",
        url: page.url(),
      };
    }

    if (!isCanadaPageSafe(page, "application")) {
      return { checkpoint: "unexpected_redirect", url: canadaUnsafePageUrl(page) };
    }
    await continueButton.click();
    await page
      .waitForURL(
        (url) => classifyCanadaPostPurposeRoute(url.toString()) !== "tourist_application_type",
        { timeout: 30_000 },
      )
      .catch(() => undefined);
    if (!isCanadaPageSafe(page, "application")) {
      return { checkpoint: "unexpected_redirect", url: canadaUnsafePageUrl(page) };
    }
    route = classifyCanadaPostPurposeRoute(page.url());
    if (route === "tourist_application_type") {
      return {
        checkpoint: "tourist_type_transition_failed",
        url: page.url(),
      };
    }
  }

  if (route === "representative") {
    if (!isCanadaPageSafe(page, "application")) {
      return { checkpoint: "unexpected_redirect", url: canadaUnsafePageUrl(page) };
    }
    const counts = await Promise.all(
      Object.values(CANADA_REPRESENTATIVE_PAGE).map((selector) =>
        page.locator(selector).count(),
      ),
    );
    if (counts.some((count) => count !== 1)) {
      return {
        checkpoint: "representative_selector_drift",
        url: page.url(),
        detail: `representative_counts=${counts.join(",")}`,
      };
    }
    return { checkpoint: "representative_status_required", url: page.url() };
  }

  return {
    checkpoint: "next_section_mapping_required",
    url: page.url(),
  };
}
