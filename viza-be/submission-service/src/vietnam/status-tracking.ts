import { supabase } from "../supabase.js";
import { uploadArtifact } from "../artifact-storage.js";
import { extractAuto } from "../inbox/extractors/index.js";
import {
  queryVietnamOfficialStatus,
  toVietnamDob,
  type VietnamOfficialStatus,
} from "./status-check.js";
import { computeVietnamTrackingSlot } from "./status-tracking-schedule.js";
import {
  shouldPersistVietnamEvisaVersion,
  validateVietnamEvisaPdf,
} from "./evisa-pdf.js";

const OFFICIAL_STATUS_URL = "https://evisa.gov.vn/e-visa/search";
const OFFICIAL_EMAIL_PATTERN =
  /(?:evisa\.gov\.vn|xuatnhapcanh\.gov\.vn|immigration\.gov\.vn)/i;
const ACTIVE_TRACKING_STATUS = "active";

type TrackingRow = {
  application_id: string;
  applicant_id: string;
  auth_user_id: string;
  official_lookup_email: string;
  tracking_status: string;
  last_known_status: string | null;
  last_artifact_hash: string | null;
  last_artifact_storage_path: string | null;
  consecutive_failures: number;
};

type StatusCheckRow = {
  id: string;
  application_id: string;
  user_id: string | null;
  trigger_source: string;
  inbound_email_id: string | null;
  attempt_count: number;
};

type ApplicationRow = {
  id: string;
  applicant_id: string;
  external_reference: string | null;
  external_status: string | null;
  result_status: string | null;
  result_storage_path: string | null;
};

type ProfileRow = {
  id: string;
  auth_user_id: string;
  full_name: string | null;
  email: string | null;
  date_of_birth: string | null;
  language_pref: string | null;
};

type InboundEmailRow = {
  id: string;
  to_addr: string;
  from_addr: string;
  subject: string | null;
  text: string | null;
  html: string | null;
  received_at: string;
};

export interface ActivateVietnamStatusTrackingInput {
  applicationId: string;
  applicantId: string;
  authUserId: string;
  officialLookupEmail: string;
}

function isSchemaMissing(error: unknown): boolean {
  const value = error as { code?: unknown; message?: unknown } | null;
  const message =
    typeof value?.message === "string"
      ? value.message.toLowerCase()
      : String(error).toLowerCase();
  return (
    value?.code === "PGRST202" ||
    value?.code === "PGRST204" ||
    value?.code === "PGRST205" ||
    message.includes("official_application_tracking") ||
    message.includes("claim_vn_official_status_checks") ||
    message.includes("enqueue_due_vn_official_status_checks") ||
    message.includes("schema cache")
  );
}

export async function activateVietnamStatusTracking(
  input: ActivateVietnamStatusTrackingInput,
): Promise<boolean> {
  const slot = computeVietnamTrackingSlot(input.applicationId);
  const now = new Date().toISOString();
  const { error } = await supabase.from("official_application_tracking").upsert(
    {
      application_id: input.applicationId,
      applicant_id: input.applicantId,
      auth_user_id: input.authUserId,
      country_code: "VN",
      provider: "vietnam_evisa",
      official_lookup_email: input.officialLookupEmail.trim().toLowerCase(),
      tracking_status: ACTIVE_TRACKING_STATUS,
      daily_check_hour: slot.hour,
      daily_check_minute: slot.minute,
      next_daily_check_at: slot.nextDailyCheckAt,
      consecutive_failures: 0,
      completed_at: null,
      updated_at: now,
    },
    { onConflict: "application_id" },
  );
  if (error) {
    if (isSchemaMissing(error)) {
      console.warn("[vn-status] Tracking schema is not installed; activation skipped.");
      return false;
    }
    throw new Error(`Failed to activate Vietnam status tracking: ${error.message}`);
  }
  return true;
}

export async function enqueueDueVietnamStatusChecks(): Promise<number> {
  const { data, error } = await supabase.rpc(
    "enqueue_due_vn_official_status_checks",
  );
  if (error) {
    if (isSchemaMissing(error)) return 0;
    throw new Error(`Failed to enqueue due Vietnam status checks: ${error.message}`);
  }
  const count = Number(data ?? 0);
  return Number.isFinite(count) ? count : 0;
}

function normalizeReference(value: string | null | undefined): string {
  return (value ?? "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
}

async function queueEmailTriggeredCheck(
  email: InboundEmailRow,
  tracking: TrackingRow,
): Promise<boolean> {
  const now = new Date().toISOString();
  const { error } = await supabase.from("official_status_checks").insert({
    application_id: tracking.application_id,
    user_id: tracking.auth_user_id,
    country_code: "VN",
    provider: "vietnam_evisa",
    status: "queued",
    requested_by: "system",
    trigger_source: "email",
    idempotency_key: `vn:email:${email.id}`,
    inbound_email_id: email.id,
    scheduled_for: now,
    checked_at: null,
    raw_status_json: {
      source: "official_email",
      received_at: email.received_at,
    },
    created_at: now,
    updated_at: now,
  });
  if (error) {
    if (error.code === "23505") return false;
    if (isSchemaMissing(error)) return false;
    throw new Error(`Failed to queue Vietnam email status check: ${error.message}`);
  }
  await supabase
    .from("official_application_tracking")
    .update({ last_email_message_id: email.id, updated_at: now })
    .eq("application_id", tracking.application_id);
  return true;
}

export async function enqueueVietnamEmailTriggeredChecks(): Promise<number> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1_000).toISOString();
  const { data: messages, error: emailError } = await supabase
    .from("inbound_email")
    .select("id, to_addr, from_addr, subject, text, html, received_at")
    .gte("received_at", since)
    .eq("quarantined", false)
    .order("received_at", { ascending: false })
    .limit(100);
  if (emailError) {
    if (isSchemaMissing(emailError)) return 0;
    throw new Error(`Failed to scan Vietnam status emails: ${emailError.message}`);
  }

  const officialMessages = ((messages ?? []) as InboundEmailRow[]).filter(
    (message) => OFFICIAL_EMAIL_PATTERN.test(message.from_addr),
  );
  if (officialMessages.length === 0) return 0;

  const aliases = [
    ...new Set(officialMessages.map((message) => message.to_addr.toLowerCase())),
  ];
  const { data: trackingRows, error: trackingError } = await supabase
    .from("official_application_tracking")
    .select(
      "application_id, applicant_id, auth_user_id, official_lookup_email, tracking_status, last_known_status, last_artifact_hash, last_artifact_storage_path, consecutive_failures",
    )
    .eq("tracking_status", ACTIVE_TRACKING_STATUS)
    .in("official_lookup_email", aliases);
  if (trackingError) {
    if (isSchemaMissing(trackingError)) return 0;
    throw new Error(`Failed to match Vietnam status emails: ${trackingError.message}`);
  }

  const tracking = (trackingRows ?? []) as TrackingRow[];
  if (tracking.length === 0) return 0;
  const { data: applications, error: applicationError } = await supabase
    .from("applications")
    .select("id, external_reference")
    .in(
      "id",
      tracking.map((row) => row.application_id),
    );
  if (applicationError) {
    throw new Error(`Failed to load tracked Vietnam references: ${applicationError.message}`);
  }
  const referenceByApplication = new Map(
    ((applications ?? []) as Array<{ id: string; external_reference: string | null }>).map(
      (row) => [row.id, normalizeReference(row.external_reference)],
    ),
  );

  let queued = 0;
  for (const email of officialMessages) {
    const candidates = tracking.filter(
      (row) =>
        row.official_lookup_email.toLowerCase() === email.to_addr.toLowerCase(),
    );
    if (candidates.length === 0) continue;
    const parsed = extractAuto({
      from: email.from_addr,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
    const emailReference = normalizeReference(parsed.reference);
    const matched = emailReference
      ? candidates.filter(
          (candidate) =>
            referenceByApplication.get(candidate.application_id) === emailReference,
        )
      : candidates;
    if (matched.length !== 1) {
      console.warn(
        `[vn-status] Official email ${email.id} matched ${matched.length} active applications; waiting for the daily check.`,
      );
      const alertTargets = matched.length > 0 ? matched : candidates;
      await Promise.all(
        alertTargets.map((candidate) =>
          supabase.from("application_events").upsert(
            {
              application_id: candidate.application_id,
              applicant_id: candidate.applicant_id,
              auth_user_id: candidate.auth_user_id,
              event_type: "official_email_match_ambiguous",
              actor_type: "system",
              source: "vietnam_official_email",
              visibility: "staff",
              idempotency_key: `vn:email-ambiguous:${email.id}:${candidate.application_id}`,
              message: "Official Vietnam email could not be uniquely matched; daily polling remains active.",
              metadata: {
                inbound_email_id: email.id,
                candidate_count: matched.length,
                reference_present: Boolean(emailReference),
              },
              occurred_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
            },
            { onConflict: "idempotency_key", ignoreDuplicates: true },
          ),
        ),
      );
      continue;
    }
    if (await queueEmailTriggeredCheck(email, matched[0])) queued += 1;
  }
  return queued;
}

async function loadAnswers(applicationId: string): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("visa_application_answers")
    .select("field_name, value_text, value_json")
    .eq("application_id", applicationId);
  if (error) throw new Error(`Failed to load Vietnam status answers: ${error.message}`);
  const answers: Record<string, string> = {};
  for (const row of (data ?? []) as Array<{
    field_name: string;
    value_text: string | null;
    value_json: unknown;
  }>) {
    const value =
      row.value_json !== null && row.value_json !== undefined
        ? String(row.value_json)
        : row.value_text;
    if (value) answers[row.field_name] = value;
  }
  return answers;
}

function firstAnswer(
  answers: Record<string, string>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = answers[key]?.trim();
    if (value) return value;
  }
  return null;
}

function resultStatusForOfficialStatus(
  status: VietnamOfficialStatus,
  hasPdf: boolean,
): string {
  if (status === "approved") return hasPdf ? "approved" : "approved_pending_document";
  if (status === "rejected") return "rejected";
  if (status === "needs_correction") return "needs_attention";
  if (status === "payment_required") return "payment_required";
  if (status === "processing") return "pending_official_review";
  return "unknown";
}

function isTrustedStatus(status: VietnamOfficialStatus): boolean {
  return !["unknown", "needs_human"].includes(status);
}

async function persistOfficialVisa(input: {
  tracking: TrackingRow;
  applicationId: string;
  visaNumber: string | null;
  pdfBytes: Buffer;
}): Promise<{ storagePath: string; sha256: string; changed: boolean }> {
  const sha256 = validateVietnamEvisaPdf(input.pdfBytes);
  if (!shouldPersistVietnamEvisaVersion(
    sha256,
    input.tracking.last_artifact_hash,
    input.tracking.last_artifact_storage_path,
  ) && input.tracking.last_artifact_storage_path) {
    return {
      storagePath: input.tracking.last_artifact_storage_path,
      sha256,
      changed: false,
    };
  }

  const path = await uploadArtifact({
    authUserId: input.tracking.auth_user_id,
    applicationId: input.applicationId,
    country: "VN",
    kind: `evisa-${sha256.slice(0, 12)}`,
    ext: "pdf",
    contentType: "application/pdf",
    data: input.pdfBytes,
  });
  const storageReference = `submission-artifacts/${path}`;
  const now = new Date().toISOString();
  const { error: documentError } = await supabase
    .from("application_documents")
    .upsert(
      {
        application_id: input.applicationId,
        document_type: "evisa_pdf",
        storage_path: storageReference,
        filename: "vietnam-evisa.pdf",
        status: "validated",
        required: false,
        automation_status: "complete",
        uploaded_by: input.tracking.auth_user_id,
        uploaded_at: now,
        metadata: {
          source: "vietnam_official_status_portal",
          bucket: "submission-artifacts",
          sha256,
          visa_number: input.visaNumber,
          delivered_at: now,
        },
        updated_at: now,
      },
      { onConflict: "application_id,document_type" },
    );
  if (documentError) {
    throw new Error(`Failed to record Vietnam e-Visa document: ${documentError.message}`);
  }
  return { storagePath: storageReference, sha256, changed: true };
}

function notificationStatusLabel(
  status: VietnamOfficialStatus,
  locale: string,
  documentReady: boolean,
): string {
  const zh = locale.toLowerCase().startsWith("zh");
  if (status === "approved" && documentReady) return zh ? "签证已获批，可打印" : "Approved — visa ready to print";
  if (status === "approved") return zh ? "签证已获批，正在获取文件" : "Approved — retrieving visa document";
  if (status === "rejected") return zh ? "申请被拒绝" : "Application rejected";
  if (status === "needs_correction") return zh ? "需要补充或修改资料" : "Correction required";
  if (status === "payment_required") return zh ? "等待完成官方付款" : "Official payment required";
  if (status === "processing") return zh ? "官网处理中" : "Processing on the official portal";
  return zh ? "官网状态已更新" : "Official status updated";
}

async function queueStatusNotification(input: {
  application: ApplicationRow;
  profile: ProfileRow;
  previousStatus: string | null;
  officialStatus: VietnamOfficialStatus;
  artifactHash: string | null;
  documentReady: boolean;
}): Promise<void> {
  const normalizedPrevious = input.previousStatus?.toLowerCase() ?? null;
  if (
    normalizedPrevious === input.officialStatus &&
    !input.artifactHash
  ) {
    return;
  }
  const now = new Date().toISOString();
  const idempotencyKey = [
    "vn-status",
    input.application.id,
    input.officialStatus,
    input.artifactHash ?? "no-document",
  ].join(":");
  const locale = input.profile.language_pref ?? "en";
  const decision = notificationStatusLabel(
    input.officialStatus,
    locale,
    input.documentReady,
  );
  const siteUrl = (process.env.PUBLIC_SITE_URL ?? "http://127.0.0.1:3000").replace(
    /\/$/,
    "",
  );
  const applicationUrl = `${siteUrl}/client/status?applicationId=${encodeURIComponent(input.application.id)}`;
  const payload = {
    applicant_name: input.profile.full_name ?? (locale.startsWith("zh") ? "用户" : "Applicant"),
    country: locale.startsWith("zh") ? "越南" : "Vietnam",
    decision,
    application_url: applicationUrl,
    locale,
  };

  await Promise.all([
    supabase.from("application_events").upsert(
      {
        application_id: input.application.id,
        applicant_id: input.application.applicant_id,
        auth_user_id: input.profile.auth_user_id,
        event_type: "official_status_changed",
        actor_type: "system",
        source: "vietnam_official_status",
        visibility: "customer",
        idempotency_key: idempotencyKey,
        message: decision,
        metadata: {
          previous_status: input.previousStatus,
          official_status: input.officialStatus,
          document_ready: input.documentReady,
        },
        occurred_at: now,
        created_at: now,
      },
      { onConflict: "idempotency_key", ignoreDuplicates: true },
    ),
    supabase.from("notification_events").upsert(
      {
        application_id: input.application.id,
        applicant_id: input.application.applicant_id,
        auth_user_id: input.profile.auth_user_id,
        channel: "email",
        template_key: "vietnam_status_update",
        recipient: input.profile.email,
        status: "queued",
        idempotency_key: idempotencyKey,
        payload,
        updated_at: now,
      },
      { onConflict: "idempotency_key", ignoreDuplicates: true },
    ),
    input.profile.email
      ? supabase.from("notification_event_log").upsert(
          {
            applicant_id: input.application.applicant_id,
            application_id: input.application.id,
            event: input.documentReady ? "doc_ready" : "decision_issued",
            template_key: "vietnam_status_update",
            channel: "email",
            recipient: input.profile.email,
            payload,
            outcome: "queued",
            retry_count: 0,
            next_attempt_at: now,
            idempotency_key: idempotencyKey,
            ts: now,
          },
          { onConflict: "idempotency_key", ignoreDuplicates: true },
        )
      : Promise.resolve({ error: null }),
  ]);
}

async function queueRetry(check: StatusCheckRow): Promise<void> {
  if (check.attempt_count >= 3) return;
  const retryNumber = check.attempt_count + 1;
  const delayMinutes = retryNumber === 2 ? 15 : 60;
  const scheduledFor = new Date(
    Date.now() + delayMinutes * 60 * 1_000,
  ).toISOString();
  await supabase.from("official_status_checks").insert({
    application_id: check.application_id,
    user_id: check.user_id,
    country_code: "VN",
    provider: "vietnam_evisa",
    status: "queued",
    requested_by: "system",
    trigger_source: "retry",
    idempotency_key: `vn:retry:${check.id}:${retryNumber}`,
    scheduled_for: scheduledFor,
    attempt_count: retryNumber - 1,
    raw_status_json: { source: "bounded_retry", previous_check_id: check.id },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

async function processClaimedCheck(check: StatusCheckRow): Promise<void> {
  const [
    { data: trackingData, error: trackingError },
    { data: applicationData, error: applicationError },
    answers,
  ] = await Promise.all([
    supabase
      .from("official_application_tracking")
      .select(
        "application_id, applicant_id, auth_user_id, official_lookup_email, tracking_status, last_known_status, last_artifact_hash, last_artifact_storage_path, consecutive_failures",
      )
      .eq("application_id", check.application_id)
      .maybeSingle(),
    supabase
      .from("applications")
      .select(
        "id, applicant_id, external_reference, external_status, result_status, result_storage_path",
      )
      .eq("id", check.application_id)
      .maybeSingle(),
    loadAnswers(check.application_id),
  ]);
  if (trackingError || !trackingData) {
    throw new Error(`Vietnam tracking row not found: ${trackingError?.message ?? check.application_id}`);
  }
  if (applicationError || !applicationData) {
    throw new Error(`Vietnam application not found: ${applicationError?.message ?? check.application_id}`);
  }
  const tracking = trackingData as TrackingRow;
  const application = applicationData as ApplicationRow;
  if (tracking.tracking_status !== ACTIVE_TRACKING_STATUS) {
    await supabase
      .from("official_status_checks")
      .update({
        status: "cancelled",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", check.id);
    return;
  }

  const { data: profileData, error: profileError } = await supabase
    .from("applicant_profiles")
    .select("id, auth_user_id, full_name, email, date_of_birth, language_pref")
    .eq("id", tracking.applicant_id)
    .maybeSingle();
  if (profileError || !profileData) {
    throw new Error(`Vietnam applicant profile not found: ${profileError?.message ?? tracking.applicant_id}`);
  }
  const profile = profileData as ProfileRow;
  const registrationCode = application.external_reference?.trim() ?? "";
  const dateOfBirth =
    firstAnswer(answers, ["date_of_birth", "birth_date", "dob"]) ??
    profile.date_of_birth ??
    "";
  if (!registrationCode || !tracking.official_lookup_email || !dateOfBirth) {
    throw new Error(
      "Vietnam status lookup requires registration code, official alias, and date of birth.",
    );
  }

  const result = await queryVietnamOfficialStatus({
    registrationCode,
    email: tracking.official_lookup_email,
    dateOfBirth: toVietnamDob(dateOfBirth),
    headless: process.env.VN_STATUS_PLAYWRIGHT_HEADLESS !== "false",
    searchUrl: process.env.VN_OFFICIAL_STATUS_URL ?? OFFICIAL_STATUS_URL,
    timeoutMs: Number(process.env.VN_STATUS_CHECK_TIMEOUT_MS ?? 180_000),
  });
  if (!isTrustedStatus(result.status)) {
    throw new Error("Vietnam official portal returned an unrecognized status.");
  }

  const artifact =
    result.status === "approved" && result.pdfBytes
      ? await persistOfficialVisa({
          tracking,
          applicationId: application.id,
          visaNumber: result.visaNumber,
          pdfBytes: result.pdfBytes,
        })
      : null;
  const documentReady = Boolean(
    artifact?.storagePath ??
      tracking.last_artifact_storage_path ??
      application.result_storage_path,
  );
  const resultStatus = resultStatusForOfficialStatus(
    result.status,
    documentReady,
  );
  const now = new Date().toISOString();
  const terminal =
    result.status === "rejected" ||
    (result.status === "approved" && documentReady);
  const applicationPatch: Record<string, unknown> = {
    external_status: result.status,
    external_status_updated_at: now,
    result_status: resultStatus,
    updated_at: now,
  };
  if (artifact?.storagePath) {
    applicationPatch.result_storage_path = artifact.storagePath;
    applicationPatch.status = "approved";
  } else if (result.status === "rejected") {
    applicationPatch.status = "rejected";
  }

  const trackingPatch: Record<string, unknown> = {
    last_known_status: result.status,
    last_successful_check_at: now,
    consecutive_failures: 0,
    updated_at: now,
  };
  if (artifact) {
    trackingPatch.last_artifact_hash = artifact.sha256;
    trackingPatch.last_artifact_storage_path = artifact.storagePath;
  }
  if (terminal) {
    trackingPatch.tracking_status = "completed";
    trackingPatch.completed_at = now;
  }

  await Promise.all([
    supabase.from("applications").update(applicationPatch).eq("id", application.id),
    supabase
      .from("official_application_tracking")
      .update(trackingPatch)
      .eq("application_id", application.id),
    supabase
      .from("official_status_checks")
      .update({
        status: "completed",
        official_reference: registrationCode,
        official_status: result.status,
        result_status: resultStatus,
        checked_at: now,
        completed_at: now,
        artifact_storage_path: artifact?.storagePath ?? null,
        artifact_sha256: artifact?.sha256 ?? null,
        raw_status_json: {
          source: "vietnam_evisa_search",
          official_status: result.status,
          visa_number_present: Boolean(result.visaNumber),
          denial_reason_present: Boolean(result.deniedReason),
          download_available: result.downloadAvailable,
          document_ready: documentReady,
        },
        error_code: null,
        error_message: null,
        updated_at: now,
      })
      .eq("id", check.id),
  ]);

  if (
    tracking.last_known_status !== result.status ||
    Boolean(artifact?.changed)
  ) {
    await queueStatusNotification({
      application,
      profile,
      previousStatus: tracking.last_known_status,
      officialStatus: result.status,
      artifactHash: artifact?.changed ? artifact.sha256 : null,
      documentReady,
    });
  }
  if (result.status === "approved" && !documentReady) {
    await queueRetry(check);
  }
}

export async function processQueuedVietnamStatusChecks(): Promise<number> {
  const { data, error } = await supabase.rpc(
    "claim_vn_official_status_checks",
    { p_limit: 5 },
  );
  if (error) {
    if (isSchemaMissing(error)) return 0;
    throw new Error(`Failed to claim Vietnam official status checks: ${error.message}`);
  }
  const rows = (data ?? []) as StatusCheckRow[];
  for (const check of rows) {
    try {
      await processClaimedCheck(check);
    } catch (errorValue) {
      const message =
        errorValue instanceof Error ? errorValue.message : String(errorValue);
      const now = new Date().toISOString();
      await supabase
        .from("official_status_checks")
        .update({
          status: "failed",
          checked_at: now,
          completed_at: now,
          error_code: "official_status_check_failed",
          error_message: message.slice(0, 500),
          raw_status_json: {
            source: "vietnam_evisa_search",
            failed: true,
          },
          updated_at: now,
        })
        .eq("id", check.id);
      const { data: tracking } = await supabase
        .from("official_application_tracking")
        .select("consecutive_failures")
        .eq("application_id", check.application_id)
        .maybeSingle();
      await supabase
        .from("official_application_tracking")
        .update({
          consecutive_failures:
            Number((tracking as { consecutive_failures?: number } | null)?.consecutive_failures ?? 0) + 1,
          updated_at: now,
        })
        .eq("application_id", check.application_id);
      await queueRetry(check).catch(() => undefined);
      console.error(
        `[vn-status] Check ${check.id} failed without changing the last trusted customer status: ${message}`,
      );
    }
  }
  return rows.length;
}
