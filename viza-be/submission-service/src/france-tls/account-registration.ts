import { randomBytes, randomInt } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import type { Locator, Page } from "@playwright/test";
import { redactOfficialUrl } from "../appointment-free-smoke";
import { ensureApplicantInboxAlias } from "../inbox/alias";
import { decryptSecret, encryptSecret } from "../secret-cipher";
import { supabase } from "../supabase";
import {
  isFranceTlsActivationExpiredText,
  waitForFranceTlsActivationEmail,
} from "./activation";
import {
  classifyFranceTlsBrowserState,
  createFranceTlsBrowserSession,
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

interface RegistrationContext {
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
}

function firstRelation(value: unknown): Relation | null {
  if (Array.isArray(value)) return firstRelation(value[0]);
  return value && typeof value === "object" ? value as Relation : null;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is missing`);
  return value.trim();
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
  context: RegistrationContext,
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
): Promise<RegistrationContext> {
  const { data: application, error: applicationError } = await supabase
    .from("applications")
    .select("id,applicant_id,country,applicant_profiles!inner(auth_user_id,inbox_alias)")
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

  const [{ data: account, error: accountError }, { data: queueRow, error: queueError }] =
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
    ]);
  if (accountError) throw new Error(`TLS account lookup failed: ${accountError.message}`);
  if (queueError) throw new Error(`France official reference lookup failed: ${queueError.message}`);
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
  };
}

async function clickFirstVisible(candidates: Locator[]): Promise<boolean> {
  for (const candidate of candidates) {
    const locator = candidate.first();
    if (!await locator.isVisible({ timeout: 2_000 }).catch(() => false)) continue;
    await locator.scrollIntoViewIfNeeded().catch(() => undefined);
    if (await locator.click({ timeout: 12_000 }).then(() => true).catch(() => false)) return true;
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

async function reachCenter(page: Page, centerPath: string, refreshRetries: number): Promise<void> {
  await page.goto("https://visas-fr.tlscontact.com/en-us", {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await settle(page);
  await clickFirstVisible([
    page.getByRole("button", { name: /reject all/i }),
    page.getByRole("button", { name: /accept all/i }),
    page.getByRole("button", { name: /close this dialog/i }),
  ]);
  await clickFirstVisible([
    page.getByRole("button", { name: /book an appointment/i }),
    page.getByRole("link", { name: /book an appointment/i }),
  ]);
  const select = page.locator("select#select-country, select[name='select-country']").first();
  if (!await select.isVisible({ timeout: 5_000 }).catch(() => false)) {
    throw new Error("TLS residence-country selector was not found");
  }
  await select.selectOption({ label: "China" });
  if (!await clickFirstVisible([
    page.locator("#btn-confirm-country"),
    page.getByRole("link", { name: /^confirm$/i }),
    page.getByRole("button", { name: /^confirm$/i }),
  ])) throw new Error("TLS residence-country confirmation was not found");
  await clickFirstVisible([page.locator("#btn-yes"), page.getByRole("button", { name: /^yes$/i })]);
  await settle(page);
  const centerLink = page.locator(`a[href*="${centerPath}"]`).first();
  if (!await centerLink.isVisible({ timeout: 10_000 }).catch(() => false)) {
    throw new Error("Requested TLS center link was not found");
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
  const directory = path.resolve("artifacts/france-tls-account-registration");
  fs.mkdirSync(directory, { recursive: true });
  return path.join(directory, `${name}-${Date.now()}-${randomBytes(3).toString("hex")}.png`);
}

async function maskedScreenshot(page: Page, name: string): Promise<string> {
  const output = artifactPath(name);
  const mask = [page.locator("input[type='email'], input[type='password'], input[name*='reference' i]")];
  await page.screenshot({ path: output, fullPage: true, mask, timeout: 30_000 });
  return output;
}

async function submitRegistrationForm(page: Page, context: RegistrationContext): Promise<string[]> {
  await page.locator("#email, input[name='email']").first().fill(context.alias);
  await page.locator("#password, input[name='password']").first().fill(context.password);
  await page.locator("#confirm-password, input[name='passwordConfirm']").first().fill(context.password);
  const consent = page.locator("#legal-consent, input[name='legalConsent']").first();
  if (!await consent.isChecked()) await consent.check();
  for (const selector of [
    "#marketing-by-email",
    "#marketing-by-phone",
    "#marketing-by-sms",
    "#marketing-by-push",
  ]) {
    const optional = page.locator(selector).first();
    if (await optional.isChecked().catch(() => false)) await optional.uncheck();
  }
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

async function activateAccount(page: Page, context: RegistrationContext, since: string, timeoutMs: number): Promise<void> {
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
  if (!activated) throw new Error("TLS activation result could not be verified");
  await updateAccountStatus(context, "email_verified", true);
}

async function login(page: Page, context: RegistrationContext, centerUrl: string): Promise<void> {
  const hasPassword = await page.locator("input[type='password']").first().isVisible({ timeout: 3_000 }).catch(() => false);
  if (!hasPassword) {
    await page.goto(centerUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await settle(page);
    if (!await clickFirstVisible([
      page.getByRole("link", { name: /log in|sign in/i }),
      page.getByRole("button", { name: /log in|sign in/i }),
    ])) throw new Error("TLS login entry was not found after activation");
    await settle(page);
  }
  await page.locator("input[type='email'], input[name='username'], input[name='email']").first().fill(context.alias);
  await page.locator("input[type='password']").first().fill(context.password);
  await page.locator("button[type='submit'], input[type='submit']").first().click({ timeout: 15_000 });
  await settle(page);
  const body = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
  if (/invalid (email|password|credentials)|incorrect password|authentication failed/i.test(body)) {
    throw new Error("TLS login rejected the stored credentials");
  }
  const stillHasPassword = await page.locator("input[type='password']").first().isVisible({ timeout: 2_000 }).catch(() => false);
  if (stillHasPassword) throw new Error("TLS login did not leave the authentication form");
  await updateAccountStatus(context, "logged_in", true);
}

async function fillOfficialReference(page: Page, context: RegistrationContext): Promise<string[]> {
  if (!context.officialReference) throw new Error("France-Visas official reference is missing");
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
  await updateAccountStatus(context, "appointment_reference_filled", true);
  return [];
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
      const activationSince = new Date(
        Math.max(0, Date.parse(context.statusUpdatedAt) - 60_000),
      ).toISOString();
      await activateAccount(
        session.page,
        context,
        activationSince,
        input.emailTimeoutMs ?? 600_000,
      );
      evidence.push(await maskedScreenshot(session.page, "account-activated"));
    }

    await login(session.page, context, center.bookingUrl);
    evidence.push(await maskedScreenshot(session.page, "logged-in"));
    if (shouldFillReference) {
      const visibleUnmappedFields = await fillOfficialReference(session.page, context);
      evidence.push(await maskedScreenshot(session.page, "appointment-reference"));
      if (visibleUnmappedFields.length) {
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
            type: "official_field_mapping_required",
            message: "TLScontact login succeeded, but the France-Visas reference field was not visible.",
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
