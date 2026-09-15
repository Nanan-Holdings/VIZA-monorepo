import { supabase } from "../supabase";
import { decryptSecret } from "../secret-cipher";
import { inbox } from "../inbox/wait-for-message";
import { waitForUSAppointmentVerificationEmail } from "./inbox";
import { buildUSAppointmentApplicantDetails } from "./applicant-details-data";
import type { USAppointmentApplicantDetailsResult } from "./applicant-details-data";
import type {
  AppointmentAccountCredentials,
  AppointmentAccountRegistrationProof,
  AuditEventInsert,
  AppointmentSlotRow,
  ConfirmationInsert,
  ManualActionInsert,
  SlotInsert,
  StatusCheckInsert,
  AppointmentAccountRegistrationSubmission,
  USAppointmentJobRow,
  USAppointmentRunnerRepository,
} from "./runner";

function decryptStoredPassword(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  return decryptSecret(value);
}

const US_APPLICATION_COUNTRIES = new Set([
  "us",
  "usa",
  "united_states",
  "united-states",
  "united states",
]);

const APPLICANT_DETAILS_PROFILE_COLUMNS = [
  "id",
  "auth_user_id",
  "surname",
  "surname_en",
  "given_names",
  "given_names_en",
  "date_of_birth",
  "birth_country",
  "nationality",
  "passport_number",
  "passport_issue_date",
  "passport_expiry_date",
  "phone",
].join(", ");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeCountry(value: unknown): string {
  return typeof value === "string"
    ? value.trim().toLowerCase().replace(/\s+/g, " ")
    : "";
}

function readMobileCallingCode(job: USAppointmentJobRow): string | undefined {
  const preferences = job.user_preferences_json;
  if (!isRecord(preferences) || !isRecord(preferences.applicant_details)) {
    return undefined;
  }
  const value = preferences.applicant_details.mobile_phone_country_code;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function applicantDetailsLookupError(): Error {
  return new Error("US appointment applicant details lookup failed.");
}

export class SupabaseUSAppointmentRunnerRepository
  implements USAppointmentRunnerRepository
{
  constructor(private readonly db = supabase) {}

  private readonly jobSelect =
    "id, application_id, user_id, appointment_account_id, applying_country_code, applying_post_city, scheduling_provider, status, mode, user_preferences_json, requires_user_action, current_manual_action, updated_at";

  async getJob(jobId: string): Promise<USAppointmentJobRow | null> {
    const { data, error } = await this.db
      .from("appointment_assistance_jobs")
      .select(this.jobSelect)
      .eq("id", jobId)
      .maybeSingle();
    if (error) throw new Error(`US appointment job lookup failed: ${error.message}`);
    return (data ?? null) as USAppointmentJobRow | null;
  }

  async getLatestJobForApplication(applicationId: string): Promise<USAppointmentJobRow | null> {
    const { data, error } = await this.db
      .from("appointment_assistance_jobs")
      .select(this.jobSelect)
      .eq("application_id", applicationId)
      .eq("scheduling_provider", "usvisascheduling")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`US appointment application job lookup failed: ${error.message}`);
    return (data ?? null) as USAppointmentJobRow | null;
  }

  async listCandidateJobs(limit: number): Promise<USAppointmentJobRow[]> {
    const { data, error } = await this.db
      .from("appointment_assistance_jobs")
      .select(this.jobSelect)
      .eq("mode", "assisted_live")
      .in("status", [
        "appointment_consent_received",
        "appointment_account_required",
        "appointment_login_required",
        "appointment_payment_completed",
        "appointment_no_slots_available",
        "appointment_booked",
        "appointment_status_check_in_progress",
      ])
      .or("requires_user_action.eq.false,current_manual_action.in.(login,account_email_verification)")
      .order("updated_at", { ascending: true })
      .limit(limit);
    if (error) {
      throw new Error(`US appointment runner job poll failed: ${error.message}`);
    }
    return (data ?? []) as USAppointmentJobRow[];
  }

  async hasPendingManualAction(jobId: string): Promise<boolean> {
    const { data, error } = await this.db
      .from("appointment_manual_actions")
      .select("id")
      .eq("job_id", jobId)
      .eq("status", "pending")
      .limit(1);
    if (error) {
      throw new Error(`US appointment pending action check failed: ${error.message}`);
    }
    return (data ?? []).length > 0;
  }

  async insertManualAction(input: ManualActionInsert): Promise<void> {
    const { error } = await this.db.from("appointment_manual_actions").insert(input);
    if (error) {
      throw new Error(`US appointment manual action insert failed: ${error.message}`);
    }
  }

  async updateJobForManualAction(input: {
    jobId: string;
    status: string;
    currentManualAction: string;
  }): Promise<void> {
    const { error } = await this.db
      .from("appointment_assistance_jobs")
      .update({
        status: input.status,
        requires_user_action: true,
        current_manual_action: input.currentManualAction,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.jobId);
    if (error) {
      throw new Error(`US appointment job update failed: ${error.message}`);
    }
  }

  async insertAuditEvent(input: AuditEventInsert): Promise<void> {
    const { error } = await this.db.from("appointment_audit_events").insert(input);
    if (error) {
      throw new Error(`US appointment audit insert failed: ${error.message}`);
    }
  }

  async getAppointmentAccountCredentials(
    job: USAppointmentJobRow,
  ): Promise<AppointmentAccountCredentials | null> {
    if (!job.appointment_account_id) return null;
    const query = this.db
      .from("appointment_accounts")
      .select("account_email, encrypted_account_password, account_status, email_verified")
      .eq("portal", "usvisascheduling")
      .eq("application_id", job.application_id)
      .eq("user_id", job.user_id)
      .eq("id", job.appointment_account_id)
      .limit(1);

    const { data, error } = await query.maybeSingle();
    if (error) {
      throw new Error(`US appointment account lookup failed: ${error.message}`);
    }
    const email = typeof data?.account_email === "string"
      ? data.account_email.trim()
      : "";
    const password = decryptStoredPassword(
      typeof data?.encrypted_account_password === "string"
        ? data.encrypted_account_password
        : null,
    );
    if (!email || !password) return null;

    const { data: application } = await this.db
      .from("applications")
      .select("applicant_id")
      .eq("id", job.application_id)
      .maybeSingle();
    const applicantId = typeof application?.applicant_id === "string"
      ? application.applicant_id
      : null;
    const { data: profile } = applicantId
      ? await this.db
        .from("applicant_profiles")
        .select("given_names_en, given_names, surname_en, surname")
        .eq("id", applicantId)
        .maybeSingle()
      : { data: null };

    return {
      email,
      password,
      accountStatus: typeof data?.account_status === "string" ? data.account_status : null,
      emailVerified: data?.email_verified === true,
      givenName:
        (typeof profile?.given_names_en === "string" && profile.given_names_en.trim())
        || (typeof profile?.given_names === "string" && profile.given_names.trim())
        || null,
      surname:
        (typeof profile?.surname_en === "string" && profile.surname_en.trim())
        || (typeof profile?.surname === "string" && profile.surname.trim())
        || null,
    };
  }

  async getAppointmentApplicantDetails(
    job: USAppointmentJobRow,
  ): Promise<USAppointmentApplicantDetailsResult> {
    if (
      !job.appointment_account_id
      || job.scheduling_provider?.trim().toLowerCase() !== "usvisascheduling"
    ) {
      throw applicantDetailsLookupError();
    }

    const { data: accountData, error: accountError } = await this.db
      .from("appointment_accounts")
      .select("account_email, account_status, email_verified")
      .eq("portal", "usvisascheduling")
      .eq("id", job.appointment_account_id)
      .eq("application_id", job.application_id)
      .eq("user_id", job.user_id)
      .eq("account_status", "active")
      .eq("email_verified", true)
      .limit(1)
      .maybeSingle();
    if (accountError || !isRecord(accountData)) {
      throw applicantDetailsLookupError();
    }
    const accountEmail = typeof accountData.account_email === "string"
      ? accountData.account_email.trim()
      : "";
    if (
      !accountEmail
      || accountData.account_status !== "active"
      || accountData.email_verified !== true
    ) {
      throw applicantDetailsLookupError();
    }

    const { data: applicationData, error: applicationError } = await this.db
      .from("applications")
      .select("applicant_id, country")
      .eq("id", job.application_id)
      .limit(1)
      .maybeSingle();
    if (applicationError || !isRecord(applicationData)) {
      throw applicantDetailsLookupError();
    }
    const applicantId = typeof applicationData.applicant_id === "string"
      ? applicationData.applicant_id.trim()
      : "";
    if (
      !applicantId
      || !US_APPLICATION_COUNTRIES.has(normalizeCountry(applicationData.country))
    ) {
      throw applicantDetailsLookupError();
    }

    const { data: profileData, error: profileError } = await this.db
      .from("applicant_profiles")
      .select(APPLICANT_DETAILS_PROFILE_COLUMNS)
      .eq("id", applicantId)
      .eq("auth_user_id", job.user_id)
      .limit(1)
      .maybeSingle();
    if (profileError || !isRecord(profileData)) {
      throw applicantDetailsLookupError();
    }
    if (profileData.auth_user_id !== job.user_id) {
      throw applicantDetailsLookupError();
    }

    const { data: answerData, error: answerError } = await this.db
      .from("visa_application_answers")
      .select("application_id, field_name, value_text, value_json")
      .eq("application_id", job.application_id)
      .order("updated_at", { ascending: false });
    if (answerError || !Array.isArray(answerData)) {
      throw applicantDetailsLookupError();
    }

    const answers: Record<string, unknown> = {};
    for (const candidate of answerData as unknown[]) {
      if (!isRecord(candidate)) continue;
      if (candidate.application_id !== job.application_id) continue;
      const fieldName = typeof candidate.field_name === "string"
        ? candidate.field_name.trim()
        : "";
      if (!fieldName || fieldName in answers) continue;
      if (candidate.value_json !== null && candidate.value_json !== undefined) {
        answers[fieldName] = candidate.value_json;
      } else if (candidate.value_text !== null && candidate.value_text !== undefined) {
        answers[fieldName] = candidate.value_text;
      }
    }

    try {
      return buildUSAppointmentApplicantDetails({
        profile: profileData,
        answers,
        accountEmail,
        mobileCallingCode: readMobileCallingCode(job),
      });
    } catch {
      throw applicantDetailsLookupError();
    }
  }

  async updateJobStatus(input: {
    jobId: string;
    status: string;
    currentManualAction?: string | null;
    lastErrorCode?: string | null;
    lastErrorMessage?: string | null;
  }): Promise<void> {
    const { error } = await this.db
      .from("appointment_assistance_jobs")
      .update({
        status: input.status,
        requires_user_action: Boolean(input.currentManualAction),
        current_manual_action: input.currentManualAction ?? null,
        last_error_code: input.lastErrorCode ?? null,
        last_error_message: input.lastErrorMessage ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.jobId);
    if (error) {
      throw new Error(`US appointment job status update failed: ${error.message}`);
    }
  }

  async insertSlots(input: SlotInsert[]): Promise<void> {
    if (input.length === 0) return;
    const { error } = await this.db.from("appointment_slots").insert(input);
    if (error) {
      throw new Error(`US appointment slot insert failed: ${error.message}`);
    }
  }

  async getSelectedSlot(jobId: string): Promise<AppointmentSlotRow | null> {
    const { data, error } = await this.db
      .from("appointment_slots")
      .select("id, job_id, appointment_date, appointment_time, appointment_location, appointment_type, metadata_redacted_json")
      .eq("job_id", jobId)
      .in("status", ["user_selected", "selected"])
      .order("observed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      throw new Error(`US appointment selected slot lookup failed: ${error.message}`);
    }
    return (data ?? null) as AppointmentSlotRow | null;
  }

  async hasCompletedFinalApproval(jobId: string): Promise<boolean> {
    const { data, error } = await this.db
      .from("appointment_manual_actions")
      .select("id")
      .eq("job_id", jobId)
      .eq("action_type", "final_confirmation")
      .eq("status", "completed")
      .limit(1);
    if (error) throw new Error(`US appointment final approval lookup failed: ${error.message}`);
    return Boolean(data?.length);
  }

  private async getAccountInboxBinding(job: USAppointmentJobRow): Promise<{
    applicationId: string; applicantId: string; accountId: string; portal: string;
  }> {
    if (!job.appointment_account_id) throw new Error("US appointment account binding is required for email verification.");
    const { data, error } = await this.db.from("applications").select("applicant_id")
      .eq("id", job.application_id).maybeSingle();
    if (error) throw new Error("US appointment applicant lookup failed.");
    if (typeof data?.applicant_id !== "string" || !data.applicant_id) {
      throw new Error("US appointment applicant is missing for alias email verification.");
    }
    return { applicationId: job.application_id, applicantId: data.applicant_id,
      accountId: job.appointment_account_id, portal: "usvisascheduling" };
  }

  async assertAccountRegistrationInboxRoutable(job: USAppointmentJobRow): Promise<void> {
    await inbox.assertAppointmentAccountInboxRoutable(await this.getAccountInboxBinding(job));
  }

  async waitForAccountVerificationEmail(
    job: USAppointmentJobRow,
    timeoutMs: number,
    request: { since: string; accountEmail: string },
  ): Promise<{ code: string | null; link: string | null }> {
    const { applicantId, accountId } = await this.getAccountInboxBinding(job);
    const verification = await waitForUSAppointmentVerificationEmail(applicantId, timeoutMs, {
      since: request.since,
      accountEmail: request.accountEmail,
      applicationId: job.application_id,
      accountId,
    });
    return { code: verification.code, link: verification.link };
  }

  async markAppointmentAccountVerified(
    job: USAppointmentJobRow,
    proof: AppointmentAccountRegistrationProof,
  ): Promise<void> {
    if (!job.appointment_account_id || proof.emailVerified !== true || proof.accountCreated !== true || !proof.accountEmail.trim()) {
      throw new Error("Official account creation evidence and an exact account binding are required.");
    }
    const query = this.db
      .from("appointment_accounts")
      .update({
        account_status: "active",
        email_verified: true,
        updated_at: new Date().toISOString(),
      })
      .eq("portal", "usvisascheduling")
      .eq("id", job.appointment_account_id)
      .eq("application_id", job.application_id)
      .eq("user_id", job.user_id)
      .eq("account_email", proof.accountEmail)
      .select("id")
      .maybeSingle();
    const { data, error } = await query;
    if (error) throw new Error(`US appointment account verification update failed: ${error.message}`);
    if (!data?.id) throw new Error("US appointment account verification update did not match the bound account.");
  }

  async markAppointmentAccountRegistrationSubmitted(
    job: USAppointmentJobRow,
    submission: AppointmentAccountRegistrationSubmission,
  ): Promise<void> {
    const accountEmail = submission.accountEmail.trim();
    if (!job.appointment_account_id || !accountEmail) {
      throw new Error("Official account submission evidence and an exact account binding are required.");
    }
    const query = this.db
      .from("appointment_accounts")
      .update({
        account_status: "registration_submitted",
        email_verified: false,
        updated_at: new Date().toISOString(),
      })
      .eq("portal", "usvisascheduling")
      .eq("id", job.appointment_account_id)
      .eq("application_id", job.application_id)
      .eq("user_id", job.user_id)
      .eq("account_email", accountEmail)
      .eq("email_verified", false)
      .in("account_status", ["account_creation_started", "registration_started", "verification_pending", "account_email_verification", "registration_submitted"])
      .select("id")
      .maybeSingle();
    const { data, error } = await query;
    if (error) throw new Error(`US appointment account submission update failed: ${error.message}`);
    if (!data?.id) throw new Error("US appointment account submission update did not match the bound account.");
  }

  async insertConfirmation(input: ConfirmationInsert): Promise<{ id: string | null }> {
    const { data, error } = await this.db
      .from("appointment_confirmations")
      .insert(input)
      .select("id")
      .single();
    if (error) {
      throw new Error(`US appointment confirmation insert failed: ${error.message}`);
    }
    return { id: typeof data?.id === "string" ? data.id : null };
  }

  async insertStatusCheck(input: StatusCheckInsert): Promise<void> {
    const { error } = await this.db.from("appointment_status_checks").insert(input);
    if (error) {
      throw new Error(`US appointment status check insert failed: ${error.message}`);
    }
  }

  async updateApplicationAppointmentState(input: {
    applicationId: string;
    status: string;
    jobId?: string | null;
    confirmationId?: string | null;
  }): Promise<void> {
    const { error } = await this.db
      .from("applications")
      .update({
        appointment_assistance_status: input.status,
        appointment_assistance_job_id: input.jobId ?? null,
        appointment_confirmation_id: input.confirmationId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.applicationId);
    if (error) {
      throw new Error(`US appointment application state update failed: ${error.message}`);
    }
  }
}

export function createUSAppointmentRunnerRepository(): USAppointmentRunnerRepository {
  return new SupabaseUSAppointmentRunnerRepository();
}
