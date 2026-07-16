export type FranceAppointmentMode = "dry_run" | "assisted_live" | "manual";

export interface JsonObject {
  [key: string]: unknown;
}

export interface FranceAppointmentApplication {
  id: string;
  userId: string;
  applicantId: string;
  country: string | null;
  countryCode: string | null;
  visaType: string | null;
  officialReferenceEncrypted: string | null;
  appointmentAssistanceStatus: string | null;
}

export interface FranceAppointmentJob {
  id: string;
  applicationId: string;
  userId: string;
  countryCode: "FR";
  visaType: "EU_SCHENGEN_C_SHORT_STAY";
  applyingCountryCode: "CN";
  applyingPostCity: string;
  schedulingProvider: "tlscontact_cn_fr";
  status: string;
  mode: FranceAppointmentMode;
  requiresUserAction: boolean;
  currentManualAction: string | null;
  userPreferencesJson: JsonObject;
  lastSlotCheckAt: string | null;
  paymentSessionStatus: "not_required" | "required" | "authorized" | "consumed" | "expired";
  paymentAuthorizationRedactedJson: JsonObject | null;
  idempotencyKey: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface FranceAppointmentManualAction {
  id: string;
  applicationId: string;
  userId: string;
  jobId: string | null;
  actionType: string;
  status: "pending" | "completed" | "expired" | "failed" | "cancelled";
  instruction: string | null;
  userInputRedactedJson?: JsonObject | null;
  metadataRedactedJson?: JsonObject | null;
  createdAt: string | null;
  completedAt?: string | null;
}

export interface FranceAppointmentSlot {
  id: string;
  jobId: string;
  applicationId: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentLocation: string;
  appointmentType: string;
  source: string;
  status: string;
  observedAt: string | null;
  metadataRedactedJson: JsonObject;
}

export interface FranceAppointmentConfirmation {
  id: string;
  jobId: string;
  applicationId: string;
  userId: string;
  countryCode: "FR";
  visaType: "EU_SCHENGEN_C_SHORT_STAY";
  appointmentDate: string;
  appointmentTime: string;
  appointmentLocation: string;
  appointmentType: string;
  confirmationNumber: string | null;
  confirmationPdfUrl: string | null;
  confirmationScreenshotUrl: string | null;
  rawConfirmationRedactedJson: JsonObject;
  createdAt: string | null;
}

export interface FranceAppointmentSnapshot {
  job: FranceAppointmentJob;
  account: null;
  slots: FranceAppointmentSlot[];
  pendingManualAction: FranceAppointmentManualAction | null;
  manualActions: FranceAppointmentManualAction[];
  confirmation: FranceAppointmentConfirmation | null;
  latestStatusCheck: null;
  dryRunNotice: string | null;
}

export interface FranceAppointmentRepository {
  getApplication(applicationId: string): Promise<FranceAppointmentApplication | null>;
  findConsent(applicationId: string, userId: string): Promise<FranceAppointmentManualAction | null>;
  insertManualAction(input: Omit<FranceAppointmentManualAction, "id" | "createdAt">): Promise<FranceAppointmentManualAction>;
  getLatestJob(applicationId: string): Promise<FranceAppointmentJob | null>;
  getJob(jobId: string): Promise<FranceAppointmentJob | null>;
  insertJob(input: Omit<FranceAppointmentJob, "id" | "createdAt" | "updatedAt">): Promise<FranceAppointmentJob>;
  updateJob(jobId: string, patch: Partial<FranceAppointmentJob>): Promise<FranceAppointmentJob>;
  replaceObservedSlots(
    jobId: string,
    slots: Omit<FranceAppointmentSlot, "id" | "jobId" | "applicationId" | "status" | "observedAt">[],
  ): Promise<FranceAppointmentSlot[]>;
  listSlots(jobId: string): Promise<FranceAppointmentSlot[]>;
  selectSlot(jobId: string, slotId: string): Promise<FranceAppointmentSlot | null>;
  getSelectedSlot(jobId: string): Promise<FranceAppointmentSlot | null>;
  insertConfirmation(input: Omit<FranceAppointmentConfirmation, "id" | "createdAt">): Promise<FranceAppointmentConfirmation>;
  getConfirmation(jobId: string): Promise<FranceAppointmentConfirmation | null>;
  updateApplicationAppointmentState(
    applicationId: string,
    patch: {
      appointmentAssistanceStatus?: string | null;
      appointmentAssistanceJobId?: string | null;
      appointmentConfirmationId?: string | null;
    },
  ): Promise<void>;
}

export class FranceAppointmentServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "FranceAppointmentServiceError";
  }
}

export interface FranceAppointmentServiceOptions {
  slotCooldownMs?: number;
  now?: () => number;
  submissionServiceUrl?: string | null;
  accountPreparationEnabled?: boolean;
  submissionServiceToken?: string | null;
}

const CENTER_NAMES: Record<string, string> = {
  beijing: "Beijing",
  guangzhou: "Guangzhou",
  chengdu: "Chengdu",
  shanghai: "Shanghai",
  shenyang: "Shenyang",
  wuhan: "Wuhan",
  chongqing: "Chongqing",
  changsha: "Changsha",
  fuzhou: "Fuzhou",
  hangzhou: "Hangzhou",
  kunming: "Kunming",
  nanjing: "Nanjing",
  shenzhen: "Shenzhen",
  jinan: "Jinan",
  xian: "Xi'an",
};

function normalizeCenterCode(centerCode: string): string {
  const normalized = centerCode.trim().toLowerCase();
  return CENTER_NAMES[normalized] ? normalized : "shanghai";
}

function dryRunSlots(centerCode: string): Omit<FranceAppointmentSlot, "id" | "jobId" | "applicationId" | "status" | "observedAt">[] {
  const normalized = normalizeCenterCode(centerCode);
  const city = CENTER_NAMES[normalized];
  return [
    {
      appointmentDate: "2026-09-15",
      appointmentTime: "09:00",
      appointmentLocation: `TLScontact ${city}`,
      appointmentType: "France Schengen visa application submission",
      source: "france_tls_dry_run",
      metadataRedactedJson: { centerCode: normalized, provider: "tlscontact_cn_fr" },
    },
    {
      appointmentDate: "2026-09-16",
      appointmentTime: "14:30",
      appointmentLocation: `TLScontact ${city}`,
      appointmentType: "France Schengen visa application submission",
      source: "france_tls_dry_run",
      metadataRedactedJson: { centerCode: normalized, provider: "tlscontact_cn_fr" },
    },
  ];
}

function jobCenterCode(job: FranceAppointmentJob): string {
  const value = job.userPreferencesJson.centerCode;
  return typeof value === "string" ? value : "shanghai";
}

function latestPendingAction(actions: FranceAppointmentManualAction[]): FranceAppointmentManualAction | null {
  return actions.find((action) => action.status === "pending") ?? null;
}

export class FranceAppointmentService {
  private readonly slotCooldownMs: number;
  private readonly now: () => number;
  private readonly submissionServiceUrl: string | null;
  private readonly accountPreparationEnabled: boolean;
  private readonly submissionServiceToken: string | null;

  constructor(private readonly repository: FranceAppointmentRepository, options: FranceAppointmentServiceOptions = {}) {
    this.slotCooldownMs = options.slotCooldownMs ?? 600_000;
    this.now = options.now ?? Date.now;
    this.submissionServiceUrl = options.submissionServiceUrl ?? process.env.FRANCE_TLS_SUBMISSION_SERVICE_URL ?? "http://127.0.0.1:8080";
    this.accountPreparationEnabled = options.accountPreparationEnabled
      ?? process.env.FRANCE_TLS_ACCOUNT_PREP_ENABLED === "true";
    this.submissionServiceToken = options.submissionServiceToken
      ?? process.env.FRANCE_TLS_INTERNAL_TOKEN
      ?? null;
  }

  async recordConsent(input: {
    applicationId: string;
    userId: string;
    consentSnapshot: JsonObject;
  }): Promise<FranceAppointmentManualAction> {
    const application = await this.getApplicationOrThrow(input.applicationId);
    this.assertOwner(application, input.userId);
    const consent = await this.repository.insertManualAction({
      applicationId: application.id,
      userId: input.userId,
      jobId: null,
      actionType: "consent",
      status: "completed",
      instruction: "User consented to France TLS appointment assistance.",
      userInputRedactedJson: input.consentSnapshot,
      metadataRedactedJson: {
        consentVersion: "2026-07-france-tls-appointment-v1",
        userSelectedSlotRequired: true,
        paymentAuthorizationRequired: true,
        finalConfirmationRequired: true,
      },
      completedAt: new Date(this.now()).toISOString(),
    });
    await this.repository.updateApplicationAppointmentState(application.id, {
      appointmentAssistanceStatus: "appointment_consent_received",
    });
    return consent;
  }

  async createJob(input: {
    applicationId: string;
    userId: string;
    centerCode: string;
    mode?: FranceAppointmentMode;
    idempotencyKey?: string;
  }): Promise<FranceAppointmentJob> {
    const application = await this.getApplicationOrThrow(input.applicationId);
    this.assertOwner(application, input.userId);
    this.assertFranceSchengen(application);
    const consent = await this.repository.findConsent(application.id, input.userId);
    if (!consent) {
      throw new FranceAppointmentServiceError(409, "consent_required", "Consent is required before France appointment assistance can start.");
    }
    if (!application.officialReferenceEncrypted) {
      await this.repository.updateApplicationAppointmentState(application.id, {
        appointmentAssistanceStatus: "official_reference_required",
      });
      throw new FranceAppointmentServiceError(409, "official_reference_required", "A France-Visas official reference must be captured before TLS appointment booking.");
    }

    const existing = await this.repository.getLatestJob(application.id);
    if (existing) return existing;

    const centerCode = normalizeCenterCode(input.centerCode);
    const job = await this.repository.insertJob({
      applicationId: application.id,
      userId: input.userId,
      countryCode: "FR",
      visaType: "EU_SCHENGEN_C_SHORT_STAY",
      applyingCountryCode: "CN",
      applyingPostCity: CENTER_NAMES[centerCode],
      schedulingProvider: "tlscontact_cn_fr",
      status: "appointment_consent_received",
      mode: input.mode ?? "dry_run",
      requiresUserAction: false,
      currentManualAction: null,
      userPreferencesJson: {
        centerCode,
        provider: "tlscontact_cn_fr",
        officialReferenceCaptured: true,
        userSelectedSlotRequired: true,
        paymentAuthorizationRequired: true,
        finalConfirmationRequired: true,
      },
      lastSlotCheckAt: null,
      paymentSessionStatus: "required",
      paymentAuthorizationRedactedJson: null,
      idempotencyKey: input.idempotencyKey ?? `france-tls:${application.id}:${input.userId}:${centerCode}`,
    });
    await this.repository.updateApplicationAppointmentState(application.id, {
      appointmentAssistanceStatus: job.status,
      appointmentAssistanceJobId: job.id,
    });
    return job;
  }

  async getStatus(jobId: string): Promise<FranceAppointmentSnapshot> {
    const job = await this.getJobOrThrow(jobId);
    const [slots, confirmation] = await Promise.all([
      this.repository.listSlots(job.id),
      this.repository.getConfirmation(job.id),
    ]);
    return this.snapshot(job, slots, confirmation, latestPendingAction([]));
  }

  async getStatusForApplication(applicationId: string): Promise<FranceAppointmentSnapshot | null> {
    const job = await this.repository.getLatestJob(applicationId);
    return job ? this.getStatus(job.id) : null;
  }

  async checkSlots(jobId: string): Promise<FranceAppointmentSnapshot> {
    const job = await this.getJobOrThrow(jobId);
    if (job.lastSlotCheckAt && this.now() - Date.parse(job.lastSlotCheckAt) < this.slotCooldownMs) {
      throw new FranceAppointmentServiceError(429, "slot_check_rate_limited", "France TLS slot checks are rate limited.");
    }
    const liveResult = job.mode === "assisted_live"
      ? await this.checkLiveSlots(job)
      : null;
    if (liveResult?.checkpoint) {
      const updated = await this.repository.updateJob(job.id, {
        status: "appointment_manual_required",
        requiresUserAction: true,
        currentManualAction: liveResult.checkpoint.type,
        lastSlotCheckAt: new Date(this.now()).toISOString(),
        userPreferencesJson: {
          ...job.userPreferencesJson,
          liveCheckpoint: liveResult.checkpoint,
        },
      });
      await this.repository.updateApplicationAppointmentState(job.applicationId, {
        appointmentAssistanceStatus: updated.status,
        appointmentAssistanceJobId: updated.id,
      });
      return this.snapshot(
        updated,
        await this.repository.listSlots(job.id),
        await this.repository.getConfirmation(job.id),
        {
          id: `france-tls-${updated.id}-${liveResult.checkpoint.type}`,
          applicationId: updated.applicationId,
          userId: updated.userId,
          jobId: updated.id,
          actionType: liveResult.checkpoint.type,
          status: "pending",
          instruction: liveResult.checkpoint.message,
          metadataRedactedJson: liveResult.checkpoint.metadataRedactedJson,
          createdAt: new Date(this.now()).toISOString(),
        },
      );
    }
    const slots = await this.repository.replaceObservedSlots(
      job.id,
      liveResult?.slots ?? dryRunSlots(jobCenterCode(job)),
    );
    const updated = await this.repository.updateJob(job.id, {
      status: slots.length > 0 ? "appointment_slot_selection_required" : "appointment_no_slots_available",
      requiresUserAction: slots.length > 0,
      currentManualAction: slots.length > 0 ? "slot_selection" : null,
      lastSlotCheckAt: new Date(this.now()).toISOString(),
    });
    await this.repository.updateApplicationAppointmentState(job.applicationId, {
      appointmentAssistanceStatus: updated.status,
      appointmentAssistanceJobId: updated.id,
    });
    return this.snapshot(updated, slots, await this.repository.getConfirmation(job.id), null);
  }

  async selectSlot(jobId: string, slotId: string): Promise<FranceAppointmentSnapshot> {
    const job = await this.getJobOrThrow(jobId);
    if (!["appointment_slot_selection_required", "appointment_slots_observed"].includes(job.status)) {
      throw new FranceAppointmentServiceError(409, "slot_selection_not_allowed", "Slot selection is not currently available.");
    }
    const selected = await this.repository.selectSlot(job.id, slotId);
    if (!selected) {
      throw new FranceAppointmentServiceError(404, "slot_not_found", "Appointment slot not found.");
    }
    const updated = await this.repository.updateJob(job.id, {
      status: "appointment_final_confirmation_required",
      requiresUserAction: true,
      currentManualAction: "final_confirmation",
    });
    return this.snapshot(
      updated,
      await this.repository.listSlots(job.id),
      await this.repository.getConfirmation(job.id),
      null,
    );
  }

  async recordPaymentAuthorization(jobId: string, input: {
    sessionId: string;
    redacted: JsonObject;
  }): Promise<FranceAppointmentJob> {
    const job = await this.getJobOrThrow(jobId);
    return this.repository.updateJob(job.id, {
      paymentSessionStatus: "authorized",
      paymentAuthorizationRedactedJson: {
        sessionId: input.sessionId,
        ...input.redacted,
      },
    });
  }

  async approveFinalConfirmation(jobId: string): Promise<FranceAppointmentJob> {
    const job = await this.getJobOrThrow(jobId);
    const selectedSlot = await this.repository.getSelectedSlot(job.id);
    if (!selectedSlot) {
      throw new FranceAppointmentServiceError(409, "slot_required", "A user-selected TLS slot is required before final approval.");
    }
    return this.repository.updateJob(job.id, {
      status: "appointment_final_confirmation_approved",
      requiresUserAction: false,
      currentManualAction: null,
      userPreferencesJson: {
        ...job.userPreferencesJson,
        finalConfirmationApproved: true,
      },
    });
  }

  async bookSelectedSlot(jobId: string): Promise<FranceAppointmentSnapshot> {
    const job = await this.getJobOrThrow(jobId);
    const selectedSlot = await this.repository.getSelectedSlot(job.id);
    if (!selectedSlot) {
      throw new FranceAppointmentServiceError(409, "slot_required", "A selected TLS slot is required before booking.");
    }
    if (job.paymentSessionStatus !== "authorized" || !job.paymentAuthorizationRedactedJson) {
      throw new FranceAppointmentServiceError(409, "payment_authorization_required", "A one-time TLS service-fee payment authorization is required before booking.");
    }
    if (job.userPreferencesJson.finalConfirmationApproved !== true) {
      throw new FranceAppointmentServiceError(409, "final_confirmation_required", "Final user confirmation is required before booking.");
    }

    const confirmation = await this.repository.insertConfirmation({
      jobId: job.id,
      applicationId: job.applicationId,
      userId: job.userId,
      countryCode: "FR",
      visaType: "EU_SCHENGEN_C_SHORT_STAY",
      appointmentDate: selectedSlot.appointmentDate,
      appointmentTime: selectedSlot.appointmentTime,
      appointmentLocation: selectedSlot.appointmentLocation,
      appointmentType: selectedSlot.appointmentType,
      confirmationNumber: `FR-TLS-DRYRUN-${job.applicationId.slice(0, 8).toUpperCase()}`,
      confirmationPdfUrl: null,
      confirmationScreenshotUrl: null,
      rawConfirmationRedactedJson: {
        mode: job.mode,
        provider: job.schedulingProvider,
        payment: job.paymentAuthorizationRedactedJson,
        dryRunOnly: job.mode === "dry_run",
      },
    });
    const updated = await this.repository.updateJob(job.id, {
      status: "appointment_confirmation_captured",
      paymentSessionStatus: "consumed",
      requiresUserAction: false,
      currentManualAction: null,
    });
    await this.repository.updateApplicationAppointmentState(job.applicationId, {
      appointmentAssistanceStatus: updated.status,
      appointmentAssistanceJobId: updated.id,
      appointmentConfirmationId: confirmation.id,
    });
    return this.snapshot(updated, await this.repository.listSlots(job.id), confirmation, null);
  }

  async cancelJob(jobId: string): Promise<FranceAppointmentJob> {
    const job = await this.getJobOrThrow(jobId);
    const updated = await this.repository.updateJob(job.id, {
      status: "appointment_cancelled",
      requiresUserAction: false,
      currentManualAction: null,
    });
    await this.repository.updateApplicationAppointmentState(job.applicationId, {
      appointmentAssistanceStatus: "appointment_cancelled",
      appointmentAssistanceJobId: job.id,
    });
    return updated;
  }

  private async getApplicationOrThrow(applicationId: string): Promise<FranceAppointmentApplication> {
    const application = await this.repository.getApplication(applicationId);
    if (!application) {
      throw new FranceAppointmentServiceError(404, "application_not_found", "Application not found.");
    }
    return application;
  }

  private async getJobOrThrow(jobId: string): Promise<FranceAppointmentJob> {
    const job = await this.repository.getJob(jobId);
    if (!job) {
      throw new FranceAppointmentServiceError(404, "appointment_job_not_found", "France appointment job not found.");
    }
    return job;
  }

  private assertOwner(application: FranceAppointmentApplication, userId: string): void {
    if (application.userId !== userId) {
      throw new FranceAppointmentServiceError(403, "forbidden", "You cannot access this application.");
    }
  }

  private assertFranceSchengen(application: FranceAppointmentApplication): void {
    const country = (application.country ?? application.countryCode ?? "").toLowerCase();
    if (!["france", "fr"].includes(country) || application.visaType !== "EU_SCHENGEN_C_SHORT_STAY") {
      throw new FranceAppointmentServiceError(409, "unsupported_application", "France TLS appointment assistance supports France Schengen Type C applications only.");
    }
  }

  private snapshot(
    job: FranceAppointmentJob,
    slots: FranceAppointmentSlot[],
    confirmation: FranceAppointmentConfirmation | null,
    pendingManualAction: FranceAppointmentManualAction | null,
  ): FranceAppointmentSnapshot {
    return {
      job,
      account: null,
      slots,
      pendingManualAction,
      manualActions: pendingManualAction ? [pendingManualAction] : [],
      confirmation,
      latestStatusCheck: null,
      dryRunNotice: job.mode === "dry_run"
        ? "Dry-run mode returns deterministic sample TLS slots and does not connect to TLScontact."
        : null,
    };
  }

  private async checkLiveSlots(job: FranceAppointmentJob): Promise<{
    slots?: Omit<FranceAppointmentSlot, "id" | "jobId" | "applicationId" | "status" | "observedAt">[];
    checkpoint?: {
      type: string;
      message: string;
      metadataRedactedJson: JsonObject;
    };
  } | null> {
    if (!this.submissionServiceUrl) {
      return {
        checkpoint: {
          type: "site_policy_review",
          message: "France TLS assisted-live is not configured: FRANCE_TLS_SUBMISSION_SERVICE_URL is missing.",
          metadataRedactedJson: { provider: "tlscontact_cn_fr" },
        },
      };
    }
    if (this.accountPreparationEnabled) {
      const preparation = await this.prepareLiveAccount(job);
      if (preparation) return { checkpoint: preparation };
    }
    const endpoint = new URL("/local/france-tls/check-slots", this.submissionServiceUrl);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.submissionServiceToken
          ? { authorization: `Bearer ${this.submissionServiceToken}` }
          : {}),
      },
      body: JSON.stringify({
        applicationId: job.applicationId,
        jobId: job.id,
        centerCode: jobCenterCode(job),
      }),
    });
    const payload = await response.json().catch(() => null) as {
      ok?: boolean;
      status?: string;
      slots?: Array<{
        appointmentDate: string;
        appointmentTime: string;
        appointmentLocation: string;
        appointmentType: string;
        source: string;
        metadataRedactedJson?: JsonObject;
      }>;
      checkpoint?: {
        type?: string;
        message?: string;
        metadataRedactedJson?: JsonObject;
      };
      error?: string;
    } | null;
    if (!response.ok || !payload?.ok) {
      return {
        checkpoint: {
          type: "site_policy_review",
          message: payload?.error ?? "France TLS official portal check failed in submission-service.",
          metadataRedactedJson: { provider: "tlscontact_cn_fr", httpStatus: response.status },
        },
      };
    }
    if (payload.checkpoint) {
      return {
        checkpoint: {
          type: payload.checkpoint.type ?? "site_policy_review",
          message: payload.checkpoint.message ?? "France TLS official portal requires manual review.",
          metadataRedactedJson: payload.checkpoint.metadataRedactedJson ?? { provider: "tlscontact_cn_fr" },
        },
      };
    }
    return {
      slots: (payload.slots ?? []).map((slot) => ({
        appointmentDate: slot.appointmentDate,
        appointmentTime: slot.appointmentTime,
        appointmentLocation: slot.appointmentLocation,
        appointmentType: slot.appointmentType,
        source: slot.source || "france_tls_live",
        metadataRedactedJson: slot.metadataRedactedJson ?? { provider: "tlscontact_cn_fr" },
      })),
    };
  }

  private async prepareLiveAccount(job: FranceAppointmentJob): Promise<{
    type: string;
    message: string;
    metadataRedactedJson: JsonObject;
  } | null> {
    if (!this.submissionServiceUrl) return null;
    const endpoint = new URL("/internal/france-tls/register-account", this.submissionServiceUrl);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.submissionServiceToken
          ? { authorization: `Bearer ${this.submissionServiceToken}` }
          : {}),
      },
      body: JSON.stringify({
        applicationId: job.applicationId,
        centerCode: jobCenterCode(job),
        submitRegistration: true,
        fillOfficialReference: true,
      }),
    });
    const payload = await response.json().catch(() => null) as {
      ok?: boolean;
      status?: string;
      checkpoint?: { type?: string; message?: string; missingFields?: string[] };
      error?: string;
    } | null;
    if (!response.ok || !payload?.ok) {
      return {
        type: "account_preparation_failed",
        message: payload?.error ?? "TLScontact account preparation failed in submission-service.",
        metadataRedactedJson: {
          provider: "tlscontact_cn_fr",
          httpStatus: response.status,
        },
      };
    }
    if (payload.status === "appointment_reference_filled") {
      return {
        type: "appointment_reference_review_required",
        message: "TLScontact account is activated and logged in; the France-Visas reference is filled and ready for review.",
        metadataRedactedJson: {
          provider: "tlscontact_cn_fr",
          accountPrepared: true,
          officialReferenceFilled: true,
          stoppedBeforeReferenceSubmission: true,
        },
      };
    }
    if (payload.status === "manual_required" || payload.checkpoint) {
      return {
        type: payload.checkpoint?.type ?? "account_preparation_manual_required",
        message: payload.checkpoint?.message ?? "TLScontact account preparation requires review.",
        metadataRedactedJson: {
          provider: "tlscontact_cn_fr",
          missingFields: payload.checkpoint?.missingFields ?? [],
        },
      };
    }
    return null;
  }
}

export function createFranceAppointmentService(
  repository: FranceAppointmentRepository,
  options?: FranceAppointmentServiceOptions,
): FranceAppointmentService {
  return new FranceAppointmentService(repository, options);
}
