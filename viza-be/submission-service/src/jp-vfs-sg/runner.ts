import { chromium, type Browser, type Page } from "playwright";

export type JapanVfsCheckpoint = "login" | "captcha" | "waf" | "identity_verification" | "selector_drift" | "no_slots";

export interface JapanVfsSlotObservation {
  appointmentDate: string;
  appointmentTime: string | null;
  appointmentLocation: string;
  source: "vfs_jp_sg";
}

export interface JapanVfsRunnerResult {
  slots: JapanVfsSlotObservation[];
  checkpoint?: { type: JapanVfsCheckpoint; message: string };
  evidence: { pageTitle: string; observedAt: string };
}

const VFS_JAPAN_SINGAPORE_URL = "https://visa.vfsglobal.com/sgp/en/jpn/book-an-appointment";

function checkpointForText(text: string): JapanVfsCheckpoint | null {
  if (/cloudflare|access denied|security check|turnstile/i.test(text)) return "waf";
  if (/captcha|i am not a robot|recaptcha/i.test(text)) return "captcha";
  if (/sign in|log in|login|enter your email/i.test(text)) return "login";
  if (/verify your identity|one[- ]time password|otp|verification code/i.test(text)) return "identity_verification";
  return null;
}

async function openAuthorizedBrowser(): Promise<Browser> {
  const endpoint = process.env.JP_VFS_SG_BROWSER_API_ENDPOINT?.trim();
  if (endpoint) return chromium.connectOverCDP(endpoint, { timeout: 30_000 });
  return chromium.launch({ headless: true });
}

/**
 * Reads the VFS booking landing state only. It intentionally does not enter
 * credentials, CAPTCHA values, payment details, or click final booking.
 */
export async function observeJapanVfsSingaporeSlots(): Promise<JapanVfsRunnerResult> {
  const browser = await openAuthorizedBrowser();
  const page: Page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  try {
    await page.goto(VFS_JAPAN_SINGAPORE_URL, { waitUntil: "domcontentloaded", timeout: 90_000 });
    const body = await page.locator("body").innerText({ timeout: 15_000 }).catch(() => "");
    const checkpoint = checkpointForText(body);
    const evidence = { pageTitle: await page.title(), observedAt: new Date().toISOString() };
    if (checkpoint) return { slots: [], checkpoint: { type: checkpoint, message: "Official VFS action is required before slots can be read." }, evidence };
    if (/no appointments|no slots|not available/i.test(body)) return { slots: [], checkpoint: { type: "no_slots", message: "VFS currently shows no available appointment slots." }, evidence };
    return { slots: [], checkpoint: { type: "selector_drift", message: "VFS calendar selectors have not yet been verified for this authorized session." }, evidence };
  } finally {
    await page.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

export { VFS_JAPAN_SINGAPORE_URL };
