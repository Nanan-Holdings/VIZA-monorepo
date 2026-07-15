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

export interface JapanAppointmentSnapshot {
  job: JapanAppointmentJob | null;
  account: JapanAppointmentAccount | null;
  slots: [];
  pendingManualAction: JapanAppointmentManualAction | null;
  evidence: JsonObject | null;
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
  slots?: unknown[];
  checkpoint?: { type?: string; message?: string };
  evidence?: JsonObject;
  profile?: { missingFields?: string[]; aliasPrepared?: boolean };
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
    if (existing) return existing;
    const alias = await this.repository.ensureAlias(application.applicantId);
    await this.repository.ensureAccount({ applicationId: application.id, userId: input.userId, alias });
    const job = await this.repository.insertJob({
      applicationId: application.id,
      userId: input.userId,
      idempotencyKey: input.idempotencyKey ?? `japan-vfs-sg:${application.id}:${input.userId}`,
      preferences: {
        provider: "vfs_japan_sg",
        aliasPrepared: true,
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
    const job = await this.repository.getLatestJob(applicationId);
    if (!job) return { job: null, account: null, slots: [], pendingManualAction: null, evidence: null };
    return this.getStatus(job.id);
  }

  async getStatus(jobId: string): Promise<JapanAppointmentSnapshot> {
    const job = await this.getJobOrThrow(jobId);
    const [account, pendingManualAction] = await Promise.all([
      this.repository.getAccount(job.applicationId, job.userId),
      this.repository.getPendingManualAction(job.id),
    ]);
    const evidence = job.userPreferencesJson.evidence;
    return {
      job,
      account,
      slots: [],
      pendingManualAction,
      evidence: evidence && typeof evidence === "object" && !Array.isArray(evidence) ? evidence as JsonObject : null,
    };
  }

  async checkPortal(jobId: string): Promise<JapanAppointmentSnapshot> {
    const job = await this.getJobOrThrow(jobId);
    const response = await fetch(`${this.submissionServiceUrl.replace(/\/$/, "")}/local/japan-vfs-sg/observe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.internalToken ? { Authorization: `Bearer ${this.internalToken}` } : {}),
      },
      body: JSON.stringify({ applicationId: job.applicationId, jobId: job.id, prepareAlias: true }),
    });
    const payload = await response.json().catch(() => null) as ({ ok?: boolean } & RunnerResult) | null;
    if (!response.ok || !payload) {
      throw new JapanAppointmentServiceError(502, "japan_runner_unavailable", "The Japan cloud worker could not be reached.");
    }
    const checkpointType = payload.checkpoint?.type ?? "selector_drift";
    const instruction = payload.checkpoint?.message ?? "The Japan VFS portal was reached, but an authenticated account is required before calendar access.";
    const updated = await this.repository.updateJob(job.id, {
      status: checkpointType === "no_slots" ? "appointment_no_slots_available" : "appointment_manual_required",
      requiresUserAction: true,
      currentManualAction: checkpointType,
      userPreferencesJson: { ...job.userPreferencesJson, evidence: payload.evidence ?? {}, runnerProfile: payload.profile ?? {} },
      lastErrorCode: null,
      lastErrorMessage: null,
    });
    await this.repository.insertManualAction({
      job: updated,
      actionType: checkpointType,
      instruction,
      metadata: { provider: "vfs_japan_sg", evidence: payload.evidence ?? {} },
    });
    await this.repository.updateApplicationState(updated.applicationId, updated.status, updated.id);
    return this.getStatus(updated.id);
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
