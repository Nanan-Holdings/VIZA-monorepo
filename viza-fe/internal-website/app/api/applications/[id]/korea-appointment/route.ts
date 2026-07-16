import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getClientSessionWithFallback } from "@/lib/client-session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isRebookingAfterCancellation,
  planKoreaRebooking,
} from "@/lib/korea-c39/appointment-rebooking";
import {
  KVAC_CENTERS,
  resolveKvacCenter,
  type KvacRoutingInput,
} from "@/lib/korea-c39/kvac-routing";

type Action =
  | "start-slot-search"
  | "select-slot"
  | "confirm-booking"
  | "request-live-booking"
  | "return-to-center-selection"
  | "print-appointment-confirmation"
  | "submit-sms-code"
  | "approve-final-booking"
  | "complete-final-booking"
  | "request-reschedule"
  | "request-cancel"
  | "start-cancel-query"
  | "confirm-cancel-official"
  | "start-new-booking"
  | "restart-without-booking-record"
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

interface KoreaKvacCancelQueryResponse {
  ok?: boolean;
  error?: string;
  status?: "cancellation_confirmation_required" | "cancellation_manual_checkpoint";
  officialSessionId?: string;
  phoneMasked?: string;
  screenshotPath?: string | null;
  officialMessage?: string;
  canCancel?: boolean;
}

interface KoreaKvacCancelConfirmResponse {
  ok?: boolean;
  error?: string;
  status?: "appointment_cancelled";
  officialSessionId?: string;
  screenshotPath?: string | null;
  officialMessage?: string;
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
    // Official KVAC pages can take longer than a typical JSON API while the
    // browser waits for the appointment-query result.
    signal: AbortSignal.timeout(300_000),
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

function submissionServiceErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isSubmissionRunnerUnavailable(error: unknown) {
  const message = submissionServiceErrorMessage(error);
  return /fetch failed|ECONNREFUSED|ECONNRESET|Failed to fetch|terminated|AbortError|failed \(404\)|not[_ ]found/i.test(message);
}

interface KoreaKvacPrintConfirmationResponse {
  ok?: boolean;
  error?: string;
  status?: "appointment_confirmation_printed";
  confirmationNumber?: string;
  confirmationPdfUrl?: string;
  screenshotPath?: string | null;
}

function isCancellationSessionExpired(error: unknown) {
  return /cancellation session is missing or expired|cancellation button is no longer visible/i.test(submissionServiceErrorMessage(error));
}

function officialQueryShowsNoAppointmentRecord(result: KoreaKvacCancelQueryResponse) {
  return result.status === "cancellation_manual_checkpoint"
    && result.canCancel !== true
    && /查询明细不存在|no appointment (?:record|detail|found)|booking (?:record|detail) (?:does not exist|not found)/i.test(result.officialMessage ?? "");
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

function departureDateForOfficial(answers: Record<string, string>) {
  return firstAnswer(answers, [
    "intended_date_of_entry",
    "planned_entry_date",
    "arrival_date",
    "travel_start_date",
    "departure_date",
    "planned_departure_date",
  ]);
}

async function readSnapshot(admin: ReturnType<typeof createAdminClient>, applicationId: string, routingInput?: KvacRoutingInput) {
  const job = await latestJob(admin, applicationId);
  const storedCenterCode = KVAC_CENTERS.find(
    (center) => center.code === job?.user_preferences_json?.centerCode,
  )?.code ?? null;
  const effectiveRoutingInput = routingInput ?? (storedCenterCode ? { selectedCenterCode: storedCenterCode } : undefined);
  const routing = resolveKvacCenter(await readRoutingInput(admin, applicationId, effectiveRoutingInput));
  if (!job) {
    return {
      routing,
      job: null,
      slots: [],
      confirmation: null,
      appointmentHistory: [],
      manualAction: null,
      changeIntent: null,
      rebookingAfterCancellation: false,
    };
  }

  const { data: applicationState, error: applicationStateErr } = await admin
    .from("applications")
    .select("appointment_confirmation_id")
    .eq("id", applicationId)
    .maybeSingle();
  if (applicationStateErr) throw new Error(applicationStateErr.message);

  // Cancelled jobs have no active appointment even if an older deployment
  // left the application pointer populated. The confirmation row remains in
  // appointmentHistory as immutable evidence.
  const confirmationPointer = applicationState?.appointment_confirmation_id ?? null;
  const { data: pointedConfirmation, error: activeConfirmationErr } = confirmationPointer
    ? await admin
      .from("appointment_confirmations")
      .select("*")
      .eq("id", confirmationPointer)
      .eq("application_id", applicationId)
      .maybeSingle()
    : { data: null, error: null };
  if (activeConfirmationErr) throw new Error(activeConfirmationErr.message);
  const activeConfirmation = job.status === "appointment_cancelled" && pointedConfirmation?.job_id === job.id
    ? null
    : pointedConfirmation;

  const [
    { data: slots, error: slotsErr },
    { data: appointmentHistory, error: appointmentHistoryErr },
    { data: manualAction, error: manualActionErr },
    { data: rescheduleAction, error: rescheduleActionErr },
  ] = await Promise.all([
    admin
      .from("appointment_slots")
      .select("*")
      .eq("job_id", job.id)
      .order("appointment_date", { ascending: true })
      .order("appointment_time", { ascending: true }),
    admin
      .from("appointment_confirmations")
      .select("id, confirmation_number, appointment_date, appointment_time, appointment_location, created_at, raw_confirmation_redacted_json")
      .eq("application_id", applicationId)
      .eq("country_code", "KR")
      .order("created_at", { ascending: false })
      .limit(5),
    admin
      .from("appointment_manual_actions")
      .select("id, job_id, action_type, status, instruction, expires_at, created_at, metadata_redacted_json")
      .eq("job_id", job.id)
      .in("status", ["pending", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("appointment_manual_actions")
      .select("id")
      .eq("job_id", job.id)
      .eq("action_type", "official_reschedule_required")
      .in("status", ["pending", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (slotsErr) throw new Error(slotsErr.message);
  if (appointmentHistoryErr) throw new Error(appointmentHistoryErr.message);
  if (manualActionErr) throw new Error(manualActionErr.message);
  if (rescheduleActionErr) throw new Error(rescheduleActionErr.message);
  const normalizedConfirmation = activeConfirmation
    ? {
        ...activeConfirmation,
        confirmation_pdf_url: activeConfirmation.confirmation_pdf_url
          ? `/api/applications/${applicationId}/korea-evidence?path=${encodeURIComponent(activeConfirmation.confirmation_pdf_url)}&download=1`
          : null,
        confirmation_screenshot_url: activeConfirmation.confirmation_screenshot_url
          ? `/api/applications/${applicationId}/korea-evidence?path=${encodeURIComponent(activeConfirmation.confirmation_screenshot_url)}`
          : null,
      }
    : null;
  const hasVizaAppointmentRecord = Boolean(normalizedConfirmation?.confirmation_number)
    && normalizedConfirmation?.raw_confirmation_redacted_json?.mode !== "dry_run"
    && !normalizedConfirmation.confirmation_number.startsWith("KR-DRYRUN-");
  const pendingChangeActionTypes = new Set([
    "official_reschedule_required",
    "official_cancel_required",
    "official_cancel_confirmation_required",
    "official_cancel_manual_checkpoint",
  ]);
  const actionableManualAction = !hasVizaAppointmentRecord && pendingChangeActionTypes.has(manualAction?.action_type ?? "")
    ? null
    : (manualAction as AppointmentManualActionRow | null) ?? null;
  return {
    routing,
    job,
    slots: slots ?? [],
    confirmation: normalizedConfirmation,
    appointmentHistory: appointmentHistory ?? [],
    manualAction: actionableManualAction,
    changeIntent: rescheduleAction ? "reschedule" : null,
    rebookingAfterCancellation: isRebookingAfterCancellation(job),
  };
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

async function createOrReuseAppointmentChangeCheckpoint(
  admin: ReturnType<typeof createAdminClient>,
  applicationId: string,
  userId: string,
  job: AppointmentJobRow,
  routing: ReturnType<typeof resolveKvacCenter>,
  kind: "reschedule" | "cancel",
) {
  const { data: confirmation, error: confirmationErr } = await admin
    .from("appointment_confirmations")
    .select("id, confirmation_number, appointment_date, appointment_time, appointment_location")
    .eq("application_id", applicationId)
    .eq("country_code", "KR")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (confirmationErr) throw new Error(confirmationErr.message);
  if (!confirmation?.confirmation_number) {
    throw new Error("Official Korea appointment confirmation is required before reschedule or cancellation.");
  }

  const actionType = kind === "reschedule" ? "official_reschedule_required" : "official_cancel_required";
  const supersededActionType = kind === "reschedule" ? "official_cancel_required" : "official_reschedule_required";
  const nextStatus = kind === "reschedule" ? "reschedule_requested" : "cancellation_requested";
  const { error: supersedeErr } = await admin
    .from("appointment_manual_actions")
    .update({
      status: "expired",
      completed_at: new Date().toISOString(),
    })
    .eq("job_id", job.id)
    .eq("action_type", supersededActionType)
    .in("status", ["pending", "in_progress"]);
  if (supersedeErr) throw new Error(supersedeErr.message);

  const { data: existingManualAction, error: existingManualErr } = await admin
    .from("appointment_manual_actions")
    .select("id")
    .eq("job_id", job.id)
    .eq("action_type", actionType)
    .in("status", ["pending", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingManualErr) throw new Error(existingManualErr.message);

  const metadata = {
    centerCode: routing.recommended.code,
    centerNameEn: routing.recommended.nameEn,
    bookingUrl: routing.recommended.bookingUrl,
    bookingSearchUrl: routing.recommended.bookingSearchUrl,
    officialUrl: routing.recommended.officialUrl,
    confirmationId: confirmation.id,
    confirmationNumber: confirmation.confirmation_number,
    appointmentDate: confirmation.appointment_date,
    appointmentTime: confirmation.appointment_time,
    appointmentLocation: confirmation.appointment_location,
    nextStep: kind === "reschedule" ? "restart_sms_and_select_new_slot" : "open_official_query_or_cancel_page",
  };
  const instruction =
    kind === "reschedule"
      ? "已创建韩国 KVAC 改约流程。可同步短信的中心会重新发送官网短信验证码，读取新时段后仍需申请人选择新时间并授权最终提交。Reschedule checkpoint created; restart official SMS verification, observe new official slots, and book only after applicant selection and final approval."
      : "已创建韩国 KVAC 取消检查点。请在 VIZA 点击站内查询取消入口；后端会进入官网查询预约记录，查到后回到本页等待你确认最终取消。Cancellation checkpoint created; VIZA will operate the official query/cancel flow in the background and return here for final cancellation approval.";

  const manualActionId = existingManualAction?.id ?? await (async () => {
    const { data: manualAction, error: manualErr } = await admin
      .from("appointment_manual_actions")
      .insert({
        job_id: job.id,
        application_id: applicationId,
        user_id: userId,
        action_type: actionType,
        status: "pending",
        instruction,
        user_input_schema_json: { type: "object", properties: { acknowledged: { type: "boolean" } } },
        metadata_redacted_json: metadata,
      })
      .select("id")
      .single();
    if (manualErr || !manualAction) throw new Error(manualErr?.message ?? "Could not create Korea appointment change checkpoint.");
    return manualAction.id as string;
  })();
  if (existingManualAction?.id) {
    const { error: updateManualErr } = await admin
      .from("appointment_manual_actions")
      .update({
        instruction,
        metadata_redacted_json: metadata,
      })
      .eq("id", existingManualAction.id);
    if (updateManualErr) throw new Error(updateManualErr.message);
  }

  await admin.from("appointment_assistance_jobs").update({
    status: nextStatus,
    requires_user_action: true,
    current_manual_action: manualActionId,
    updated_at: new Date().toISOString(),
  }).eq("id", job.id);
  await admin.from("applications").update({
    appointment_assistance_status: nextStatus,
    appointment_assistance_job_id: job.id,
  }).eq("id", applicationId);
  await admin.from("appointment_audit_events").insert({
    job_id: job.id,
    application_id: applicationId,
    user_id: userId,
    event_type: nextStatus,
    event_message: kind === "reschedule" ? "Korea KVAC reschedule requested by applicant." : "Korea KVAC cancellation requested by applicant.",
    metadata_redacted_json: metadata,
  });
}

async function createWorkerUnavailableCheckpoint(
  admin: ReturnType<typeof createAdminClient>,
  applicationId: string,
  userId: string,
  job: AppointmentJobRow,
  routing: ReturnType<typeof resolveKvacCenter>,
  kind: "booking" | "reschedule" | "cancel",
  rawError: string,
) {
  const actionType = kind === "cancel"
    ? "official_cancel_manual_checkpoint"
    : kind === "reschedule"
      ? "official_reschedule_required"
      : "official_center_manual_checkpoint";
  const status = kind === "cancel"
    ? "cancellation_manual_checkpoint"
    : kind === "reschedule"
      ? "reschedule_requested"
      : "official_center_manual_checkpoint";
  const instruction = kind === "cancel"
    ? "VIZA 已创建站内取消任务，但本地 Korea KVAC worker 暂时不可达。请启动 submission-service 并启用 KR_KVAC_LOCAL_OFFICIAL_SESSION_ENABLED=true 后，在本页重新点击站内查询取消入口；用户不需要跳转到官网操作。"
    : kind === "reschedule"
      ? "VIZA 已创建站内改约任务，但本地 Korea KVAC worker 暂时不可达。请启动 submission-service 并启用 KR_KVAC_LOCAL_OFFICIAL_SESSION_ENABLED=true 后，在本页继续查询并取消旧预约；取消成功后才会重新发送验证码选择新时间。"
      : "VIZA 已保留站内预约流程，但本地 Korea KVAC worker 暂时不可达。请启动 submission-service 并启用 KR_KVAC_LOCAL_OFFICIAL_SESSION_ENABLED=true 后，在本页重新发送官网验证码；用户不需要跳转到官网操作。";
  const metadata = {
    centerCode: routing.recommended.code,
    centerNameEn: routing.recommended.nameEn,
    bookingUrl: routing.recommended.bookingUrl,
    bookingSearchUrl: routing.recommended.bookingSearchUrl,
    officialUrl: routing.recommended.officialUrl,
    nextStep: kind === "cancel" || kind === "reschedule" ? "restart_worker_and_retry_cancel_query" : "restart_worker_and_resend_sms",
    workerBaseUrl: submissionServiceBaseUrl(),
    workerUnavailable: true,
    error: rawError,
  };

  const { data: existingManualAction, error: existingManualErr } = await admin
    .from("appointment_manual_actions")
    .select("id")
    .eq("job_id", job.id)
    .eq("action_type", actionType)
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
        action_type: actionType,
        status: "pending",
        instruction,
        user_input_schema_json: { type: "object", properties: { acknowledged: { type: "boolean" } } },
        metadata_redacted_json: metadata,
      })
      .select("id")
      .single();
    if (manualErr || !manualAction) throw new Error(manualErr?.message ?? "Could not create Korea worker checkpoint.");
    return manualAction.id as string;
  })();

  if (existingManualAction?.id) {
    const { error: updateManualErr } = await admin
      .from("appointment_manual_actions")
      .update({
        instruction,
        metadata_redacted_json: metadata,
      })
      .eq("id", existingManualAction.id);
    if (updateManualErr) throw new Error(updateManualErr.message);
  }

  await admin.from("appointment_assistance_jobs").update({
    mode: "live_assisted",
    status,
    requires_user_action: true,
    current_manual_action: manualActionId,
    updated_at: new Date().toISOString(),
  }).eq("id", job.id);
  await admin.from("applications").update({
    appointment_assistance_status: status,
    appointment_assistance_job_id: job.id,
  }).eq("id", applicationId);
  await admin.from("appointment_audit_events").insert({
    job_id: job.id,
    application_id: applicationId,
    user_id: userId,
    event_type: status,
    event_message: kind === "cancel"
      ? "Korea KVAC cancellation stayed inside VIZA because the local official-portal worker was unavailable."
      : kind === "reschedule"
        ? "Korea KVAC reschedule stayed inside VIZA because the local official-portal worker was unavailable."
        : "Korea KVAC booking stayed inside VIZA because the local official-portal worker was unavailable.",
    metadata_redacted_json: metadata,
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
      departure_date: departureDateForOfficial(await readAnswerMap(admin, applicationId)),
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
  await admin.from("appointment_manual_actions").update({
    status: "completed",
    completed_at: new Date().toISOString(),
  }).eq("job_id", job.id)
    .eq("action_type", "official_reschedule_required")
    .in("status", ["pending", "in_progress"]);
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

async function startOfficialCancellationQuery(
  admin: ReturnType<typeof createAdminClient>,
  applicationId: string,
  userId: string,
  job: AppointmentJobRow,
  routing: ReturnType<typeof resolveKvacCenter>,
  intent: "cancel" | "reschedule" = "cancel",
): Promise<KoreaKvacCancelQueryResponse> {
  if (!routing.recommended.bookingSearchUrl) {
    throw new Error("This Korea center does not expose a supported official cancellation query page.");
  }
  const answers = await readAnswerMap(admin, applicationId);
  const applicantName = applicantNameForOfficial(answers);
  const mobilePhone = mobilePhoneForOfficial(answers);
  if (!applicantName || !mobilePhone) {
    throw new Error("Korea KVAC cancellation requires applicant name and mainland China mobile phone in the application answers.");
  }
  const result = await postSubmissionService<KoreaKvacCancelQueryResponse>("/local/korea-kvac/cancel/query", {
    applicationId,
    jobId: job.id,
    centerCode: routing.recommended.code,
    bookingSearchUrl: routing.recommended.bookingSearchUrl,
    applicantName,
    mobilePhone,
  });
  if (!result.ok || !result.status) throw new Error("Official Korea KVAC cancellation query did not return a usable status.");

  if (officialQueryShowsNoAppointmentRecord(result)) {
    await markOfficialCancellationCompleted(
      admin,
      applicationId,
      userId,
      job,
      routing,
      {
        screenshotPath: result.screenshotPath,
        officialMessage: result.officialMessage,
        eventMessage: "Korea KVAC cancellation was verified by a fresh official query: no appointment record was returned.",
      },
    );
    return result;
  }

  const actionType = result.status === "cancellation_confirmation_required"
    ? "official_cancel_confirmation_required"
    : "official_cancel_manual_checkpoint";
  const status = result.status;
  await admin.from("appointment_manual_actions").update({ status: "expired" })
    .eq("job_id", job.id)
    .in("action_type", ["official_cancel_required", "official_cancel_confirmation_required", "official_cancel_manual_checkpoint"])
    .in("status", ["pending", "in_progress"]);
  const { data: manualAction, error: manualErr } = await admin
    .from("appointment_manual_actions")
    .insert({
      job_id: job.id,
      application_id: applicationId,
      user_id: userId,
      action_type: actionType,
      status: "pending",
      instruction: result.status === "cancellation_confirmation_required"
        ? "VIZA 已在官网查询到预约记录。请在 VIZA 确认是否取消；确认后后端会继续点击官网取消按钮并保存证据。"
        : "VIZA 已完成官网预约查询，但没有识别到可自动点击的取消按钮。请查看官方截图证据，当前不会标记为已取消。",
      user_input_schema_json: { type: "object", properties: { approved: { type: "boolean" } } },
      metadata_redacted_json: {
        centerCode: routing.recommended.code,
        officialSessionId: result.officialSessionId ?? job.id,
        phoneMasked: result.phoneMasked,
        screenshotPath: result.screenshotPath,
        officialMessage: result.officialMessage,
        canCancel: result.canCancel === true,
        intent,
      },
    })
    .select("id")
    .single();
  if (manualErr || !manualAction) throw new Error(manualErr?.message ?? "Could not create Korea cancellation checkpoint.");
  await admin.from("appointment_assistance_jobs").update({
    status,
    requires_user_action: result.status === "cancellation_confirmation_required",
    current_manual_action: manualAction.id,
    updated_at: new Date().toISOString(),
  }).eq("id", job.id);
  await admin.from("applications").update({
    appointment_assistance_status: status,
    appointment_assistance_job_id: job.id,
  }).eq("id", applicationId);
  await admin.from("appointment_audit_events").insert({
    job_id: job.id,
    application_id: applicationId,
    user_id: userId,
    event_type: status,
    event_message: "Korea KVAC cancellation query was run from VIZA against the official portal.",
    metadata_redacted_json: {
      centerCode: routing.recommended.code,
      screenshotPath: result.screenshotPath,
      canCancel: result.canCancel === true,
      intent,
    },
  });
  return result;
}

async function markOfficialCancellationCompleted(
  admin: ReturnType<typeof createAdminClient>,
  applicationId: string,
  userId: string,
  job: AppointmentJobRow,
  routing: ReturnType<typeof resolveKvacCenter>,
  evidence: {
    screenshotPath?: string | null;
    officialMessage?: string;
    eventMessage: string;
  },
) {
  const completedAt = new Date().toISOString();
  const { error: actionErr } = await admin
    .from("appointment_manual_actions")
    .update({
      status: "completed",
      completed_at: completedAt,
      user_input_redacted_json: { approved: true, source: "viza_cancel_authorization" },
      metadata_redacted_json: {
        centerCode: routing.recommended.code,
        screenshotPath: evidence.screenshotPath ?? null,
        officialMessage: evidence.officialMessage ?? null,
      },
    })
    .eq("job_id", job.id)
    .in("action_type", [
      "official_cancel_required",
      "official_cancel_confirmation_required",
      "official_cancel_manual_checkpoint",
    ])
    .in("status", ["pending", "in_progress"]);
  if (actionErr) throw new Error(actionErr.message);

  const { error: jobErr } = await admin.from("appointment_assistance_jobs").update({
    status: "appointment_cancelled",
    requires_user_action: false,
    current_manual_action: null,
    updated_at: completedAt,
  }).eq("id", job.id);
  if (jobErr) throw new Error(jobErr.message);

  const { error: applicationErr } = await admin.from("applications").update({
    appointment_assistance_status: "appointment_cancelled",
    appointment_assistance_job_id: job.id,
    appointment_confirmation_id: null,
  }).eq("id", applicationId);
  if (applicationErr) throw new Error(applicationErr.message);

  const { error: auditErr } = await admin.from("appointment_audit_events").insert({
    job_id: job.id,
    application_id: applicationId,
    user_id: userId,
    event_type: "appointment_cancelled",
    event_message: evidence.eventMessage,
    metadata_redacted_json: {
      centerCode: routing.recommended.code,
      screenshotPath: evidence.screenshotPath ?? null,
      officialMessage: evidence.officialMessage ?? null,
    },
  });
  if (auditErr) throw new Error(auditErr.message);
}

async function confirmOfficialCancellation(
  admin: ReturnType<typeof createAdminClient>,
  applicationId: string,
  userId: string,
  job: AppointmentJobRow,
  routing: ReturnType<typeof resolveKvacCenter>,
) {
  const result = await postSubmissionService<KoreaKvacCancelConfirmResponse>("/local/korea-kvac/cancel/confirm", {
    jobId: job.id,
  });
  if (!result.ok || result.status !== "appointment_cancelled") {
    throw new Error("Official Korea KVAC cancellation did not return a confirmed cancellation result.");
  }
  await markOfficialCancellationCompleted(admin, applicationId, userId, job, routing, {
    screenshotPath: result.screenshotPath,
    officialMessage: result.officialMessage,
    eventMessage: "Korea KVAC appointment cancellation was confirmed on the official portal.",
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

  if (action === "return-to-center-selection") {
    const job = await latestJob(auth.admin, id);
    if (!job) return NextResponse.json(await readSnapshot(auth.admin, id, routingInput));
    const now = new Date().toISOString();
    const { error: manualActionError } = await auth.admin
      .from("appointment_manual_actions")
      .update({ status: "expired" })
      .eq("job_id", job.id)
      .eq("action_type", "sms_verification_required")
      .in("status", ["pending", "in_progress"]);
    if (manualActionError) throw new Error(manualActionError.message);
    const { error: jobError } = await auth.admin
      .from("appointment_assistance_jobs")
      .update({
        status: "not_started",
        requires_user_action: false,
        current_manual_action: null,
        updated_at: now,
      })
      .eq("id", job.id);
    if (jobError) throw new Error(jobError.message);
    await auth.admin.from("appointment_slots").delete().eq("job_id", job.id);
    await auth.admin.from("applications").update({ appointment_assistance_status: "not_started" }).eq("id", id);
    await auth.admin.from("appointment_audit_events").insert({
      job_id: job.id,
      application_id: id,
      user_id: auth.profile.id,
      event_type: "sms_verification_abandoned",
      event_message: "Applicant returned to center selection before submitting the official SMS code.",
      metadata_redacted_json: { centerCode: routing.recommended.code },
    });
    return NextResponse.json(await readSnapshot(auth.admin, id, routingInput));
  }

  if (action === "print-appointment-confirmation") {
    const job = await latestJob(auth.admin, id);
    if (!job) return NextResponse.json({ error: "No Korea appointment job found" }, { status: 404 });
    const { data: applicationState, error: applicationStateError } = await auth.admin
      .from("applications")
      .select("appointment_confirmation_id")
      .eq("id", id)
      .maybeSingle();
    if (applicationStateError) throw new Error(applicationStateError.message);
    if (!applicationState?.appointment_confirmation_id) {
      return NextResponse.json({ error: "No active Korea appointment confirmation" }, { status: 404 });
    }
    const { data: confirmation, error: confirmationError } = await auth.admin
      .from("appointment_confirmations")
      .select("id, confirmation_number, confirmation_pdf_url")
      .eq("id", applicationState.appointment_confirmation_id)
      .eq("application_id", id)
      .maybeSingle();
    if (confirmationError) throw new Error(confirmationError.message);
    if (!confirmation) return NextResponse.json({ error: "Active Korea appointment confirmation not found" }, { status: 404 });
    if (confirmation.confirmation_pdf_url) {
      return NextResponse.json(await readSnapshot(auth.admin, id, routingInput));
    }
    if (!routing.recommended.bookingSearchUrl) {
      return NextResponse.json({ error: "The selected center does not expose a supported official appointment print flow" }, { status: 409 });
    }
    const answers = await readAnswerMap(auth.admin, id);
    const applicantName = applicantNameForOfficial(answers);
    const mobilePhone = mobilePhoneForOfficial(answers);
    if (!applicantName || !mobilePhone) {
      return NextResponse.json({ error: "Applicant name and mainland China mobile phone are required to retrieve the official confirmation" }, { status: 409 });
    }
    const result = await postSubmissionService<KoreaKvacPrintConfirmationResponse>("/local/korea-kvac/confirmation/print", {
      applicationId: id,
      jobId: job.id,
      centerCode: routing.recommended.code,
      bookingSearchUrl: routing.recommended.bookingSearchUrl,
      applicantName,
      mobilePhone,
    });
    if (!result.ok || result.status !== "appointment_confirmation_printed" || !result.confirmationPdfUrl) {
      throw new Error("Official Korea KVAC confirmation PDF was not returned.");
    }
    if (confirmation.confirmation_number && result.confirmationNumber !== confirmation.confirmation_number) {
      throw new Error("The official appointment query returned a different confirmation number. The PDF was not attached to this application.");
    }
    const { error: updateError } = await auth.admin
      .from("appointment_confirmations")
      .update({
        confirmation_pdf_url: result.confirmationPdfUrl,
        confirmation_screenshot_url: result.screenshotPath ?? null,
      })
      .eq("id", confirmation.id);
    if (updateError) throw new Error(updateError.message);
    return NextResponse.json(await readSnapshot(auth.admin, id, routingInput));
  }

  if (action === "start-new-booking") {
    const existingJob = await latestJob(auth.admin, id);
    const { data: applicationState, error: applicationStateErr } = await auth.admin
      .from("applications")
      .select("appointment_confirmation_id")
      .eq("id", id)
      .maybeSingle();
    if (applicationStateErr) throw new Error(applicationStateErr.message);

    const confirmationPointer = applicationState?.appointment_confirmation_id ?? null;
    const { data: pointedConfirmation, error: pointedConfirmationErr } = confirmationPointer
      ? await auth.admin
        .from("appointment_confirmations")
        .select("id, job_id")
        .eq("id", confirmationPointer)
        .eq("application_id", id)
        .maybeSingle()
      : { data: null, error: null };
    if (pointedConfirmationErr) throw new Error(pointedConfirmationErr.message);
    const activeConfirmationId = existingJob?.status === "appointment_cancelled"
      && pointedConfirmation?.job_id === existingJob.id
      ? null
      : pointedConfirmation?.id ?? null;
    const rebookingPlan = planKoreaRebooking(id, existingJob, activeConfirmationId);
    if (rebookingPlan.kind === "reuse") {
      return NextResponse.json(await readSnapshot(auth.admin, id, routingInput));
    }
    if (rebookingPlan.kind === "reject") {
      return NextResponse.json(
        {
          error: rebookingPlan.reason === "active_appointment"
            ? "This application still has an active Korea appointment. Cancel or reschedule it before starting a new booking."
            : "A new Korea booking can only be started after the previous appointment is officially cancelled.",
        },
        { status: 409 },
      );
    }

    const newJobValues = {
      application_id: id,
      user_id: auth.profile.id,
      country_code: "KR",
      visa_type: "KR_C39_SHORT_TERM_VISIT",
      applying_country_code: "CN",
      applying_post_city: routing.recommended.nameEn,
      scheduling_provider: "kvac_cn",
      status: "not_started",
      mode: "live_assisted",
      user_preferences_json: {
        routing,
        centerCode: routing.recommended.code,
        previousJobId: rebookingPlan.previousJobId,
        rebookingAfterCancellation: true,
        finalConfirmationRequired: true,
        source: "korea_c39_v1",
      },
      requires_user_action: false,
      idempotency_key: rebookingPlan.idempotencyKey,
    };
    const { data: insertedJob, error: insertErr } = await auth.admin
      .from("appointment_assistance_jobs")
      .insert(newJobValues)
      .select("*")
      .single();

    let newJob = insertedJob as AppointmentJobRow | null;
    let created = Boolean(insertedJob);
    if (insertErr) {
      if (insertErr.code !== "23505") throw new Error(insertErr.message);
      const { data: existingRebookingJob, error: existingRebookingErr } = await auth.admin
        .from("appointment_assistance_jobs")
        .select("*")
        .eq("idempotency_key", rebookingPlan.idempotencyKey)
        .maybeSingle();
      if (existingRebookingErr || !existingRebookingJob) {
        throw new Error(existingRebookingErr?.message ?? "Could not reuse the Korea rebooking task.");
      }
      newJob = existingRebookingJob as AppointmentJobRow;
      created = false;
    }
    if (!newJob) throw new Error("Could not create the Korea rebooking task.");

    const { error: applicationErr } = await auth.admin
      .from("applications")
      .update({
        appointment_assistance_status: "not_started",
        appointment_assistance_job_id: newJob.id,
        appointment_confirmation_id: null,
      })
      .eq("id", id);
    if (applicationErr) throw new Error(applicationErr.message);

    if (created) {
      const { error: auditErr } = await auth.admin.from("appointment_audit_events").insert({
        job_id: newJob.id,
        application_id: id,
        user_id: auth.profile.id,
        event_type: "appointment_rebooking_started",
        event_message: "Applicant started a new Korea KVAC booking after the previous official appointment was cancelled.",
        metadata_redacted_json: {
          previousJobId: rebookingPlan.previousJobId,
          previousCenterCode: routing.recommended.code,
        },
      });
      if (auditErr) throw new Error(auditErr.message);
    }

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
    const [{ data: existingConfirmation, error: confirmationErr }, { data: rescheduleAction, error: rescheduleErr }] = await Promise.all([
      auth.admin
        .from("appointment_confirmations")
        .select("id")
        .eq("job_id", job.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      auth.admin
        .from("appointment_manual_actions")
        .select("id")
        .eq("job_id", job.id)
        .eq("action_type", "official_reschedule_required")
        .in("status", ["pending", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (confirmationErr) throw new Error(confirmationErr.message);
    if (rescheduleErr) throw new Error(rescheduleErr.message);
    if (existingConfirmation && !rescheduleAction) {
      return NextResponse.json(
        { error: "This Korea KVAC appointment already has an official confirmation number. Request reschedule before sending a new official SMS code." },
        { status: 409 },
      );
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
      if (isSubmissionRunnerUnavailable(error)) {
        await createWorkerUnavailableCheckpoint(
          auth.admin,
          id,
          auth.profile.id,
          job,
          routing,
          rescheduleAction ? "reschedule" : "booking",
          submissionServiceErrorMessage(error),
        );
        return NextResponse.json(await readSnapshot(auth.admin, id, routingInput));
      }
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

  if (action === "request-reschedule") {
    const job = await latestJob(auth.admin, id);
    if (!job) return NextResponse.json({ error: "Existing Korea appointment job is required." }, { status: 400 });
    try {
      await createOrReuseAppointmentChangeCheckpoint(
        auth.admin,
        id,
        auth.profile.id,
        job,
        routing,
        "reschedule",
      );
      await startOfficialCancellationQuery(auth.admin, id, auth.profile.id, job, routing, "reschedule");
    } catch (error) {
      if (isSubmissionRunnerUnavailable(error)) {
        await createWorkerUnavailableCheckpoint(
          auth.admin,
          id,
          auth.profile.id,
          job,
          routing,
          "reschedule",
          submissionServiceErrorMessage(error),
        );
        return NextResponse.json(await readSnapshot(auth.admin, id, routingInput));
      }
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Could not start Korea KVAC reschedule cancellation step." },
        { status: 409 },
      );
    }
    return NextResponse.json(await readSnapshot(auth.admin, id, routingInput));
  }

  if (action === "restart-without-booking-record") {
    const existingJob = await latestJob(auth.admin, id);
    if (existingJob) {
      const { error: expireErr } = await auth.admin
        .from("appointment_manual_actions")
        .update({ status: "expired", completed_at: new Date().toISOString() })
        .eq("job_id", existingJob.id)
        .in("action_type", [
          "official_reschedule_required",
          "official_cancel_required",
          "official_cancel_confirmation_required",
          "official_cancel_manual_checkpoint",
        ])
        .in("status", ["pending", "in_progress"]);
      if (expireErr) throw new Error(expireErr.message);
    }

    const { data: restartedJob, error: restartErr } = await auth.admin
      .from("appointment_assistance_jobs")
      .insert({
        application_id: id,
        user_id: auth.profile.id,
        country_code: "KR",
        visa_type: "KR_C39_SHORT_TERM_VISIT",
        applying_country_code: "CN",
        applying_post_city: routing.recommended.nameEn,
        scheduling_provider: "kvac_cn",
        status: "not_started",
        mode: "live_assisted",
        user_preferences_json: {
          routing,
          centerCode: routing.recommended.code,
          restartedWithoutBookingRecord: true,
          source: "korea_c39_v1",
        },
        requires_user_action: false,
        idempotency_key: `korea-kvac:${id}:${randomUUID()}`,
      })
      .select("*")
      .single();
    if (restartErr || !restartedJob) throw new Error(restartErr?.message ?? "Could not restart Korea appointment flow.");

    const { error: applicationErr } = await auth.admin
      .from("applications")
      .update({
        appointment_assistance_status: "not_started",
        appointment_assistance_job_id: restartedJob.id,
        appointment_confirmation_id: null,
      })
      .eq("id", id);
    if (applicationErr) throw new Error(applicationErr.message);

    await auth.admin.from("appointment_audit_events").insert({
      job_id: restartedJob.id,
      application_id: id,
      user_id: auth.profile.id,
      event_type: "appointment_restart_without_booking_record",
      event_message: "Applicant restarted Korea appointment flow after confirming there is no valid VIZA appointment record. No official cancellation action was sent.",
      metadata_redacted_json: { previousJobId: existingJob?.id ?? null },
    });
    return NextResponse.json(await readSnapshot(auth.admin, id, routingInput));
  }

  if (action === "request-cancel") {
    const job = await latestJob(auth.admin, id);
    if (!job) return NextResponse.json({ error: "Existing Korea appointment job is required." }, { status: 400 });
    try {
      await createOrReuseAppointmentChangeCheckpoint(auth.admin, id, auth.profile.id, job, routing, "cancel");
      const cancellationQuery = await startOfficialCancellationQuery(auth.admin, id, auth.profile.id, job, routing, "cancel");
      if (cancellationQuery.status === "cancellation_confirmation_required") {
        await confirmOfficialCancellation(auth.admin, id, auth.profile.id, job, routing);
      }
    } catch (error) {
      if (isSubmissionRunnerUnavailable(error)) {
        await createWorkerUnavailableCheckpoint(
          auth.admin,
          id,
          auth.profile.id,
          job,
          routing,
          "cancel",
          submissionServiceErrorMessage(error),
        );
        return NextResponse.json(await readSnapshot(auth.admin, id, routingInput));
      }
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Could not start Korea KVAC cancellation inside VIZA." },
        { status: 409 },
      );
    }
    return NextResponse.json(await readSnapshot(auth.admin, id, routingInput));
  }

  if (action === "start-cancel-query") {
    const job = await latestJob(auth.admin, id);
    if (!job) return NextResponse.json({ error: "Existing Korea appointment job is required." }, { status: 400 });
    try {
      const { data: rescheduleAction, error: rescheduleErr } = await auth.admin
        .from("appointment_manual_actions")
        .select("id")
        .eq("job_id", job.id)
        .eq("action_type", "official_reschedule_required")
        .in("status", ["pending", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (rescheduleErr) throw new Error(rescheduleErr.message);
      await startOfficialCancellationQuery(auth.admin, id, auth.profile.id, job, routing, rescheduleAction ? "reschedule" : "cancel");
    } catch (error) {
      if (isSubmissionRunnerUnavailable(error)) {
        await createWorkerUnavailableCheckpoint(
          auth.admin,
          id,
          auth.profile.id,
          job,
          routing,
          "cancel",
          submissionServiceErrorMessage(error),
        );
        return NextResponse.json(await readSnapshot(auth.admin, id, routingInput));
      }
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Could not query Korea KVAC cancellation flow." },
        { status: 409 },
      );
    }
    return NextResponse.json(await readSnapshot(auth.admin, id, routingInput));
  }

  if (action === "confirm-cancel-official") {
    const job = await latestJob(auth.admin, id);
    if (!job) return NextResponse.json({ error: "Existing Korea appointment job is required." }, { status: 400 });
    try {
      await confirmOfficialCancellation(auth.admin, id, auth.profile.id, job, routing);
    } catch (error) {
      if (isCancellationSessionExpired(error)) {
        const { data: rescheduleAction, error: rescheduleErr } = await auth.admin
          .from("appointment_manual_actions")
          .select("id")
          .eq("job_id", job.id)
          .eq("action_type", "official_reschedule_required")
          .in("status", ["pending", "in_progress"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (rescheduleErr) throw new Error(rescheduleErr.message);
        await startOfficialCancellationQuery(auth.admin, id, auth.profile.id, job, routing, rescheduleAction ? "reschedule" : "cancel");
        return NextResponse.json({
          ...(await readSnapshot(auth.admin, id, routingInput)),
          cancellationRefreshRequired: true,
        });
      }
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Could not confirm Korea KVAC cancellation." },
        { status: 409 },
      );
    }
    return NextResponse.json(await readSnapshot(auth.admin, id, routingInput));
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}
