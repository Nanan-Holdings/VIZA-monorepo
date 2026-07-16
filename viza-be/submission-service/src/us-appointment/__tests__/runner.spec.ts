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
  type AppointmentAccountCredentials,
} from "../runner";
import {
  buildUSAppointmentBrowserApiEndpointForAttempt,
  buildUSVisaSchedulingUsername,
  classifyUSVisaSchedulingGateText,
  US_VISA_SCHEDULING_SELECTORS,
} from "../usvisascheduling-portal";

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
  credentials: AppointmentAccountCredentials | null = null;
  verificationEmail: { code: string | null; link: string | null } | null = null;
  accountMarkedVerified = false;
  finalApprovalCompleted = false;

  async listCandidateJobs(): Promise<USAppointmentJobRow[]> {
    return [];
  }

  async hasPendingManualAction(): Promise<boolean> {
    return false;
  }

  async getAppointmentAccountCredentials(): Promise<AppointmentAccountCredentials | null> {
    return this.credentials;
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

  async hasCompletedFinalApproval(): Promise<boolean> {
    return this.finalApprovalCompleted;
  }

  async waitForAccountVerificationEmail(): Promise<{ code: string | null; link: string | null }> {
    if (!this.verificationEmail) throw new Error("verification email unavailable");
    return this.verificationEmail;
  }

  async markAppointmentAccountVerified(): Promise<void> {
    this.accountMarkedVerified = true;
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

test("US appointment runner reads user Chrome CDP configuration", () => {
  const config = loadUSAppointmentRunnerConfig({
    US_APPOINTMENT_PLAYWRIGHT_ENABLED: "true",
    US_APPOINTMENT_PLAYWRIGHT_CHANNEL: "chrome",
    US_APPOINTMENT_CDP_ENDPOINT: "http://127.0.0.1:9222",
    US_APPOINTMENT_STORAGE_STATE_PATH: "output/playwright/usvisascheduling.json",
  });

  assert.equal(config.playwrightEnabled, true);
  assert.equal(config.playwrightChannel, "chrome");
  assert.equal(config.playwrightCdpEndpoint, "http://127.0.0.1:9222");
  assert.equal(config.playwrightStorageStatePath, "output/playwright/usvisascheduling.json");
});

test("US appointment runner reads local Chrome CDP bridge configuration", () => {
  const config = loadUSAppointmentRunnerConfig({
    US_APPOINTMENT_PLAYWRIGHT_ENABLED: "true",
    US_APPOINTMENT_BROWSER_API_ENDPOINT: "wss://user:pass@brd.superproxy.io:9222",
    US_APPOINTMENT_LOCAL_CDP_ENDPOINT: "http://127.0.0.1:9222",
    US_APPOINTMENT_BROWSER_API_SESSION_ATTEMPTS: "3",
  });

  assert.equal(config.playwrightCdpEndpoint, "wss://user:pass@brd.superproxy.io:9222");
  assert.equal(config.localCdpEndpoint, "http://127.0.0.1:9222");
  assert.equal(config.browserApiSessionAttempts, 3);
});

test("US appointment runner can read Bright Data Browser API endpoint", () => {
  const config = loadUSAppointmentRunnerConfig({
    US_APPOINTMENT_PLAYWRIGHT_ENABLED: "true",
    BRIGHTDATA_BROWSER_API_ENDPOINT: "wss://user:pass@brd.superproxy.io:9222",
  });

  assert.equal(config.playwrightEnabled, true);
  assert.equal(config.playwrightCdpEndpoint, "wss://user:pass@brd.superproxy.io:9222");
});

test("US appointment runner prefers US-specific Browser API endpoint", () => {
  const config = loadUSAppointmentRunnerConfig({
    US_APPOINTMENT_PLAYWRIGHT_ENABLED: "true",
    US_APPOINTMENT_BROWSER_API_ENDPOINT: "wss://us-user:pass@brd.superproxy.io:9222",
    BRIGHTDATA_BROWSER_API_ENDPOINT: "wss://global-user:pass@brd.superproxy.io:9222",
  });

  assert.equal(config.playwrightEnabled, true);
  assert.equal(config.playwrightCdpEndpoint, "wss://us-user:pass@brd.superproxy.io:9222");
});

test("US appointment runner defaults to human-paced 80-120ms typing", () => {
  const config = loadUSAppointmentRunnerConfig({});

  assert.equal(config.typingDelayMinMs, 80);
  assert.equal(config.typingDelayMaxMs, 120);
});

test("USVisaScheduling selectors avoid mixed text-engine comma lists", () => {
  for (const [name, selector] of Object.entries(US_VISA_SCHEDULING_SELECTORS)) {
    assert.equal(
      selector.includes(", text="),
      false,
      `${name} mixes Playwright text selectors into a CSS selector list`,
    );
  }
});

test("USVisaScheduling registration username is deterministic and not an email address", () => {
  const username = buildUSVisaSchedulingUsername("Applicant.Example+US@Example.COM");

  assert.match(username, /^viza[a-f0-9]{16}$/);
  assert.equal(username.includes("@"), false);
  assert.equal(username, buildUSVisaSchedulingUsername("applicant.example+us@example.com"));
});

test("USVisaScheduling Browser API endpoint rotation changes only Bright Data session usernames", () => {
  const first = buildUSAppointmentBrowserApiEndpointForAttempt(
    "wss://brd-customer-test-zone-us:pass@brd.superproxy.io:9222",
    1,
  );
  const second = buildUSAppointmentBrowserApiEndpointForAttempt(
    "wss://brd-customer-test-zone-us-session-old:pass@brd.superproxy.io:9222",
    1,
  );
  const local = buildUSAppointmentBrowserApiEndpointForAttempt("http://127.0.0.1:9222", 1);

  assert.match(first, /^wss:\/\/brd-customer-test-zone-us-session-vizaus[a-f0-9]{8}:pass@brd\.superproxy\.io:9222\/$/);
  assert.match(second, /^wss:\/\/brd-customer-test-zone-us-session-vizaus[a-f0-9]{8}:pass@brd\.superproxy\.io:9222\/$/);
  assert.equal(local, "http://127.0.0.1:9222");
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
  assert.equal(
    isEligibleUSAppointmentJob({
      ...baseJob,
      status: "appointment_login_required",
      requires_user_action: true,
      current_manual_action: "login",
    }, config),
    true,
  );
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

test("US appointment runner can automate a pending login checkpoint with saved credentials", async () => {
  const repository = new InMemoryRunnerRepository();
  repository.credentials = {
    email: "applicant@example.com",
    password: "secret-password",
  };
  let receivedCredentials: AppointmentAccountCredentials | null = null;
  const portalClient: USAppointmentPortalClient = {
    async prepareAppointmentFlow(_job, credentials) {
      receivedCredentials = credentials;
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
    {
      ...baseJob,
      status: "appointment_login_required",
      requires_user_action: true,
      current_manual_action: "login",
    },
    repository,
    loadUSAppointmentRunnerConfig({
      US_APPOINTMENT_ASSISTED_LIVE_ENABLED: "true",
    }),
    portalClient,
  );

  assert.equal(result, "processed");
  assert.deepEqual(receivedCredentials, repository.credentials);
  assert.equal(repository.manualActions.length, 0);
  assert.equal(repository.jobUpdates.at(-1)?.status, "appointment_payment_completed");
});

test("US appointment runner records a login gate when saved credentials are missing", async () => {
  const repository = new InMemoryRunnerRepository();
  const result = await processUSAppointmentJob(
    {
      ...baseJob,
      status: "appointment_login_required",
      requires_user_action: true,
      current_manual_action: "login",
    },
    repository,
    loadUSAppointmentRunnerConfig({
      US_APPOINTMENT_ASSISTED_LIVE_ENABLED: "true",
    }),
  );

  assert.equal(result, "processed");
  assert.equal(repository.manualActions.length, 1);
  assert.equal(repository.jobUpdates.at(-1)?.status, "appointment_manual_required");
  assert.equal(repository.jobUpdates.at(-1)?.currentManualAction, "login");
  assert.equal(
    repository.auditEvents.at(-1)?.metadata_redacted_json.gate_type,
    "missing_account_credentials",
  );
});

test("US appointment runner persists unsupported official-site gates as manual-required", async () => {
  const repository = new InMemoryRunnerRepository();
  const portalClient: USAppointmentPortalClient = {
    async prepareAppointmentFlow() {
      return {
        readyForSlotCapture: false,
        gate: {
          jobStatus: "appointment_manual_required",
          actionType: "captcha",
          instruction: "Unsupported hCaptcha challenge requires manual review.",
          metadata: {
            gate_type: "unsupported_captcha",
            provider: "hcaptcha",
            visible_text: "[REDACTED]",
          },
          errorCode: "unsupported_captcha",
          errorMessage: "USVisaScheduling presented an unsupported CAPTCHA challenge.",
        },
      };
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
  assert.equal(repository.manualActions.length, 1);
  assert.deepEqual(repository.jobUpdates.at(-1), {
    jobId: baseJob.id,
    status: "appointment_manual_required",
    currentManualAction: "captcha",
  });
  assert.deepEqual(repository.applicationStates.at(-1), {
    applicationId: baseJob.application_id,
    status: "appointment_manual_required",
    jobId: baseJob.id,
  });
  assert.equal(repository.auditEvents.at(-1)?.event_type, "appointment_runner_manual_required");
  assert.equal(
    repository.auditEvents.at(-1)?.metadata_redacted_json.gate_type,
    "unsupported_captcha",
  );
});

test("US appointment runner persists account email verification as an explicit checkpoint", async () => {
  const repository = new InMemoryRunnerRepository();
  repository.credentials = {
    email: "applicant@example.com",
    password: "secret-password",
  };
  const portalClient: USAppointmentPortalClient = {
    async prepareAppointmentFlow() {
      return {
        readyForSlotCapture: false,
        gate: {
          jobStatus: "appointment_manual_required",
          actionType: "account_email_verification",
          instruction: "Enter the official account email verification code.",
          userInputSchemaJson: {
            type: "object",
            properties: {
              emailCode: { type: "string" },
            },
            required: ["emailCode"],
          },
          metadata: {
            gate_type: "account_email_verification",
            provider: "usvisascheduling",
            account_email: "[REDACTED]",
          },
          errorCode: "account_email_verification_required",
          errorMessage: "USVisaScheduling requires an official account email verification code.",
        },
      };
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
    {
      ...baseJob,
      status: "appointment_login_required",
    },
    repository,
    loadUSAppointmentRunnerConfig({
      US_APPOINTMENT_ASSISTED_LIVE_ENABLED: "true",
    }),
    portalClient,
  );

  assert.equal(result, "processed");
  assert.equal(repository.manualActions.length, 1);
  assert.equal(repository.jobUpdates.at(-1)?.currentManualAction, "account_email_verification");
  assert.deepEqual(
    (repository.manualActions.at(-1) as { user_input_schema_json?: unknown }).user_input_schema_json,
    {
      type: "object",
      properties: {
        emailCode: { type: "string" },
      },
      required: ["emailCode"],
    },
  );
});

test("US appointment runner reads the alias inbox and completes account email verification", async () => {
  const repository = new InMemoryRunnerRepository();
  repository.credentials = {
    email: "applicant@example.com",
    password: "secret-password",
  };
  repository.verificationEmail = { code: "123456", link: null };
  let prepareCalls = 0;
  let receivedCode: string | null | undefined;
  const portalClient: USAppointmentPortalClient = {
    async prepareAppointmentFlow() {
      prepareCalls += 1;
      if (prepareCalls === 1) {
        return {
          readyForSlotCapture: false,
          gate: {
            jobStatus: "appointment_manual_required",
            actionType: "account_email_verification",
            instruction: "Verify the account email.",
            metadata: { provider: "usvisascheduling" },
          },
        };
      }
      return { readyForSlotCapture: true };
    },
    async completeAccountEmailVerification(input) {
      receivedCode = input.emailCode;
      return { readyForSlotCapture: false };
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
    { ...baseJob, status: "appointment_login_required" },
    repository,
    loadUSAppointmentRunnerConfig({
      US_APPOINTMENT_ASSISTED_LIVE_ENABLED: "true",
    }),
    portalClient,
  );

  assert.equal(result, "processed");
  assert.equal(receivedCode, "123456");
  assert.equal(repository.accountMarkedVerified, true);
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
          autoPrepare: true,
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

test("US appointment runner rechecks slots after a no-slots result", async () => {
  const repository = new InMemoryRunnerRepository();
  const result = await processUSAppointmentJob(
    {
      ...baseJob,
      status: "appointment_no_slots_available",
      user_preferences_json: {
        portalFixture: {
          autoPrepare: true,
          slots: [
            {
              date: "2026-10-03",
              time: "11:00",
              location: "U.S. Embassy Beijing",
              externalSlotId: "slot-2",
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
  assert.equal(repository.jobUpdates.at(-1)?.status, "appointment_slot_selection_required");
});

test("US appointment runner can use an injected portal client for slot observation", async () => {
  const repository = new InMemoryRunnerRepository();
  const portalClient: USAppointmentPortalClient = {
    async prepareAppointmentFlow() {
      return { readyForSlotCapture: true };
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

test("US appointment runner does not report no-slots when slot recheck is gated", async () => {
  const repository = new InMemoryRunnerRepository();
  const portalClient: USAppointmentPortalClient = {
    async prepareAppointmentFlow() {
      return {
        readyForSlotCapture: false,
        gate: {
          jobStatus: "appointment_manual_required",
          actionType: "login",
          instruction: "USVisaScheduling login is required before slot observation.",
          metadata: {
            gate_type: "login_required",
            provider: "usvisascheduling",
          },
          errorCode: "login_required",
          errorMessage: "USVisaScheduling login is required before slot observation.",
        },
      };
    },
    async observeSlots() {
      throw new Error("observeSlots should not run before the portal is prepared.");
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
      status: "appointment_no_slots_available",
      user_preferences_json: {},
    },
    repository,
    loadUSAppointmentRunnerConfig({
      US_APPOINTMENT_ASSISTED_LIVE_ENABLED: "true",
    }),
    portalClient,
  );

  assert.equal(result, "processed");
  assert.equal(repository.slots.length, 0);
  assert.equal(repository.manualActions.length, 1);
  assert.equal(repository.jobUpdates.at(-1)?.status, "appointment_manual_required");
  assert.equal(repository.jobUpdates.at(-1)?.currentManualAction, "login");
});

test("US appointment runner records a login gate when portal login automation throws", async () => {
  const repository = new InMemoryRunnerRepository();
  const portalClient: USAppointmentPortalClient = {
    async prepareAppointmentFlow() {
      throw new Error("password input was not editable on the official login page");
    },
    async observeSlots() {
      throw new Error("observeSlots should not run after login automation failure.");
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
      status: "appointment_no_slots_available",
      user_preferences_json: {},
    },
    repository,
    loadUSAppointmentRunnerConfig({
      US_APPOINTMENT_ASSISTED_LIVE_ENABLED: "true",
    }),
    portalClient,
  );

  assert.equal(result, "processed");
  assert.equal(repository.manualActions.length, 1);
  assert.equal(repository.jobUpdates.at(-1)?.status, "appointment_manual_required");
  assert.equal(repository.jobUpdates.at(-1)?.currentManualAction, "login");
});

test("US appointment runner writes confirmation after final approved booking fixture", async () => {
  const repository = new InMemoryRunnerRepository();
  repository.finalApprovalCompleted = true;
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
          autoPrepare: true,
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

test("US appointment runner never clicks the official confirmation without persisted final approval", async () => {
  const repository = new InMemoryRunnerRepository();
  repository.selectedSlot = {
    id: "44444444-4444-4444-8444-444444444444",
    job_id: baseJob.id,
    appointment_date: "2026-08-18",
    appointment_time: "09:00",
    appointment_location: "U.S. Embassy Beijing",
    appointment_type: "interview",
    metadata_redacted_json: null,
  };
  let confirmationCaptureAttempted = false;
  const portalClient: USAppointmentPortalClient = {
    async prepareAppointmentFlow() {
      return { readyForSlotCapture: true };
    },
    async observeSlots() {
      return [];
    },
    async captureConfirmation() {
      confirmationCaptureAttempted = true;
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

  await processUSAppointmentJob(
    { ...baseJob, status: "appointment_booked" },
    repository,
    loadUSAppointmentRunnerConfig({ US_APPOINTMENT_ASSISTED_LIVE_ENABLED: "true" }),
    portalClient,
  );

  assert.equal(confirmationCaptureAttempted, false);
  assert.equal(repository.jobUpdates.at(-1)?.status, "appointment_final_confirmation_required");
  assert.equal(repository.jobUpdates.at(-1)?.currentManualAction, "final_confirmation");
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

test("USVisaScheduling gate classifier identifies unsupported official-site gates", () => {
  assert.deepEqual(
    classifyUSVisaSchedulingGateText("Please complete hCaptcha verification before continuing."),
    {
      jobStatus: "appointment_manual_required",
      actionType: "captcha",
      instruction: "USVisaScheduling presented an unsupported CAPTCHA or MFA checkpoint.",
      metadata: {
        gate_type: "unsupported_captcha",
        provider: "hcaptcha",
        visible_text: "[REDACTED]",
      },
      errorCode: "unsupported_captcha",
      errorMessage: "USVisaScheduling presented an unsupported CAPTCHA or MFA checkpoint.",
    },
  );
  assert.equal(
    classifyUSVisaSchedulingGateText("You are now in the waiting room.")?.metadata.gate_type,
    "waiting_room",
  );
  assert.equal(
    classifyUSVisaSchedulingGateText("请稍候... Just a moment while we verify you are human.")?.metadata.provider,
    "cloudflare",
  );
  assert.equal(
    classifyUSVisaSchedulingGateText("Review and accept the privacy policy before continuing.")?.actionType,
    "site_policy_review",
  );
  assert.equal(
    classifyUSVisaSchedulingGateText(
      "https://www.usvisascheduling.com/en-US/Account/Login/TermsAndConditions Access Denied You're offline. This is a read only version of the page. var isPortalUserLoggedIn = 'False';",
    )?.metadata.gate_type,
    "power_pages_access_or_terms",
  );
  assert.equal(
    classifyUSVisaSchedulingGateText("Payment required before scheduling your appointment.")?.actionType,
    "payment",
  );
});
