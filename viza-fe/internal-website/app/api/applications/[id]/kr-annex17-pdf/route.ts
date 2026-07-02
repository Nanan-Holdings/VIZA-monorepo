import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClientSessionWithFallback } from "@/lib/client-session";
import { getImpersonationSession } from "@/lib/impersonation-session";
import { validateAnnex17Answers, renderKoreaC39Annex17 } from "@/lib/korea-c39/render-annex17";

interface ApplicantProfileFallback {
  surname: string | null;
  surname_en: string | null;
  given_names: string | null;
  given_names_en: string | null;
  full_name: string | null;
  full_name_en: string | null;
  email: string | null;
  phone: string | null;
}

function setIfMissing(answers: Record<string, string>, key: string, value?: string | null): void {
  const normalized = value?.trim();
  if (!answers[key]?.trim() && normalized) answers[key] = normalized;
}

function applyProfileFallbacks(answers: Record<string, string>, profile: ApplicantProfileFallback | null): void {
  if (!profile) return;
  const fullName = profile.full_name_en?.trim() || profile.full_name?.trim() || "";
  const [fallbackFamilyName, ...fallbackGivenParts] = fullName.split(/\s+/).filter(Boolean);
  const fallbackGivenNames = fallbackGivenParts.join(" ");

  setIfMissing(answers, "family_name", profile.surname_en ?? profile.surname ?? fallbackFamilyName);
  setIfMissing(answers, "given_names", profile.given_names_en ?? profile.given_names ?? fallbackGivenNames);
  setIfMissing(answers, "email_address", profile.email);
  setIfMissing(answers, "mobile_phone", profile.phone);
}

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

  const { data: profile } = await admin
    .from("applicant_profiles")
    .select("surname, surname_en, given_names, given_names_en, full_name, full_name_en, email, phone")
    .eq("id", app.applicant_id)
    .maybeSingle();
  applyProfileFallbacks(answers, (profile as ApplicantProfileFallback | null) ?? null);

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
      "Content-Disposition": `inline; filename="${filename}"`,
      "Content-Length": String(pdfBytes.length),
      "Cache-Control": "no-store",
    },
  });
}
