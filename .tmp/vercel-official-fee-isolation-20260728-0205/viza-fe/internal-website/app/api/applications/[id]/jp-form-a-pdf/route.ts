import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderJpTouristFormA } from "@/lib/jp-tourist/render-form-a";
import { getImpersonationSession } from "@/lib/impersonation-session";

/**
 * GET /api/applications/[id]/jp-form-a-pdf
 *
 * Renders the MOFA "Application for Visa" Form A PDF filled with the
 * applicant's answers for a JP_TOURIST application. The applicant gives
 * the printed PDF to a designated travel agency (JVAC China) which
 * delivers it to the Japanese embassy / consulate-general.
 *
 * Auth: applicant must own the application, OR an impersonation session
 * must be active (admin staff).
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
    .select("id, applicant_id, visa_type")
    .eq("id", applicationId)
    .maybeSingle();
  if (appErr || !app) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  if (app.visa_type !== "JP_TOURIST") {
    return NextResponse.json(
      { error: `Form A renderer only supports visa_type=JP_TOURIST (got ${app.visa_type})` },
      { status: 400 },
    );
  }

  const impersonation = await getImpersonationSession();
  if (!impersonation) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const { data: profile } = await admin
      .from("applicant_profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (!profile || profile.id !== app.applicant_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { data: rows, error: rowsErr } = await admin
    .from("visa_application_answers")
    .select("field_name, value_text")
    .eq("application_id", applicationId);
  if (rowsErr) {
    return NextResponse.json({ error: rowsErr.message }, { status: 500 });
  }

  const answers: Record<string, string> = {};
  for (const r of rows ?? []) {
    if (!r.value_text) continue;
    if (r.field_name.startsWith("__")) continue;
    answers[r.field_name] = r.value_text;
  }

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await renderJpTouristFormA(answers);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Render failed" },
      { status: 500 },
    );
  }

  const surname = (answers.surname ?? "applicant").replace(/[^A-Za-z0-9-_]/g, "");
  const filename = `mofa-form-a-${surname || "applicant"}-${applicationId.slice(0, 8)}.pdf`;

  return new Response(pdfBytes as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdfBytes.length),
      "Cache-Control": "no-store",
    },
  });
}
