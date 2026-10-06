import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { wakeCloudSubmissionWorker } from "@/lib/submission-worker-wake.server";
import { isRunnerCutoverPaused } from "@/lib/runner-cutover-pause.server";
import {
  ds160ProofEmailAccountOnlyResponse,
  ds160ProofEmailRequestInvalidResponse,
  readDs160ProofEmailStatus,
  resolveDs160ProofAction,
  type Ds160ProofKind,
  type Ds160ProofEmailQueueState,
  type Ds160ProofEmailStatus,
} from "@/lib/ds160-proof";

type ApplicationRow = {
  id: string;
  applicant_id: string;
  submission_result: unknown | null;
  submission_result_status: string | null;
};

type ProfileRow = {
  id: string;
  auth_user_id: string | null;
  full_name: string | null;
  email: string | null;
};

type ProofRequest = {
  kind?: unknown;
  action?: unknown;
  recipientMode?: unknown;
  requestId?: unknown;
  retry?: unknown;
};

function readProofKind(value: unknown): Ds160ProofKind | null {
  return value === "confirmation" || value === "application" || value === "email-confirmation"
    ? value
    : null;
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function loadOwnedApplication(applicationId: string): Promise<
  | {
      ok: true;
      admin: ReturnType<typeof createAdminClient>;
      application: ApplicationRow;
      profile: ProfileRow;
      authUserId: string;
      authUserEmail: string;
    }
  | { ok: false; response: Response }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }

  const admin = createAdminClient();
  const { data: profileData, error: profileError } = await admin
    .from("applicant_profiles")
    .select("id, auth_user_id, full_name, email")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (profileError) {
    return { ok: false, response: NextResponse.json({ error: profileError.message }, { status: 500 }) };
  }
  const profile = profileData as ProfileRow | null;
  if (!profile) {
    return { ok: false, response: NextResponse.json({ error: "Applicant profile not found" }, { status: 404 }) };
  }

  const { data: applicationData, error: applicationError } = await admin
    .from("applications")
    .select("id, applicant_id, submission_result, submission_result_status")
    .eq("id", applicationId)
    .maybeSingle();
  if (applicationError) {
    return { ok: false, response: NextResponse.json({ error: applicationError.message }, { status: 500 }) };
  }
  const application = applicationData as ApplicationRow | null;
  if (!application) {
    return { ok: false, response: NextResponse.json({ error: "Application not found" }, { status: 404 }) };
  }
  if (application.applicant_id !== profile.id) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return {
    ok: true,
    admin,
    application,
    profile,
    authUserId: user.id,
    authUserEmail: user.email?.trim() ?? "",
  };
}

async function loadLatestProofQueue(
  admin: ReturnType<typeof createAdminClient>,
  applicationId: string,
): Promise<{
  row: { id?: string; status?: string; last_error?: string | null; error_message?: string | null } | null;
  readFailed: boolean;
}> {
  const { data, error } = await admin
    .from("submission_queue")
    .select("id,status,last_error,error_message,updated_at")
    .eq("application_id", applicationId)
    .in("status", ["ds160_proof_pending", "ds160_proof_processing", "ds160_proof_failed", "done"])
    .in("provider", ["ceac_proof"])
    .or("ceac_result_payload->>action.is.null,ceac_result_payload->>action.neq.official_ceac_email")
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (error) return { row: null, readFailed: true };
  return {
    row: data as { id?: string; status?: string; last_error?: string | null; error_message?: string | null } | null,
    readFailed: false,
  };
}

type OfficialEmailQueueRow = Ds160ProofEmailQueueState & {
  id?: string;
  last_error?: string | null;
  error_message?: string | null;
  updated_at?: string | null;
};

async function loadLatestOfficialEmailQueue(
  admin: ReturnType<typeof createAdminClient>,
  applicationId: string,
  jobId?: string,
): Promise<{ row: OfficialEmailQueueRow | null; readFailed: boolean }> {
  let query = admin
    .from("submission_queue")
    .select("id,status,current_stage,locked_until,ceac_result_payload,last_error,error_message,updated_at")
    .eq("application_id", applicationId)
    .in("status", ["ds160_proof_pending", "ds160_proof_processing", "processing", "failed", "ds160_proof_failed", "done"])
    .in("provider", ["ceac_proof"])
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(jobId ? 20 : 50);
  if (jobId) query = query.eq("id", jobId);
  const { data, error } = await query;
  if (error || !Array.isArray(data)) return { row: null, readFailed: true };
  const rows = data as OfficialEmailQueueRow[];
  return {
    row: rows.find((row) => {
      const payload = asRecord(row.ceac_result_payload);
      return payload?.action === "official_ceac_email";
    }) ?? null,
    readFailed: false,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function nestedRecord(value: unknown, key: string): Record<string, unknown> | null {
  return asRecord(asRecord(value)?.[key]);
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readOfficialEmailPayload(row: OfficialEmailQueueRow | null): {
  status: Ds160ProofEmailStatus;
  requestId?: string;
  recipientSha256?: string;
  errorCode?: string;
  errorMessage?: string;
} {
  const payload = asRecord(row?.ceac_result_payload);
  const email = nestedRecord(payload, "email");
  return {
    status: readDs160ProofEmailStatus(row),
    requestId: stringValue(email?.request_id) ?? undefined,
    recipientSha256: stringValue(email?.recipient_sha256) ?? undefined,
    errorCode: stringValue(email?.code) ?? stringValue(payload?.error_code) ?? undefined,
    errorMessage: stringValue(email?.error) ?? stringValue(row?.error_message) ?? stringValue(row?.last_error) ?? undefined,
  };
}

function safeOfficialEmailError(status: "failed" | "unknown"): { code: string; error: string } {
  return status === "unknown"
    ? {
        code: "ds160_proof_email_unknown",
        error: "CEAC did not return a clear email receipt. Your application remains submitted and the saved confirmation PDF is available. Email delivery has not been confirmed.",
      }
    : {
        code: "ds160_proof_email_failed",
        error: "The automatic CEAC confirmation email could not be completed. Your application remains submitted and the saved confirmation PDF is available.",
      };
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}

function normalizedEmailHash(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase(), "utf8").digest("hex");
}

function mapEmailQueueRow(value: unknown): OfficialEmailQueueRow | null {
  const row = Array.isArray(value) ? value[0] : value;
  const record = asRecord(row);
  if (!record) return null;
  return {
    id: stringValue(record.id) ?? undefined,
    status: stringValue(record.status) ?? undefined,
    current_stage: stringValue(record.current_stage) ?? undefined,
    locked_until: stringValue(record.locked_until),
    ceac_result_payload: record.ceac_result_payload,
    last_error: stringValue(record.last_error) ?? undefined,
    error_message: stringValue(record.error_message) ?? undefined,
    updated_at: stringValue(record.updated_at) ?? undefined,
  };
}

function missingProofMessage(kind: Ds160ProofKind): string {
  if (kind === "application") {
    return "CEAC 当前没有返回可下载的 Print Application 官方 PDF。Print Confirmation 已保存，可直接下载或发送邮件。";
  }
  return "CEAC proof recovery completed, but the requested official PDF was not returned.";
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: applicationId } = await context.params;
  const kind = readProofKind(new URL(request.url).searchParams.get("kind"));
  if (!applicationId || !kind) {
    return NextResponse.json({ error: "Missing application id or DS-160 proof kind" }, { status: 400 });
  }

  const loaded = await loadOwnedApplication(applicationId);
  if (!loaded.ok) return loaded.response;
  const searchParams = new URL(request.url).searchParams;
  if (kind === "email-confirmation" && searchParams.get("action") === "email") {
    const emailQueueResult = await loadLatestOfficialEmailQueue(
      loaded.admin,
      applicationId,
      searchParams.get("jobId") ?? undefined,
    );
    if (emailQueueResult.readFailed) {
      return NextResponse.json(
        {
          ok: false,
          status: "unavailable",
          code: "ds160_proof_email_unavailable",
          error: "The official DS-160 confirmation email status is temporarily unavailable. Please refresh and try again.",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    const emailQueue = emailQueueResult.row;
    const emailPayload = readOfficialEmailPayload(emailQueue);
    const proofAction = resolveDs160ProofAction(applicationId, kind, loaded.application.submission_result);
    const response: Record<string, unknown> = {
      ok: true,
      status: emailPayload.status,
      jobId: emailQueue?.id ?? null,
      currentStage: emailQueue?.current_stage ?? null,
      recipient: loaded.authUserEmail,
      ...(proofAction.status === "ready" ? { downloadUrl: proofAction.downloadUrl } : {}),
    };
    if (emailPayload.status === "failed" || emailPayload.status === "unknown") {
      Object.assign(response, safeOfficialEmailError(emailPayload.status));
    }
    return NextResponse.json(response, { headers: { "Cache-Control": "no-store" } });
  }
  const action = resolveDs160ProofAction(applicationId, kind, loaded.application.submission_result);
  if (action.status === "queued") {
    const proofQueueResult = await loadLatestProofQueue(loaded.admin, applicationId);
    if (proofQueueResult.readFailed) {
      return NextResponse.json(
        {
          ok: false,
          status: "unavailable",
          code: "ds160_proof_unavailable",
          error: "The official DS-160 proof status is temporarily unavailable. Please refresh and try again.",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    const proofQueue = proofQueueResult.row;
    if (proofQueue?.status === "ds160_proof_failed") {
      return NextResponse.json(
        {
          ok: false,
          status: "failed",
          jobId: proofQueue.id ?? null,
          error: proofQueue.error_message ?? proofQueue.last_error ?? "CEAC proof recovery failed.",
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (proofQueue?.status === "done") {
      return NextResponse.json(
        {
          ok: false,
          status: "failed",
          jobId: proofQueue.id ?? null,
          error: missingProofMessage(kind),
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (proofQueue?.status) {
      return NextResponse.json(
        { ok: true, status: "queued", jobId: proofQueue.id ?? null },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
  }
  return NextResponse.json({ ok: action.status !== "unsupported", ...action }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: applicationId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as ProofRequest;
  const kind = readProofKind(body.kind);
  const requestedAction = body.action === "email" ? "email" : "download";
  if (!applicationId || !kind) {
    return NextResponse.json({ error: "Missing application id or DS-160 proof kind" }, { status: 400 });
  }

  const loaded = await loadOwnedApplication(applicationId);
  if (!loaded.ok) return loaded.response;

  if (kind === "email-confirmation" && requestedAction === "email") {
    const rawBody = body as unknown as Record<string, unknown>;
    if (
      body.recipientMode !== "account" ||
      rawBody.emailMode === "custom" ||
      typeof rawBody.email === "string"
    ) {
      return NextResponse.json(ds160ProofEmailAccountOnlyResponse(), { status: 422 });
    }
    if (!isEmail(loaded.authUserEmail) || !isUuid(body.requestId)) {
      return NextResponse.json(ds160ProofEmailRequestInvalidResponse(), { status: 422 });
    }
    const proofAction = resolveDs160ProofAction(applicationId, kind, loaded.application.submission_result);
    if (proofAction.status === "unsupported") {
      return NextResponse.json({ error: proofAction.reason }, { status: 400 });
    }
    if (isRunnerCutoverPaused()) {
      return NextResponse.json(
        {
          error: "DS-160 proof recovery is temporarily paused for a controlled runner cutover.",
          code: "runner_cutover_paused",
        },
        { status: 503 },
      );
    }

    const { data: rpcData, error: rpcError } = await loaded.admin.rpc("enqueue_ds160_proof_email", {
      p_application_id: applicationId,
      p_auth_user_id: loaded.authUserId,
      p_request_id: body.requestId,
      p_recipient_sha256: normalizedEmailHash(loaded.authUserEmail),
      p_retry: body.retry === true,
    });
    if (rpcError) {
      console.error("[ds160-proof] official email enqueue failed", { code: rpcError.code ?? "rpc_error" });
      return NextResponse.json(
        { code: "ds160_proof_email_unavailable", error: "The official DS-160 confirmation email is temporarily unavailable. Please try again later." },
        { status: 503 },
      );
    }

    const emailQueue = mapEmailQueueRow(rpcData);
    const emailPayload = readOfficialEmailPayload(emailQueue);
    const response: Record<string, unknown> = {
      ok: true,
      status: emailPayload.status,
      jobId: emailQueue?.id ?? null,
      currentStage: emailQueue?.current_stage ?? null,
      recipient: loaded.authUserEmail,
      ...(proofAction.status === "ready" ? { downloadUrl: proofAction.downloadUrl } : {}),
    };
    if (emailPayload.status === "failed" || emailPayload.status === "unknown") {
      Object.assign(response, safeOfficialEmailError(emailPayload.status));
    }
    if (emailPayload.status === "queued" && emailQueue?.id) {
      const wake = await wakeCloudSubmissionWorker(emailQueue.id, { target: "legacy" });
      if (!wake.ok) {
        console.warn("[submission-queue] official DS-160 email wake failed; durable queue remains recoverable.", {
          jobId: emailQueue.id,
        });
      }
    }
    const httpStatus = emailPayload.status === "failed" || emailPayload.status === "unknown"
      ? 409
      : emailPayload.status === "queued" || emailPayload.status === "sending"
        ? 202
        : 200;
    return NextResponse.json(response, { status: httpStatus, headers: { "Cache-Control": "no-store" } });
  }

  const proofAction = resolveDs160ProofAction(applicationId, kind, loaded.application.submission_result);
  if (proofAction.status === "unsupported") {
    return NextResponse.json({ error: proofAction.reason }, { status: 400 });
  }
  if (proofAction.status === "queued") {
    if (isRunnerCutoverPaused()) {
      return NextResponse.json(
        {
          error: "DS-160 proof recovery is temporarily paused for a controlled runner cutover.",
          code: "runner_cutover_paused",
        },
        { status: 503 },
      );
    }
    const latestProofQueueResult = await loadLatestProofQueue(loaded.admin, applicationId);
    if (latestProofQueueResult.readFailed) {
      return NextResponse.json(
        {
          error: "The official DS-160 proof status is temporarily unavailable. Please refresh and try again.",
          code: "ds160_proof_unavailable",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    const latestProofQueue = latestProofQueueResult.row;
    if (latestProofQueue?.status === "done") {
      return NextResponse.json(
        { ok: false, status: "failed", jobId: latestProofQueue.id ?? null, error: missingProofMessage(kind) },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }
    try {
      const { data: rpcData, error: rpcError } = await loaded.admin.rpc("enqueue_ds160_proof_download", {
        p_application_id: applicationId,
        p_auth_user_id: loaded.authUserId,
      });
      if (rpcError) throw new Error("DS-160 proof recovery could not be queued.");
      const row = mapEmailQueueRow(rpcData);
      const jobId = row?.id ?? null;
      const wake = await wakeCloudSubmissionWorker(jobId, { target: "legacy" });
      if (!wake.ok) {
        console.warn("[submission-queue] DS-160 proof queue wake failed; durable queue remains recoverable.", wake);
      }
      return NextResponse.json({
        ok: true,
        status: "queued",
        jobId,
        message: "正在从 CEAC 官方网站找回 DS-160 证明文件。",
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : String(error) },
        { status: 500 },
      );
    }
  }

  if (requestedAction !== "email") {
    return NextResponse.json({ ok: true, status: "ready", downloadUrl: proofAction.downloadUrl });
  }

  return NextResponse.json(
    { error: "Unsupported DS-160 proof action." },
    { status: 400 },
  );
}
