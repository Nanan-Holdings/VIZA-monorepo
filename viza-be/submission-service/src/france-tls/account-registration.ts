import { randomBytes, randomInt } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ConsoleMessage, Locator, Page } from "@playwright/test";
import { redactOfficialUrl } from "../appointment-free-smoke";
import { solveCaptcha } from "../captcha/two-captcha";
import { ensureApplicantInboxAlias } from "../inbox/alias";
import {
  assertAppointmentAccountInboxRoutable,
  assertInboxAliasDomainRoutable,
} from "../inbox/wait-for-message";
import { decryptSecret, encryptSecret } from "../secret-cipher";
import { supabase } from "../supabase";
import {
  isFranceTlsActivationRequiredText,
  isFranceTlsActivationExpiredText,
  isFranceTlsPasswordResetCompletedText,
  waitForFranceTlsActivationEmail,
  waitForFranceTlsPasswordResetEmail,
} from "./activation";
import {
  classifyFranceTlsBrowserState,
  closeFranceTlsBrowserSession,
  createFranceTlsBrowserSession,
  isFranceTlsCaptchaBlocking,
  readFranceTlsBrowserState,
  waitForFranceTlsCloudflareClearance,
} from "./browser-api";
import { FRANCE_TLS_CHINA_CENTERS, resolveFranceTlsCenter } from "./center-registry";
import { solveVisibleRecaptchaGridChallenge } from "./recaptcha-grid";

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

export interface FranceTlsAccountReplacementInput extends FranceTlsAccountRegistrationInput {
  submitRegistration: true;
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

interface FranceTlsReplacementAccountRow {
  id: string;
  account_email: string | null;
  account_status: string;
  email_verified: boolean | null;
  metadata_redacted_json: unknown;
}

export interface FranceTlsAccountReplacementPlan {
  reusableAccountId: string | null;
  accountIdsToAbandon: string[];
}

export function isFranceTlsPreRegistrationRetryEligible(input: {
  accountStatus: string;
  emailVerified: boolean;
}): boolean {
  return [
    "manual_required",
    "registration_retryable_error",
    "browser_session_retryable_error",
  ].includes(input.accountStatus)
    && !input.emailVerified;
}

export type FranceTlsRegistrationResultState = "success" | "retryable_error" | "unverified";

export function classifyFranceTlsRegistrationResult(input: {
  url: string;
  bodyText: string;
}): FranceTlsRegistrationResultState {
  const body = input.bodyText.replace(/\s+/g, " ").trim();
  if (
    /we apologise for the inconvenience.{0,100}website team is currently working to fix this/i.test(body)
    || /temporar(?:y|ily).{0,60}(?:unavailable|unable to process)/i.test(body)
  ) {
    return "retryable_error";
  }
  if (
    /(?:check|verify|confirm).{0,50}(?:email|inbox)/i.test(body)
    || /(?:activation|confirmation).{0,50}(?:email|link).{0,30}(?:sent|receive)/i.test(body)
    || /account.{0,40}(?:created|registered).{0,60}(?:email|activate)/i.test(body)
    || /\/login(?:[/?#]|$)/i.test(input.url)
  ) {
    return "success";
  }
  return "unverified";
}

export function isRetryableFranceTlsCaptchaSolveError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /ERROR_CAPTCHA_UNSOLVABLE|ERROR_NO_SLOT_AVAILABLE|timed?\s*out|timeout/i.test(message);
}

export function isRetryableFranceTlsBrowserSessionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /target page, context or browser has been closed|browserbase.{0,40}(?:timed out|timeout)|browser session.{0,20}(?:timed out|closed)|cloudflare (?:waiting room|security verification)|checkpoint:\s*waf/i
    .test(message);
}

export function isFranceTlsWaitingRoomText(value: string): boolean {
  return /file d['’]attente|waiting room|temps d['’]attente|estimated wait|page s['’]actualisera automatiquement/i
    .test(value.replace(/\s+/g, " "));
}

export function isFranceTlsSecurityVerificationText(value: string): boolean {
  return /performing security verification|v[ée]rification de s[ée]curit[ée]|this website uses a security service|protect against malicious bots|verifies you are not a bot/i
    .test(value.replace(/\s+/g, " "));
}

export function resolveFranceTlsCaptchaAttemptTimeoutMs(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 45_000;
  // Browserbase plans used by this runner can cap a session at 300 seconds.
  // Two rounds plus provider waits must leave time for navigation and cleanup.
  return Math.min(Math.max(parsed, 10_000), 60_000);
}

export function shouldPreserveFranceTlsRegistrationStatus(status: string): boolean {
  return [
    "registration_submitting",
    "activation_email_pending",
    "registration_retryable_error",
    "registration_result_unverified",
    "browser_session_retryable_error",
  ].includes(status);
}

export function isRetryableFranceTlsRegistrationNavigationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /TLS (?:registration entry was not found|registration form unavailable|center selection control could not be activated)/i
    .test(message);
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

export interface FranceTlsAccountRecoveryInput {
  applicationId: string;
  centerCode: string;
  fillOfficialReference?: boolean;
  emailTimeoutMs?: number;
}

export function resolveFranceTlsAccountAlias(input: {
  applicantAlias: string;
  storedAccountAlias: string | null;
  emailVerified: boolean;
}): string {
  const applicantAlias = input.applicantAlias.trim().toLowerCase();
  const storedAccountAlias = input.storedAccountAlias?.trim().toLowerCase() || null;
  if (!storedAccountAlias || storedAccountAlias === applicantAlias) return applicantAlias;
  if (!input.emailVerified) {
    throw new Error("Unverified TLS account alias does not match the applicant alias");
  }
  // A verified official account remains bound to the alias used at
  // registration. Applicant inbox rotation must not silently rewrite that
  // login identifier or create a duplicate TLS account.
  return storedAccountAlias;
}

export function planFranceTlsAccountReplacement(input: {
  applicantAlias: string;
  accounts: Array<Pick<FranceTlsReplacementAccountRow, "id" | "account_email" | "account_status">>;
}): FranceTlsAccountReplacementPlan {
  const applicantAlias = input.applicantAlias.trim().toLowerCase();
  if (!applicantAlias) throw new Error("Applicant inbox alias is missing");
  const activeAccounts = input.accounts.filter((account) => account.account_status !== "abandoned");
  const matchingAccounts = activeAccounts.filter(
    (account) => account.account_email?.trim().toLowerCase() === applicantAlias,
  );
  const reusableAccountId = matchingAccounts[0]?.id ?? null;
  return {
    reusableAccountId,
    accountIdsToAbandon: activeAccounts
      .filter((account) => account.id !== reusableAccountId)
      .map((account) => account.id),
  };
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

async function persistRecoveredPassword(
  context: FranceTlsStoredAccountContext,
  password: string,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("appointment_accounts")
    .update({
      encrypted_account_password: encryptSecret(password),
      account_status: "password_reset_completed",
      email_verified: true,
      metadata_redacted_json: {
        created_by: "france_tls_account_registration",
        account_email: "[REDACTED]",
        password_recovered_at: now,
      },
      updated_at: now,
    })
    .eq("id", context.accountId)
    .abortSignal(dbAbortSignal());
  if (error) throw new Error(`TLS recovered password persistence failed: ${error.message}`);
  context.password = password;
  context.accountStatus = "password_reset_completed";
  context.statusUpdatedAt = now;
  context.emailVerified = true;
}

async function abandonLegacyFranceTlsAccounts(applicationId: string): Promise<void> {
  const { data: application, error: applicationError } = await supabase
    .from("applications")
    .select("id,applicant_id,applicant_profiles!inner(inbox_alias)")
    .eq("id", applicationId)
    .abortSignal(dbAbortSignal())
    .maybeSingle();
  if (applicationError) throw new Error(`France application lookup failed: ${applicationError.message}`);
  if (!application) throw new Error("France application not found");
  const applicantId = requireString(application.applicant_id, "applications.applicant_id");
  const profile = firstRelation(application.applicant_profiles);
  const existingAlias = optionalString(profile?.inbox_alias)?.toLowerCase() ?? "";
  const aliasResult = existingAlias
    ? { alias: existingAlias, created: false }
    : await ensureApplicantInboxAlias(applicantId);
  await assertInboxAliasDomainRoutable(aliasResult.alias);

  const { data: accounts, error: accountsError } = await supabase
    .from("appointment_accounts")
    .select("id,account_email,account_status,email_verified,metadata_redacted_json")
    .eq("application_id", applicationId)
    .eq("country_code", "FR")
    .eq("portal", TLS_PORTAL)
    .order("updated_at", { ascending: false })
    .abortSignal(dbAbortSignal());
  if (accountsError) throw new Error(`TLS account lookup failed: ${accountsError.message}`);

  const rows = (accounts ?? []) as FranceTlsReplacementAccountRow[];
  const plan = planFranceTlsAccountReplacement({
    applicantAlias: aliasResult.alias,
    accounts: rows,
  });
  const abandonedAt = new Date().toISOString();
  const reusableAccount = rows.find((candidate) => candidate.id === plan.reusableAccountId);
  if (
    reusableAccount
    && isFranceTlsPreRegistrationRetryEligible({
      accountStatus: reusableAccount.account_status,
      emailVerified: Boolean(reusableAccount.email_verified),
    })
  ) {
    const existingMetadata = reusableAccount.metadata_redacted_json
      && typeof reusableAccount.metadata_redacted_json === "object"
      && !Array.isArray(reusableAccount.metadata_redacted_json)
      ? reusableAccount.metadata_redacted_json as Record<string, unknown>
      : {};
    const { error } = await supabase
      .from("appointment_accounts")
      .update({
        account_status: "account_prepared",
        metadata_redacted_json: {
          ...existingMetadata,
          account_email: "[REDACTED]",
          pre_registration_retry_authorized: true,
          pre_registration_retry_authorized_at: abandonedAt,
        },
        updated_at: abandonedAt,
      })
      .eq("id", reusableAccount.id)
      .in("account_status", ["manual_required", "registration_retryable_error"])
      .eq("email_verified", false)
      .abortSignal(dbAbortSignal());
    if (error) throw new Error(`TLS account retry preparation failed: ${error.message}`);
  }
  for (const accountId of plan.accountIdsToAbandon) {
    const account = rows.find((candidate) => candidate.id === accountId);
    const existingMetadata = account?.metadata_redacted_json
      && typeof account.metadata_redacted_json === "object"
      && !Array.isArray(account.metadata_redacted_json)
      ? account.metadata_redacted_json as Record<string, unknown>
      : {};
    const { error } = await supabase
      .from("appointment_accounts")
      .update({
        encrypted_account_password: null,
        password_vault_ref: null,
        account_status: "abandoned",
        metadata_redacted_json: {
          ...existingMetadata,
          account_email: "[REDACTED]",
          abandoned_by_user: true,
          abandonment_reason: "unreachable_account_email",
          abandoned_at: abandonedAt,
          credentials_revoked_from_viza: true,
        },
        updated_at: abandonedAt,
      })
      .eq("id", accountId)
      .neq("account_status", "abandoned")
      .abortSignal(dbAbortSignal());
    if (error) throw new Error(`TLS account abandonment failed: ${error.message}`);
  }
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
        .neq("account_status", "abandoned")
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
  const accountAlias = resolveFranceTlsAccountAlias({
    applicantAlias: aliasResult.alias,
    storedAccountAlias: optionalString(account?.account_email),
    emailVerified: Boolean(account?.email_verified),
  });
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
    alias: accountAlias,
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
    alias: accountAlias,
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

function observeBrowserbaseCaptcha(page: Page): () => Promise<void> {
  let startedCount = 0;
  let finishedCount = 0;
  const listener = (message: ConsoleMessage) => {
    if (["browserbase-solving-started", "browser-solving-started"].includes(message.text())) {
      startedCount += 1;
    }
    if ([
      "browserbase-solving-finished",
      "browser-solving-finished",
      "browser-solving-completed",
    ].includes(message.text())) {
      finishedCount += 1;
    }
  };
  page.on("console", listener);
  return async () => {
    try {
      const detectionDeadline = Date.now() + 5_000;
      while (Date.now() < detectionDeadline && startedCount === 0) {
        await page.waitForTimeout(250);
      }
      const finishDeadline = Date.now() + 35_000;
      while (Date.now() < finishDeadline && finishedCount < startedCount) {
        await page.waitForTimeout(500);
      }
    } finally {
      page.off("console", listener);
    }
  };
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

async function navigateFranceTlsPage(page: Page, url: string): Promise<void> {
  const transientCodes = new Set([
    "ERR_TUNNEL_CONNECTION_FAILED",
    "ERR_PROXY_CONNECTION_FAILED",
    "ERR_CONNECTION_RESET",
    "ERR_CONNECTION_CLOSED",
  ]);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const code = message.match(/net::(ERR_[A-Z_]+)/)?.[1] ?? null;
      if (!code || !transientCodes.has(code) || attempt === 2) {
        throw new Error(`TLS official navigation failed (${code ?? "browser_error"})`);
      }
      await page.waitForTimeout((attempt + 1) * 2_000);
    }
  }
}

async function navigateToCenter(page: Page, centerPath: string): Promise<void> {
  const centerUrl = new URL(centerPath, "https://visas-fr.tlscontact.com").href;
  await navigateFranceTlsPage(page, centerUrl);
  await settle(page);
  await dismissConsentBanner(page);
}

async function reachCenter(
  page: Page,
  centerPath: string,
  refreshRetries: number,
  centerName?: string,
): Promise<void> {
  await navigateFranceTlsPage(page, "https://visas-fr.tlscontact.com/en-us");
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
  const waitForResidenceCaptcha = observeBrowserbaseCaptcha(page);
  const residenceConfirmed = await clickFirstVisible([
    page.locator("#btn-confirm-country"),
    page.getByRole("link", { name: /^confirm$/i }),
    page.getByRole("button", { name: /^confirm$/i }),
    page.locator("button, a, [role='button']").filter({ hasText: /^confirm$/i }),
  ]);
  if (!residenceConfirmed) {
    await waitForResidenceCaptcha();
    await navigateToCenter(page, centerPath);
    return;
  }
  await clickFirstVisible([page.locator("#btn-yes"), page.getByRole("button", { name: /^yes$/i })]);
  await waitForResidenceCaptcha();
  await settle(page);
  await dismissConsentBanner(page);
  const centerLink = page.locator(`a[href*="${centerPath}"]`).first();
  let centerControl: Locator | null = await centerLink.isVisible({ timeout: 5_000 }).catch(() => false)
    ? centerLink
    : null;
  if (!centerControl && centerName) {
    const centerHeading = page.getByText(new RegExp(`^${centerName}$`, "i")).first();
    if (await centerHeading.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const centerCard = centerHeading.locator(
        "xpath=ancestor::*[.//button[normalize-space()='Continue'] or .//a[normalize-space()='Continue']][1]",
      );
      const continueControl = centerCard.getByRole("button", { name: /^continue$/i }).first();
      const continueLink = centerCard.getByRole("link", { name: /^continue$/i }).first();
      centerControl = await continueControl.isVisible({ timeout: 2_000 }).catch(() => false)
        ? continueControl
        : await continueLink.isVisible({ timeout: 2_000 }).catch(() => false)
          ? continueLink
          : null;
    }
  }
  if (!centerControl) {
    await navigateToCenter(page, centerPath);
    return;
  }
  const waitForCenterCaptcha = observeBrowserbaseCaptcha(page);
  const centerClicked = await clickFirstVisible([centerControl]);
  if (!centerClicked) {
    await waitForCenterCaptcha();
    throw new Error("TLS center selection control could not be activated");
  }
  await waitForCenterCaptcha();
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
  let waitForRegistrationCaptcha = observeBrowserbaseCaptcha(page);
  let clicked = await clickFirstVisible([
    page.getByRole("link", { name: /register|create account|new user/i }),
    page.getByRole("button", { name: /register|create account|new user/i }),
  ]);
  if (!clicked) {
    await waitForRegistrationCaptcha();
    waitForRegistrationCaptcha = observeBrowserbaseCaptcha(page);
    clicked = await clickFirstVisible([
      page.getByRole("link", { name: /log in|sign in/i }),
      page.getByRole("button", { name: /log in|sign in/i }),
    ]);
    if (clicked) {
      await waitForRegistrationCaptcha();
      await settle(page);
      waitForRegistrationCaptcha = observeBrowserbaseCaptcha(page);
      clicked = await clickFirstVisible([
        page.getByRole("link", { name: /register|create account|new user/i }),
        page.getByRole("button", { name: /register|create account|new user/i }),
      ]);
    }
  }
  if (!clicked) {
    await waitForRegistrationCaptcha();
    throw new Error("TLS registration entry was not found");
  }
  await waitForRegistrationCaptcha();
  await settle(page);
  const emailField = page.locator("#email, input[name='email']").first();
  if (!await emailField.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await navigateFranceTlsPage(page, "https://visas-fr.tlscontact.com/en-us/registration");
    await settle(page);
  }
  if (!await emailField.isVisible({ timeout: 10_000 }).catch(() => false)) {
    const state = classifyFranceTlsBrowserState(await readFranceTlsBrowserState(page));
    await maskedScreenshot(page, "registration-form-unavailable");
    throw new Error(
      `TLS registration form unavailable (${state.checkpoint} at ${redactOfficialUrl(page.url())})`,
    );
  }
}

async function reachFranceTlsRegistrationForm(input: {
  page: Page;
  centerPath: string;
  centerName: string;
  refreshRetries: number;
}): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await reachCenter(
        input.page,
        input.centerPath,
        input.refreshRetries,
        input.centerName,
      );
      await reachRegistrationForm(input.page);
      return;
    } catch (error) {
      if (attempt === 1 || !isRetryableFranceTlsRegistrationNavigationError(error)) throw error;
      await input.page.waitForTimeout(2_000);
    }
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
  const waitForResponse = async (timeoutMs: number): Promise<boolean> => timeoutMs > 0
    ? page.waitForFunction(() => {
        const element = document.querySelector<HTMLTextAreaElement | HTMLInputElement>(
          "textarea[name='g-recaptcha-response'], input[name='g-recaptcha-response']",
        );
        return Boolean(element?.value.trim());
      }, undefined, { timeout: timeoutMs }).then(() => true).catch(() => false)
    : response.inputValue().then((value) => Boolean(value.trim())).catch(() => false);

  const providerWaitMs = options.providerWaitMs ?? 30_000;
  const solved = await waitForResponse(providerWaitMs);
  if (solved) return;

  // Browserbase can detect reCAPTCHA before the checkbox has opened the
  // interactive challenge, but a solve may never complete in that state. Give
  // the provider one bounded post-click window, then use the existing GridTask
  // solver only when a real image grid is visible in this same Browserbase
  // session. This never launches or falls back to a different browser.
  const anchor = page
    .frameLocator('iframe[src*="recaptcha"][src*="anchor"]')
    .locator("#recaptcha-anchor")
    .first();
  if (await anchor.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await anchor.click({ timeout: 5_000 }).catch(() => undefined);
    if (await waitForResponse(Math.min(35_000, Math.max(10_000, providerWaitMs)))) return;

    const gridOutcome = await solveVisibleRecaptchaGridChallenge(page, {
      maxRounds: 2,
      timeoutMs: resolveFranceTlsCaptchaAttemptTimeoutMs(
        process.env.FRANCE_TLS_RECAPTCHA_TIMEOUT_MS,
      ),
    });
    if (gridOutcome.status === "solved") {
      if (await waitForResponse(10_000)) return;
      throw new Error("TLS reCAPTCHA grid closed without a verified response token");
    }
    if (gridOutcome.status === "failed") {
      throw new Error(`TLS reCAPTCHA grid solve failed: ${gridOutcome.reason}`);
    }
  }

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

  const timeoutMs = resolveFranceTlsCaptchaAttemptTimeoutMs(
    process.env.FRANCE_TLS_RECAPTCHA_TIMEOUT_MS,
  );
  let result: Awaited<ReturnType<typeof solveCaptcha>> | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      result = await solveCaptcha({
        type: "recaptcha-v2",
        siteKey,
        pageUrl: page.url(),
        timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 180_000,
      });
      break;
    } catch (error) {
      if (attempt === 1 || !isRetryableFranceTlsCaptchaSolveError(error)) throw error;
      await page.waitForTimeout(2_000);
    }
  }
  if (!result) throw new Error("TLS reCAPTCHA solver did not return a result");
  const token = result.text.trim();
  if (!token) throw new Error("TLS reCAPTCHA solver returned an empty token");
  await page.evaluate((captchaToken) => {
    const recaptchaWindow = window as Window & { ___grecaptcha_cfg?: { clients?: Record<string, unknown> } };
    for (const client of Object.values(recaptchaWindow.___grecaptcha_cfg?.clients ?? {})) {
      const pending: unknown[] = [client];
      const seen = new Set<unknown>();
      while (pending.length > 0) {
        const value = pending.pop();
        if (!value || typeof value !== "object" || seen.has(value)) continue;
        seen.add(value);
        for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
          if (key === "callback" && typeof child === "function") {
            try {
              (child as (tokenValue: string) => void)(captchaToken);
            } catch {
              // Continue through other registered reCAPTCHA clients.
            }
          } else {
            pending.push(child);
          }
        }
      }
    }
    const fields = Array.from(document.querySelectorAll<HTMLTextAreaElement | HTMLInputElement>(
      "textarea[name='g-recaptcha-response'], input[name='g-recaptcha-response']",
    ));
    for (const field of fields) {
      field.value = captchaToken;
      field.innerHTML = captchaToken;
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
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
  await updateAccountStatus(context, "registration_submitting", false);
  await page.locator("button#submit, button[type='submit']").first().click({ timeout: 15_000 });
  await settle(page);
  const invalidFields = await page.locator(":invalid").evaluateAll((elements) => elements.map((element) => {
    const input = element as HTMLInputElement;
    return input.name || input.id || input.type || element.tagName.toLowerCase();
  })).catch(() => [] as string[]);
  if (invalidFields.length) throw new Error(`TLS registration validation failed: ${invalidFields.join(", ")}`);
  evidence.push(await maskedScreenshot(page, "registration-submitted"));
  const bodyText = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
  const resultState = classifyFranceTlsRegistrationResult({
    url: page.url(),
    bodyText,
  });
  if (resultState === "retryable_error") {
    await updateAccountStatus(context, "registration_retryable_error", false);
    throw new Error("TLScontact returned a retryable registration service error");
  }
  if (resultState !== "success") {
    await updateAccountStatus(context, "registration_result_unverified", false);
    throw new Error("TLScontact did not confirm account registration");
  }
  return evidence;
}

async function activateAccount(page: Page, context: FranceTlsStoredAccountContext, since: string, timeoutMs: number): Promise<void> {
  const message = await waitForFranceTlsActivationEmail(context.applicantId, timeoutMs, {
    since,
    includeProcessed: true,
  });
  await navigateFranceTlsPage(page, message.activationUrl.href);
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

async function reachLoginForm(
  page: Page,
  centerUrl: string,
): Promise<"authenticated" | "login_form"> {
  const hasPassword = await page.locator("input[type='password']").first().isVisible({ timeout: 3_000 }).catch(() => false);
  if (hasPassword) return "login_form";

  // Enter through TLScontact's residence/centre chooser instead of relying
  // on a direct centre deep link. The official site can return a generic
  // error or omit the login controls for direct Browserbase navigation even
  // though the same centre is reachable through the public chooser.
  const centerPath = new URL(centerUrl).pathname;
  const centerName = FRANCE_TLS_CHINA_CENTERS.find(
    (center) => new URL(center.bookingUrl).pathname === centerPath,
  )?.cityEn;
  await reachCenter(page, centerPath, 2, centerName);
  const authenticatedPageVisible = /\/(?:travel-groups|[^/]+\/workflow\/)/i.test(page.url())
    || await page.getByText(/application list/i).first().isVisible({ timeout: 3_000 }).catch(() => false);
  if (authenticatedPageVisible) return "authenticated";

  const loginEntryClicked = await clickFirstVisible([
    page.getByRole("link", { name: /log in|sign in/i }),
    page.getByRole("button", { name: /log in|sign in/i }),
    page.locator("a[href*='/login'], a[href*='/auth/']").filter({ hasText: /log\s*in|sign\s*in/i }),
    page.locator("a, button, [role='button']").filter({ hasText: /^\s*(?:log\s*in|sign\s*in)\s*$/i }),
  ]);
  if (loginEntryClicked) {
    await settle(page);
  } else {
    // The current TLS shell sometimes omits the header login link while the
    // canonical same-origin login route remains available after centre
    // selection. This is a navigation-only fallback and never submits data.
    await navigateFranceTlsPage(page, new URL("/en-us/login", centerUrl).href);
    await settle(page);
  }

  const loginReady = await page.locator("input[type='password']").first()
    .isVisible({ timeout: 10_000 }).catch(() => false);
  if (loginReady) return "login_form";

  const finalInput = await readFranceTlsBrowserState(page);
  const finalState = classifyFranceTlsBrowserState(finalInput);
  await maskedScreenshot(page, "login-entry-missing").catch(() => null);
  if (finalState.checkpoint === "waf" && isFranceTlsWaitingRoomText(finalInput.bodyText)) {
    throw new Error("TLS Cloudflare waiting room did not clear within the Browserbase wait window");
  }
  if (finalState.checkpoint === "waf" && isFranceTlsSecurityVerificationText(finalInput.bodyText)) {
    throw new Error("TLS Cloudflare security verification did not clear within the Browserbase wait window");
  }
  throw new Error(
    `TLS login entry was not found after activation (checkpoint: ${finalState.checkpoint}; url: ${redactOfficialUrl(finalInput.url)})`,
  );
}

async function login(page: Page, context: FranceTlsStoredAccountContext, centerUrl: string): Promise<void> {
  if (await reachLoginForm(page, centerUrl) === "authenticated") {
    await updateAccountStatus(context, "logged_in", true);
    return;
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
    await navigateFranceTlsPage(page, observedWorkflowUrl);
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

async function finishFranceTlsAccountPreparation(input: {
  page: Page;
  context: FranceTlsStoredAccountContext;
  center: NonNullable<ReturnType<typeof resolveFranceTlsCenter>>;
  provider: string;
  evidence: string[];
  shouldFillReference: boolean;
}): Promise<FranceTlsAccountRegistrationResult> {
  input.evidence.push(await maskedScreenshot(input.page, "logged-in"));
  if (input.shouldFillReference) {
    const visibleUnmappedFields = await fillOfficialReference(
      input.page,
      input.context,
      new URL(input.center.bookingUrl).pathname,
    );
    input.evidence.push(await maskedScreenshot(input.page, "appointment-reference"));
    if (visibleUnmappedFields.length) {
      const officialCheckpoint = visibleUnmappedFields.find((field) =>
        field.startsWith("official_checkpoint_"),
      );
      const applicantReviewRequired = visibleUnmappedFields[0] === "applicant_profile_fields"
        || visibleUnmappedFields[0] === "applicant_profile_review_required";
      await updateAccountStatus(input.context, "manual_required", true);
      return {
        status: "manual_required",
        accountId: input.context.accountId,
        provider: input.provider,
        centerCode: input.center.code,
        finalUrl: redactOfficialUrl(input.page.url()),
        replayUrl: null,
        evidence: input.evidence,
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
    status: input.shouldFillReference ? "appointment_reference_filled" : "logged_in",
    accountId: input.context.accountId,
    provider: input.provider,
    centerCode: input.center.code,
    finalUrl: redactOfficialUrl(input.page.url()),
    replayUrl: null,
    evidence: input.evidence,
    stopPoint: input.shouldFillReference
      ? "The France-Visas reference was prepared. Stopped before slot selection, payment, or booking."
      : "Stopped after login and before reference preparation, slot selection, payment, or booking.",
  };
}

function passwordResetCaptchaWaitMs(): number {
  const configured = Number.parseInt(
    process.env.FRANCE_TLS_BROWSERBASE_CAPTCHA_WAIT_MS ?? "45000",
    10,
  );
  return Number.isFinite(configured) && configured >= 0 ? configured : 45_000;
}

async function solvePasswordResetCaptchaIfPresent(page: Page): Promise<void> {
  const field = page.locator(
    "textarea[name='g-recaptcha-response'], input[name='g-recaptcha-response']",
  ).first();
  if (await field.count() === 0) return;
  await ensureRecaptchaToken(page, {
    providerWaitMs: passwordResetCaptchaWaitMs(),
    required: true,
  });
}

async function resetFranceTlsAccountPassword(input: {
  page: Page;
  context: FranceTlsStoredAccountContext;
  centerUrl: string;
  emailTimeoutMs: number;
  evidence: string[];
}): Promise<"already_authenticated" | "password_reset"> {
  if (await reachLoginForm(input.page, input.centerUrl) === "authenticated") {
    await updateAccountStatus(input.context, "logged_in", true);
    return "already_authenticated";
  }

  const forgotPasswordClicked = await clickFirstVisible([
    input.page.getByRole("link", { name: /forgot.{0,20}password|reset.{0,20}password/i }),
    input.page.getByRole("button", { name: /forgot.{0,20}password|reset.{0,20}password/i }),
    input.page.locator("a[href*='reset-credentials'], a[href*='forgot'], a[href*='reset']"),
  ]);
  if (!forgotPasswordClicked) {
    input.evidence.push(await maskedScreenshot(input.page, "password-reset-entry-missing"));
    throw new Error("TLS forgot-password entry was not found on the official login page");
  }
  await settle(input.page);

  const accountEmail = input.page.locator(
    "#username, #email-input-field, input[type='email'], input[name='username'], input[name='email']",
  ).first();
  if (!await accountEmail.isVisible({ timeout: 10_000 }).catch(() => false)) {
    input.evidence.push(await maskedScreenshot(input.page, "password-reset-email-missing"));
    throw new Error("TLS password-reset email field was not found");
  }
  await accountEmail.fill(input.context.alias);
  await solvePasswordResetCaptchaIfPresent(input.page);
  const requestedAt = new Date().toISOString();
  input.evidence.push(await maskedScreenshot(input.page, "password-reset-request-ready"));
  const requestSubmitted = await clickFirstVisible([
    input.page.getByRole("button", { name: /confirm|submit|continue|send|reset/i }),
    input.page.locator("button[type='submit'], input[type='submit']"),
  ]);
  if (!requestSubmitted) throw new Error("TLS password-reset request control was not found");
  await settle(input.page);
  input.evidence.push(await maskedScreenshot(input.page, "password-reset-requested"));
  await updateAccountStatus(input.context, "password_reset_email_requested", true);

  const resetEmail = await waitForFranceTlsPasswordResetEmail({
    applicationId: input.context.applicationId,
    applicantId: input.context.applicantId,
    accountId: input.context.accountId,
  }, input.emailTimeoutMs, {
    since: requestedAt,
    includeProcessed: true,
  });
  await navigateFranceTlsPage(input.page, resetEmail.resetUrl.href);
  await settle(input.page);

  const passwordInputs = input.page.locator("input[type='password']:visible");
  if (await passwordInputs.count() < 2) {
    input.evidence.push(await maskedScreenshot(input.page, "password-reset-fields-missing"));
    throw new Error("TLS password-reset confirmation fields were not found");
  }
  const replacementPassword = generateFranceTlsAccountPassword();
  await passwordInputs.nth(0).fill(replacementPassword);
  await passwordInputs.nth(1).fill(replacementPassword);
  await solvePasswordResetCaptchaIfPresent(input.page);
  input.evidence.push(await maskedScreenshot(input.page, "password-reset-confirm-ready"));
  const resetSubmitted = await clickFirstVisible([
    input.page.getByRole("button", { name: /submit|continue|save|reset|change password/i }),
    input.page.locator("button[type='submit'], input[type='submit']"),
  ]);
  if (!resetSubmitted) throw new Error("TLS password-reset confirmation control was not found");
  await settle(input.page);

  const resetBody = await input.page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
  const invalidFields = await input.page.locator(":invalid").count().catch(() => 0);
  if (invalidFields > 0 || /invalid|expired|failed|do not match|must not match/i.test(resetBody)) {
    input.evidence.push(await maskedScreenshot(input.page, "password-reset-rejected"));
    throw new Error("TLScontact rejected the replacement password or reset link");
  }
  const loginUsernameVisible = await input.page.locator(
    "#email-input-field, input[type='email'], input[name='username'], input[name='email']",
  ).first().isVisible({ timeout: 3_000 }).catch(() => false);
  const returnedToLogin = loginUsernameVisible
    && !/action-token|execute-actions|required-action/i.test(input.page.url());
  if (!isFranceTlsPasswordResetCompletedText(resetBody) && !returnedToLogin) {
    input.evidence.push(await maskedScreenshot(input.page, "password-reset-unverified"));
    throw new Error("TLScontact did not show a verified password-reset completion state");
  }

  await persistRecoveredPassword(input.context, replacementPassword);
  input.evidence.push(await maskedScreenshot(input.page, "password-reset-completed"));
  return "password_reset";
}

export async function recoverAndPrepareFranceTlsAccount(
  input: FranceTlsAccountRecoveryInput,
): Promise<FranceTlsAccountRegistrationResult> {
  const center = resolveFranceTlsCenter(input.centerCode);
  if (!center) throw new Error("Unsupported TLScontact China center");
  const shouldFillReference = input.fillOfficialReference !== false;
  const context = await loadRegistrationContext(input.applicationId, shouldFillReference);
  if (!context.emailVerified) {
    throw new Error("TLS account password recovery requires an email-verified account");
  }
  try {
    await assertAppointmentAccountInboxRoutable({
      applicationId: context.applicationId,
      applicantId: context.applicantId,
      accountId: context.accountId,
      portal: TLS_PORTAL,
    });
  } catch (error) {
    await updateAccountStatus(context, "manual_required", true).catch(() => undefined);
    throw error;
  }
  const session = await createFranceTlsBrowserSession();
  const evidence: string[] = [];
  try {
    if (context.accountStatus !== "password_reset_completed") {
      await resetFranceTlsAccountPassword({
        page: session.page,
        context,
        centerUrl: center.bookingUrl,
        emailTimeoutMs: input.emailTimeoutMs ?? 600_000,
        evidence,
      });
    }
    await login(session.page, context, center.bookingUrl);
    return finishFranceTlsAccountPreparation({
      page: session.page,
      context,
      center,
      provider: session.provider,
      evidence,
      shouldFillReference,
    });
  } catch (error) {
    if (context.accountStatus !== "password_reset_email_requested") {
      await updateAccountStatus(context, "manual_required", true).catch(() => undefined);
    }
    throw error;
  } finally {
    await closeFranceTlsBrowserSession(session);
  }
}

export async function registerAndPrepareFranceTlsAccount(
  input: FranceTlsAccountRegistrationInput,
): Promise<FranceTlsAccountRegistrationResult> {
  const center = resolveFranceTlsCenter(input.centerCode);
  if (!center) throw new Error("Unsupported TLScontact China center");
  const shouldFillReference = input.fillOfficialReference !== false;
  const context = await loadRegistrationContext(input.applicationId, shouldFillReference);
  if (!context.emailVerified && input.submitRegistration) {
    await assertAppointmentAccountInboxRoutable({
      applicationId: context.applicationId,
      applicantId: context.applicantId,
      accountId: context.accountId,
      portal: TLS_PORTAL,
    });
  }
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
        await reachFranceTlsRegistrationForm({
          page: session.page,
          centerPath: new URL(center.bookingUrl).pathname,
          centerName: center.cityEn,
          refreshRetries: input.refreshRetries ?? 2,
        });
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
    return finishFranceTlsAccountPreparation({
      page: session.page,
      context,
      center,
      provider: session.provider,
      evidence,
      shouldFillReference,
    });
  } catch (error) {
    if (isRetryableFranceTlsBrowserSessionError(error)) {
      await updateAccountStatus(
        context,
        "browser_session_retryable_error",
        context.emailVerified,
      ).catch(() => undefined);
    } else if (!shouldPreserveFranceTlsRegistrationStatus(context.accountStatus)) {
      await updateAccountStatus(context, "manual_required", context.emailVerified).catch(() => undefined);
    }
    throw error;
  } finally {
    await closeFranceTlsBrowserSession(session);
  }
}

export async function abandonAndRegisterFranceTlsAccount(
  input: FranceTlsAccountReplacementInput,
): Promise<FranceTlsAccountRegistrationResult> {
  await abandonLegacyFranceTlsAccounts(input.applicationId);
  return registerAndPrepareFranceTlsAccount(input);
}
