import { supabase } from "../supabase";
import { decryptSecret } from "../secret-cipher";
import type {
  AppointmentAccountCredentials,
  AuditEventInsert,
  AppointmentSlotRow,
  ConfirmationInsert,
  ManualActionInsert,
  SlotInsert,
  StatusCheckInsert,
  USAppointmentJobRow,
  USAppointmentRunnerRepository,
} from "./runner";

function decryptOrPlaintext(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  if (value.split(":").length !== 4) return value;
  return decryptSecret(value);
}

function firstWord(value: string | null | undefined): string | null {
  const normalized = value?.trim().replace(/\s+/g, " ");
  return normalized ? normalized.split(" ")[0] ?? null : null;
}

function remainingWords(value: string | null | undefined): string | null {
  const normalized = value?.trim().replace(/\s+/g, " ");
  if (!normalized) return null;
  const parts = normalized.split(" ");
  return parts.length > 1 ? parts.slice(1).join(" ") : null;
}

export class SupabaseUSAppointmentRunnerRepository
  implements USAppointmentRunnerRepository
{
  async listCandidateJobs(limit: number): Promise<USAppointmentJobRow[]> {
    const { data, error } = await supabase
      .from("appointment_assistance_jobs")
      .select(
        "id, application_id, user_id, appointment_account_id, applying_country_code, applying_post_city, scheduling_provider, status, mode, user_preferences_json, requires_user_action, current_manual_action, updated_at",
      )
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
    const { data, error } = await supabase
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
    const { error } = await supabase.from("appointment_manual_actions").insert(input);
    if (error) {
      throw new Error(`US appointment manual action insert failed: ${error.message}`);
    }
  }

  async updateJobForManualAction(input: {
    jobId: string;
    status: string;
    currentManualAction: string;
  }): Promise<void> {
    const { error } = await supabase
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
    const { error } = await supabase.from("appointment_audit_events").insert(input);
    if (error) {
      throw new Error(`US appointment audit insert failed: ${error.message}`);
    }
  }

  async getAppointmentAccountCredentials(
    job: USAppointmentJobRow,
  ): Promise<AppointmentAccountCredentials | null> {
    let query = supabase
      .from("appointment_accounts")
      .select("account_email, encrypted_account_password, password_vault_ref")
      .eq("portal", "usvisascheduling")
      .limit(1);

    if (job.appointment_account_id) {
      query = query.eq("id", job.appointment_account_id);
    } else {
      query = query
        .eq("application_id", job.application_id)
        .eq("user_id", job.user_id);
    }

    const { data, error } = await query.maybeSingle();
    if (error) {
      throw new Error(`US appointment account lookup failed: ${error.message}`);
    }
    const email = typeof data?.account_email === "string"
      ? data.account_email.trim()
      : "";
    const password = decryptOrPlaintext(
      typeof data?.encrypted_account_password === "string"
        ? data.encrypted_account_password
        : null,
    );
    if (!email || !password) return null;

    const { data: application } = await supabase
      .from("applications")
      .select("applicant_id")
      .eq("id", job.application_id)
      .maybeSingle();
    const applicantId = typeof application?.applicant_id === "string"
      ? application.applicant_id
      : null;
    const { data: profile } = applicantId
      ? await supabase
        .from("applicant_profiles")
        .select("given_names_en, given_names, surname_en, surname, full_name_en, full_name")
        .eq("id", applicantId)
        .maybeSingle()
      : { data: null };

    const fullName = typeof profile?.full_name_en === "string"
      ? profile.full_name_en
      : typeof profile?.full_name === "string"
        ? profile.full_name
        : null;
    return {
      email,
      password,
      givenName:
        (typeof profile?.given_names_en === "string" && profile.given_names_en.trim())
        || (typeof profile?.given_names === "string" && profile.given_names.trim())
        || remainingWords(fullName)
        || "VIZA",
      surname:
        (typeof profile?.surname_en === "string" && profile.surname_en.trim())
        || (typeof profile?.surname === "string" && profile.surname.trim())
        || firstWord(fullName)
        || "APPLICANT",
    };
  }

  async updateJobStatus(input: {
    jobId: string;
    status: string;
    currentManualAction?: string | null;
    lastErrorCode?: string | null;
    lastErrorMessage?: string | null;
  }): Promise<void> {
    const { error } = await supabase
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
    const { error } = await supabase.from("appointment_slots").insert(input);
    if (error) {
      throw new Error(`US appointment slot insert failed: ${error.message}`);
    }
  }

  async getSelectedSlot(jobId: string): Promise<AppointmentSlotRow | null> {
    const { data, error } = await supabase
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

  async insertConfirmation(input: ConfirmationInsert): Promise<{ id: string | null }> {
    const { data, error } = await supabase
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
    const { error } = await supabase.from("appointment_status_checks").insert(input);
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
    const { error } = await supabase
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
