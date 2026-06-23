import { getSupabaseClient } from "../../db/supabase-client.js";
import type {
  AppointmentAccount,
  AppointmentAssistanceAttempt,
  AppointmentAssistanceJob,
  AppointmentConfirmation,
  AppointmentManualAction,
  AppointmentManualActionStatus,
  AppointmentManualActionType,
  AppointmentSlot,
  AppointmentStatusCheck,
  InsertAppointmentAuditEventInput,
  InsertAppointmentManualActionInput,
  JsonObject,
  USAppointmentApplication,
  USAppointmentMode,
  USAppointmentStatus,
} from "./types.js";
import {
  appointmentManualActionStatuses,
  appointmentManualActionTypes,
  usAppointmentModes,
  usAppointmentStatuses,
} from "./types.js";

type SupabaseObject = Record<string, unknown>;

const DS160_APPOINTMENT_POST_FIELD_NAMES = [
  "embassyLocation",
  "embassy_location",
  "embassyOrConsulate",
  "embassy_or_consulate",
  "interview_location",
  "appointment_post_city",
  "applying_post_city",
] as const;

const SIMPLIFIED_FORM_STATE_KEY = "__simplified_form_state";

export interface InsertAppointmentAccountInput {
  userId: string;
  applicationId: string | null;
  portal: string;
  accountEmail?: string | null;
  accountStatus: string;
  emailVerified?: boolean;
  metadataRedactedJson?: JsonObject;
}

export interface InsertAppointmentJobInput {
  applicationId: string;
  userId: string;
  appointmentAccountId?: string | null;
  countryCode: string;
  visaType: string;
  ds160ConfirmationCode: string;
  applyingCountryCode: string;
  applyingPostCity: string;
  schedulingProvider: string;
  status: USAppointmentStatus;
  mode: USAppointmentMode;
  userPreferencesJson: JsonObject;
  requiresUserAction: boolean;
  currentManualAction: string | null;
  idempotencyKey: string;
}

export interface InsertAppointmentAttemptInput {
  jobId: string;
  applicationId: string;
  attemptNumber: number;
  status: string;
  provider: string | null;
  mode: USAppointmentMode;
  requestSnapshotRedactedJson: JsonObject;
}

export interface InsertAppointmentSlotInput {
  jobId: string;
  applicationId: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentLocation: string;
  appointmentType: string;
  source: string | null;
  status?: string;
  metadataRedactedJson?: JsonObject | null;
}

export interface InsertAppointmentConfirmationInput {
  jobId: string;
  applicationId: string;
  userId: string;
  countryCode: string;
  visaType: string;
  appointmentDate: string | null;
  appointmentTime: string | null;
  appointmentLocation: string | null;
  appointmentType: string | null;
  confirmationNumber: string | null;
  confirmationPdfUrl: string | null;
  confirmationScreenshotUrl: string | null;
  rawConfirmationRedactedJson: JsonObject | null;
}

export interface InsertStatusCheckInput {
  jobId: string | null;
  applicationId: string;
  userId: string;
  status: string;
  resultRedactedJson: JsonObject | null;
  screenshotUrl?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export interface USAppointmentRepository {
  getApplicationContext(applicationId: string): Promise<USAppointmentApplication | null>;
  findConsentByIdempotencyKey(idempotencyKey: string): Promise<AppointmentManualAction | null>;
  getLatestCompletedConsent(applicationId: string, userId: string): Promise<AppointmentManualAction | null>;
  insertAccount(input: InsertAppointmentAccountInput): Promise<AppointmentAccount>;
  updateAccount(
    accountId: string,
    patch: Partial<Pick<AppointmentAccount, "accountStatus" | "emailVerified" | "lastLoginAt" | "metadataRedactedJson">>,
  ): Promise<AppointmentAccount>;
  getAccount(accountId: string): Promise<AppointmentAccount | null>;
  findJobByIdempotencyKey(idempotencyKey: string): Promise<AppointmentAssistanceJob | null>;
  getJob(jobId: string): Promise<AppointmentAssistanceJob | null>;
  getLatestJobForApplication(applicationId: string): Promise<AppointmentAssistanceJob | null>;
  insertJob(input: InsertAppointmentJobInput): Promise<AppointmentAssistanceJob>;
  updateJob(
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
  ): Promise<AppointmentAssistanceJob>;
  listAttempts(jobId: string): Promise<AppointmentAssistanceAttempt[]>;
  insertAttempt(input: InsertAppointmentAttemptInput): Promise<AppointmentAssistanceAttempt>;
  updateAttempt(
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
  ): Promise<AppointmentAssistanceAttempt>;
  insertManualAction(input: InsertAppointmentManualActionInput): Promise<AppointmentManualAction>;
  getManualAction(actionId: string): Promise<AppointmentManualAction | null>;
  getLatestPendingManualAction(jobId: string): Promise<AppointmentManualAction | null>;
  listManualActions(jobId: string): Promise<AppointmentManualAction[]>;
  updateManualAction(
    actionId: string,
    patch: Partial<
      Pick<
        AppointmentManualAction,
        "status" | "userInputRedactedJson" | "completedAt" | "metadataRedactedJson"
      >
    >,
  ): Promise<AppointmentManualAction>;
  insertSlots(input: InsertAppointmentSlotInput[]): Promise<AppointmentSlot[]>;
  listSlots(jobId: string): Promise<AppointmentSlot[]>;
  getSlot(slotId: string): Promise<AppointmentSlot | null>;
  getSelectedSlot(jobId: string): Promise<AppointmentSlot | null>;
  updateSlotStatus(slotId: string, status: string): Promise<AppointmentSlot>;
  markOtherSlotsExpired(jobId: string, selectedSlotId: string): Promise<void>;
  insertConfirmation(input: InsertAppointmentConfirmationInput): Promise<AppointmentConfirmation>;
  getConfirmationForJob(jobId: string): Promise<AppointmentConfirmation | null>;
  getLatestStatusCheck(jobId: string): Promise<AppointmentStatusCheck | null>;
  insertStatusCheck(input: InsertStatusCheckInput): Promise<AppointmentStatusCheck>;
  updateApplicationAppointmentState(
    applicationId: string,
    patch: {
      appointmentAssistanceStatus?: string;
      appointmentAssistanceJobId?: string | null;
      appointmentConfirmationId?: string | null;
    },
  ): Promise<void>;
  addAuditEvent(input: InsertAppointmentAuditEventInput): Promise<void>;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function requiredString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function requiredNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function requiredBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function toJsonObject(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as JsonObject;
}

function toNullableJsonObject(value: unknown): JsonObject | null {
  if (value === null || value === undefined) return null;
  return toJsonObject(value);
}

function normalizeMode(value: unknown): USAppointmentMode {
  return usAppointmentModes.includes(value as USAppointmentMode)
    ? (value as USAppointmentMode)
    : "dry_run";
}

function normalizeStatus(value: unknown): USAppointmentStatus {
  return usAppointmentStatuses.includes(value as USAppointmentStatus)
    ? (value as USAppointmentStatus)
    : "appointment_failed";
}

function normalizeManualActionType(value: unknown): AppointmentManualActionType {
  return appointmentManualActionTypes.includes(value as AppointmentManualActionType)
    ? (value as AppointmentManualActionType)
    : "site_policy_review";
}

function normalizeManualStatus(value: unknown): AppointmentManualActionStatus {
  return appointmentManualActionStatuses.includes(value as AppointmentManualActionStatus)
    ? (value as AppointmentManualActionStatus)
    : "pending";
}

function readProfileAuthUserId(value: unknown): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return readProfileAuthUserId(value[0]);
  if (typeof value === "object") {
    return nullableString((value as SupabaseObject).auth_user_id);
  }
  return null;
}

function isMissingAppointmentSchemaError(error: { message?: string }): boolean {
  const message = error.message?.toLowerCase() ?? "";
  return (
    message.includes("appointment_") &&
    (message.includes("schema cache") ||
      message.includes("could not find the table") ||
      message.includes("could not find the column"))
  );
}

function resolveCountryCode(country: string): string {
  const normalized = country.trim().toLowerCase();
  if (["us", "usa", "united_states", "united states", "united-states"].includes(normalized)) {
    return "US";
  }
  return normalized.slice(0, 2).toUpperCase() || "US";
}

function mapAccount(row: SupabaseObject): AppointmentAccount {
  return {
    id: requiredString(row.id),
    userId: requiredString(row.user_id),
    applicationId: nullableString(row.application_id),
    countryCode: requiredString(row.country_code, "US"),
    portal: requiredString(row.portal),
    accountEmail: nullableString(row.account_email),
    encryptedAccountPassword: nullableString(row.encrypted_account_password),
    passwordVaultRef: nullableString(row.password_vault_ref),
    accountStatus: requiredString(row.account_status, "not_created"),
    emailVerified: requiredBoolean(row.email_verified),
    lastLoginAt: nullableString(row.last_login_at),
    metadataRedactedJson: toJsonObject(row.metadata_redacted_json),
    createdAt: nullableString(row.created_at),
    updatedAt: nullableString(row.updated_at),
  };
}

function mapJob(row: SupabaseObject): AppointmentAssistanceJob {
  return {
    id: requiredString(row.id),
    applicationId: requiredString(row.application_id),
    userId: requiredString(row.user_id),
    appointmentAccountId: nullableString(row.appointment_account_id),
    countryCode: requiredString(row.country_code, "US"),
    visaType: requiredString(row.visa_type, "B1/B2"),
    ds160ConfirmationCode: nullableString(row.ds160_confirmation_code),
    applyingCountryCode: nullableString(row.applying_country_code),
    applyingPostCity: nullableString(row.applying_post_city),
    schedulingProvider: nullableString(row.scheduling_provider),
    status: normalizeStatus(row.status),
    mode: normalizeMode(row.mode),
    userPreferencesJson: toJsonObject(row.user_preferences_json),
    requiresUserAction: requiredBoolean(row.requires_user_action),
    currentManualAction: nullableString(row.current_manual_action),
    lastErrorCode: nullableString(row.last_error_code),
    lastErrorMessage: nullableString(row.last_error_message),
    idempotencyKey: requiredString(row.idempotency_key),
    createdAt: nullableString(row.created_at),
    updatedAt: nullableString(row.updated_at),
  };
}

function mapAttempt(row: SupabaseObject): AppointmentAssistanceAttempt {
  return {
    id: requiredString(row.id),
    jobId: nullableString(row.job_id),
    applicationId: requiredString(row.application_id),
    attemptNumber: requiredNumber(row.attempt_number),
    status: requiredString(row.status),
    provider: nullableString(row.provider),
    mode: normalizeMode(row.mode),
    startedAt: nullableString(row.started_at),
    finishedAt: nullableString(row.finished_at),
    requestSnapshotRedactedJson: toNullableJsonObject(row.request_snapshot_redacted_json),
    resultSnapshotRedactedJson: toNullableJsonObject(row.result_snapshot_redacted_json),
    errorCode: nullableString(row.error_code),
    errorMessage: nullableString(row.error_message),
    screenshotUrl: nullableString(row.screenshot_url),
    traceUrl: nullableString(row.trace_url),
    videoUrl: nullableString(row.video_url),
  };
}

function mapManualAction(row: SupabaseObject): AppointmentManualAction {
  return {
    id: requiredString(row.id),
    jobId: nullableString(row.job_id),
    applicationId: requiredString(row.application_id),
    userId: requiredString(row.user_id),
    actionType: normalizeManualActionType(row.action_type),
    status: normalizeManualStatus(row.status),
    instruction: nullableString(row.instruction),
    userInputSchemaJson: toNullableJsonObject(row.user_input_schema_json),
    userInputRedactedJson: toNullableJsonObject(row.user_input_redacted_json),
    screenshotUrl: nullableString(row.screenshot_url),
    expiresAt: nullableString(row.expires_at),
    completedAt: nullableString(row.completed_at),
    metadataRedactedJson: toNullableJsonObject(row.metadata_redacted_json),
    createdAt: nullableString(row.created_at),
  };
}

function mapSlot(row: SupabaseObject): AppointmentSlot {
  return {
    id: requiredString(row.id),
    jobId: nullableString(row.job_id),
    applicationId: requiredString(row.application_id),
    appointmentDate: nullableString(row.appointment_date),
    appointmentTime: nullableString(row.appointment_time),
    appointmentLocation: nullableString(row.appointment_location),
    appointmentType: nullableString(row.appointment_type),
    source: nullableString(row.source),
    status: requiredString(row.status, "observed"),
    observedAt: nullableString(row.observed_at),
    metadataRedactedJson: toNullableJsonObject(row.metadata_redacted_json),
  };
}

function mapConfirmation(row: SupabaseObject): AppointmentConfirmation {
  return {
    id: requiredString(row.id),
    jobId: nullableString(row.job_id),
    applicationId: requiredString(row.application_id),
    userId: requiredString(row.user_id),
    countryCode: requiredString(row.country_code, "US"),
    visaType: requiredString(row.visa_type, "B1/B2"),
    appointmentDate: nullableString(row.appointment_date),
    appointmentTime: nullableString(row.appointment_time),
    appointmentLocation: nullableString(row.appointment_location),
    appointmentType: nullableString(row.appointment_type),
    confirmationNumber: nullableString(row.confirmation_number),
    confirmationPdfUrl: nullableString(row.confirmation_pdf_url),
    confirmationScreenshotUrl: nullableString(row.confirmation_screenshot_url),
    rawConfirmationRedactedJson: toNullableJsonObject(row.raw_confirmation_redacted_json),
    createdAt: nullableString(row.created_at),
  };
}

function mapStatusCheck(row: SupabaseObject): AppointmentStatusCheck {
  return {
    id: requiredString(row.id),
    jobId: nullableString(row.job_id),
    applicationId: requiredString(row.application_id),
    userId: requiredString(row.user_id),
    status: requiredString(row.status),
    checkedAt: nullableString(row.checked_at),
    resultRedactedJson: toNullableJsonObject(row.result_redacted_json),
    screenshotUrl: nullableString(row.screenshot_url),
    errorCode: nullableString(row.error_code),
    errorMessage: nullableString(row.error_message),
  };
}

function readNestedString(value: unknown, path: readonly string[]): string | null {
  let current = value;
  for (const segment of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return null;
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === "string" && current.trim() ? current.trim() : null;
}

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function readPostCityFromSimplifiedState(value: unknown): string | null {
  const parsed = parseJsonObject(value);
  if (!parsed) return null;
  return (
    readNestedString(parsed, ["travel", "embassyLocation"]) ??
    readNestedString(parsed, ["embassyLocation"]) ??
    readNestedString(parsed, ["ds160", "embassyLocation"]) ??
    readNestedString(parsed, ["application", "embassyLocation"])
  );
}

async function readDs160AppointmentPostCity(applicationId: string): Promise<string | null> {
  const fieldNames = [...DS160_APPOINTMENT_POST_FIELD_NAMES, SIMPLIFIED_FORM_STATE_KEY];
  const { data, error } = await getSupabaseClient()
    .from("visa_application_answers")
    .select("field_name, value_text, value_json")
    .eq("application_id", applicationId)
    .in("field_name", fieldNames);

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as SupabaseObject[];

  for (const fieldName of DS160_APPOINTMENT_POST_FIELD_NAMES) {
    const row = rows.find((candidate) => candidate.field_name === fieldName);
    const value = nullableString(row?.value_text) ?? nullableString(row?.value_json);
    if (value?.trim()) return value.trim();
  }

  const simplifiedState = rows.find((row) => row.field_name === SIMPLIFIED_FORM_STATE_KEY);
  return readPostCityFromSimplifiedState(
    simplifiedState?.value_json ?? simplifiedState?.value_text,
  );
}

export class SupabaseUSAppointmentRepository implements USAppointmentRepository {
  async getApplicationContext(applicationId: string): Promise<USAppointmentApplication | null> {
    const [{ data, error }, ds160AppointmentPostCity] = await Promise.all([
      getSupabaseClient()
      .from("applications")
      .select(
        "id, applicant_id, country, visa_type, status, payment_status, packet_status, automation_status, confirmation_number, ds160_application_id, ds160_retrieval_url, appointment_assistance_status, applicant_profiles!inner(auth_user_id)",
      )
      .eq("id", applicationId)
        .maybeSingle(),
      readDs160AppointmentPostCity(applicationId),
    ]);

    if (error) throw new Error(error.message);
    if (!data) return null;
    const row = data as SupabaseObject;
    const country = requiredString(row.country, "united_states");
    return {
      id: requiredString(row.id),
      applicantId: requiredString(row.applicant_id),
      userId: readProfileAuthUserId(row.applicant_profiles) ?? "",
      country,
      countryCode: resolveCountryCode(country),
      visaType: nullableString(row.visa_type),
      status: requiredString(row.status),
      paymentStatus: nullableString(row.payment_status),
      packetStatus: nullableString(row.packet_status),
      automationStatus: nullableString(row.automation_status),
      confirmationNumber: nullableString(row.confirmation_number),
      ds160ApplicationId: nullableString(row.ds160_application_id),
      ds160RetrievalUrl: nullableString(row.ds160_retrieval_url),
      ds160AppointmentPostCity,
      appointmentAssistanceStatus: nullableString(row.appointment_assistance_status),
    };
  }

  async findConsentByIdempotencyKey(idempotencyKey: string): Promise<AppointmentManualAction | null> {
    const { data, error } = await getSupabaseClient()
      .from("appointment_manual_actions")
      .select("*")
      .eq("action_type", "consent")
      .eq("status", "completed")
      .contains("metadata_redacted_json", { idempotency_key: idempotencyKey })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? mapManualAction(data as SupabaseObject) : null;
  }

  async getLatestCompletedConsent(
    applicationId: string,
    userId: string,
  ): Promise<AppointmentManualAction | null> {
    const { data, error } = await getSupabaseClient()
      .from("appointment_manual_actions")
      .select("*")
      .eq("application_id", applicationId)
      .eq("user_id", userId)
      .eq("action_type", "consent")
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? mapManualAction(data as SupabaseObject) : null;
  }

  async insertAccount(input: InsertAppointmentAccountInput): Promise<AppointmentAccount> {
    const now = new Date().toISOString();
    const { data, error } = await getSupabaseClient()
      .from("appointment_accounts")
      .insert({
        user_id: input.userId,
        application_id: input.applicationId,
        country_code: "US",
        portal: input.portal,
        account_email: input.accountEmail,
        account_status: input.accountStatus,
        email_verified: input.emailVerified ?? false,
        metadata_redacted_json: input.metadataRedactedJson ?? {},
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();

    if (error || !data) throw new Error(error?.message ?? "appointment account insert failed");
    return mapAccount(data as SupabaseObject);
  }

  async updateAccount(
    accountId: string,
    patch: Partial<Pick<AppointmentAccount, "accountStatus" | "emailVerified" | "lastLoginAt" | "metadataRedactedJson">>,
  ): Promise<AppointmentAccount> {
    const { data, error } = await getSupabaseClient()
      .from("appointment_accounts")
      .update({
        account_status: patch.accountStatus,
        email_verified: patch.emailVerified,
        last_login_at: patch.lastLoginAt,
        metadata_redacted_json: patch.metadataRedactedJson,
        updated_at: new Date().toISOString(),
      })
      .eq("id", accountId)
      .select("*")
      .single();

    if (error || !data) throw new Error(error?.message ?? "appointment account update failed");
    return mapAccount(data as SupabaseObject);
  }

  async getAccount(accountId: string): Promise<AppointmentAccount | null> {
    const { data, error } = await getSupabaseClient()
      .from("appointment_accounts")
      .select("*")
      .eq("id", accountId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? mapAccount(data as SupabaseObject) : null;
  }

  async findJobByIdempotencyKey(idempotencyKey: string): Promise<AppointmentAssistanceJob | null> {
    const { data, error } = await getSupabaseClient()
      .from("appointment_assistance_jobs")
      .select("*")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (error) {
      if (isMissingAppointmentSchemaError(error)) return null;
      throw new Error(error.message);
    }
    return data ? mapJob(data as SupabaseObject) : null;
  }

  async getJob(jobId: string): Promise<AppointmentAssistanceJob | null> {
    const { data, error } = await getSupabaseClient()
      .from("appointment_assistance_jobs")
      .select("*")
      .eq("id", jobId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? mapJob(data as SupabaseObject) : null;
  }

  async getLatestJobForApplication(applicationId: string): Promise<AppointmentAssistanceJob | null> {
    const { data, error } = await getSupabaseClient()
      .from("appointment_assistance_jobs")
      .select("*")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? mapJob(data as SupabaseObject) : null;
  }

  async insertJob(input: InsertAppointmentJobInput): Promise<AppointmentAssistanceJob> {
    const now = new Date().toISOString();
    const { data, error } = await getSupabaseClient()
      .from("appointment_assistance_jobs")
      .insert({
        application_id: input.applicationId,
        user_id: input.userId,
        appointment_account_id: input.appointmentAccountId ?? null,
        country_code: input.countryCode,
        visa_type: input.visaType,
        ds160_confirmation_code: input.ds160ConfirmationCode,
        applying_country_code: input.applyingCountryCode,
        applying_post_city: input.applyingPostCity,
        scheduling_provider: input.schedulingProvider,
        status: input.status,
        mode: input.mode,
        user_preferences_json: input.userPreferencesJson,
        requires_user_action: input.requiresUserAction,
        current_manual_action: input.currentManualAction,
        idempotency_key: input.idempotencyKey,
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();

    if (error || !data) throw new Error(error?.message ?? "appointment job insert failed");
    return mapJob(data as SupabaseObject);
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
    const { data, error } = await getSupabaseClient()
      .from("appointment_assistance_jobs")
      .update({
        appointment_account_id: patch.appointmentAccountId,
        status: patch.status,
        requires_user_action: patch.requiresUserAction,
        current_manual_action: patch.currentManualAction,
        last_error_code: patch.lastErrorCode,
        last_error_message: patch.lastErrorMessage,
        scheduling_provider: patch.schedulingProvider,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId)
      .select("*")
      .single();

    if (error || !data) throw new Error(error?.message ?? "appointment job update failed");
    return mapJob(data as SupabaseObject);
  }

  async listAttempts(jobId: string): Promise<AppointmentAssistanceAttempt[]> {
    const { data, error } = await getSupabaseClient()
      .from("appointment_assistance_attempts")
      .select("*")
      .eq("job_id", jobId)
      .order("attempt_number", { ascending: true });

    if (error) throw new Error(error.message);
    return ((data ?? []) as SupabaseObject[]).map(mapAttempt);
  }

  async insertAttempt(input: InsertAppointmentAttemptInput): Promise<AppointmentAssistanceAttempt> {
    const { data, error } = await getSupabaseClient()
      .from("appointment_assistance_attempts")
      .insert({
        job_id: input.jobId,
        application_id: input.applicationId,
        attempt_number: input.attemptNumber,
        status: input.status,
        provider: input.provider,
        mode: input.mode,
        request_snapshot_redacted_json: input.requestSnapshotRedactedJson,
        started_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error || !data) throw new Error(error?.message ?? "appointment attempt insert failed");
    return mapAttempt(data as SupabaseObject);
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
    const { data, error } = await getSupabaseClient()
      .from("appointment_assistance_attempts")
      .update({
        status: patch.status,
        result_snapshot_redacted_json: patch.resultSnapshotRedactedJson,
        error_code: patch.errorCode,
        error_message: patch.errorMessage,
        screenshot_url: patch.screenshotUrl,
        trace_url: patch.traceUrl,
        video_url: patch.videoUrl,
        finished_at: patch.finishedAt,
      })
      .eq("id", attemptId)
      .select("*")
      .single();

    if (error || !data) throw new Error(error?.message ?? "appointment attempt update failed");
    return mapAttempt(data as SupabaseObject);
  }

  async insertManualAction(
    input: InsertAppointmentManualActionInput,
  ): Promise<AppointmentManualAction> {
    const { data, error } = await getSupabaseClient()
      .from("appointment_manual_actions")
      .insert({
        job_id: input.jobId,
        application_id: input.applicationId,
        user_id: input.userId,
        action_type: input.actionType,
        status: input.status ?? "pending",
        instruction: input.instruction,
        user_input_schema_json: input.userInputSchemaJson,
        user_input_redacted_json: input.userInputRedactedJson,
        screenshot_url: input.screenshotUrl,
        expires_at: input.expiresAt,
        completed_at: input.status === "completed" ? new Date().toISOString() : null,
        metadata_redacted_json: input.metadataRedactedJson,
        created_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error || !data) throw new Error(error?.message ?? "appointment manual action insert failed");
    return mapManualAction(data as SupabaseObject);
  }

  async getManualAction(actionId: string): Promise<AppointmentManualAction | null> {
    const { data, error } = await getSupabaseClient()
      .from("appointment_manual_actions")
      .select("*")
      .eq("id", actionId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? mapManualAction(data as SupabaseObject) : null;
  }

  async getLatestPendingManualAction(jobId: string): Promise<AppointmentManualAction | null> {
    const { data, error } = await getSupabaseClient()
      .from("appointment_manual_actions")
      .select("*")
      .eq("job_id", jobId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? mapManualAction(data as SupabaseObject) : null;
  }

  async listManualActions(jobId: string): Promise<AppointmentManualAction[]> {
    const { data, error } = await getSupabaseClient()
      .from("appointment_manual_actions")
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);
    return ((data ?? []) as SupabaseObject[]).map(mapManualAction);
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
    const { data, error } = await getSupabaseClient()
      .from("appointment_manual_actions")
      .update({
        status: patch.status,
        user_input_redacted_json: patch.userInputRedactedJson,
        completed_at: patch.completedAt,
        metadata_redacted_json: patch.metadataRedactedJson,
      })
      .eq("id", actionId)
      .select("*")
      .single();

    if (error || !data) throw new Error(error?.message ?? "appointment manual action update failed");
    return mapManualAction(data as SupabaseObject);
  }

  async insertSlots(input: InsertAppointmentSlotInput[]): Promise<AppointmentSlot[]> {
    if (input.length === 0) return [];
    const { data, error } = await getSupabaseClient()
      .from("appointment_slots")
      .insert(
        input.map((slot) => ({
          job_id: slot.jobId,
          application_id: slot.applicationId,
          appointment_date: slot.appointmentDate,
          appointment_time: slot.appointmentTime,
          appointment_location: slot.appointmentLocation,
          appointment_type: slot.appointmentType,
          source: slot.source,
          status: slot.status ?? "observed",
          metadata_redacted_json: slot.metadataRedactedJson,
          observed_at: new Date().toISOString(),
        })),
      )
      .select("*");

    if (error || !data) throw new Error(error?.message ?? "appointment slots insert failed");
    return (data as SupabaseObject[]).map(mapSlot);
  }

  async listSlots(jobId: string): Promise<AppointmentSlot[]> {
    const { data, error } = await getSupabaseClient()
      .from("appointment_slots")
      .select("*")
      .eq("job_id", jobId)
      .order("appointment_date", { ascending: true })
      .order("appointment_time", { ascending: true });

    if (error) throw new Error(error.message);
    return ((data ?? []) as SupabaseObject[]).map(mapSlot);
  }

  async getSlot(slotId: string): Promise<AppointmentSlot | null> {
    const { data, error } = await getSupabaseClient()
      .from("appointment_slots")
      .select("*")
      .eq("id", slotId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? mapSlot(data as SupabaseObject) : null;
  }

  async getSelectedSlot(jobId: string): Promise<AppointmentSlot | null> {
    const { data, error } = await getSupabaseClient()
      .from("appointment_slots")
      .select("*")
      .eq("job_id", jobId)
      .in("status", ["user_selected", "selected"])
      .order("observed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? mapSlot(data as SupabaseObject) : null;
  }

  async updateSlotStatus(slotId: string, status: string): Promise<AppointmentSlot> {
    const { data, error } = await getSupabaseClient()
      .from("appointment_slots")
      .update({ status })
      .eq("id", slotId)
      .select("*")
      .single();

    if (error || !data) throw new Error(error?.message ?? "appointment slot update failed");
    return mapSlot(data as SupabaseObject);
  }

  async markOtherSlotsExpired(jobId: string, selectedSlotId: string): Promise<void> {
    const { error } = await getSupabaseClient()
      .from("appointment_slots")
      .update({ status: "expired" })
      .eq("job_id", jobId)
      .neq("id", selectedSlotId)
      .eq("status", "observed");

    if (error) throw new Error(error.message);
  }

  async insertConfirmation(
    input: InsertAppointmentConfirmationInput,
  ): Promise<AppointmentConfirmation> {
    const { data, error } = await getSupabaseClient()
      .from("appointment_confirmations")
      .insert({
        job_id: input.jobId,
        application_id: input.applicationId,
        user_id: input.userId,
        country_code: input.countryCode,
        visa_type: input.visaType,
        appointment_date: input.appointmentDate,
        appointment_time: input.appointmentTime,
        appointment_location: input.appointmentLocation,
        appointment_type: input.appointmentType,
        confirmation_number: input.confirmationNumber,
        confirmation_pdf_url: input.confirmationPdfUrl,
        confirmation_screenshot_url: input.confirmationScreenshotUrl,
        raw_confirmation_redacted_json: input.rawConfirmationRedactedJson,
        created_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error || !data) throw new Error(error?.message ?? "appointment confirmation insert failed");
    return mapConfirmation(data as SupabaseObject);
  }

  async getConfirmationForJob(jobId: string): Promise<AppointmentConfirmation | null> {
    const { data, error } = await getSupabaseClient()
      .from("appointment_confirmations")
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? mapConfirmation(data as SupabaseObject) : null;
  }

  async getLatestStatusCheck(jobId: string): Promise<AppointmentStatusCheck | null> {
    const { data, error } = await getSupabaseClient()
      .from("appointment_status_checks")
      .select("*")
      .eq("job_id", jobId)
      .order("checked_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? mapStatusCheck(data as SupabaseObject) : null;
  }

  async insertStatusCheck(input: InsertStatusCheckInput): Promise<AppointmentStatusCheck> {
    const { data, error } = await getSupabaseClient()
      .from("appointment_status_checks")
      .insert({
        job_id: input.jobId,
        application_id: input.applicationId,
        user_id: input.userId,
        status: input.status,
        checked_at: new Date().toISOString(),
        result_redacted_json: input.resultRedactedJson,
        screenshot_url: input.screenshotUrl,
        error_code: input.errorCode,
        error_message: input.errorMessage,
      })
      .select("*")
      .single();

    if (error || !data) throw new Error(error?.message ?? "appointment status check insert failed");
    return mapStatusCheck(data as SupabaseObject);
  }

  async updateApplicationAppointmentState(
    applicationId: string,
    patch: {
      appointmentAssistanceStatus?: string;
      appointmentAssistanceJobId?: string | null;
      appointmentConfirmationId?: string | null;
    },
  ): Promise<void> {
    const { error } = await getSupabaseClient()
      .from("applications")
      .update({
        appointment_assistance_status: patch.appointmentAssistanceStatus,
        appointment_assistance_job_id: patch.appointmentAssistanceJobId,
        appointment_confirmation_id: patch.appointmentConfirmationId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", applicationId);

    if (error) throw new Error(error.message);
  }

  async addAuditEvent(input: InsertAppointmentAuditEventInput): Promise<void> {
    const { error } = await getSupabaseClient()
      .from("appointment_audit_events")
      .insert({
        job_id: input.jobId,
        application_id: input.applicationId,
        user_id: input.userId,
        event_type: input.eventType,
        event_message: input.eventMessage,
        metadata_redacted_json: input.metadataRedactedJson,
        created_at: new Date().toISOString(),
      });

    if (error) throw new Error(error.message);
  }
}
