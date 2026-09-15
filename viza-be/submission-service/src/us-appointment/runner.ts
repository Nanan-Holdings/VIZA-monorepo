import type { USAppointmentApplicantDetailsResult } from "./applicant-details-data";

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = Record<string, JsonValue>;

export interface USAppointmentRunnerConfig {
  enabled: boolean;
  providerAllowlist: string[];
  supportedCountries: string[];
  batchSize: number;
  emailTimeoutMs: number;
  slotCheckCooldownMs: number;
  captchaSolvingEnabled: boolean;
  twoCaptchaConfigured: boolean;
  captchaMaxAttempts: number;
  browserApiSessionAttempts: number;
  playwrightEnabled: boolean;
  playwrightHeadless: boolean;
  playwrightChannel: string | null;
  playwrightCdpEndpoint: string | null;
  localCdpEndpoint: string | null;
  playwrightStorageStatePath: string | null;
  baseUrl: string;
  typingDelayMinMs: number;
  typingDelayMaxMs: number;
}

export interface USAppointmentJobRow {
  id: string;
  application_id: string;
  user_id: string;
  appointment_account_id: string | null;
  applying_country_code: string | null;
  applying_post_city: string | null;
  scheduling_provider: string | null;
  status: string;
  mode: string;
  user_preferences_json: JsonObject | null;
  requires_user_action: boolean | null;
  current_manual_action: string | null;
  updated_at: string | null;
}

export interface AppointmentAccountCredentials {
  email: string;
  password: string;
  givenName?: string | null;
  surname?: string | null;
  accountStatus?: string | null;
  emailVerified?: boolean;
}

export interface AppointmentPreparationResult {
  readyForSlotCapture: boolean;
  /** The authenticated page exposes a specific appointment-status result without a calendar. */
  readyForStatusCapture?: boolean;
  gate?: AppointmentPortalGate;
  errorCode?: string;
  errorMessage?: string;
  /** Captured immediately before the official send-code action. */
  verificationRequestedAt?: string;
  /** Both flags require positive provider evidence, not merely absence of a gate. */
  emailVerified?: boolean;
  accountCreated?: boolean;
}

export interface AppointmentAccountRegistrationProof {
  emailVerified: true;
  accountCreated: true;
  accountEmail: string;
}

export interface AppointmentAccountRegistrationSubmission {
  accountEmail: string;
}

export interface ManualActionInsert {
  job_id: string;
  application_id: string;
  user_id: string;
  action_type: string;
  status: "pending";
  instruction: string;
  user_input_schema_json: JsonObject | null;
  metadata_redacted_json: JsonObject;
}

export interface AuditEventInsert {
  job_id: string;
  application_id: string;
  user_id: string;
  event_type: string;
  event_message: string;
  metadata_redacted_json: JsonObject;
}

export interface SlotInsert {
  job_id: string;
  application_id: string;
  appointment_date: string;
  appointment_time: string;
  appointment_location: string;
  appointment_type: string;
  source: string;
  status: "observed";
  metadata_redacted_json: JsonObject;
}

export interface ConfirmationInsert {
  job_id: string;
  application_id: string;
  user_id: string;
  country_code: "US";
  visa_type: "B1/B2";
  appointment_date: string | null;
  appointment_time: string | null;
  appointment_location: string | null;
  appointment_type: string | null;
  confirmation_number: string | null;
  confirmation_pdf_url: string | null;
  confirmation_screenshot_url: string | null;
  raw_confirmation_redacted_json: JsonObject;
}

export interface AppointmentSlotRow {
  id: string;
  job_id: string | null;
  appointment_date: string | null;
  appointment_time: string | null;
  appointment_location: string | null;
  appointment_type: string | null;
  metadata_redacted_json: JsonObject | null;
}

export interface StatusCheckInsert {
  job_id: string;
  application_id: string;
  user_id: string;
  status: string;
  result_redacted_json: JsonObject;
  screenshot_url?: string | null;
  error_code?: string | null;
  error_message?: string | null;
}

export interface AppointmentPortalGate {
  jobStatus: "appointment_manual_required" | "appointment_blocked_by_site_policy";
  actionType:
    | "login"
    | "account_email_verification"
    | "captcha"
    | "payment"
    | "site_policy_review"
    | "final_confirmation";
  instruction: string;
  userInputSchemaJson?: JsonObject | null;
  metadata: JsonObject;
  errorCode?: string;
  errorMessage?: string;
}

export interface USAppointmentRunnerRepository {
  listCandidateJobs(limit: number): Promise<USAppointmentJobRow[]>;
  getJob?(jobId: string): Promise<USAppointmentJobRow | null>;
  getLatestJobForApplication?(applicationId: string): Promise<USAppointmentJobRow | null>;
  hasPendingManualAction(jobId: string): Promise<boolean>;
  getAppointmentAccountCredentials(
    job: USAppointmentJobRow,
  ): Promise<AppointmentAccountCredentials | null>;
  getAppointmentApplicantDetails?(
    job: USAppointmentJobRow,
  ): Promise<USAppointmentApplicantDetailsResult>;
  assertAccountRegistrationInboxRoutable?(job: USAppointmentJobRow): Promise<void>;
  insertManualAction(input: ManualActionInsert): Promise<void>;
  updateJobForManualAction(input: {
    jobId: string;
    status: string;
    currentManualAction: string;
  }): Promise<void>;
  updateJobStatus(input: {
    jobId: string;
    status: string;
    currentManualAction?: string | null;
    lastErrorCode?: string | null;
    lastErrorMessage?: string | null;
  }): Promise<void>;
  insertAuditEvent(input: AuditEventInsert): Promise<void>;
  insertSlots(input: SlotInsert[]): Promise<void>;
  getSelectedSlot(jobId: string): Promise<AppointmentSlotRow | null>;
  hasCompletedFinalApproval(jobId: string): Promise<boolean>;
  waitForAccountVerificationEmail?(
    job: USAppointmentJobRow,
    timeoutMs: number,
    request: { since: string; accountEmail: string },
  ): Promise<{ code: string | null; link: string | null }>;
  markAppointmentAccountVerified?(
    job: USAppointmentJobRow,
    proof: AppointmentAccountRegistrationProof,
  ): Promise<void>;
  markAppointmentAccountRegistrationSubmitted?(
    job: USAppointmentJobRow,
    submission: AppointmentAccountRegistrationSubmission,
  ): Promise<void>;
  insertConfirmation(input: ConfirmationInsert): Promise<{ id: string | null }>;
  insertStatusCheck(input: StatusCheckInsert): Promise<void>;
  updateApplicationAppointmentState(input: {
    applicationId: string;
    status: string;
    jobId?: string | null;
    confirmationId?: string | null;
  }): Promise<void>;
}

export interface USAppointmentPortalClient {
  prepareAppointmentFlow(
    job: USAppointmentJobRow,
    credentials: AppointmentAccountCredentials | null,
    applicantDetails?: USAppointmentApplicantDetailsResult,
  ): Promise<AppointmentPreparationResult>;
  completeAccountEmailVerification?(input: {
    emailCode?: string | null;
    verificationLink?: string | null;
  }): Promise<AppointmentPreparationResult>;
  observeSlots(job: USAppointmentJobRow): Promise<SlotInsert[]>;
  captureConfirmation(
    job: USAppointmentJobRow,
    selectedSlot: AppointmentSlotRow,
  ): Promise<ConfirmationInsert | null>;
  captureStatusCheck(job: USAppointmentJobRow): Promise<StatusCheckInsert>;
  close?(): Promise<void>;
}

async function prepareAppointmentFlowWithAliasVerification(
  job: USAppointmentJobRow,
  repository: USAppointmentRunnerRepository,
  config: USAppointmentRunnerConfig,
  client: USAppointmentPortalClient,
  credentials: AppointmentAccountCredentials | null,
): Promise<AppointmentPreparationResult> {
  if (credentials && !credentials.emailVerified
    && ["account_creation_started", "registration_started", "verification_pending", "account_email_verification"].includes(credentials.accountStatus ?? "")
    && repository.assertAccountRegistrationInboxRoutable) {
    try {
      await repository.assertAccountRegistrationInboxRoutable(job);
    } catch {
      return { readyForSlotCapture: false, gate: {
        jobStatus: "appointment_manual_required",
        actionType: "site_policy_review",
        errorCode: "registration_inbox_unavailable",
        errorMessage: "The bound official account inbox cannot receive verification mail.",
        instruction: "Restore the account inbox before starting official registration.",
        metadata: { provider: "usvisascheduling", gate_type: "registration_inbox_unavailable" },
      } };
    }
  }
  const loadApplicantDetails = async (): Promise<USAppointmentApplicantDetailsResult | undefined> => {
    if (!repository.getAppointmentApplicantDetails) return undefined;
    try {
      return await repository.getAppointmentApplicantDetails(job);
    } catch {
      // Do not disclose database errors or treat unavailable data as permission
      // to guess identity/contact fields on the official application.
      return { state: "missing", missingFields: ["application_data"] };
    }
  };
  const applicantDetails = credentials?.emailVerified ? await loadApplicantDetails() : undefined;
  const prepared = await client.prepareAppointmentFlow(job, credentials, applicantDetails);
  if (credentials?.accountStatus === "registration_submitted" && credentials.emailVerified !== true) {
    // Recovery uses the existing account/session. The provider must first prove
    // the bound email and saved profile; no OTP or Create replay is permitted.
    if (prepared.emailVerified !== true || prepared.accountCreated !== true
      || prepared.readyForSlotCapture !== false
      || prepared.gate || prepared.errorCode || prepared.errorMessage) return prepared;
    const reconciliationGate = (code: string): AppointmentPreparationResult => ({
      readyForSlotCapture: false,
      emailVerified: true,
      accountCreated: true,
      gate: {
        jobStatus: "appointment_manual_required",
        actionType: "site_policy_review",
        instruction: "The existing official account was verified, but VIZA could not save its active state. Reconcile the existing account before retrying.",
        errorCode: code,
        errorMessage: "VIZA could not persist the verified existing official account.",
        metadata: { provider: "usvisascheduling", gate_type: code },
      },
    });
    if (!repository.markAppointmentAccountVerified) {
      return reconciliationGate("account_registration_reconciliation_persistence_unavailable");
    }
    try {
      await repository.markAppointmentAccountVerified(job, {
        emailVerified: true, accountCreated: true, accountEmail: credentials.email,
      });
    } catch {
      return reconciliationGate("account_registration_reconciliation_persistence_failed");
    }
    return client.prepareAppointmentFlow(job, {
      ...credentials, accountStatus: "active", emailVerified: true,
    }, await loadApplicantDetails());
  }
  const completed = await completeUSAppointmentAccountRegistration(
    job, repository, config, client, prepared, credentials,
  );
  if (completed.gate || completed.errorCode || !completed.accountCreated || completed.readyForSlotCapture) {
    return completed;
  }
  // The same browser may continue after creation, but must never re-register.
  return client.prepareAppointmentFlow(job, credentials ? {
    ...credentials, accountStatus: "active", emailVerified: true,
  } : null, await loadApplicantDetails());
}

/** Finish registration only; callers separately decide whether to enter scheduling. */
export async function completeUSAppointmentAccountRegistration(
  job: USAppointmentJobRow,
  repository: USAppointmentRunnerRepository,
  config: USAppointmentRunnerConfig,
  client: USAppointmentPortalClient,
  prepared: AppointmentPreparationResult,
  credentials: AppointmentAccountCredentials | null,
): Promise<AppointmentPreparationResult> {
  if (
    prepared.gate?.actionType !== "account_email_verification"
    || !repository.waitForAccountVerificationEmail
    || !client.completeAccountEmailVerification
  ) {
    return prepared;
  }

  const fail = (code: string, message: string): AppointmentPreparationResult => ({
    readyForSlotCapture: false,
    gate: {
      jobStatus: "appointment_manual_required",
      actionType: "site_policy_review",
      instruction: message,
      errorCode: code,
      errorMessage: message,
      metadata: { provider: "usvisascheduling", gate_type: code },
    },
  });
  const since = prepared.verificationRequestedAt;
  if (!credentials || !since || !Number.isFinite(Date.parse(since))) {
    return fail("registration_verification_context_missing", "The current registration email request could not be identified.");
  }
  if (!repository.markAppointmentAccountVerified) {
    return fail("registration_persistence_unavailable", "Official account registration persistence is unavailable.");
  }

  let verified: AppointmentPreparationResult;
  try {
    const verification = await repository.waitForAccountVerificationEmail(
      job,
      config.emailTimeoutMs,
      { since, accountEmail: credentials.email },
    );
    if (!verification.code && !verification.link) {
      return {
        ...prepared,
        gate: {
          ...prepared.gate,
          metadata: {
            ...prepared.gate.metadata,
            alias_email_automation_attempted: true,
            alias_email_message_readable: false,
          },
        },
      };
    }

    verified = await client.completeAccountEmailVerification({
      emailCode: verification.code,
      verificationLink: verification.link,
    });
  } catch {
    return {
      ...prepared,
      gate: {
        ...prepared.gate,
        metadata: {
          ...prepared.gate.metadata,
          alias_email_automation_attempted: true,
          alias_email_verification_completed: false,
        },
      },
    };
  }
  const accountCreationSubmitted =
    verified.emailVerified === true
    && verified.accountCreated !== true
    && verified.gate?.metadata.account_creation_submitted === true;
  if (accountCreationSubmitted) {
    const persistenceFailure = (code: string, message: string): AppointmentPreparationResult => ({
      ...verified,
      errorCode: code,
      errorMessage: message,
      accountCreated: false,
      emailVerified: true,
      gate: verified.gate
        ? {
          ...verified.gate,
          errorCode: code,
          errorMessage: message,
          metadata: {
            ...verified.gate.metadata,
            registration_submission_persistence: "failed",
          },
        }
        : undefined,
    });
    if (!repository.markAppointmentAccountRegistrationSubmitted) {
      return persistenceFailure(
        "registration_submission_persistence_unavailable",
        "The official account creation submission was observed, but VIZA cannot save its reconciliation state.",
      );
    }
    try {
      await repository.markAppointmentAccountRegistrationSubmitted(job, {
        accountEmail: credentials?.email ?? "",
      });
    } catch {
      return persistenceFailure(
        "registration_submission_persistence_failed",
        "The official account creation submission was observed, but VIZA could not save its reconciliation state.",
      );
    }
    return verified;
  }
  if (verified.gate || verified.errorCode || verified.errorMessage) return verified;
  if (verified.emailVerified !== true || verified.accountCreated !== true) {
    return fail("account_registration_unconfirmed", "The official portal has not confirmed successful account creation.");
  }
  try {
    await repository.markAppointmentAccountVerified(job, {
      emailVerified: true, accountCreated: true, accountEmail: credentials.email,
    });
  } catch {
    return {
      ...fail("account_registration_persistence_failed", "The official account was created, but VIZA could not save its verified state. Reconcile the existing account before retrying."),
      accountCreated: true,
      emailVerified: true,
    };
  }
  return verified;
}

export interface RunnerHandoff {
  jobStatus: "appointment_manual_required";
  actionType: "site_policy_review";
  instruction: string;
  userInputSchemaJson: JsonObject;
  metadata: JsonObject;
}

function normalizeToken(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function splitEnvList(value: string | undefined, fallback: string[]): string[] {
  const items = (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : fallback;
}

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeTypingDelayRange(minMs: number, maxMs: number): {
  typingDelayMinMs: number;
  typingDelayMaxMs: number;
} {
  return minMs <= maxMs
    ? { typingDelayMinMs: minMs, typingDelayMaxMs: maxMs }
    : { typingDelayMinMs: maxMs, typingDelayMaxMs: minMs };
}

export function loadUSAppointmentRunnerConfig(
  env: Record<string, string | undefined> = process.env,
): USAppointmentRunnerConfig {
  return {
    enabled: env.US_APPOINTMENT_ASSISTED_LIVE_ENABLED === "true",
    providerAllowlist: splitEnvList(env.US_APPOINTMENT_PROVIDER_ALLOWLIST, [
      "usvisascheduling",
    ]),
    supportedCountries: splitEnvList(env.US_APPOINTMENT_SUPPORTED_COUNTRIES, [
      "CN",
    ]).map((country) => country.toUpperCase()),
    batchSize: readPositiveInt(env.US_APPOINTMENT_RUNNER_BATCH_SIZE, 3),
    emailTimeoutMs: readPositiveInt(env.US_APPOINTMENT_EMAIL_TIMEOUT_MS, 90_000),
    slotCheckCooldownMs: readPositiveInt(
      env.US_APPOINTMENT_SLOT_CHECK_COOLDOWN_MS,
      600_000,
    ),
    captchaSolvingEnabled: env.US_APPOINTMENT_CAPTCHA_SOLVING_ENABLED === "true",
    twoCaptchaConfigured: Boolean(env.TWOCAPTCHA_API_KEY?.trim()),
    captchaMaxAttempts: readPositiveInt(env.US_APPOINTMENT_CAPTCHA_MAX_ATTEMPTS, 2),
    browserApiSessionAttempts: readPositiveInt(
      env.US_APPOINTMENT_BROWSER_API_SESSION_ATTEMPTS,
      2,
    ),
    playwrightEnabled: env.US_APPOINTMENT_PLAYWRIGHT_ENABLED === "true",
    playwrightHeadless: env.US_APPOINTMENT_PLAYWRIGHT_HEADLESS !== "false",
    playwrightChannel: env.US_APPOINTMENT_PLAYWRIGHT_CHANNEL?.trim() || null,
    playwrightCdpEndpoint:
      env.US_APPOINTMENT_BROWSER_API_ENDPOINT?.trim()
      || env.US_APPOINTMENT_CDP_ENDPOINT?.trim()
      || env.BRIGHTDATA_BROWSER_API_ENDPOINT?.trim()
      || null,
    localCdpEndpoint: env.US_APPOINTMENT_LOCAL_CDP_ENDPOINT?.trim() || null,
    playwrightStorageStatePath: env.US_APPOINTMENT_STORAGE_STATE_PATH?.trim() || null,
    baseUrl: env.US_APPOINTMENT_BASE_URL ?? "https://www.usvisascheduling.com/",
    ...normalizeTypingDelayRange(
      readPositiveInt(env.US_APPOINTMENT_TYPING_DELAY_MIN_MS, 80),
      readPositiveInt(env.US_APPOINTMENT_TYPING_DELAY_MAX_MS, 120),
    ),
  };
}

export function validateUSAppointmentRunnerStart(
  config: USAppointmentRunnerConfig,
): string | null {
  if (config.captchaSolvingEnabled && !config.twoCaptchaConfigured) {
    return "US appointment CAPTCHA solving is blocked: TWOCAPTCHA_API_KEY must be set when US_APPOINTMENT_CAPTCHA_SOLVING_ENABLED=true.";
  }
  return null;
}

export function isEligibleUSAppointmentJob(
  job: USAppointmentJobRow,
  config: USAppointmentRunnerConfig,
): boolean {
  if (!config.enabled) return false;
  if (job.mode !== "assisted_live") return false;
  if (
    job.requires_user_action
    && !["login", "account_email_verification"].includes(job.current_manual_action ?? "")
  ) return false;
  if (
    job.current_manual_action
    && !["login", "account_email_verification"].includes(job.current_manual_action)
  ) return false;
  if (![
    "appointment_consent_received",
    "appointment_account_required",
    "appointment_login_required",
    "appointment_payment_completed",
    "appointment_no_slots_available",
    "appointment_booked",
    "appointment_status_check_in_progress",
  ].includes(job.status)) return false;

  const provider = normalizeToken(job.scheduling_provider);
  const allowlist = config.providerAllowlist.map(normalizeToken);
  if (!allowlist.includes(provider)) return false;

  const country = (job.applying_country_code ?? "").trim().toUpperCase();
  return config.supportedCountries.includes(country);
}

function readObject(value: JsonValue | undefined): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function readString(value: JsonValue | undefined): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function redactExternalSlotMetadata(slot: JsonObject): JsonObject {
  return {
    externalSlotId: slot.externalSlotId ? "[REDACTED]" : null,
    calendarPageContext: readObject(slot.calendarPageContext),
  };
}

function buildFixtureSlots(job: USAppointmentJobRow): SlotInsert[] {
  const fixture = readObject(job.user_preferences_json?.portalFixture);
  const slots = Array.isArray(fixture.slots) ? fixture.slots : [];
  return slots
    .map((value): SlotInsert | null => {
      const slot = readObject(value);
      const date = readString(slot.date);
      const time = readString(slot.time);
      const location = readString(slot.location);
      if (!date || !time || !location) return null;
      return {
        job_id: job.id,
        application_id: job.application_id,
        appointment_date: date,
        appointment_time: time,
        appointment_location: location,
        appointment_type: readString(slot.type) ?? "interview",
        source: "usvisascheduling",
        status: "observed",
        metadata_redacted_json: redactExternalSlotMetadata(slot),
      };
    })
    .filter((slot): slot is SlotInsert => Boolean(slot));
}

function buildFixtureConfirmation(
  job: USAppointmentJobRow,
  selectedSlot: AppointmentSlotRow,
): ConfirmationInsert | null {
  const fixture = readObject(job.user_preferences_json?.portalFixture);
  const confirmation = readObject(fixture.confirmation);
  const confirmationNumber = readString(confirmation.confirmationNumber);
  if (!confirmationNumber) return null;
  return {
    job_id: job.id,
    application_id: job.application_id,
    user_id: job.user_id,
    country_code: "US",
    visa_type: "B1/B2",
    appointment_date: selectedSlot.appointment_date,
    appointment_time: selectedSlot.appointment_time,
    appointment_location: selectedSlot.appointment_location,
    appointment_type: selectedSlot.appointment_type ?? "interview",
    confirmation_number: confirmationNumber,
    confirmation_pdf_url: readString(confirmation.pdfUrl),
    confirmation_screenshot_url: readString(confirmation.screenshotUrl),
    raw_confirmation_redacted_json: {
      provider: "usvisascheduling",
      captured_from: "portal_fixture",
      confirmationNumber: "[REDACTED]",
    },
  };
}

function buildFixtureStatusCheck(job: USAppointmentJobRow): StatusCheckInsert {
  const fixture = readObject(job.user_preferences_json?.portalFixture);
  const statusCheck = readObject(fixture.statusCheck);
  const status = readString(statusCheck.status) ?? "unknown";
  return {
    job_id: job.id,
    application_id: job.application_id,
    user_id: job.user_id,
    status,
    result_redacted_json: {
      provider: "usvisascheduling",
      captured_from: "portal_fixture",
      status,
      message: readString(statusCheck.message),
    },
    screenshot_url: readString(statusCheck.screenshotUrl),
    error_code: readString(statusCheck.errorCode),
    error_message: readString(statusCheck.errorMessage),
  };
}

async function persistManualGate(
  job: USAppointmentJobRow,
  repository: USAppointmentRunnerRepository,
  gate: AppointmentPortalGate,
): Promise<void> {
  await repository.insertManualAction({
    job_id: job.id,
    application_id: job.application_id,
    user_id: job.user_id,
    action_type: gate.actionType,
    status: "pending",
    instruction: gate.instruction,
    user_input_schema_json: gate.userInputSchemaJson ?? null,
    metadata_redacted_json: gate.metadata,
  });
  await repository.updateJobForManualAction({
    jobId: job.id,
    status: gate.jobStatus,
    currentManualAction: gate.actionType,
  });
  await repository.updateApplicationAppointmentState({
    applicationId: job.application_id,
    status: gate.jobStatus,
    jobId: job.id,
  });
  await repository.insertAuditEvent({
    job_id: job.id,
    application_id: job.application_id,
    user_id: job.user_id,
    event_type: "appointment_runner_manual_required",
    event_message:
      gate.errorMessage ?? "USVisaScheduling runner paused for manual review.",
    metadata_redacted_json: {
      ...gate.metadata,
      error_code: gate.errorCode ?? null,
    },
  });
}

export class FixtureUSAppointmentPortalClient implements USAppointmentPortalClient {
  async prepareAppointmentFlow(
    job: USAppointmentJobRow,
    credentials: AppointmentAccountCredentials | null,
  ): Promise<{
    readyForSlotCapture: boolean;
    gate?: AppointmentPortalGate;
  }> {
    if (
      ["appointment_account_required", "appointment_login_required"].includes(job.status)
      && !credentials
    ) {
      return {
        readyForSlotCapture: false,
        gate: {
          jobStatus: "appointment_manual_required",
          actionType: "login",
          instruction: "USVisaScheduling login cannot be automated because VIZA has no saved official account credentials for this job.",
          metadata: {
            gate_type: "missing_account_credentials",
            provider: "usvisascheduling",
          },
          errorCode: "missing_account_credentials",
          errorMessage: "USVisaScheduling login cannot be automated without saved official account credentials.",
        },
      };
    }
    const fixture = readObject(job.user_preferences_json?.portalFixture);
    return { readyForSlotCapture: fixture.autoPrepare === true };
  }

  async observeSlots(job: USAppointmentJobRow): Promise<SlotInsert[]> {
    return buildFixtureSlots(job);
  }

  async captureConfirmation(
    job: USAppointmentJobRow,
    selectedSlot: AppointmentSlotRow,
  ): Promise<ConfirmationInsert | null> {
    return buildFixtureConfirmation(job, selectedSlot);
  }

  async captureStatusCheck(job: USAppointmentJobRow): Promise<StatusCheckInsert> {
    return buildFixtureStatusCheck(job);
  }
}

function hasPortalFixture(job: USAppointmentJobRow): boolean {
  return Object.prototype.hasOwnProperty.call(job.user_preferences_json ?? {}, "portalFixture");
}

async function createDefaultPortalClient(
  job: USAppointmentJobRow,
  config: USAppointmentRunnerConfig,
): Promise<USAppointmentPortalClient> {
  // A persisted assisted-live job must never obtain simulated official evidence.
  // Local tests can inject FixtureUSAppointmentPortalClient explicitly.
  if (!config.playwrightEnabled) throw new Error("US appointment real browser is disabled.");
  if (hasPortalFixture(job)) throw new Error("US appointment live job contains a portal fixture.");
  const { createPlaywrightUSVisaSchedulingPortalClient } = await import("./usvisascheduling-portal.js");
  return createPlaywrightUSVisaSchedulingPortalClient(config);
}

export function buildRunnerHandoff(
  job: USAppointmentJobRow,
  config: USAppointmentRunnerConfig = loadUSAppointmentRunnerConfig(),
): RunnerHandoff {
  const captchaSolverEnabled =
    config.captchaSolvingEnabled && config.twoCaptchaConfigured;
  return {
    jobStatus: "appointment_manual_required",
    actionType: "site_policy_review",
    instruction:
      captchaSolverEnabled
        ? "The VIZA appointment runner reached an official-site condition that needs manual review. Supported image CAPTCHA surfaces may be solved by 2captcha when enabled; unsupported gates are not hidden as success."
        : "The VIZA appointment runner reached an official-site condition that needs manual review before it can continue.",
    userInputSchemaJson: {
      type: "object",
      properties: {
        completedByUser: { type: "boolean" },
      },
    },
    metadata: {
      provider: normalizeToken(job.scheduling_provider) || "unknown",
      applying_country_code: (job.applying_country_code ?? "").trim().toUpperCase(),
      applying_post_city: job.applying_post_city,
      runner_service: "submission-service",
      captcha_solver_enabled: captchaSolverEnabled,
      captcha_solver_provider: captchaSolverEnabled ? "2captcha" : null,
      captcha_max_attempts: config.captchaMaxAttempts,
      supported_checkpoint_handling: true,
      explicit_slot_selection_required: true,
      final_viza_approval_required: true,
    },
  };
}

async function captureAndPersistAppointmentSlots(
  job: USAppointmentJobRow,
  repository: USAppointmentRunnerRepository,
  client: USAppointmentPortalClient,
): Promise<void> {
  const slots = await client.observeSlots(job);
  const status = slots.length > 0
    ? "appointment_slot_selection_required" : "appointment_no_slots_available";
  await repository.insertSlots(slots);
  await repository.updateJobStatus({ jobId: job.id, status });
  await repository.updateApplicationAppointmentState({
    applicationId: job.application_id, jobId: job.id, status,
  });
  await repository.insertAuditEvent({
    job_id: job.id,
    application_id: job.application_id,
    user_id: job.user_id,
    event_type: "appointment_runner_slots_observed",
    event_message: "USVisaScheduling runner observed appointment slots.",
    metadata_redacted_json: { slot_count: slots.length, source: "usvisascheduling" },
  });
}

export async function processUSAppointmentJob(
  job: USAppointmentJobRow,
  repository: USAppointmentRunnerRepository,
  config: USAppointmentRunnerConfig,
  portalClient?: USAppointmentPortalClient,
): Promise<"processed" | "skipped"> {
  if (!isEligibleUSAppointmentJob(job, config)) return "skipped";
  if (
    !["login", "account_email_verification"].includes(job.current_manual_action ?? "")
    && await repository.hasPendingManualAction(job.id)
  ) return "skipped";
  let client: USAppointmentPortalClient | null = null;

  try {
    if (!portalClient && (!config.playwrightEnabled || hasPortalFixture(job))) {
      await persistManualGate(job, repository, {
        jobStatus: "appointment_manual_required",
        actionType: "site_policy_review",
        instruction: "VIZA must configure a real browser and remove simulation data before running this official appointment job.",
        metadata: {
          gate_type: "live_browser_configuration_required",
          provider: "usvisascheduling",
          playwright_enabled: config.playwrightEnabled,
          portal_fixture_present: hasPortalFixture(job),
        },
        errorCode: "live_browser_configuration_required",
        errorMessage: "The live appointment runner cannot use simulated portal results.",
      });
      return "processed";
    }
    if ([
      "appointment_consent_received",
      "appointment_account_required",
      "appointment_login_required",
    ].includes(job.status)) {
      const credentials = await repository.getAppointmentAccountCredentials(job);
      if (
        !credentials
        && ["appointment_account_required", "appointment_login_required"].includes(job.status)
      ) {
        await persistManualGate(job, repository, {
          jobStatus: "appointment_manual_required",
          actionType: "login",
          instruction: "USVisaScheduling login cannot be automated because VIZA has no saved official account credentials for this job.",
          metadata: {
            gate_type: "missing_account_credentials",
            provider: "usvisascheduling",
          },
          errorCode: "missing_account_credentials",
          errorMessage: "USVisaScheduling login cannot be automated without saved official account credentials.",
        });
        return "processed";
      }
      client = portalClient ?? await createDefaultPortalClient(job, config);
      const prepared = await prepareAppointmentFlowWithAliasVerification(
        job,
        repository,
        config,
        client,
        credentials,
      );
      if (!prepared.readyForSlotCapture) {
        if (prepared.gate) {
          await persistManualGate(job, repository, prepared.gate);
          return "processed";
        }
        if (prepared.errorCode || prepared.errorMessage) {
          await repository.updateJobStatus({
            jobId: job.id,
            status: "appointment_failed",
            lastErrorCode: prepared.errorCode ?? "appointment_prepare_failed",
            lastErrorMessage: prepared.errorMessage ?? "US appointment portal could not be prepared.",
          });
          return "processed";
        }
      } else {
        await repository.insertAuditEvent({
          job_id: job.id,
          application_id: job.application_id,
          user_id: job.user_id,
          event_type: "appointment_runner_calendar_ready",
          event_message: "USVisaScheduling runner reached the appointment calendar.",
          metadata_redacted_json: {
            provider: "usvisascheduling",
          },
        });
        // Calendar access is not payment evidence. Observe on this prepared
        // session and persist only the actual slot result.
        await captureAndPersistAppointmentSlots(job, repository, client);
        return "processed";
      }
    }

    if (["appointment_payment_completed", "appointment_no_slots_available"].includes(job.status)) {
      client = portalClient ?? await createDefaultPortalClient(job, config);
      const credentials = await repository.getAppointmentAccountCredentials(job);
      const prepared = await prepareAppointmentFlowWithAliasVerification(
        job,
        repository,
        config,
        client,
        credentials,
      );
      if (!prepared.readyForSlotCapture) {
        if (prepared.gate) {
          await persistManualGate(job, repository, prepared.gate);
          return "processed";
        }
        await repository.updateJobStatus({
          jobId: job.id,
          status: "appointment_manual_required",
          currentManualAction: "site_policy_review",
          lastErrorCode: prepared.errorCode ?? "appointment_prepare_failed",
          lastErrorMessage:
            prepared.errorMessage ?? "US appointment portal could not be prepared for slot observation.",
        });
        return "processed";
      }
      await captureAndPersistAppointmentSlots(job, repository, client);
      return "processed";
    }

    if (job.status === "appointment_booked") {
      if (!await repository.hasCompletedFinalApproval(job.id)) {
        await repository.insertManualAction({
          job_id: job.id,
          application_id: job.application_id,
          user_id: job.user_id,
          action_type: "final_confirmation",
          status: "pending",
          instruction: "Review the selected official slot and approve it in the VIZA Portal before booking.",
          user_input_schema_json: {
            type: "object",
            properties: { approved: { type: "boolean" } },
            required: ["approved"],
          },
          metadata_redacted_json: {
            provider: "usvisascheduling",
            final_viza_approval_required: true,
          },
        });
        await repository.updateJobForManualAction({
          jobId: job.id,
          status: "appointment_final_confirmation_required",
          currentManualAction: "final_confirmation",
        });
        await repository.updateApplicationAppointmentState({
          applicationId: job.application_id,
          status: "appointment_final_confirmation_required",
          jobId: job.id,
        });
        return "processed";
      }
      client = portalClient ?? await createDefaultPortalClient(job, config);
      const credentials = await repository.getAppointmentAccountCredentials(job);
      const prepared = await prepareAppointmentFlowWithAliasVerification(
        job,
        repository,
        config,
        client,
        credentials,
      );
      if (!prepared.readyForSlotCapture) {
        if (prepared.gate) {
          await persistManualGate(job, repository, prepared.gate);
        } else {
          await repository.updateJobStatus({
            jobId: job.id,
            status: "appointment_manual_required",
            currentManualAction: "site_policy_review",
            lastErrorCode: prepared.errorCode ?? "appointment_prepare_failed",
            lastErrorMessage:
              prepared.errorMessage ?? "USVisaScheduling calendar could not be prepared for final booking.",
          });
        }
        return "processed";
      }
      const selectedSlot = await repository.getSelectedSlot(job.id);
      if (!selectedSlot) {
        await repository.updateJobStatus({
          jobId: job.id,
          status: "appointment_failed",
          lastErrorCode: "selected_slot_missing",
          lastErrorMessage: "Selected appointment slot was not found for booking.",
        });
        return "processed";
      }
      const confirmation = await client.captureConfirmation(job, selectedSlot);
      if (!confirmation?.confirmation_number) {
        await repository.updateJobStatus({
          jobId: job.id,
          status: "appointment_manual_required",
          currentManualAction: "site_policy_review",
          lastErrorCode: "confirmation_missing",
          lastErrorMessage: "Official appointment confirmation was not captured.",
        });
        return "processed";
      }
      const insertedConfirmation = await repository.insertConfirmation(confirmation);
      await repository.updateJobStatus({
        jobId: job.id,
        status: "appointment_confirmation_captured",
      });
      await repository.updateApplicationAppointmentState({
        applicationId: job.application_id,
        status: "appointment_confirmation_captured",
        jobId: job.id,
        confirmationId: insertedConfirmation.id,
      });
      await repository.insertAuditEvent({
        job_id: job.id,
        application_id: job.application_id,
        user_id: job.user_id,
        event_type: "appointment_runner_confirmation_captured",
        event_message: "USVisaScheduling runner captured appointment confirmation.",
        metadata_redacted_json: {
          has_pdf: Boolean(confirmation.confirmation_pdf_url),
          has_screenshot: Boolean(confirmation.confirmation_screenshot_url),
        },
      });
      return "processed";
    }

    if (job.status === "appointment_status_check_in_progress") {
      client = portalClient ?? await createDefaultPortalClient(job, config);
      const credentials = await repository.getAppointmentAccountCredentials(job);
      const prepared = await prepareAppointmentFlowWithAliasVerification(
        job, repository, config, client, credentials,
      );
      if (!prepared.readyForSlotCapture && prepared.readyForStatusCapture !== true) {
        await persistManualGate(job, repository, prepared.gate ?? {
          jobStatus: "appointment_manual_required",
          actionType: "site_policy_review",
          instruction: "VIZA could not establish the official account session for the appointment status check.",
          metadata: { gate_type: "status_session_unavailable", provider: "usvisascheduling" },
          errorCode: "status_session_unavailable",
          errorMessage: "Official appointment status cannot be read without a prepared account session.",
        });
        return "processed";
      }
      const statusCheck = await client.captureStatusCheck(job);
    await repository.insertStatusCheck(statusCheck);
    await repository.updateJobStatus({
      jobId: job.id,
      status: "appointment_status_checked",
    });
    await repository.updateApplicationAppointmentState({
      applicationId: job.application_id,
      status: "appointment_status_checked",
      jobId: job.id,
    });
    await repository.insertAuditEvent({
      job_id: job.id,
      application_id: job.application_id,
      user_id: job.user_id,
      event_type: "appointment_runner_status_checked",
      event_message: "USVisaScheduling runner captured appointment status.",
      metadata_redacted_json: {
        status: statusCheck.status,
        has_screenshot: Boolean(statusCheck.screenshot_url),
      },
    });
      return "processed";
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const actionType = /login|username|password|sign in|credential/i.test(message)
      ? "login"
      : "site_policy_review";
    await persistManualGate(job, repository, {
      jobStatus: "appointment_manual_required",
      actionType,
      instruction:
        actionType === "login"
          ? "USVisaScheduling login could not be completed automatically. Review the official login page before slot observation continues."
          : "USVisaScheduling could not be prepared for slot observation. Review the official page before continuing.",
      metadata: {
        gate_type:
          actionType === "login"
            ? "login_automation_failed"
            : "appointment_prepare_failed",
        provider: "usvisascheduling",
      },
      errorCode:
        actionType === "login"
          ? "login_automation_failed"
          : "appointment_prepare_failed",
      errorMessage:
        actionType === "login"
          ? "USVisaScheduling login could not be completed automatically."
          : "USVisaScheduling could not be prepared for slot observation.",
    });
    return "processed";
  } finally {
    if (!portalClient) await client?.close?.();
  }

  const handoff = buildRunnerHandoff(job, config);
  await repository.insertManualAction({
    job_id: job.id,
    application_id: job.application_id,
    user_id: job.user_id,
    action_type: handoff.actionType,
    status: "pending",
    instruction: handoff.instruction,
    user_input_schema_json: handoff.userInputSchemaJson,
    metadata_redacted_json: handoff.metadata,
  });
  await repository.updateJobForManualAction({
    jobId: job.id,
    status: handoff.jobStatus,
    currentManualAction: handoff.actionType,
  });
  await repository.insertAuditEvent({
    job_id: job.id,
    application_id: job.application_id,
    user_id: job.user_id,
    event_type: "appointment_runner_manual_required",
    event_message:
      "China USVisaScheduling runner paused for manual review of an unsupported official-site condition.",
    metadata_redacted_json: handoff.metadata,
  });
  return "processed";
}

export async function pollUSAppointmentAssistedJobs(
  repository: USAppointmentRunnerRepository,
  config: USAppointmentRunnerConfig = loadUSAppointmentRunnerConfig(),
  dispatch?: (jobId: string) => Promise<boolean>,
): Promise<number> {
  if (!config.enabled) return 0;

  const jobs = await repository.listCandidateJobs(config.batchSize);
  let processed = 0;
  for (const job of jobs) {
    if (dispatch ? await dispatch(job.id) : (await processUSAppointmentJob(job, repository, config)) === "processed") {
      processed += 1;
    }
  }
  return processed;
}
