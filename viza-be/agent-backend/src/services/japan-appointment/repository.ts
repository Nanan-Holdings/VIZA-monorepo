import { randomUUID } from "node:crypto";
import { getSupabaseClient } from "../../db/supabase-client.js";
import type {
  JapanAppointmentAccount,
  JapanAppointmentApplication,
  JapanAppointmentJob,
  JapanAppointmentManualAction,
  JapanAppointmentRepository,
  JsonObject,
} from "./JapanAppointmentService.js";

type Row = Record<string, unknown>;
const text = (value: unknown): string | null => typeof value === "string" ? value : null;
const object = (value: unknown): JsonObject => value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};

function mapJob(row: Row): JapanAppointmentJob {
  return {
    id: text(row.id) ?? "",
    applicationId: text(row.application_id) ?? "",
    userId: text(row.user_id) ?? "",
    status: text(row.status) ?? "appointment_failed",
    mode: "assisted_live",
    requiresUserAction: row.requires_user_action === true,
    currentManualAction: text(row.current_manual_action),
    userPreferencesJson: object(row.user_preferences_json),
    lastErrorCode: text(row.last_error_code),
    lastErrorMessage: text(row.last_error_message),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  };
}

function mapAccount(row: Row): JapanAppointmentAccount {
  return {
    id: text(row.id) ?? "",
    accountEmail: text(row.account_email) ? "[REDACTED]" : null,
    accountStatus: text(row.account_status) ?? "not_created",
    emailVerified: row.email_verified === true,
  };
}

function mapAction(row: Row): JapanAppointmentManualAction {
  return {
    id: text(row.id) ?? "",
    actionType: text(row.action_type) ?? "site_policy_review",
    status: text(row.status) ?? "pending",
    instruction: text(row.instruction),
    metadataRedactedJson: object(row.metadata_redacted_json),
    createdAt: text(row.created_at),
  };
}

export class SupabaseJapanAppointmentRepository implements JapanAppointmentRepository {
  async getApplication(applicationId: string): Promise<JapanAppointmentApplication | null> {
    const client = getSupabaseClient();
    const { data: app, error } = await client
      .from("applications")
      .select("id, applicant_id, country, visa_type, applicant_profiles!inner(auth_user_id, inbox_alias, full_name, date_of_birth, passport_number, passport_expiry_date, email, phone, nationality)")
      .eq("id", applicationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!app) return null;
    const appRow = app as Row;
    const profileJoin = Array.isArray(appRow.applicant_profiles) ? appRow.applicant_profiles[0] : appRow.applicant_profiles;
    const profileRow = object(profileJoin);
    const [{ data: answerRows, error: answerError }, { data: documentRows, error: documentError }] = await Promise.all([
      client.from("visa_application_answers").select("field_name, value_text").eq("application_id", applicationId),
      client.from("application_documents").select("document_type, storage_path").eq("application_id", applicationId),
    ]);
    if (answerError) throw new Error(answerError.message);
    if (documentError) throw new Error(documentError.message);
    const answers: Record<string, string> = {};
    for (const row of answerRows ?? []) if (row.value_text != null) answers[String(row.field_name)] = String(row.value_text);
    const profile: Record<string, string> = {};
    for (const [key, value] of Object.entries(profileRow)) if (typeof value === "string") profile[key] = value;
    const fullName = profile.full_name?.trim();
    if (fullName) {
      const parts = fullName.split(/\s+/);
      profile.surname = parts.at(-1) ?? "";
      profile.given_names = parts.slice(0, -1).join(" ") || fullName;
    }
    return {
      id: text(appRow.id) ?? "",
      applicantId: text(appRow.applicant_id) ?? "",
      userId: text(profileRow.auth_user_id) ?? "",
      country: text(appRow.country),
      visaType: text(appRow.visa_type),
      inboxAlias: text(profileRow.inbox_alias),
      answers,
      profile,
      documentTypes: (documentRows ?? []).filter((row) => Boolean(row.storage_path)).map((row) => String(row.document_type)),
    };
  }

  async ensureAlias(applicantId: string): Promise<string> {
    const client = getSupabaseClient();
    const { data: existing, error } = await client.from("applicant_profiles").select("inbox_alias").eq("id", applicantId).maybeSingle();
    if (error) throw new Error(error.message);
    if (existing?.inbox_alias) return String(existing.inbox_alias);
    const domain = process.env.APPLICANT_INBOX_ALIAS_DOMAIN?.trim() || "haggstorm.com";
    const alias = `appl-${randomUUID().replace(/-/g, "")}@${domain}`.toLowerCase();
    const { data, error: updateError } = await client.from("applicant_profiles")
      .update({ inbox_alias: alias }).eq("id", applicantId).is("inbox_alias", null).select("inbox_alias").maybeSingle();
    if (updateError) throw new Error(updateError.message);
    if (data?.inbox_alias) return String(data.inbox_alias);
    const { data: raced } = await client.from("applicant_profiles").select("inbox_alias").eq("id", applicantId).single();
    if (!raced?.inbox_alias) throw new Error("Japan appointment alias could not be prepared.");
    return String(raced.inbox_alias);
  }

  async findConsent(applicationId: string, userId: string) {
    const { data, error } = await getSupabaseClient().from("appointment_manual_actions").select("*")
      .eq("application_id", applicationId).eq("user_id", userId).eq("action_type", "japan_vfs_sg_consent")
      .eq("status", "completed").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapAction(data as Row) : null;
  }

  async insertConsent(applicationId: string, userId: string, snapshot: JsonObject) {
    const { data, error } = await getSupabaseClient().from("appointment_manual_actions").insert({
      application_id: applicationId, user_id: userId, job_id: null, action_type: "japan_vfs_sg_consent",
      status: "completed", instruction: "User consented to Japan VFS Singapore appointment preparation.",
      user_input_redacted_json: snapshot, metadata_redacted_json: { version: "2026-07-japan-vfs-sg-v1" },
      completed_at: new Date().toISOString(), created_at: new Date().toISOString(),
    }).select("*").single();
    if (error || !data) throw new Error(error?.message ?? "Japan consent insert failed");
    return mapAction(data as Row);
  }

  async getLatestJob(applicationId: string) {
    const { data, error } = await getSupabaseClient().from("appointment_assistance_jobs").select("*")
      .eq("application_id", applicationId).eq("country_code", "JP").eq("scheduling_provider", "vfs_japan_sg")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapJob(data as Row) : null;
  }

  async getJob(jobId: string) {
    const { data, error } = await getSupabaseClient().from("appointment_assistance_jobs").select("*")
      .eq("id", jobId).eq("country_code", "JP").eq("scheduling_provider", "vfs_japan_sg").maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapJob(data as Row) : null;
  }

  async insertJob(input: { applicationId: string; userId: string; preferences: JsonObject; idempotencyKey: string }) {
    const now = new Date().toISOString();
    const { data, error } = await getSupabaseClient().from("appointment_assistance_jobs").insert({
      application_id: input.applicationId, user_id: input.userId, country_code: "JP", visa_type: "TEMPORARY_VISITOR",
      applying_country_code: "SG", applying_post_city: "Singapore", scheduling_provider: "vfs_japan_sg",
      status: "appointment_account_required", mode: "assisted_live", user_preferences_json: input.preferences,
      requires_user_action: false, current_manual_action: null, idempotency_key: input.idempotencyKey,
      created_at: now, updated_at: now,
    }).select("*").single();
    if (error || !data) throw new Error(error?.message ?? "Japan appointment job insert failed");
    return mapJob(data as Row);
  }

  async updateJob(jobId: string, patch: Partial<JapanAppointmentJob>) {
    const existing = await this.getJob(jobId);
    if (!existing) throw new Error("Japan appointment job not found");
    const { data, error } = await getSupabaseClient().from("appointment_assistance_jobs").update({
      status: patch.status, requires_user_action: patch.requiresUserAction,
      current_manual_action: patch.currentManualAction, last_error_code: patch.lastErrorCode,
      last_error_message: patch.lastErrorMessage,
      user_preferences_json: patch.userPreferencesJson ?? existing.userPreferencesJson,
      updated_at: new Date().toISOString(),
    }).eq("id", jobId).select("*").single();
    if (error || !data) throw new Error(error?.message ?? "Japan appointment job update failed");
    return mapJob(data as Row);
  }

  async ensureAccount(input: { applicationId: string; userId: string; alias: string }) {
    const existing = await this.getAccount(input.applicationId, input.userId);
    if (existing) return existing;
    const { data, error } = await getSupabaseClient().from("appointment_accounts").insert({
      application_id: input.applicationId, user_id: input.userId, country_code: "JP", portal: "vfs_japan_sg",
      account_email: input.alias, account_status: "alias_prepared", email_verified: false,
      metadata_redacted_json: { aliasPrepared: true },
    }).select("*").single();
    if (error || !data) throw new Error(error?.message ?? "Japan appointment account insert failed");
    return mapAccount(data as Row);
  }

  async getAccount(applicationId: string, userId: string) {
    const { data, error } = await getSupabaseClient().from("appointment_accounts").select("*")
      .eq("application_id", applicationId).eq("user_id", userId).eq("portal", "vfs_japan_sg")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapAccount(data as Row) : null;
  }

  async insertManualAction(input: { job: JapanAppointmentJob; actionType: string; instruction: string; metadata: JsonObject }) {
    await getSupabaseClient().from("appointment_manual_actions").update({ status: "expired" })
      .eq("job_id", input.job.id).eq("status", "pending");
    const { data, error } = await getSupabaseClient().from("appointment_manual_actions").insert({
      job_id: input.job.id, application_id: input.job.applicationId, user_id: input.job.userId,
      action_type: input.actionType, status: "pending", instruction: input.instruction,
      metadata_redacted_json: input.metadata, created_at: new Date().toISOString(),
    }).select("*").single();
    if (error || !data) throw new Error(error?.message ?? "Japan manual action insert failed");
    return mapAction(data as Row);
  }

  async getPendingManualAction(jobId: string) {
    const { data, error } = await getSupabaseClient().from("appointment_manual_actions").select("*")
      .eq("job_id", jobId).eq("status", "pending").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapAction(data as Row) : null;
  }

  async updateApplicationState(applicationId: string, status: string, jobId?: string) {
    const { error } = await getSupabaseClient().from("applications").update({
      appointment_assistance_status: status,
      ...(jobId ? { appointment_assistance_job_id: jobId } : {}),
      updated_at: new Date().toISOString(),
    }).eq("id", applicationId);
    if (error) throw new Error(error.message);
  }
}
