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

export interface USAppointmentRunnerRepository {
  listCandidateJobs(limit: number): Promise<USAppointmentJobRow[]>;
  hasPendingManualAction(jobId: string): Promise<boolean>;
  insertManualAction(input: ManualActionInsert): Promise<void>;
  updateJobForManualAction(input: {
    jobId: string;
    status: string;
    currentManualAction: string;
  }): Promise<void>;
  insertAuditEvent(input: AuditEventInsert): Promise<void>;
}

export interface RunnerHandoff {
  jobStatus: "appointment_login_required";
  actionType: "login";
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
  if (!["appointment_consent_received", "appointment_account_required"].includes(job.status)) {
    return false;
  }

  const provider = normalizeToken(job.scheduling_provider);
  const allowlist = config.providerAllowlist.map(normalizeToken);
  if (!allowlist.includes(provider)) return false;

  const country = (job.applying_country_code ?? "").trim().toUpperCase();
  return config.supportedCountries.includes(country);
}

export function buildRunnerHandoff(
  job: USAppointmentJobRow,
  config: USAppointmentRunnerConfig = loadUSAppointmentRunnerConfig(),
): RunnerHandoff {
  const captchaSolverEnabled =
    config.captchaSolvingEnabled && config.twoCaptchaConfigured;
  return {
    jobStatus: "appointment_login_required",
    actionType: "login",
    instruction:
      captchaSolverEnabled
        ? "The VIZA appointment runner is ready for the official-site login step. VIZA may use 2captcha for supported image CAPTCHA surfaces when enabled, but will still pause for waiting-room, policy, payment, and final confirmation boundaries."
        : "The VIZA appointment runner is ready for the official-site login step. Complete any official-site login, CAPTCHA, waiting-room, or policy prompt manually; VIZA will pause before payment and final confirmation.",
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
      no_payment_automation: true,
      no_final_confirmation_click: true,
    },
  };
}

export async function processUSAppointmentJob(
  job: USAppointmentJobRow,
  repository: USAppointmentRunnerRepository,
  config: USAppointmentRunnerConfig,
): Promise<"processed" | "skipped"> {
  if (!isEligibleUSAppointmentJob(job, config)) return "skipped";
  if (await repository.hasPendingManualAction(job.id)) return "skipped";

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
    event_type: "appointment_runner_manual_login_required",
    event_message:
      "China USVisaScheduling runner paused for applicant-controlled official-site login.",
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
