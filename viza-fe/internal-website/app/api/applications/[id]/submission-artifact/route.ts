import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getImpersonationSession } from "@/lib/impersonation-session";
import { getClientSessionFromRequest } from "@/lib/client-session";

const ARTIFACT_BUCKET = "submission-artifacts";

function normalizeArtifactPath(value: string | null): string | null {
  const path = value?.trim().replace(/\\/g, "/");
  if (!path) return null;
  if (path.startsWith("/") || path.includes("..") || /^https?:\/\//i.test(path)) return null;
  return path;
}

function belongsToApplication(path: string, applicationId: string): boolean {
  return path.split("/").includes(applicationId);
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
