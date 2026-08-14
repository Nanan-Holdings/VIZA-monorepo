import { supabase } from "../supabase.js";
import { uploadArtifact } from "../artifact-storage.js";
import { extractAuto } from "../inbox/extractors/index.js";
import {
  queryVietnamOfficialStatus,
  toVietnamDob,
  type VietnamStatusCheckResult,
  type VietnamOfficialStatus,
} from "./status-check.js";
import { computeVietnamTrackingSlot } from "./status-tracking-schedule.js";
import {
  shouldPersistVietnamEvisaVersion,
  validateVietnamEvisaPdf,
} from "./evisa-pdf.js";
import {
  claimVietnamOfficialStatusChecks,
  completeVietnamOfficialStatusCheck,
  deferVietnamOfficialStatusCheck,
  failVietnamOfficialStatusCheck,
} from "./status-check-lease.js";
import { enqueueMatchedVietnamStatusEmails } from "./email-status-matcher.js";
import {
  createResilienceGateClient,
  parseResilienceGateCapacity,
  ResilienceGateCapacityDeniedError,
  ResilienceGateConfigurationError,
  ResilienceGateResponseError,
  RESILIENCE_GATE_REQUEST_TIMEOUT_MS,
  type GateLease,
  type ResilienceGateClient,
} from "../resilience-gate.js";

const OFFICIAL_STATUS_URL = "https://evisa.gov.vn/e-visa/search";
const OFFICIAL_EMAIL_PATTERN =
  /(?:evisa\.gov\.vn|xuatnhapcanh\.gov\.vn|immigration\.gov\.vn)/i;
const ACTIVE_TRACKING_STATUS = "active";
const VIETNAM_STATUS_GATE_LEASE_SECONDS = 120;

export class VietnamStatusCheckOwnershipLostError extends Error {
  readonly code = "vietnam_status_check_ownership_lost";

  constructor(message = "Vietnam official status check ownership was lost") {
    super(message);
    this.name = "VietnamStatusCheckOwnershipLostError";
  }
}

export class VietnamStatusGateDeferredError extends Error {
  readonly code = "vietnam_status_gate_deferred";
  readonly reason: "at_capacity" | "capacity_mismatch";
  readonly retryAt: number | undefined;

  constructor(input: {
    reason: "at_capacity" | "capacity_mismatch";
    retryAt?: number;
  }) {
    super(`Vietnam status provider gate deferred: ${input.reason}`);
    this.name = "VietnamStatusGateDeferredError";
    this.reason = input.reason;
    this.retryAt = input.retryAt;
  }
}

function isVietnamStatusCheckOwnershipLostError(error: unknown): boolean {
  return error instanceof VietnamStatusCheckOwnershipLostError;
}

function isPermanentResilienceGateError(error: unknown): boolean {
  return (
    error instanceof ResilienceGateConfigurationError ||
    error instanceof ResilienceGateResponseError
  );
}

function safeGateOwnerRef(workerId: string, checkId: string): string {
  const normalize = (value: string, fallback: string): string => {
    const normalized = value.replace(/[^A-Za-z0-9._:-]/g, "").slice(0, 96);
    return normalized || fallback;
  };
  return `vn-status:${normalize(workerId, "worker")}:${normalize(checkId, "check")}`;
}

export function vietnamStatusGateCapacity(env: NodeJS.ProcessEnv = process.env): number {
  return parseResilienceGateCapacity(env.RESILIENCE_VN_STATUS_GATE_CAPACITY);
}

export async function withVietnamStatusResilienceGate<T>(input: {
  workerId: string;
  checkId: string;
  operation: (context: { assertOwned: () => void }) => Promise<T>;
}, gateClient: ResilienceGateClient = createResilienceGateClient()): Promise<T> {
  let lease: GateLease | null = null;
  try {
    const gateEnabled =
      process.env.RESILIENCE_VN_STATUS_GATE_ENABLED?.trim().toLowerCase() === "true";
    lease = await gateClient.acquire({
      scope: "vietnam",
      resourceKey: "evisa/status",
      capacity: gateEnabled ? vietnamStatusGateCapacity() : 1,
      leaseSeconds: VIETNAM_STATUS_GATE_LEASE_SECONDS,
      ownerRef: safeGateOwnerRef(input.workerId, input.checkId),
    });
  } catch (error) {
    if (error instanceof ResilienceGateCapacityDeniedError) {
      throw new VietnamStatusGateDeferredError({
        reason: error.reason,
        retryAt: error.retryAt,
      });
    }
    throw error;
  }

  if (!lease) return input.operation({ assertOwned: () => undefined });

  let ownershipLost = false;
  let stopped = false;
  let renewTimer: ReturnType<typeof setTimeout> | null = null;
  let renewInFlight: Promise<void> | null = null;
  let currentLease = lease;
  const markOwnershipLost = (): void => {
    ownershipLost = true;
  };
  const assertOwned = (): void => {
    if (ownershipLost || Date.now() >= currentLease.leaseUntil) {
      ownershipLost = true;
      throw new VietnamStatusCheckOwnershipLostError();
    }
  };
  const scheduleRenew = (): void => {
    if (ownershipLost || stopped) return;
    const remainingMs = Math.max(1_000, currentLease.leaseUntil - Date.now());
    const jitterMs = Math.min(1_000, Math.max(250, Math.floor(remainingMs * 0.01)));
    const delayMs = Math.max(
      1_000,
      Math.floor(remainingMs * 0.4) - RESILIENCE_GATE_REQUEST_TIMEOUT_MS - jitterMs,
    );
    renewTimer = setTimeout(() => {
      renewTimer = null;
      renewInFlight = (async () => {
        if (ownershipLost || stopped) return;
        try {
          const renewed = await gateClient.renew(
            currentLease,
            VIETNAM_STATUS_GATE_LEASE_SECONDS,
          );
          if (!renewed) {
            markOwnershipLost();
            return;
          }
          currentLease = renewed;
          if (!stopped) scheduleRenew();
        } catch {
          markOwnershipLost();
        }
      })().catch(() => {
        markOwnershipLost();
      });
    }, delayMs);
  };

  scheduleRenew();
  let result: T | undefined;
  let operationError: unknown;
  let operationFailed = false;
  try {
    result = await input.operation({ assertOwned });
    assertOwned();
  } catch (error) {
    operationFailed = true;
    operationError = error;
  } finally {
    stopped = true;
    if (renewTimer) clearTimeout(renewTimer);
    if (renewInFlight) await renewInFlight;
    try {
      const released = await gateClient.release(currentLease);
      if (!released) console.warn("[vn-status] resilience_gate_release_failed");
    } catch {
      console.warn("[vn-status] resilience_gate_release_failed");
    }
    if (Date.now() >= currentLease.leaseUntil) ownershipLost = true;
  }
  if (ownershipLost) throw new VietnamStatusCheckOwnershipLostError();
  if (operationFailed) throw operationError;
  return result as T;
}

export async function runVietnamStatusPortalCheckWithGate(
  input: {
    workerId: string;
    checkId: string;
    runPortal: () => Promise<VietnamStatusCheckResult>;
  },
  gateClient: ResilienceGateClient = createResilienceGateClient(),
): Promise<VietnamStatusCheckResult> {
  return withVietnamStatusResilienceGate(
    {
      workerId: input.workerId,
      checkId: input.checkId,
      operation: async () => {
        const result = await input.runPortal();
        if (!isTrustedStatus(result.status)) {
          throw new Error("Vietnam official portal returned an unrecognized status.");
        }
        return result;
      },
    },
    gateClient,
  );
}

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

export interface VietnamStatusCheckBatchDependencies {
  claim: (workerId: string) => Promise<StatusCheckRow[]>;
  processCheck: (check: StatusCheckRow, workerId: string) => Promise<void>;
  defer?: (
    check: StatusCheckRow,
    workerId: string,
    retryAfterSeconds: number,
  ) => Promise<boolean>;
  fail?: (
    check: StatusCheckRow,
    workerId: string,
    message: string,
  ) => Promise<boolean>;
  afterFailure?: (check: StatusCheckRow, message: string) => Promise<void>;
  /** Optional test/diagnostic hook; production settlement remains in processCheck. */
  complete?: (check: StatusCheckRow, workerId: string) => Promise<boolean>;
}

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

type IdempotentInsertResult = {
  error: {
    code?: string;
    message: string;
  } | null;
};

export interface ActivateVietnamStatusTrackingInput {
  applicationId: string;
  applicantId: string;
  authUserId: string;
  officialLookupEmail: string;
}

export async function insertIgnoringDuplicate(
  insert: PromiseLike<IdempotentInsertResult>,
): Promise<boolean> {
  const { error } = await insert;
  if (!error) return true;
  if (error.code === "23505") return false;
  throw new Error(error.message);
}

function isSchemaMissing(error: unknown): boolean {
  const value = error as { code?: unknown; message?: unknown } | null;
  const message =
    typeof value?.message === "string"
      ? value.message.toLowerCase()
      : String(error).toLowerCase();
  const namesTrackingSchemaObject =
    message.includes("official_application_tracking") ||
    message.includes("claim_vn_official_status_checks") ||
    message.includes("complete_vn_official_status_check") ||
    message.includes("fail_vn_official_status_check") ||
    message.includes("enqueue_due_vn_official_status_checks");
  return (
    value?.code === "PGRST202" ||
    value?.code === "PGRST204" ||
    value?.code === "PGRST205" ||
    value?.code === "42P01" ||
    value?.code === "42883" ||
    (namesTrackingSchemaObject &&
      (/schema cache/.test(message) ||
        /could not find/.test(message) ||
        /does not exist/.test(message)))
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

  const parsedEmails = officialMessages.map((email) => {
    const parsed = extractAuto({
      from: email.from_addr,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
    const normalizedReference = normalizeReference(parsed.reference);
    return {
      emailId: email.id,
      normalizedReference: normalizedReference || null,
    };
  });
  const counts = await enqueueMatchedVietnamStatusEmails(supabase, parsedEmails);
  return counts.queued;
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
    insertIgnoringDuplicate(
      supabase.from("application_events").insert({
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
      }),
    ),
    insertIgnoringDuplicate(
      supabase.from("notification_events").insert({
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
      }),
    ),
    input.profile.email
      ? insertIgnoringDuplicate(
          supabase.from("notification_event_log").insert({
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
          }),
        )
      : Promise.resolve(true),
  ]);
}

async function queueRetry(check: StatusCheckRow): Promise<void> {
  if (check.attempt_count >= 3) return;
  const retryNumber = check.attempt_count + 1;
  const delayMinutes = retryNumber === 2 ? 15 : 60;
  const scheduledFor = new Date(
    Date.now() + delayMinutes * 60 * 1_000,
  ).toISOString();
  await insertIgnoringDuplicate(
    supabase.from("official_status_checks").insert({
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
    }),
  );
}

async function processClaimedCheck(
  check: StatusCheckRow,
  workerId: string,
): Promise<void> {
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
    const cancelled = await completeVietnamOfficialStatusCheck(supabase, {
      checkId: check.id,
      workerId,
      patch: { status: "cancelled" },
    });
    if (!cancelled) {
      throw new VietnamStatusCheckOwnershipLostError();
    }
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

  const result = await runVietnamStatusPortalCheckWithGate({
    workerId,
    checkId: check.id,
    runPortal: () => queryVietnamOfficialStatus({
      registrationCode,
      email: tracking.official_lookup_email,
      dateOfBirth: toVietnamDob(dateOfBirth),
      headless: process.env.VN_STATUS_PLAYWRIGHT_HEADLESS !== "false",
      searchUrl: process.env.VN_OFFICIAL_STATUS_URL ?? OFFICIAL_STATUS_URL,
      timeoutMs: Number(process.env.VN_STATUS_CHECK_TIMEOUT_MS ?? 180_000),
    }),
  });

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
  ]);

  const completed = await completeVietnamOfficialStatusCheck(supabase, {
    checkId: check.id,
    workerId,
    patch: {
      status: "completed",
      official_reference: registrationCode,
      official_status: result.status,
      result_status: resultStatus,
      checked_at: now,
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
    },
  });
  if (!completed) {
    throw new VietnamStatusCheckOwnershipLostError();
  }

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

function retryAfterSecondsFromGate(retryAt: number | undefined): number {
  if (typeof retryAt !== "number" || !Number.isSafeInteger(retryAt)) return 30;
  const remainingSeconds = Math.ceil((retryAt - Date.now()) / 1_000);
  return Math.max(1, Math.min(300, remainingSeconds));
}

async function defaultVietnamStatusCheckFailure(
  check: StatusCheckRow,
  workerId: string,
  message: string,
): Promise<boolean> {
  return failVietnamOfficialStatusCheck(supabase, {
    checkId: check.id,
    workerId,
    errorCode: "official_status_check_failed",
    errorMessage: message.slice(0, 500),
    rawStatusJson: {
      source: "vietnam_evisa_search",
      failed: true,
    },
  });
}

async function recordVietnamStatusCheckFailure(
  check: StatusCheckRow,
  message: string,
): Promise<void> {
  const now = new Date().toISOString();
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

export async function processQueuedVietnamStatusChecksWithDependencies(
  workerId: string,
  dependencies: VietnamStatusCheckBatchDependencies,
): Promise<number> {
  let rows: StatusCheckRow[];
  try {
    rows = await dependencies.claim(workerId);
  } catch (error) {
    if (isSchemaMissing(error)) return 0;
    throw error;
  }

  const defer = dependencies.defer ?? (async (
    check: StatusCheckRow,
    owner: string,
    retryAfterSeconds: number,
  ) => deferVietnamOfficialStatusCheck(supabase, {
    checkId: check.id,
    workerId: owner,
    retryAfterSeconds,
  }));
  const fail = dependencies.fail ?? defaultVietnamStatusCheckFailure;
  const afterFailure = dependencies.afterFailure ?? recordVietnamStatusCheckFailure;
  let processed = 0;

  for (const check of rows) {
    try {
      await dependencies.processCheck(check, workerId);
      processed += 1;
    } catch (errorValue) {
      if (errorValue instanceof VietnamStatusGateDeferredError) {
        const retryAfterSeconds = retryAfterSecondsFromGate(errorValue.retryAt);
        try {
          const deferred = await defer(check, workerId, retryAfterSeconds);
          if (!deferred) {
            console.warn("[vn-status] resilience_gate_deferred_ownership_lost");
          } else {
            console.warn("[vn-status] resilience_gate_deferred");
          }
        } catch {
          console.warn("[vn-status] resilience_gate_defer_failed");
        }
        continue;
      }
      if (isVietnamStatusCheckOwnershipLostError(errorValue)) {
        console.warn(
          `[vn-status] Check ${check.id} ownership was lost; final settlement was skipped.`,
        );
        continue;
      }
      if (isPermanentResilienceGateError(errorValue)) {
        console.error("[vn-status] resilience_gate_permanent_error");
        throw errorValue;
      }
      const message =
        errorValue instanceof Error ? errorValue.message : String(errorValue);
      const failed = await fail(check, workerId, message);
      if (!failed) {
        console.warn(
          `[vn-status] Check ${check.id} failure was not persisted because the lease is no longer owned.`,
        );
        continue;
      }
      processed += 1;
      await afterFailure(check, message);
    }
  }
  return processed;
}

export async function processQueuedVietnamStatusChecks(workerId: string): Promise<number> {
  return processQueuedVietnamStatusChecksWithDependencies(workerId, {
    claim: async (owner) => claimVietnamOfficialStatusChecks<StatusCheckRow>(supabase, {
      workerId: owner,
      limit: 5,
      leaseSeconds: 300,
    }),
    processCheck: processClaimedCheck,
  });
}
