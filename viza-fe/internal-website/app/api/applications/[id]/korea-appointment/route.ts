import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getClientSessionWithFallback } from "@/lib/client-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveKvacCenter, type KvacRoutingInput } from "@/lib/korea-c39/kvac-routing";

type Action =
  | "start-slot-search"
  | "select-slot"
  | "confirm-booking"
  | "request-live-booking"
  | "submit-sms-code"
  | "approve-final-booking"
  | "complete-final-booking"
  | "refresh-status";

interface AppointmentJobRow {
  id: string;
  application_id: string;
  user_id: string;
  status: string;
  mode: string;
  scheduling_provider: string | null;
  user_preferences_json: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
}

interface AppointmentManualActionRow {
  id: string;
  job_id: string | null;
  action_type: string;
  status: string;
  instruction: string | null;
  expires_at: string | null;
  created_at: string | null;
  metadata_redacted_json?: Record<string, unknown> | null;
}

interface KoreaKvacStartSmsResponse {
  ok?: boolean;
  error?: string;
  status?: "sms_verification_required";
  officialSessionId?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  appointmentEndTime?: string;
  appointmentLocation?: string;
  phoneMasked?: string;
  expiresAtIso?: string;
  screenshotPath?: string | null;
  officialMessage?: string;
}

interface KoreaKvacSubmitSmsResponse {
  ok?: boolean;
  error?: string;
  status?: "appointment_slots_observed";
  officialSessionId?: string;
  slots?: Array<{
    id: string;
    appointment_date: string;
    appointment_time: string;
    appointment_location: string;
    appointment_type: string;
    source: string;
    status: string;
    metadata_redacted_json: Record<string, unknown>;
  }>;
  screenshotPath?: string | null;
}

interface KoreaKvacCompleteBookingResponse {
  ok?: boolean;
  error?: string;
  status?: "appointment_booked";
  officialSessionId?: string;
  confirmationNumber?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  appointmentLocation?: string;
  appointmentType?: string;
  screenshotPath?: string | null;
  confirmationPdfUrl?: string | null;
}

type ApplicationAuthResult =
  | { ok: false; response: Response }
  | {
      ok: true;
      admin: ReturnType<typeof createAdminClient>;
      profile: { id: string };
      application: { id: string; applicant_id: string; visa_type: string; country: string | null };
    };

async function requireApplication(applicationId: string): Promise<ApplicationAuthResult> {
  const admin = createAdminClient();
  const session = await getClientSessionWithFallback();
  if (!session) return { ok: false, response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };

  const { data: profile } = await admin
    .from("applicant_profiles")
    .select("id")
    .eq("id", session.userId)
    .maybeSingle();
  if (!profile) return { ok: false, response: NextResponse.json({ error: "Profile not found" }, { status: 404 }) };

  const { data: application, error } = await admin
    .from("applications")
    .select("id, applicant_id, visa_type, country")
    .eq("id", applicationId)
    .maybeSingle();
  if (error || !application) return { ok: false, response: NextResponse.json({ error: "Application not found" }, { status: 404 }) };
  if (application.applicant_id !== profile.id) return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  if (application.visa_type !== "KR_C39_SHORT_TERM_VISIT") {
    return { ok: false, response: NextResponse.json({ error: "Korea appointment only supports KR_C39_SHORT_TERM_VISIT" }, { status: 400 }) };
  }
  return { ok: true, admin, profile, application };
}

async function latestJob(admin: ReturnType<typeof createAdminClient>, applicationId: string) {
  const { data, error } = await admin
    .from("appointment_assistance_jobs")
    .select("*")
    .eq("application_id", applicationId)
    .eq("country_code", "KR")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as AppointmentJobRow | null;
}

async function readAnswerMap(admin: ReturnType<typeof createAdminClient>, applicationId: string) {
  const { data, error } = await admin
    .from("visa_application_answers")
    .select("field_name, value_text")
    .eq("application_id", applicationId);
  if (error) throw new Error(error.message);

  const answers: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row.field_name && row.value_text) answers[row.field_name] = row.value_text;
  }
  return answers;
}

function firstAnswer(answers: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = answers[key]?.trim();
    if (value) return value;
  }
  return null;
}

function parseBooleanAnswer(value: string | null) {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (["true", "yes", "y", "1", "有", "是", "available"].includes(normalized)) return true;
  if (["false", "no", "n", "0", "无", "否", "unavailable"].includes(normalized)) return false;
  return null;
}

async function readRoutingInput(
  admin: ReturnType<typeof createAdminClient>,
  applicationId: string,
  explicitInput?: KvacRoutingInput,
): Promise<KvacRoutingInput> {
  if (explicitInput && Object.values(explicitInput).some((value) => value !== undefined && value !== null && value !== "")) {
    return explicitInput;
  }

  const answers = await readAnswerMap(admin, applicationId);

  const currentResidenceProvince = firstAnswer(answers, [
    "current_residence_province",
    "residence_province",
    "residence_province_or_state",
    "residence_province_or_state_zh",
    "home_address_state_province",
    "address_province",
    "province",
  ]);
  const hukouProvince = firstAnswer(answers, [
    "hukou_province",
    "household_registration_province",
    "household_register_province",
    "domicile_province",
    "permanent_residence_province",
  ]);
  const hasResidenceProof = parseBooleanAnswer(firstAnswer(answers, [
    "has_residence_proof",
    "residence_proof_available",
    "current_residence_proof",
    "has_local_residence_permit",
  ]));

  return { currentResidenceProvince, hasResidenceProof, hukouProvince };
}

function submissionServiceBaseUrl() {
  return (process.env.KR_KVAC_SUBMISSION_SERVICE_URL ?? process.env.SUBMISSION_SERVICE_LOCAL_URL ?? "http://127.0.0.1:8080").replace(/\/$/u, "");
}

async function postSubmissionService<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const url = `${submissionServiceBaseUrl()}${path}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok || !payload) {
    throw new Error(
      payload?.error
        ? `Submission service ${url} failed (${response.status}): ${payload.error}`
        : `Submission service ${url} failed (${response.status})`,
    );
  }
  if (payload.error) throw new Error(`Submission service ${url} returned error: ${payload.error}`);
  return payload as T;
}

function applicantNameForOfficial(answers: Record<string, string>) {
  const fullName = firstAnswer(answers, ["full_name_en", "full_name", "applicant_name", "booker_name"]);
  if (fullName) return fullName;
  return [firstAnswer(answers, ["family_name", "surname"]), firstAnswer(answers, ["given_names", "given_name"])]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function mobilePhoneForOfficial(answers: Record<string, string>) {
  return firstAnswer(answers, ["mobile_phone", "phone", "phone_number", "primary_phone_number", "booker_phone"]) ?? "";
}

async function readSnapshot(admin: ReturnType<typeof createAdminClient>, applicationId: string, routingInput?: KvacRoutingInput) {
  const job = await latestJob(admin, applicationId);
  const routing = resolveKvacCenter(await readRoutingInput(admin, applicationId, routingInput));
  if (!job) return { routing, job: null, slots: [], confirmation: null, manualAction: null };

  const [
    { data: slots, error: slotsErr },
    { data: confirmation, error: confirmationErr },
    { data: manualAction, error: manualActionErr },
  ] = await Promise.all([
    admin
      .from("appointment_slots")
      .select("*")
      .eq("job_id", job.id)
      .order("appointment_date", { ascending: true })
      .order("appointment_time", { ascending: true }),
    admin
      .from("appointment_confirmations")
      .select("*")
      .eq("job_id", job.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("appointment_manual_actions")
      .select("id, job_id, action_type, status, instruction, expires_at, created_at, metadata_redacted_json")
      .eq("job_id", job.id)
      .in("status", ["pending", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (slotsErr) throw new Error(slotsErr.message);
  if (confirmationErr) throw new Error(confirmationErr.message);
  if (manualActionErr) throw new Error(manualActionErr.message);
  return { routing, job, slots: slots ?? [], confirmation: confirmation ?? null, manualAction: (manualAction as AppointmentManualActionRow | null) ?? null };
}

function dryRunSlots(centerCode: string) {
  const base = centerCode || "beijing";
  return [
    {
      appointment_date: "2026-09-08",
      appointment_time: "09:30",
      appointment_location: `KVAC ${base}`,
      appointment_type: "C-3-9 document intake",
      source: "dry_run",
      status: "observed",
      metadata_redacted_json: { centerCode: base },
    },
    {
      appointment_date: "2026-09-09",
      appointment_time: "14:00",
      appointment_location: `KVAC ${base}`,
      appointment_type: "C-3-9 document intake",
      source: "dry_run",
      status: "observed",
      metadata_redacted_json: { centerCode: base },
    },
  ];
}

async function ensureKoreaJob(
  admin: ReturnType<typeof createAdminClient>,
  applicationId: string,
  userId: string,
  routing: ReturnType<typeof resolveKvacCenter>,
  mode: "dry_run" | "live_assisted",
) {
  let job = await latestJob(admin, applicationId);
  if (job) {
    if (mode === "live_assisted" && job.mode !== "live_assisted") {
      const { data, error } = await admin
        .from("appointment_assistance_jobs")
        .update({
          mode: "live_assisted",
          status: "sms_verification_required",
          requires_user_action: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id)
        .select("*")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Could not upgrade Korea appointment job.");
      job = data as AppointmentJobRow;
      await admin.from("applications").update({
        appointment_assistance_status: "sms_verification_required",
        appointment_assistance_job_id: job.id,
      }).eq("id", applicationId);
    }
    return job;
  }

  const { data, error } = await admin
    .from("appointment_assistance_jobs")
    .insert({
      application_id: applicationId,
      user_id: userId,
      country_code: "KR",
      visa_type: "KR_C39_SHORT_TERM_VISIT",
      applying_country_code: "CN",
      applying_post_city: routing.recommended.nameEn,
      scheduling_provider: "kvac_cn",
      status: mode === "live_assisted" ? "sms_verification_required" : "appointment_slots_observed",
      mode,
      user_preferences_json: {
        routing,
        centerCode: routing.recommended.code,
        finalConfirmationRequired: true,
        source: "korea_c39_v1",
      },
      requires_user_action: mode === "live_assisted",
      idempotency_key: `korea-kvac:${applicationId}:${randomUUID()}`,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not create Korea appointment job.");

  await admin.from("applications").update({
    appointment_assistance_status: mode === "live_assisted" ? "sms_verification_required" : "appointment_slots_observed",
    appointment_assistance_job_id: data.id,
  }).eq("id", applicationId);

  return data as AppointmentJobRow;
}

function manualCheckpointForCenter(routing: ReturnType<typeof resolveKvacCenter>) {
  const center = routing.recommended;
  const isGuidanceOnly = center.liveBookingMode === "official_guidance_only" || !center.bookingUrl;
  return {
    actionType: isGuidanceOnly ? "official_guidance_required" : "official_center_manual_checkpoint",
    status: isGuidanceOnly ? "official_guidance_required" : "official_center_manual_checkpoint",
    instruction: isGuidanceOnly
      ? "This Korea filing channel has no confirmed unified online appointment portal. Show the official consulate guidance and designated filing-channel notes instead of claiming automatic booking."
      : "This Korea center's official entry is reachable, but its live booking flow is center-specific. Continue from the official entry and pause at account, SMS, real-name, queue, payment-like, or final-submit gates.",
    metadata: {
      centerCode: center.code,
      centerNameEn: center.nameEn,
      centerNameZh: center.nameZh,
      liveBookingMode: center.liveBookingMode,
      serviceMode: center.serviceMode,
      officialUrl: center.officialUrl,
      bookingUrl: center.bookingUrl,
      appointmentRuleZh: center.appointmentRuleZh,
      appointmentRuleEn: center.appointmentRuleEn,
      liveBookingRuleZh: center.liveBookingRuleZh,
      liveBookingRuleEn: center.liveBookingRuleEn,
      sourceUrls: center.sourceUrls,
      nextStep: isGuidanceOnly ? "show_official_guidance" : "continue_official_center_checkpoint",
    },
  };
}

async function createOrReuseCenterCheckpoint(
  admin: ReturnType<typeof createAdminClient>,
  applicationId: string,
  userId: string,
  job: AppointmentJobRow,
  routing: ReturnType<typeof resolveKvacCenter>,
) {
  const checkpoint = manualCheckpointForCenter(routing);
  const { data: existingManualAction, error: existingManualErr } = await admin
    .from("appointment_manual_actions")
    .select("id")
    .eq("job_id", job.id)
    .eq("action_type", checkpoint.actionType)
    .in("status", ["pending", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingManualErr) throw new Error(existingManualErr.message);

  const manualActionId = existingManualAction?.id ?? await (async () => {
    const { data: manualAction, error: manualErr } = await admin
      .from("appointment_manual_actions")
      .insert({
        job_id: job.id,
        application_id: applicationId,
        user_id: userId,
        action_type: checkpoint.actionType,
        status: "pending",
        instruction: checkpoint.instruction,
        user_input_schema_json: {
          type: "object",
          properties: {
            acknowledged: { type: "boolean" },
          },
        },
        metadata_redacted_json: checkpoint.metadata,
      })
      .select("id")
      .single();
    if (manualErr || !manualAction) throw new Error(manualErr?.message ?? "Could not create Korea center checkpoint.");
    return manualAction.id as string;
  })();

  await admin.from("appointment_assistance_jobs").update({
    mode: "live_assisted",
    status: checkpoint.status,
    requires_user_action: true,
    current_manual_action: manualActionId,
    updated_at: new Date().toISOString(),
  }).eq("id", job.id);
  await admin.from("applications").update({
    appointment_assistance_status: checkpoint.status,
    appointment_assistance_job_id: job.id,
  }).eq("id", applicationId);
  await admin.from("appointment_audit_events").insert({
    job_id: job.id,
    application_id: applicationId,
    user_id: userId,
    event_type: checkpoint.status,
    event_message: "Korea center checkpoint created for a non-SMS-sync official filing channel.",
    metadata_redacted_json: checkpoint.metadata,
  });
}

async function replaceObservedSlots(
  admin: ReturnType<typeof createAdminClient>,
  applicationId: string,
  jobId: string,
  centerCode: string,
  source: string,
) {
  const slots = dryRunSlots(centerCode).map((slot) => ({
    ...slot,
    source,
    metadata_redacted_json: { centerCode, source },
    job_id: jobId,
    application_id: applicationId,
  }));
  await admin.from("appointment_slots").delete().eq("job_id", jobId).in("source", ["dry_run", "dry_run_after_sms"]);
  const { error: slotErr } = await admin.from("appointment_slots").insert(slots);
  if (slotErr) throw new Error(slotErr.message);
}

async function completeOfficialFinalBooking(
  admin: ReturnType<typeof createAdminClient>,
  applicationId: string,
  userId: string,
  job: AppointmentJobRow,
  routing: ReturnType<typeof resolveKvacCenter>,
) {
  const { data: slot, error: slotErr } = await admin
    .from("appointment_slots")
    .select("*")
    .eq("job_id", job.id)
    .in("status", ["user_selected", "selected"])
    .order("observed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (slotErr) throw new Error(slotErr.message);
  if (!slot) throw new Error("Select an official Korea KVAC slot before final booking.");

  const officialComplete = await postSubmissionService<KoreaKvacCompleteBookingResponse>("/local/korea-kvac/sms/complete", {
    applicationId,
    jobId: job.id,
    centerCode: routing.recommended.code,
    selectedSlot: {
      appointment_date: slot.appointment_date,
      appointment_time: slot.appointment_time,
      appointment_location: slot.appointment_location,
      appointment_type: slot.appointment_type,
    },
  });
  if (!officialComplete.ok || officialComplete.status !== "appointment_booked" || !officialComplete.confirmationNumber) {
    throw new Error("Official Korea KVAC final booking did not return a confirmation number.");
  }

  const { data: confirmation, error: confirmationErr } = await admin
    .from("appointment_confirmations")
    .insert({
      job_id: job.id,
      application_id: applicationId,
      user_id: userId,
      country_code: "KR",
      visa_type: "KR_C39_SHORT_TERM_VISIT",
      appointment_date: officialComplete.appointmentDate ?? slot.appointment_date,
      appointment_time: officialComplete.appointmentTime ?? slot.appointment_time,
      appointment_location: officialComplete.appointmentLocation ?? slot.appointment_location,
      appointment_type: officialComplete.appointmentType ?? slot.appointment_type,
      confirmation_number: officialComplete.confirmationNumber,
      confirmation_pdf_url: officialComplete.confirmationPdfUrl ?? null,
      confirmation_screenshot_url: officialComplete.screenshotPath ?? null,
      raw_confirmation_redacted_json: {
        mode: "official_kvac_live",
        center: routing.recommended.code,
        officialSessionId: officialComplete.officialSessionId ?? job.id,
        screenshotPath: officialComplete.screenshotPath,
      },
    })
    .select("id")
    .single();
  if (confirmationErr || !confirmation) throw new Error(confirmationErr?.message ?? "Could not save Korea official appointment confirmation.");

  await admin.from("appointment_assistance_jobs").update({
    status: "appointment_booked",
    requires_user_action: false,
    current_manual_action: null,
    updated_at: new Date().toISOString(),
  }).eq("id", job.id);
  await admin.from("applications").update({
    appointment_assistance_status: "appointment_booked",
    appointment_confirmation_id: confirmation.id,
  }).eq("id", applicationId);
  await admin.from("appointment_audit_events").insert({
    job_id: job.id,
    application_id: applicationId,
    user_id: userId,
    event_type: "appointment_booked",
    event_message: "Official Korea KVAC final booking returned a confirmation number and VIZA saved appointment proof metadata.",
    metadata_redacted_json: {
      centerCode: routing.recommended.code,
      confirmationNumber: officialComplete.confirmationNumber,
      screenshotPath: officialComplete.screenshotPath,
    },
  });
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  const auth = await requireApplication(id);
  if (!auth.ok) return auth.response;
  const snapshot = await readSnapshot(auth.admin, id);
  return NextResponse.json(snapshot);
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  const auth = await requireApplication(id);
  if (!auth.ok) return auth.response;
  const body = (await req.json().catch(() => ({}))) as {
    action?: Action;
    slotId?: string;
    smsCode?: string;
    routingInput?: KvacRoutingInput;
  };
  const action = body.action;
  const routingInput = await readRoutingInput(auth.admin, id, body.routingInput);
  const routing = resolveKvacCenter(routingInput);

  if (action === "refresh-status") {
    return NextResponse.json(await readSnapshot(auth.admin, id, routingInput));
  }

  if (action === "start-slot-search") {
    if (!routing.recommended.bookingUrl) {
      return NextResponse.json(
        { error: "This Korea visa filing channel does not have a confirmed online appointment portal. Follow the official consulate guidance instead." },
        { status: 409 },
      );
    }
    const job = await ensureKoreaJob(auth.admin, id, auth.profile.id, routing, "dry_run");
    await replaceObservedSlots(auth.admin, id, job.id, routing.recommended.code, "dry_run");
    return NextResponse.json(await readSnapshot(auth.admin, id, routingInput));
  }

  if (action === "select-slot") {
    if (!body.slotId) return NextResponse.json({ error: "slotId is required" }, { status: 400 });
    const job = await latestJob(auth.admin, id);
    if (!job) return NextResponse.json({ error: "Start slot search first" }, { status: 400 });
    await auth.admin.from("appointment_slots").update({ status: "expired" }).eq("job_id", job.id).eq("status", "observed");
    const { error: slotErr } = await auth.admin.from("appointment_slots").update({ status: "user_selected" }).eq("id", body.slotId).eq("job_id", job.id);
    if (slotErr) throw new Error(slotErr.message);

    if (job.mode === "live_assisted") {
      const { data: slot, error: selectedSlotErr } = await auth.admin
        .from("appointment_slots")
        .select("id, appointment_date, appointment_time, appointment_location")
        .eq("id", body.slotId)
        .eq("job_id", job.id)
        .maybeSingle();
      if (selectedSlotErr) throw new Error(selectedSlotErr.message);

      const { data: existingFinalAction, error: existingFinalErr } = await auth.admin
        .from("appointment_manual_actions")
        .select("id")
        .eq("job_id", job.id)
        .eq("action_type", "final_booking_approval_required")
        .in("status", ["pending", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existingFinalErr) throw new Error(existingFinalErr.message);

      const finalActionId = existingFinalAction?.id ?? await (async () => {
        const { data: finalAction, error: finalActionErr } = await auth.admin
          .from("appointment_manual_actions")
          .insert({
            job_id: job.id,
            application_id: id,
            user_id: auth.profile.id,
            action_type: "final_booking_approval_required",
            status: "pending",
            instruction:
              "Review the selected KVAC slot before the worker clicks the final official booking button. VIZA saves proof only after the official portal returns confirmation.",
            user_input_schema_json: {
              type: "object",
              required: ["approved"],
              properties: {
                approved: { type: "boolean", const: true },
              },
            },
            metadata_redacted_json: {
              centerCode: routing.recommended.code,
              selectedSlotId: slot?.id ?? body.slotId,
              selectedSlot: slot
                ? {
                    appointment_date: slot.appointment_date,
                    appointment_time: slot.appointment_time,
                    appointment_location: slot.appointment_location,
                  }
                : null,
            },
          })
          .select("id")
          .single();
        if (finalActionErr || !finalAction) {
          throw new Error(finalActionErr?.message ?? "Could not create final booking approval checkpoint.");
        }
        return finalAction.id as string;
      })();

      await auth.admin.from("appointment_assistance_jobs").update({
        status: "final_booking_approval_required",
        requires_user_action: true,
        current_manual_action: finalActionId,
        updated_at: new Date().toISOString(),
      }).eq("id", job.id);
      return NextResponse.json(await readSnapshot(auth.admin, id, routingInput));
    }

    await auth.admin.from("appointment_assistance_jobs").update({
      status: "appointment_slot_selection_required",
      updated_at: new Date().toISOString(),
    }).eq("id", job.id);
    return NextResponse.json(await readSnapshot(auth.admin, id, routingInput));
  }

  if (action === "confirm-booking") {
    const job = await latestJob(auth.admin, id);
    if (!job) return NextResponse.json({ error: "Start slot search first" }, { status: 400 });
    const { data: slot, error: slotErr } = await auth.admin
      .from("appointment_slots")
      .select("*")
      .eq("job_id", job.id)
      .in("status", ["user_selected", "selected"])
      .order("observed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (slotErr) throw new Error(slotErr.message);
    if (!slot) return NextResponse.json({ error: "Select a slot before confirming booking" }, { status: 400 });
    const confirmationNumber = `KR-DRYRUN-${String(slot.id).slice(0, 8).toUpperCase()}`;
    const { data: confirmation, error: confErr } = await auth.admin
      .from("appointment_confirmations")
      .insert({
        job_id: job.id,
        application_id: id,
        user_id: auth.profile.id,
        country_code: "KR",
        visa_type: "KR_C39_SHORT_TERM_VISIT",
        appointment_date: slot.appointment_date,
        appointment_time: slot.appointment_time,
        appointment_location: slot.appointment_location,
        appointment_type: slot.appointment_type,
        confirmation_number: confirmationNumber,
        raw_confirmation_redacted_json: { mode: "dry_run", center: routing.recommended.code },
      })
      .select("*")
      .single();
    if (confErr || !confirmation) throw new Error(confErr?.message ?? "Could not confirm Korea appointment.");
    await auth.admin.from("appointment_assistance_jobs").update({
      status: "appointment_booked",
      updated_at: new Date().toISOString(),
    }).eq("id", job.id);
    await auth.admin.from("applications").update({
      appointment_assistance_status: "appointment_booked",
      appointment_confirmation_id: confirmation.id,
    }).eq("id", id);
    return NextResponse.json(await readSnapshot(auth.admin, id, routingInput));
  }

  if (action === "request-live-booking") {
    const job = await ensureKoreaJob(auth.admin, id, auth.profile.id, routing, "live_assisted");
    if (routing.recommended.liveBookingMode !== "sms_sync_supported") {
      await createOrReuseCenterCheckpoint(auth.admin, id, auth.profile.id, job, routing);
      return NextResponse.json(await readSnapshot(auth.admin, id, routingInput));
    }
    if (job.status === "sms_verification_submitted") {
      return NextResponse.json(await readSnapshot(auth.admin, id, routingInput));
    }
    const { data: existingManualAction, error: existingManualErr } = await auth.admin
      .from("appointment_manual_actions")
      .select("id, expires_at")
      .eq("job_id", job.id)
      .eq("action_type", "sms_verification_required")
      .in("status", ["pending", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingManualErr) throw new Error(existingManualErr.message);
    if (existingManualAction) {
      if (!existingManualAction.expires_at || new Date(existingManualAction.expires_at).getTime() > Date.now()) {
        return NextResponse.json(await readSnapshot(auth.admin, id, routingInput));
      }
      await auth.admin
        .from("appointment_manual_actions")
        .update({ status: "expired" })
        .eq("id", existingManualAction.id);
    }
    try {
    const answers = await readAnswerMap(auth.admin, id);
    const applicantName = applicantNameForOfficial(answers);
    const mobilePhone = mobilePhoneForOfficial(answers);
    if (!applicantName || !mobilePhone) {
      return NextResponse.json(
        {
          error:
            "Korea KVAC live SMS verification requires the applicant name and mainland China mobile phone in the application answers before VIZA can operate the official portal.",
        },
        { status: 409 },
      );
    }
    const officialStart = await postSubmissionService<KoreaKvacStartSmsResponse>("/local/korea-kvac/sms/start", {
      applicationId: id,
      jobId: job.id,
      centerCode: routing.recommended.code,
      bookingUrl: routing.recommended.bookingUrl,
      applicantName,
      mobilePhone,
    });
    if (!officialStart.ok || officialStart.status !== "sms_verification_required") {
      throw new Error("Official Korea KVAC SMS verification did not start.");
    }
    const expiresAt = officialStart.expiresAtIso ?? new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const { data: manualAction, error: manualErr } = await auth.admin
      .from("appointment_manual_actions")
      .insert({
        job_id: job.id,
        application_id: id,
        user_id: auth.profile.id,
        action_type: "sms_verification_required",
        status: "pending",
        instruction: "KVAC sent or is about to send an SMS verification code. Enter the code within 5 minutes so the worker can continue in the same official portal session.",
        user_input_schema_json: {
          type: "object",
          required: ["smsCode"],
          properties: {
            smsCode: { type: "string", minLength: 4, maxLength: 8, pattern: "^[0-9]+$" },
          },
        },
        expires_at: expiresAt,
        metadata_redacted_json: {
          centerCode: routing.recommended.code,
          officialSessionId: officialStart.officialSessionId ?? job.id,
          appointmentDate: officialStart.appointmentDate,
          appointmentTime: officialStart.appointmentTime,
          appointmentEndTime: officialStart.appointmentEndTime,
          appointmentLocation: officialStart.appointmentLocation,
          phoneMasked: officialStart.phoneMasked,
          officialMessage: officialStart.officialMessage,
          screenshotPath: officialStart.screenshotPath,
          nextStep: "observe_slots_after_sms",
        },
      })
      .select("id")
      .single();
    if (manualErr || !manualAction) throw new Error(manualErr?.message ?? "Could not create SMS verification checkpoint.");
    await auth.admin.from("appointment_assistance_jobs").update({
      mode: "live_assisted",
      status: "sms_verification_required",
      requires_user_action: true,
      current_manual_action: manualAction.id,
      updated_at: new Date().toISOString(),
    }).eq("id", job.id);
    await auth.admin.from("appointment_audit_events").insert({
      job_id: job.id,
      application_id: id,
      user_id: auth.profile.id,
      event_type: "sms_verification_required",
      event_message: "Official Korea KVAC SMS was requested from the live portal session. VIZA is waiting for the user-provided code.",
      metadata_redacted_json: {
        centerCode: routing.recommended.code,
        officialSessionId: officialStart.officialSessionId ?? job.id,
        appointmentDate: officialStart.appointmentDate,
        appointmentTime: officialStart.appointmentTime,
        phoneMasked: officialStart.phoneMasked,
        screenshotPath: officialStart.screenshotPath,
      },
    });
    return NextResponse.json(await readSnapshot(auth.admin, id, routingInput));
    } catch (error) {
      console.error("[korea-appointment] request-live-booking failed", error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Korea KVAC live booking failed" },
        { status: 502 },
      );
    }
  }

  if (action === "submit-sms-code") {
    const smsCode = body.smsCode?.trim() ?? "";
    if (!/^\d{4,8}$/.test(smsCode)) return NextResponse.json({ error: "SMS code must be 4 to 8 digits" }, { status: 400 });
    const job = await latestJob(auth.admin, id);
    if (!job) return NextResponse.json({ error: "Start live booking first" }, { status: 400 });
    const { data: manualAction, error: manualErr } = await auth.admin
      .from("appointment_manual_actions")
      .select("id, expires_at")
      .eq("job_id", job.id)
      .eq("action_type", "sms_verification_required")
      .in("status", ["pending", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (manualErr) throw new Error(manualErr.message);
    if (!manualAction) return NextResponse.json({ error: "No pending SMS verification checkpoint" }, { status: 400 });
    if (manualAction.expires_at && new Date(manualAction.expires_at).getTime() < Date.now()) {
      await auth.admin.from("appointment_manual_actions").update({ status: "expired" }).eq("id", manualAction.id);
      return NextResponse.json({ error: "SMS verification checkpoint expired" }, { status: 409 });
    }
    const officialSubmit = await postSubmissionService<KoreaKvacSubmitSmsResponse>("/local/korea-kvac/sms/submit", {
      jobId: job.id,
      smsCode,
    });
    if (!officialSubmit.ok || officialSubmit.status !== "appointment_slots_observed" || !officialSubmit.slots?.length) {
      throw new Error("Official Korea KVAC SMS submission did not return observable slots.");
    }

    await auth.admin.from("appointment_manual_actions").update({
      status: "completed",
      completed_at: new Date().toISOString(),
      user_input_redacted_json: {
        smsCode: "[REDACTED]",
        length: smsCode.length,
        suffix: smsCode.slice(-2),
      },
    }).eq("id", manualAction.id);
    await auth.admin.from("appointment_slots").delete().eq("job_id", job.id).in("source", ["dry_run", "dry_run_after_sms", "official_kvac_after_sms"]);
    const { error: officialSlotErr } = await auth.admin.from("appointment_slots").insert(
      officialSubmit.slots.map((slot) => ({
        job_id: job.id,
        application_id: id,
        appointment_date: slot.appointment_date,
        appointment_time: slot.appointment_time,
        appointment_location: slot.appointment_location,
        appointment_type: slot.appointment_type,
        source: slot.source,
        status: slot.status,
        metadata_redacted_json: {
          ...slot.metadata_redacted_json,
          providerSlotId: slot.id,
        },
      })),
    );
    if (officialSlotErr) throw new Error(officialSlotErr.message);
    await auth.admin.from("appointment_assistance_jobs").update({
      status: "appointment_slots_observed",
      requires_user_action: false,
      current_manual_action: null,
      updated_at: new Date().toISOString(),
    }).eq("id", job.id);
    await auth.admin.from("applications").update({
      appointment_assistance_status: "appointment_slots_observed",
      appointment_assistance_job_id: job.id,
    }).eq("id", id);
    await auth.admin.from("appointment_audit_events").insert({
      job_id: job.id,
      application_id: id,
      user_id: auth.profile.id,
      event_type: "sms_verification_submitted",
      event_message: "User submitted Korea KVAC SMS verification code. Code content was not logged; the code was passed to the live official session and official slots were recorded.",
      metadata_redacted_json: {
        codeLength: smsCode.length,
        codeSuffix: smsCode.slice(-2),
        officialSessionId: officialSubmit.officialSessionId ?? job.id,
        screenshotPath: officialSubmit.screenshotPath,
        nextStep: "observe_slots",
      },
    });
    return NextResponse.json(await readSnapshot(auth.admin, id, routingInput));
  }

  if (action === "approve-final-booking") {
    const job = await latestJob(auth.admin, id);
    if (!job) return NextResponse.json({ error: "Start live booking first" }, { status: 400 });
    const { data: manualAction, error: manualErr } = await auth.admin
      .from("appointment_manual_actions")
      .select("id")
      .eq("job_id", job.id)
      .eq("action_type", "final_booking_approval_required")
      .in("status", ["pending", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (manualErr) throw new Error(manualErr.message);
    if (!manualAction) return NextResponse.json({ error: "No pending final booking approval checkpoint" }, { status: 400 });

    await auth.admin.from("appointment_manual_actions").update({
      status: "completed",
      completed_at: new Date().toISOString(),
      user_input_redacted_json: {
        approved: true,
        approvedAt: new Date().toISOString(),
      },
    }).eq("id", manualAction.id);
    await auth.admin.from("appointment_assistance_jobs").update({
      status: "final_booking_approved",
      requires_user_action: false,
      current_manual_action: null,
      updated_at: new Date().toISOString(),
    }).eq("id", job.id);
    await auth.admin.from("appointment_audit_events").insert({
      job_id: job.id,
      application_id: id,
      user_id: auth.profile.id,
      event_type: "final_booking_approved",
      event_message: "User approved Korea KVAC final booking click. Worker may proceed to the official final confirmation step.",
      metadata_redacted_json: { centerCode: routing.recommended.code },
    });
    try {
      await completeOfficialFinalBooking(auth.admin, id, auth.profile.id, { ...job, status: "final_booking_approved" }, routing);
    } catch (error) {
      console.error("[korea-appointment] complete final booking after approval failed", error);
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Korea KVAC final booking could not be completed. Restart SMS verification if the official session expired.",
        },
        { status: 409 },
      );
    }
    return NextResponse.json(await readSnapshot(auth.admin, id, routingInput));
  }

  if (action === "complete-final-booking") {
    const job = await latestJob(auth.admin, id);
    if (!job) return NextResponse.json({ error: "Start live booking first" }, { status: 400 });
    if (job.mode !== "live_assisted") return NextResponse.json({ error: "Final official booking requires live-assisted mode" }, { status: 400 });
    try {
      await completeOfficialFinalBooking(auth.admin, id, auth.profile.id, job, routing);
    } catch (error) {
      console.error("[korea-appointment] complete-final-booking failed", error);
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Korea KVAC final booking could not be completed. Restart SMS verification if the official session expired.",
        },
        { status: 409 },
      );
    }
    return NextResponse.json(await readSnapshot(auth.admin, id, routingInput));
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}
