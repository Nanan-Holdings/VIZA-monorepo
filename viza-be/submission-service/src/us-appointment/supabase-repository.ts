import { supabase } from "../supabase";
import type {
  AuditEventInsert,
  ConfirmationInsert,
  ManualActionInsert,
  SlotInsert,
  StatusCheckInsert,
  USAppointmentJobRow,
  USAppointmentRunnerRepository,
} from "./runner";

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
        "appointment_booked",
        "appointment_status_check_in_progress",
      ])
      .eq("requires_user_action", false)
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

  async insertConfirmation(input: ConfirmationInsert): Promise<void> {
    const { error } = await supabase.from("appointment_confirmations").insert(input);
    if (error) {
      throw new Error(`US appointment confirmation insert failed: ${error.message}`);
    }
  }

  async insertStatusCheck(input: StatusCheckInsert): Promise<void> {
    const { error } = await supabase.from("appointment_status_checks").insert(input);
    if (error) {
      throw new Error(`US appointment status check insert failed: ${error.message}`);
    }
  }
}

export function createUSAppointmentRunnerRepository(): USAppointmentRunnerRepository {
  return new SupabaseUSAppointmentRunnerRepository();
}
