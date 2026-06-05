import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createUSAppointmentServices,
  redactSensitivePayload,
  USAppointmentProviderRegistry,
  USAppointmentServiceError,
  type AppointmentAccount,
  type AppointmentAssistanceAttempt,
  type AppointmentAssistanceJob,
  type AppointmentConfirmation,
  type AppointmentManualAction,
  type AppointmentSlot,
  type AppointmentStatusCheck,
  type InsertAppointmentAccountInput,
  type InsertAppointmentAttemptInput,
  type InsertAppointmentAuditEventInput,
  type InsertAppointmentConfirmationInput,
  type InsertAppointmentJobInput,
  type InsertAppointmentManualActionInput,
  type InsertAppointmentSlotInput,
  type InsertStatusCheckInput,
  type JsonObject,
  type USAppointmentApplication,
  type USAppointmentRepository,
} from "./index.js";

const APPLICATION_ID = "11111111-1111-4111-8111-111111111111";
const APPLICANT_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";

function now(): string {
  return new Date().toISOString();
}

function baseApplication(
  overrides: Partial<USAppointmentApplication> = {},
): USAppointmentApplication {
  return {
    id: APPLICATION_ID,
    applicantId: APPLICANT_ID,
    userId: USER_ID,
    country: "united_states",
    countryCode: "US",
    visaType: "DS160",
    status: "submitted",
    paymentStatus: "paid",
    packetStatus: "ready",
    automationStatus: "submitted",
    confirmationNumber: null,
    ds160ApplicationId: "AA00DRYRUN1",
    ds160RetrievalUrl: "https://ceac.state.gov/GenNIV/Default.aspx",
    appointmentAssistanceStatus: "appointment_not_started",
    ...overrides,
  };
}

class InMemoryUSAppointmentRepository implements USAppointmentRepository {
  application: USAppointmentApplication | null = baseApplication();
  accounts: AppointmentAccount[] = [];
  jobs: AppointmentAssistanceJob[] = [];
  attempts: AppointmentAssistanceAttempt[] = [];
  manualActions: AppointmentManualAction[] = [];
  slots: AppointmentSlot[] = [];
  confirmations: AppointmentConfirmation[] = [];
  statusChecks: AppointmentStatusCheck[] = [];
  auditEvents: InsertAppointmentAuditEventInput[] = [];
  applicationState: Record<string, string | null> = {};

  async getApplicationContext(): Promise<USAppointmentApplication | null> {
    return this.application;
  }

  async findConsentByIdempotencyKey(idempotencyKey: string): Promise<AppointmentManualAction | null> {
    return this.manualActions.find(
      (action) =>
        action.actionType === "consent" &&
        action.status === "completed" &&
        action.metadataRedactedJson?.idempotency_key === idempotencyKey,
    ) ?? null;
  }

  async getLatestCompletedConsent(
    applicationId: string,
    userId: string,
  ): Promise<AppointmentManualAction | null> {
    return this.manualActions
      .filter(
        (action) =>
          action.applicationId === applicationId &&
          action.userId === userId &&
          action.actionType === "consent" &&
          action.status === "completed",
      )
      .sort((a, b) => Date.parse(b.createdAt ?? "") - Date.parse(a.createdAt ?? ""))[0] ?? null;
  }

  async insertAccount(input: InsertAppointmentAccountInput): Promise<AppointmentAccount> {
    const timestamp = now();
    const account: AppointmentAccount = {
      id: randomUUID(),
      userId: input.userId,
      applicationId: input.applicationId,
      countryCode: "US",
      portal: input.portal,
      accountEmail: input.accountEmail ?? null,
      encryptedAccountPassword: null,
      passwordVaultRef: null,
      accountStatus: input.accountStatus,
      emailVerified: input.emailVerified ?? false,
      lastLoginAt: null,
      metadataRedactedJson: input.metadataRedactedJson ?? {},
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.accounts.push(account);
    return account;
  }

  async updateAccount(
    accountId: string,
    patch: Partial<Pick<AppointmentAccount, "accountStatus" | "emailVerified" | "lastLoginAt" | "metadataRedactedJson">>,
  ): Promise<AppointmentAccount> {
    const account = await this.getRequiredAccount(accountId);
    Object.assign(account, patch, { updatedAt: now() });
    return account;
  }

  async getAccount(accountId: string): Promise<AppointmentAccount | null> {
    return this.accounts.find((account) => account.id === accountId) ?? null;
  }

  async findJobByIdempotencyKey(idempotencyKey: string): Promise<AppointmentAssistanceJob | null> {
    return this.jobs.find((job) => job.idempotencyKey === idempotencyKey) ?? null;
  }

  async getJob(jobId: string): Promise<AppointmentAssistanceJob | null> {
    return this.jobs.find((job) => job.id === jobId) ?? null;
  }

  async getLatestJobForApplication(applicationId: string): Promise<AppointmentAssistanceJob | null> {
    return this.jobs
      .filter((job) => job.applicationId === applicationId)
      .sort((a, b) => Date.parse(b.createdAt ?? "") - Date.parse(a.createdAt ?? ""))[0] ?? null;
  }

  async insertJob(input: InsertAppointmentJobInput): Promise<AppointmentAssistanceJob> {
    const timestamp = now();
    const job: AppointmentAssistanceJob = {
      id: randomUUID(),
      applicationId: input.applicationId,
      userId: input.userId,
      appointmentAccountId: input.appointmentAccountId ?? null,
      countryCode: input.countryCode,
      visaType: input.visaType,
      ds160ConfirmationCode: input.ds160ConfirmationCode,
      applyingCountryCode: input.applyingCountryCode,
      applyingPostCity: input.applyingPostCity,
      schedulingProvider: input.schedulingProvider,
      status: input.status,
      mode: input.mode,
      userPreferencesJson: input.userPreferencesJson,
      requiresUserAction: input.requiresUserAction,
      currentManualAction: input.currentManualAction,
      lastErrorCode: null,
      lastErrorMessage: null,
      idempotencyKey: input.idempotencyKey,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.jobs.push(job);
    return job;
  }

  async updateJob(
    jobId: string,
    patch: Partial<
      Pick<
        AppointmentAssistanceJob,
        | "appointmentAccountId"
        | "status"
        | "requiresUserAction"
        | "currentManualAction"
        | "lastErrorCode"
        | "lastErrorMessage"
        | "schedulingProvider"
      >
    >,
  ): Promise<AppointmentAssistanceJob> {
    const job = await this.getRequiredJob(jobId);
    Object.assign(job, patch, { updatedAt: now() });
    return job;
  }

  async listAttempts(jobId: string): Promise<AppointmentAssistanceAttempt[]> {
    return this.attempts
      .filter((attempt) => attempt.jobId === jobId)
      .sort((a, b) => a.attemptNumber - b.attemptNumber);
  }

  async insertAttempt(input: InsertAppointmentAttemptInput): Promise<AppointmentAssistanceAttempt> {
    const attempt: AppointmentAssistanceAttempt = {
      id: randomUUID(),
      jobId: input.jobId,
      applicationId: input.applicationId,
      attemptNumber: input.attemptNumber,
      status: input.status,
      provider: input.provider,
      mode: input.mode,
      startedAt: now(),
      finishedAt: null,
      requestSnapshotRedactedJson: input.requestSnapshotRedactedJson,
      resultSnapshotRedactedJson: null,
      errorCode: null,
      errorMessage: null,
      screenshotUrl: null,
      traceUrl: null,
      videoUrl: null,
    };
    this.attempts.push(attempt);
    return attempt;
  }

  async updateAttempt(
    attemptId: string,
    patch: Partial<
      Pick<
        AppointmentAssistanceAttempt,
        | "status"
        | "resultSnapshotRedactedJson"
        | "errorCode"
        | "errorMessage"
        | "screenshotUrl"
        | "traceUrl"
        | "videoUrl"
        | "finishedAt"
      >
    >,
  ): Promise<AppointmentAssistanceAttempt> {
    const attempt = this.attempts.find((candidate) => candidate.id === attemptId);
    if (!attempt) throw new Error("attempt not found");
    Object.assign(attempt, patch);
    return attempt;
  }

  async insertManualAction(
    input: InsertAppointmentManualActionInput,
  ): Promise<AppointmentManualAction> {
    const timestamp = now();
    const action: AppointmentManualAction = {
      id: randomUUID(),
      jobId: input.jobId,
      applicationId: input.applicationId,
      userId: input.userId,
      actionType: input.actionType,
      status: input.status ?? "pending",
      instruction: input.instruction ?? null,
      userInputSchemaJson: input.userInputSchemaJson ?? null,
      userInputRedactedJson: input.userInputRedactedJson ?? null,
      screenshotUrl: input.screenshotUrl ?? null,
      expiresAt: input.expiresAt ?? null,
      completedAt: input.status === "completed" ? timestamp : null,
      metadataRedactedJson: input.metadataRedactedJson ?? null,
      createdAt: timestamp,
    };
    this.manualActions.push(action);
    return action;
  }

  async getManualAction(actionId: string): Promise<AppointmentManualAction | null> {
    return this.manualActions.find((action) => action.id === actionId) ?? null;
  }

  async getLatestPendingManualAction(jobId: string): Promise<AppointmentManualAction | null> {
    return this.manualActions
      .filter((action) => action.jobId === jobId && action.status === "pending")
      .sort((a, b) => Date.parse(b.createdAt ?? "") - Date.parse(a.createdAt ?? ""))[0] ?? null;
  }

  async listManualActions(jobId: string): Promise<AppointmentManualAction[]> {
    return this.manualActions
      .filter((action) => action.jobId === jobId)
      .sort((a, b) => Date.parse(a.createdAt ?? "") - Date.parse(b.createdAt ?? ""));
  }

  async updateManualAction(
    actionId: string,
    patch: Partial<
      Pick<
        AppointmentManualAction,
        "status" | "userInputRedactedJson" | "completedAt" | "metadataRedactedJson"
      >
    >,
  ): Promise<AppointmentManualAction> {
    const action = await this.getRequiredManualAction(actionId);
    Object.assign(action, patch);
    return action;
  }

  async insertSlots(input: InsertAppointmentSlotInput[]): Promise<AppointmentSlot[]> {
    const slots = input.map((slot) => {
      const row: AppointmentSlot = {
        id: randomUUID(),
        jobId: slot.jobId,
        applicationId: slot.applicationId,
        appointmentDate: slot.appointmentDate,
        appointmentTime: slot.appointmentTime,
        appointmentLocation: slot.appointmentLocation,
        appointmentType: slot.appointmentType,
        source: slot.source,
        status: slot.status ?? "observed",
        observedAt: now(),
        metadataRedactedJson: slot.metadataRedactedJson ?? null,
      };
      return row;
    });
    this.slots.push(...slots);
    return slots;
  }

  async listSlots(jobId: string): Promise<AppointmentSlot[]> {
    return this.slots.filter((slot) => slot.jobId === jobId);
  }

  async getSlot(slotId: string): Promise<AppointmentSlot | null> {
    return this.slots.find((slot) => slot.id === slotId) ?? null;
  }

  async getSelectedSlot(jobId: string): Promise<AppointmentSlot | null> {
    return this.slots.find(
      (slot) => slot.jobId === jobId && ["user_selected", "selected"].includes(slot.status),
    ) ?? null;
  }

  async updateSlotStatus(slotId: string, status: string): Promise<AppointmentSlot> {
    const slot = this.slots.find((candidate) => candidate.id === slotId);
    if (!slot) throw new Error("slot not found");
    slot.status = status;
    return slot;
  }

  async markOtherSlotsExpired(jobId: string, selectedSlotId: string): Promise<void> {
    for (const slot of this.slots) {
      if (slot.jobId === jobId && slot.id !== selectedSlotId && slot.status === "observed") {
        slot.status = "expired";
      }
    }
  }

  async insertConfirmation(
    input: InsertAppointmentConfirmationInput,
  ): Promise<AppointmentConfirmation> {
    const confirmation: AppointmentConfirmation = {
      id: randomUUID(),
      jobId: input.jobId,
      applicationId: input.applicationId,
      userId: input.userId,
      countryCode: input.countryCode,
      visaType: input.visaType,
      appointmentDate: input.appointmentDate,
      appointmentTime: input.appointmentTime,
      appointmentLocation: input.appointmentLocation,
      appointmentType: input.appointmentType,
      confirmationNumber: input.confirmationNumber,
      confirmationPdfUrl: input.confirmationPdfUrl,
      confirmationScreenshotUrl: input.confirmationScreenshotUrl,
      rawConfirmationRedactedJson: input.rawConfirmationRedactedJson,
      createdAt: now(),
    };
    this.confirmations.push(confirmation);
    return confirmation;
  }

  async getConfirmationForJob(jobId: string): Promise<AppointmentConfirmation | null> {
    return this.confirmations.find((confirmation) => confirmation.jobId === jobId) ?? null;
  }

  async getLatestStatusCheck(jobId: string): Promise<AppointmentStatusCheck | null> {
    return this.statusChecks
      .filter((check) => check.jobId === jobId)
      .sort((a, b) => Date.parse(b.checkedAt ?? "") - Date.parse(a.checkedAt ?? ""))[0] ?? null;
  }

  async insertStatusCheck(input: InsertStatusCheckInput): Promise<AppointmentStatusCheck> {
    const check: AppointmentStatusCheck = {
      id: randomUUID(),
      jobId: input.jobId,
      applicationId: input.applicationId,
      userId: input.userId,
      status: input.status,
      checkedAt: now(),
      resultRedactedJson: input.resultRedactedJson,
      screenshotUrl: input.screenshotUrl ?? null,
      errorCode: input.errorCode ?? null,
      errorMessage: input.errorMessage ?? null,
    };
    this.statusChecks.push(check);
    return check;
  }

  async updateApplicationAppointmentState(
    _applicationId: string,
    patch: {
      appointmentAssistanceStatus?: string;
      appointmentAssistanceJobId?: string | null;
      appointmentConfirmationId?: string | null;
    },
  ): Promise<void> {
    if (patch.appointmentAssistanceStatus !== undefined) {
      this.applicationState.appointmentAssistanceStatus = patch.appointmentAssistanceStatus;
    }
    if (patch.appointmentAssistanceJobId !== undefined) {
      this.applicationState.appointmentAssistanceJobId = patch.appointmentAssistanceJobId;
    }
    if (patch.appointmentConfirmationId !== undefined) {
      this.applicationState.appointmentConfirmationId = patch.appointmentConfirmationId;
    }
  }

  async addAuditEvent(input: InsertAppointmentAuditEventInput): Promise<void> {
    this.auditEvents.push(input);
  }

  private async getRequiredAccount(accountId: string): Promise<AppointmentAccount> {
    const account = await this.getAccount(accountId);
    if (!account) throw new Error("account not found");
    return account;
  }

  private async getRequiredJob(jobId: string): Promise<AppointmentAssistanceJob> {
    const job = await this.getJob(jobId);
    if (!job) throw new Error("job not found");
    return job;
  }

  private async getRequiredManualAction(actionId: string): Promise<AppointmentManualAction> {
    const action = await this.getManualAction(actionId);
    if (!action) throw new Error("manual action not found");
    return action;
  }
}

async function createReadyJob(
  repository = new InMemoryUSAppointmentRepository(),
  userPreferencesJson: JsonObject = {},
) {
  const { orchestrator } = createUSAppointmentServices(repository);
  await orchestrator.recordConsent({
    applicationId: APPLICATION_ID,
    actorUserId: USER_ID,
    consentSnapshot: { accepted: true },
  });
  const job = await orchestrator.createJob({
    applicationId: APPLICATION_ID,
    userId: USER_ID,
    applyingCountryCode: "SG",
    applyingPostCity: "Singapore",
    userPreferencesJson,
  });
  return { repository, orchestrator, job };
}

async function progressToPaymentCheckpoint() {
  const setup = await createReadyJob();
  await setup.orchestrator.runJob(setup.job.id);
  const emailAction = setup.repository.manualActions.find(
    (action) => action.actionType === "account_email_verification",
  );
  expect(emailAction).toBeDefined();
  await setup.orchestrator.completeManualAction(emailAction!.id, {
    verificationCode: "123456",
  });
  await setup.orchestrator.resumeJob(setup.job.id);
  return setup;
}

async function progressToSlotSelection(userPreferencesJson: JsonObject = {}) {
  const setup = userPreferencesJson.slotScenario
    ? await createReadyJob(new InMemoryUSAppointmentRepository(), userPreferencesJson)
    : await progressToPaymentCheckpoint();
  if (userPreferencesJson.slotScenario) {
    await setup.orchestrator.runJob(setup.job.id);
    const emailAction = setup.repository.manualActions.find(
      (action) => action.actionType === "account_email_verification",
    );
    await setup.orchestrator.completeManualAction(emailAction!.id, {
      verificationCode: "123456",
    });
    await setup.orchestrator.resumeJob(setup.job.id);
  }
  const paymentAction = setup.repository.manualActions.find(
    (action) => action.actionType === "payment" && action.status === "pending",
  );
  expect(paymentAction).toBeDefined();
  await setup.orchestrator.completeManualAction(paymentAction!.id, {
    acknowledged: true,
  });
  await setup.orchestrator.resumeJob(setup.job.id);
  return setup;
}

describe("U.S. appointment assistant dry-run lifecycle", () => {
  it("requires consent before creating a job", async () => {
    const repository = new InMemoryUSAppointmentRepository();
    const { orchestrator } = createUSAppointmentServices(repository);
    await expect(orchestrator.createJob({
      applicationId: APPLICATION_ID,
      userId: USER_ID,
      applyingCountryCode: "SG",
      applyingPostCity: "Singapore",
    })).rejects.toMatchObject({ code: "consent_required" });
  });

  it("blocks job creation when DS-160 confirmation is missing", async () => {
    const repository = new InMemoryUSAppointmentRepository();
    repository.application = baseApplication({ ds160ApplicationId: null, confirmationNumber: null });
    const { orchestrator } = createUSAppointmentServices(repository);
    await orchestrator.recordConsent({
      applicationId: APPLICATION_ID,
      actorUserId: USER_ID,
      consentSnapshot: { accepted: true },
    });
    await expect(orchestrator.createJob({
      applicationId: APPLICATION_ID,
      userId: USER_ID,
      applyingCountryCode: "SG",
      applyingPostCity: "Singapore",
    })).rejects.toMatchObject({ code: "missing_ds160_confirmation" });
  });

  it("blocks job creation when applying post is missing", async () => {
    const { orchestrator } = createUSAppointmentServices(new InMemoryUSAppointmentRepository());
    await orchestrator.recordConsent({
      applicationId: APPLICATION_ID,
      actorUserId: USER_ID,
      consentSnapshot: { accepted: true },
    });
    await expect(orchestrator.createJob({
      applicationId: APPLICATION_ID,
      userId: USER_ID,
      applyingCountryCode: "",
      applyingPostCity: "",
    })).rejects.toMatchObject({ code: "missing_applying_post" });
  });

  it("creates an idempotent dry-run job", async () => {
    const { repository, orchestrator, job } = await createReadyJob();
    const duplicate = await orchestrator.createJob({
      applicationId: APPLICATION_ID,
      userId: USER_ID,
      applyingCountryCode: "SG",
      applyingPostCity: "Singapore",
    });
    expect(duplicate.id).toBe(job.id);
    expect(repository.jobs).toHaveLength(1);
    expect(job.mode).toBe("dry_run");
    expect(job.schedulingProvider).toBe("usvisascheduling");
  });

  it("creates the dry-run email verification checkpoint on first run", async () => {
    const { repository, orchestrator, job } = await createReadyJob();
    const status = await orchestrator.runJob(job.id);
    expect(status.job?.status).toBe("appointment_email_verification_required");
    expect(status.pendingManualAction?.actionType).toBe("account_email_verification");
    expect(repository.accounts[0]?.encryptedAccountPassword).toBeNull();
  });

  it("completes manual action and reaches the dry-run payment checkpoint", async () => {
    const setup = await progressToPaymentCheckpoint();
    const status = await setup.orchestrator.getStatus(APPLICATION_ID);
    expect(status.job?.status).toBe("appointment_payment_required");
    expect(status.pendingManualAction?.actionType).toBe("payment");
    expect(setup.repository.accounts[0]?.emailVerified).toBe(true);
  });

  it("supports a no-slots dry-run scenario without polling", async () => {
    const setup = await progressToSlotSelection({ slotScenario: "no_slots" });
    const status = await setup.orchestrator.getStatus(APPLICATION_ID);
    expect(status.job?.status).toBe("appointment_no_slots_available");
    expect(status.slots).toHaveLength(0);
  });

  it("observes dry-run slots and pauses for slot selection", async () => {
    const setup = await progressToSlotSelection();
    const status = await setup.orchestrator.getStatus(APPLICATION_ID);
    expect(status.job?.status).toBe("appointment_slot_selection_required");
    expect(status.slots).toHaveLength(2);
    expect(status.pendingManualAction?.actionType).toBe("slot_selection");
  });

  it("requires final approval after user selects a slot", async () => {
    const setup = await progressToSlotSelection();
    const firstSlot = setup.repository.slots[0];
    await setup.orchestrator.selectSlot(setup.job.id, firstSlot.id);
    const status = await setup.orchestrator.getStatus(APPLICATION_ID);
    expect(status.job?.status).toBe("appointment_final_confirmation_required");
    expect(status.pendingManualAction?.actionType).toBe("final_confirmation");
    await expect(setup.orchestrator.bookSelectedSlot(setup.job.id)).rejects.toMatchObject({
      code: "final_confirmation_required",
    });
  });

  it("captures a dry-run confirmation only after explicit final approval", async () => {
    const setup = await progressToSlotSelection();
    const firstSlot = setup.repository.slots[0];
    await setup.orchestrator.selectSlot(setup.job.id, firstSlot.id);
    await setup.orchestrator.approveFinalConfirmation(setup.job.id);
    const status = await setup.orchestrator.bookSelectedSlot(setup.job.id);
    expect(status.job?.status).toBe("appointment_confirmation_captured");
    expect(status.confirmation?.confirmationNumber).toMatch(/^DRYRUN-US-B1B2-/);
    expect(setup.repository.applicationState.appointmentConfirmationId).toBe(status.confirmation?.id);
  });

  it("returns dry-run appointment status and rate-limits repeated status checks", async () => {
    const setup = await progressToSlotSelection();
    await setup.orchestrator.selectSlot(setup.job.id, setup.repository.slots[0].id);
    await setup.orchestrator.approveFinalConfirmation(setup.job.id);
    await setup.orchestrator.bookSelectedSlot(setup.job.id);
    const status = await setup.orchestrator.checkAppointmentStatus(setup.job.id);
    expect(status.latestStatusCheck?.status).toBe("appointment_exists");
    await expect(setup.orchestrator.checkAppointmentStatus(setup.job.id)).rejects.toMatchObject({
      code: "status_check_rate_limited",
    });
  });

  it("detects providers without assuming one global portal", () => {
    const registry = new USAppointmentProviderRegistry();
    expect(registry.detectProviderForPost({ applyingCountryCode: "SG" })).toBe("usvisascheduling");
    expect(registry.detectProviderForPost({ applyingCountryCode: "CA" })).toBe("ais_usvisa_info");
    expect(registry.detectProviderForPost({ applyingCountryCode: "DE" })).toBe("ustraveldocs");
  });

  it("returns a controlled error for unsupported visa types", async () => {
    const repository = new InMemoryUSAppointmentRepository();
    repository.application = baseApplication({ visaType: "F1" });
    const { orchestrator } = createUSAppointmentServices(repository);
    await orchestrator.recordConsent({
      applicationId: APPLICATION_ID,
      actorUserId: USER_ID,
      consentSnapshot: { accepted: true },
    });
    await expect(orchestrator.createJob({
      applicationId: APPLICATION_ID,
      userId: USER_ID,
      applyingCountryCode: "SG",
      applyingPostCity: "Singapore",
    })).rejects.toMatchObject({ code: "unsupported_visa_type" });
  });

  it("redacts sensitive appointment payloads", () => {
    const redacted = redactSensitivePayload({
      ds160ConfirmationCode: "AA00SECRET",
      passportNumber: "P1234567",
      password: "never-store",
      safe: "visible",
    });
    expect(redacted).toEqual({
      ds160ConfirmationCode: "[REDACTED]",
      passportNumber: "[REDACTED]",
      password: "[REDACTED]",
      safe: "visible",
    });
  });

  it("prevents cancelled jobs from continuing", async () => {
    const { orchestrator, job } = await createReadyJob();
    await orchestrator.cancelJob(job.id);
    await expect(orchestrator.runJob(job.id)).rejects.toMatchObject({
      code: "appointment_cancelled",
    });
  });

  it("rate-limits user-triggered slot checks", async () => {
    const setup = await progressToPaymentCheckpoint();
    await setup.orchestrator.checkSlots(setup.job.id);
    await expect(setup.orchestrator.checkSlots(setup.job.id)).rejects.toMatchObject({
      code: "slot_check_rate_limited",
    });
  });

  it("does not include CAPTCHA-solving or stealth behavior in provider scaffolds", async () => {
    const { orchestrator, job } = await createReadyJob(
      new InMemoryUSAppointmentRepository(),
      {},
    );
    const status = await orchestrator.runJob(job.id);
    expect(status.pendingManualAction?.actionType).not.toBe("captcha");
    expect(
      JSON.stringify(status, null, 2).toLowerCase(),
    ).not.toContain("2captcha");
  });
});
