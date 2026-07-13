import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { Page } from "@playwright/test";
import { createArrivalCardBrowserSession, type ArrivalCardBrowserSession } from "../arrival-card-browser";
import { TW_ENTRY_PERMIT_OFFICIAL_PORTAL_URL, type TaiwanEntryPermitPortalPayload } from "./normalize";
import { solveTaiwanNiaImageCaptcha } from "./captcha";
import { extractTaiwanNiaVerificationCode, isTaiwanNiaVerificationEmail } from "./email-verification";
import { fillTaiwanPlaceholderDraft } from "./placeholder-draft";

export interface TaiwanEntryPermitPortalResult {
  submitted: boolean;
  portalUrl: string;
  portalResponseSummary: string;
  referenceNumber: string | null;
  screenshots: string[];
  pdfs: string[];
  logs: string[];
  postVerificationControls?: Array<{ tag: string; name: string; type: string }>;
  postVerificationSelectOptions?: Record<string, Array<{ value: string; label: string }>>;
  postVerificationRadioValues?: Record<string, string[]>;
  placeholderFill?: { filled: number; selected: number; uploaded: number };
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
 * Playwright's browser-close promise can be backed only by unref'd handles in
 * local CLI runs. Keep a short ref'd timer while it settles so the smoke
 * process cannot exit before returning its structured result.
 */
async function closeSession(session: ArrivalCardBrowserSession): Promise<void> {
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 5_000);
    session.close()
      .catch(() => undefined)
      .finally(() => {
        clearTimeout(timer);
        resolve();
      });
  });
}

/**
 * Starts at the official email-verification boundary. The NIA form is session
 * gated, so this runner deliberately stops with a recon checkpoint until a
 * controlled test account maps every post-verification control. It never
 * claims a permit was submitted without an official reference.
 */
export async function runTaiwanEntryPermitPortalSubmission(payload: TaiwanEntryPermitPortalPayload, options: { headless?: boolean; stopBeforeSubmit?: boolean; sendVerificationCode?: boolean; applicantId?: string; emailTimeoutMs?: number; fillPlaceholderDraft?: boolean; onProgress?: (stage: string) => void } = {}): Promise<TaiwanEntryPermitPortalResult> {
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
      options.onProgress?.("email_code_requested");
      await page.waitForTimeout(800);
      const afterSend = await screenshot(page, dir, "verification-code-requested", logs); if (afterSend) screenshots.push(afterSend);
      const { inbox } = await import("../inbox/wait-for-message");
      const message = await inbox.waitForMessage(options.applicantId, isTaiwanNiaVerificationEmail, options.emailTimeoutMs ?? 180_000, { since: startedAt, includeProcessed: true });
      const code = extractTaiwanNiaVerificationCode(message);
      if (!code) {
        return { submitted: false, portalUrl: page.url(), portalResponseSummary: "Taiwan NIA verification email arrived but did not contain a recognized verification code.", referenceNumber: null, screenshots, pdfs: [], logs, checkpoint: "email_verification" };
      }
      options.onProgress?.("email_code_received");
      await page.locator("input[name='verifyCode']").fill(code);
      await page.getByRole("button", { name: "驗證", exact: true }).click({ timeout: 10_000 });
      options.onProgress?.("email_code_submitted");
      await page.waitForLoadState("domcontentloaded", { timeout: 20_000 }).catch(() => undefined);
      await page.waitForTimeout(750);
      const afterVerification = await screenshot(page, dir, "email-verified", logs); if (afterVerification) screenshots.push(afterVerification);
      const verificationInputStillVisible = await page.locator("input[name='verifyCode']").isVisible().catch(() => false);
      if (verificationInputStillVisible) {
        return {
          submitted: false, portalUrl: page.url(), referenceNumber: null, screenshots, pdfs: [], logs, checkpoint: "email_verification",
          portalResponseSummary: "Taiwan NIA kept the session at the email-verification page after the code was entered. The official code may have expired or been rejected; no application form was opened.",
        };
      }
      const termsNext = page.getByRole("button", { name: "下一步", exact: true });
      if (await termsNext.isVisible().catch(() => false)) {
        await termsNext.click({ timeout: 10_000 });
        await page.waitForLoadState("domcontentloaded", { timeout: 20_000 }).catch(() => undefined);
        await page.waitForTimeout(750);
        const afterTerms = await screenshot(page, dir, "terms-advanced", logs); if (afterTerms) screenshots.push(afterTerms);
        logs.push("tw_entry_permit_terms_advanced");
      }
      const postVerificationControls = await page.locator("input, select, textarea, button")
        .evaluateAll((controls) => controls.map((control) => ({
          tag: control.tagName.toLowerCase(),
          name: control.getAttribute("name") ?? "",
          type: control.getAttribute("type") ?? "",
        })).filter((control) => control.name || control.tag === "button"));
      const postVerificationSelectOptions = await page.locator("select[name]").evaluateAll((selects) => Object.fromEntries(
        selects.map((select) => [select.getAttribute("name") ?? "", Array.from((select as HTMLSelectElement).options)
          .map((option) => ({ value: option.value, label: option.textContent?.trim() ?? "" }))
          .filter((option) => option.value || option.label)]),
      ));
      const postVerificationRadioValues = await page.locator("input[type='radio'][name]").evaluateAll((radios) => {
        const values: Record<string, string[]> = {};
        for (const radio of radios as HTMLInputElement[]) {
          (values[radio.name] ??= []).push(radio.value);
        }
        return values;
      });
      logs.push(`tw_entry_permit_post_verification_controls=${postVerificationControls.length}`);
      const placeholderFill = options.fillPlaceholderDraft ? await fillTaiwanPlaceholderDraft(page) : undefined;
      options.onProgress?.("post_verification_form_reached");
      return {
        submitted: false, portalUrl: page.url(), referenceNumber: null, screenshots, pdfs: [], logs, checkpoint: "official_form_recon", postVerificationControls, postVerificationSelectOptions, postVerificationRadioValues, placeholderFill,
        portalResponseSummary: "Taiwan NIA email verification completed in the controlled session. The post-verification form remains at selector-recon stage; no permit submission was attempted.",
      };
    }
    return {
      submitted: false,
      portalUrl: page.url(),
      portalResponseSummary: "VIZA entered the managed alias at the Taiwan NIA email-verification gate. The remainder of the official form is session-gated and awaits controlled selector reconnaissance; no verification code or submission was attempted.",
      referenceNumber: null, screenshots, pdfs: [], logs, checkpoint: "official_form_recon",
    };
  } finally { if (session) await closeSession(session); }
}
