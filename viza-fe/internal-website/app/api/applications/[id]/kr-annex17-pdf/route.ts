import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClientSessionWithFallback } from "@/lib/client-session";
import { getImpersonationSession } from "@/lib/impersonation-session";
import { validateAnnex17Answers, renderKoreaC39Annex17 } from "@/lib/korea-c39/render-annex17";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: applicationId } = await ctx.params;
  if (!applicationId) return NextResponse.json({ error: "Missing application id" }, { status: 400 });

  const admin = createAdminClient();
  const { data: app, error: appErr } = await admin
    .from("applications")
    .select("id, applicant_id, visa_type")
    .eq("id", applicationId)
    .maybeSingle();
  if (appErr || !app) return NextResponse.json({ error: "Application not found" }, { status: 404 });
  if (app.visa_type !== "KR_C39_SHORT_TERM_VISIT") {
    return NextResponse.json({ error: "Korea Annex-17 renderer only supports KR_C39_SHORT_TERM_VISIT" }, { status: 400 });
  }

  const impersonation = await getImpersonationSession();
  if (!impersonation) {
    const session = await getClientSessionWithFallback();
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (session.userId !== app.applicant_id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: rows, error: rowsErr } = await admin
    .from("visa_application_answers")
    .select("field_name, value_text")
    .eq("application_id", applicationId);
  if (rowsErr) return NextResponse.json({ error: rowsErr.message }, { status: 500 });

  const answers: Record<string, string> = {};
  for (const row of rows ?? []) {
    if (!row.value_text || row.field_name.startsWith("__")) continue;
    answers[row.field_name] = row.value_text;
  }

  const missingFields = validateAnnex17Answers(answers);
  if (missingFields.length > 0) {
    return NextResponse.json(
      { error: "Missing required Korea Annex-17 fields", missingFields },
      { status: 422 },
    );
  }

  const pdfBytes = await renderKoreaC39Annex17(answers);
  const surname = (answers.family_name ?? answers.surname ?? "applicant").replace(/[^A-Za-z0-9-_]/g, "");
  const filename = `korea-annex17-${surname || "applicant"}-${applicationId.slice(0, 8)}.pdf`;

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
