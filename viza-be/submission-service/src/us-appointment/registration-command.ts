import type {
  AppointmentAccountCredentials,
  AppointmentPortalGate,
  AppointmentPreparationResult,
  USAppointmentRunnerConfig,
  USAppointmentJobRow,
} from "./runner";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const COMPLETED_ACCOUNT_STATUSES = new Set([
  "created",
  "active",
  "verified",
  "registered",
  "logged_in",
  "account_created",
  "account_active",
  "account_verified",
]);

const REGISTRATION_ACCOUNT_STATUSES = new Set([
  "account_creation_started",
  "registration_started",
  "verification_pending",
  "account_email_verification",
]);

const REGISTRATION_JOB_STATUSES = new Set([
  "appointment_consent_received",
  "appointment_account_required",
  "appointment_account_creation_started",
  "appointment_email_verification_required",
  "appointment_login_required",
]);

const ALLOWED_MANUAL_ACTIONS = new Set([
  "login",
  "account_email_verification",
]);

export interface USAppointmentRegistrationCliArgs {
  applicationId: string;
  browserbase: boolean;
  localBrowser: boolean;
  headless: boolean;
  credentialConfig: string | null;
  continueToAppointment: boolean;
}

export type RegistrationBrowserMode = "browserbase" | "configured" | "local";

/**
 * Build the isolated browser configuration used by the registration CLI.
 * Browserbase and local runs receive their own page/context, so inherited
 * CDP bridge endpoints must not redirect the portal client to another browser.
 */
export function prepareRegistrationBrowserConfig(
  config: USAppointmentRunnerConfig,
  browserMode: RegistrationBrowserMode,
  headless: boolean,
): USAppointmentRunnerConfig {
  const isolatedBrowser = browserMode === "browserbase" || browserMode === "local";
  return {
    ...config,
    playwrightHeadless: headless,
    playwrightStorageStatePath: null,
    ...(isolatedBrowser
      ? { playwrightCdpEndpoint: null, localCdpEndpoint: null }
      : {}),
  };
}

export interface USAppointmentRegistrationPreflightConfig {
  enabled: boolean;
  providerAllowlist: string[];
  supportedCountries: string[];
  playwrightEnabled: boolean;
  playwrightCdpEndpoint: string | null;
}

export interface USAppointmentRegistrationPreflightInput {
  applicationId: string;
  job: USAppointmentJobRow | null;
  credentials: AppointmentAccountCredentials | null;
  consentCompleted: boolean;
  config: USAppointmentRegistrationPreflightConfig;
  browserMode: RegistrationBrowserMode;
  browserbaseApiKeyConfigured: boolean;
}

export interface USAppointmentRegistrationInboxRepository {
  assertAccountRegistrationInboxRoutable(job: USAppointmentJobRow): Promise<void>;
}

export interface USAppointmentRegistrationPreflightSuccess {
  ok: true;
  applicationId: string;
  jobId: string;
  job: USAppointmentJobRow;
  credentials: AppointmentAccountCredentials;
}

export interface USAppointmentRegistrationPreflightFailure {
  ok: false;
  code: string;
  message: string;
}

export type USAppointmentRegistrationPreflightResult =
  | USAppointmentRegistrationPreflightSuccess
  | USAppointmentRegistrationPreflightFailure;

function normalized(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function normalizedLower(value: string | null | undefined): string {
  return normalized(value).toLowerCase();
}

function normalizeProvider(value: string | null | undefined): string {
  return normalizedLower(value).replace(/[^a-z0-9]+/g, "");
}

function normalizeCountry(value: string | null | undefined): string {
  return normalized(value).toUpperCase();
}

function parseNamedValue(
  argv: readonly string[],
  name: string,
): string | undefined {
  const inlinePrefix = `--${name}=`;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === `--${name}`) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`--${name} requires a value.`);
      }
      return value;
    }
    if (token.startsWith(inlinePrefix)) {
      const value = token.slice(inlinePrefix.length);
      if (!value) throw new Error(`--${name} requires a value.`);
      return value;
    }
  }
  return undefined;
}

function parseBooleanValue(
  argv: readonly string[],
  name: string,
  fallback: boolean,
): boolean {
  const bareFlag = `--${name}`;
  const inlinePrefix = `${bareFlag}=`;
  const inline = argv.find((token) => token.startsWith(inlinePrefix));
  if (inline) {
    return !["0", "false", "no"].includes(
      inline.slice(inlinePrefix.length).trim().toLowerCase(),
    );
  }
  const bareIndex = argv.indexOf(bareFlag);
  if (bareIndex >= 0 && (!argv[bareIndex + 1] || argv[bareIndex + 1].startsWith("--"))) {
    return true;
  }
  const value = parseNamedValue(argv, name);
  if (value === undefined) return fallback;
  return !["0", "false", "no"].includes(value.trim().toLowerCase());
}

function assertKnownRegistrationOption(token: string): void {
  if (
    token === "--browserbase"
    || token === "--local-browser"
    || token === "--headless"
    || token.startsWith("--headless=")
    || token === "--application-id"
    || token.startsWith("--application-id=")
    || token === "--credential-config"
    || token.startsWith("--credential-config=")
    || token === "--continue-to-appointment"
    || token.startsWith("--continue-to-appointment=")
  ) {
    return;
  }
  throw new Error("Unsupported registration option.");
}

export function parseUSAppointmentRegistrationArgs(
  argv: readonly string[],
  env: Record<string, string | undefined> = process.env,
): USAppointmentRegistrationCliArgs {
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) throw new Error("Registration arguments must use named options.");
    assertKnownRegistrationOption(token);
    if (
      (token === "--application-id"
        || token === "--credential-config"
        || token === "--headless"
        || token === "--continue-to-appointment")
      && argv[index + 1]
      && !argv[index + 1].startsWith("--")
    ) {
      index += 1;
    }
  }

  const applicationId = (
    parseNamedValue(argv, "application-id")
    ?? ""
  ).trim();
  if (!UUID_PATTERN.test(applicationId)) {
    throw new Error("--application-id must be a valid application UUID.");
  }

  const browserbase = argv.includes("--browserbase");
  const localBrowser = argv.includes("--local-browser");
  if (browserbase && localBrowser) {
    throw new Error("--browserbase and --local-browser cannot be used together.");
  }

  const credentialConfig = (
    parseNamedValue(argv, "credential-config")
    ?? env.US_APPOINTMENT_CREDENTIAL_CONFIG
    ?? ""
  ).trim() || null;

  return {
    applicationId,
    browserbase,
    localBrowser,
    headless: parseBooleanValue(
      argv,
      "headless",
      env.US_APPOINTMENT_PLAYWRIGHT_HEADLESS !== "false",
    ),
    credentialConfig,
    continueToAppointment: parseBooleanValue(
      argv,
      "continue-to-appointment",
      false,
    ),
  };
}

function failure(code: string, message: string): USAppointmentRegistrationPreflightFailure {
  return { ok: false, code, message };
}

function validateBrowserPreflight(
  input: USAppointmentRegistrationPreflightInput,
): USAppointmentRegistrationPreflightFailure | null {
  if (!input.config.enabled) {
    return failure(
      "assisted_live_disabled",
      "US appointment assisted-live automation is disabled.",
    );
  }
  if (!input.config.playwrightEnabled) {
    return failure(
      "playwright_disabled",
      "US appointment Playwright automation is disabled.",
    );
  }

  if (input.browserMode === "browserbase" && !input.browserbaseApiKeyConfigured) {
    return failure(
      "browser_credentials_missing",
      "Browserbase is selected but its configured API key is unavailable.",
    );
  }

  if (input.browserMode === "configured" && !normalized(input.config.playwrightCdpEndpoint)) {
    return failure(
      "browser_configuration_required",
      "A managed browser endpoint is required unless --local-browser is used.",
    );
  }

  return null;
}

function validateJobPreflight(
  input: USAppointmentRegistrationPreflightInput,
): USAppointmentRegistrationPreflightFailure | null {
  const { applicationId, job, config } = input;
  if (!job) return failure("application_job_not_found", "No US appointment job exists for this application.");
  if (job.application_id !== applicationId) {
    return failure("application_ownership_mismatch", "The selected job does not belong to the requested application.");
  }
  if (!normalized(job.user_id)) {
    return failure("application_owner_missing", "The selected appointment job has no VIZA owner.");
  }
  if (normalizeProvider(job.scheduling_provider) !== "usvisascheduling") {
    return failure("unsupported_appointment_provider", "The selected job is not a USVisaScheduling job.");
  }
  if (normalizeCountry(job.applying_country_code) !== "CN") {
    return failure("unsupported_appointment_country", "The registration command only supports China mainland appointments.");
  }
  if (normalizedLower(job.mode) !== "assisted_live") {
    return failure("assisted_live_required", "Official account registration requires an assisted-live appointment job.");
  }
  if (!input.consentCompleted) {
    return failure(
      "appointment_consent_required",
      "Explicit appointment consent is required before account registration.",
    );
  }
  if (!REGISTRATION_JOB_STATUSES.has(normalizedLower(job.status))) {
    return failure("registration_not_allowed_for_job", "The appointment job is not at an account-registration checkpoint.");
  }
  if (
    job.requires_user_action === true
    && !ALLOWED_MANUAL_ACTIONS.has(normalizedLower(job.current_manual_action))
  ) {
    return failure("appointment_checkpoint_pending", "Another appointment checkpoint is pending for this application.");
  }
  if (
    config.providerAllowlist.map(normalizeProvider).includes("usvisascheduling") === false
    || config.supportedCountries.map(normalizeCountry).includes("CN") === false
  ) {
    return failure("appointment_target_not_allowed", "The configured appointment target does not allow CN USVisaScheduling.");
  }
  if (!normalized(job.appointment_account_id)) {
    return failure("appointment_account_missing", "The appointment job has no provisioned account record.");
  }
  return null;
}

function validateAccountPreflight(
  credentials: AppointmentAccountCredentials | null,
): USAppointmentRegistrationPreflightFailure | null {
  if (!credentials) {
    return failure("stored_credentials_missing", "The selected application has no stored official account credentials.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized(credentials.email))) {
    return failure("stored_account_email_invalid", "The stored official account email is invalid.");
  }
  if (!normalized(credentials.password)) {
    return failure("stored_account_password_missing", "The selected application has no usable stored account password.");
  }
  if (!normalized(credentials.givenName)) {
    return failure("applicant_given_name_missing", "The applicant's English given name is required for registration.");
  }
  if (!normalized(credentials.surname)) {
    return failure("applicant_surname_missing", "The applicant's English surname is required for registration.");
  }

  const accountStatus = normalizedLower(credentials.accountStatus);
  if (credentials.emailVerified === true || COMPLETED_ACCOUNT_STATUSES.has(accountStatus)) {
    return failure(
      "account_already_created",
      "The stored official account is already created or verified; use the login smoke command instead of registering a duplicate.",
    );
  }
  if (!REGISTRATION_ACCOUNT_STATUSES.has(accountStatus)) {
    return failure(
      "account_status_not_registration_pending",
      "The stored official account is not in an explicit uncreated or registration-pending state.",
    );
  }
  return null;
}

export function validateUSAppointmentRegistrationPreflight(
  input: USAppointmentRegistrationPreflightInput,
): USAppointmentRegistrationPreflightResult {
  if (!UUID_PATTERN.test(input.applicationId.trim())) {
    return failure("application_id_invalid", "The application identifier is invalid.");
  }

  const browserFailure = validateBrowserPreflight(input);
  if (browserFailure) return browserFailure;

  const jobFailure = validateJobPreflight(input);
  if (jobFailure) return jobFailure;

  const accountFailure = validateAccountPreflight(input.credentials);
  if (accountFailure) return accountFailure;

  return {
    ok: true,
    applicationId: input.applicationId.trim(),
    jobId: input.job?.id ?? "",
    job: input.job as USAppointmentJobRow,
    credentials: input.credentials as AppointmentAccountCredentials,
  };
}

/**
 * Run all synchronous safety checks and then prove that the provisioned alias
 * can receive the verification message. The caller must create a browser only
 * after this function returns an `{ ok: true }` result.
 */
export async function validateUSAppointmentRegistrationPreflightWithInbox(
  input: USAppointmentRegistrationPreflightInput,
  inboxRepository: USAppointmentRegistrationInboxRepository,
): Promise<USAppointmentRegistrationPreflightResult> {
  const staticResult = validateUSAppointmentRegistrationPreflight(input);
  if (!staticResult.ok) return staticResult;
  try {
    await inboxRepository.assertAccountRegistrationInboxRoutable(staticResult.job);
  } catch {
    return failure(
      "registration_inbox_unavailable",
      "The provisioned registration inbox cannot be reached; no verification code was requested.",
    );
  }
  return staticResult;
}

export function registrationSucceeded(
  result: AppointmentPreparationResult,
): boolean {
  return !result.gate
    && !result.errorCode
    && !result.errorMessage
    && result.emailVerified === true
    && result.accountCreated === true;
}

export function shouldContinueToAppointment(
  requested: boolean,
  registration: AppointmentPreparationResult,
): boolean {
  return requested && registrationSucceeded(registration);
}

export async function continueToAppointmentAfterRegistration(
  input: {
    requested: boolean;
    registration: AppointmentPreparationResult;
    credentials: AppointmentAccountCredentials;
    prepare: (credentials: AppointmentAccountCredentials) => Promise<AppointmentPreparationResult>;
  },
): Promise<AppointmentPreparationResult | null> {
  if (!shouldContinueToAppointment(input.requested, input.registration)) return null;
  return input.prepare({
    ...input.credentials,
    accountStatus: "active",
    emailVerified: true,
  });
}

export interface AppointmentPreparationSummary {
  status: "ready_for_slot_capture" | "checkpoint" | "failed" | "not_ready";
  readyForSlotCapture: boolean;
  actionType: AppointmentPortalGate["actionType"] | null;
  code: string | null;
}

export function summarizeAppointmentPreparation(
  result: AppointmentPreparationResult,
): AppointmentPreparationSummary {
  const gate = registrationGateSummary(result);
  const status = result.gate
    ? "checkpoint"
    : result.errorCode || result.errorMessage
      ? "failed"
      : result.readyForSlotCapture
        ? "ready_for_slot_capture"
        : "not_ready";
  return {
    status,
    readyForSlotCapture: result.readyForSlotCapture,
    actionType: gate.actionType,
    code: gate.code,
  };
}

export function registrationGateSummary(
  result: AppointmentPreparationResult,
): { actionType: AppointmentPortalGate["actionType"] | null; code: string | null } {
  return {
    actionType: result.gate?.actionType ?? null,
    code: result.gate?.errorCode ?? result.errorCode ?? null,
  };
}

export function classifyRegistrationFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/application.*(?:identifier|uuid).*(?:valid|invalid)|(?:valid|invalid).*application.*(?:identifier|uuid)/i.test(message)) {
    return "application_id_invalid";
  }
  if (/SUBMISSION_RESULT_SECRET_KEY|credential config|credential configuration/i.test(message)) {
    return "credential_config_invalid";
  }
  if (/decrypt|cipher|stored credential/i.test(message)) return "stored_credentials_unreadable";
  if (/Browserbase.*(?:API key|permission)|browser credentials/i.test(message)) {
    return "browser_credentials_rejected";
  }
  if (/Browserbase.*(?:concurrency|rate limit)|HTTP 429/i.test(message)) {
    return "browser_capacity_unavailable";
  }
  if (/timeout|timed out/i.test(message)) return "operation_timed_out";
  if (/application|appointment job/i.test(message)) return "application_lookup_failed";
  return "registration_failed";
}
