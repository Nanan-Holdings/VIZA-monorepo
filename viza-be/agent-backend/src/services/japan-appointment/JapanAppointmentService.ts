export type JsonObject = Record<string, unknown>;

export interface JapanAppointmentApplication {
  id: string;
  userId: string;
  applicantId: string;
  country: string | null;
  visaType: string | null;
  inboxAlias: string | null;
  answers: Record<string, string>;
  profile: Record<string, string>;
  documentTypes: string[];
}

export interface JapanAppointmentJob {
  id: string;
  applicationId: string;
  userId: string;
  status: string;
  mode: "assisted_live";
  requiresUserAction: boolean;
  currentManualAction: string | null;
  userPreferencesJson: JsonObject;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface JapanAppointmentAccount {
  id: string;
  accountEmail: string | null;
  accountStatus: string;
  emailVerified: boolean;
}

export interface JapanAppointmentManualAction {
  id: string;
  actionType: string;
  status: string;
  instruction: string | null;
  metadataRedactedJson: JsonObject;
  createdAt: string | null;
}

export interface JapanAppointmentSlot {
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

export interface JapanAppointmentConfirmation {
  id: string;
  jobId: string;
  applicationId: string;
  userId: string;
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

export interface JapanAppointmentSnapshot {
  job: JapanAppointmentJob | null;
  account: JapanAppointmentAccount | null;
  slots: JapanAppointmentSlot[];
  pendingManualAction: JapanAppointmentManualAction | null;
  evidence: JsonObject | null;
  confirmation: JapanAppointmentConfirmation | null;
  preflight: {
    consentRecorded: boolean;
    missingApplicationFields: string[];
    documentTypes: string[];
    passportUploaded: boolean;
    photoUploaded: boolean;
    review: {
      englishName: string;
      dateOfBirth: string;
      nationality: string;
      passportNumber: string;
      passportExpiryDate: string;
      phone: string;
      email: string;
      residentialAddress: string;
      appointmentCenter: string;
    };
  };
}

export interface JapanAppointmentRepository {
  getApplication(applicationId: string): Promise<JapanAppointmentApplication | null>;
  ensureAlias(applicantId: string): Promise<string>;
  findConsent(applicationId: string, userId: string): Promise<JapanAppointmentManualAction | null>;
  insertConsent(applicationId: string, userId: string, snapshot: JsonObject): Promise<JapanAppointmentManualAction>;
  getLatestJob(applicationId: string): Promise<JapanAppointmentJob | null>;
  getJob(jobId: string): Promise<JapanAppointmentJob | null>;
  insertJob(input: {
    applicationId: string;
    userId: string;
    preferences: JsonObject;
    idempotencyKey: string;
  }): Promise<JapanAppointmentJob>;
  updateJob(jobId: string, patch: Partial<JapanAppointmentJob>): Promise<JapanAppointmentJob>;
  ensureAccount(input: { applicationId: string; userId: string; alias: string }): Promise<JapanAppointmentAccount>;
  getAccount(applicationId: string, userId: string): Promise<JapanAppointmentAccount | null>;
  insertManualAction(input: {
    job: JapanAppointmentJob;
    actionType: string;
    instruction: string;
    metadata: JsonObject;
  }): Promise<JapanAppointmentManualAction>;
  getPendingManualAction(jobId: string): Promise<JapanAppointmentManualAction | null>;
  replaceObservedSlots(jobId: string, slots: Omit<JapanAppointmentSlot, "id" | "jobId" | "applicationId" | "status" | "observedAt">[]): Promise<JapanAppointmentSlot[]>;
  listSlots(jobId: string): Promise<JapanAppointmentSlot[]>;
  selectSlot(jobId: string, slotId: string): Promise<JapanAppointmentSlot | null>;
  getSelectedSlot(jobId: string): Promise<JapanAppointmentSlot | null>;
  insertConfirmation(input: Omit<JapanAppointmentConfirmation, "id" | "createdAt">): Promise<JapanAppointmentConfirmation>;
  getConfirmation(jobId: string): Promise<JapanAppointmentConfirmation | null>;
  updateApplicationState(applicationId: string, status: string, jobId?: string): Promise<void>;
}

export class JapanAppointmentServiceError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = "JapanAppointmentServiceError";
  }
}

interface EligibilityInput {
  singaporePassType?: string;
  singaporePassExpiryDate?: string;
  intendedReturnDate?: string;
  passportType?: string;
  visaRequestType?: string;
  occupation?: string;
  checklistConfirmed?: string[];
}

interface RunnerResult {
  slots?: Array<{
    appointmentDate?: string;
    appointmentTime?: string | null;
    appointmentLocation?: string;
    appointmentType?: string;
    source?: string;
  }>;
  checkpoint?: { type?: string; message?: string };
  evidence?: JsonObject;
  profile?: { missingFields?: string[]; aliasPrepared?: boolean };
  confirmation?: { confirmationNumber?: string; receiptUrl?: string | null; screenshotUrl?: string | null };
}

const VALID_PASSES = new Set([
  "pr", "employment_pass", "s_pass", "work_permit", "dependent_pass",
  "long_term_visit_pass", "student_pass",
]);
const REQUIRED_FIELDS = [
  "surname", "given_names", "date_of_birth", "nationality", "passport_number",
  "passport_expiry_date", "email", "phone",
] as const;

function first(input: JapanAppointmentApplication, keys: readonly string[]): string {
  for (const key of keys) {
    const value = input.answers[key] ?? input.profile[key];
    if (value?.trim()) return value.trim();
  }
  return "";
}

function validatePreflight(application: JapanAppointmentApplication, eligibility: EligibilityInput): string[] {
  const missing: string[] = REQUIRED_FIELDS.filter((field) => !first(application, [field]));
  const nationality = first(application, ["nationality", "nationality_country", "current_nationality"]);
  if (!/^(china|cn|people'?s republic of china|中国)$/i.test(nationality)) missing.push("nationality_china");
  if (!/^(ordinary|regular|normal|普通)$/i.test(eligibility.passportType ?? "")) missing.push("passport_type_ordinary");
  if (!VALID_PASSES.has(eligibility.singaporePassType ?? "")) missing.push("singapore_pass_type");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eligibility.intendedReturnDate ?? "")) missing.push("intended_return_date");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(eligibility.singaporePassExpiryDate ?? "")
    || (eligibility.singaporePassExpiryDate ?? "") < (eligibility.intendedReturnDate ?? "")
  ) missing.push("singapore_pass_expiry_date");
  const documents = new Set(application.documentTypes.map((value) => value.toLowerCase()));
  if (![...documents].some((value) => value.includes("passport"))) missing.push("passport_upload");
  if (![...documents].some((value) => value.includes("photo"))) missing.push("photo_upload");
  return [...new Set(missing)];
}

function applicationPreflight(application: JapanAppointmentApplication) {
  const missingApplicationFields = REQUIRED_FIELDS.filter((field) => !first(application, [field]));
  const documentTypes = application.documentTypes.map((value) => value.toLowerCase());
  const givenNames = first(application, ["given_names", "given_name", "first_name"]);
  const surname = first(application, ["surname", "family_name", "last_name"]);
  return {
    missingApplicationFields,
    documentTypes: application.documentTypes,
    passportUploaded: documentTypes.some((value) => value.includes("passport")),
    photoUploaded: documentTypes.some((value) => value.includes("photo")),
    review: {
      englishName: [givenNames, surname].filter(Boolean).join(" "),
      dateOfBirth: first(application, ["date_of_birth", "birth_date"]),
      nationality: first(application, ["nationality", "nationality_country", "current_nationality"]),
      passportNumber: first(application, ["passport_number"]),
      passportExpiryDate: first(application, ["passport_expiry_date", "passport_expiry"]),
      phone: first(application, ["phone", "phone_number", "mobile"]),
      email: first(application, ["email", "personal_email"]),
      residentialAddress: first(application, ["residential_address", "full_address", "address"]),
      appointmentCenter: "Japan Visa Application Centre Singapore",
    },
  };
}

export class JapanAppointmentService {
  private readonly submissionServiceUrl: string;
  private readonly internalToken: string | null;

  constructor(private readonly repository: JapanAppointmentRepository, options: {
    submissionServiceUrl?: string;
    internalToken?: string | null;
  } = {}) {
    this.submissionServiceUrl = options.submissionServiceUrl
      ?? process.env.JP_VFS_SG_SUBMISSION_SERVICE_URL
      ?? "http://127.0.0.1:8080";
    this.internalToken = options.internalToken ?? process.env.JP_VFS_SG_INTERNAL_TOKEN?.trim() ?? null;
  }

  async recordConsent(input: { applicationId: string; userId: string; snapshot: JsonObject }) {
    const application = await this.getApplicationOrThrow(input.applicationId);
    this.assertOwner(application, input.userId);
    const consent = await this.repository.insertConsent(application.id, input.userId, input.snapshot);
    await this.repository.updateApplicationState(application.id, "appointment_consent_received");
    return consent;
  }

  async createJob(input: {
    applicationId: string;
    userId: string;
    eligibility: EligibilityInput;
    idempotencyKey?: string;
  }): Promise<JapanAppointmentJob> {
    const application = await this.getApplicationOrThrow(input.applicationId);
    this.assertOwner(application, input.userId);
    if (!/^(japan|jp)$/i.test(application.country ?? "")) {
      throw new JapanAppointmentServiceError(409, "japan_application_required", "This appointment flow only supports Japan applications.");
    }
    if (!await this.repository.findConsent(application.id, input.userId)) {
      throw new JapanAppointmentServiceError(409, "consent_required", "Consent is required before Japan appointment preparation can start.");
    }
    const missingFields = validatePreflight(application, input.eligibility);
    if (missingFields.length > 0) {
      throw new JapanAppointmentServiceError(409, "missing_required_fields", `Missing required VIZA fields: ${missingFields.join(", ")}`);
    }
    const existing = await this.repository.getLatestJob(application.id);
    if (existing && existing.status !== "appointment_cancelled") return existing;
    const job = await this.repository.insertJob({
      applicationId: application.id,
      userId: input.userId,
      idempotencyKey: existing
        ? `${input.idempotencyKey ?? `japan-vfs-sg:${application.id}:${input.userId}`}:retry:${Date.now()}`
        : input.idempotencyKey ?? `japan-vfs-sg:${application.id}:${input.userId}`,
      preferences: {
        provider: "vfs_japan_sg",
        automationMode: "public_recon",
        accountCreationEnabled: false,
        aliasPrepared: false,
        eligibility: input.eligibility,
        stopBeforeSlotSelection: true,
        stopBeforePayment: true,
        stopBeforeFinalBooking: true,
      },
    });
    await this.repository.updateApplicationState(application.id, job.status, job.id);
    return job;
  }

  async getStatusForApplication(applicationId: string): Promise<JapanAppointmentSnapshot> {
    const application = await this.getApplicationOrThrow(applicationId);
    const [job, consent, account] = await Promise.all([
      this.repository.getLatestJob(applicationId),
      this.repository.findConsent(applicationId, application.userId),
      this.repository.getAccount(applicationId, application.userId),
    ]);
    const preflight = { ...applicationPreflight(application), consentRecorded: Boolean(consent) };
    if (!job) return { job: null, account, slots: [], pendingManualAction: null, evidence: null, confirmation: null, preflight };
    return this.getStatus(job.id, preflight);
  }

  async getStatus(jobId: string, knownPreflight?: JapanAppointmentSnapshot["preflight"]): Promise<JapanAppointmentSnapshot> {
    const job = await this.getJobOrThrow(jobId);
    const [account, pendingManualAction, application, consent, slots, confirmation] = await Promise.all([
      this.repository.getAccount(job.applicationId, job.userId),
      this.repository.getPendingManualAction(job.id),
      this.getApplicationOrThrow(job.applicationId),
      knownPreflight ? Promise.resolve(null) : this.repository.findConsent(job.applicationId, job.userId),
      this.repository.listSlots(job.id),
      this.repository.getConfirmation(job.id),
    ]);
    const evidence = job.userPreferencesJson.evidence;
    return {
      job,
      account,
      slots,
      pendingManualAction,
      evidence: evidence && typeof evidence === "object" && !Array.isArray(evidence) ? evidence as JsonObject : null,
      confirmation,
      preflight: knownPreflight ?? {
        ...applicationPreflight(application),
        consentRecorded: Boolean(consent),
      },
    };
  }

  async checkPortal(jobId: string): Promise<JapanAppointmentSnapshot> {
    const job = await this.getJobOrThrow(jobId);
    if (job.status === "appointment_cancelled") {
      throw new JapanAppointmentServiceError(409, "appointment_cancelled", "Start a new preparation before checking the portal.");
    }
    const lastObservedAt = typeof job.userPreferencesJson.lastPortalObservedAt === "string"
      ? Date.parse(job.userPreferencesJson.lastPortalObservedAt)
      : Number.NaN;
    if (Number.isFinite(lastObservedAt) && Date.now() - lastObservedAt < 60_000) {
      return this.getStatus(job.id);
    }
    const response = await fetch(`${this.submissionServiceUrl.replace(/\/$/, "")}/local/japan-vfs-sg/observe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.internalToken ? { Authorization: `Bearer ${this.internalToken}` } : {}),
      },
      body: JSON.stringify({ jobId: job.id, publicOnly: true, prepareAlias: false }),
    });
    const payload = await response.json().catch(() => null) as ({ ok?: boolean } & RunnerResult) | null;
    if (!response.ok || !payload) {
      throw new JapanAppointmentServiceError(502, "japan_runner_unavailable", "The Japan cloud worker could not be reached.");
    }
    const observedSlots = (payload.slots ?? []).flatMap((slot) => {
      if (!slot.appointmentDate || !slot.appointmentLocation) return [];
      return [{
        appointmentDate: slot.appointmentDate,
        appointmentTime: slot.appointmentTime ?? "",
        appointmentLocation: slot.appointmentLocation,
        appointmentType: slot.appointmentType ?? "Japan visa application submission",
        source: slot.source ?? "vfs_jp_sg",
        metadataRedactedJson: { provider: "vfs_japan_sg" },
      }];
    });
    if (observedSlots.length > 0) await this.repository.replaceObservedSlots(job.id, observedSlots);
    const checkpointType = payload.checkpoint?.type ?? "selector_drift";
    const instruction = payload.checkpoint?.message ?? "The Japan VFS portal was reached, but an authenticated account is required before calendar access.";
    const updated = await this.repository.updateJob(job.id, {
      status: observedSlots.length > 0
        ? "appointment_slot_selection_required"
        : checkpointType === "no_slots"
          ? "appointment_no_slots_available"
          : "appointment_manual_required",
      requiresUserAction: true,
      currentManualAction: observedSlots.length > 0 ? "slot_selection" : checkpointType,
      userPreferencesJson: {
        ...job.userPreferencesJson,
        automationMode: "public_recon",
        accountCreationEnabled: false,
        aliasPrepared: false,
        evidence: payload.evidence ?? {},
        runnerProfile: payload.profile ?? {},
        lastPortalObservedAt: new Date().toISOString(),
      },
      lastErrorCode: null,
      lastErrorMessage: null,
    });
    await this.repository.insertManualAction({
      job: updated,
      actionType: observedSlots.length > 0 ? "slot_selection" : checkpointType,
      instruction: observedSlots.length > 0 ? "Choose one of the official VFS appointment slots." : instruction,
      metadata: { provider: "vfs_japan_sg", evidence: payload.evidence ?? {} },
    });
    await this.repository.updateApplicationState(updated.applicationId, updated.status, updated.id);
    return this.getStatus(updated.id);
  }

  async selectSlot(jobId: string, slotId: string): Promise<JapanAppointmentSnapshot> {
    const job = await this.getJobOrThrow(jobId);
    const selected = await this.repository.selectSlot(job.id, slotId);
    if (!selected) throw new JapanAppointmentServiceError(404, "appointment_slot_not_found", "The selected VFS slot is no longer available.");
    const updated = await this.repository.updateJob(job.id, {
      status: "appointment_payment_required",
      requiresUserAction: true,
      currentManualAction: "payment",
      userPreferencesJson: { ...job.userPreferencesJson, selectedSlotId: selected.id, finalConfirmationApproved: false },
    });
    await this.repository.updateApplicationState(updated.applicationId, updated.status, updated.id);
    return this.getStatus(updated.id);
  }

  async recordPaymentAuthorization(jobId: string, input: { card: { pan: string; expiry: string; cvv: string; holderName: string } }): Promise<JapanAppointmentSnapshot> {
    const job = await this.getJobOrThrow(jobId);
    if (!await this.repository.getSelectedSlot(job.id)) {
      throw new JapanAppointmentServiceError(409, "slot_required", "Select an official VFS slot before authorizing payment.");
    }
    const response = await fetch(`${this.submissionServiceUrl.replace(/\/$/, "")}/internal/japan-vfs-sg/payment-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(this.internalToken ? { Authorization: `Bearer ${this.internalToken}` } : {}) },
      body: JSON.stringify({ jobId: job.id, card: input.card }),
    });
    const payment = await response.json().catch(() => null) as { sessionId?: string; redacted?: JsonObject; expiresAt?: string } | null;
    if (!response.ok || !payment?.sessionId) {
      throw new JapanAppointmentServiceError(502, "japan_runner_unavailable", "The Japan one-time payment session could not be prepared.");
    }
    const updated = await this.repository.updateJob(job.id, {
      status: "appointment_payment_ready",
      requiresUserAction: true,
      currentManualAction: "final_confirmation",
      userPreferencesJson: { ...job.userPreferencesJson, paymentSessionId: payment.sessionId, paymentAuthorizationRedactedJson: payment.redacted ?? {}, paymentSessionExpiresAt: payment.expiresAt },
    });
    return this.getStatus(updated.id);
  }

  async approveFinalConfirmation(jobId: string): Promise<JapanAppointmentSnapshot> {
    const job = await this.getJobOrThrow(jobId);
    if (!await this.repository.getSelectedSlot(job.id)) throw new JapanAppointmentServiceError(409, "slot_required", "Select a VFS slot first.");
    if (typeof job.userPreferencesJson.paymentSessionId !== "string") {
      throw new JapanAppointmentServiceError(409, "payment_authorization_required", "Authorize the VFS service-fee payment first.");
    }
    const updated = await this.repository.updateJob(job.id, {
      status: "appointment_final_confirmation_approved",
      requiresUserAction: false,
      currentManualAction: null,
      userPreferencesJson: { ...job.userPreferencesJson, finalConfirmationApproved: true },
    });
    return this.getStatus(updated.id);
  }

  async bookSelectedSlot(jobId: string): Promise<JapanAppointmentSnapshot> {
    const job = await this.getJobOrThrow(jobId);
    const selected = await this.repository.getSelectedSlot(job.id);
    if (!selected) throw new JapanAppointmentServiceError(409, "slot_required", "Select a VFS slot first.");
    if (job.userPreferencesJson.finalConfirmationApproved !== true) {
      throw new JapanAppointmentServiceError(409, "final_confirmation_required", "Final user approval is required before official booking.");
    }
    const response = await fetch(`${this.submissionServiceUrl.replace(/\/$/, "")}/internal/japan-vfs-sg/book-selected-slot`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(this.internalToken ? { Authorization: `Bearer ${this.internalToken}` } : {}) },
      body: JSON.stringify({
        applicationId: job.applicationId,
        jobId: job.id,
        selectedSlot: selected,
        paymentSessionId: job.userPreferencesJson.paymentSessionId,
        eligibility: job.userPreferencesJson.eligibility,
      }),
    });
    const payload = await response.json().catch(() => null) as ({ ok?: boolean } & RunnerResult) | null;
    if (!response.ok || !payload) throw new JapanAppointmentServiceError(502, "japan_runner_unavailable", "The Japan booking worker could not be reached.");
    const confirmationNumber = payload.confirmation?.confirmationNumber?.trim();
    if (!confirmationNumber) {
      const checkpoint = payload.checkpoint?.type ?? "site_policy_review";
      const updated = await this.repository.updateJob(job.id, {
        status: checkpoint === "payment" ? "appointment_payment_required" : "appointment_manual_required",
        requiresUserAction: true,
        currentManualAction: checkpoint,
      });
      await this.repository.insertManualAction({ job: updated, actionType: checkpoint, instruction: payload.checkpoint?.message ?? "VFS did not return an official confirmation.", metadata: { provider: "vfs_japan_sg" } });
      return this.getStatus(updated.id);
    }
    const confirmation = await this.repository.insertConfirmation({
      jobId: job.id,
      applicationId: job.applicationId,
      userId: job.userId,
      appointmentDate: selected.appointmentDate,
      appointmentTime: selected.appointmentTime,
      appointmentLocation: selected.appointmentLocation,
      appointmentType: selected.appointmentType,
      confirmationNumber,
      confirmationPdfUrl: payload.confirmation?.receiptUrl ?? null,
      confirmationScreenshotUrl: payload.confirmation?.screenshotUrl ?? null,
      rawConfirmationRedactedJson: { provider: "vfs_japan_sg", officialConfirmationVerified: true },
    });
    const updated = await this.repository.updateJob(job.id, { status: "appointment_confirmation_captured", requiresUserAction: false, currentManualAction: null });
    await this.repository.updateApplicationState(updated.applicationId, updated.status, updated.id);
    return { ...(await this.getStatus(updated.id)), confirmation };
  }

  async cancel(jobId: string): Promise<JapanAppointmentSnapshot> {
    const job = await this.getJobOrThrow(jobId);
    const updated = await this.repository.updateJob(job.id, {
      status: "appointment_cancelled",
      requiresUserAction: false,
      currentManualAction: null,
    });
    await this.repository.updateApplicationState(updated.applicationId, updated.status, updated.id);
    return this.getStatus(updated.id);
  }

  private async getApplicationOrThrow(applicationId: string) {
    const application = await this.repository.getApplication(applicationId);
    if (!application) throw new JapanAppointmentServiceError(404, "application_not_found", "Application not found.");
    return application;
  }

  private async getJobOrThrow(jobId: string) {
    const job = await this.repository.getJob(jobId);
    if (!job) throw new JapanAppointmentServiceError(404, "appointment_job_not_found", "Japan appointment job not found.");
    return job;
  }

  private assertOwner(application: JapanAppointmentApplication, userId: string) {
    if (application.userId !== userId) throw new JapanAppointmentServiceError(403, "forbidden", "You cannot access this application.");
  }
}
