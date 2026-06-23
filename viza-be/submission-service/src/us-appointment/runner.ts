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
  playwrightEnabled: boolean;
  playwrightHeadless: boolean;
  baseUrl: string;
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

export interface USAppointmentRunnerRepository {
  listCandidateJobs(limit: number): Promise<USAppointmentJobRow[]>;
  hasPendingManualAction(jobId: string): Promise<boolean>;
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
  prepareAppointmentFlow(job: USAppointmentJobRow): Promise<{
    readyForSlotCapture: boolean;
    errorCode?: string;
    errorMessage?: string;
  }>;
  observeSlots(job: USAppointmentJobRow): Promise<SlotInsert[]>;
  captureConfirmation(
    job: USAppointmentJobRow,
    selectedSlot: AppointmentSlotRow,
  ): Promise<ConfirmationInsert | null>;
  captureStatusCheck(job: USAppointmentJobRow): Promise<StatusCheckInsert>;
  close?(): Promise<void>;
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
    playwrightEnabled: env.US_APPOINTMENT_PLAYWRIGHT_ENABLED === "true",
    playwrightHeadless: env.US_APPOINTMENT_PLAYWRIGHT_HEADLESS !== "false",
    baseUrl: env.US_APPOINTMENT_BASE_URL ?? "https://www.usvisascheduling.com/",
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
  if (job.requires_user_action || job.current_manual_action) return false;
  if (![
    "appointment_consent_received",
    "appointment_account_required",
    "appointment_login_required",
    "appointment_payment_completed",
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

export class FixtureUSAppointmentPortalClient implements USAppointmentPortalClient {
  async prepareAppointmentFlow(job: USAppointmentJobRow): Promise<{
    readyForSlotCapture: boolean;
  }> {
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
  return Boolean(readObject(job.user_preferences_json?.portalFixture).slots)
    || Boolean(readObject(job.user_preferences_json?.portalFixture).confirmation)
    || Boolean(readObject(job.user_preferences_json?.portalFixture).statusCheck);
}

async function createDefaultPortalClient(
  job: USAppointmentJobRow,
  config: USAppointmentRunnerConfig,
): Promise<USAppointmentPortalClient> {
  if (hasPortalFixture(job) || !config.playwrightEnabled) {
    return new FixtureUSAppointmentPortalClient();
  }
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

export async function processUSAppointmentJob(
  job: USAppointmentJobRow,
  repository: USAppointmentRunnerRepository,
  config: USAppointmentRunnerConfig,
  portalClient?: USAppointmentPortalClient,
): Promise<"processed" | "skipped"> {
  if (!isEligibleUSAppointmentJob(job, config)) return "skipped";
  if (await repository.hasPendingManualAction(job.id)) return "skipped";
  const client = portalClient ?? await createDefaultPortalClient(job, config);

  try {
    if ([
      "appointment_consent_received",
      "appointment_account_required",
      "appointment_login_required",
    ].includes(job.status)) {
      const prepared = await client.prepareAppointmentFlow(job);
      if (!prepared.readyForSlotCapture) {
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
        await repository.updateJobStatus({
          jobId: job.id,
          status: "appointment_payment_completed",
        });
        await repository.updateApplicationAppointmentState({
          applicationId: job.application_id,
          status: "appointment_payment_completed",
          jobId: job.id,
        });
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
        return "processed";
      }
    }

    if (job.status === "appointment_payment_completed") {
      const slots = await client.observeSlots(job);
    await repository.insertSlots(slots);
      await repository.updateJobStatus({
      jobId: job.id,
      status: slots.length > 0
        ? "appointment_slot_selection_required"
        : "appointment_no_slots_available",
    });
    await repository.updateApplicationAppointmentState({
      applicationId: job.application_id,
      status: slots.length > 0
        ? "appointment_slot_selection_required"
        : "appointment_no_slots_available",
      jobId: job.id,
    });
    await repository.insertAuditEvent({
      job_id: job.id,
      application_id: job.application_id,
      user_id: job.user_id,
      event_type: "appointment_runner_slots_observed",
      event_message: "USVisaScheduling runner observed appointment slots.",
      metadata_redacted_json: {
        slot_count: slots.length,
        source: "usvisascheduling",
      },
    });
      return "processed";
    }

    if (job.status === "appointment_booked") {
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
    if (!confirmation) {
      await repository.updateJobStatus({
        jobId: job.id,
        status: "appointment_failed",
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
  } finally {
    if (!portalClient) await client.close?.();
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
): Promise<number> {
  if (!config.enabled) return 0;

  const jobs = await repository.listCandidateJobs(config.batchSize);
  let processed = 0;
  for (const job of jobs) {
    if ((await processUSAppointmentJob(job, repository, config)) === "processed") {
      processed += 1;
    }
  }
  return processed;
}
