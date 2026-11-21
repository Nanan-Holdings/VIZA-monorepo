import type { Page } from "@playwright/test";
import type { OfficialHandoffInspection, OfficialHandoffInspector } from "../official-handoff";

const VIETNAM_PORTAL_HOST = /(^|\.)(evisa\.gov\.vn|thithucdientu\.gov\.vn)$/i;
const ELECTRONIC_DOCUMENT_CODE = /\bE\d{6}[A-Z0-9]{8,}\b/i;
const LABELED_CODE = /(?:mã hồ sơ|registration\s*code|electronic\s+document\s+code)[:\s]+([A-Z0-9]{8,})/i;
const PAYMENT_SUCCESS = /payment\s+(?:was\s+)?successful|paid\s+successfully|thanh toán thành công/i;

export interface VietnamHandoffSnapshot {
  url: string;
  text: string;
  capturedAt: string;
}

export function extractVietnamHandoffReference(text: string): string | undefined {
  // Deliberately narrower than extractVietnamRegistrationCode: the review page
  // can carry generic "application number" labels before anything is submitted.
  const code = ELECTRONIC_DOCUMENT_CODE.exec(text)?.[0] ?? LABELED_CODE.exec(text)?.[1];
  return code ? code.toUpperCase() : undefined;
}

/**
 * Decide from one official page snapshot whether the applicant has submitted.
 * The official portal issues the electronic document code only after the
 * review CAPTCHA + Next, so a visible code is the submit evidence. The review
 * page itself never carries one.
 *
 * The portal has no login, so there is no logged-out state to detect; an
 * unsubmitted handoff simply expires.
 */
export function inspectVietnamHandoffSnapshot(snapshot: VietnamHandoffSnapshot): OfficialHandoffInspection {
  let host = "";
  try {
    host = new URL(snapshot.url).hostname;
  } catch {
    return { outcome: "pending", note: "invalid_url" };
  }
  if (!VIETNAM_PORTAL_HOST.test(host)) return { outcome: "pending", note: "not_official_portal" };
  const reference = extractVietnamHandoffReference(snapshot.text);
  if (!reference) return { outcome: "pending", note: "no_registration_code" };
  const paid = PAYMENT_SUCCESS.test(snapshot.text);
  return {
    outcome: "submitted",
    final: paid,
    receipt: {
      source: "official_portal_after_applicant_submit",
      reference,
      portalUrl: snapshot.url,
      capturedAt: snapshot.capturedAt,
      officialState: paid ? "official_fee_paid" : "registration_code_issued",
    },
  };
}

export async function inspectVietnamHandoffPage(page: Page): Promise<OfficialHandoffInspection> {
  if (page.isClosed()) return { outcome: "pending", note: "page_closed" };
  const text = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
  return inspectVietnamHandoffSnapshot({ url: page.url(), text, capturedAt: new Date().toISOString() });
}

export const vietnamHandoffInspector: OfficialHandoffInspector = {
  inspect: inspectVietnamHandoffPage,
};
