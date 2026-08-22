import { randomInt } from "node:crypto";
import type { Browser, Locator, Page } from "playwright";
import { browserbaseEnabled, connectBrowserbaseCloudBrowser } from "../browserbase-session.js";
import { ensureApplicantInboxAlias } from "../inbox/alias.js";
import { extractAuto } from "../inbox/extractors/index.js";
import { hasAliasEmailForwardingConsent } from "../inbox/forwarding-consent.js";
import { inbox } from "../inbox/wait-for-message.js";
import { decryptSecret, encryptSecret } from "../secret-cipher.js";
import { supabase } from "../supabase.js";
import {
  extractShenyangVfsSlotsFromTexts,
  toShenyangVfsIsoDate,
  type ShenyangVfsSlot,
} from "./slots.js";
import {
  buildShenyangUniversalProfileAnswers,
  requireShenyangVfsApplicantDetailsFromSourceLayers,
  type ShenyangUniversalProfileAnswerRow,
  type ShenyangVfsApplicantDetails,
} from "./applicant-details.js";

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

const SHENYANG_VFS_PASSWORD_SPECIALS = "$@#!%*?";
const SHENYANG_VFS_PASSWORD_MIN_LENGTH = 8;
const SHENYANG_VFS_PASSWORD_MAX_LENGTH = 15;
const SHENYANG_VFS_PASSWORD_LENGTH = 12;
const SHENYANG_VFS_PRE_REGISTRATION_STATUSES = new Set([
  "account_prepared",
  "alias_prepared",
  "selector_drift",
]);

export function isShenyangVfsPasswordCompliant(value: string): boolean {
  return value.length >= SHENYANG_VFS_PASSWORD_MIN_LENGTH
    && value.length <= SHENYANG_VFS_PASSWORD_MAX_LENGTH
    && /^[A-Za-z0-9$@#!%*?]+$/u.test(value)
    && /[A-Z]/u.test(value)
    && /[a-z]/u.test(value)
    && /\d/u.test(value)
    && /[$@#!%*?]/u.test(value);
}

export function generateShenyangVfsPassword(): string {
  const groups = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789", SHENYANG_VFS_PASSWORD_SPECIALS];
  const all = groups.join("");
  const chars = groups.map((group) => group[randomInt(group.length)]);
  while (chars.length < SHENYANG_VFS_PASSWORD_LENGTH) chars.push(all[randomInt(all.length)]);
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swapWith = randomInt(index + 1);
    [chars[index], chars[swapWith]] = [chars[swapWith], chars[index]];
  }
  return chars.join("");
}

export function shouldRotateShenyangVfsPassword(
  accountStatus: string | null | undefined,
  emailVerified: boolean,
  password: string,
): boolean {
  return !emailVerified
    && SHENYANG_VFS_PRE_REGISTRATION_STATUSES.has(accountStatus ?? "")
    && !isShenyangVfsPasswordCompliant(password);
}

export interface ShenyangVfsPasswordStateInput {
  password: string | null;
  accountStatus: string;
  emailVerified: boolean;
}

export interface ShenyangVfsPasswordState {
  password: string;
  accountStatus: string;
  rotated: boolean;
}

export function resolveShenyangVfsPasswordState(
  input: ShenyangVfsPasswordStateInput,
): ShenyangVfsPasswordState {
  const rotated = input.password !== null
    && shouldRotateShenyangVfsPassword(input.accountStatus, input.emailVerified, input.password);
  const password = input.password === null || rotated
    ? generateShenyangVfsPassword()
    : input.password;
  const shouldResetForRegistrationRetry = input.accountStatus === "selector_drift" && !input.emailVerified;
  return {
    password,
    accountStatus: shouldResetForRegistrationRetry
      ? "account_prepared"
      : input.accountStatus,
    rotated,
  };
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

async function loadPortalAccount(applicationId: string, mobilePhone: string): Promise<PortalAccountContext> {
  const { data: application, error } = await supabase
    .from("applications")
    .select("applicant_id,applicant_profiles!inner(auth_user_id,inbox_alias)")
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
  const profile = profileValue as { auth_user_id?: string; inbox_alias?: string };
  if (!profile.auth_user_id) {
    throw new Error("The Shenyang VFS account requires a saved applicant account.");
  }
  const alias = profile.inbox_alias || (await ensureApplicantInboxAlias(application.applicant_id)).alias;
  const phone = mainlandPhone(mobilePhone);
  const { data: existing, error: accountError } = await supabase
    .from("appointment_accounts")
    .select("*")
    .eq("application_id", applicationId)
    .eq("portal", "vfs_korea_shenyang")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (accountError) throw new Error("The Shenyang VFS account state could not be read.");

  const existingPassword = existing?.encrypted_account_password
    ? decryptSecret(existing.encrypted_account_password)
    : null;
  const passwordState = resolveShenyangVfsPasswordState({
    password: existingPassword,
    accountStatus: existing?.account_status ?? "account_prepared",
    emailVerified: Boolean(existing?.email_verified),
  });
  const password = passwordState.password;
  const now = new Date().toISOString();
  const payload = {
    user_id: profile.auth_user_id,
    application_id: applicationId,
    country_code: "KR",
    portal: "vfs_korea_shenyang",
    account_email: alias,
    encrypted_account_password: encryptSecret(password),
    account_status: passwordState.accountStatus,
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

function isMissingShenyangUniversalProfileSchemaError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown };
  const code = typeof candidate.code === "string" ? candidate.code : "";
  const message = typeof candidate.message === "string" ? candidate.message.toLowerCase() : "";
  if (code === "PGRST204" || code === "PGRST205") return true;
  const schemaMissing = message.includes("schema cache")
    || message.includes("does not exist")
    || message.includes("relation");
  return schemaMissing && message.includes("universal_profile_answers");
}

async function loadRequiredShenyangVfsApplicantDetails(
  applicationId: string,
): Promise<ShenyangVfsApplicantDetails> {
  const { data: application, error: applicationError } = await supabase
    .from("applications")
    .select("applicant_id")
    .eq("id", applicationId)
    .single();
  if (applicationError || !application?.applicant_id) {
    throw new Error("The Shenyang VFS applicant details could not be read.");
  }

  const [{ data: profile, error: profileError }, { data: answerRows, error: answerError }] = await Promise.all([
    supabase
      .from("applicant_profiles")
      .select("full_name,date_of_birth,passport_number,passport_expiry_date,phone")
      .eq("id", application.applicant_id)
      .maybeSingle(),
    supabase
      .from("visa_application_answers")
      .select("field_name,value_text")
      .eq("application_id", applicationId),
  ]);
  if (profileError || answerError) {
    throw new Error("The Shenyang VFS applicant details could not be read.");
  }

  const applicationAnswers: Record<string, string> = {};
  for (const row of answerRows ?? []) {
    if (row.value_text != null) applicationAnswers[row.field_name] = String(row.value_text);
  }

  const profileAnswers: Record<string, string> = {};
  const profileRecord = profile as {
    full_name?: string | null;
    date_of_birth?: string | null;
    passport_number?: string | null;
    passport_expiry_date?: string | null;
    phone?: string | null;
  } | null;
  const fullName = String(profileRecord?.full_name ?? "").trim();
  if (fullName) {
    const parts = fullName.split(/\s+/u);
    profileAnswers.given_names = parts.slice(0, -1).join(" ") || fullName;
    profileAnswers.surname = parts.length > 1 ? parts[parts.length - 1] : "";
  }
  const profileFields: Array<[string, string | null | undefined]> = [
    ["date_of_birth", profileRecord?.date_of_birth],
    ["passport_number", profileRecord?.passport_number],
    ["passport_expiry_date", profileRecord?.passport_expiry_date],
    ["mobile_phone", profileRecord?.phone],
  ];
  for (const [field, value] of profileFields) {
    if (value != null && value !== "") profileAnswers[field] = String(value);
  }

  let reusableRows: ShenyangUniversalProfileAnswerRow[] = [];
  try {
    const reusableResult = await supabase
      .from("universal_profile_answers")
      .select("canonical_key,value_text,updated_at")
      .eq("applicant_id", application.applicant_id)
      .order("updated_at", { ascending: false });
    if (reusableResult.error) {
      if (!isMissingShenyangUniversalProfileSchemaError(reusableResult.error)) {
        throw new Error("The Shenyang VFS applicant details could not be read.");
      }
    } else {
      reusableRows = (reusableResult.data ?? []) as ShenyangUniversalProfileAnswerRow[];
    }
  } catch (error) {
    if (isMissingShenyangUniversalProfileSchemaError(error)) {
      reusableRows = [];
    } else {
      if (error instanceof Error && error.message === "The Shenyang VFS applicant details could not be read.") throw error;
      throw new Error("The Shenyang VFS applicant details could not be read.");
    }
  }

  const reusableAnswers = buildShenyangUniversalProfileAnswers(reusableRows);
  return requireShenyangVfsApplicantDetailsFromSourceLayers(
    applicationAnswers,
    reusableAnswers,
    profileAnswers,
  );
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

const SHENYANG_VFS_COOKIE_ERROR = "The official VFS cookie consent could not be dismissed.";
const SHENYANG_VFS_COOKIE_OVERLAY_SELECTOR = ".onetrust-pc-dark-filter, #onetrust-banner-sdk, #onetrust-consent-sdk";

export interface ShenyangVfsCookieDismissOptions {
  timeoutMs?: number;
  pollIntervalMs?: number;
}

const SHENYANG_VFS_COOKIE_TIMEOUT_MS = 10_000;
const SHENYANG_VFS_COOKIE_POLL_INTERVAL_MS = 200;

async function shenyangVfsCookieOverlayVisible(page: Page, timeoutMs: number): Promise<boolean> {
  let overlays: ReturnType<Page["locator"]>;
  try {
    overlays = page.locator(SHENYANG_VFS_COOKIE_OVERLAY_SELECTOR);
  } catch {
    return false;
  }
  const count = await overlays.count().catch(() => 0);
  for (let index = 0; index < Math.min(count, 10); index += 1) {
    if (await overlays.nth(index).isVisible({ timeout: Math.min(400, Math.max(1, timeoutMs)) }).catch(() => false)) {
      return true;
    }
  }
  return false;
}

async function clickShenyangVfsCookieButton(page: Page, labels: RegExp, timeoutMs: number): Promise<boolean> {
  let buttons: ReturnType<Page["getByRole"]>;
  try {
    buttons = page.getByRole("button", { name: labels });
  } catch {
    return false;
  }
  const count = await buttons.count().catch(() => 0);
  for (let index = 0; index < Math.min(count, 10); index += 1) {
    const button = buttons.nth(index);
    if (!await button.isVisible({ timeout: Math.min(400, Math.max(1, timeoutMs)) }).catch(() => false)) continue;
    if (await button.click({ timeout: Math.min(5_000, Math.max(1, timeoutMs)) }).then(() => true).catch(() => false)) return true;
  }
  return false;
}

export async function dismissShenyangVfsCookies(
  page: Page,
  options: ShenyangVfsCookieDismissOptions = {},
): Promise<void> {
  const timeoutMs = positivePollingValue(options.timeoutMs, SHENYANG_VFS_COOKIE_TIMEOUT_MS);
  const pollIntervalMs = positivePollingValue(options.pollIntervalMs, SHENYANG_VFS_COOKIE_POLL_INTERVAL_MS);
  const deadline = Date.now() + timeoutMs;
  const rejectLabels = /accept only necessary|reject all|only necessary/i;
  const acceptAllLabels = /accept all|allow all/i;

  while (Date.now() < deadline) {
    const remainingMs = deadline - Date.now();
    if (!await shenyangVfsCookieOverlayVisible(page, remainingMs)) return;
    if (await clickShenyangVfsCookieButton(page, rejectLabels, remainingMs)
      || await clickShenyangVfsCookieButton(page, acceptAllLabels, remainingMs)) {
      while (Date.now() < deadline) {
        const closeRemainingMs = deadline - Date.now();
        if (!await shenyangVfsCookieOverlayVisible(page, closeRemainingMs)) return;
        await new Promise<void>((resolve) => {
          setTimeout(resolve, Math.min(pollIntervalMs, closeRemainingMs));
        });
      }
      throw new Error(SHENYANG_VFS_COOKIE_ERROR);
    }
    const nextRemainingMs = deadline - Date.now();
    if (nextRemainingMs <= 0) break;
    await new Promise<void>((resolve) => {
      setTimeout(resolve, Math.min(pollIntervalMs, nextRemainingMs));
    });
  }
  if (await shenyangVfsCookieOverlayVisible(page, 1)) throw new Error(SHENYANG_VFS_COOKIE_ERROR);
}

async function dismissCookies(page: Page): Promise<void> {
  await dismissShenyangVfsCookies(page);
}

const SHENYANG_VFS_MOBILE_FIELD_ERROR = "The official VFS mobile-number field could not be identified.";

export interface ShenyangVfsMobileFieldPollingOptions {
  timeoutMs?: number;
  pollIntervalMs?: number;
}

const SHENYANG_VFS_MOBILE_FIELD_TIMEOUT_MS = 10_000;
const SHENYANG_VFS_MOBILE_FIELD_POLL_INTERVAL_MS = 200;

function positivePollingValue(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

export async function fillShenyangVfsRegistrationMobileField(
  page: Page,
  phone: string,
  options: ShenyangVfsMobileFieldPollingOptions = {},
): Promise<void> {
  const selectors = [
    "input[formcontrolname='contact']",
    "input[formcontrolname*='mobile' i]",
    "input[formcontrolname*='phone' i]",
    "input[aria-label*='mobile' i]",
    "input[aria-label*='phone' i]",
    "input[aria-label*='telephone' i]",
    "input[placeholder*='mobile' i]",
    "input[placeholder*='phone' i]",
    "input[placeholder*='telephone' i]",
    "input[name*='mobile' i]",
    "input[name*='phone' i]",
    "input[name*='telephone' i]",
    "input[type='tel']",
    "input.iti__tel-input",
    ".intl-tel-input input",
    "[class*='intl-tel-input' i] input",
  ];
  const timeoutMs = positivePollingValue(options.timeoutMs, SHENYANG_VFS_MOBILE_FIELD_TIMEOUT_MS);
  const pollIntervalMs = positivePollingValue(options.pollIntervalMs, SHENYANG_VFS_MOBILE_FIELD_POLL_INTERVAL_MS);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    for (const selector of selectors) {
      let fields: ReturnType<Page["locator"]>;
      try {
        fields = page.locator(selector);
      } catch {
        continue;
      }
      const count = await fields.count().catch(() => 0);
      for (let index = 0; index < Math.min(count, 25); index += 1) {
        const remainingMs = deadline - Date.now();
        if (remainingMs <= 0) break;
        const field = fields.nth(index);
        if (!await field.isVisible({ timeout: Math.min(400, remainingMs) }).catch(() => false)) continue;
        try {
          await field.fill(phone);
        } catch {
          throw new Error(SHENYANG_VFS_MOBILE_FIELD_ERROR);
        }
        return;
      }
    }
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) break;
    await new Promise<void>((resolve) => {
      setTimeout(resolve, Math.min(pollIntervalMs, remainingMs));
    });
  }
  throw new Error(SHENYANG_VFS_MOBILE_FIELD_ERROR);
}

const SHENYANG_VFS_DIAL_CODE_ERROR = "The official VFS China dial-code control could not be identified or selected.";
const SHENYANG_VFS_DIAL_CODE_TIMEOUT_MS = 10_000;
const SHENYANG_VFS_DIAL_CODE_POLL_INTERVAL_MS = 200;
const SHENYANG_VFS_DIAL_CODE_SELECTORS = [
  "mat-select[formcontrolname='dialcode']",
  "[role='combobox'][formcontrolname='dialcode']",
  "select[formcontrolname='dialcode']",
  "mat-select[formcontrolname='countryCode']",
  "[role='combobox'][formcontrolname='countryCode']",
  "select[formcontrolname='countryCode']",
  "mat-select[formcontrolname*='country' i]",
  "[role='combobox'][formcontrolname*='country' i]",
  "select[formcontrolname*='country' i]",
  "mat-select[formcontrolname*='dial' i]",
  "[role='combobox'][formcontrolname*='dial' i]",
  "select[formcontrolname*='dial' i]",
  "mat-select[formcontrolname*='phone' i]",
  "[role='combobox'][formcontrolname*='phone' i]",
  "select[formcontrolname*='phone' i]",
  "mat-select[aria-label*='country code' i]",
  "[role='combobox'][aria-label*='country code' i]",
  "select[aria-label*='country code' i]",
  "mat-select[aria-label*='dial' i]",
  "[role='combobox'][aria-label*='dial' i]",
  "select[aria-label*='dial' i]",
];
const SHENYANG_VFS_DIAL_CODE_LABELS = [
  /country\s*code/i,
  /dial(?:ling|ing)?\s*code/i,
  /phone\s*(?:country|dial(?:ling|ing)?)?\s*code/i,
  /mobile\s*(?:country|dial(?:ling|ing)?)?\s*code/i,
];

export interface ShenyangVfsDialCodePollingOptions {
  timeoutMs?: number;
  pollIntervalMs?: number;
}

function isShenyangChinaDialCodeText(text: string): boolean {
  const normalized = text.replace(/\s+/gu, " ").trim();
  return /(?:china|中国)/iu.test(normalized) && /\+?86\b/u.test(normalized);
}

async function readVisibleShenyangLocatorText(locator: Locator): Promise<string> {
  return locator.innerText({ timeout: 400 }).catch(() => "");
}

async function waitForShenyangSelectedDialCode(
  locator: Locator,
  tagName: string,
  deadline: number,
  pollIntervalMs: number,
): Promise<boolean> {
  const selected = tagName === "select" ? locator.locator("option:checked").first() : locator;
  while (Date.now() < deadline) {
    if (isShenyangChinaDialCodeText(await readVisibleShenyangLocatorText(selected))) return true;
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) break;
    await new Promise<void>((resolve) => {
      setTimeout(resolve, Math.min(pollIntervalMs, remainingMs));
    });
  }
  return false;
}

async function selectChinaDialCodeFromControl(
  page: Page,
  control: Locator,
  deadline: number,
  pollIntervalMs: number,
): Promise<boolean> {
  const remainingMs = deadline - Date.now();
  if (remainingMs <= 0 || !await control.isVisible({ timeout: Math.min(400, remainingMs) }).catch(() => false)) return false;
  const tagName = await control.evaluate((element) => element.tagName.toLowerCase()).catch(() => "");
  if (tagName === "select") {
    const options = control.locator("option");
    const count = await options.count().catch(() => 0);
    for (let index = 0; index < Math.min(count, 100); index += 1) {
      const option = options.nth(index);
      const text = await readVisibleShenyangLocatorText(option);
      if (!isShenyangChinaDialCodeText(text)) continue;
      const value = await option.getAttribute("value").catch(() => null);
      try {
        await control.selectOption(value ?? { label: text });
      } catch {
        return false;
      }
      return await waitForShenyangSelectedDialCode(control, tagName, deadline, pollIntervalMs);
    }
    return false;
  }
  await dismissShenyangVfsCookies(page, {
    timeoutMs: Math.min(SHENYANG_VFS_COOKIE_TIMEOUT_MS, Math.max(1, deadline - Date.now())),
    pollIntervalMs,
  });
  const clickRemainingMs = deadline - Date.now();
  if (clickRemainingMs <= 0) return false;
  try {
    await control.click({ timeout: Math.min(5_000, Math.max(1, clickRemainingMs)) });
  } catch {
    return false;
  }
  let optionCollections: Locator[];
  try {
    optionCollections = [page.getByRole("option"), page.locator("mat-option")];
  } catch {
    return false;
  }
  for (const options of optionCollections) {
    const count = await options.count().catch(() => 0);
    for (let index = 0; index < Math.min(count, 100); index += 1) {
      const option = options.nth(index);
      if (!await option.isVisible({ timeout: Math.min(400, Math.max(1, deadline - Date.now())) }).catch(() => false)) continue;
      if (!isShenyangChinaDialCodeText(await readVisibleShenyangLocatorText(option))) continue;
      try {
        await option.click({ timeout: Math.min(5_000, Math.max(1, deadline - Date.now())) });
      } catch {
        return false;
      }
      return await waitForShenyangSelectedDialCode(control, tagName, deadline, pollIntervalMs);
    }
  }
  return false;
}

export async function selectShenyangVfsRegistrationDialCode(
  page: Page,
  options: ShenyangVfsDialCodePollingOptions = {},
): Promise<void> {
  const timeoutMs = positivePollingValue(options.timeoutMs, SHENYANG_VFS_DIAL_CODE_TIMEOUT_MS);
  const pollIntervalMs = positivePollingValue(options.pollIntervalMs, SHENYANG_VFS_DIAL_CODE_POLL_INTERVAL_MS);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const selector of SHENYANG_VFS_DIAL_CODE_SELECTORS) {
      let controls: Locator;
      try {
        controls = page.locator(selector);
      } catch {
        continue;
      }
      const count = await controls.count().catch(() => 0);
      for (let index = 0; index < Math.min(count, 25); index += 1) {
        if (await selectChinaDialCodeFromControl(page, controls.nth(index), deadline, pollIntervalMs)) return;
      }
    }
    for (const label of SHENYANG_VFS_DIAL_CODE_LABELS) {
      let controls: Locator;
      try {
        controls = page.getByLabel(label);
      } catch {
        continue;
      }
      const count = await controls.count().catch(() => 0);
      for (let index = 0; index < Math.min(count, 25); index += 1) {
        if (await selectChinaDialCodeFromControl(page, controls.nth(index), deadline, pollIntervalMs)) return;
      }
    }
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) break;
    await new Promise<void>((resolve) => {
      setTimeout(resolve, Math.min(pollIntervalMs, remainingMs));
    });
  }
  throw new Error(SHENYANG_VFS_DIAL_CODE_ERROR);
}

async function fillRegistration(page: Page, account: PortalAccountContext): Promise<void> {
  const email = page.locator("#inputEmail").or(page.getByLabel(/^email\*?$/i)).first();
  const password = page.locator("#password").or(page.getByLabel(/^password\*?$/i)).first();
  const confirmation = page.locator("#confirmPassword").or(page.getByLabel(/confirm password/i)).first();
  await email.fill(account.email);
  await password.fill(account.password);
  await confirmation.fill(account.password);

  await selectShenyangVfsRegistrationDialCode(page);
  await fillShenyangVfsRegistrationMobileField(page, account.phone);

  await fillShenyangVfsRegistrationConsents(page);
}

export async function fillShenyangVfsRegistrationConsents(page: Page): Promise<void> {
  const requiredConsents = page.locator("form input[type='checkbox'], main input[type='checkbox']");
  const count = await requiredConsents.count();
  if (count < 1) throw new Error("The official VFS required-consent controls could not be identified.");
  await dismissCookies(page);
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
  const applicantDetails = await loadRequiredShenyangVfsApplicantDetails(input.applicationId);
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
  const account = await loadPortalAccount(input.applicationId, applicantDetails.mobilePhone);
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

export interface ShenyangApplicantFieldMatch {
  isVisible(options?: { timeout?: number }): Promise<boolean>;
  fill(value: string): Promise<void>;
}

export interface ShenyangApplicantFieldCollection {
  count(): Promise<number>;
  nth(index: number): ShenyangApplicantFieldMatch;
}

export class ShenyangApplicantDetailsSelectorError extends Error {
  constructor() {
    super("The official Shenyang VFS applicant detail fields could not be identified.");
    this.name = "ShenyangApplicantDetailsSelectorError";
  }
}

export async function fillFirstVisibleShenyangApplicantField(
  fields: ShenyangApplicantFieldCollection,
  value: string,
): Promise<void> {
  let count: number;
  try {
    count = await fields.count();
  } catch {
    throw new ShenyangApplicantDetailsSelectorError();
  }
  for (let index = 0; index < Math.min(count, 25); index += 1) {
    let field: ShenyangApplicantFieldMatch;
    try {
      field = fields.nth(index);
    } catch {
      throw new ShenyangApplicantDetailsSelectorError();
    }
    if (!await field.isVisible({ timeout: 400 }).catch(() => false)) continue;
    try {
      await field.fill(value);
    } catch {
      throw new ShenyangApplicantDetailsSelectorError();
    }
    return;
  }
  throw new ShenyangApplicantDetailsSelectorError();
}

async function fillRequiredApplicantField(page: Page, label: RegExp, value: string): Promise<void> {
  let fields: ShenyangApplicantFieldCollection;
  try {
    fields = page.getByLabel(label);
  } catch {
    throw new ShenyangApplicantDetailsSelectorError();
  }
  await fillFirstVisibleShenyangApplicantField(fields, value);
}

async function fillApplicantDetails(
  page: Page,
  details: ShenyangVfsApplicantDetails,
  account: PortalAccountContext,
): Promise<void> {
  const values: Array<[RegExp, string]> = [
    [/surname|family name|last name/i, details.surname],
    [/given name|first name/i, details.givenNames],
    [/passport.*number|travel document number/i, details.passportNumber],
    [/date of birth|birth date|birthday/i, details.dateOfBirth],
    [/passport.*expiry|passport.*expiration|expiry.*passport|valid until/i, details.passportExpiryDate],
    [/^email|e-mail/i, account.email],
    [/mobile|phone/i, account.phone],
  ];
  for (const [label, value] of values) {
    await fillRequiredApplicantField(page, label, value);
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
  const applicantDetails = await loadRequiredShenyangVfsApplicantDetails(input.applicationId);
  const account = await loadPortalAccount(input.applicationId, applicantDetails.mobilePhone);
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
    try {
      await fillApplicantDetails(page, applicantDetails, account);
    } catch (error) {
      if (!(error instanceof ShenyangApplicantDetailsSelectorError)) throw error;
      return {
        status: "checkpoint",
        accountId: account.id,
        checkpoint: { type: "selector_drift" },
        slots: [],
        observedAt: new Date().toISOString(),
        screenshotPath: await captureEvidence(page, input.applicationId, input.jobId, "applicant-details-selector-drift"),
        browserbaseReplayAvailable: Boolean(cloud.replayUrl),
      };
    }
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
