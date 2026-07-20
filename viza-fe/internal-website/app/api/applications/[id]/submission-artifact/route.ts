import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getImpersonationSession } from "@/lib/impersonation-session";
import { getClientSessionFromRequest } from "@/lib/client-session";

const ARTIFACT_BUCKET = "submission-artifacts";
const MAX_QR_UPLOAD_BYTES = 5 * 1024 * 1024;

function normalizeArtifactPath(value: string | null): string | null {
  const path = value?.trim().replace(/\\/g, "/");
  if (!path) return null;
  if (path.startsWith("/") || path.includes("..") || /^https?:\/\//i.test(path)) return null;
  return path;
}

function belongsToApplication(path: string, applicationId: string): boolean {
  return path.split("/").includes(applicationId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasImageSignature(bytes: Uint8Array, contentType: string): boolean {
  if (contentType === "image/png") {
    return (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }
  return (
    contentType === "image/jpeg" &&
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  );
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: applicationId } = await ctx.params;
  const { searchParams } = new URL(request.url);
  const path = normalizeArtifactPath(searchParams.get("path"));
  const downloadName = searchParams.get("download")?.trim() || undefined;
  const inline = searchParams.get("inline") === "1";

  if (!applicationId || !path) {
    return NextResponse.json({ error: "Missing application id or artifact path" }, { status: 400 });
  }
  if (!belongsToApplication(path, applicationId)) {
    return NextResponse.json({ error: "Artifact does not belong to this application" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: app, error: appErr } = await admin
    .from("applications")
    .select("id, applicant_id")
    .eq("id", applicationId)
    .maybeSingle();
  if (appErr || !app) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const impersonation = await getImpersonationSession();
  if (!impersonation) {
    const legacySession = await getClientSessionFromRequest(request);
    let authUserId: string | null = null;
    if (!legacySession) {
      const supabase = await createClient();
      const { data: auth } = await supabase.auth.getUser();
      authUserId = auth.user?.id ?? null;
    }
    if (!legacySession && !authUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileQuery = admin
      .from("applicant_profiles")
      .select("id, auth_user_id")
      .eq("id", app.applicant_id);
    const { data: profile } = await profileQuery.maybeSingle();
    if (!profile || (legacySession ? profile.id !== legacySession.userId : profile.auth_user_id !== authUserId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { data: file, error: downloadErr } = await admin.storage
    .from(ARTIFACT_BUCKET)
    .download(path);

  if (downloadErr || !file) {
    return NextResponse.json({ error: "Could not download artifact" }, { status: 500 });
  }

  const headers = new Headers();
  headers.set("Content-Type", file.type || "application/octet-stream");
  const filename = (downloadName || path.split("/").at(-1) || "submission-artifact").replace(/"/g, "");
  // Only stored images may be rendered inline. PDFs and other artifacts remain downloads.
  headers.set(
    "Content-Disposition",
    inline && file.type.startsWith("image/")
      ? `inline; filename="${filename}"`
      : `attachment; filename="${filename}"`,
  );
  headers.set("Cache-Control", "private, no-store");
  return new NextResponse(file, { headers });
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: applicationId } = await ctx.params;
  if (!applicationId) {
    return NextResponse.json({ error: "Missing application id" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: app, error: appErr } = await admin
    .from("applications")
    .select("id, applicant_id, country, visa_type, submission_result")
    .eq("id", applicationId)
    .maybeSingle();
  if (appErr || !app) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  const normalizedCountry = app.country?.trim().toUpperCase() ?? "";
  if (
    !["VN", "VIETNAM", "越南"].includes(normalizedCountry) ||
    app.visa_type !== "VN_PREARRIVAL_DECLARATION"
  ) {
    return NextResponse.json(
      { error: "QR recovery is only available for Vietnam Pre-Arrival declarations" },
      { status: 422 },
    );
  }

  const legacySession = await getClientSessionFromRequest(request);
  let authUserId: string | null = null;
  if (!legacySession) {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    authUserId = auth.user?.id ?? null;
  }
  if (!legacySession && !authUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await admin
    .from("applicant_profiles")
    .select("id, auth_user_id")
    .eq("id", app.applicant_id)
    .maybeSingle();
  if (
    !profile ||
    (legacySession
      ? profile.id !== legacySession.userId
      : profile.auth_user_id !== authUserId)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("qr");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing QR image" }, { status: 400 });
  }
  if (
    !["image/png", "image/jpeg"].includes(file.type) ||
    file.size <= 0 ||
    file.size > MAX_QR_UPLOAD_BYTES
  ) {
    return NextResponse.json(
      { error: "QR image must be a PNG or JPEG no larger than 5 MB" },
      { status: 422 },
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasImageSignature(bytes, file.type)) {
    return NextResponse.json({ error: "QR image content is invalid" }, { status: 422 });
  }

  const extension = file.type === "image/png" ? "png" : "jpg";
  const ownerSegment = profile.auth_user_id ?? profile.id;
  const storagePath = [
    ownerSegment,
    applicationId,
    "VN",
    `vn-prearrival-qr-recovered-${Date.now()}.${extension}`,
  ].join("/");
  const { error: uploadError } = await admin.storage
    .from(ARTIFACT_BUCKET)
    .upload(storagePath, bytes, {
      contentType: file.type,
      upsert: false,
    });
  if (uploadError) {
    return NextResponse.json({ error: "Could not store the QR image" }, { status: 500 });
  }

  const currentResult = isRecord(app.submission_result) ? app.submission_result : {};
  const currentArtifacts = isRecord(currentResult.artifacts) ? currentResult.artifacts : {};
  const currentQrCodes = Array.isArray(currentArtifacts.qrCodes)
    ? currentArtifacts.qrCodes.filter((value): value is string => typeof value === "string")
    : [];
  const currentLogs = Array.isArray(currentArtifacts.logs)
    ? currentArtifacts.logs.filter((value): value is string => typeof value === "string")
    : [];
  const nextResult = {
    ...currentResult,
    country: "VN",
    visaType: "VN_PREARRIVAL_DECLARATION",
    status: "submitted",
    submitted: true,
    applicationId,
    portalResponseSummary:
      typeof currentResult.portalResponseSummary === "string"
        ? currentResult.portalResponseSummary
        : "Vietnam Pre-Arrival official QR confirmation recovered from the applicant.",
    artifacts: {
      ...currentArtifacts,
      qrCodes: [storagePath, ...currentQrCodes.filter((path) => path !== storagePath)],
      logs: [...currentLogs, "vn_prearrival_qr_recovered_from_applicant"],
    },
  };
  const now = new Date().toISOString();
  const { error: updateError } = await admin
    .from("applications")
    .update({
      status: "submitted",
      submission_result_status: "completed",
      submission_result: nextResult,
      submission_result_updated_at: now,
      updated_at: now,
    })
    .eq("id", applicationId);
  if (updateError) {
    await admin.storage.from(ARTIFACT_BUCKET).remove([storagePath]);
    return NextResponse.json({ error: "Could not attach the QR image to the application" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, result: nextResult });
}
