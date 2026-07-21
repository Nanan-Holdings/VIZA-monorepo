import { randomBytes, randomInt } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { Locator, Page } from "@playwright/test";
import { redactOfficialUrl } from "../appointment-free-smoke";
import { solveCaptcha } from "../captcha/two-captcha";
import { ensureApplicantInboxAlias } from "../inbox/alias";
import { decryptSecret, encryptSecret } from "../secret-cipher";
import { supabase } from "../supabase";
import {
  isFranceTlsActivationRequiredText,
  isFranceTlsActivationExpiredText,
  waitForFranceTlsActivationEmail,
} from "./activation";
import {
  classifyFranceTlsBrowserState,
  createFranceTlsBrowserSession,
  isFranceTlsCaptchaBlocking,
  readFranceTlsBrowserState,
  waitForFranceTlsCloudflareClearance,
} from "./browser-api";
import { resolveFranceTlsCenter } from "./center-registry";

const TLS_PORTAL = "tlscontact_cn_fr";
const DB_TIMEOUT_MS = 15_000;

type Relation = Record<string, unknown>;

export type FranceTlsAccountRegistrationStatus =
  | "registration_form_ready"
  | "activation_email_pending"
  | "account_activated"
  | "logged_in"
  | "appointment_reference_filled"
  | "manual_required";

export interface FranceTlsAccountRegistrationInput {
  applicationId: string;
  centerCode: string;
  submitRegistration: boolean;
  fillOfficialReference?: boolean;
  emailTimeoutMs?: number;
  refreshRetries?: number;
}

export interface FranceTlsAccountRegistrationResult {
  status: FranceTlsAccountRegistrationStatus;
  accountId: string;
  provider: string;
  centerCode: string;
  finalUrl: string;
  replayUrl: null;
  evidence: string[];
  checkpoint?: {
    type: string;
    message: string;
    missingFields?: string[];
  };
  stopPoint: string;
}

export interface FranceTlsStoredAccountContext {
  applicationId: string;
  applicantId: string;
  userId: string;
  alias: string;
  accountId: string;
  password: string;
  accountStatus: string;
  statusUpdatedAt: string;
  emailVerified: boolean;
  officialReference: string | null;
  applicantProfile: FranceTlsApplicantProfile;
}

export interface FranceTlsApplicantProfile {
  surname: string | null;
  givenNames: string | null;
  dateOfBirth: string | null;
  gender: "male" | "female" | "other" | null;
  passportNumber: string | null;
  phoneCountryCode: string | null;
  phoneNumber: string | null;
  purposeOfJourney: string | null;
  departureFromOriginDate: string | null;
  arrivalInSchengenDate: string | null;
  departureFromSchengenDate: string | null;
  visitsFrenchOverseasTerritories: boolean | null;
  previousSchengenFingerprints: boolean | null;
  schengenVisaWithinFiveYears: boolean | null;
}

function firstRelation(value: unknown): Relation | null {
  if (Array.isArray(value)) return firstRelation(value[0]);
  return value && typeof value === "object" ? value as Relation : null;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is missing`);
  return value.trim();
}

function optionalString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function normalizeYesNo(value: unknown): boolean | null {
  const normalized = optionalString(value)?.toLowerCase();
  if (["yes", "y", "true", "1"].includes(normalized ?? "")) return true;
  if (["no", "n", "false", "0"].includes(normalized ?? "")) return false;
  return null;
}

function normalizeGender(value: unknown): FranceTlsApplicantProfile["gender"] {
  const normalized = optionalString(value)?.toLowerCase();
  if (["male", "m"].includes(normalized ?? "")) return "male";
  if (["female", "f"].includes(normalized ?? "")) return "female";
  if (["other", "x", "unspecified"].includes(normalized ?? "")) return "other";
  return null;
}

export function normalizeFranceTlsPhone(value: unknown): {
  countryCode: string | null;
  number: string | null;
} {
  const raw = optionalString(value);
  if (!raw) return { countryCode: null, number: null };
  const compact = raw.replace(/[\s().-]/g, "");
  if (/^\+86\d{11}$/.test(compact)) {
    return { countryCode: "+86", number: compact.slice(3) };
  }
  if (/^1\d{10}$/.test(compact)) {
    return { countryCode: "+86", number: compact };
  }
  return { countryCode: null, number: null };
}

function answerRecord(rows: Array<Record<string, unknown>> | null): Record<string, unknown> {
  const answers: Record<string, unknown> = {};
  for (const row of rows ?? []) {
    const name = optionalString(row.field_name);
    if (!name) continue;
    answers[name] = row.value_text ?? row.value_json ?? null;
  }
  return answers;
}

function firstAnswer(answers: Record<string, unknown>, names: string[]): string | null {
  for (const name of names) {
    const value = optionalString(answers[name]);
    if (value) return value;
  }
  return null;
}

function dbAbortSignal(): AbortSignal {
  return AbortSignal.timeout(DB_TIMEOUT_MS);
}

export function generateFranceTlsAccountPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%^&*_-+=?";
  const all = upper + lower + digits + special;
  const characters = [
    upper[randomInt(upper.length)],
    lower[randomInt(lower.length)],
    digits[randomInt(digits.length)],
    special[randomInt(special.length)],
  ];
  while (characters.length < 16) characters.push(all[randomInt(all.length)]);
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swap = randomInt(index + 1);
    [characters[index], characters[swap]] = [characters[swap], characters[index]];
  }
  return characters.join("");
}

async function persistAccount(input: {
  id?: string;
  applicationId: string;
  userId: string;
  alias: string;
  password: string;
  status: string;
  emailVerified: boolean;
}): Promise<string> {
  const now = new Date().toISOString();
  const payload = {
    user_id: input.userId,
    application_id: input.applicationId,
    country_code: "FR",
    portal: TLS_PORTAL,
    account_email: input.alias,
    encrypted_account_password: encryptSecret(input.password),
    account_status: input.status,
    email_verified: input.emailVerified,
    metadata_redacted_json: {
      created_by: "france_tls_account_registration",
      alias_managed_by_viza: true,
      account_email: "[REDACTED]",
    },
    updated_at: now,
  };
  if (input.id) {
    const { error } = await supabase
      .from("appointment_accounts")
      .update(payload)
      .eq("id", input.id)
      .abortSignal(dbAbortSignal());
    if (error) throw new Error(`TLS account update failed: ${error.message}`);
    return input.id;
  }
  const { data, error } = await supabase
    .from("appointment_accounts")
    .insert({ ...payload, created_at: now })
    .select("id")
    .abortSignal(dbAbortSignal())
    .single();
  if (error || !data?.id) throw new Error(`TLS account insert failed: ${error?.message ?? "missing id"}`);
  return data.id;
}

async function updateAccountStatus(
  context: FranceTlsStoredAccountContext,
  status: string,
  emailVerified = context.emailVerified,
): Promise<void> {
  const { error } = await supabase
    .from("appointment_accounts")
    .update({
      account_status: status,
      email_verified: emailVerified,
      last_login_at: status === "logged_in" || status === "appointment_reference_filled"
        ? new Date().toISOString()
        : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", context.accountId)
    .abortSignal(dbAbortSignal());
  if (error) throw new Error(`TLS account status update failed: ${error.message}`);
  context.accountStatus = status;
  context.statusUpdatedAt = new Date().toISOString();
  context.emailVerified = emailVerified;
}

async function loadRegistrationContext(
  applicationId: string,
  requireOfficialReference: boolean,
): Promise<FranceTlsStoredAccountContext> {
  const { data: application, error: applicationError } = await supabase
    .from("applications")
    .select("id,applicant_id,country,arrival_date,departure_date,purpose,applicant_profiles!inner(auth_user_id,inbox_alias,surname_en,surname,given_names_en,given_names,date_of_birth,gender,passport_number,phone)")
    .eq("id", applicationId)
    .abortSignal(dbAbortSignal())
    .maybeSingle();
  if (applicationError) throw new Error(`France application lookup failed: ${applicationError.message}`);
  if (!application) throw new Error("France application not found");
  if (String(application.country ?? "").toLowerCase() !== "france") {
    throw new Error("The selected application is not a France application");
  }
  const applicantId = requireString(application.applicant_id, "applications.applicant_id");
  const profile = firstRelation(application.applicant_profiles);
  const userId = requireString(profile?.auth_user_id, "applicant_profiles.auth_user_id");
  const existingAlias = typeof profile?.inbox_alias === "string" ? profile.inbox_alias.trim().toLowerCase() : "";
  const aliasResult = existingAlias
    ? { alias: existingAlias, created: false }
    : await ensureApplicantInboxAlias(applicantId);

  const [
    { data: account, error: accountError },
    { data: queueRow, error: queueError },
    { data: answerRows, error: answersError },
  ] =
    await Promise.all([
      supabase
        .from("appointment_accounts")
        .select("id,account_email,encrypted_account_password,account_status,email_verified,updated_at")
        .eq("application_id", applicationId)
        .eq("portal", TLS_PORTAL)
        .order("updated_at", { ascending: false })
        .limit(1)
        .abortSignal(dbAbortSignal())
        .maybeSingle(),
      supabase
        .from("submission_queue")
        .select("official_application_reference_encrypted")
        .eq("application_id", applicationId)
        .not("official_application_reference_encrypted", "is", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .abortSignal(dbAbortSignal())
        .maybeSingle(),
      supabase
        .from("visa_application_answers")
        .select("field_name,value_text,value_json")
        .eq("application_id", applicationId)
        .abortSignal(dbAbortSignal()),
    ]);
  if (accountError) throw new Error(`TLS account lookup failed: ${accountError.message}`);
  if (queueError) throw new Error(`France official reference lookup failed: ${queueError.message}`);
  if (answersError) throw new Error(`France appointment answer lookup failed: ${answersError.message}`);
  if (account?.account_email && account.account_email.toLowerCase() !== aliasResult.alias) {
    throw new Error("Existing TLS account alias does not match the applicant alias");
  }
  const officialReferenceEncrypted = queueRow?.official_application_reference_encrypted;
  if (requireOfficialReference && !officialReferenceEncrypted) {
    throw new Error("submission_queue.official_application_reference_encrypted is missing");
  }
  const password = account?.encrypted_account_password
    ? decryptSecret(account.encrypted_account_password)
    : generateFranceTlsAccountPassword();
  const accountId = await persistAccount({
    id: account?.id,
    applicationId,
    userId,
    alias: aliasResult.alias,
    password,
    status: account?.account_status ?? "account_prepared",
    emailVerified: Boolean(account?.email_verified),
  });
  const { error: linkError } = await supabase
    .from("appointment_assistance_jobs")
    .update({ appointment_account_id: accountId, updated_at: new Date().toISOString() })
    .eq("application_id", applicationId)
    .eq("country_code", "FR")
    .eq("scheduling_provider", TLS_PORTAL)
    .abortSignal(dbAbortSignal());
  if (linkError) throw new Error(`TLS appointment account link failed: ${linkError.message}`);
  const answers = answerRecord(answerRows);
  const phone = normalizeFranceTlsPhone(profile?.phone ?? answers.phone_number);
  return {
    applicationId,
    applicantId,
    userId,
    alias: aliasResult.alias,
    accountId,
    password,
    accountStatus: account?.account_status ?? "account_prepared",
    statusUpdatedAt: account?.updated_at ?? new Date().toISOString(),
    emailVerified: Boolean(account?.email_verified),
    officialReference: officialReferenceEncrypted ? decryptSecret(officialReferenceEncrypted) : null,
    applicantProfile: {
      surname: optionalString(profile?.surname_en) ?? optionalString(profile?.surname)
        ?? firstAnswer(answers, ["surname", "family_name"]),
      givenNames: optionalString(profile?.given_names_en) ?? optionalString(profile?.given_names)
        ?? firstAnswer(answers, ["given_names", "first_names"]),
      dateOfBirth: optionalString(profile?.date_of_birth) ?? firstAnswer(answers, ["date_of_birth"]),
      gender: normalizeGender(profile?.gender ?? answers.sex),
      passportNumber: optionalString(profile?.passport_number)
        ?? firstAnswer(answers, ["travel_document_number", "passport_number"]),
      phoneCountryCode: phone.countryCode,
      phoneNumber: phone.number,
      purposeOfJourney: firstAnswer(answers, ["purpose_of_journey", "fv_purpose"])
        ?? optionalString(application.purpose),
      departureFromOriginDate: firstAnswer(answers, [
        "departure_from_origin_date",
        "origin_departure_date",
      ]),
      arrivalInSchengenDate: firstAnswer(answers, ["intended_arrival_date", "arrival_date"])
        ?? optionalString(application.arrival_date),
      departureFromSchengenDate: firstAnswer(answers, ["intended_departure_date", "departure_date"])
        ?? optionalString(application.departure_date),
      visitsFrenchOverseasTerritories: normalizeYesNo(firstAnswer(answers, [
        "visits_french_overseas_territories",
        "french_overseas_territories",
      ])),
      previousSchengenFingerprints: normalizeYesNo(answers.prev_schengen_fingerprints_given),
      schengenVisaWithinFiveYears: normalizeYesNo(firstAnswer(answers, [
        "prior_schengen_visa_5y",
        "schengen_visa_within_five_years",
        "schengen_visa_last_five_years",
      ])),
    },
  };
}

async function clickFirstVisible(candidates: Locator[]): Promise<boolean> {
  for (const candidate of candidates) {
    const locator = candidate.first();
    if (!await locator.isVisible({ timeout: 2_000 }).catch(() => false)) continue;
    await locator.scrollIntoViewIfNeeded().catch(() => undefined);
    if (await locator.click({ timeout: 12_000 }).then(() => true).catch(() => false)) return true;
    if (await locator.evaluate((element) => {
      (element as HTMLElement).click();
      return true;
    }).catch(() => false)) return true;
  }
  return false;
}

async function settle(page: Page): Promise<void> {
  await waitForFranceTlsCloudflareClearance(page, {
    timeoutMs: 90_000,
    solveProviderCaptcha: true,
  });
  await page.waitForLoadState("domcontentloaded", { timeout: 20_000 }).catch(() => undefined);
  await page.waitForTimeout(1_500);
}

async function dismissConsentBanner(page: Page): Promise<void> {
  const dismissed = await clickFirstVisible([
    page.getByRole("button", { name: /reject all/i }),
    page.getByRole("button", { name: /accept all/i }),
    page.getByRole("button", { name: /close this dialog/i }),
    page.locator("button, a, [role='button']").filter({ hasText: /^reject all$/i }),
    page.locator("button, a, [role='button']").filter({ hasText: /^accept all$/i }),
  ]);
  if (dismissed) await page.waitForTimeout(500);
}

async function navigateToCenter(page: Page, centerPath: string): Promise<void> {
  const centerUrl = new URL(centerPath, "https://visas-fr.tlscontact.com").href;
  await page.goto(centerUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await settle(page);
  await dismissConsentBanner(page);
}

async function reachCenter(page: Page, centerPath: string, refreshRetries: number): Promise<void> {
  await page.goto("https://visas-fr.tlscontact.com/en-us", {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await settle(page);
  await dismissConsentBanner(page);
  const appointmentEntryClicked = await clickFirstVisible([
    page.getByRole("button", { name: /book an appointment/i }),
    page.getByRole("link", { name: /book an appointment/i }),
  ]);
  if (!appointmentEntryClicked) {
    await navigateToCenter(page, centerPath);
    return;
  }
  const select = page.locator("select#select-country, select[name='select-country']").first();
  if (!await select.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await navigateToCenter(page, centerPath);
    return;
  }
  await select.selectOption({ label: "China" });
  const residenceConfirmed = await clickFirstVisible([
    page.locator("#btn-confirm-country"),
    page.getByRole("link", { name: /^confirm$/i }),
    page.getByRole("button", { name: /^confirm$/i }),
    page.locator("button, a, [role='button']").filter({ hasText: /^confirm$/i }),
  ]);
  if (!residenceConfirmed) {
    await navigateToCenter(page, centerPath);
    return;
  }
  await clickFirstVisible([page.locator("#btn-yes"), page.getByRole("button", { name: /^yes$/i })]);
  await settle(page);
  await dismissConsentBanner(page);
  const centerLink = page.locator(`a[href*="${centerPath}"]`).first();
  if (!await centerLink.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await navigateToCenter(page, centerPath);
    return;
  }
  await centerLink.click({ timeout: 15_000 });
  await settle(page);
  for (let attempt = 1; attempt <= Math.min(2, Math.max(0, refreshRetries)); attempt += 1) {
    const state = classifyFranceTlsBrowserState(await readFranceTlsBrowserState(page));
    if (state.checkpoint !== "site_policy_review") break;
    await page.waitForTimeout(attempt * 4_000);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
    await settle(page);
  }
}

async function reachRegistrationForm(page: Page): Promise<void> {
  let clicked = await clickFirstVisible([
    page.getByRole("link", { name: /register|create account|new user/i }),
    page.getByRole("button", { name: /register|create account|new user/i }),
  ]);
  if (!clicked) {
    clicked = await clickFirstVisible([
      page.getByRole("link", { name: /log in|sign in/i }),
      page.getByRole("button", { name: /log in|sign in/i }),
    ]);
    if (clicked) {
      await settle(page);
      clicked = await clickFirstVisible([
        page.getByRole("link", { name: /register|create account|new user/i }),
        page.getByRole("button", { name: /register|create account|new user/i }),
      ]);
    }
  }
  if (!clicked) throw new Error("TLS registration entry was not found");
  await settle(page);
  if (!await page.locator("#email, input[name='email']").first().isVisible({ timeout: 10_000 }).catch(() => false)) {
    throw new Error("TLS registration email field was not found");
  }
}

function artifactPath(name: string): string {
  const directory = process.env.SUBMISSION_ARTIFACTS_DIR?.trim()
    ? path.resolve(process.env.SUBMISSION_ARTIFACTS_DIR, "france-tls-account-registration")
    : path.join(os.tmpdir(), "viza-submission-artifacts", "france-tls-account-registration");
  fs.mkdirSync(directory, { recursive: true });
  return path.join(directory, `${name}-${Date.now()}-${randomBytes(3).toString("hex")}.png`);
}

async function maskedScreenshot(page: Page, name: string): Promise<string> {
  const output = artifactPath(name);
  const mask = [page.locator(
    "input:not([type='checkbox']):not([type='radio']):not([type='submit']):not([type='button']), textarea, [contenteditable='true']",
  )];
  await page.screenshot({ path: output, fullPage: true, mask, timeout: 30_000 });
  return output;
}

async function ensureRecaptchaToken(
  page: Page,
  options: { providerWaitMs?: number; required?: boolean } = {},
): Promise<void> {
  const response = page.locator(
    "textarea[name='g-recaptcha-response'], input[name='g-recaptcha-response']",
  ).first();
  if (await response.count() === 0) {
    if (options.required) throw new Error("TLS reCAPTCHA response field was not found");
    return;
  }
  const providerWaitMs = options.providerWaitMs ?? 30_000;
  const solved = providerWaitMs > 0
    ? await page.waitForFunction(() => {
        const element = document.querySelector<HTMLTextAreaElement | HTMLInputElement>(
          "textarea[name='g-recaptcha-response'], input[name='g-recaptcha-response']",
        );
        return Boolean(element?.value.trim());
      }, undefined, { timeout: providerWaitMs }).then(() => true).catch(() => false)
    : await response.inputValue().then((value) => Boolean(value.trim())).catch(() => false);
  if (solved) return;

  const twoCaptchaEnabled = process.env.FRANCE_REGISTRATION_2CAPTCHA_ENABLED?.trim().toLowerCase();
  if (!process.env.TWOCAPTCHA_API_KEY?.trim() || twoCaptchaEnabled === "false" || twoCaptchaEnabled === "0") {
    throw new Error("TLS reCAPTCHA was not solved before form submission");
  }
  const siteKey = await page.evaluate(() => {
    const widget = document.querySelector<HTMLElement>("[data-sitekey], .g-recaptcha");
    if (widget?.getAttribute("data-sitekey")) return widget.getAttribute("data-sitekey");
    const frame = Array.from(document.querySelectorAll<HTMLIFrameElement>("iframe[src*='recaptcha']"))
      .find((candidate) => /recaptcha\/api2\/anchor/i.test(candidate.src));
    return frame ? new URL(frame.src, window.location.href).searchParams.get("k") : null;
  });
  if (!siteKey) throw new Error("TLS reCAPTCHA site key was not found");

  const timeoutMs = Number.parseInt(process.env.FRANCE_TLS_RECAPTCHA_TIMEOUT_MS ?? "180000", 10);
  const result = await solveCaptcha({
    type: "recaptcha-v2",
    siteKey,
    pageUrl: page.url(),
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 180_000,
  });
  const token = result.text.trim();
  if (!token) throw new Error("TLS reCAPTCHA solver returned an empty token");
  await page.evaluate((captchaToken) => {
    const fields = Array.from(document.querySelectorAll<HTMLTextAreaElement | HTMLInputElement>(
      "textarea[name='g-recaptcha-response'], input[name='g-recaptcha-response']",
    ));
    for (const field of fields) {
      field.value = captchaToken;
      field.innerHTML = captchaToken;
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
    }
    const visit = (value: unknown, seen: Set<unknown>): void => {
      if (!value || typeof value !== "object" || seen.has(value)) return;
      seen.add(value);
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        if (key === "callback" && typeof child === "function") {
          try {
            (child as (tokenValue: string) => void)(captchaToken);
          } catch {
            // Continue through other registered reCAPTCHA clients.
          }
        } else {
          visit(child, seen);
        }
      }
    };
    const recaptchaWindow = window as Window & { ___grecaptcha_cfg?: { clients?: Record<string, unknown> } };
    for (const client of Object.values(recaptchaWindow.___grecaptcha_cfg?.clients ?? {})) {
      visit(client, new Set<unknown>());
    }
  }, token);
  const injected = await response.inputValue().then((value) => Boolean(value.trim())).catch(() => false);
  if (!injected) throw new Error("TLS reCAPTCHA token injection failed");
}

async function submitRegistrationForm(page: Page, context: FranceTlsStoredAccountContext): Promise<string[]> {
  await page.locator("#email, input[name='email']").first().fill(context.alias);
  await page.locator("#password, input[name='password']").first().fill(context.password);
  await page.locator("#confirm-password, input[name='passwordConfirm']").first().fill(context.password);
  const consent = page.locator("#legal-consent, input[name='legalConsent']").first();
  if (!await consent.isChecked()) await consent.check({ force: true });
  for (const selector of [
    "#marketing-by-email",
    "#marketing-by-phone",
    "#marketing-by-sms",
    "#marketing-by-push",
  ]) {
    const optional = page.locator(selector).first();
    if (await optional.isChecked().catch(() => false)) await optional.uncheck();
  }
  await ensureRecaptchaToken(page);
  const evidence = [await maskedScreenshot(page, "registration-filled")];
  await page.locator("button#submit, button[type='submit']").first().click({ timeout: 15_000 });
  await settle(page);
  const invalidFields = await page.locator(":invalid").evaluateAll((elements) => elements.map((element) => {
    const input = element as HTMLInputElement;
    return input.name || input.id || input.type || element.tagName.toLowerCase();
  })).catch(() => [] as string[]);
  if (invalidFields.length) throw new Error(`TLS registration validation failed: ${invalidFields.join(", ")}`);
  evidence.push(await maskedScreenshot(page, "registration-submitted"));
  return evidence;
}

async function activateAccount(page: Page, context: FranceTlsStoredAccountContext, since: string, timeoutMs: number): Promise<void> {
  const message = await waitForFranceTlsActivationEmail(context.applicantId, timeoutMs, {
    since,
    includeProcessed: true,
  });
  await page.goto(message.activationUrl.href, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await settle(page);
  const body = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
  if (isFranceTlsActivationExpiredText(body)) throw new Error("TLS activation link expired");
  const state = classifyFranceTlsBrowserState(await readFranceTlsBrowserState(page));
  const activated = /account.{0,40}(activated|active)|activation.{0,40}(complete|success)|log in|sign in/i.test(body)
    || state.checkpoint === "login";
  if (!activated) {
    await maskedScreenshot(page, "activation-unverified").catch(() => null);
    throw new Error(
      `TLS activation result could not be verified (checkpoint: ${state.checkpoint}; url: ${redactOfficialUrl(page.url())})`,
    );
  }
  await updateAccountStatus(context, "email_verified", true);
}

function activationLookbackSince(): string {
  const lookbackDays = Number.parseInt(
    process.env.FRANCE_TLS_ACTIVATION_LOOKBACK_DAYS ?? "30",
    10,
  );
  const safeLookbackDays = Number.isFinite(lookbackDays) && lookbackDays > 0
    ? Math.min(lookbackDays, 90)
    : 30;
  return new Date(Date.now() - safeLookbackDays * 24 * 60 * 60 * 1_000).toISOString();
}

export function isAuthenticatedFranceTlsRedirectUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const isTlsHost = url.hostname === "tlscontact.com" || url.hostname.endsWith(".tlscontact.com");
    const isAuthPage = url.hostname === "i2-auth.visas-fr.tlscontact.com"
      || /\/auth\/realms\//i.test(url.pathname);
    return isTlsHost && !isAuthPage;
  } catch {
    return false;
  }
}

async function waitForAuthenticatedTlsRedirect(page: Page, timeoutMs = 120_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  let stableLoginFormPolls = 0;
  while (Date.now() < deadline) {
    const input = await readFranceTlsBrowserState(page);
    const state = classifyFranceTlsBrowserState(input);
    let isAuthPage = true;
    try {
      const url = new URL(input.url);
      isAuthPage = url.hostname === "i2-auth.visas-fr.tlscontact.com" || /\/auth\/realms\//i.test(url.pathname);
      if (isAuthenticatedFranceTlsRedirectUrl(input.url) && state.checkpoint !== "waf") {
        return true;
      }
    } catch {
      // Keep waiting while the browser is between official redirects.
    }

    const passwordVisible = await page.locator("input[type='password']").first()
      .isVisible({ timeout: 1_000 }).catch(() => false);
    if (isAuthPage && passwordVisible && (state.checkpoint === "login" || isFranceTlsCaptchaBlocking(input, state))) {
      stableLoginFormPolls += 1;
      if (stableLoginFormPolls >= 3) return false;
    } else {
      stableLoginFormPolls = 0;
    }
    await page.waitForTimeout(2_000);
  }
  return false;
}

async function login(page: Page, context: FranceTlsStoredAccountContext, centerUrl: string): Promise<void> {
  const hasPassword = await page.locator("input[type='password']").first().isVisible({ timeout: 3_000 }).catch(() => false);
  if (!hasPassword) {
    await page.goto(centerUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await settle(page);
    const authenticatedPageVisible = /\/(?:travel-groups|[^/]+\/workflow\/)/i.test(page.url())
      || await page.getByText(/application list/i).first().isVisible({ timeout: 3_000 }).catch(() => false);
    if (authenticatedPageVisible) {
      await updateAccountStatus(context, "logged_in", true);
      return;
    }
    if (!await clickFirstVisible([
      page.getByRole("link", { name: /log in|sign in/i }),
      page.getByRole("button", { name: /log in|sign in/i }),
    ])) throw new Error("TLS login entry was not found after activation");
    await settle(page);
  }

  // TLS can replace the Keycloak login DOM once more immediately after its
  // Cloudflare waiting room clears. Re-resolve every locator for each attempt
  // and allow one safe login-page refresh; never repeat account registration.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await settle(page);
    const username = page.locator(
      "#email-input-field, input[type='email'], input[name='username'], input[name='email']",
    ).first();
    const password = page.locator("#password-input-field, input[type='password']").first();
    const formReady = await username.isVisible({ timeout: 10_000 }).catch(() => false)
      && await password.isVisible({ timeout: 10_000 }).catch(() => false);
    if (formReady) {
      await username.fill(context.alias);
      await password.fill(context.password);
      const clicked = await clickFirstVisible([
        page.locator("#btn-login"),
        page.getByRole("button", { name: /^log\s*in$/i }),
        page.getByRole("button", { name: /^sign\s*in$/i }),
        page.locator("button[type='submit'], input[type='submit']"),
      ]);
      if (clicked) {
        await settle(page);
        const loginState = classifyFranceTlsBrowserState(await readFranceTlsBrowserState(page));
        if (loginState.checkpoint === "captcha_grid" || loginState.checkpoint === "captcha_token") {
          const configuredWaitMs = Number.parseInt(
            process.env.FRANCE_TLS_BROWSERBASE_CAPTCHA_WAIT_MS ?? "45000",
            10,
          );
          const providerWaitMs = Number.isFinite(configuredWaitMs) && configuredWaitMs >= 0
            ? configuredWaitMs
            : 45_000;
          await ensureRecaptchaToken(page, { providerWaitMs, required: true });
          const clickedAfterCaptcha = await clickFirstVisible([
            page.locator("#btn-login"),
            page.getByRole("button", { name: /^log\s*in$/i }),
            page.locator("button[type='submit'], input[type='submit']"),
          ]);
          if (!clickedAfterCaptcha) {
            throw new Error("TLS login control disappeared after reCAPTCHA was solved");
          }
        }
        const body = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
        if (isFranceTlsActivationRequiredText(body)) {
          throw new Error("TLScontact requires account activation before login");
        }
        if (/invalid (email|username|password|credentials)|incorrect password|authentication failed|invalid user credentials|account.{0,20}not found/i.test(body)) {
          throw new Error("TLS login rejected the stored credentials");
        }
        if (await waitForAuthenticatedTlsRedirect(page)) {
          await updateAccountStatus(context, "logged_in", true);
          return;
        }
      }
    }
    if (attempt === 0) {
      await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
    }
  }
  const finalInput = await readFranceTlsBrowserState(page);
  const finalState = classifyFranceTlsBrowserState(finalInput);
  await maskedScreenshot(page, "login-stalled").catch(() => null);
  throw new Error(
    `TLS login did not leave the authentication form after one safe refresh (checkpoint: ${finalState.checkpoint}; url: ${redactOfficialUrl(finalInput.url)})`,
  );
}

export async function loadFranceTlsStoredAccount(
  applicationId: string,
): Promise<FranceTlsStoredAccountContext> {
  return loadRegistrationContext(applicationId, false);
}

export async function loginFranceTlsStoredAccount(
  page: Page,
  context: FranceTlsStoredAccountContext,
  centerUrl: string,
): Promise<void> {
  if (!context.emailVerified) {
    throw new Error("TLScontact alias account email has not been verified yet");
  }
  await login(page, context, centerUrl);
}

async function enterSingleExistingTravelGroup(page: Page): Promise<"not_present" | "entered" | "ambiguous"> {
  const isTravelGroupPage = /\/travel-groups(?:[/?#]|$)/i.test(page.url())
    || await page.getByText(/application list/i).first().isVisible({ timeout: 3_000 }).catch(() => false);
  if (!isTravelGroupPage) return "not_present";

  const selectButtons = page.getByRole("button", { name: /^select$/i });
  const count = await selectButtons.count();
  if (count !== 1) return count > 1 ? "ambiguous" : "not_present";
  const observedWorkflowUrlPromise = page.waitForURL(/\/workflow\//i, {
    timeout: 20_000,
    waitUntil: "domcontentloaded",
  }).then(() => page.url()).catch(() => null);
  await selectButtons.first().click({ timeout: 15_000 });
  const observedWorkflowUrl = await observedWorkflowUrlPromise;
  await settle(page);
  if (observedWorkflowUrl && !/\/workflow\//i.test(page.url())) {
    await page.goto(observedWorkflowUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await settle(page);
  }
  const staleApplicationList = /\/workflow\//i.test(page.url())
    && await page.getByText(/application list/i).first().isVisible({ timeout: 3_000 }).catch(() => false);
  if (staleApplicationList) {
    await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
    await settle(page);
  }
  return "entered";
}

async function fillVisibleInput(page: Page, selector: string, value: string | null): Promise<boolean> {
  if (!value) return false;
  const input = page.locator(selector).first();
  if (!await input.isVisible({ timeout: 3_000 }).catch(() => false)) return false;
  await input.fill(value);
  return await input.inputValue().then((current) => current.trim() === value).catch(() => false);
}

async function selectVisibleOptionByLabel(
  page: Page,
  label: RegExp,
  optionLabel: string | null,
): Promise<boolean> {
  if (!optionLabel) return false;
  const candidates = [
    page.getByLabel(label).first(),
    page.locator("select:visible").filter({ has: page.locator("option", { hasText: optionLabel }) }).first(),
  ];
  for (const candidate of candidates) {
    if (!await candidate.isVisible({ timeout: 2_000 }).catch(() => false)) continue;
    if (await candidate.selectOption({ label: optionLabel }).then(() => true).catch(() => false)) return true;
  }
  return false;
}

async function selectQuestionRadio(
  page: Page,
  question: RegExp,
  answer: boolean | null,
): Promise<boolean> {
  if (answer === null) return false;
  const questionText = page.getByText(question).first();
  if (!await questionText.isVisible({ timeout: 3_000 }).catch(() => false)) return false;
  const group = questionText.locator("xpath=ancestor::*[.//input[@type='radio']][1]");
  const choice = group.getByRole("radio", { name: answer ? /^yes$/i : /^no$/i }).first();
  if (!await choice.isVisible({ timeout: 2_000 }).catch(() => false)) return false;
  await choice.check().catch(async () => choice.click());
  return choice.isChecked().catch(() => false);
}

const PURPOSE_LABELS: Record<string, string> = {
  tourism: "Tourism",
  business: "Business",
  visiting_family_friends: "Visiting family or friends",
  cultural: "Cultural",
  sports: "Sports",
  official_visit: "Official visit",
  medical: "Medical reasons",
  study: "Study",
  airport_transit: "Airport transit",
  other: "Other",
};

async function fillApplicantProfileFields(
  page: Page,
  profile: FranceTlsApplicantProfile,
): Promise<string[]> {
  const missing: string[] = [];
  const requireFilled = async (field: string, fill: () => Promise<boolean>) => {
    if (!await fill()) missing.push(field);
  };

  await requireFilled("surname", () => fillVisibleInput(page, "input[name='f_pers_surnames']", profile.surname));
  await requireFilled("given_names", () => fillVisibleInput(page, "input[name='f_pers_givennames']", profile.givenNames));
  await requireFilled("date_of_birth", () => fillVisibleInput(page, "input[name='f_pers_birth_date']", profile.dateOfBirth));

  if (!profile.gender) {
    missing.push("sex");
  } else {
    const gender = page.getByRole("radio", {
      name: new RegExp(`^${profile.gender === "male" ? "male" : profile.gender === "female" ? "female" : "other"}$`, "i"),
    }).first();
    const selected = await gender.isVisible({ timeout: 2_000 }).catch(() => false)
      && await gender.check().then(() => true).catch(() => false);
    if (!selected) missing.push("sex");
  }

  await requireFilled("passport_number", () => fillVisibleInput(page, "input[name='f_pass_num']", profile.passportNumber));
  await requireFilled("phone_number", () => fillVisibleInput(
    page,
    "input[placeholder*='mobile number' i]",
    profile.phoneCountryCode === "+86" ? profile.phoneNumber : null,
  ));

  const purposeLabel = profile.purposeOfJourney
    ? PURPOSE_LABELS[profile.purposeOfJourney.toLowerCase()] ?? null
    : null;
  await requireFilled("purpose_of_journey", () => selectVisibleOptionByLabel(
    page,
    /reason for your travel/i,
    purposeLabel,
  ));
  await requireFilled("departure_from_origin_date", () => fillVisibleInput(
    page,
    "input[name='fi_trav_origin_departure_date']",
    profile.departureFromOriginDate,
  ));
  await requireFilled("intended_arrival_date", () => fillVisibleInput(
    page,
    "input[name='f_trav_arrival_date']",
    profile.arrivalInSchengenDate,
  ));
  await requireFilled("intended_departure_date", () => fillVisibleInput(
    page,
    "input[name='f_trav_departure_date']",
    profile.departureFromSchengenDate,
  ));

  await requireFilled("visits_french_overseas_territories", () => selectQuestionRadio(
    page,
    /going to french overseas territories/i,
    profile.visitsFrenchOverseasTerritories,
  ));
  await requireFilled("prev_schengen_fingerprints_given", () => selectQuestionRadio(
    page,
    /fingerprints collected previously/i,
    profile.previousSchengenFingerprints,
  ));
  await requireFilled("schengen_visa_within_five_years", () => selectQuestionRadio(
    page,
    /obtain a schengen visa over the last 5 years/i,
    profile.schengenVisaWithinFiveYears,
  ));
  return missing;
}

async function fillOfficialReference(
  page: Page,
  context: FranceTlsStoredAccountContext,
  centerPath?: string,
): Promise<string[]> {
  if (!context.officialReference) throw new Error("France-Visas official reference is missing");
  if (centerPath && /^https:\/\/visas-fr\.tlscontact\.com\/en-us\/?(?:[?#].*)?$/i.test(page.url())) {
    await navigateToCenter(page, centerPath);
  }
  const travelGroupEntry = await enterSingleExistingTravelGroup(page);
  if (travelGroupEntry === "ambiguous") return ["travel_group_selection"];
  if (travelGroupEntry === "entered" && centerPath && /^https:\/\/visas-fr\.tlscontact\.com\/en-us\/?(?:[?#].*)?$/i.test(page.url())) {
    await navigateToCenter(page, centerPath);
    const returnedToTravelGroups = /\/travel-groups(?:[/?#]|$)/i.test(page.url())
      || await page.getByText(/application list/i).first().isVisible({ timeout: 3_000 }).catch(() => false);
    if (returnedToTravelGroups) return ["travel_group_select_redirect_loop"];
  }
  const officialInput = await readFranceTlsBrowserState(page);
  const officialState = classifyFranceTlsBrowserState(officialInput);
  if (officialState.checkpoint !== "ready" && isFranceTlsCaptchaBlocking(officialInput, officialState)) {
    return [`official_checkpoint_${officialState.checkpoint}`];
  }
  if (!["ready", "captcha_token"].includes(officialState.checkpoint)) {
    return [`official_checkpoint_${officialState.checkpoint}`];
  }
  if (/\/workflow\/applicants-information/i.test(page.url())) {
    const applicantContentReady = await page.waitForFunction(`(() => {
      const text = document.body?.innerText.replace(/\\s+/g, " ") ?? "";
      return /add a new applicant|you have not yet added an applicant|first name|last name|passport|date of birth|france.?visas.{0,30}(?:reference|number)/i.test(text);
    })()`, undefined, { timeout: 30_000 }).then(() => true).catch(() => false);
    if (!applicantContentReady) return ["applicant_information_loading"];
  }
  const addApplicantTextVisible = await page.getByText(/add a new applicant/i).first()
    .isVisible({ timeout: 3_000 }).catch(() => false);
  let openedApplicantForm = false;
  if (addApplicantTextVisible) {
    openedApplicantForm = await clickFirstVisible([
      page.getByRole("button", { name: /add a new applicant/i }),
      page.getByRole("link", { name: /add a new applicant/i }),
      page.locator("button, a, [role='button']").filter({ hasText: /add a new applicant/i }),
    ]);
    if (!openedApplicantForm) return ["add_applicant_control"];
    await settle(page);
    const applicantFormReady = await page.waitForFunction(`(() => {
      const text = document.body?.innerText.replace(/\\s+/g, " ") ?? "";
      return /first name|last name|passport|date of birth|france.?visas.{0,30}(?:reference|number)/i.test(text);
    })()`, undefined, { timeout: 30_000 }).then(() => true).catch(() => false);
    if (!applicantFormReady) return ["applicant_form_loading"];
  }
  const candidates = page.locator(
    "input[name*='reference' i], input[id*='reference' i], input[placeholder*='reference' i]",
  );
  if (!await candidates.first().isVisible({ timeout: 10_000 }).catch(() => false)) {
    const missing = await page.locator("input:visible, select:visible, textarea:visible").evaluateAll((elements) =>
      elements.map((element) => {
        const input = element as HTMLInputElement;
        return input.name || input.id || input.getAttribute("aria-label") || input.type || element.tagName.toLowerCase();
      }).filter(Boolean).slice(0, 30),
    ).catch(() => [] as string[]);
    return missing;
  }
  await candidates.first().fill(context.officialReference);
  const referenceRetained = await candidates.first().isVisible().catch(() => false)
    && await candidates.first().inputValue().then((value) => value.trim() === context.officialReference).catch(() => false);
  if (!referenceRetained) return ["official_reference_not_retained"];
  const inputAfterFill = await readFranceTlsBrowserState(page);
  const stateAfterFill = classifyFranceTlsBrowserState(inputAfterFill);
  if (stateAfterFill.checkpoint !== "ready" && isFranceTlsCaptchaBlocking(inputAfterFill, stateAfterFill)) {
    return [`official_checkpoint_${stateAfterFill.checkpoint}`];
  }
  if (!["ready", "captcha_token"].includes(stateAfterFill.checkpoint)) {
    return [`official_checkpoint_${stateAfterFill.checkpoint}`];
  }
  const applicantFormVisible = openedApplicantForm
    || /\/workflow\/applicants-information\/bio\//i.test(page.url())
    || await page.locator("input[name='f_pers_surnames']").first().isVisible({ timeout: 2_000 }).catch(() => false);
  if (applicantFormVisible) {
    const profileMissing = await fillApplicantProfileFields(page, context.applicantProfile);
    if (profileMissing.length) return ["applicant_profile_fields", ...profileMissing];
    const remainingFields = await page.locator("input:visible, select:visible, textarea:visible").evaluateAll(
      (elements) => elements.map((element) => {
        const input = element as HTMLInputElement;
        const descriptor = input.name
          || input.id
          || input.getAttribute("aria-label")
          || input.getAttribute("placeholder")
          || input.type
          || element.tagName.toLowerCase();
        return {
          descriptor,
          value: input.value?.trim() ?? "",
          type: input.type ?? element.tagName.toLowerCase(),
        };
      }).filter((field) => field.descriptor && !field.value && !["hidden", "submit", "button"].includes(field.type))
        .map((field) => field.descriptor)
        .slice(0, 40),
    ).catch(() => [] as string[]);
    return remainingFields.length
      ? ["applicant_profile_fields", ...remainingFields]
      : ["applicant_profile_review_required"];
  }
  await updateAccountStatus(context, "appointment_reference_filled", true);
  return [];
}

export async function submitFranceTlsOfficialReference(
  page: Page,
  context: FranceTlsStoredAccountContext,
  centerPath?: string,
): Promise<{ submitted: boolean; visibleUnmappedFields: string[] }> {
  const visibleUnmappedFields = await fillOfficialReference(page, context, centerPath);
  if (visibleUnmappedFields.length) return { submitted: false, visibleUnmappedFields };
  const clicked = await clickFirstVisible([
    page.getByRole("button", { name: /continue|next|confirm|submit/i }),
    page.getByRole("link", { name: /continue|next|confirm|submit/i }),
    page.locator("button[type='submit'], input[type='submit']"),
  ]);
  if (!clicked) return { submitted: false, visibleUnmappedFields: ["official_reference_submit_control"] };
  await settle(page);
  const invalid = await page.locator(":invalid").count().catch(() => 0);
  if (invalid > 0) {
    return { submitted: false, visibleUnmappedFields: ["official_reference_validation"] };
  }
  await updateAccountStatus(context, "appointment_profile_filled", true);
  return { submitted: true, visibleUnmappedFields: [] };
}

export async function registerAndPrepareFranceTlsAccount(
  input: FranceTlsAccountRegistrationInput,
): Promise<FranceTlsAccountRegistrationResult> {
  const center = resolveFranceTlsCenter(input.centerCode);
  if (!center) throw new Error("Unsupported TLScontact China center");
  const shouldFillReference = input.fillOfficialReference !== false;
  const context = await loadRegistrationContext(input.applicationId, shouldFillReference);
  const session = await createFranceTlsBrowserSession();
  const evidence: string[] = [];
  try {
    if (!context.emailVerified) {
      const registrationMayAlreadyExist = ["registration_submitting", "activation_email_pending"]
        .includes(context.accountStatus);
      if (!registrationMayAlreadyExist) {
        if (context.accountStatus === "manual_required") {
          throw new Error("TLS account is marked manual_required; refusing to resubmit registration automatically");
        }
        await reachCenter(session.page, new URL(center.bookingUrl).pathname, input.refreshRetries ?? 2);
        await reachRegistrationForm(session.page);
        if (!input.submitRegistration) {
          evidence.push(await maskedScreenshot(session.page, "registration-form-ready"));
          return {
            status: "registration_form_ready",
            accountId: context.accountId,
            provider: session.provider,
            centerCode: center.code,
            finalUrl: redactOfficialUrl(session.page.url()),
            replayUrl: null,
            evidence,
            stopPoint: "Registration fields were not submitted because submitRegistration was false.",
          };
        }
        await updateAccountStatus(context, "registration_submitting", false);
        evidence.push(...await submitRegistrationForm(session.page, context));
        await updateAccountStatus(context, "activation_email_pending", false);
      }
      const activationSince = registrationMayAlreadyExist
        ? activationLookbackSince()
        : new Date(Math.max(0, Date.parse(context.statusUpdatedAt) - 60_000)).toISOString();
      await activateAccount(
        session.page,
        context,
        activationSince,
        input.emailTimeoutMs ?? 600_000,
      );
      evidence.push(await maskedScreenshot(session.page, "account-activated"));
    }

    try {
      await login(session.page, context, center.bookingUrl);
    } catch (error) {
      const body = await session.page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
      if (!isFranceTlsActivationRequiredText(body)) throw error;

      evidence.push(await maskedScreenshot(session.page, "activation-required"));
      await updateAccountStatus(context, "activation_email_pending", false);
      await activateAccount(
        session.page,
        context,
        activationLookbackSince(),
        Math.min(input.emailTimeoutMs ?? 600_000, 30_000),
      );
      evidence.push(await maskedScreenshot(session.page, "account-reactivated"));
      await login(session.page, context, center.bookingUrl);
    }
    evidence.push(await maskedScreenshot(session.page, "logged-in"));
    if (shouldFillReference) {
      const visibleUnmappedFields = await fillOfficialReference(
        session.page,
        context,
        new URL(center.bookingUrl).pathname,
      );
      evidence.push(await maskedScreenshot(session.page, "appointment-reference"));
      if (visibleUnmappedFields.length) {
        const officialCheckpoint = visibleUnmappedFields.find((field) =>
          field.startsWith("official_checkpoint_"),
        );
        const applicantReviewRequired = visibleUnmappedFields[0] === "applicant_profile_fields"
          || visibleUnmappedFields[0] === "applicant_profile_review_required";
        await updateAccountStatus(context, "manual_required", true);
        return {
          status: "manual_required",
          accountId: context.accountId,
          provider: session.provider,
          centerCode: center.code,
          finalUrl: redactOfficialUrl(session.page.url()),
          replayUrl: null,
          evidence,
          checkpoint: {
            type: officialCheckpoint
              ? officialCheckpoint.replace(/^official_checkpoint_/, "")
              : applicantReviewRequired
                ? "applicant_profile_review_required"
                : "official_field_mapping_required",
            message: officialCheckpoint
              ? "TLScontact login succeeded, but the official site returned a blocking page before the France-Visas reference could be verified."
              : applicantReviewRequired
                ? "TLScontact opened the applicant form and retained the France-Visas reference. Review or supply the remaining applicant fields before any official save action."
                : "TLScontact login succeeded, but the France-Visas reference field was not visible.",
            missingFields: visibleUnmappedFields,
          },
          stopPoint: "Stopped before submitting any appointment profile, selecting a slot, payment, or booking.",
        };
      }
    }
    return {
      status: shouldFillReference ? "appointment_reference_filled" : "logged_in",
      accountId: context.accountId,
      provider: session.provider,
      centerCode: center.code,
      finalUrl: redactOfficialUrl(session.page.url()),
      replayUrl: null,
      evidence,
      stopPoint: "Stopped before submitting the appointment reference, selecting a slot, payment, or booking.",
    };
  } catch (error) {
    if (!["registration_submitting", "activation_email_pending"].includes(context.accountStatus)) {
      await updateAccountStatus(context, "manual_required", context.emailVerified).catch(() => undefined);
    }
    throw error;
  } finally {
    await session.browser.close().catch(() => undefined);
  }
}
