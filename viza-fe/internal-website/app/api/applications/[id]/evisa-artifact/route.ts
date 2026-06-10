import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getImpersonationSession } from "@/lib/impersonation-session";

const ARTIFACT_BUCKET = "submission-artifacts";

/**
 * GET /api/applications/[id]/evisa-artifact  (POR-007)
 *
 * Streams the e-visa / confirmation artifact a runner stored for this
 * application. The reference is written onto the latest runner_job row's
 * metadata (`evisaArtifactPath`) by RUN-CORE-003 (storeEvisaArtifact). We
 * resolve it to a short-lived signed Storage URL and redirect. Missing
 * artifact → 404 JSON (the result card shows a pending state instead).
 *
 * Auth: the applicant must own the application, OR an impersonation session
 * (admin staff) must be active.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: applicationId } = await ctx.params;
  if (!applicationId) {
    return NextResponse.json({ error: "Missing application id" }, { status: 400 });
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

  // Authorize: owning applicant (auth session) or active impersonation.
  const impersonation = await getImpersonationSession();
  if (!impersonation) {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: profile } = await admin
      .from("applicant_profiles")
      .select("auth_user_id")
      .eq("id", app.applicant_id)
      .maybeSingle();
    if (!profile || profile.auth_user_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Resolve the artifact path from the latest runner_job for this application.
  const { data: job } = await admin
    .from("runner_job")
    .select("metadata")
    .eq("application_id", applicationId)
    .order("enqueued_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const meta = (job?.metadata as Record<string, unknown> | null) ?? null;
  const path = meta && typeof meta.evisaArtifactPath === "string" ? meta.evisaArtifactPath : null;
  if (!path) {
    return NextResponse.json({ error: "No e-visa artifact yet", pending: true }, { status: 404 });
  }

  const { data: signed, error: signErr } = await admin.storage
    .from(ARTIFACT_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (signErr || !signed?.signedUrl) {
    return NextResponse.json({ error: "Could not sign artifact URL" }, { status: 500 });
  }
  return NextResponse.redirect(signed.signedUrl);
}
