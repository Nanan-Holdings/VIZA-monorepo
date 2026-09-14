#!/usr/bin/env npx tsx
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { parse } from "dotenv";
import { resolve } from "node:path";
import {
  classifyRegistrationFailure,
  continueToAppointmentAfterRegistration,
  parseUSAppointmentRegistrationArgs,
  prepareRegistrationBrowserConfig,
  registrationGateSummary,
  registrationSucceeded,
  summarizeAppointmentPreparation,
  validateUSAppointmentRegistrationPreflightWithInbox,
  type RegistrationBrowserMode,
} from "../src/us-appointment/registration-command";
import {
  completeUSAppointmentAccountRegistration,
  loadUSAppointmentRunnerConfig,
  validateUSAppointmentRunnerStart,
  type AppointmentAccountCredentials,
  type AppointmentPreparationResult,
} from "../src/us-appointment/runner";
import { SupabaseUSAppointmentRunnerRepository } from "../src/us-appointment/supabase-repository";
import { PlaywrightUSVisaSchedulingPortalClient } from "../src/us-appointment/usvisascheduling-portal";
import { browserbaseEnabled, connectBrowserbaseCloudBrowser } from "../src/browserbase-session";
import { supabase } from "../src/supabase";

let phase = "configuration";

function maskEmail(email: string): string {
  const [localPart, domain] = email.trim().split("@");
  if (!localPart || !domain) return "[REDACTED]";
  return `${localPart.slice(0, 2)}***@${domain}`;
}

async function loadCredentialConfig(path: string | null): Promise<void> {
  if (!path) return;
  const values = parse(await readFile(resolve(path), "utf8"));
  const key = values.SUBMISSION_RESULT_SECRET_KEY?.trim();
  if (!key || key.length < 16) {
    throw new Error("Selected credential configuration has no usable submission result key.");
  }
  // The selected key is process-local. The command never edits either env file
  // and does not copy any other values from the selected configuration.
  process.env.SUBMISSION_RESULT_SECRET_KEY = key;
}

function configureBrowserEnvironment(
  browserbase: boolean,
  localBrowser: boolean,
): void {
  if (browserbase) {
    process.env.US_APPOINTMENT_BROWSERBASE_ENABLED = "true";
    process.env.US_APPOINTMENT_BROWSERBASE_REGION ||= "us-east-1";
    process.env.US_APPOINTMENT_BROWSERBASE_COUNTRY ||= "US";
  }
  if (localBrowser) {
    // The portal client checks this process flag when selecting its browser.
    // Clear it for this invocation so --local-browser cannot accidentally use
    // a managed Browserbase session inherited from .env.
    process.env.US_APPOINTMENT_BROWSERBASE_ENABLED = "false";
  }
}

function chooseBrowserMode(
  browserbaseRequested: boolean,
  localBrowser: boolean,
  config: ReturnType<typeof loadUSAppointmentRunnerConfig>,
): RegistrationBrowserMode {
  if (localBrowser) return "local";
  if (browserbaseRequested || browserbaseEnabled("US_APPOINTMENT")) return "browserbase";
  if (config.playwrightCdpEndpoint) return "configured";
  return "configured";
}

function printPreflightFailure(code: string): void {
  console.error(JSON.stringify({
    status: "registration_preflight_failed",
    phase,
    code,
    message: "US appointment registration was stopped before official browser interaction.",
    ...(code === "account_already_created"
      ? { nextStep: "Use us-appointment:login-smoke with this application id." }
      : {}),
  }));
}

async function hasCompletedAppointmentConsent(
  job: { application_id: string; user_id: string },
): Promise<boolean> {
  const { data, error } = await supabase
    .from("appointment_manual_actions")
    .select("id")
    .eq("application_id", job.application_id)
    .eq("user_id", job.user_id)
    .eq("action_type", "consent")
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("Appointment consent lookup failed.");
  return Boolean(data?.id);
}

function printRegistrationResult(
  applicationId: string,
  credentials: AppointmentAccountCredentials,
  result: AppointmentPreparationResult,
  appointmentPreparation: AppointmentPreparationResult | null,
  appointmentContinuationErrorCode: string | null,
  continueRequested: boolean,
): boolean {
  const succeeded = registrationSucceeded(result);
  const gate = registrationGateSummary(result);
  const output: Record<string, unknown> = {
    status: succeeded ? "account_created" : result.gate ? "registration_checkpoint" : "registration_failed",
    applicationId,
    accountEmail: maskEmail(credentials.email),
    emailVerified: result.emailVerified === true,
    accountCreated: result.accountCreated === true,
    appointmentFlowStarted: Boolean(appointmentPreparation) || Boolean(appointmentContinuationErrorCode),
  };
  if (result.gate) {
    output.gate = {
      actionType: gate.actionType,
      code: gate.code,
    };
  } else if (!succeeded) {
    output.code = result.errorCode ?? "registration_evidence_missing";
  }
  if (continueRequested) {
    output.appointmentContinuation = appointmentPreparation
      ? summarizeAppointmentPreparation(appointmentPreparation)
      : {
        status: appointmentContinuationErrorCode ? "failed" : "not_ready",
        readyForSlotCapture: false,
        actionType: null,
        code: appointmentContinuationErrorCode,
      };
  }
  console.log(JSON.stringify(output, null, 2));
  return succeeded;
}

async function main(): Promise<void> {
  const args = parseUSAppointmentRegistrationArgs(process.argv.slice(2));

  phase = "credential_config";
  await loadCredentialConfig(args.credentialConfig);
  configureBrowserEnvironment(args.browserbase, args.localBrowser);

  phase = "runner_configuration";
  const loadedConfig = loadUSAppointmentRunnerConfig();
  const runnerConfigError = validateUSAppointmentRunnerStart(loadedConfig);
  if (runnerConfigError) {
    printPreflightFailure("runner_configuration_invalid");
    process.exitCode = 1;
    return;
  }
  const browserMode = chooseBrowserMode(
    args.browserbase,
    args.localBrowser,
    loadedConfig,
  );
  // Registration always starts from a fresh managed/local context. Reusing
  // storage state or an inherited CDP bridge could silently turn this command
  // into a login flow in an unrelated browser.
  const config = prepareRegistrationBrowserConfig(
    loadedConfig,
    browserMode,
    args.headless,
  );

  phase = "job_lookup";
  const repository = new SupabaseUSAppointmentRunnerRepository();
  const job = await repository.getLatestJobForApplication(args.applicationId);
  phase = "credential_read";
  const credentials = job
    ? await repository.getAppointmentAccountCredentials(job)
    : null;
  phase = "consent_preflight";
  const consentCompleted = job ? await hasCompletedAppointmentConsent(job) : false;
  const preflight = await validateUSAppointmentRegistrationPreflightWithInbox({
    applicationId: args.applicationId,
    job,
    credentials,
    consentCompleted,
    config,
    browserMode,
    browserbaseApiKeyConfigured: Boolean(process.env.BROWSERBASE_API_KEY?.trim()),
  }, repository);
  if (preflight.ok === false) {
    printPreflightFailure(preflight.code);
    process.exitCode = 1;
    return;
  }

  console.log(JSON.stringify({
    status: "registration_preflight_passed",
    applicationId: preflight.applicationId,
    accountEmail: maskEmail(preflight.credentials.email),
    browserMode,
    headless: config.playwrightHeadless,
    appointmentFlowStarted: false,
  }, null, 2));

  let cloud: Awaited<ReturnType<typeof connectBrowserbaseCloudBrowser>> | null = null;
  let client: PlaywrightUSVisaSchedulingPortalClient | null = null;
  try {
    phase = "browser_session";
    if (browserMode === "browserbase") {
      cloud = await connectBrowserbaseCloudBrowser({ prefix: "US_APPOINTMENT" });
    }
    client = new PlaywrightUSVisaSchedulingPortalClient(
      config,
      cloud ? { page: cloud.page } : {},
    );

    phase = "official_registration";
    const prepared = await client.registerAccount(preflight.credentials);
    const completed = await completeUSAppointmentAccountRegistration(
      preflight.job,
      repository,
      config,
      client,
      prepared,
      preflight.credentials,
    );
    let appointmentPreparation: AppointmentPreparationResult | null = null;
    let appointmentContinuationErrorCode: string | null = null;
    if (args.continueToAppointment) {
      phase = "appointment_preparation";
      try {
        appointmentPreparation = await continueToAppointmentAfterRegistration({
          requested: args.continueToAppointment,
          registration: completed,
          credentials: preflight.credentials,
          prepare: (credentials) => client.prepareAppointmentFlow(preflight.job, credentials),
        });
      } catch {
        appointmentContinuationErrorCode = "appointment_preparation_failed";
      }
    }
    const succeeded = printRegistrationResult(
      preflight.applicationId,
      preflight.credentials,
      completed,
      appointmentPreparation,
      appointmentContinuationErrorCode,
      args.continueToAppointment,
    );
    // A checkpoint is a non-successful command outcome and must be resumed by
    // the runner; callers can distinguish it from a hard failure with 2.
    const appointmentSucceeded = !args.continueToAppointment
      || appointmentPreparation?.readyForSlotCapture === true;
    process.exitCode = succeeded && appointmentSucceeded ? 0 : completed.gate ? 2 : 1;
  } finally {
    try {
      await client?.close();
    } finally {
      await cloud?.browser.close().catch(() => undefined);
    }
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(JSON.stringify({
      status: "registration_failed",
      phase,
      code: classifyRegistrationFailure(error),
      message: "US appointment registration stopped without logging account secrets or provider details.",
    }));
    process.exitCode = 1;
  });
}
