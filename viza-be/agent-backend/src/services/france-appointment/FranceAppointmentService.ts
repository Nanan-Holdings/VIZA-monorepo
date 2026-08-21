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
  profile: FranceAppointmentApplicantProfile;
}

export interface FranceAppointmentApplicantProfile {
  fullName: string | null;
  surname: string | null;
  givenNames: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
  passportNumber: string | null;
  passportExpiryDate: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
}

export interface FranceAppointmentReview {
  fullName: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
  passportNumber: string | null;
  passportExpiryDate: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  franceVisasReferenceMasked: string | null;
  centerCode: string | null;
  centerName: string | null;
  missingFields: string[];
  complete: boolean;
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
  appointmentAccountId: string | null;
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

export interface FranceAppointmentAccount {
  id: string;
  applicationId: string | null;
  accountEmail: string | null;
  accountStatus: string;
  emailVerified: boolean;
  lastLoginAt: string | null;
  referenceReady?: boolean;
  metadataRedactedJson?: JsonObject;
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
  expiresAt: string | null;
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
  job: FranceAppointmentJob | null;
  account: FranceAppointmentAccount | null;
  review: FranceAppointmentReview;
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
  listManualActions(jobId: string): Promise<FranceAppointmentManualAction[]>;
  getLatestJob(applicationId: string): Promise<FranceAppointmentJob | null>;
  findJobByIdempotencyKey?(idempotencyKey: string): Promise<FranceAppointmentJob | null>;
  getJob(jobId: string): Promise<FranceAppointmentJob | null>;
  getAccountForApplication(applicationId: string): Promise<FranceAppointmentAccount | null>;
  insertJob(input: Omit<FranceAppointmentJob, "id" | "createdAt" | "updatedAt">): Promise<FranceAppointmentJob>;
  updateJob(jobId: string, patch: Partial<FranceAppointmentJob>): Promise<FranceAppointmentJob>;
  replaceObservedSlots(
    jobId: string,
    slots: Omit<FranceAppointmentSlot, "id" | "jobId" | "applicationId" | "status" | "observedAt" | "expiresAt">[],
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
  readinessPollIntervalMs?: number;
  readinessTimeoutMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  fetchImpl?: typeof fetch;
}

export interface SubmissionServiceReadinessResult {
  ready: boolean;
  attempts: number;
  elapsedMs: number;
}

/**
 * Poll the submission-service's existing /ready contract. This helper must be
 * called only from explicit run/check-slots actions; status reads never wake
 * a worker or perform a readiness probe.
 */
export async function waitForSubmissionServiceReady(
  submissionServiceUrl: string,
  options: {
    fetchImpl?: typeof fetch;
    now?: () => number;
    sleep?: (milliseconds: number) => Promise<void>;
    pollIntervalMs?: number;
    timeoutMs?: number;
  } = {},
): Promise<SubmissionServiceReadinessResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((milliseconds: number) => new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  }));
  const pollIntervalMs = Math.max(1, options.pollIntervalMs ?? 2_000);
  const timeoutMs = Math.max(pollIntervalMs, options.timeoutMs ?? 45_000);
  const startedAt = now();
  const deadline = startedAt + timeoutMs;
  const maxAttempts = Math.ceil(timeoutMs / pollIntervalMs) + 1;
  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts += 1;
    const requestTimeoutMs = Math.max(1, Math.min(pollIntervalMs, deadline - now()));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const response = await fetchImpl(new URL("/ready", submissionServiceUrl), {
        method: "GET",
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
      if (response.ok) {
        clearTimeout(timeout);
        return { ready: true, attempts, elapsedMs: Math.max(0, now() - startedAt) };
      }
    } catch {
      // The worker may still be cold or the local network may be transient.
    } finally {
      clearTimeout(timeout);
    }
    const remaining = deadline - now();
    if (remaining <= 0) break;
    await sleep(Math.min(pollIntervalMs, remaining));
  }

  return { ready: false, attempts, elapsedMs: Math.max(0, now() - startedAt) };
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

function nullableNonEmpty(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function maskFranceVisasReference(value: string | null): string | null {
  const reference = nullableNonEmpty(value);
  if (!reference) return null;
  // The repository exposes the encrypted-at-rest value, not a decryptable
  // plaintext reference. Keep the review useful without leaking ciphertext
  // fragments or making them look like the official reference.
  return "••••••••";
}

function buildReview(
  application: FranceAppointmentApplication,
  centerCode: string | null,
): FranceAppointmentReview {
  const profile = application.profile ?? {
    fullName: null,
    surname: null,
    givenNames: null,
    dateOfBirth: null,
    nationality: null,
    passportNumber: null,
    passportExpiryDate: null,
    phone: null,
    email: null,
    address: null,
  };
  const reference = nullableNonEmpty(application.officialReferenceEncrypted);
  const fullName = nullableNonEmpty(profile.fullName)
    ?? ([profile.givenNames, profile.surname].map(nullableNonEmpty).filter(Boolean).join(" ") || null);
  const missingFields: string[] = [];
  const required: Array<[string, string | null]> = [
    ["fullName", fullName],
    ["dateOfBirth", nullableNonEmpty(profile.dateOfBirth)],
    ["nationality", nullableNonEmpty(profile.nationality)],
    ["passportNumber", nullableNonEmpty(profile.passportNumber)],
    ["passportExpiryDate", nullableNonEmpty(profile.passportExpiryDate)],
    ["phone", nullableNonEmpty(profile.phone)],
    ["email", nullableNonEmpty(profile.email)],
    ["address", nullableNonEmpty(profile.address)],
    ["franceVisasReference", reference],
  ];
  for (const [field, value] of required) if (!value) missingFields.push(field);
  return {
    fullName,
    dateOfBirth: nullableNonEmpty(profile.dateOfBirth),
    nationality: nullableNonEmpty(profile.nationality),
    passportNumber: nullableNonEmpty(profile.passportNumber),
    passportExpiryDate: nullableNonEmpty(profile.passportExpiryDate),
    phone: nullableNonEmpty(profile.phone),
    email: nullableNonEmpty(profile.email),
    address: nullableNonEmpty(profile.address),
    franceVisasReferenceMasked: maskFranceVisasReference(reference),
    centerCode,
    centerName: centerCode ? CENTER_NAMES[centerCode] ?? null : null,
    missingFields,
    complete: missingFields.length === 0,
  };
}

function objectValue(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function checkpointType(value: unknown): string {
  const type = typeof value === "string" ? value.trim() : "site_policy_review";
  return type || "site_policy_review";
}

function sanitizeCheckpointMetadata(value: unknown): JsonObject {
  const source = objectValue(value);
  const safe: JsonObject = {};
  for (const [key, item] of Object.entries(source)) {
    if (key === "redactedUrl" && typeof item === "string") {
      try {
        const url = new URL(item);
        if (url.protocol === "https:" && /(?:^|\.)tlscontact\.com$/iu.test(url.hostname)) {
          safe.redactedUrl = `${url.origin}${url.pathname}`;
        }
      } catch {
        // Ignore malformed or non-official evidence URLs.
      }
      continue;
    }
    if (/password|secret|token|cookie|reference|otp|cdp|url/i.test(key)) continue;
    if (typeof item === "string" && item.length > 300) continue;
    if (Array.isArray(item) && item.length <= 30 && item.every((entry) => typeof entry === "string" && entry.length <= 120)) {
      safe[key] = item;
      continue;
    }
    if (["string", "number", "boolean"].includes(typeof item) || item === null) safe[key] = item;
  }
  return safe;
}

function sanitizeWorkerErrorMessage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/gu, " ").trim();
  if (!normalized) return null;
  return normalized
    .replace(/wss?:\/\/\S+/giu, "[redacted-browser-endpoint]")
    .replace(/https?:\/\/\S+/giu, (raw) => {
      const candidate = raw.replace(/[),.;]+$/gu, "");
      try {
        const url = new URL(candidate);
        return /(?:^|\.)tlscontact\.com$/iu.test(url.hostname)
          ? `${url.origin}${url.pathname}`
          : "[redacted-url]";
      } catch {
        return "[redacted-url]";
      }
    })
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu, "[redacted-email]")
    .replace(/\b[A-Za-z0-9_-]{80,}\b/gu, "[redacted-token]")
    .slice(0, 500);
}

function isRetryableWorkerError(message: string | null): boolean {
  return Boolean(message && /browser endpoint|cloudflare|waf|timeout|timed out|captcha|did not leave the authentication form/iu.test(message));
}

function dryRunSlots(centerCode: string): Omit<FranceAppointmentSlot, "id" | "jobId" | "applicationId" | "status" | "observedAt" | "expiresAt">[] {
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
  private readonly readinessPollIntervalMs: number;
  private readonly readinessTimeoutMs: number;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly repository: FranceAppointmentRepository, options: FranceAppointmentServiceOptions = {}) {
    this.slotCooldownMs = options.slotCooldownMs ?? 600_000;
    this.now = options.now ?? Date.now;
    this.submissionServiceUrl = options.submissionServiceUrl ?? process.env.FRANCE_TLS_SUBMISSION_SERVICE_URL ?? "http://127.0.0.1:8080";
    this.accountPreparationEnabled = options.accountPreparationEnabled
      ?? process.env.FRANCE_TLS_ACCOUNT_PREP_ENABLED === "true";
    this.submissionServiceToken = options.submissionServiceToken
      ?? process.env.FRANCE_TLS_INTERNAL_TOKEN
      ?? null;
    this.readinessPollIntervalMs = options.readinessPollIntervalMs ?? 2_000;
    this.readinessTimeoutMs = options.readinessTimeoutMs ?? 45_000;
    this.sleep = options.sleep ?? ((milliseconds: number) => new Promise<void>((resolve) => {
      setTimeout(resolve, milliseconds);
    }));
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async recordConsent(input: {
    applicationId: string;
    userId: string;
    consentSnapshot: JsonObject;
  }): Promise<FranceAppointmentManualAction> {
    const application = await this.getApplicationOrThrow(input.applicationId);
    this.assertOwner(application, input.userId);
    const existingConsent = await this.repository.findConsent(application.id, input.userId);
    if (existingConsent) return existingConsent;
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
    if (!nullableNonEmpty(application.officialReferenceEncrypted)) {
      await this.repository.updateApplicationAppointmentState(application.id, {
        appointmentAssistanceStatus: "official_reference_required",
      });
      throw new FranceAppointmentServiceError(409, "official_reference_required", "A France-Visas official reference must be captured before TLS appointment booking.");
    }

    const centerCode = normalizeCenterCode(input.centerCode);
    const mode = input.mode ?? "dry_run";
    const idempotencyKey = input.idempotencyKey
      ?? `france-tls:${application.id}:${input.userId}:${centerCode}:${mode}`;
    const existingByKey = this.repository.findJobByIdempotencyKey
      ? await this.repository.findJobByIdempotencyKey(idempotencyKey)
      : null;
    if (existingByKey) return existingByKey;

    const existing = await this.repository.getLatestJob(application.id);
    if (existing && !["appointment_failed", "appointment_cancelled"].includes(existing.status)) return existing;

    const job = await this.repository.insertJob({
      applicationId: application.id,
      userId: input.userId,
      countryCode: "FR",
      visaType: "EU_SCHENGEN_C_SHORT_STAY",
      applyingCountryCode: "CN",
      applyingPostCity: CENTER_NAMES[centerCode],
      schedulingProvider: "tlscontact_cn_fr",
      appointmentAccountId: null,
      status: "appointment_consent_received",
      mode,
      requiresUserAction: false,
      currentManualAction: null,
      userPreferencesJson: {
        centerCode,
        provider: "tlscontact_cn_fr",
        officialReferenceCaptured: true,
        referenceReady: false,
        userSelectedSlotRequired: true,
        paymentAuthorizationRequired: mode !== "assisted_live",
        finalConfirmationRequired: mode !== "assisted_live",
      },
      lastSlotCheckAt: null,
      paymentSessionStatus: mode === "assisted_live" ? "not_required" : "required",
      paymentAuthorizationRedactedJson: null,
      idempotencyKey,
    });
    await this.repository.updateApplicationAppointmentState(application.id, {
      appointmentAssistanceStatus: job.status,
      appointmentAssistanceJobId: job.id,
    });
    return job;
  }

  async getStatus(jobId: string): Promise<FranceAppointmentSnapshot> {
    const job = await this.getJobOrThrow(jobId);
    const [application, slots, confirmation, account, manualActions] = await Promise.all([
      this.getApplicationOrThrow(job.applicationId),
      this.repository.listSlots(job.id),
      this.repository.getConfirmation(job.id),
      this.repository.getAccountForApplication(job.applicationId),
      this.repository.listManualActions(job.id),
    ]);
    return this.snapshot(job, application, slots, confirmation, account, manualActions);
  }

  async getStatusForApplication(applicationId: string): Promise<FranceAppointmentSnapshot> {
    const application = await this.getApplicationOrThrow(applicationId);
    const job = await this.repository.getLatestJob(applicationId);
    if (job) return this.getStatus(job.id);
    return {
      job: null,
      account: await this.repository.getAccountForApplication(applicationId),
      review: buildReview(application, null),
      slots: [],
      pendingManualAction: null,
      manualActions: [],
      confirmation: null,
      latestStatusCheck: null,
      dryRunNotice: null,
    };
  }

  /**
   * Explicit user action. This endpoint prepares the alias account, activation
   * and France-Visas reference only; it never checks or selects appointment
   * slots.
   */
  async run(jobId: string): Promise<FranceAppointmentSnapshot> {
    const job = await this.getJobOrThrow(jobId);
    if (["appointment_failed", "appointment_cancelled"].includes(job.status)) {
      throw new FranceAppointmentServiceError(409, "appointment_job_terminal", "This appointment attempt is terminal; create a new attempt to retry it.");
    }
    if (job.mode !== "assisted_live") return this.getStatus(job.id);

    const account = await this.repository.getAccountForApplication(job.applicationId);
    if (this.accountIsReady(job, account)) {
      const updated = await this.repository.updateJob(job.id, {
        status: job.status === "appointment_consent_received" ? "appointment_profile_filled" : job.status,
        requiresUserAction: false,
        currentManualAction: null,
        userPreferencesJson: {
          ...job.userPreferencesJson,
          referenceReady: true,
          accountPreparation: { emailVerified: true, loggedIn: true, referenceReady: true },
        },
      });
      await this.repository.updateApplicationAppointmentState(job.applicationId, {
        appointmentAssistanceStatus: updated.status,
        appointmentAssistanceJobId: updated.id,
      });
      return this.getStatus(updated.id);
    }
    if (!this.accountPreparationEnabled) {
      return this.persistCheckpoint(job, {
        type: "account_preparation_disabled",
        message: "France TLS account preparation is disabled for this environment. Enable the explicit account-preparation gate before retrying.",
        retryable: false,
        metadataRedactedJson: { provider: "tlscontact_cn_fr" },
      });
    }
    if (!this.submissionServiceUrl) {
      return this.persistCheckpoint(job, {
        type: "account_preparation_not_configured",
        message: "France TLS account preparation is not configured.",
        retryable: false,
        metadataRedactedJson: { provider: "tlscontact_cn_fr" },
      });
    }

    const readiness = await waitForSubmissionServiceReady(this.submissionServiceUrl, {
      fetchImpl: this.fetchImpl,
      now: this.now,
      sleep: this.sleep,
      pollIntervalMs: this.readinessPollIntervalMs,
      timeoutMs: this.readinessTimeoutMs,
    });
    if (!readiness.ready) {
      return this.persistCheckpoint(job, {
        type: "worker_readiness_timeout",
        message: "The France submission worker did not become ready. You can retry this account-preparation step.",
        retryable: true,
        metadataRedactedJson: {
          provider: "tlscontact_cn_fr",
          attempts: readiness.attempts,
          elapsedMs: readiness.elapsedMs,
        },
      });
    }

    const preparation = await this.prepareLiveAccount(job);
    if (preparation.checkpoint) {
      return this.persistCheckpoint(job, {
        ...preparation.checkpoint,
        metadataRedactedJson: {
          ...preparation.checkpoint.metadataRedactedJson,
          ...preparation.evidence,
        },
      });
    }
    const updated = await this.repository.updateJob(job.id, {
      status: job.status === "appointment_consent_received" ? "appointment_profile_filled" : job.status,
      requiresUserAction: false,
      currentManualAction: null,
      userPreferencesJson: {
        ...job.userPreferencesJson,
        referenceReady: preparation.referenceReady,
        accountPreparation: preparation.accountPreparation,
        accountPreparationEvidence: preparation.evidence,
      },
    });
    await this.repository.updateApplicationAppointmentState(job.applicationId, {
      appointmentAssistanceStatus: updated.status,
      appointmentAssistanceJobId: updated.id,
    });
    return this.getStatus(updated.id);
  }

  async checkSlots(jobId: string): Promise<FranceAppointmentSnapshot> {
    const job = await this.getJobOrThrow(jobId);
    if (job.mode === "assisted_live") {
      const account = await this.repository.getAccountForApplication(job.applicationId);
      if (!this.accountIsReady(job, account)) {
        throw new FranceAppointmentServiceError(409, "account_not_ready", "Run account preparation first; verified, logged-in account and France-Visas reference readiness are required before slot observation.");
      }
    }
    if (job.lastSlotCheckAt && this.now() - Date.parse(job.lastSlotCheckAt) < this.slotCooldownMs) {
      throw new FranceAppointmentServiceError(429, "slot_check_rate_limited", "France TLS slot checks are rate limited.");
    }
    if (job.mode === "dry_run") {
      const slots = await this.repository.replaceObservedSlots(job.id, dryRunSlots(jobCenterCode(job)));
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
      return this.getStatus(updated.id);
    }

    if (!this.submissionServiceUrl) {
      return this.persistCheckpoint(job, {
        type: "worker_not_configured",
        message: "France TLS slot observation is not configured.",
        retryable: true,
        metadataRedactedJson: { provider: "tlscontact_cn_fr" },
      });
    }
    const readiness = await waitForSubmissionServiceReady(this.submissionServiceUrl, {
      fetchImpl: this.fetchImpl,
      now: this.now,
      sleep: this.sleep,
      pollIntervalMs: this.readinessPollIntervalMs,
      timeoutMs: this.readinessTimeoutMs,
    });
    if (!readiness.ready) {
      return this.persistCheckpoint(job, {
        type: "worker_readiness_timeout",
        message: "The France submission worker did not become ready. You can retry the slot observation.",
        retryable: true,
        metadataRedactedJson: {
          provider: "tlscontact_cn_fr",
          attempts: readiness.attempts,
          elapsedMs: readiness.elapsedMs,
        },
      });
    }

    const liveResult = await this.checkLiveSlots(job);
    if (liveResult.checkpoint) {
      return this.persistCheckpoint(job, {
        ...liveResult.checkpoint,
        metadataRedactedJson: {
          ...liveResult.checkpoint.metadataRedactedJson,
          ...liveResult.evidence,
        },
      }, new Date(this.now()).toISOString());
    }
    const slots = await this.repository.replaceObservedSlots(job.id, liveResult.slots);
    const updated = await this.repository.updateJob(job.id, {
      status: liveResult.noSlots || slots.length === 0 ? "appointment_no_slots_available" : "appointment_slots_observed",
      requiresUserAction: false,
      currentManualAction: null,
      lastSlotCheckAt: new Date(this.now()).toISOString(),
      userPreferencesJson: {
        ...job.userPreferencesJson,
        lastSlotObservationEvidence: liveResult.evidence,
      },
    });
    await this.repository.updateApplicationAppointmentState(job.applicationId, {
      appointmentAssistanceStatus: updated.status,
      appointmentAssistanceJobId: updated.id,
    });
    return this.getStatus(updated.id);
  }

  async selectSlot(jobId: string, slotId: string): Promise<FranceAppointmentSnapshot> {
    const job = await this.getJobOrThrow(jobId);
    if (job.mode === "assisted_live") {
      throw new FranceAppointmentServiceError(409, "assisted_live_selection_disabled", "Assisted-live France slot selection is disabled for this observation milestone.");
    }
    if (!["appointment_slot_selection_required", "appointment_slots_observed"].includes(job.status)) {
      throw new FranceAppointmentServiceError(409, "slot_selection_not_allowed", "Slot selection is not currently available.");
    }
    const selected = await this.repository.selectSlot(job.id, slotId);
    if (!selected) {
      throw new FranceAppointmentServiceError(404, "slot_not_found_or_expired", "Appointment slot was not found, belongs to another attempt, or has expired.");
    }
    if (selected.expiresAt && Date.parse(selected.expiresAt) <= this.now()) {
      throw new FranceAppointmentServiceError(409, "slot_expired", "This appointment slot has expired. Refresh the official observations.");
    }
    const updated = await this.repository.updateJob(job.id, {
      status: "appointment_final_confirmation_required",
      requiresUserAction: true,
      currentManualAction: "final_confirmation",
    });
    return this.getStatus(updated.id);
  }

  async recordPaymentAuthorization(jobId: string, input: {
    sessionId: string;
    redacted: JsonObject;
  }): Promise<FranceAppointmentJob> {
    const job = await this.getJobOrThrow(jobId);
    if (job.mode === "assisted_live") {
      throw new FranceAppointmentServiceError(409, "assisted_live_payment_disabled", "Assisted-live France payment is disabled for this observation milestone.");
    }
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
    if (job.mode === "assisted_live") {
      throw new FranceAppointmentServiceError(409, "assisted_live_confirmation_disabled", "Assisted-live France confirmation is disabled for this observation milestone.");
    }
    const selectedSlot = await this.repository.getSelectedSlot(job.id);
    if (!selectedSlot) {
      throw new FranceAppointmentServiceError(409, "slot_required", "A user-selected TLS slot is required before final approval.");
    }
    await this.repository.insertManualAction({
      applicationId: job.applicationId,
      userId: job.userId,
      jobId: job.id,
      actionType: "final_confirmation",
      status: "completed",
      instruction: "User approved the selected TLScontact slot for the final booking attempt.",
      userInputRedactedJson: { approved: true },
      metadataRedactedJson: { provider: "tlscontact_cn_fr" },
      completedAt: new Date(this.now()).toISOString(),
    });
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
    if (job.mode === "assisted_live") {
      throw new FranceAppointmentServiceError(409, "assisted_live_booking_disabled", "Assisted-live France booking is disabled for this observation milestone.");
    }
    const selectedSlot = await this.repository.getSelectedSlot(job.id);
    if (!selectedSlot) {
      throw new FranceAppointmentServiceError(409, "slot_required", "A selected TLS slot is required before booking.");
    }
    if (selectedSlot.expiresAt && Date.parse(selectedSlot.expiresAt) <= this.now()) {
      throw new FranceAppointmentServiceError(409, "slot_expired", "This appointment slot has expired. Refresh the official observations.");
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
    return this.getStatus(updated.id);
  }

  async cancelJob(jobId: string): Promise<FranceAppointmentJob> {
    const job = await this.getJobOrThrow(jobId);
    if (["appointment_failed", "appointment_cancelled"].includes(job.status)) return job;
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
    application: FranceAppointmentApplication,
    slots: FranceAppointmentSlot[],
    confirmation: FranceAppointmentConfirmation | null,
    account: FranceAppointmentAccount | null,
    manualActions: FranceAppointmentManualAction[],
  ): FranceAppointmentSnapshot {
    const centerCode = jobCenterCode(job);
    return {
      job,
      account,
      review: buildReview(application, centerCode),
      slots,
      pendingManualAction: latestPendingAction(manualActions),
      manualActions,
      confirmation,
      latestStatusCheck: null,
      dryRunNotice: job.mode === "dry_run"
        ? "Dry-run mode returns deterministic sample TLS slots and does not connect to TLScontact."
        : null,
    };
  }

  private accountIsReady(job: FranceAppointmentJob, account: FranceAppointmentAccount | null): boolean {
    const preparation = objectValue(job.userPreferencesJson.accountPreparation);
    const accountMetadata = objectValue(account?.metadataRedactedJson);
    const emailVerified = account?.emailVerified === true
      || preparation.emailVerified === true
      || accountMetadata.emailVerified === true;
    const loggedIn = Boolean(account?.lastLoginAt)
      || ["logged_in", "appointment_reference_filled", "ready"].includes(account?.accountStatus ?? "")
      || preparation.loggedIn === true
      || accountMetadata.loggedIn === true;
    const referenceReady = account?.referenceReady === true
      || preparation.referenceReady === true
      || job.userPreferencesJson.referenceReady === true
      || accountMetadata.referenceReady === true;
    return emailVerified && loggedIn && referenceReady;
  }

  private async persistCheckpoint(
    job: FranceAppointmentJob,
    checkpoint: {
      type: string;
      message: string;
      retryable: boolean;
      metadataRedactedJson: JsonObject;
    },
    observedAt = new Date(this.now()).toISOString(),
  ): Promise<FranceAppointmentSnapshot> {
    const normalized = {
      type: checkpointType(checkpoint.type),
      message: checkpoint.message.slice(0, 500),
      retryable: checkpoint.retryable,
      observedAt,
      metadataRedactedJson: sanitizeCheckpointMetadata(checkpoint.metadataRedactedJson),
    };
    const updated = await this.repository.updateJob(job.id, {
      status: "appointment_manual_required",
      requiresUserAction: true,
      currentManualAction: normalized.type,
      userPreferencesJson: {
        ...job.userPreferencesJson,
        liveCheckpoint: normalized,
      },
    });
    await this.repository.updateApplicationAppointmentState(job.applicationId, {
      appointmentAssistanceStatus: updated.status,
      appointmentAssistanceJobId: updated.id,
    });
    const actions = await this.repository.listManualActions(job.id);
    const latestPending = latestPendingAction(actions);
    const samePendingCheckpoint = latestPending?.actionType === normalized.type
      && latestPending.instruction === normalized.message;
    if (!samePendingCheckpoint) {
      await this.repository.insertManualAction({
        applicationId: updated.applicationId,
        userId: updated.userId,
        jobId: updated.id,
        actionType: normalized.type,
        status: "pending",
        instruction: normalized.message,
        metadataRedactedJson: {
          ...normalized.metadataRedactedJson,
          retryable: normalized.retryable,
          observedAt: normalized.observedAt,
        },
      });
    }
    return this.getStatus(updated.id);
  }

  private async prepareLiveAccount(job: FranceAppointmentJob): Promise<{
    referenceReady: boolean;
    accountPreparation: { emailVerified: boolean; loggedIn: boolean; referenceReady: boolean };
    evidence: JsonObject;
    checkpoint?: {
      type: string;
      message: string;
      retryable: boolean;
      metadataRedactedJson: JsonObject;
    };
  }> {
    const endpoint = new URL("/internal/france-tls/register-account", this.submissionServiceUrl ?? "http://127.0.0.1:8080");
    let response: Response;
    try {
      response = await this.fetchImpl(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(this.submissionServiceToken ? { authorization: `Bearer ${this.submissionServiceToken}` } : {}),
        },
        body: JSON.stringify({
          applicationId: job.applicationId,
          jobId: job.id,
          centerCode: jobCenterCode(job),
          submitRegistration: true,
          fillOfficialReference: true,
        }),
      });
    } catch {
      return {
        referenceReady: false,
        accountPreparation: { emailVerified: false, loggedIn: false, referenceReady: false },
        evidence: {},
        checkpoint: {
          type: "account_preparation_failed",
          message: "The France TLS account-preparation worker could not be reached.",
          retryable: true,
          metadataRedactedJson: { provider: "tlscontact_cn_fr" },
        },
      };
    }
    const payload = await response.json().catch(() => null) as {
      ok?: boolean;
      status?: string;
      error?: unknown;
      checkpoint?: { type?: string; message?: string; missingFields?: string[] };
      finalUrl?: unknown;
      evidence?: unknown;
    } | null;
    const status = payload?.status ?? "";
    const workerError = sanitizeWorkerErrorMessage(payload?.error);
    const evidencePaths = Array.isArray(payload?.evidence)
      ? payload.evidence.filter((item): item is string => typeof item === "string")
      : [];
    const evidence = sanitizeCheckpointMetadata({
      redactedUrl: payload?.finalUrl,
      pageType: status || "account_preparation",
      screenshotPath: evidencePaths.at(-1),
    });
    const accountPreparation = {
      emailVerified: ["account_activated", "logged_in", "appointment_reference_filled"].includes(status),
      loggedIn: ["logged_in", "appointment_reference_filled"].includes(status),
      referenceReady: status === "appointment_reference_filled",
    };
    if (!response.ok || payload?.ok !== true) {
      return {
        referenceReady: accountPreparation.referenceReady,
        accountPreparation,
        evidence,
        checkpoint: {
          type: "account_preparation_failed",
          message: workerError ?? "France TLS account preparation did not complete.",
          retryable: response.status >= 500 || response.status === 429 || isRetryableWorkerError(workerError),
          metadataRedactedJson: {
            provider: "tlscontact_cn_fr",
            httpStatus: response.status,
            workerErrorPresent: Boolean(workerError),
          },
        },
      };
    }
    if (payload.checkpoint) {
      return {
        referenceReady: accountPreparation.referenceReady,
        accountPreparation,
        evidence,
        checkpoint: {
          type: checkpointType(payload.checkpoint.type),
          message: payload.checkpoint.message ?? "France TLS account preparation requires a checkpoint.",
          retryable: true,
          metadataRedactedJson: {
            provider: "tlscontact_cn_fr",
            missingFields: payload.checkpoint.missingFields ?? [],
          },
        },
      };
    }
    if (!accountPreparation.emailVerified || !accountPreparation.loggedIn || !accountPreparation.referenceReady) {
      return {
        referenceReady: accountPreparation.referenceReady,
        accountPreparation,
        evidence,
        checkpoint: {
          type: "account_preparation_incomplete",
          message: "France TLS account preparation returned before account verification, login, and reference readiness were all confirmed.",
          retryable: true,
          metadataRedactedJson: { provider: "tlscontact_cn_fr", responseStatus: status || "unknown" },
        },
      };
    }
    return { referenceReady: true, accountPreparation, evidence };
  }

  private async checkLiveSlots(job: FranceAppointmentJob): Promise<{
    slots: Omit<FranceAppointmentSlot, "id" | "jobId" | "applicationId" | "status" | "observedAt" | "expiresAt">[];
    noSlots: boolean;
    evidence: JsonObject;
    checkpoint?: {
      type: string;
      message: string;
      retryable: boolean;
      metadataRedactedJson: JsonObject;
    };
  }> {
    const endpoint = new URL("/local/france-tls/check-slots", this.submissionServiceUrl ?? "http://127.0.0.1:8080");
    let response: Response;
    try {
      response = await this.fetchImpl(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(this.submissionServiceToken ? { authorization: `Bearer ${this.submissionServiceToken}` } : {}),
        },
        body: JSON.stringify({
          applicationId: job.applicationId,
          jobId: job.id,
          centerCode: jobCenterCode(job),
        }),
      });
    } catch {
      return {
        slots: [],
        noSlots: false,
        evidence: {},
        checkpoint: {
          type: "site_policy_review",
          message: "The France TLS official portal check could not be reached.",
          retryable: true,
          metadataRedactedJson: { provider: "tlscontact_cn_fr" },
        },
      };
    }
    const payload = await response.json().catch(() => null) as {
      ok?: boolean;
      status?: string;
      slots?: Array<{
        appointmentDate?: string;
        appointmentTime?: string;
        appointmentLocation?: string;
        appointmentType?: string;
        source?: string;
        metadataRedactedJson?: JsonObject;
      }>;
      checkpoint?: { type?: string; message?: string; metadataRedactedJson?: JsonObject };
      evidence?: { redactedUrl?: unknown; pageType?: unknown; screenshotPath?: unknown };
    } | null;
    const evidence = sanitizeCheckpointMetadata(payload?.evidence);
    if (!response.ok || payload?.ok !== true) {
      return {
        slots: [],
        noSlots: false,
        evidence,
        checkpoint: {
          type: "site_policy_review",
          message: "The France TLS official portal check failed in submission-service.",
          retryable: response.status >= 500 || response.status === 429,
          metadataRedactedJson: { provider: "tlscontact_cn_fr", httpStatus: response.status },
        },
      };
    }
    if (payload.checkpoint) {
      return {
        slots: [],
        noSlots: false,
        evidence,
        checkpoint: {
          type: checkpointType(payload.checkpoint.type),
          message: payload.checkpoint.message ?? "France TLS official portal requires a checkpoint.",
          retryable: true,
          metadataRedactedJson: payload.checkpoint.metadataRedactedJson ?? { provider: "tlscontact_cn_fr" },
        },
      };
    }
    if (payload.status !== "slots_observed" && payload.status !== "no_slots_available") {
      return {
        slots: [],
        noSlots: false,
        evidence,
        checkpoint: {
          type: "selector_drift",
          message: "France TLS was reached, but its response did not identify an official slot or no-slots state.",
          retryable: true,
          metadataRedactedJson: { provider: "tlscontact_cn_fr", responseStatus: payload.status ?? "unknown" },
        },
      };
    }
    if (payload.status === "no_slots_available") return { slots: [], noSlots: true, evidence };
    const slots = this.normalizeLiveSlots(jobCenterCode(job), payload.slots ?? []);
    if (slots === null || slots.length === 0) {
      return {
        slots: [],
        noSlots: false,
        evidence,
        checkpoint: {
          type: "selector_drift",
          message: "France TLS returned a slot payload that could not be safely paired to an official slot control.",
          retryable: true,
          metadataRedactedJson: { provider: "tlscontact_cn_fr" },
        },
      };
    }
    return { slots, noSlots: false, evidence };
  }

  private normalizeLiveSlots(
    centerCode: string,
    input: Array<{
      appointmentDate?: string;
      appointmentTime?: string;
      appointmentLocation?: string;
      appointmentType?: string;
      source?: string;
      metadataRedactedJson?: JsonObject;
    }>,
  ): Omit<FranceAppointmentSlot, "id" | "jobId" | "applicationId" | "status" | "observedAt" | "expiresAt">[] | null {
    const normalized: Omit<FranceAppointmentSlot, "id" | "jobId" | "applicationId" | "status" | "observedAt" | "expiresAt">[] = [];
    const seen = new Set<string>();
    for (const slot of input) {
      const date = nullableNonEmpty(slot.appointmentDate);
      const time = nullableNonEmpty(slot.appointmentTime);
      const location = nullableNonEmpty(slot.appointmentLocation);
      const type = nullableNonEmpty(slot.appointmentType);
      const source = nullableNonEmpty(slot.source) ?? "france_tls_live";
      const metadata = objectValue(slot.metadataRedactedJson);
      const providerSlotId = typeof metadata.providerSlotId === "string" ? metadata.providerSlotId.trim()
        : typeof metadata.slotId === "string" ? metadata.slotId.trim() : "";
      if (
        !date
        || !/^\d{4}-\d{2}-\d{2}$/u.test(date)
        || !time
        || !/^([01]\d|2[0-3]):[0-5]\d$/u.test(time)
        || time === "00:00"
        || !location
        || !type
        || source === "france_tls_dry_run"
        || !providerSlotId
      ) return null;
      const key = `${providerSlotId}|${date}|${time}|${location}`;
      if (seen.has(key)) continue;
      seen.add(key);
      normalized.push({
        appointmentDate: date,
        appointmentTime: time,
        appointmentLocation: location,
        appointmentType: type,
        source: "france_tls_live",
        metadataRedactedJson: {
          ...metadata,
          provider: "tlscontact_cn_fr",
          providerSlotId,
          centerCode,
          observedFromOfficialPage: true,
        },
      });
    }
    return normalized;
  }
}

export function createFranceAppointmentService(
  repository: FranceAppointmentRepository,
  options?: FranceAppointmentServiceOptions,
): FranceAppointmentService {
  return new FranceAppointmentService(repository, options);
}
