#!/usr/bin/env npx tsx
import "dotenv/config";
import {
  loadUSAppointmentRunnerConfig,
  processUSAppointmentJob,
  SupabaseUSAppointmentRunnerRepository,
  validateUSAppointmentRunnerStart,
  type USAppointmentJobRow,
} from "../src/us-appointment";

type Args = {
  jobId: string | null;
  applicationId: string | null;
  maxSteps: number;
};

const AUTOMATIC_STATUSES = new Set([
  "appointment_consent_received",
  "appointment_account_required",
  "appointment_login_required",
  "appointment_payment_completed",
  "appointment_no_slots_available",
  "appointment_booked",
  "appointment_status_check_in_progress",
]);

function readArg(name: string): string | null {
  const marker = `--${name}=`;
  const inline = process.argv.find((item) => item.startsWith(marker));
  if (inline) return inline.slice(marker.length).trim() || null;
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1]?.trim() || null : null;
}

function parseArgs(): Args {
  const rawMaxSteps = Number.parseInt(readArg("max-steps") ?? "6", 10);
  const args = {
    jobId: readArg("job-id"),
    applicationId: readArg("application-id"),
    maxSteps: Number.isFinite(rawMaxSteps) ? Math.min(12, Math.max(1, rawMaxSteps)) : 6,
  };
  if (!args.jobId && !args.applicationId) {
    throw new Error("--job-id or --application-id is required");
  }
  return args;
}

function safeJob(job: USAppointmentJobRow) {
  return {
    id: job.id,
    applicationId: job.application_id,
    status: job.status,
    provider: job.scheduling_provider,
    country: job.applying_country_code,
    requiresUserAction: job.requires_user_action,
    currentManualAction: job.current_manual_action,
  };
}

async function resolveJob(
  repository: SupabaseUSAppointmentRunnerRepository,
  args: Args,
): Promise<USAppointmentJobRow> {
  const job = args.jobId
    ? await repository.getJob(args.jobId)
    : await repository.getLatestJobForApplication(args.applicationId ?? "");
  if (!job) throw new Error("No matching US appointment job was found.");
  return job;
}

async function main(): Promise<void> {
  const args = parseArgs();
  const config = loadUSAppointmentRunnerConfig();
  const configError = validateUSAppointmentRunnerStart(config);
  if (configError) throw new Error(configError);
  if (!config.enabled || !config.playwrightEnabled) {
    throw new Error(
      "US_APPOINTMENT_ASSISTED_LIVE_ENABLED=true and US_APPOINTMENT_PLAYWRIGHT_ENABLED=true are required.",
    );
  }

  const repository = new SupabaseUSAppointmentRunnerRepository();
  let job = await resolveJob(repository, args);
  console.log(JSON.stringify({ event: "flow_started", job: safeJob(job) }, null, 2));

  for (let step = 1; step <= args.maxSteps; step += 1) {
    if (!AUTOMATIC_STATUSES.has(job.status)) break;
    const beforeStatus = job.status;
    const outcome = await processUSAppointmentJob(job, repository, config);
    const refreshed = await repository.getJob(job.id);
    if (!refreshed) throw new Error("US appointment job disappeared after processing.");
    job = refreshed;
    console.log(JSON.stringify({
      event: "flow_step",
      step,
      outcome,
      previousStatus: beforeStatus,
      job: safeJob(job),
    }, null, 2));
    if (outcome === "skipped" || job.status === beforeStatus) break;
  }

  console.log(JSON.stringify({
    event: "flow_stopped",
    job: safeJob(job),
    nextAction:
      job.status === "appointment_slot_selection_required"
        ? "Select one observed slot in the VIZA Portal."
        : job.status === "appointment_final_confirmation_required"
          ? "Approve the selected slot in the VIZA Portal."
          : job.status === "appointment_confirmation_captured"
            ? "Official confirmation was captured."
            : job.requires_user_action
              ? `Complete the ${job.current_manual_action ?? "manual"} checkpoint in the VIZA Portal.`
              : "The Fly worker can resume this job from its persisted status.",
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({
    event: "flow_failed",
    message: error instanceof Error ? error.message.split("\n")[0] : String(error),
  }, null, 2));
  process.exit(1);
});
