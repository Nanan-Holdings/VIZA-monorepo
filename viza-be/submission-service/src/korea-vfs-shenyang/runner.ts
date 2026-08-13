import { randomInt } from "node:crypto";
import type { Browser, Page } from "playwright";
import { browserbaseEnabled, connectBrowserbaseCloudBrowser } from "../browserbase-session.js";
import { ensureApplicantInboxAlias } from "../inbox/alias.js";
import { extractAuto } from "../inbox/extractors/index.js";
import { hasAliasEmailForwardingConsent } from "../inbox/forwarding-consent.js";
import { inbox } from "../inbox/wait-for-message.js";
import { loadCanonicalAnswers } from "../queue/answers.js";
import { decryptSecret, encryptSecret } from "../secret-cipher.js";
import { supabase } from "../supabase.js";
import {
  extractShenyangVfsSlotsFromTexts,
  toShenyangVfsIsoDate,
  type ShenyangVfsSlot,
} from "./slots.js";

const PREFIX = "KR_KVAC_SHENYANG";
const LOGIN_URL = "https://visa.vfsglobal.com/chn/en/kor/login";
const REGISTER_URL = "https://visa.vfsglobal.com/chn/en/kor/register";
const BOOKING_URL = "https://visa.vfsglobal.com/chn/en/kor/book-an-appointment";
const SESSION_TTL_MS = 5 * 60_000;

export type ShenyangVfsCheckpoint =
  | "account_terms_required"
  | "email_verification_pending"
  | "phone_otp_required"
  | "login_required"
  | "captcha"
  | "waf"
  | "no_slots"
  | "payment"
  | "selector_drift";

export interface ShenyangVfsResult {
  status: "checkpoint" | "appointment_slots_observed" | "appointment_booked";
  accountId?: string;
  checkpoint?: {
    type: ShenyangVfsCheckpoint;
    expiresAtIso?: string;
    phoneMasked?: string;
  };
  slots: ShenyangVfsSlot[];
  observedAt: string;
  screenshotPath: string | null;
  browserbaseReplayAvailable: boolean;
  confirmation?: {
    confirmationNumber: string;
    appointmentDate: string;
    appointmentTime: string;
    appointmentLocation: string;
    confirmationPdfUrl: string | null;
  };
}

export interface StartShenyangVfsInput {
  applicationId: string;
  jobId: string;
  portalTermsAccepted: boolean;
}

export interface BookShenyangVfsInput {
  applicationId: string;
  jobId: string;
  selectedSlot: {
    appointment_date: string | null;
    appointment_time: string | null;
    appointment_location: string | null;
    appointment_type: string | null;
  };
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

interface LiveOtpSession {
  browser: Browser;
  page: Page;
  applicationId: string;
  jobId: string;
  account: PortalAccountContext;
  expiresAt: number;
  replayAvailable: boolean;
}

const otpSessions = new Map<string, LiveOtpSession>();

function enabled(value: string | undefined): boolean {
  return /^(1|true|yes|on)$/iu.test((value ?? "").trim());
}

function assertConfigured(): void {
  if (!enabled(process.env.KR_KVAC_SHENYANG_VFS_ENABLED)) {
    throw new Error("The Shenyang official VFS account flow is not enabled.");
  }
  if (!browserbaseEnabled(PREFIX)) {
    throw new Error("The Shenyang official VFS account flow requires the configured Browserbase session provider.");
  }
}

function generatePassword(): string {
  const groups = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789", "!@#$%_-+"];
  const all = groups.join("");
  const chars = groups.map((group) => group[randomInt(group.length)]);
  while (chars.length < 18) chars.push(all[randomInt(all.length)]);
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swapWith = randomInt(index + 1);
    [chars[index], chars[swapWith]] = [chars[swapWith], chars[index]];
  }
  return chars.join("");
}

function mainlandPhone(value: string): string {
  const digits = value.replace(/\D/gu, "").replace(/^86(?=1\d{10}$)/u, "");
  if (!/^1\d{10}$/u.test(digits)) {
    throw new Error("The Shenyang VFS account requires a saved mainland China mobile number.");
  }
  return digits;
}

function maskPhone(value: string): string {
  return value.replace(/^(\d{3})\d{4}(\d{4})$/u, "$1****$2");
}

async function loadPortalAccount(applicationId: string): Promise<PortalAccountContext> {
  const { data: application, error } = await supabase
    .from("applications")
    .select("applicant_id,applicant_profiles!inner(auth_user_id,inbox_alias,phone)")
    .eq("id", applicationId)
    .single();
  if (error || !application?.applicant_id) {
    throw new Error("The Shenyang VFS account could not be linked to this application.");
  }
  if (!await hasAliasEmailForwardingConsent(application.applicant_id)) {
    throw new Error("Alias email forwarding consent is required before VIZA can receive the official VFS activation message.");
  }
  const profileValue = Array.isArray(application.applicant_profiles)
    ? application.applicant_profiles[0]
    : application.applicant_profiles;
  const profile = profileValue as { auth_user_id?: string; inbox_alias?: string; phone?: string };
  if (!profile.auth_user_id || !profile.phone) {
    throw new Error("The Shenyang VFS account requires a saved applicant account and mobile number.");
  }
  const alias = profile.inbox_alias || (await ensureApplicantInboxAlias(application.applicant_id)).alias;
  const phone = mainlandPhone(profile.phone);
  const { data: existing, error: accountError } = await supabase
    .from("appointment_accounts")
    .select("*")
    .eq("application_id", applicationId)
    .eq("portal", "vfs_korea_shenyang")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (accountError) throw new Error("The Shenyang VFS account state could not be read.");

  const password = existing?.encrypted_account_password
    ? decryptSecret(existing.encrypted_account_password)
    : generatePassword();
  const now = new Date().toISOString();
  const payload = {
    user_id: profile.auth_user_id,
    application_id: applicationId,
    country_code: "KR",
    portal: "vfs_korea_shenyang",
    account_email: alias,
    encrypted_account_password: encryptSecret(password),
    account_status: existing?.account_status ?? "account_prepared",
    email_verified: Boolean(existing?.email_verified),
    metadata_redacted_json: {
      aliasManagedByViza: true,
      accountEmail: "[REDACTED]",
      phone: maskPhone(phone),
      officialPortal: "vfs_korea_china",
    },
    updated_at: now,
  };
  let accountId = existing?.id as string | undefined;
  if (accountId) {
    const { error: updateError } = await supabase.from("appointment_accounts").update(payload).eq("id", accountId);
    if (updateError) throw new Error("The Shenyang VFS account state could not be updated.");
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from("appointment_accounts")
      .insert(payload)
      .select("id")
      .single();
    if (insertError || !inserted?.id) throw new Error("The Shenyang VFS account state could not be created.");
    accountId = inserted.id;
  }
  if (!accountId) throw new Error("The Shenyang VFS account identifier is missing.");
  return {
    id: accountId,
    applicantId: application.applicant_id,
    email: alias,
    password,
    phone,
    status: payload.account_status,
    emailVerified: payload.email_verified,
  };
}

async function setAccountStatus(
  account: PortalAccountContext,
  status: string,
  emailVerified = account.emailVerified,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase.from("appointment_accounts").update({
    account_status: status,
    email_verified: emailVerified,
    ...(status === "logged_in" ? { last_login_at: now } : {}),
    updated_at: now,
  }).eq("id", account.id);
  if (error) throw new Error("The Shenyang VFS account transition could not be saved.");
  account.status = status;
  account.emailVerified = emailVerified;
}

async function clickVisible(page: Page, labels: RegExp): Promise<boolean> {
  const locators = [
    page.getByRole("button", { name: labels }).first(),
    page.getByRole("link", { name: labels }).first(),
    page.locator("button, a, input[type='submit']").filter({ hasText: labels }).first(),
  ];
  for (const locator of locators) {
    if (!await locator.isVisible({ timeout: 1_200 }).catch(() => false)) continue;
    if (await locator.click({ timeout: 15_000 }).then(() => true).catch(() => false)) return true;
  }
  return false;
}

async function dismissCookies(page: Page): Promise<void> {
  await clickVisible(page, /accept only necessary|accept all|allow all/i).catch(() => false);
}

async function fillRegistration(page: Page, account: PortalAccountContext): Promise<void> {
  const email = page.locator("#inputEmail").or(page.getByLabel(/^email\*?$/i)).first();
  const password = page.locator("#password").or(page.getByLabel(/^password\*?$/i)).first();
  const confirmation = page.locator("#confirmPassword").or(page.getByLabel(/confirm password/i)).first();
  await email.fill(account.email);
  await password.fill(account.password);
  await confirmation.fill(account.password);

  const dial = page.locator("[role='combobox'], mat-select, select").first();
  if (await dial.isVisible({ timeout: 1_000 }).catch(() => false)) {
    const tagName = await dial.evaluate((element) => element.tagName.toLowerCase());
    if (tagName === "select") {
      const value = await dial.locator("option").evaluateAll((options) => options.find((option) => /china|中国|\+?86/i.test(option.textContent ?? ""))?.getAttribute("value") ?? null);
      if (value) await dial.selectOption(value);
    } else {
      await dial.click();
      const option = page.getByRole("option").filter({ hasText: /china|中国|\+?86/i }).first();
      if (await option.isVisible({ timeout: 3_000 }).catch(() => false)) await option.click();
    }
  }
  const phone = page.locator("#mat-input-3, input[type='tel'], input[formcontrolname*='mobile' i], input[placeholder*='mobile' i]").first();
  if (!await phone.isVisible({ timeout: 2_000 }).catch(() => false)) {
    throw new Error("The official VFS mobile-number field could not be identified.");
  }
  await phone.fill(account.phone);

  const requiredConsents = page.locator("form input[type='checkbox'], main input[type='checkbox']");
  const count = await requiredConsents.count();
  if (count < 1) throw new Error("The official VFS required-consent controls could not be identified.");
  for (let index = 0; index < count; index += 1) {
    const checkbox = requiredConsents.nth(index);
    if (!await checkbox.isVisible({ timeout: 300 }).catch(() => false)) continue;
    const context = await checkbox.locator("xpath=ancestor::*[self::label or self::div][1]").innerText().catch(() => "");
    if (isOptionalRegistrationConsent(context)) continue;
    await checkbox.check();
  }
}

export function isOptionalRegistrationConsent(context: string): boolean {
  return /marketing|promotion|offers|newsletter/i.test(context);
}

function checkpointFromText(text: string): ShenyangVfsCheckpoint | null {
  if (/access denied|checking your browser|security check|turnstile|cloudflare/i.test(text)) return "waf";
  if (/captcha|recaptcha|i am not a robot|verify you are human/i.test(text)) return "captcha";
  if (/one[- ]time password|\botp\b|verification code.*mobile|sent to your mobile/i.test(text)) return "phone_otp_required";
  return null;
}

async function completeEmailVerification(page: Page, account: PortalAccountContext, since: string): Promise<boolean> {
  const message = await inbox.waitForMessage(
    account.applicantId,
    (candidate) => /vfsglobal\.com|vfshelpzone\.com/i.test(candidate.from_addr),
    50_000,
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
    const url = new URL(extracted.link);
    if (!/^(?:[^.]+\.)*(?:vfsglobal\.com|vfshelpzone\.com)$/i.test(url.hostname)) return false;
    await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 90_000 });
  } else if (extracted.code) {
    const codeField = page.locator("input[autocomplete='one-time-code'], input[name*='otp' i], input[formcontrolname*='otp' i], input[placeholder*='code' i]").first();
    if (!await codeField.isVisible({ timeout: 2_000 }).catch(() => false)) return false;
    await codeField.fill(extracted.code);
    if (!await clickVisible(page, /verify|activate|continue|submit/i)) return false;
  } else {
    return false;
  }
  await page.waitForTimeout(2_000);
  const text = await page.locator("body").innerText().catch(() => "");
  if (/invalid|expired|verification failed/i.test(text)) return false;
  await setAccountStatus(account, "registered", true);
  return true;
}

async function login(page: Page, account: PortalAccountContext): Promise<ShenyangVfsCheckpoint | null> {
  await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(1_500);
  await dismissCookies(page);
  const email = page.locator("#inputEmail").or(page.getByLabel(/^email\*?$/i)).first();
  const password = page.locator("#password").or(page.getByLabel(/^password\*?$/i)).first();
  if (!await email.isVisible({ timeout: 5_000 }).catch(() => false) || !await password.isVisible({ timeout: 1_000 }).catch(() => false)) {
    return checkpointFromText(await page.locator("body").innerText().catch(() => "")) ?? "selector_drift";
  }
  await email.fill(account.email);
  await password.fill(account.password);
  if (!await clickVisible(page, /^sign in$/i)) return "selector_drift";
  await page.waitForTimeout(3_000);
  const text = await page.locator("body").innerText().catch(() => "");
  const checkpoint = checkpointFromText(text);
  if (checkpoint) return checkpoint;
  if (/invalid credentials|incorrect password|account.*not activated|activate your account/i.test(text)) return "login_required";
  if (/\/login(?:\?|$)/i.test(page.url())) return "login_required";
  await setAccountStatus(account, "logged_in", true);
  return null;
}

async function selectComboboxOption(page: Page, label: RegExp, option: RegExp): Promise<boolean> {
  const byLabel = page.getByLabel(label).first();
  const container = page.locator("mat-form-field, .mat-mdc-form-field, .form-group").filter({ hasText: label }).first();
  const combo = await byLabel.isVisible({ timeout: 500 }).catch(() => false)
    ? byLabel
    : container.locator("[role='combobox'], mat-select, select").first();
  if (!await combo.isVisible({ timeout: 700 }).catch(() => false)) return false;
  const tagName = await combo.evaluate((element) => element.tagName.toLowerCase());
  if (tagName === "select") {
    const value = await combo.locator("option").evaluateAll((options, source) => {
      const pattern = new RegExp(source, "i");
      return options.find((candidate) => pattern.test(candidate.textContent ?? ""))?.getAttribute("value") ?? null;
    }, option.source);
    if (!value) return false;
    await combo.selectOption(value);
    return true;
  }
  await combo.click();
  const candidate = page.getByRole("option").filter({ hasText: option }).first();
  if (!await candidate.isVisible({ timeout: 3_000 }).catch(() => false)) return false;
  await candidate.click();
  return true;
}

async function openCalendar(page: Page): Promise<ShenyangVfsCheckpoint | null> {
  if (!/appointment|application-detail|dashboard/i.test(page.url())) {
    if (!await clickVisible(page, /start new booking|book (?:an )?appointment|new appointment/i)) {
      await page.goto(BOOKING_URL, { waitUntil: "domcontentloaded", timeout: 90_000 });
    }
    await page.waitForTimeout(2_000);
  }
  if (/\/login(?:\?|$)/i.test(page.url())) return "login_required";
  const pageText = await page.locator("body").innerText().catch(() => "");
  const checkpoint = checkpointFromText(pageText);
  if (checkpoint) return checkpoint;

  await selectComboboxOption(page, /application centre|visa application cent(?:re|er)|location/i, /shenyang|沈阳/i);
  await page.waitForTimeout(500);
  await selectComboboxOption(page, /appointment category|visa category|category/i, /short.?term|tour(?:ism|ist)|c-?3-?9/i);
  await page.waitForTimeout(500);
  await selectComboboxOption(page, /sub.?category|visa type/i, /tour(?:ism|ist)|c-?3-?9|short.?term/i);
  const applicantCount = page.getByLabel(/number of applicants|applicant count/i).first();
  if (await applicantCount.isVisible({ timeout: 400 }).catch(() => false)) {
    await applicantCount.fill("1").catch(() => applicantCount.selectOption("1"));
  }
  await clickVisible(page, /continue|check availability|search|next/i);
  await page.waitForTimeout(2_000);
  return checkpointFromText(await page.locator("body").innerText().catch(() => ""));
}

async function observeSlots(page: Page, observedAt: string): Promise<ShenyangVfsSlot[]> {
  const selector = [
    "[data-testid*='slot']",
    "[data-slot-id]",
    ".appointment-slot",
    ".slot",
    ".time-slot",
    "mat-calendar",
    "table tbody tr",
    "button",
  ].join(",");
  const texts = await page.locator(selector).allTextContents().catch(() => []);
  return extractShenyangVfsSlotsFromTexts(texts, observedAt);
}

async function captureEvidence(page: Page, applicationId: string, jobId: string, label: string): Promise<string | null> {
  await page.evaluate(() => {
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea").forEach((element) => {
      if (element.value) element.value = "[REDACTED]";
    });
  }).catch(() => undefined);
  const bytes = await page.screenshot({ fullPage: true }).catch(() => null);
  if (!bytes) return null;
  const safeJob = jobId.replace(/[^a-z0-9_-]/giu, "-");
  const safeLabel = label.replace(/[^a-z0-9_-]/giu, "-");
  const storagePath = `korea-appointments/${applicationId}/${safeJob}-shenyang-${safeLabel}.png`;
  const { error } = await supabase.storage.from("submission-artifacts").upload(storagePath, bytes, {
    contentType: "image/png",
    upsert: true,
  });
  return error ? null : storagePath;
}

async function closeSession(jobId: string): Promise<void> {
  const session = otpSessions.get(jobId);
  otpSessions.delete(jobId);
  if (!session) return;
  await session.page.close().catch(() => undefined);
  await session.browser.close().catch(() => undefined);
}

async function sweepSessions(): Promise<void> {
  const expired = [...otpSessions.entries()].filter(([, session]) => session.expiresAt <= Date.now());
  await Promise.all(expired.map(([jobId]) => closeSession(jobId)));
}

export function hasActiveShenyangVfsSessions(): boolean {
  return [...otpSessions.values()].some((session) => session.expiresAt > Date.now());
}

async function resultFromAuthenticatedPage(
  page: Page,
  account: PortalAccountContext,
  jobId: string,
  applicationId: string,
  replayAvailable: boolean,
): Promise<ShenyangVfsResult> {
  const calendarCheckpoint = await openCalendar(page);
  const observedAt = new Date().toISOString();
  if (calendarCheckpoint) {
    return {
      status: "checkpoint",
      accountId: account.id,
      checkpoint: { type: calendarCheckpoint },
      slots: [],
      observedAt,
      screenshotPath: await captureEvidence(page, applicationId, jobId, calendarCheckpoint),
      browserbaseReplayAvailable: replayAvailable,
    };
  }
  const text = await page.locator("body").innerText().catch(() => "");
  const slots = await observeSlots(page, observedAt);
  if (slots.length > 0) {
    return {
      status: "appointment_slots_observed",
      accountId: account.id,
      slots,
      observedAt,
      screenshotPath: await captureEvidence(page, applicationId, jobId, "slots"),
      browserbaseReplayAvailable: replayAvailable,
    };
  }
  const noSlots = /no appointments|no slots|no appointment slots|not available|fully booked/i.test(text);
  return {
    status: "checkpoint",
    accountId: account.id,
    checkpoint: { type: noSlots ? "no_slots" : "selector_drift" },
    slots: [],
    observedAt,
    screenshotPath: await captureEvidence(page, applicationId, jobId, noSlots ? "no-slots" : "selector-drift"),
    browserbaseReplayAvailable: replayAvailable,
  };
}

export async function startShenyangVfsBookingFlow(input: StartShenyangVfsInput): Promise<ShenyangVfsResult> {
  assertConfigured();
  if (!input.applicationId || !input.jobId) throw new Error("A Shenyang application and appointment job are required.");
  if (!input.portalTermsAccepted) {
    return {
      status: "checkpoint",
      checkpoint: { type: "account_terms_required" },
      slots: [],
      observedAt: new Date().toISOString(),
      screenshotPath: null,
      browserbaseReplayAvailable: false,
    };
  }
  await sweepSessions();
  const activeOtpSession = otpSessions.get(input.jobId);
  if (activeOtpSession && activeOtpSession.expiresAt > Date.now()) {
    return {
      status: "checkpoint",
      accountId: activeOtpSession.account.id,
      checkpoint: {
        type: "phone_otp_required",
        expiresAtIso: new Date(activeOtpSession.expiresAt).toISOString(),
        phoneMasked: maskPhone(activeOtpSession.account.phone),
      },
      slots: [],
      observedAt: new Date().toISOString(),
      screenshotPath: null,
      browserbaseReplayAvailable: activeOtpSession.replayAvailable,
    };
  }
  await closeSession(input.jobId);
  const account = await loadPortalAccount(input.applicationId);
  const cloud = await connectBrowserbaseCloudBrowser({ prefix: PREFIX });
  const page = cloud.page;
  let keepSession = false;
  try {
    if (["account_prepared", "alias_prepared"].includes(account.status)) {
      const verificationStartedAt = new Date().toISOString();
      await page.goto(REGISTER_URL, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await page.waitForTimeout(1_500);
      await dismissCookies(page);
      await fillRegistration(page, account);
      await setAccountStatus(account, "registration_submitting");
      if (!await clickVisible(page, /^register$|^continue$/i)) {
        await setAccountStatus(account, "selector_drift");
        return {
          status: "checkpoint",
          accountId: account.id,
          checkpoint: { type: "selector_drift" },
          slots: [],
          observedAt: new Date().toISOString(),
          screenshotPath: await captureEvidence(page, input.applicationId, input.jobId, "registration-selector-drift"),
          browserbaseReplayAvailable: Boolean(cloud.replayUrl),
        };
      }
      await page.waitForTimeout(3_000);
      const registrationText = await page.locator("body").innerText().catch(() => "");
      const registrationCheckpoint = checkpointFromText(registrationText);
      if (registrationCheckpoint === "phone_otp_required") {
        const expiresAt = Date.now() + SESSION_TTL_MS;
        await setAccountStatus(account, "phone_otp_required");
        otpSessions.set(input.jobId, {
          browser: cloud.browser,
          page,
          applicationId: input.applicationId,
          jobId: input.jobId,
          account,
          expiresAt,
          replayAvailable: Boolean(cloud.replayUrl),
        });
        keepSession = true;
        return {
          status: "checkpoint",
          accountId: account.id,
          checkpoint: {
            type: "phone_otp_required",
            expiresAtIso: new Date(expiresAt).toISOString(),
            phoneMasked: maskPhone(account.phone),
          },
          slots: [],
          observedAt: new Date().toISOString(),
          screenshotPath: null,
          browserbaseReplayAvailable: Boolean(cloud.replayUrl),
        };
      }
      if (registrationCheckpoint === "captcha" || registrationCheckpoint === "waf") {
        await setAccountStatus(account, registrationCheckpoint);
        return {
          status: "checkpoint",
          accountId: account.id,
          checkpoint: { type: registrationCheckpoint },
          slots: [],
          observedAt: new Date().toISOString(),
          screenshotPath: await captureEvidence(page, input.applicationId, input.jobId, registrationCheckpoint),
          browserbaseReplayAvailable: Boolean(cloud.replayUrl),
        };
      }
      if (/(?:email|account).{0,60}(?:already registered|already exists)/i.test(registrationText)) {
        await setAccountStatus(account, "registered");
      } else if (/activate|verification|check your email|email has been sent/i.test(registrationText)) {
        await setAccountStatus(account, "email_verification_pending");
        if (!await completeEmailVerification(page, account, verificationStartedAt)) {
          return {
            status: "checkpoint",
            accountId: account.id,
            checkpoint: { type: "email_verification_pending" },
            slots: [],
            observedAt: new Date().toISOString(),
            screenshotPath: await captureEvidence(page, input.applicationId, input.jobId, "email-verification"),
            browserbaseReplayAvailable: Boolean(cloud.replayUrl),
          };
        }
      } else {
        await setAccountStatus(account, "registered");
      }
    }
    if (account.status === "email_verification_pending") {
      await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 90_000 });
      const lookback = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
      if (!await completeEmailVerification(page, account, lookback)) {
        return {
          status: "checkpoint",
          accountId: account.id,
          checkpoint: { type: "email_verification_pending" },
          slots: [],
          observedAt: new Date().toISOString(),
          screenshotPath: null,
          browserbaseReplayAvailable: Boolean(cloud.replayUrl),
        };
      }
    }
    const loginCheckpoint = await login(page, account);
    if (loginCheckpoint) {
      return {
        status: "checkpoint",
        accountId: account.id,
        checkpoint: { type: loginCheckpoint },
        slots: [],
        observedAt: new Date().toISOString(),
        screenshotPath: await captureEvidence(page, input.applicationId, input.jobId, loginCheckpoint),
        browserbaseReplayAvailable: Boolean(cloud.replayUrl),
      };
    }
    return await resultFromAuthenticatedPage(page, account, input.jobId, input.applicationId, Boolean(cloud.replayUrl));
  } finally {
    if (!keepSession) {
      await page.close().catch(() => undefined);
      await cloud.browser.close().catch(() => undefined);
    }
  }
}

export async function submitShenyangVfsOtp(jobId: string, code: string): Promise<ShenyangVfsResult> {
  assertConfigured();
  await sweepSessions();
  if (!/^\d{4,8}$/u.test(code)) throw new Error("The VFS verification code must contain 4 to 8 digits.");
  const session = otpSessions.get(jobId);
  if (!session || session.expiresAt <= Date.now()) {
    await closeSession(jobId);
    throw new Error("The official VFS verification session expired. Start a new official session.");
  }
  const { page, account } = session;
  try {
    const codeField = page.locator("input[autocomplete='one-time-code'], input[name*='otp' i], input[formcontrolname*='otp' i], input[placeholder*='code' i]").first();
    if (!await codeField.isVisible({ timeout: 2_000 }).catch(() => false)) {
      throw new Error("The official VFS verification-code field is no longer available.");
    }
    await codeField.fill(code);
    if (!await clickVisible(page, /verify|continue|submit|activate/i)) {
      throw new Error("The official VFS verification control is no longer available.");
    }
    await page.waitForTimeout(3_000);
    const text = await page.locator("body").innerText().catch(() => "");
    if (/invalid|incorrect|expired/i.test(text)) throw new Error("The official VFS verification code was rejected or expired.");
    await setAccountStatus(account, "registered", account.emailVerified);
    const loginCheckpoint = await login(page, account);
    if (loginCheckpoint) {
      return {
        status: "checkpoint",
        accountId: account.id,
        checkpoint: { type: loginCheckpoint },
        slots: [],
        observedAt: new Date().toISOString(),
        screenshotPath: await captureEvidence(page, session.applicationId, jobId, loginCheckpoint),
        browserbaseReplayAvailable: session.replayAvailable,
      };
    }
    return await resultFromAuthenticatedPage(page, account, jobId, session.applicationId, session.replayAvailable);
  } finally {
    await closeSession(jobId);
  }
}

async function fillApplicantDetails(page: Page, answers: Record<string, string>, account: PortalAccountContext): Promise<void> {
  const values: Array<[RegExp, string | undefined]> = [
    [/surname|family name|last name/i, answers.surname || answers.family_name],
    [/given name|first name/i, answers.given_names || answers.given_name],
    [/passport.*number/i, answers.passport_number],
    [/date of birth|birth date/i, answers.date_of_birth],
    [/passport.*expiry|expiry.*passport/i, answers.passport_expiry_date],
    [/^email|e-mail/i, account.email],
    [/mobile|phone/i, account.phone],
  ];
  for (const [label, value] of values) {
    if (!value) continue;
    const field = page.getByLabel(label).first();
    if (await field.isVisible({ timeout: 400 }).catch(() => false)) await field.fill(value);
  }
}

export async function bookShenyangVfsSlot(input: BookShenyangVfsInput): Promise<ShenyangVfsResult> {
  assertConfigured();
  if (!enabled(process.env.KR_KVAC_SHENYANG_VFS_LIVE_BOOKING_ENABLED)) {
    throw new Error("The Shenyang official VFS final-booking capability is not enabled.");
  }
  if (!input.selectedSlot.appointment_date || !input.selectedSlot.appointment_time) {
    throw new Error("A previously observed Shenyang VFS date and time are required.");
  }
  const account = await loadPortalAccount(input.applicationId);
  const cloud = await connectBrowserbaseCloudBrowser({ prefix: PREFIX });
  const { page } = cloud;
  try {
    const loginCheckpoint = await login(page, account);
    if (loginCheckpoint) {
      return {
        status: "checkpoint",
        accountId: account.id,
        checkpoint: { type: loginCheckpoint },
        slots: [],
        observedAt: new Date().toISOString(),
        screenshotPath: await captureEvidence(page, input.applicationId, input.jobId, loginCheckpoint),
        browserbaseReplayAvailable: Boolean(cloud.replayUrl),
      };
    }
    const calendarCheckpoint = await openCalendar(page);
    if (calendarCheckpoint) {
      return {
        status: "checkpoint",
        accountId: account.id,
        checkpoint: { type: calendarCheckpoint },
        slots: [],
        observedAt: new Date().toISOString(),
        screenshotPath: await captureEvidence(page, input.applicationId, input.jobId, calendarCheckpoint),
        browserbaseReplayAvailable: Boolean(cloud.replayUrl),
      };
    }
    const candidates = page.locator("[data-testid*='slot'], [data-slot-id], .appointment-slot, .slot, .time-slot, table tbody tr, button");
    let matched = false;
    for (let index = 0; index < Math.min(await candidates.count(), 250); index += 1) {
      const candidate = candidates.nth(index);
      const text = (await candidate.innerText().catch(() => "")).replace(/\s+/gu, " ");
      const date = toShenyangVfsIsoDate(text);
      const time = text.match(/\b([01]?\d|2[0-3]):[0-5]\d(?:\s?[AP]M)?\b/iu)?.[0]?.toUpperCase();
      if (date !== input.selectedSlot.appointment_date || time !== input.selectedSlot.appointment_time.toUpperCase()) continue;
      if (/unavailable|fully booked|closed|disabled/i.test(text)) continue;
      await candidate.click();
      matched = true;
      break;
    }
    if (!matched) {
      return {
        status: "checkpoint",
        accountId: account.id,
        checkpoint: { type: "no_slots" },
        slots: [],
        observedAt: new Date().toISOString(),
        screenshotPath: await captureEvidence(page, input.applicationId, input.jobId, "selected-slot-unavailable"),
        browserbaseReplayAvailable: Boolean(cloud.replayUrl),
      };
    }
    await clickVisible(page, /continue|next/i);
    await page.waitForTimeout(1_500);
    await fillApplicantDetails(page, await loadCanonicalAnswers(input.applicationId), account);
    await clickVisible(page, /continue|review|next/i);
    await page.waitForTimeout(1_500);
    const preSubmitText = await page.locator("body").innerText().catch(() => "");
    const checkpoint = checkpointFromText(preSubmitText);
    if (checkpoint) {
      return {
        status: "checkpoint",
        accountId: account.id,
        checkpoint: { type: checkpoint },
        slots: [],
        observedAt: new Date().toISOString(),
        screenshotPath: await captureEvidence(page, input.applicationId, input.jobId, checkpoint),
        browserbaseReplayAvailable: Boolean(cloud.replayUrl),
      };
    }
    if (/card number|cvv|service fee|pay now|payment/i.test(preSubmitText)) {
      return {
        status: "checkpoint",
        accountId: account.id,
        checkpoint: { type: "payment" },
        slots: [],
        observedAt: new Date().toISOString(),
        screenshotPath: await captureEvidence(page, input.applicationId, input.jobId, "payment"),
        browserbaseReplayAvailable: Boolean(cloud.replayUrl),
      };
    }
    if (!await clickVisible(page, /submit|confirm booking|book appointment|confirm appointment/i)) {
      return {
        status: "checkpoint",
        accountId: account.id,
        checkpoint: { type: "selector_drift" },
        slots: [],
        observedAt: new Date().toISOString(),
        screenshotPath: await captureEvidence(page, input.applicationId, input.jobId, "final-submit-selector-drift"),
        browserbaseReplayAvailable: Boolean(cloud.replayUrl),
      };
    }
    await page.waitForTimeout(4_000);
    const settledText = await page.locator("body").innerText().catch(() => "");
    const confirmationNumber = settledText.match(/(?:confirmation|appointment|booking|reference)\s*(?:number|no\.?|id)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{5,})/iu)?.[1];
    const screenshotPath = await captureEvidence(page, input.applicationId, input.jobId, "confirmation");
    if (!confirmationNumber || !screenshotPath) {
      return {
        status: "checkpoint",
        accountId: account.id,
        checkpoint: { type: "selector_drift" },
        slots: [],
        observedAt: new Date().toISOString(),
        screenshotPath,
        browserbaseReplayAvailable: Boolean(cloud.replayUrl),
      };
    }
    return {
      status: "appointment_booked",
      accountId: account.id,
      slots: [],
      observedAt: new Date().toISOString(),
      screenshotPath,
      browserbaseReplayAvailable: Boolean(cloud.replayUrl),
      confirmation: {
        confirmationNumber,
        appointmentDate: input.selectedSlot.appointment_date,
        appointmentTime: input.selectedSlot.appointment_time,
        appointmentLocation: input.selectedSlot.appointment_location || "Korea Visa Application Center Shenyang",
        confirmationPdfUrl: null,
      },
    };
  } finally {
    await page.close().catch(() => undefined);
    await cloud.browser.close().catch(() => undefined);
  }
}

export { LOGIN_URL as SHENYANG_VFS_LOGIN_URL, REGISTER_URL as SHENYANG_VFS_REGISTER_URL };
export type { ShenyangVfsSlot } from "./slots.js";
