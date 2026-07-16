import { randomInt } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { chromium, type Browser, type Page } from "playwright";
import {
  browserbaseEnabled,
  connectBrowserbaseCloudBrowser,
} from "../browserbase-session";
import { ensureApplicantInboxAlias } from "../inbox/alias";
import { extractAuto } from "../inbox/extractors/index";
import { inbox } from "../inbox/wait-for-message";
import { decryptSecret, encryptSecret } from "../secret-cipher";
import { findMissingAppointmentFields } from "../appointment-free-smoke";
import { loadCanonicalAnswers } from "../queue/answers";
import { supabase } from "../supabase";
import { consumeJapanVfsPaymentSession } from "./payment-session";

export type JapanVfsCheckpoint = "login" | "captcha" | "waf" | "identity_verification" | "selector_drift" | "no_slots" | "payment";

export interface JapanVfsSlotObservation {
  appointmentDate: string;
  appointmentTime: string | null;
  appointmentLocation: string;
  source: "vfs_jp_sg";
}

export interface JapanVfsRunnerResult {
  slots: JapanVfsSlotObservation[];
  checkpoint?: { type: JapanVfsCheckpoint; message: string };
  evidence: {
    pageTitle: string;
    finalUrl: string;
    httpStatus: number | null;
    observedAt: string;
    screenshotPath?: string;
    browserbaseReplayAvailable: boolean;
  };
  profile?: {
    ready: boolean;
    missingFields: string[];
    aliasPrepared: boolean;
    availableDocumentTypes: string[];
  };
  confirmation?: {
    confirmationNumber: string;
    receiptUrl: string | null;
    screenshotUrl: string | null;
  };
}

export interface JapanVfsObserveOptions {
  applicationId?: string;
  prepareAlias?: boolean;
  eligibility?: Record<string, unknown>;
}

export interface JapanVfsBookingInput {
  applicationId: string;
  jobId: string;
  selectedSlot: JapanVfsSlotObservation;
  paymentSessionId: string;
  eligibility?: Record<string, unknown>;
}

interface PortalAccountContext {
  id: string;
  applicantId: string;
  email: string;
  password: string;
  phone: string;
  status: string;
  emailVerified: boolean;
}

export interface JapanVfsRegistrationFormInput {
  email: string;
  password: string;
  phone: string;
}

const VFS_JAPAN_SINGAPORE_URL = "https://visa.vfsglobal.com/sgp/en/jpn/book-an-appointment";
const VFS_JAPAN_LOGIN_URL = "https://visa.vfsglobal.com/sgp/en/jpn/login";

function generatePassword(): string {
  const groups = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789", "!@#$%_-+"];
  const all = groups.join("");
  const chars = groups.map((group) => group[randomInt(group.length)]);
  while (chars.length < 16) chars.push(all[randomInt(all.length)]);
  return chars.sort(() => randomInt(3) - 1).join("");
}

async function loadPortalAccount(applicationId: string): Promise<PortalAccountContext> {
  const { data: application, error } = await supabase.from("applications")
    .select("applicant_id,applicant_profiles!inner(auth_user_id,inbox_alias,phone)").eq("id", applicationId).single();
  if (error || !application?.applicant_id) throw new Error(`Japan VFS account context failed: ${error?.message ?? "application missing"}`);
  const profileValue = Array.isArray(application.applicant_profiles) ? application.applicant_profiles[0] : application.applicant_profiles;
  const profile = profileValue as { auth_user_id?: string; inbox_alias?: string; phone?: string };
  const alias = profile.inbox_alias || (await ensureApplicantInboxAlias(application.applicant_id)).alias;
  if (!profile.auth_user_id || !profile.phone) throw new Error("Japan VFS account requires stored user and phone details");
  const { data: account, error: accountError } = await supabase.from("appointment_accounts").select("*")
    .eq("application_id", applicationId).eq("portal", "vfs_japan_sg").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (accountError) throw new Error(`Japan VFS account lookup failed: ${accountError.message}`);
  const password = account?.encrypted_account_password ? decryptSecret(account.encrypted_account_password) : generatePassword();
  const payload = {
    user_id: profile.auth_user_id, application_id: applicationId, country_code: "JP", portal: "vfs_japan_sg",
    account_email: alias, encrypted_account_password: encryptSecret(password),
    account_status: account?.account_status ?? "account_prepared", email_verified: Boolean(account?.email_verified),
    metadata_redacted_json: { aliasManagedByViza: true, accountEmail: "[REDACTED]" }, updated_at: new Date().toISOString(),
  };
  let accountId = account?.id as string | undefined;
  if (accountId) {
    const { error: updateError } = await supabase.from("appointment_accounts").update(payload).eq("id", accountId);
    if (updateError) throw new Error(`Japan VFS account update failed: ${updateError.message}`);
  } else {
    const { data, error: insertError } = await supabase.from("appointment_accounts").insert(payload).select("id").single();
    if (insertError || !data?.id) throw new Error(`Japan VFS account insert failed: ${insertError?.message ?? "missing id"}`);
    accountId = data.id;
  }
  if (!accountId) throw new Error("Japan VFS appointment account id is missing");
  return { id: accountId, applicantId: application.applicant_id, email: alias, password, phone: profile.phone, status: payload.account_status, emailVerified: payload.email_verified };
}

async function setAccountStatus(context: PortalAccountContext, status: string, emailVerified = context.emailVerified): Promise<void> {
  const { error } = await supabase.from("appointment_accounts").update({ account_status: status, email_verified: emailVerified, last_login_at: status === "logged_in" ? new Date().toISOString() : undefined, updated_at: new Date().toISOString() }).eq("id", context.id);
  if (error) throw new Error(`Japan VFS account status failed: ${error.message}`);
  context.status = status; context.emailVerified = emailVerified;
}

async function clickVisible(page: Page, labels: RegExp): Promise<boolean> {
  for (const locator of [page.getByRole("button", { name: labels }).first(), page.getByRole("link", { name: labels }).first(), page.getByText(labels).first()]) {
    if (!await locator.isVisible({ timeout: 1500 }).catch(() => false)) continue;
    if (await locator.click({ timeout: 10_000 }).then(() => true).catch(() => false)) return true;
  }
  return false;
}

export async function fillJapanVfsRegistrationForm(page: Page, input: JapanVfsRegistrationFormInput): Promise<void> {
  await page.getByLabel("Email*").fill(input.email);
  await page.getByLabel("Password*", { exact: true }).fill(input.password);
  await page.getByLabel("Confirm Password*").fill(input.password);
  const phoneInputs = page.locator("input[type='tel'], input[formcontrolname*='mobile' i], input[formcontrolname*='phone' i], input[placeholder*='mobile' i], input[placeholder*='phone' i]");
  const phoneByLabel = page.getByLabel(/mobile|phone/i).first();
  const unlabeledMaterialPhone = page.locator("main input[type='text']:not(#inputEmail):not([name]), form input[type='text']:not(#inputEmail):not([name])").first();
  const phoneField = await phoneInputs.first().isVisible({ timeout: 750 }).catch(() => false)
    ? phoneInputs.first()
    : await phoneByLabel.isVisible({ timeout: 750 }).catch(() => false) ? phoneByLabel : unlabeledMaterialPhone;
  if (await phoneField.isVisible({ timeout: 1_500 }).catch(() => false)) {
    await phoneField.fill(input.phone.replace(/^\+65/, "").replace(/\D/g, ""));
  }
  const dial = page.locator("select, [role='combobox']").first();
  if (await dial.isVisible().catch(() => false)) {
    const tagName = await dial.evaluate((element) => element.tagName.toLowerCase());
    if (tagName === "select") {
      await dial.selectOption({ label: "Singapore (+65)" }).catch(() => dial.selectOption("65"));
    } else {
      await dial.click();
      const option = page.getByRole("option", { name: /Singapore.*\+65/i }).first();
      if (await option.isVisible({ timeout: 2_000 }).catch(() => false)) await option.click();
    }
  }
  const consentBoxes = page.locator("main input[type='checkbox'], form input[type='checkbox']");
  for (let index = 0; index < await consentBoxes.count(); index += 1) {
    const checkbox = consentBoxes.nth(index);
    if (!await checkbox.isVisible({ timeout: 250 }).catch(() => false)) continue;
    const containerText = await checkbox.locator("xpath=ancestor::*[self::label or self::div][1]").innerText().catch(() => "");
    if (/marketing|promotion|offers|newsletter/i.test(containerText)) continue;
    await checkbox.check();
  }
}

export async function fillJapanVfsApplicantDetails(
  page: Page,
  answers: Record<string, string>,
  eligibility: Record<string, unknown> = {},
): Promise<string[]> {
  const filled: string[] = [];
  const fill = async (label: RegExp, value: unknown, key: string) => {
    if (typeof value !== "string" || !value.trim()) return;
    const field = page.getByLabel(label).first();
    if (!await field.isVisible({ timeout: 500 }).catch(() => false)) return;
    await field.fill(value.trim()); filled.push(key);
  };
  await fill(/surname|family name|last name/i, answers.surname, "surname");
  await fill(/given name|first name/i, answers.given_names, "given_names");
  await fill(/passport.*number/i, answers.passport_number, "passport_number");
  await fill(/^email|e-mail/i, answers.email, "email");
  await fill(/mobile|phone/i, answers.phone?.replace(/^\+65/, ""), "phone");
  await fill(/pass.*expiry|expiry.*pass/i, eligibility.singaporePassExpiryDate, "singapore_pass_expiry_date");
  await fill(/return.*singapore|intended return/i, eligibility.intendedReturnDate, "intended_return_date");
  const passType = typeof eligibility.singaporePassType === "string" ? eligibility.singaporePassType : "";
  const passSelect = page.getByLabel(/singapore.*pass|pass type/i).first();
  if (passType && await passSelect.isVisible({ timeout: 500 }).catch(() => false)) {
    await passSelect.selectOption(passType).catch(() => passSelect.selectOption({ label: passType.replace(/_/g, " ") }));
    filled.push("singapore_pass_type");
  }
  return filled;
}

async function attachApplicationPhotoIfRequested(page: Page, applicationId: string): Promise<boolean> {
  const upload = page.locator("input[type='file'][accept*='image'], input[type='file'][name*='photo' i], input[type='file'][id*='photo' i]").first();
  if (!await upload.count()) return false;
  const { data: row, error } = await supabase.from("application_documents")
    .select("storage_path,filename").eq("application_id", applicationId)
    .in("document_type", ["photo", "applicant_photo", "portrait_photo", "passport_photo"])
    .order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (error || !row?.storage_path) return false;
  const downloaded = await supabase.storage.from("application-documents").download(row.storage_path);
  if (downloaded.error || !downloaded.data) return false;
  const extension = path.extname(row.filename ?? row.storage_path) || ".jpg";
  const temporaryPath = path.join(os.tmpdir(), `viza-jp-photo-${applicationId}${extension}`);
  try {
    fs.writeFileSync(temporaryPath, Buffer.from(await downloaded.data.arrayBuffer()));
    await upload.setInputFiles(temporaryPath);
    return true;
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
}

async function completeAccountVerification(
  page: Page,
  context: PortalAccountContext,
  since: string,
): Promise<boolean> {
  const message = await inbox.waitForMessage(
    context.applicantId,
    (candidate) => /vfsglobal\.com|vfshelpzone\.com/i.test(candidate.from_addr),
    120_000,
    { since, includeProcessed: true },
  ).catch(() => null);
  if (!message) return false;
  const extracted = extractAuto({
    from: message.from_addr,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
  if (extracted.link) {
    await page.goto(extracted.link, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2_000);
  } else if (extracted.code) {
    const input = page.locator("input").first();
    const codeInput = page.locator("input[autocomplete='one-time-code'], input[name*='otp' i], input[formcontrolname*='otp' i], input[placeholder*='code' i]").first();
    const target = await codeInput.isVisible().catch(() => false) ? codeInput : input;
    if (!await target.isVisible().catch(() => false)) return false;
    await target.fill(extracted.code);
    if (!await clickVisible(page, /verify|activate|continue|submit/i)) return false;
    await page.waitForTimeout(2_000);
  } else {
    return false;
  }
  const text = await page.locator("body").innerText().catch(() => "");
  if (/invalid|expired|verification failed/i.test(text)) return false;
  await setAccountStatus(context, "registered", true);
  return true;
}

async function openBookingCalendar(page: Page): Promise<boolean> {
  if (/book-an-appointment|appointment-detail|application-detail/i.test(page.url())) return true;
  if (await clickVisible(page, /start new booking|book (?:an )?appointment|new appointment/i)) {
    await page.waitForTimeout(2_500);
    return true;
  }
  await page.goto(VFS_JAPAN_SINGAPORE_URL, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(2_000);
  return !/\/login(?:\?|$)/i.test(page.url());
}

async function ensureLoggedIn(page: Page, applicationId: string): Promise<{ context: PortalAccountContext; checkpoint?: JapanVfsRunnerResult["checkpoint"] }> {
  const context = await loadPortalAccount(applicationId);
  await page.goto(VFS_JAPAN_LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(2_000);
  if (context.status === "account_prepared" || context.status === "alias_prepared") {
    const verificationStartedAt = new Date().toISOString();
    await page.goto("https://visa.vfsglobal.com/sgp/en/jpn/register", { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(1_500);
    await clickVisible(page, /reject|decline|necessary only|accept only necessary/i);
    await fillJapanVfsRegistrationForm(page, context);
    if (!await clickVisible(page, /^continue$/i)) return { context, checkpoint: { type: "selector_drift", message: "VFS registration Continue control was not found." } };
    await page.waitForTimeout(2_500);
    const registrationText = await page.locator("body").innerText().catch(() => "");
    if (/already exists|already registered/i.test(registrationText)) {
      await page.goto(VFS_JAPAN_LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 90_000 });
    } else if (/otp|verification code|activate.*account|check your email/i.test(registrationText)) {
      await setAccountStatus(context, "email_verification_required");
      if (!await completeAccountVerification(page, context, verificationStartedAt)) {
        return { context, checkpoint: { type: "identity_verification", message: "VFS sent an account activation or verification message to the managed alias, but no usable code or link arrived before timeout." } };
      }
      await page.goto(VFS_JAPAN_LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 90_000 });
    } else {
      await setAccountStatus(context, "registered");
    }
  }
  if (/\/login(?:\?|$)/i.test(page.url())) {
    await page.getByLabel("Email*").fill(context.email);
    await page.getByLabel("Password*", { exact: true }).fill(context.password);
    if (!await clickVisible(page, /^sign in$/i)) return { context, checkpoint: { type: "selector_drift", message: "VFS Sign In control was not found." } };
    await page.waitForTimeout(3_000);
  }
  const body = await page.locator("body").innerText().catch(() => "");
  const checkpoint = checkpointForText(body);
  if (checkpoint) return { context, checkpoint: { type: checkpoint, message: "VFS requires an additional official login check." } };
  if (/\/login(?:\?|$)/i.test(page.url())) return { context, checkpoint: { type: "login", message: "VFS did not accept the stored account login." } };
  await setAccountStatus(context, "logged_in", true);
  if (!await openBookingCalendar(page)) {
    return { context, checkpoint: { type: "selector_drift", message: "VFS login succeeded, but the booking calendar entry point could not be opened." } };
  }
  return { context };
}

async function extractSlots(page: Page): Promise<JapanVfsSlotObservation[]> {
  const texts = await page.locator("[data-testid*='slot'], [data-slot-id], .appointment-slot, .slot, table tbody tr, button").allTextContents().catch(() => []);
  const slots: JapanVfsSlotObservation[] = [];
  for (const raw of texts) {
    const value = raw.replace(/\s+/g, " ").trim();
    const date = value.match(/\b(20\d{2}[-/]\d{2}[-/]\d{2}|\d{1,2}[-/]\d{1,2}[-/]20\d{2})\b/)?.[1];
    if (!date) continue;
    const time = value.match(/\b(\d{1,2}:\d{2}(?:\s?[AP]M)?)\b/i)?.[1] ?? null;
    slots.push({ appointmentDate: date.replace(/\//g, "-"), appointmentTime: time, appointmentLocation: "Japan Visa Application Centre Singapore", source: "vfs_jp_sg" });
  }
  return slots.filter((slot, index) => slots.findIndex((candidate) => candidate.appointmentDate === slot.appointmentDate && candidate.appointmentTime === slot.appointmentTime) === index);
}

async function fillHostedPayment(page: Page, input: JapanVfsBookingInput): Promise<boolean> {
  const card = consumeJapanVfsPaymentSession(input.paymentSessionId, input.jobId);
  if (!card) return false;
  const scopes = [page, ...page.frames()];
  const fill = async (selectors: string, value: string) => {
    for (const scope of scopes) {
      const field = scope.locator(selectors).first();
      if (await field.isVisible({ timeout: 750 }).catch(() => false)) { await field.fill(value); return true; }
    }
    return false;
  };
  if (!await fill("input[autocomplete='cc-number'], input[name*='card' i][name*='number' i], input[placeholder*='card number' i]", card.pan)) return false;
  await fill("input[autocomplete='cc-name'], input[name*='holder' i], input[placeholder*='name on card' i]", card.holderName);
  const combined = await fill("input[autocomplete='cc-exp'], input[name*='expir' i], input[placeholder*='MM/YY' i]", `${card.expiryMonth}/${card.expiryYear.slice(-2)}`);
  if (!combined) {
    await fill("input[name*='month' i]", card.expiryMonth);
    await fill("input[name*='year' i]", card.expiryYear);
  }
  if (!await fill("input[autocomplete='cc-csc'], input[name*='cvv' i], input[name*='cvc' i], input[placeholder*='CVV' i]", card.cvv)) return false;
  return clickVisible(page, /pay now|pay|submit payment|continue/i);
}

function checkpointForText(text: string): JapanVfsCheckpoint | null {
  if (/cloudflare|access denied|security check|turnstile/i.test(text)) return "waf";
  if (/captcha|i am not a robot|recaptcha/i.test(text)) return "captcha";
  if (/sign in|log in|login|enter your email/i.test(text)) return "login";
  if (/verify your identity|one[- ]time password|otp|verification code/i.test(text)) return "identity_verification";
  return null;
}

async function openAuthorizedBrowser(): Promise<{
  browser: Browser;
  page: Page;
  browserbaseReplayAvailable: boolean;
}> {
  if (browserbaseEnabled("JP_VFS_SG")) {
    const cloud = await connectBrowserbaseCloudBrowser({ prefix: "JP_VFS_SG" });
    return {
      browser: cloud.browser,
      page: cloud.page,
      browserbaseReplayAvailable: Boolean(cloud.replayUrl),
    };
  }
  const endpoint = process.env.JP_VFS_SG_BROWSER_API_ENDPOINT?.trim();
  const browser = endpoint
    ? await chromium.connectOverCDP(endpoint, { timeout: 30_000 })
    : await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  return { browser, page, browserbaseReplayAvailable: false };
}

async function captureRedactedEvidence(page: Page): Promise<string | undefined> {
  const artifactDir = process.env.JP_VFS_SG_ARTIFACT_DIR?.trim();
  if (!artifactDir) return undefined;
  const resolvedDir = path.resolve(artifactDir);
  fs.mkdirSync(resolvedDir, { recursive: true });
  await page.evaluate(() => {
    document.querySelectorAll<HTMLInputElement>("input, textarea").forEach((element) => {
      if (element.value) element.value = "[REDACTED]";
    });
  }).catch(() => undefined);
  const screenshotPath = path.join(resolvedDir, `jp-vfs-sg-${Date.now()}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);
  return screenshotPath;
}

/**
 * Reads the VFS booking landing state only. It intentionally does not enter
 * credentials, CAPTCHA values, payment details, or click final booking.
 */
export async function observeJapanVfsSingaporeSlots(
  options: JapanVfsObserveOptions = {},
): Promise<JapanVfsRunnerResult> {
  let profile: JapanVfsRunnerResult["profile"];
  if (options.applicationId) {
    const answers = await loadCanonicalAnswers(options.applicationId);
    const { data: application, error: applicationError } = await supabase
      .from("applications")
      .select("applicant_id")
      .eq("id", options.applicationId)
      .single();
    if (applicationError || !application?.applicant_id) {
      throw new Error(`Japan VFS application lookup failed: ${applicationError?.message ?? "missing applicant_id"}`);
    }
    const { data: documents, error: documentError } = await supabase
      .from("application_documents")
      .select("document_type, storage_path")
      .eq("application_id", options.applicationId);
    if (documentError) throw new Error(`Japan VFS documents lookup failed: ${documentError.message}`);
    const missingFields = findMissingAppointmentFields(answers, [
      "surname", "given_names", "date_of_birth", "nationality", "passport_number",
      "passport_expiry_date", "email", "phone",
    ]);
    let aliasPrepared = false;
    if (options.prepareAlias) {
      await ensureApplicantInboxAlias(application.applicant_id);
      aliasPrepared = true;
    }
    profile = {
      ready: missingFields.length === 0,
      missingFields,
      aliasPrepared,
      availableDocumentTypes: Array.from(new Set((documents ?? [])
        .filter((row) => Boolean(row.storage_path))
        .map((row) => String(row.document_type)))),
    };
    if (missingFields.length > 0) {
      return {
        slots: [],
        checkpoint: {
          type: "selector_drift",
          message: `Missing required VIZA fields: ${missingFields.join(", ")}`,
        },
        evidence: {
          pageTitle: "",
          finalUrl: "",
          httpStatus: null,
          observedAt: new Date().toISOString(),
          browserbaseReplayAvailable: false,
        },
        profile,
      };
    }
  }
  const opened = await openAuthorizedBrowser();
  const { browser, page } = opened;
  try {
    const login = options.applicationId ? await ensureLoggedIn(page, options.applicationId) : null;
    if (options.applicationId && login && !login.checkpoint) {
      await fillJapanVfsApplicantDetails(page, await loadCanonicalAnswers(options.applicationId), options.eligibility);
      await attachApplicationPhotoIfRequested(page, options.applicationId);
    }
    const response = login
      ? null
      : await page.goto(VFS_JAPAN_SINGAPORE_URL, { waitUntil: "domcontentloaded", timeout: 90_000 });
    const body = await page.locator("body").innerText({ timeout: 15_000 }).catch(() => "");
    const checkpoint = login?.checkpoint?.type as JapanVfsCheckpoint | undefined ?? checkpointForText(body);
    const screenshotPath = await captureRedactedEvidence(page);
    const evidence = {
      pageTitle: await page.title(),
      finalUrl: page.url(),
      httpStatus: response?.status() ?? null,
      observedAt: new Date().toISOString(),
      ...(screenshotPath ? { screenshotPath } : {}),
      browserbaseReplayAvailable: opened.browserbaseReplayAvailable,
    };
    if (checkpoint) return { slots: [], checkpoint: { type: checkpoint, message: login?.checkpoint?.message ?? "Official VFS action is required before slots can be read." }, evidence, profile };
    if (/no appointments|no slots|not available/i.test(body)) return { slots: [], checkpoint: { type: "no_slots", message: "VFS currently shows no available appointment slots." }, evidence, profile };
    const slots = await extractSlots(page);
    if (slots.length > 0) return { slots, evidence, profile };
    return { slots: [], checkpoint: { type: "selector_drift", message: "VFS login succeeded, but no supported calendar or no-slots message was visible." }, evidence, profile };
  } finally {
    await page.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

export async function bookJapanVfsSingaporeSlot(input: JapanVfsBookingInput): Promise<JapanVfsRunnerResult> {
  const opened = await openAuthorizedBrowser();
  const { browser, page } = opened;
  try {
    const login = await ensureLoggedIn(page, input.applicationId);
    if (login.checkpoint) return { slots: [], checkpoint: login.checkpoint, evidence: { pageTitle: await page.title(), finalUrl: page.url(), httpStatus: null, observedAt: new Date().toISOString(), browserbaseReplayAvailable: opened.browserbaseReplayAvailable } };
    await fillJapanVfsApplicantDetails(page, await loadCanonicalAnswers(input.applicationId), input.eligibility);
    await attachApplicationPhotoIfRequested(page, input.applicationId);
    const candidates = page.locator("[data-testid*='slot'], [data-slot-id], .appointment-slot, .slot, table tbody tr, button");
    let matched = false;
    for (let index = 0; index < Math.min(await candidates.count(), 200); index += 1) {
      const candidate = candidates.nth(index);
      const value = (await candidate.innerText().catch(() => "")).replace(/\s+/g, " ");
      if (!value.includes(input.selectedSlot.appointmentDate) || (input.selectedSlot.appointmentTime && !value.includes(input.selectedSlot.appointmentTime))) continue;
      await candidate.click(); matched = true; break;
    }
    if (!matched) return { slots: [], checkpoint: { type: "selector_drift", message: "The user-selected VFS slot is no longer visible." }, evidence: { pageTitle: await page.title(), finalUrl: page.url(), httpStatus: null, observedAt: new Date().toISOString(), browserbaseReplayAvailable: opened.browserbaseReplayAvailable } };
    await clickVisible(page, /continue|confirm|book/i);
    await page.waitForTimeout(2_000);
    const body = await page.locator("body").innerText().catch(() => "");
    if (/card number|cvv|payment|pay now|service fee/i.test(body)) {
      if (!await fillHostedPayment(page, input)) {
        return { slots: [], checkpoint: { type: "payment", message: "VFS secure payment is ready, but the one-time card session was missing, expired, or did not match the hosted fields." }, evidence: { pageTitle: await page.title(), finalUrl: page.url(), httpStatus: null, observedAt: new Date().toISOString(), browserbaseReplayAvailable: opened.browserbaseReplayAvailable } };
      }
      await page.waitForTimeout(4_000);
    }
    const settledBody = await page.locator("body").innerText().catch(() => "");
    if (/3d secure|3ds|bank app|one[- ]time password|otp|authenticate/i.test(settledBody)) {
      return { slots: [], checkpoint: { type: "identity_verification", message: "The issuing bank requires 3-D Secure approval before VFS can confirm the appointment." }, evidence: { pageTitle: await page.title(), finalUrl: page.url(), httpStatus: null, observedAt: new Date().toISOString(), browserbaseReplayAvailable: opened.browserbaseReplayAvailable } };
    }
    const confirmationNumber = settledBody.match(/(?:confirmation|appointment|booking|reference)\s*(?:number|no\.?|id)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{5,})/i)?.[1];
    const evidence = { pageTitle: await page.title(), finalUrl: page.url(), httpStatus: null, observedAt: new Date().toISOString(), browserbaseReplayAvailable: opened.browserbaseReplayAvailable };
    if (!confirmationNumber) return { slots: [], checkpoint: { type: "selector_drift", message: "VFS did not display an official confirmation number after the booking attempt." }, evidence };
    return { slots: [], confirmation: { confirmationNumber, receiptUrl: null, screenshotUrl: await captureRedactedEvidence(page) ?? null }, evidence };
  } finally {
    await page.close().catch(() => undefined); await browser.close().catch(() => undefined);
  }
}

export { VFS_JAPAN_SINGAPORE_URL };
