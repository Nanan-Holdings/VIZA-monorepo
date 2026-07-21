import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getImpersonationSession } from "@/lib/impersonation-session";

const ARTIFACT_BUCKET = "submission-artifacts";

/**
 * GET /api/applications/[id]/evisa-artifact  (POR-007)
 *
 * Streams the private official e-visa PDF after ownership verification.
 * `applications.result_storage_path` is authoritative for tracked Vietnam
 * e-Visas; legacy runner metadata remains a compatibility fallback.
 *
 * Auth: the applicant must own the application, OR an impersonation session
 * (admin staff) must be active.
 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: applicationId } = await ctx.params;
  if (!applicationId) {
    return NextResponse.json({ error: "Missing application id" }, { status: 400 });
  }

  const impersonation = await getImpersonationSession();
  let authenticatedUserId: string | null = null;
  if (!impersonation) {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    authenticatedUserId = auth.user?.id ?? null;
    if (!authenticatedUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const admin = createAdminClient();
  const { data: app, error: appErr } = await admin
    .from("applications")
    .select("id, applicant_id, result_storage_path")
    .eq("id", applicationId)
    .maybeSingle();
  if (appErr || !app) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  const { data: ownerProfile } = await admin
    .from("applicant_profiles")
    .select("auth_user_id")
    .eq("id", app.applicant_id)
    .maybeSingle();
  if (!ownerProfile?.auth_user_id) {
    return NextResponse.json({ error: "Application owner not found" }, { status: 404 });
  }

  // Authorize: owning applicant (auth session) or active impersonation.
  if (!impersonation && ownerProfile.auth_user_id !== authenticatedUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let path =
    typeof app.result_storage_path === "string"
      ? app.result_storage_path.replace(/^submission-artifacts\//, "")
      : null;
  if (!path) {
    const { data: job } = await admin
      .from("runner_job")
      .select("metadata")
      .eq("application_id", applicationId)
      .order("enqueued_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const meta = (job?.metadata as Record<string, unknown> | null) ?? null;
    path =
      meta && typeof meta.evisaArtifactPath === "string"
        ? meta.evisaArtifactPath
        : null;
  }
  if (!path) {
    return NextResponse.json({ error: "No e-visa artifact yet", pending: true }, { status: 404 });
  }

  const pathSegments = path.split("/").filter(Boolean);
  if (
    pathSegments[0] !== ownerProfile.auth_user_id ||
    !pathSegments.includes(applicationId) ||
    pathSegments.includes("..")
  ) {
    return NextResponse.json({ error: "Invalid artifact path" }, { status: 500 });
  }

  const { data: artifact, error: downloadError } = await admin.storage
    .from(ARTIFACT_BUCKET)
    .download(path);
  if (downloadError || !artifact) {
    return NextResponse.json({ error: "Could not read artifact" }, { status: 500 });
  }
  const bytes = await artifact.arrayBuffer();
  if (
    bytes.byteLength < 5 ||
    new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-"
  ) {
    return NextResponse.json({ error: "Stored artifact is not a valid PDF" }, { status: 500 });
  }
  const disposition =
    new URL(request.url).searchParams.get("disposition") === "attachment"
      ? "attachment"
      : "inline";
  const filename = path.includes("/ID/")
    ? "indonesia-official-success-evidence.pdf"
    : "vietnam-evisa.pdf";
  return new Response(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
