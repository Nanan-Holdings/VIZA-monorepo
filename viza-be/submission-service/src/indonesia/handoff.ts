import type { Page } from "@playwright/test";
import type { OfficialHandoffInspection } from "../official-handoff";
import { classifyIndonesiaPortalSnapshot, type IndonesiaPortalSnapshot } from "./portal-state";

const INDONESIA_PORTAL_HOST = /(^|\.)imigrasi\.go\.id$/i;

const WAITING_FOR_PAYMENT = /waiting for payment|menunggu pembayaran|belum bayar/i;

export function extractIndonesiaOfficialReference(text: string): string | undefined {
  const patterns = [
    /(?:application|reference|transaction|register(?:ation)?)\s*(?:number|no\.?|id|code)\s*[:#-]?\s*([A-Z0-9][A-Z0-9/_-]{5,})/i,
    /(?:nomor|no\.?)\s*(?:permohonan|referensi|transaksi|registrasi)\s*[:#-]?\s*([A-Z0-9][A-Z0-9/_-]{5,})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern)?.[1]?.trim();
    if (match) return match;
  }
  return undefined;
}

function applicationIdFromUrl(url: string): string | undefined {
  return (
    /\/front\/application\/([a-f0-9-]{8,})/i.exec(url)?.[1] ??
    /\/web\/application\/([^/?#]{4,})\/detail/i.exec(url)?.[1]
  );
}

/**
 * Decide from one official page snapshot whether the applicant has already
 * clicked the official final submit. A draft, a step page, or the review page
 * is never evidence of submission.
 */
export function inspectIndonesiaHandoffSnapshot(
  snapshot: IndonesiaPortalSnapshot & { capturedAt: string },
): OfficialHandoffInspection {
  let host = "";
  try {
    host = new URL(snapshot.url).hostname;
  } catch {
    return { outcome: "pending", note: "invalid_url" };
  }
  if (!INDONESIA_PORTAL_HOST.test(host)) return { outcome: "pending", note: "not_official_portal" };
  const text = snapshot.text ?? "";
  if (/\/step_[1-4]\b/i.test(snapshot.url) && !/waiting for payment|menunggu pembayaran|billing code/i.test(text)) {
    return { outcome: "pending", note: "application_step_page" };
  }
  if (/\bdraft\b/i.test(text) && /\/applications\/.+\/list\b/i.test(snapshot.url)) {
    return { outcome: "pending", note: "draft_application_list" };
  }

  // Only explicit official post-submit pages count. The general classifier's
  // payment/OTP heuristics also match pages that are not evidence of submit.
  const state = classifyIndonesiaPortalSnapshot(snapshot);
  const waitingOnList =
    /\/(?:web|front)\/applications\/.+\/list\b/i.test(snapshot.url) && WAITING_FOR_PAYMENT.test(text);
  const waitingOnDetail =
    /\/web\/application\/[^/?#]+\/detail/i.test(snapshot.url) && WAITING_FOR_PAYMENT.test(text);
  const officialCardResult = /\/pg\/payment\/card\/result\/(?:success|failed)(?:[/?#]|$)/i.test(snapshot.url);
  const complete = state === "submitted_or_approved";
  if (!waitingOnList && !waitingOnDetail && !officialCardResult && !complete) {
    return { outcome: "pending", note: `state_${state}` };
  }

  const reference = extractIndonesiaOfficialReference(text) ?? applicationIdFromUrl(snapshot.url);
  if (!reference) return { outcome: "pending", note: `post_submit_without_reference_${state}` };
  return {
    outcome: "submitted",
    final: state === "submitted_or_approved",
    receipt: {
      source: "official_portal_after_applicant_submit",
      reference,
      portalUrl: snapshot.url,
      capturedAt: snapshot.capturedAt,
      officialState: waitingOnList || waitingOnDetail ? "waiting_for_payment" : state,
    },
  };
}

/** Read-only page inspection used by the official handoff watcher. */
export async function inspectIndonesiaHandoffPage(page: Page): Promise<OfficialHandoffInspection> {
  if (page.isClosed()) return { outcome: "pending", note: "page_closed" };
  const url = page.url();
  const title = await page.title().catch(() => null);
  const text = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
  return inspectIndonesiaHandoffSnapshot({ url, title, text, capturedAt: new Date().toISOString() });
}
