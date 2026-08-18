"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import { createAdminClient } from "@/lib/supabase/admin";

type Result = { success: true } | { success: false; error: string };

function refreshAppointments(applicationId?: string) {
  revalidatePath("/admin/cal-bookings");
  revalidatePath("/admin/work");
  if (applicationId) revalidatePath(`/admin/applications/${applicationId}`);
}

export async function updateAppointmentOperationCase(input: {
  jobId: string;
  operation: "claim" | "waiting_customer" | "resolve" | "reopen";
  reason: string;
  nextAction?: string;
  resolutionCode?: string;
}): Promise<Result> {
  try {
    const actor = await requireRole("admin", "staff");
    if (input.reason.trim().length < 5 && input.operation !== "claim") return { success: false, error: "An operational reason is required" };
    const admin = createAdminClient();
    const { data: job } = await admin.from("appointment_assistance_jobs").select("id, application_id, status, requires_user_action").eq("id", input.jobId).maybeSingle();
    if (!job) return { success: false, error: "Appointment job not found" };
    const { data: before } = await admin.from("appointment_operation_cases").select("*").eq("appointment_job_id", input.jobId).maybeSingle();
    if (input.operation === "resolve") {
      const [{ count: pendingActions }, { count: confirmations }] = await Promise.all([
        admin.from("appointment_manual_actions").select("id", { count: "exact", head: true }).eq("job_id", input.jobId).in("status", ["pending", "in_progress"]),
        admin.from("appointment_confirmations").select("id", { count: "exact", head: true }).eq("job_id", input.jobId),
      ]);
      if ((pendingActions ?? 0) > 0 && (confirmations ?? 0) === 0) return { success: false, error: "Resolve the pending customer/manual action or capture official confirmation first" };
      if (!input.resolutionCode?.trim()) return { success: false, error: "A resolution code is required" };
    }
    const now = new Date().toISOString();
    const changes = input.operation === "claim"
      ? { status: "in_progress", assigned_to: actor.id, next_action: before?.next_action || "Review the persisted appointment stage", updated_at: now }
      : input.operation === "waiting_customer"
        ? { status: "waiting_customer", assigned_to: before?.assigned_to || actor.id, next_action: input.nextAction?.trim() || input.reason.trim(), updated_at: now }
        : input.operation === "resolve"
          ? { status: "resolved", assigned_to: before?.assigned_to || actor.id, resolution_code: input.resolutionCode?.trim(), resolution_notes: input.reason.trim(), next_action: null, updated_at: now }
          : { status: "open", assigned_to: actor.id, resolution_code: null, resolution_notes: null, next_action: input.nextAction?.trim() || input.reason.trim(), updated_at: now };
    const { error: auditError } = await admin.from("admin_command_events").insert({ actor_user_id: actor.id, command: `appointment_case.${input.operation}`, target_type: "appointment_assistance_jobs", target_id: input.jobId, reason: input.reason.trim() || "Claimed from appointment queue", before_state: before || { job_status: job.status }, after_state: changes });
    if (auditError) return { success: false, error: `Appointment command stopped because audit failed: ${auditError.message}` };
    const { error } = await admin.from("appointment_operation_cases").upsert({ appointment_job_id: input.jobId, ...changes }, { onConflict: "appointment_job_id" });
    if (error) return { success: false, error: error.message };
    refreshAppointments(job.application_id);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to update appointment case" };
  }
}

export async function expireOverdueAppointmentAction(input: { actionId: string; reason: string }): Promise<Result> {
  try {
    const actor = await requireRole("admin", "staff");
    if (input.reason.trim().length < 5) return { success: false, error: "An expiry reason is required" };
    const admin = createAdminClient();
    const { data: action } = await admin.from("appointment_manual_actions").select("*").eq("id", input.actionId).maybeSingle();
    if (!action) return { success: false, error: "Manual action not found" };
    if (!action.expires_at || new Date(action.expires_at) > new Date()) return { success: false, error: "Only an action past its persisted expiry can be expired" };
    if (!["pending", "in_progress"].includes(action.status)) return { success: false, error: `Action is already ${action.status}` };
    const now = new Date().toISOString();
    const { error: auditError } = await admin.from("admin_command_events").insert({ actor_user_id: actor.id, command: "appointment_action.expire", target_type: "appointment_manual_actions", target_id: input.actionId, reason: input.reason.trim(), before_state: { status: action.status, expires_at: action.expires_at, action_type: action.action_type }, after_state: { status: "expired", completed_at: now } });
    if (auditError) return { success: false, error: `Expiry stopped because audit failed: ${auditError.message}` };
    const { error } = await admin.from("appointment_manual_actions").update({ status: "expired", completed_at: now }).eq("id", input.actionId).in("status", ["pending", "in_progress"]);
    if (error) return { success: false, error: error.message };
    await admin.from("appointment_assistance_jobs").update({ requires_user_action: false, current_manual_action: null, updated_at: now }).eq("id", action.job_id).eq("current_manual_action", input.actionId);
    refreshAppointments(action.application_id);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to expire appointment action" };
  }
}

export async function recordOfficialAppointmentConfirmation(input: {
  jobId: string;
  confirmationNumber: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentLocation: string;
  evidenceUrl: string;
  reason: string;
}): Promise<Result> {
  try {
    const actor = await requireRole("admin");
    if (input.reason.trim().length < 5) return { success: false, error: "A capture reason is required" };
    if (!input.confirmationNumber.trim() || !input.appointmentDate || !input.appointmentTime || !input.appointmentLocation.trim() || !input.evidenceUrl.trim()) return { success: false, error: "Official reference, date, time, location, and evidence are required" };
    const admin = createAdminClient();
    const { data: job } = await admin.from("appointment_assistance_jobs").select("*").eq("id", input.jobId).maybeSingle();
    if (!job) return { success: false, error: "Appointment job not found" };
    if (job.mode === "dry_run") return { success: false, error: "Official confirmation cannot be captured for a dry-run job" };
    const { data: existing } = await admin.from("appointment_confirmations").select("id, confirmation_number").eq("job_id", input.jobId).maybeSingle();
    if (existing) return { success: false, error: `Confirmation already exists: ${existing.confirmation_number || existing.id}` };
    const safeAfter = { status: "appointment_booked", confirmation_reference_present: true, appointment_date: input.appointmentDate, appointment_time: input.appointmentTime, appointment_location: input.appointmentLocation, evidence_present: true };
    const { error: auditError } = await admin.from("admin_command_events").insert({ actor_user_id: actor.id, command: "appointment_confirmation.capture", target_type: "appointment_assistance_jobs", target_id: input.jobId, reason: input.reason.trim(), before_state: { status: job.status, mode: job.mode }, after_state: safeAfter, evidence_redacted: { reference: "official_confirmation_evidence" } });
    if (auditError) return { success: false, error: `Confirmation capture stopped because audit failed: ${auditError.message}` };
    const { data: confirmation, error } = await admin.from("appointment_confirmations").insert({ job_id: input.jobId, application_id: job.application_id, user_id: job.user_id, country_code: job.country_code, visa_type: job.visa_type, appointment_date: input.appointmentDate, appointment_time: input.appointmentTime, appointment_location: input.appointmentLocation.trim(), confirmation_number: input.confirmationNumber.trim(), confirmation_screenshot_url: input.evidenceUrl.trim(), raw_confirmation_redacted_json: { mode: job.mode, source: "admin_recovery_capture" } }).select("id").single();
    if (error || !confirmation) return { success: false, error: error?.message || "Confirmation was not saved" };
    const now = new Date().toISOString();
    await Promise.all([
      admin.from("appointment_assistance_jobs").update({ status: "appointment_booked", requires_user_action: false, current_manual_action: null, last_error_code: null, last_error_message: null, updated_at: now }).eq("id", input.jobId),
      admin.from("applications").update({ appointment_assistance_status: "appointment_booked", appointment_confirmation_id: confirmation.id, updated_at: now }).eq("id", job.application_id),
      admin.from("appointment_audit_events").insert({ job_id: input.jobId, application_id: job.application_id, user_id: job.user_id, event_type: "official_confirmation_recovered", event_message: "Official confirmation captured by admin recovery workflow", metadata_redacted_json: { confirmation_id: confirmation.id } }),
    ]);
    refreshAppointments(job.application_id);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to capture official appointment confirmation" };
  }
}
