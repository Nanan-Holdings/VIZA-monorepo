import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/resend";
import {
  DS160_PROOF_QUEUE_STATUS,
  fileNameForKind,
  resolveDs160ProofAction,
  type Ds160ProofKind,
} from "@/lib/ds160-proof";

const ARTIFACT_BUCKET = "submission-artifacts";

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
  emailMode?: unknown;
  email?: unknown;
};

function readProofKind(value: unknown): Ds160ProofKind | null {
  return value === "confirmation" || value === "application" || value === "email-confirmation"
    ? value
    : null;
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeArtifactPath(value: string): string | null {
  const path = value.trim().replace(/\\/g, "/");
  if (!path || path.startsWith("/") || path.includes("..") || /^https?:\/\//i.test(path)) return null;
  return path;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function loadOwnedApplication(applicationId: string): Promise<
  | { ok: true; admin: ReturnType<typeof createAdminClient>; application: ApplicationRow; profile: ProfileRow }
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
  return { ok: true, admin, application, profile };
}

async function enqueueProofJob(
  admin: ReturnType<typeof createAdminClient>,
  applicationId: string,
): Promise<{ jobId: string | null }> {
  const now = new Date().toISOString();
  await admin
    .from("submission_queue")
    .update({ status: "retry_superseded", updated_at: now })
    .eq("application_id", applicationId)
    .in("status", ["ds160_proof_pending", "ds160_proof_processing", "ds160_proof_failed"]);

  const { data, error } = await admin
    .from("submission_queue")
    .insert({
      application_id: applicationId,
      status: DS160_PROOF_QUEUE_STATUS,
      mode: "live_assisted",
      provider: "ceac_proof",
      attempts: 0,
      last_error: null,
      current_stage: "queued",
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { jobId: (data as { id?: string | null } | null)?.id ?? null };
}

async function sendProofEmail(input: {
  admin: ReturnType<typeof createAdminClient>;
  applicationId: string;
  profile: ProfileRow;
  result: Record<string, unknown>;
  storagePath: string;
  to: string;
}): Promise<{ id: string }> {
  const path = normalizeArtifactPath(input.storagePath);
  if (!path || !path.split("/").includes(input.applicationId)) {
    throw new Error("Invalid DS-160 proof artifact path.");
  }
  const { data: file, error } = await input.admin.storage.from(ARTIFACT_BUCKET).download(path);
  if (error || !file) throw new Error(error?.message ?? "Could not download DS-160 proof PDF.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const applicationLabel =
    typeof input.result.applicationId === "string" ? input.result.applicationId : input.applicationId;
  const sent = await sendEmail({
    from: "VIZA <updates@haggstorm.com>",
    to: input.to,
    subject: `DS-160 confirmation ${applicationLabel}`,
    text:
      `您好，\n\n您的 DS-160 确认证明已附在本邮件中。\n\nApplication ID: ${applicationLabel}\n\nVIZA`,
    attachments: [
      {
        filename: fileNameForKind("email-confirmation", applicationLabel),
        content: bytes.toString("base64"),
        contentType: "application/pdf",
      },
    ],
  });
  return sent;
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
  const action = resolveDs160ProofAction(applicationId, kind, loaded.application.submission_result);
  if (action.status === "queued") {
    const { data: queue } = await loaded.admin
      .from("submission_queue")
      .select("id,status,last_error,error_message,updated_at")
      .eq("application_id", applicationId)
      .in("status", ["ds160_proof_pending", "ds160_proof_processing", "ds160_proof_failed"])
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    const proofQueue = queue as { id?: string; status?: string; last_error?: string | null; error_message?: string | null } | null;
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

  const proofAction = resolveDs160ProofAction(applicationId, kind, loaded.application.submission_result);
  if (proofAction.status === "unsupported") {
    return NextResponse.json({ error: proofAction.reason }, { status: 400 });
  }
  if (proofAction.status === "queued") {
    try {
      const job = await enqueueProofJob(loaded.admin, applicationId);
      return NextResponse.json({
        ok: true,
        status: "queued",
        jobId: job.jobId,
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

  const result = isRecord(loaded.application.submission_result) ? loaded.application.submission_result : {};
  const emailMode = body.emailMode === "custom" ? "custom" : "account";
  const recipient = emailMode === "custom"
    ? (typeof body.email === "string" ? body.email.trim() : "")
    : loaded.profile.email?.trim() ?? "";
  if (!recipient || !isEmail(recipient)) {
    return NextResponse.json({ error: "请输入有效的收件邮箱。" }, { status: 422 });
  }

  try {
    const sent = await sendProofEmail({
      admin: loaded.admin,
      applicationId,
      profile: loaded.profile,
      result,
      storagePath: proofAction.storagePath,
      to: recipient,
    });
    return NextResponse.json({
      ok: true,
      status: "sent",
      emailId: sent.id,
      recipient,
      message: "DS-160 证明文件已发送。",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
