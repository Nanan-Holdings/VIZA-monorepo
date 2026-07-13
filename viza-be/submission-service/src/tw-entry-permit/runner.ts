import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { Page } from "@playwright/test";
import { createArrivalCardBrowserSession, type ArrivalCardBrowserSession } from "../arrival-card-browser";
import { TW_ENTRY_PERMIT_OFFICIAL_PORTAL_URL, type TaiwanEntryPermitPortalPayload } from "./normalize";

export interface TaiwanEntryPermitPortalResult {
  submitted: boolean;
  portalUrl: string;
  portalResponseSummary: string;
  referenceNumber: string | null;
  screenshots: string[];
  pdfs: string[];
  logs: string[];
  checkpoint: "email_verification" | "official_form_recon" | "payment" | "submitted" | "official_portal_error";
}

export class TaiwanEntryPermitPortalError extends Error {
  constructor(message: string, readonly code = "tw_entry_permit_portal_error", readonly screenshots: string[] = [], readonly logs: string[] = []) {
    super(message); this.name = "TaiwanEntryPermitPortalError";
  }
}

async function screenshot(page: Page, dir: string, name: string, logs: string[]): Promise<string | null> {
  try { const file = path.join(dir, `${name}.png`); await page.screenshot({ path: file, fullPage: true }); return file; }
  catch (error) { logs.push(`screenshot_failed ${name} ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`); return null; }
}

/**
 * Starts at the official email-verification boundary. The NIA form is session
 * gated, so this runner deliberately stops with a recon checkpoint until a
 * controlled test account maps every post-verification control. It never
 * claims a permit was submitted without an official reference.
 */
export async function runTaiwanEntryPermitPortalSubmission(payload: TaiwanEntryPermitPortalPayload, options: { headless?: boolean; stopBeforeSubmit?: boolean } = {}): Promise<TaiwanEntryPermitPortalResult> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `viza-tw-entry-${payload.applicationId}-`));
  let session: ArrivalCardBrowserSession | null = null;
  const logs: string[] = [];
  const screenshots: string[] = [];
  try {
    session = await createArrivalCardBrowserSession({ prefix: "TW_ENTRY_PERMIT", headless: options.headless });
    logs.push(...session.diagnostics);
    const { page } = session;
    await page.goto(TW_ENTRY_PERMIT_OFFICIAL_PORTAL_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const loaded = await screenshot(page, dir, "email-verification", logs); if (loaded) screenshots.push(loaded);
    const body = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
    if (!/電子郵件|email/i.test(body)) throw new TaiwanEntryPermitPortalError("Taiwan NIA email-verification page was not recognized.", "tw_entry_permit_unrecognized_portal", screenshots, logs);
    const email = page.locator("input[type='email'], input[name*='mail' i]").first();
    if (!(await email.isVisible().catch(() => false))) throw new TaiwanEntryPermitPortalError("Taiwan NIA email field was not found.", "tw_entry_permit_email_field_not_found", screenshots, logs);
    await email.fill(payload.aliasEmailAddress);
    const afterFill = await screenshot(page, dir, "alias-filled", logs); if (afterFill) screenshots.push(afterFill);
    return {
      submitted: false,
      portalUrl: page.url(),
      portalResponseSummary: "VIZA entered the managed alias at the Taiwan NIA email-verification gate. The remainder of the official form is session-gated and awaits controlled selector reconnaissance; no verification code or submission was attempted.",
      referenceNumber: null, screenshots, pdfs: [], logs, checkpoint: "official_form_recon",
    };
  } finally { if (session) await session.close().catch(() => undefined); }
}
