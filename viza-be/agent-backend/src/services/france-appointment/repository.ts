import { getSupabaseClient } from "../../db/supabase-client.js";
import type {
  FranceAppointmentAccount,
  FranceAppointmentApplication,
  FranceAppointmentConfirmation,
  FranceAppointmentJob,
  FranceAppointmentManualAction,
  FranceAppointmentRepository,
  FranceAppointmentSlot,
  JsonObject,
} from "./FranceAppointmentService.js";

type SupabaseObject = Record<string, unknown>;

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function requiredString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function requiredBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function toJsonObject(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as JsonObject;
}

function readProfileAuthUserId(value: unknown): string | null {
  if (Array.isArray(value)) return readProfileAuthUserId(value[0]);
  if (!value || typeof value !== "object") return null;
  return nullableString((value as SupabaseObject).auth_user_id);
}

function mapApplication(
  row: SupabaseObject,
  officialReferenceEncrypted: string | null,
): FranceAppointmentApplication {
  const country = nullableString(row.country);
  const profile = readProfileRow(row.applicant_profiles);
  const fullName = profileString(profile, "full_name", "full_name_en")
    ?? ([profileString(profile, "given_names", "given_names_en"), profileString(profile, "surname", "surname_en")]
      .filter(Boolean)
      .join(" ") || null);
  return {
    id: requiredString(row.id),
    userId: readProfileAuthUserId(row.applicant_profiles) ?? "",
    applicantId: requiredString(row.applicant_id),
    country,
    countryCode: country?.toLowerCase() === "france" ? "FR" : country?.slice(0, 2).toUpperCase() ?? null,
    visaType: nullableString(row.visa_type),
    officialReferenceEncrypted,
    appointmentAssistanceStatus: nullableString(row.appointment_assistance_status),
    profile: {
      fullName,
      surname: profileString(profile, "surname", "surname_en"),
      givenNames: profileString(profile, "given_names", "given_names_en"),
      dateOfBirth: profileString(profile, "date_of_birth"),
      nationality: profileString(profile, "nationality"),
      passportNumber: profileString(profile, "passport_number"),
      passportExpiryDate: profileString(profile, "passport_expiry_date"),
      phone: profileString(profile, "phone"),
      email: profileString(profile, "email"),
      address: profileString(profile, "address", "address_en"),
    },
  };
}

function mapJob(row: SupabaseObject): FranceAppointmentJob {
  const preferences = toJsonObject(row.user_preferences_json);
  return {
    id: requiredString(row.id),
    applicationId: requiredString(row.application_id),
    userId: requiredString(row.user_id),
    countryCode: "FR",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    applyingCountryCode: "CN",
    applyingPostCity: requiredString(row.applying_post_city),
    schedulingProvider: "tlscontact_cn_fr",
    appointmentAccountId: nullableString(row.appointment_account_id),
    status: requiredString(row.status, "appointment_failed"),
    mode: requiredString(row.mode, "dry_run") as FranceAppointmentJob["mode"],
    requiresUserAction: requiredBoolean(row.requires_user_action),
    currentManualAction: nullableString(row.current_manual_action),
    userPreferencesJson: preferences,
    lastSlotCheckAt: nullableString(row.last_slot_check_at) ?? nullableString(preferences.lastSlotCheckAt),
    paymentSessionStatus:
      (nullableString(preferences.paymentSessionStatus) as FranceAppointmentJob["paymentSessionStatus"] | null) ?? "required",
    paymentAuthorizationRedactedJson:
      preferences.paymentAuthorizationRedactedJson &&
      typeof preferences.paymentAuthorizationRedactedJson === "object" &&
      !Array.isArray(preferences.paymentAuthorizationRedactedJson)
        ? preferences.paymentAuthorizationRedactedJson as JsonObject
        : null,
    idempotencyKey: requiredString(row.idempotency_key),
    createdAt: nullableString(row.created_at),
    updatedAt: nullableString(row.updated_at),
  };
}

function readProfileRow(value: unknown): SupabaseObject {
  if (Array.isArray(value)) return readProfileRow(value[0]);
  if (!value || typeof value !== "object") return {};
  return value as SupabaseObject;
}

function profileString(row: SupabaseObject, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = nullableString(row[key]);
    if (value?.trim()) return value;
  }
  return null;
}

function maskAccountEmail(value: string | null): string | null {
  if (!value) return null;
  const at = value.indexOf("@");
  if (at <= 0) return "••••";
  return `${value.slice(0, 1)}•••@${value.slice(at + 1)}`;
}

function mapAccount(row: SupabaseObject): FranceAppointmentAccount {
  const metadata = toJsonObject(row.metadata_redacted_json);
  return {
    id: requiredString(row.id),
    applicationId: nullableString(row.application_id),
    accountEmail: maskAccountEmail(nullableString(row.account_email)),
    accountStatus: requiredString(row.account_status, "not_created"),
    emailVerified: requiredBoolean(row.email_verified),
    lastLoginAt: nullableString(row.last_login_at),
    referenceReady: metadata.referenceReady === true,
    metadataRedactedJson: metadata,
    updatedAt: nullableString(row.updated_at),
  };
}

function mapManualAction(row: SupabaseObject): FranceAppointmentManualAction {
  return {
    id: requiredString(row.id),
    applicationId: requiredString(row.application_id),
    userId: requiredString(row.user_id),
    jobId: nullableString(row.job_id),
    actionType: requiredString(row.action_type),
    status: requiredString(row.status, "pending") as FranceAppointmentManualAction["status"],
    instruction: nullableString(row.instruction),
    userInputRedactedJson: toJsonObject(row.user_input_redacted_json),
    metadataRedactedJson: toJsonObject(row.metadata_redacted_json),
    createdAt: nullableString(row.created_at),
    completedAt: nullableString(row.completed_at),
  };
}

function mapSlot(row: SupabaseObject): FranceAppointmentSlot {
  return {
    id: requiredString(row.id),
    jobId: requiredString(row.job_id),
    applicationId: requiredString(row.application_id),
    appointmentDate: requiredString(row.appointment_date),
    appointmentTime: requiredString(row.appointment_time),
    appointmentLocation: requiredString(row.appointment_location),
    appointmentType: requiredString(row.appointment_type),
    source: requiredString(row.source),
    status: requiredString(row.status, "observed"),
    observedAt: nullableString(row.observed_at),
    expiresAt: nullableString(row.expires_at),
    metadataRedactedJson: toJsonObject(row.metadata_redacted_json),
  };
}

function mapConfirmation(row: SupabaseObject): FranceAppointmentConfirmation {
  return {
    id: requiredString(row.id),
    jobId: requiredString(row.job_id),
    applicationId: requiredString(row.application_id),
    userId: requiredString(row.user_id),
    countryCode: "FR",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    appointmentDate: requiredString(row.appointment_date),
    appointmentTime: requiredString(row.appointment_time),
    appointmentLocation: requiredString(row.appointment_location),
    appointmentType: requiredString(row.appointment_type),
    confirmationNumber: nullableString(row.confirmation_number),
    confirmationPdfUrl: nullableString(row.confirmation_pdf_url),
    confirmationScreenshotUrl: nullableString(row.confirmation_screenshot_url),
    rawConfirmationRedactedJson: toJsonObject(row.raw_confirmation_redacted_json),
    createdAt: nullableString(row.created_at),
  };
}

async function readOfficialReference(applicationId: string): Promise<string | null> {
  const { data, error } = await getSupabaseClient()
    .from("submission_queue")
    .select("official_application_reference_encrypted")
    .eq("application_id", applicationId)
    .not("official_application_reference_encrypted", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return nullableString((data as SupabaseObject | null)?.official_application_reference_encrypted);
}

export class SupabaseFranceAppointmentRepository implements FranceAppointmentRepository {
  async getApplication(applicationId: string): Promise<FranceAppointmentApplication | null> {
    const [{ data, error }, officialReference] = await Promise.all([
      getSupabaseClient()
        .from("applications")
        .select("id, applicant_id, country, visa_type, appointment_assistance_status, applicant_profiles!inner(auth_user_id, full_name, full_name_en, surname, surname_en, given_names, given_names_en, date_of_birth, passport_number, passport_expiry_date, email, phone, nationality, address, address_en)")
        .eq("id", applicationId)
        .maybeSingle(),
      readOfficialReference(applicationId),
    ]);
    if (error) throw new Error(error.message);
    return data ? mapApplication(data as SupabaseObject, officialReference) : null;
  }

  async findConsent(applicationId: string, userId: string): Promise<FranceAppointmentManualAction | null> {
    const { data, error } = await getSupabaseClient()
      .from("appointment_manual_actions")
      .select("*")
      .eq("application_id", applicationId)
      .eq("user_id", userId)
      .eq("action_type", "france_tls_consent")
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapManualAction(data as SupabaseObject) : null;
  }

  async insertManualAction(input: Omit<FranceAppointmentManualAction, "id" | "createdAt">): Promise<FranceAppointmentManualAction> {
    const { data, error } = await getSupabaseClient()
      .from("appointment_manual_actions")
      .insert({
        application_id: input.applicationId,
        user_id: input.userId,
        job_id: input.jobId,
        action_type: input.actionType === "consent" ? "france_tls_consent" : input.actionType,
        status: input.status,
        instruction: input.instruction,
        user_input_redacted_json: input.userInputRedactedJson,
        metadata_redacted_json: input.metadataRedactedJson,
        completed_at: input.completedAt,
        created_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (error || !data) throw new Error(error?.message ?? "France manual action insert failed");
    return mapManualAction(data as SupabaseObject);
  }

  async listManualActions(jobId: string): Promise<FranceAppointmentManualAction[]> {
    const { data, error } = await getSupabaseClient()
      .from("appointment_manual_actions")
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return ((data ?? []) as SupabaseObject[]).map(mapManualAction);
  }

  async getLatestJob(applicationId: string): Promise<FranceAppointmentJob | null> {
    const { data, error } = await getSupabaseClient()
      .from("appointment_assistance_jobs")
      .select("*")
      .eq("application_id", applicationId)
      .eq("country_code", "FR")
      .eq("scheduling_provider", "tlscontact_cn_fr")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapJob(data as SupabaseObject) : null;
  }

  async getJob(jobId: string): Promise<FranceAppointmentJob | null> {
    const { data, error } = await getSupabaseClient()
      .from("appointment_assistance_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("country_code", "FR")
      .eq("scheduling_provider", "tlscontact_cn_fr")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapJob(data as SupabaseObject) : null;
  }

  async findJobByIdempotencyKey(idempotencyKey: string): Promise<FranceAppointmentJob | null> {
    const { data, error } = await getSupabaseClient()
      .from("appointment_assistance_jobs")
      .select("*")
      .eq("idempotency_key", idempotencyKey)
      .eq("country_code", "FR")
      .eq("scheduling_provider", "tlscontact_cn_fr")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapJob(data as SupabaseObject) : null;
  }

  async getAccountForApplication(applicationId: string): Promise<FranceAppointmentAccount | null> {
    const { data, error } = await getSupabaseClient()
      .from("appointment_accounts")
      .select("id,application_id,account_email,account_status,email_verified,last_login_at,updated_at")
      .eq("application_id", applicationId)
      .eq("country_code", "FR")
      .eq("portal", "tlscontact_cn_fr")
      .neq("account_status", "abandoned")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapAccount(data as SupabaseObject) : null;
  }

  async insertJob(input: Omit<FranceAppointmentJob, "id" | "createdAt" | "updatedAt">): Promise<FranceAppointmentJob> {
    const now = new Date().toISOString();
    const { data, error } = await getSupabaseClient()
      .from("appointment_assistance_jobs")
      .insert({
        application_id: input.applicationId,
        user_id: input.userId,
        country_code: input.countryCode,
        visa_type: input.visaType,
        ds160_confirmation_code: null,
        applying_country_code: input.applyingCountryCode,
        applying_post_city: input.applyingPostCity,
        scheduling_provider: input.schedulingProvider,
        appointment_account_id: input.appointmentAccountId,
        status: input.status,
        mode: input.mode,
        requires_user_action: input.requiresUserAction,
        current_manual_action: input.currentManualAction,
        last_slot_check_at: input.lastSlotCheckAt,
        user_preferences_json: {
          ...input.userPreferencesJson,
          lastSlotCheckAt: input.lastSlotCheckAt,
          paymentSessionStatus: input.paymentSessionStatus,
          paymentAuthorizationRedactedJson: input.paymentAuthorizationRedactedJson,
        },
        idempotency_key: input.idempotencyKey,
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();
    if (error || !data) throw new Error(error?.message ?? "France appointment job insert failed");
    return mapJob(data as SupabaseObject);
  }

  async updateJob(jobId: string, patch: Partial<FranceAppointmentJob>): Promise<FranceAppointmentJob> {
    const existing = await this.getJob(jobId);
    if (!existing) throw new Error("France appointment job not found");
    const preferences = {
      ...existing.userPreferencesJson,
      ...(patch.userPreferencesJson ?? {}),
      lastSlotCheckAt: patch.lastSlotCheckAt ?? existing.lastSlotCheckAt,
      paymentSessionStatus: patch.paymentSessionStatus ?? existing.paymentSessionStatus,
      paymentAuthorizationRedactedJson:
        patch.paymentAuthorizationRedactedJson ?? existing.paymentAuthorizationRedactedJson,
    };
    const { data, error } = await getSupabaseClient()
      .from("appointment_assistance_jobs")
      .update({
        appointment_account_id: patch.appointmentAccountId,
        status: patch.status,
        requires_user_action: patch.requiresUserAction,
        current_manual_action: patch.currentManualAction,
        last_slot_check_at: patch.lastSlotCheckAt,
        user_preferences_json: preferences,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId)
      .select("*")
      .single();
    if (error || !data) throw new Error(error?.message ?? "France appointment job update failed");
    return mapJob(data as SupabaseObject);
  }

  async replaceObservedSlots(
    jobId: string,
    slots: Omit<FranceAppointmentSlot, "id" | "jobId" | "applicationId" | "status" | "observedAt" | "expiresAt">[],
  ): Promise<FranceAppointmentSlot[]> {
    const job = await this.getJob(jobId);
    if (!job) throw new Error("France appointment job not found");
    const client = getSupabaseClient();
    const { error: deleteError } = await client
      .from("appointment_slots")
      .delete()
      .eq("job_id", jobId)
      .eq("status", "observed");
    if (deleteError) throw new Error(deleteError.message);
    if (slots.length === 0) return [];
    const observedAt = new Date().toISOString();
    const expiresAt = new Date(Date.parse(observedAt) + 10 * 60_000).toISOString();
    const { data, error } = await client
      .from("appointment_slots")
      .insert(slots.map((slot) => ({
        job_id: jobId,
        application_id: job.applicationId,
        appointment_date: slot.appointmentDate,
        appointment_time: slot.appointmentTime,
        appointment_location: slot.appointmentLocation,
        appointment_type: slot.appointmentType,
        source: slot.source,
        status: "observed",
        observed_at: observedAt,
        expires_at: expiresAt,
        metadata_redacted_json: slot.metadataRedactedJson,
      })))
      .select("*");
    if (error || !data) throw new Error(error?.message ?? "France appointment slot insert failed");
    return (data as SupabaseObject[]).map(mapSlot);
  }

  async listSlots(jobId: string): Promise<FranceAppointmentSlot[]> {
    const now = new Date().toISOString();
    const { data, error } = await getSupabaseClient()
      .from("appointment_slots")
      .select("*")
      .eq("job_id", jobId)
      .neq("status", "expired")
      .gt("expires_at", now)
      .order("appointment_date", { ascending: true })
      .order("appointment_time", { ascending: true });
    if (error) throw new Error(error.message);
    return ((data ?? []) as SupabaseObject[]).map(mapSlot);
  }

  async selectSlot(jobId: string, slotId: string): Promise<FranceAppointmentSlot | null> {
    const client = getSupabaseClient();
    const now = new Date().toISOString();
    const { data, error } = await client
      .from("appointment_slots")
      .update({ status: "user_selected" })
      .eq("id", slotId)
      .eq("job_id", jobId)
      .eq("status", "observed")
      .gt("expires_at", now)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const { error: expireError } = await client
      .from("appointment_slots")
      .update({ status: "expired" })
      .eq("job_id", jobId)
      .eq("status", "observed")
      .neq("id", slotId);
    if (expireError) throw new Error(expireError.message);
    return mapSlot(data as SupabaseObject);
  }

  async getSelectedSlot(jobId: string): Promise<FranceAppointmentSlot | null> {
    const now = new Date().toISOString();
    const { data, error } = await getSupabaseClient()
      .from("appointment_slots")
      .select("*")
      .eq("job_id", jobId)
      .eq("status", "user_selected")
      .gt("expires_at", now)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapSlot(data as SupabaseObject) : null;
  }

  async insertConfirmation(input: Omit<FranceAppointmentConfirmation, "id" | "createdAt">): Promise<FranceAppointmentConfirmation> {
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
    if (error || !data) throw new Error(error?.message ?? "France confirmation insert failed");
    return mapConfirmation(data as SupabaseObject);
  }

  async getConfirmation(jobId: string): Promise<FranceAppointmentConfirmation | null> {
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

  async updateApplicationAppointmentState(
    applicationId: string,
    patch: {
      appointmentAssistanceStatus?: string | null;
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
}
