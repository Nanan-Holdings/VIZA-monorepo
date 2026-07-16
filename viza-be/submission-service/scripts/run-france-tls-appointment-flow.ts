#!/usr/bin/env npx tsx
import "dotenv/config";
import { registerAndPrepareFranceTlsAccount } from "../src/france-tls/account-registration";
import {
  bookFranceTlsOfficialAppointment,
  probeFranceTlsOfficialPortal,
  type FranceTlsRunnerResult,
  type FranceTlsRunnerSlot,
} from "../src/france-tls/runner";
import { supabase } from "../src/supabase";

type AppointmentJob = {
  id: string;
  application_id: string;
  user_id: string;
  scheduling_provider: string | null;
  status: string;
  mode: string;
  user_preferences_json: Record<string, unknown> | null;
};

type AppointmentSlot = {
  id: string;
  appointment_date: string | null;
  appointment_time: string | null;
  appointment_location: string | null;
  appointment_type: string | null;
};

function readArg(name: string): string | null {
  const marker = `--${name}=`;
  const inline = process.argv.find((item) => item.startsWith(marker));
  if (inline) return inline.slice(marker.length).trim() || null;
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1]?.trim() || null : null;
}

function hasArg(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function loadJob(applicationId: string, jobId: string | null): Promise<AppointmentJob | null> {
  let query = supabase
    .from("appointment_assistance_jobs")
    .select("id, application_id, user_id, scheduling_provider, status, mode, user_preferences_json")
    .eq("application_id", applicationId)
    .eq("scheduling_provider", "tlscontact_cn_fr")
    .order("updated_at", { ascending: false })
    .limit(1);
  if (jobId) query = query.eq("id", jobId);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`France TLS job lookup failed: ${error.message}`);
  return (data ?? null) as AppointmentJob | null;
}

async function loadSelectedSlot(jobId: string): Promise<AppointmentSlot | null> {
  const { data, error } = await supabase
    .from("appointment_slots")
    .select("id, appointment_date, appointment_time, appointment_location, appointment_type")
    .eq("job_id", jobId)
    .in("status", ["user_selected", "selected"])
    .order("observed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`France TLS selected slot lookup failed: ${error.message}`);
  return (data ?? null) as AppointmentSlot | null;
}

async function hasFinalApproval(jobId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("appointment_manual_actions")
    .select("id")
    .eq("job_id", jobId)
    .eq("action_type", "final_confirmation")
    .eq("status", "completed")
    .limit(1);
  if (error) throw new Error(`France TLS final approval lookup failed: ${error.message}`);
  return Boolean(data?.length);
}

async function persistObservedSlots(
  job: AppointmentJob,
  slots: FranceTlsRunnerSlot[],
): Promise<void> {
  const { error: deleteError } = await supabase
    .from("appointment_slots")
    .delete()
    .eq("job_id", job.id)
    .eq("status", "observed");
  if (deleteError) throw new Error(`France TLS old slot cleanup failed: ${deleteError.message}`);
  if (slots.length > 0) {
    const { error: insertError } = await supabase.from("appointment_slots").insert(
      slots.map((slot) => ({
        job_id: job.id,
        application_id: job.application_id,
        appointment_date: slot.appointmentDate,
        appointment_time: slot.appointmentTime,
        appointment_location: slot.appointmentLocation,
        appointment_type: slot.appointmentType,
        source: slot.source,
        status: "observed",
        metadata_redacted_json: slot.metadataRedactedJson,
      })),
    );
    if (insertError) throw new Error(`France TLS slot persistence failed: ${insertError.message}`);
  }
  const nextStatus = slots.length > 0
    ? "appointment_slot_selection_required"
    : "appointment_no_slots_available";
  const now = new Date().toISOString();
  const { error: jobError } = await supabase
    .from("appointment_assistance_jobs")
    .update({
      status: nextStatus,
      requires_user_action: slots.length > 0,
      current_manual_action: slots.length > 0 ? "slot_selection" : null,
      last_slot_check_at: now,
      updated_at: now,
    })
    .eq("id", job.id);
  if (jobError) throw new Error(`France TLS job slot state update failed: ${jobError.message}`);
  await supabase
    .from("applications")
    .update({
      appointment_assistance_status: nextStatus,
      appointment_assistance_job_id: job.id,
      updated_at: now,
    })
    .eq("id", job.application_id);
}

async function persistBookingResult(
  job: AppointmentJob,
  slot: AppointmentSlot,
  result: FranceTlsRunnerResult,
): Promise<void> {
  const now = new Date().toISOString();
  if (result.confirmation?.confirmationNumber) {
    const { data: existing, error: existingError } = await supabase
      .from("appointment_confirmations")
      .select("id")
      .eq("job_id", job.id)
      .limit(1)
      .maybeSingle();
    if (existingError) throw new Error(`France TLS confirmation lookup failed: ${existingError.message}`);
    let confirmationId = typeof existing?.id === "string" ? existing.id : null;
    if (!confirmationId) {
      const { data, error } = await supabase
        .from("appointment_confirmations")
        .insert({
          job_id: job.id,
          application_id: job.application_id,
          user_id: job.user_id,
          country_code: "FR",
          visa_type: "EU_SCHENGEN_C_SHORT_STAY",
          appointment_date: slot.appointment_date,
          appointment_time: slot.appointment_time,
          appointment_location: slot.appointment_location,
          appointment_type: slot.appointment_type,
          confirmation_number: result.confirmation.confirmationNumber,
          confirmation_pdf_url: result.confirmation.receiptUrl ?? null,
          confirmation_screenshot_url: result.confirmation.screenshotUrl ?? null,
          raw_confirmation_redacted_json: {
            provider: "tlscontact_cn_fr",
            official_confirmation_verified: true,
            source: "run-france-tls-appointment-flow",
          },
        })
        .select("id")
        .single();
      if (error || !data?.id) {
        throw new Error(`France TLS confirmation persistence failed: ${error?.message ?? "missing id"}`);
      }
      confirmationId = data.id;
    }
    const { error: jobError } = await supabase
      .from("appointment_assistance_jobs")
      .update({
        status: "appointment_confirmation_captured",
        requires_user_action: false,
        current_manual_action: null,
        updated_at: now,
      })
      .eq("id", job.id);
    if (jobError) throw new Error(`France TLS confirmed job update failed: ${jobError.message}`);
    const { error: applicationError } = await supabase
      .from("applications")
      .update({
        appointment_assistance_status: "appointment_confirmation_captured",
        appointment_assistance_job_id: job.id,
        appointment_confirmation_id: confirmationId,
        updated_at: now,
      })
      .eq("id", job.application_id);
    if (applicationError) throw new Error(`France TLS application confirmation update failed: ${applicationError.message}`);
    return;
  }

  const checkpoint = result.checkpoint;
  const nextStatus = result.status === "payment_required"
    ? "appointment_payment_required"
    : "appointment_manual_required";
  const actionType = checkpoint?.type ?? "site_policy_review";
  const { error: jobError } = await supabase
    .from("appointment_assistance_jobs")
    .update({
      status: nextStatus,
      requires_user_action: true,
      current_manual_action: actionType,
      updated_at: now,
    })
    .eq("id", job.id);
  if (jobError) throw new Error(`France TLS checkpoint job update failed: ${jobError.message}`);
  const { error: actionError } = await supabase.from("appointment_manual_actions").insert({
    job_id: job.id,
    application_id: job.application_id,
    user_id: job.user_id,
    action_type: actionType,
    status: "pending",
    instruction: checkpoint?.message ?? "Review the TLScontact booking checkpoint.",
    metadata_redacted_json: checkpoint?.metadataRedactedJson ?? {},
  });
  if (actionError) throw new Error(`France TLS checkpoint persistence failed: ${actionError.message}`);
}

async function main(): Promise<void> {
  const applicationId = readArg("application-id");
  if (!applicationId) throw new Error("--application-id is required");
  const jobId = readArg("job-id");
  const centerCode = readArg("center") ?? "shanghai";
  const submitRegistration = hasArg("submit-registration");
  const bookApprovedSlot = hasArg("book-approved-slot");
  if (submitRegistration && process.env.FRANCE_TLS_ACCOUNT_REGISTRATION_ENABLED !== "true") {
    throw new Error("FRANCE_TLS_ACCOUNT_REGISTRATION_ENABLED=true is required for real account registration");
  }
  if (bookApprovedSlot && process.env.FRANCE_TLS_LIVE_BOOKING_ENABLED !== "true") {
    throw new Error("FRANCE_TLS_LIVE_BOOKING_ENABLED=true is required to click the official final booking control");
  }

  const account = await registerAndPrepareFranceTlsAccount({
    applicationId,
    centerCode,
    submitRegistration,
    fillOfficialReference: true,
    emailTimeoutMs: Number.parseInt(process.env.FRANCE_TLS_EMAIL_TIMEOUT_MS ?? "600000", 10),
    refreshRetries: 2,
  });
  console.log(JSON.stringify({ event: "account_prepared", result: account }, null, 2));
  if (!submitRegistration || !["appointment_reference_filled", "logged_in"].includes(account.status)) return;

  const job = await loadJob(applicationId, jobId);
  if (!job) {
    console.log(JSON.stringify({
      event: "flow_stopped",
      nextAction: "Create the France appointment job in the VIZA Portal, then rerun this command.",
    }, null, 2));
    return;
  }
  if (job.mode !== "assisted_live") throw new Error("The France appointment job is not assisted_live.");

  const selectedSlot = await loadSelectedSlot(job.id);
  if (!selectedSlot) {
    const observed = await probeFranceTlsOfficialPortal({ applicationId, jobId: job.id, centerCode });
    if (observed.status === "slots_observed") await persistObservedSlots(job, observed.slots ?? []);
    console.log(JSON.stringify({
      event: "slots_checked",
      status: observed.status,
      slotCount: observed.slots?.length ?? 0,
      checkpoint: observed.checkpoint ?? null,
      nextAction: observed.slots?.length
        ? "Select one slot in the VIZA Portal."
        : "The Fly worker can retry this checkpoint later.",
    }, null, 2));
    return;
  }

  if (!await hasFinalApproval(job.id)) {
    console.log(JSON.stringify({
      event: "flow_stopped",
      status: "appointment_final_confirmation_required",
      nextAction: "Approve the selected slot in the VIZA Portal. No official final button was clicked.",
    }, null, 2));
    return;
  }
  if (!bookApprovedSlot) {
    console.log(JSON.stringify({
      event: "flow_stopped",
      status: "appointment_final_confirmation_approved",
      nextAction: "Rerun with --book-approved-slot to click the official final booking control.",
    }, null, 2));
    return;
  }
  if (
    !selectedSlot.appointment_date
    || !selectedSlot.appointment_time
    || !selectedSlot.appointment_location
    || !selectedSlot.appointment_type
  ) {
    throw new Error("The selected France TLS slot is incomplete.");
  }

  const result = await bookFranceTlsOfficialAppointment({
    applicationId,
    jobId: job.id,
    centerCode,
    selectedSlot: {
      appointmentDate: selectedSlot.appointment_date,
      appointmentTime: selectedSlot.appointment_time,
      appointmentLocation: selectedSlot.appointment_location,
      appointmentType: selectedSlot.appointment_type,
    },
  });
  await persistBookingResult(job, selectedSlot, result);
  console.log(JSON.stringify({
    event: "booking_finished",
    status: result.status,
    confirmationCaptured: Boolean(result.confirmation?.confirmationNumber),
    checkpoint: result.checkpoint ?? null,
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({
    event: "france_tls_flow_failed",
    message: error instanceof Error ? error.message.split("\n")[0] : String(error),
  }, null, 2));
  process.exit(1);
});
