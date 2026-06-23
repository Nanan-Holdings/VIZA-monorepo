import { AppointmentAuditService } from "./AppointmentAuditService.js";
import { AppointmentCheckpointService } from "./AppointmentCheckpointService.js";
import { AppointmentSlotService } from "./AppointmentSlotService.js";
import { AppointmentStatusService } from "./AppointmentStatusService.js";
import { USAppointmentProviderRegistry } from "./providers.js";
import type {
  AppointmentAccount,
  AppointmentAssistanceAttempt,
  AppointmentAssistanceJob,
  AppointmentManualAction,
  AppointmentStatusSnapshot,
  CreateAppointmentJobInput,
  JsonObject,
  SafeAppointmentAccount,
  USAppointmentApplication,
  USAppointmentStatus,
} from "./types.js";
import type { USAppointmentRepository } from "./repository.js";
import { redactToObject } from "./redaction.js";
import { validateUSAppointmentPreconditions } from "./validators/usAppointmentPreconditions.js";

export class USAppointmentServiceError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "USAppointmentServiceError";
    this.status = status;
    this.code = code;
  }
}

const TERMINAL_STATUSES = new Set<USAppointmentStatus>([
  "appointment_no_slots_available",
  "appointment_confirmation_captured",
  "appointment_status_checked",
  "appointment_failed",
  "appointment_cancelled",
  "appointment_blocked_by_site_policy",
]);

function getStoredDs160Code(application: USAppointmentApplication): string | null {
  return application.ds160ApplicationId ?? application.confirmationNumber ?? null;
}

function getStoredApplyingPostCity(application: USAppointmentApplication): string | null {
  return application.ds160AppointmentPostCity;
}

function buildJobIdempotencyKey(input: CreateAppointmentJobInput): string {
  return input.idempotencyKey
    ?? `us-appointment:${input.applicationId}:${input.userId}:${input.mode ?? "dry_run"}`;
}

function sanitizeAccount(account: AppointmentAccount | null): SafeAppointmentAccount | null {
  if (!account) return null;
  return {
    ...account,
    encryptedAccountPassword: null,
    passwordVaultRef: null,
  };
}

function latestCompleted(actions: AppointmentManualAction[], actionType: string): AppointmentManualAction | null {
  return actions
    .filter((action) => action.actionType === actionType && action.status === "completed")
    .sort((a, b) => Date.parse(b.completedAt ?? b.createdAt ?? "") - Date.parse(a.completedAt ?? a.createdAt ?? ""))[0] ?? null;
}

function isMissingAppointmentSchemaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("appointment_") &&
    (message.includes("schema cache") ||
      message.includes("could not find the table") ||
      message.includes("could not find the column"))
  );
}

export class USAppointmentOrchestrator {
  private readonly auditService: AppointmentAuditService;
  private readonly checkpointService: AppointmentCheckpointService;
  private readonly slotService: AppointmentSlotService;
  private readonly statusService: AppointmentStatusService;
  private readonly providerRegistry = new USAppointmentProviderRegistry();

  constructor(private readonly repository: USAppointmentRepository) {
    this.auditService = new AppointmentAuditService(repository);
    this.checkpointService = new AppointmentCheckpointService(repository);
    this.slotService = new AppointmentSlotService(repository);
    this.statusService = new AppointmentStatusService(repository);
  }

  async recordConsent(input: {
    applicationId: string;
    actorUserId: string;
    consentSnapshot: JsonObject;
    idempotencyKey?: string;
  }): Promise<AppointmentManualAction> {
    const application = await this.getApplicationOrThrow(input.applicationId);
    if (application.userId !== input.actorUserId) {
      throw new USAppointmentServiceError(
        403,
        "owner_required",
        "Only the application owner can consent to appointment assistance.",
      );
    }

    if (input.idempotencyKey) {
      const existing = await this.repository.findConsentByIdempotencyKey(input.idempotencyKey);
      if (existing) return existing;
    }

    const consent = await this.repository.insertManualAction({
      jobId: null,
      applicationId: application.id,
      userId: input.actorUserId,
      actionType: "consent",
      status: "completed",
      instruction: "User consented to dry-run U.S. appointment assistance.",
      userInputRedactedJson: redactToObject(input.consentSnapshot),
      metadataRedactedJson: redactToObject({
        consent_version: "2026-06-us-appointment-v1",
        idempotency_key: input.idempotencyKey ?? null,
        dry_run_first: true,
        requires_final_confirmation: true,
        no_security_bypass: true,
      }),
    });

    await this.repository.updateApplicationAppointmentState(application.id, {
      appointmentAssistanceStatus: "appointment_consent_received",
    });
    await this.auditService.record({
      applicationId: application.id,
      userId: input.actorUserId,
      eventType: "appointment_consent_received",
      eventMessage: "User consent received for U.S. appointment assistance.",
      metadataRedactedJson: {
        consent_action_id: consent.id,
        consent_version: "2026-06-us-appointment-v1",
      },
    });

    return consent;
  }

  async createJob(input: CreateAppointmentJobInput): Promise<AppointmentAssistanceJob> {
    const application = await this.getApplicationOrThrow(input.applicationId);
    if (application.userId !== input.userId) {
      throw new USAppointmentServiceError(403, "forbidden", "You cannot access this application.");
    }

    const ds160ConfirmationCode = input.ds160ConfirmationCode?.trim()
      || getStoredDs160Code(application);
    const applyingPostCity = input.applyingPostCity?.trim()
      || getStoredApplyingPostCity(application);
    const consent = await this.repository.getLatestCompletedConsent(application.id, input.userId);
    const validation = validateUSAppointmentPreconditions({
      application,
      completedConsent: consent,
      ds160ConfirmationCode,
      applyingCountryCode: input.applyingCountryCode,
      applyingPostCity,
    });

    if (!validation.valid) {
      const first = validation.errors[0];
      const status =
        first?.code === "consent_required"
          ? "appointment_consent_required"
          : first?.code === "missing_ds160_confirmation"
            ? "appointment_missing_ds160_confirmation"
            : first?.code === "missing_applying_post"
              ? "appointment_missing_applying_post"
              : "appointment_failed";
      await this.repository.updateApplicationAppointmentState(application.id, {
        appointmentAssistanceStatus: status,
      });
      throw new USAppointmentServiceError(
        409,
        first?.code ?? "appointment_precondition_failed",
        first?.message ?? "Appointment preconditions failed.",
      );
    }

    const idempotencyKey = buildJobIdempotencyKey(input);
    const existing = await this.repository.findJobByIdempotencyKey(idempotencyKey);
    if (existing) return existing;

    const confirmedApplyingPostCity = applyingPostCity?.trim();
    if (!confirmedApplyingPostCity) {
      throw new USAppointmentServiceError(
        409,
        "missing_applying_post",
        "The DS-160 application must include the interview embassy/consulate city before appointment assistance can start.",
      );
    }

    const schedulingProvider = this.providerRegistry.detectProviderForPost({
      schedulingProvider: input.schedulingProvider,
      applyingCountryCode: input.applyingCountryCode,
    });

    const job = await this.repository.insertJob({
      applicationId: application.id,
      userId: input.userId,
      countryCode: "US",
      visaType: "B1/B2",
      ds160ConfirmationCode: ds160ConfirmationCode ?? "",
      applyingCountryCode: input.applyingCountryCode.trim().toUpperCase(),
      applyingPostCity: confirmedApplyingPostCity,
      schedulingProvider,
      status: "appointment_consent_received",
      mode: input.mode ?? "dry_run",
      userPreferencesJson: redactToObject(input.userPreferencesJson ?? {}),
      requiresUserAction: false,
      currentManualAction: null,
      idempotencyKey,
    });

    await this.repository.updateApplicationAppointmentState(application.id, {
      appointmentAssistanceStatus: job.status,
      appointmentAssistanceJobId: job.id,
    });
    await this.auditService.recordJobTransition(
      job,
      "appointment_job_created",
      "U.S. appointment assistance job created.",
      {
        mode: job.mode,
        scheduling_provider: schedulingProvider,
        applying_country_code: job.applyingCountryCode,
        applying_post_city: job.applyingPostCity,
      },
    );

    return job;
  }

  async getStatus(applicationId: string): Promise<AppointmentStatusSnapshot> {
    let job: AppointmentAssistanceJob | null;
    try {
      job = await this.repository.getLatestJobForApplication(applicationId);
    } catch (error) {
      if (isMissingAppointmentSchemaError(error)) {
        job = null;
      } else {
        throw error;
      }
    }
    if (!job) {
      return {
        job: null,
        account: null,
        pendingManualAction: null,
        manualActions: [],
        slots: [],
        confirmation: null,
        latestStatusCheck: null,
        dryRunNotice: null,
      };
    }
    const [account, pendingManualAction, manualActions, slots, confirmation, latestStatusCheck] =
      await Promise.all([
        job.appointmentAccountId ? this.repository.getAccount(job.appointmentAccountId) : Promise.resolve(null),
        this.repository.getLatestPendingManualAction(job.id),
        this.repository.listManualActions(job.id),
        this.repository.listSlots(job.id),
        this.repository.getConfirmationForJob(job.id),
        this.repository.getLatestStatusCheck(job.id),
      ]);

    return {
      job,
      account: sanitizeAccount(account),
      pendingManualAction,
      manualActions,
      slots,
      confirmation,
      latestStatusCheck,
      dryRunNotice: job.mode === "dry_run"
        ? "Dry-run only. No real appointment was booked."
        : null,
    };
  }

  async runJob(jobId: string): Promise<AppointmentStatusSnapshot> {
    const job = await this.getJobOrThrow(jobId);
    this.assertJobCanContinue(job);

    const pendingManualAction = await this.repository.getLatestPendingManualAction(job.id);
    if (pendingManualAction) {
      return this.getStatus(job.applicationId);
    }

    const attempt = await this.startAttempt(job);
    try {
      const nextJob = job.mode === "dry_run"
        ? await this.runDryRunStep(job)
        : await this.runAssistedLiveDisabledStep(job);
      await this.finishAttempt(attempt, "completed", {
        status: nextJob.status,
        requires_user_action: nextJob.requiresUserAction,
      });
      return this.getStatus(nextJob.applicationId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Appointment run failed.";
      await this.repository.updateJob(job.id, {
        status: "appointment_failed",
        requiresUserAction: false,
        currentManualAction: null,
        lastErrorCode: error instanceof USAppointmentServiceError ? error.code : "appointment_run_failed",
        lastErrorMessage: message,
      });
      await this.repository.updateApplicationAppointmentState(job.applicationId, {
        appointmentAssistanceStatus: "appointment_failed",
        appointmentAssistanceJobId: job.id,
      });
      await this.finishAttempt(attempt, "failed", {
        error: message,
      }, error instanceof USAppointmentServiceError ? error.code : "appointment_run_failed", message);
      throw error;
    }
  }

  async resumeJob(jobId: string): Promise<AppointmentStatusSnapshot> {
    return this.runJob(jobId);
  }

  async completeManualAction(
    actionId: string,
    userInput: JsonObject,
  ): Promise<AppointmentStatusSnapshot> {
    const action = await this.checkpointService.completeManualAction(actionId, userInput);
    if (!action.jobId) {
      return this.getStatus(action.applicationId);
    }
    const job = await this.getJobOrThrow(action.jobId);
    const updated = await this.repository.updateJob(job.id, {
      requiresUserAction: false,
      currentManualAction: null,
    });
    await this.auditService.recordJobTransition(
      updated,
      "appointment_manual_action_completed",
      `Manual appointment action completed: ${action.actionType}.`,
      {
        action_id: action.id,
        action_type: action.actionType,
      },
    );
    return this.getStatus(updated.applicationId);
  }

  async selectSlot(jobId: string, slotId: string): Promise<AppointmentStatusSnapshot> {
    const job = await this.getJobOrThrow(jobId);
    this.assertJobCanContinue(job);
    if (!["appointment_slot_selection_required", "appointment_slots_observed"].includes(job.status)) {
      throw new USAppointmentServiceError(
        409,
        "slot_selection_not_allowed",
        "Slot selection is not available for this appointment job.",
      );
    }

    const selected = await this.slotService.selectSlot(job, slotId);
    const manualActions = await this.repository.listManualActions(job.id);
    const slotAction = manualActions
      .filter((action) => action.actionType === "slot_selection" && action.status === "pending")
      .sort((a, b) => Date.parse(b.createdAt ?? "") - Date.parse(a.createdAt ?? ""))[0];
    if (slotAction) {
      await this.repository.updateManualAction(slotAction.id, {
        status: "completed",
        completedAt: new Date().toISOString(),
        userInputRedactedJson: redactToObject({ selected_slot_id: selected.id }),
      });
    }

    const slotSelectedJob = await this.transitionJob(
      job,
      "appointment_slot_selected",
      "User selected an observed dry-run appointment slot.",
      { selected_slot_id: selected.id },
    );
    await this.checkpointService.createPendingCheckpoint({
      job: slotSelectedJob,
      actionType: "final_confirmation",
      jobStatus: "appointment_final_confirmation_required",
      instruction: "Review the selected dry-run appointment and explicitly approve before booking.",
      metadata: {
        selected_slot_id: selected.id,
        appointment_date: selected.appointmentDate,
        appointment_time: selected.appointmentTime,
        appointment_location: selected.appointmentLocation,
      },
    });

    return this.getStatus(job.applicationId);
  }

  async approveFinalConfirmation(jobId: string): Promise<AppointmentStatusSnapshot> {
    const job = await this.getJobOrThrow(jobId);
    this.assertJobCanContinue(job);
    if (job.status !== "appointment_final_confirmation_required") {
      throw new USAppointmentServiceError(
        409,
        "final_confirmation_not_required",
        "Final confirmation is not currently required for this appointment job.",
      );
    }

    const actions = await this.repository.listManualActions(job.id);
    const pendingFinal = actions
      .filter((action) => action.actionType === "final_confirmation" && action.status === "pending")
      .sort((a, b) => Date.parse(b.createdAt ?? "") - Date.parse(a.createdAt ?? ""))[0];
    if (pendingFinal) {
      await this.repository.updateManualAction(pendingFinal.id, {
        status: "completed",
        completedAt: new Date().toISOString(),
        userInputRedactedJson: redactToObject({ approved: true }),
      });
    }

    const updated = await this.repository.updateJob(job.id, {
      requiresUserAction: false,
      currentManualAction: null,
    });
    await this.auditService.recordJobTransition(
      updated,
      "appointment_final_confirmation_approved",
      "User explicitly approved final dry-run appointment confirmation.",
    );
    return this.getStatus(updated.applicationId);
  }

  async bookSelectedSlot(jobId: string): Promise<AppointmentStatusSnapshot> {
    const job = await this.getJobOrThrow(jobId);
    this.assertJobCanContinue(job);

    const selectedSlot = await this.repository.getSelectedSlot(job.id);
    if (!selectedSlot) {
      throw new USAppointmentServiceError(
        409,
        "slot_required",
        "A selected appointment slot is required before booking.",
      );
    }

    const actions = await this.repository.listManualActions(job.id);
    if (!latestCompleted(actions, "final_confirmation")) {
      throw new USAppointmentServiceError(
        409,
        "final_confirmation_required",
        "Explicit final confirmation is required before booking.",
      );
    }

    if (job.mode !== "dry_run") {
      const bookedJob = await this.transitionJob(
        job,
        "appointment_booked",
        "User approved selected assisted-live appointment slot for runner booking.",
        {
          selected_slot_id: selectedSlot.id,
          scheduling_provider: job.schedulingProvider,
          runner_service: "submission-service",
          final_approval_present: true,
        },
      );
      await this.auditService.recordJobTransition(
        bookedJob,
        "appointment_assisted_live_booking_requested",
        "Assisted-live appointment booking requested after selected slot and final approval.",
        {
          selected_slot_id: selectedSlot.id,
          runner_service: "submission-service",
        },
      );
      return this.getStatus(bookedJob.applicationId);
    }

    const bookedJob = await this.transitionJob(
      job,
      "appointment_booked",
      "Dry-run appointment booking completed after final approval.",
      { selected_slot_id: selectedSlot.id, dry_run_only: true },
    );
    const confirmation = await this.repository.insertConfirmation({
      jobId: bookedJob.id,
      applicationId: bookedJob.applicationId,
      userId: bookedJob.userId,
      countryCode: "US",
      visaType: "B1/B2",
      appointmentDate: selectedSlot.appointmentDate,
      appointmentTime: selectedSlot.appointmentTime,
      appointmentLocation: selectedSlot.appointmentLocation,
      appointmentType: selectedSlot.appointmentType,
      confirmationNumber: `DRYRUN-US-B1B2-${bookedJob.applicationId.slice(0, 8).toUpperCase()}`,
      confirmationPdfUrl: null,
      confirmationScreenshotUrl: null,
      rawConfirmationRedactedJson: {
        dry_run_only: true,
        status: "appointment_booked",
        mode: "dry_run",
        selected_slot_id: selectedSlot.id,
      },
    });
    await this.transitionJob(
      bookedJob,
      "appointment_confirmation_captured",
      "Dry-run appointment confirmation captured.",
      {
        confirmation_id: confirmation.id,
        dry_run_only: true,
      },
      confirmation.id,
    );

    return this.getStatus(bookedJob.applicationId);
  }

  async checkAppointmentStatus(jobId: string): Promise<AppointmentStatusSnapshot> {
    const job = await this.getJobOrThrow(jobId);
    this.assertJobCanContinue(job);
    try {
      await this.statusService.assertCooldown(job);
    } catch {
      throw new USAppointmentServiceError(
        429,
        "status_check_rate_limited",
        "Appointment status checks are rate limited. Please wait before checking again.",
      );
    }
    const inProgress = await this.transitionJob(
      job,
      "appointment_status_check_in_progress",
      "User-triggered appointment status check started.",
    );
    if (job.mode !== "dry_run") {
      await this.auditService.recordJobTransition(
        inProgress,
        "appointment_assisted_live_status_check_requested",
        "Assisted-live appointment status check queued for submission-service runner.",
        {
          runner_service: "submission-service",
          scheduling_provider: job.schedulingProvider,
        },
      );
      return this.getStatus(inProgress.applicationId);
    }
    const provider = this.providerRegistry.getProvider(inProgress.schedulingProvider, inProgress.mode);
    const result = await provider.checkAppointmentStatus(inProgress);
    await this.statusService.saveStatusCheck(inProgress, result);
    await this.transitionJob(
      inProgress,
      "appointment_status_checked",
      "Appointment status check completed.",
      { status_check: result.statusCheck },
    );
    return this.getStatus(inProgress.applicationId);
  }

  async checkSlots(jobId: string): Promise<AppointmentStatusSnapshot> {
    const job = await this.getJobOrThrow(jobId);
    this.assertJobCanContinue(job);
    await this.assertSlotCheckCooldown(job);
    await this.auditService.recordJobTransition(
      job,
      "appointment_slot_check_requested",
      "User-triggered appointment slot check requested.",
      { no_background_polling: true },
    );
    return this.runJob(job.id);
  }

  async cancelJob(jobId: string): Promise<AppointmentStatusSnapshot> {
    const job = await this.getJobOrThrow(jobId);
    const cancelled = await this.transitionJob(
      job,
      "appointment_cancelled",
      "Appointment assistance job cancelled.",
    );
    await this.repository.updateJob(cancelled.id, {
      requiresUserAction: false,
      currentManualAction: null,
    });
    return this.getStatus(cancelled.applicationId);
  }

  private async runDryRunStep(job: AppointmentAssistanceJob): Promise<AppointmentAssistanceJob> {
    const provider = this.providerRegistry.getProvider(job.schedulingProvider, job.mode);

    if (TERMINAL_STATUSES.has(job.status)) {
      return job;
    }

    if (["appointment_consent_received", "appointment_not_started", "appointment_account_required", "appointment_account_creation_started"].includes(job.status)) {
      const account = job.appointmentAccountId
        ? await this.repository.getAccount(job.appointmentAccountId)
        : await this.repository.insertAccount({
          userId: job.userId,
          applicationId: job.applicationId,
          portal: job.schedulingProvider ?? "dry_run",
          accountEmail: "dry-run-applicant@example.invalid",
          accountStatus: "account_creation_started",
          metadataRedactedJson: { dry_run_only: true },
        });
      const accountJob = await this.transitionJob(
        { ...job, appointmentAccountId: account?.id ?? job.appointmentAccountId },
        "appointment_account_creation_started",
        "Dry-run appointment account creation started.",
        { account_id: account?.id ?? null, dry_run_only: true },
      );
      if (account && accountJob.appointmentAccountId !== account.id) {
        await this.repository.updateJob(accountJob.id, { appointmentAccountId: account.id });
      }
      const accountResult = await provider.runAccountCreation(accountJob);
      const checkpoint = await this.checkpointService.createPendingCheckpoint({
        job: { ...accountJob, appointmentAccountId: account?.id ?? accountJob.appointmentAccountId },
        actionType: accountResult.manualActionType ?? "account_email_verification",
        jobStatus: accountResult.jobStatus ?? "appointment_email_verification_required",
        instruction: accountResult.instruction ?? "Complete the dry-run email verification checkpoint.",
        userInputSchemaJson: {
          type: "object",
          properties: {
            verificationCode: { type: "string" },
          },
        },
        metadata: accountResult.rawResultRedacted ?? {},
      });
      return checkpoint.job;
    }

    if (job.status === "appointment_email_verification_required") {
      const actions = await this.repository.listManualActions(job.id);
      if (!latestCompleted(actions, "account_email_verification")) return job;
      if (job.appointmentAccountId) {
        await this.repository.updateAccount(job.appointmentAccountId, {
          accountStatus: "created",
          emailVerified: true,
        });
      }
      const filling = await this.transitionJob(
        job,
        "appointment_profile_fill_in_progress",
        "Dry-run profile fill started.",
      );
      const filled = await this.transitionJob(
        filling,
        "appointment_profile_filled",
        "Dry-run appointment profile filled.",
        { dry_run_only: true },
      );
      const linked = await this.transitionJob(
        filled,
        "appointment_ds160_linked",
        "Dry-run DS-160 code linked to appointment profile.",
        { dry_run_only: true },
      );
      const paymentResult = await provider.handleFeeStep(linked);
      const checkpoint = await this.checkpointService.createPendingCheckpoint({
        job: linked,
        actionType: paymentResult.manualActionType ?? "payment",
        jobStatus: paymentResult.jobStatus ?? "appointment_payment_required",
        instruction: paymentResult.instruction ?? "Acknowledge the dry-run payment checkpoint.",
        metadata: paymentResult.rawResultRedacted ?? {},
      });
      return checkpoint.job;
    }

    if (job.status === "appointment_payment_required") {
      const actions = await this.repository.listManualActions(job.id);
      if (!latestCompleted(actions, "payment")) return job;
      const paymentInProgress = await this.transitionJob(
        job,
        "appointment_payment_in_progress",
        "Dry-run payment checkpoint acknowledged.",
        { dry_run_only: true },
      );
      const paymentCompleted = await this.transitionJob(
        paymentInProgress,
        "appointment_payment_completed",
        "Dry-run payment step completed. No real payment was made.",
        { dry_run_only: true },
      );
      const calendar = await this.transitionJob(
        paymentCompleted,
        "appointment_calendar_opened",
        "Dry-run appointment calendar opened.",
        { dry_run_only: true },
      );
      const slotResult = await provider.readVisibleSlots(calendar);
      if (slotResult.status === "no_slots_available") {
        return this.transitionJob(
          calendar,
          "appointment_no_slots_available",
          "Dry-run calendar showed no available slots. No polling was started.",
          slotResult.rawResultRedacted ?? {},
        );
      }

      const savedSlots = await this.slotService.saveObservedSlots(calendar, slotResult);
      const observed = await this.transitionJob(
        calendar,
        "appointment_slots_observed",
        "Dry-run appointment slots observed and saved.",
        { slot_count: savedSlots.length, dry_run_only: true },
      );
      const checkpoint = await this.checkpointService.createPendingCheckpoint({
        job: observed,
        actionType: "slot_selection",
        jobStatus: "appointment_slot_selection_required",
        instruction: "Choose one observed dry-run appointment slot.",
        metadata: { slot_count: savedSlots.length },
      });
      return checkpoint.job;
    }

    return job;
  }

  private async runAssistedLiveDisabledStep(
    job: AppointmentAssistanceJob,
  ): Promise<AppointmentAssistanceJob> {
    const normalizedProvider = (job.schedulingProvider ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
    const normalizedCountry = (job.applyingCountryCode ?? "").trim().toUpperCase();
    if (normalizedProvider === "usvisascheduling" && normalizedCountry === "CN") {
      const queued = await this.transitionJob(
        job,
        "appointment_login_required",
        "China USVisaScheduling assisted-live job queued for submission-service runner.",
        {
          assisted_live_enabled: true,
          runner_service: "submission-service",
          provider: "usvisascheduling",
          applying_country_code: "CN",
          supported_checkpoint_handling: true,
          explicit_slot_selection_required: true,
          final_viza_approval_required: true,
        },
      );
      await this.auditService.recordJobTransition(
        queued,
        "appointment_assisted_live_runner_handoff",
        "China USVisaScheduling assisted-live job queued for submission-service runner.",
        {
          assisted_live_enabled: true,
          runner_service: "submission-service",
          provider: "usvisascheduling",
          applying_country_code: "CN",
          supported_checkpoint_handling: true,
          explicit_slot_selection_required: true,
          final_viza_approval_required: true,
        },
      );
      return queued;
    }

    const provider = this.providerRegistry.getProvider(job.schedulingProvider, job.mode);
    const result = await provider.runAccountCreation(job);
    const checkpoint = await this.checkpointService.createPendingCheckpoint({
      job,
      actionType: result.manualActionType ?? "site_policy_review",
      jobStatus: result.jobStatus ?? "appointment_manual_required",
      instruction: result.instruction ?? "Assisted live mode is disabled.",
      metadata: result.rawResultRedacted ?? {},
    });
    return checkpoint.job;
  }

  private async transitionJob(
    job: AppointmentAssistanceJob,
    status: USAppointmentStatus,
    eventMessage: string,
    metadata: JsonObject = {},
    confirmationId?: string,
  ): Promise<AppointmentAssistanceJob> {
    const updated = await this.repository.updateJob(job.id, {
      status,
      requiresUserAction: false,
      currentManualAction: null,
      lastErrorCode: null,
      lastErrorMessage: null,
    });
    await this.repository.updateApplicationAppointmentState(job.applicationId, {
      appointmentAssistanceStatus: status,
      appointmentAssistanceJobId: job.id,
      appointmentConfirmationId: confirmationId,
    });
    await this.auditService.recordJobTransition(updated, status, eventMessage, metadata);
    return updated;
  }

  private async startAttempt(job: AppointmentAssistanceJob): Promise<AppointmentAssistanceAttempt> {
    const attempts = await this.repository.listAttempts(job.id);
    return this.repository.insertAttempt({
      jobId: job.id,
      applicationId: job.applicationId,
      attemptNumber: attempts.length + 1,
      status: "started",
      provider: job.schedulingProvider,
      mode: job.mode,
      requestSnapshotRedactedJson: redactToObject({
        job_id: job.id,
        status: job.status,
        mode: job.mode,
        scheduling_provider: job.schedulingProvider,
      }),
    });
  }

  private getSlotCheckCooldownMs(): number {
    const configured = Number(process.env.US_APPOINTMENT_SLOT_CHECK_COOLDOWN_MS ?? "600000");
    return Number.isFinite(configured) && configured >= 60_000 ? configured : 600_000;
  }

  private async assertSlotCheckCooldown(job: AppointmentAssistanceJob): Promise<void> {
    if (![
      "appointment_calendar_opened",
      "appointment_slots_observed",
      "appointment_slot_selection_required",
      "appointment_no_slots_available",
    ].includes(job.status)) {
      return;
    }
    const attempts = await this.repository.listAttempts(job.id);
    const latest = attempts
      .filter((attempt) => attempt.startedAt)
      .sort((a, b) => Date.parse(b.startedAt ?? "") - Date.parse(a.startedAt ?? ""))[0];
    if (!latest?.startedAt) return;
    const elapsed = Date.now() - Date.parse(latest.startedAt);
    if (elapsed < this.getSlotCheckCooldownMs()) {
      throw new USAppointmentServiceError(
        429,
        "slot_check_rate_limited",
        "Appointment slot checks are rate limited. VIZA will not repeatedly refresh appointment calendars.",
      );
    }
  }

  private async finishAttempt(
    attempt: AppointmentAssistanceAttempt,
    status: string,
    resultSnapshot: JsonObject,
    errorCode?: string,
    errorMessage?: string,
  ): Promise<void> {
    await this.repository.updateAttempt(attempt.id, {
      status,
      resultSnapshotRedactedJson: redactToObject(resultSnapshot),
      errorCode,
      errorMessage,
      finishedAt: new Date().toISOString(),
    });
  }

  private async getApplicationOrThrow(applicationId: string): Promise<USAppointmentApplication> {
    const application = await this.repository.getApplicationContext(applicationId);
    if (!application) {
      throw new USAppointmentServiceError(404, "application_not_found", "Application not found.");
    }
    if (!application.userId) {
      throw new USAppointmentServiceError(
        409,
        "application_owner_missing",
        "Application owner could not be resolved.",
      );
    }
    return application;
  }

  private async getJobOrThrow(jobId: string): Promise<AppointmentAssistanceJob> {
    const job = await this.repository.getJob(jobId);
    if (!job) {
      throw new USAppointmentServiceError(404, "appointment_job_not_found", "Appointment job not found.");
    }
    return job;
  }

  private assertJobCanContinue(job: AppointmentAssistanceJob): void {
    if (job.status === "appointment_cancelled") {
      throw new USAppointmentServiceError(
        409,
        "appointment_cancelled",
        "Cancelled appointment jobs cannot continue unless explicitly restarted.",
      );
    }
  }
}

export function createUSAppointmentServices(repository: USAppointmentRepository): {
  orchestrator: USAppointmentOrchestrator;
} {
  return {
    orchestrator: new USAppointmentOrchestrator(repository),
  };
}
