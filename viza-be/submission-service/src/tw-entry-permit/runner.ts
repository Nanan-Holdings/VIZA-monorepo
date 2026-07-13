import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { Page } from "@playwright/test";
import { createArrivalCardBrowserSession, type ArrivalCardBrowserSession } from "../arrival-card-browser";
import { TW_ENTRY_PERMIT_OFFICIAL_PORTAL_URL, type TaiwanEntryPermitPortalPayload } from "./normalize";
import { solveTaiwanNiaImageCaptcha } from "./captcha";
import { extractTaiwanNiaVerificationCode, isTaiwanNiaVerificationEmail } from "./email-verification";

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
export async function runTaiwanEntryPermitPortalSubmission(payload: TaiwanEntryPermitPortalPayload, options: { headless?: boolean; stopBeforeSubmit?: boolean; sendVerificationCode?: boolean; applicantId?: string; emailTimeoutMs?: number } = {}): Promise<TaiwanEntryPermitPortalResult> {
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
    const email = page.locator("input[name='email']");
    if (!(await email.isVisible().catch(() => false))) throw new TaiwanEntryPermitPortalError("Taiwan NIA email field was not found.", "tw_entry_permit_email_field_not_found", screenshots, logs);
    await email.fill(payload.aliasEmailAddress);
    const afterFill = await screenshot(page, dir, "alias-filled", logs); if (afterFill) screenshots.push(afterFill);
    if (options.sendVerificationCode) {
      if (process.env.TW_ENTRY_PERMIT_EMAIL_VERIFICATION_ENABLED !== "true") {
        throw new TaiwanEntryPermitPortalError("Taiwan NIA email verification is disabled. Set TW_ENTRY_PERMIT_EMAIL_VERIFICATION_ENABLED=true for an explicitly authorized controlled run.", "tw_entry_permit_email_verification_disabled", screenshots, logs);
      }
      if (!options.applicantId) {
        throw new TaiwanEntryPermitPortalError("An applicant ID is required to retrieve the Taiwan NIA verification email from the VIZA inbox.", "tw_entry_permit_applicant_id_missing", screenshots, logs);
      }
      const captcha = await solveTaiwanNiaImageCaptcha(page);
      if (!captcha.solved) {
        return { submitted: false, portalUrl: page.url(), portalResponseSummary: captcha.reason ?? "Taiwan NIA CAPTCHA could not be solved.", referenceNumber: null, screenshots, pdfs: [], logs, checkpoint: "email_verification" };
      }
      const startedAt = new Date().toISOString();
      await page.locator("#verify-code-button").click({ timeout: 10_000 });
      await page.waitForTimeout(800);
      const afterSend = await screenshot(page, dir, "verification-code-requested", logs); if (afterSend) screenshots.push(afterSend);
      const { inbox } = await import("../inbox/wait-for-message");
      const message = await inbox.waitForMessage(options.applicantId, isTaiwanNiaVerificationEmail, options.emailTimeoutMs ?? 180_000, { since: startedAt });
      const code = extractTaiwanNiaVerificationCode(message);
      if (!code) {
        return { submitted: false, portalUrl: page.url(), portalResponseSummary: "Taiwan NIA verification email arrived but did not contain a recognized verification code.", referenceNumber: null, screenshots, pdfs: [], logs, checkpoint: "email_verification" };
      }
      await page.locator("input[name='verifyCode']").fill(code);
      await page.getByRole("button", { name: "驗證", exact: true }).click({ timeout: 10_000 });
      await page.waitForLoadState("domcontentloaded", { timeout: 20_000 }).catch(() => undefined);
      const afterVerification = await screenshot(page, dir, "email-verified", logs); if (afterVerification) screenshots.push(afterVerification);
      return {
        submitted: false, portalUrl: page.url(), referenceNumber: null, screenshots, pdfs: [], logs, checkpoint: "official_form_recon",
        portalResponseSummary: "Taiwan NIA email verification completed in the controlled session. The post-verification form remains at selector-recon stage; no permit submission was attempted.",
      };
    }
    return {
      submitted: false,
      portalUrl: page.url(),
      portalResponseSummary: "VIZA entered the managed alias at the Taiwan NIA email-verification gate. The remainder of the official form is session-gated and awaits controlled selector reconnaissance; no verification code or submission was attempted.",
      referenceNumber: null, screenshots, pdfs: [], logs, checkpoint: "official_form_recon",
    };
  } finally { if (session) await session.close().catch(() => undefined); }
}
