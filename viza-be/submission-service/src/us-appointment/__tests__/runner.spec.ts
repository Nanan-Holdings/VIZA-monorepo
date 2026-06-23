import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildRunnerHandoff,
  isEligibleUSAppointmentJob,
  loadUSAppointmentRunnerConfig,
  processUSAppointmentJob,
  validateUSAppointmentRunnerStart,
  type AuditEventInsert,
  type ConfirmationInsert,
  type AppointmentSlotRow,
  type SlotInsert,
  type StatusCheckInsert,
  type USAppointmentJobRow,
  type USAppointmentPortalClient,
  type USAppointmentRunnerRepository,
} from "../runner";

const baseJob: USAppointmentJobRow = {
  id: "11111111-1111-4111-8111-111111111111",
  application_id: "22222222-2222-4222-8222-222222222222",
  user_id: "33333333-3333-4333-8333-333333333333",
  appointment_account_id: null,
  applying_country_code: "CN",
  applying_post_city: "Beijing",
  scheduling_provider: "usvisascheduling",
  status: "appointment_consent_received",
  mode: "assisted_live",
  user_preferences_json: { timePreference: "morning" },
  requires_user_action: false,
  current_manual_action: null,
  updated_at: "2026-06-11T00:00:00.000Z",
};

class InMemoryRunnerRepository implements USAppointmentRunnerRepository {
  manualActions: unknown[] = [];
  auditEvents: AuditEventInsert[] = [];
  slots: SlotInsert[] = [];
  confirmations: ConfirmationInsert[] = [];
  statusChecks: StatusCheckInsert[] = [];
  selectedSlot: AppointmentSlotRow | null = null;
  applicationStates: Array<{
    applicationId: string;
    status: string;
    jobId?: string | null;
    confirmationId?: string | null;
  }> = [];
  jobUpdates: Array<{ jobId: string; status: string; currentManualAction: string | null }> = [];

  async listCandidateJobs(): Promise<USAppointmentJobRow[]> {
    return [];
  }

  async hasPendingManualAction(): Promise<boolean> {
    return false;
  }

  async insertManualAction(input: never): Promise<void> {
    this.manualActions.push(input);
  }

  async updateJobForManualAction(input: {
    jobId: string;
    status: string;
    currentManualAction: string;
  }): Promise<void> {
    this.jobUpdates.push(input);
  }

  async updateJobStatus(input: {
    jobId: string;
    status: string;
    currentManualAction?: string | null;
  }): Promise<void> {
    this.jobUpdates.push({
      jobId: input.jobId,
      status: input.status,
      currentManualAction: input.currentManualAction ?? null,
    });
  }

  async insertAuditEvent(input: AuditEventInsert): Promise<void> {
    this.auditEvents.push(input);
  }

  async insertSlots(input: SlotInsert[]): Promise<void> {
    this.slots.push(...input);
  }

  async insertConfirmation(input: ConfirmationInsert): Promise<{ id: string | null }> {
    this.confirmations.push(input);
    return { id: "55555555-5555-4555-8555-555555555555" };
  }

  async insertStatusCheck(input: StatusCheckInsert): Promise<void> {
    this.statusChecks.push(input);
  }

  async getSelectedSlot(): Promise<AppointmentSlotRow | null> {
    return this.selectedSlot;
  }

  async updateApplicationAppointmentState(input: {
    applicationId: string;
    status: string;
    jobId?: string | null;
    confirmationId?: string | null;
  }): Promise<void> {
    this.applicationStates.push(input);
  }
}

test("US appointment runner config is disabled by default", () => {
  const config = loadUSAppointmentRunnerConfig({});
  assert.equal(config.enabled, false);
  assert.equal(config.captchaSolvingEnabled, false);
  assert.equal(config.twoCaptchaConfigured, false);
  assert.deepEqual(config.providerAllowlist, ["usvisascheduling"]);
  assert.deepEqual(config.supportedCountries, ["CN"]);
});

test("US appointment runner blocks 2captcha mode without TWOCAPTCHA_API_KEY", () => {
  const config = loadUSAppointmentRunnerConfig({
    US_APPOINTMENT_ASSISTED_LIVE_ENABLED: "true",
    US_APPOINTMENT_CAPTCHA_SOLVING_ENABLED: "true",
  });
  assert.equal(config.captchaSolvingEnabled, true);
  assert.equal(config.twoCaptchaConfigured, false);
  assert.match(validateUSAppointmentRunnerStart(config) ?? "", /TWOCAPTCHA_API_KEY/);
});

test("US appointment runner exposes 2captcha handoff metadata when configured", () => {
  const config = loadUSAppointmentRunnerConfig({
    US_APPOINTMENT_ASSISTED_LIVE_ENABLED: "true",
    US_APPOINTMENT_CAPTCHA_SOLVING_ENABLED: "true",
    TWOCAPTCHA_API_KEY: "test-key",
  });
  assert.equal(validateUSAppointmentRunnerStart(config), null);
  const handoff = buildRunnerHandoff(baseJob, config);
  assert.equal(handoff.metadata.captcha_solver_enabled, true);
  assert.equal(handoff.metadata.captcha_solver_provider, "2captcha");
});

test("US appointment runner only accepts enabled China usvisascheduling assisted-live jobs", () => {
  const config = loadUSAppointmentRunnerConfig({
    US_APPOINTMENT_ASSISTED_LIVE_ENABLED: "true",
    US_APPOINTMENT_PROVIDER_ALLOWLIST: "usvisascheduling",
    US_APPOINTMENT_SUPPORTED_COUNTRIES: "CN",
  });
  assert.equal(isEligibleUSAppointmentJob(baseJob, config), true);
  assert.equal(isEligibleUSAppointmentJob({ ...baseJob, mode: "dry_run" }, config), false);
  assert.equal(isEligibleUSAppointmentJob({ ...baseJob, applying_country_code: "SG" }, config), false);
  assert.equal(isEligibleUSAppointmentJob({ ...baseJob, scheduling_provider: "ais_usvisa_info" }, config), false);
  assert.equal(isEligibleUSAppointmentJob({ ...baseJob, requires_user_action: true }, config), false);
});

test("US appointment runner handoff records manual-required unsupported gate metadata", () => {
  const handoff = buildRunnerHandoff(baseJob);
  assert.equal(handoff.jobStatus, "appointment_manual_required");
  assert.equal(handoff.actionType, "site_policy_review");
  assert.match(handoff.instruction, /manual review/i);
  assert.equal(handoff.metadata.captcha_solver_enabled, false);
  assert.equal(handoff.metadata.supported_checkpoint_handling, true);
  assert.equal("no_final_confirmation_click" in handoff.metadata, false);
  assert.equal("no_payment_automation" in handoff.metadata, false);
});

test("US appointment runner advances a prepared portal session to slot capture", async () => {
  const repository = new InMemoryRunnerRepository();
  const portalClient: USAppointmentPortalClient = {
    async prepareAppointmentFlow() {
      return { readyForSlotCapture: true };
    },
    async observeSlots() {
      return [];
    },
    async captureConfirmation() {
      return null;
    },
    async captureStatusCheck(job) {
      return {
        job_id: job.id,
        application_id: job.application_id,
        user_id: job.user_id,
        status: "unknown",
        result_redacted_json: {},
      };
    },
  };

  const result = await processUSAppointmentJob(
    baseJob,
    repository,
    loadUSAppointmentRunnerConfig({
      US_APPOINTMENT_ASSISTED_LIVE_ENABLED: "true",
    }),
    portalClient,
  );

  assert.equal(result, "processed");
  assert.equal(repository.manualActions.length, 0);
  assert.equal(repository.jobUpdates.at(-1)?.status, "appointment_payment_completed");
});

test("US appointment runner writes observed slots from a portal fixture", async () => {
  const repository = new InMemoryRunnerRepository();
  const result = await processUSAppointmentJob(
    {
      ...baseJob,
      status: "appointment_payment_completed",
      user_preferences_json: {
        portalFixture: {
          slots: [
            {
              date: "2026-08-18",
              time: "09:00",
              location: "U.S. Embassy Beijing",
              externalSlotId: "slot-1",
            },
          ],
        },
      },
    },
    repository,
    loadUSAppointmentRunnerConfig({
      US_APPOINTMENT_ASSISTED_LIVE_ENABLED: "true",
    }),
  );

  assert.equal(result, "processed");
  assert.equal(repository.slots.length, 1);
  assert.equal(repository.slots[0]?.appointment_date, "2026-08-18");
  assert.equal(repository.slots[0]?.metadata_redacted_json.externalSlotId, "[REDACTED]");
  assert.equal(repository.jobUpdates.at(-1)?.status, "appointment_slot_selection_required");
});

test("US appointment runner can use an injected portal client for slot observation", async () => {
  const repository = new InMemoryRunnerRepository();
  const portalClient: USAppointmentPortalClient = {
    async prepareAppointmentFlow() {
      return { readyForSlotCapture: false };
    },
    async observeSlots(job) {
      return [
        {
          job_id: job.id,
          application_id: job.application_id,
          appointment_date: "2026-09-01",
          appointment_time: "14:30",
          appointment_location: "U.S. Consulate General Shanghai",
          appointment_type: "interview",
          source: "usvisascheduling",
          status: "observed",
          metadata_redacted_json: {
            externalSlotId: "[REDACTED]",
            calendarPageContext: { post: "Shanghai" },
          },
        },
      ];
    },
    async captureConfirmation() {
      return null;
    },
    async captureStatusCheck(job) {
      return {
        job_id: job.id,
        application_id: job.application_id,
        user_id: job.user_id,
        status: "unknown",
        result_redacted_json: {},
      };
    },
  };

  const result = await processUSAppointmentJob(
    {
      ...baseJob,
      status: "appointment_payment_completed",
      user_preferences_json: {},
    },
    repository,
    loadUSAppointmentRunnerConfig({
      US_APPOINTMENT_ASSISTED_LIVE_ENABLED: "true",
    }),
    portalClient,
  );

  assert.equal(result, "processed");
  assert.equal(repository.slots[0]?.appointment_location, "U.S. Consulate General Shanghai");
});

test("US appointment runner writes confirmation after final approved booking fixture", async () => {
  const repository = new InMemoryRunnerRepository();
  repository.selectedSlot = {
    id: "44444444-4444-4444-8444-444444444444",
    job_id: baseJob.id,
    appointment_date: "2026-08-18",
    appointment_time: "09:00",
    appointment_location: "U.S. Embassy Beijing",
    appointment_type: "interview",
    metadata_redacted_json: {
      externalSlotId: "[REDACTED]",
      calendarPageContext: { month: "2026-08" },
    },
  };
  const result = await processUSAppointmentJob(
    {
      ...baseJob,
      status: "appointment_booked",
      user_preferences_json: {
        portalFixture: {
          confirmation: {
            confirmationNumber: "CN-BJ-123456",
            screenshotUrl: "https://storage.example/confirmation.png",
            pdfUrl: "https://storage.example/confirmation.pdf",
          },
        },
      },
    },
    repository,
    loadUSAppointmentRunnerConfig({
      US_APPOINTMENT_ASSISTED_LIVE_ENABLED: "true",
    }),
  );

  assert.equal(result, "processed");
  assert.equal(repository.confirmations.length, 1);
  assert.equal(repository.confirmations[0]?.confirmation_number, "CN-BJ-123456");
  assert.equal(repository.confirmations[0]?.appointment_date, "2026-08-18");
  assert.equal(repository.jobUpdates.at(-1)?.status, "appointment_confirmation_captured");
  assert.deepEqual(repository.applicationStates.at(-1), {
    applicationId: baseJob.application_id,
    status: "appointment_confirmation_captured",
    jobId: baseJob.id,
    confirmationId: "55555555-5555-4555-8555-555555555555",
  });
});

test("US appointment runner writes follow-up status check fixture", async () => {
  const repository = new InMemoryRunnerRepository();
  const result = await processUSAppointmentJob(
    {
      ...baseJob,
      status: "appointment_status_check_in_progress",
      user_preferences_json: {
        portalFixture: {
          statusCheck: {
            status: "appointment_exists",
            message: "Appointment still scheduled",
            screenshotUrl: "https://storage.example/status.png",
          },
        },
      },
    },
    repository,
    loadUSAppointmentRunnerConfig({
      US_APPOINTMENT_ASSISTED_LIVE_ENABLED: "true",
    }),
  );

  assert.equal(result, "processed");
  assert.equal(repository.statusChecks.length, 1);
  assert.equal(repository.statusChecks[0]?.status, "appointment_exists");
  assert.equal(repository.statusChecks[0]?.screenshot_url, "https://storage.example/status.png");
  assert.equal(repository.jobUpdates.at(-1)?.status, "appointment_status_checked");
});
