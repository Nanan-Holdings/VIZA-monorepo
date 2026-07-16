import { NextResponse } from "next/server";
import { getClientSessionWithFallback } from "@/lib/client-session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  const session = await getClientSessionWithFallback();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  const { data: application, error: appError } = await admin
    .from("applications")
    .select("id, applicant_id, visa_type, appointment_confirmation_id")
    .eq("id", id)
    .maybeSingle();
  if (appError || !application) return NextResponse.json({ error: "Application not found" }, { status: 404 });
  if (application.applicant_id !== session.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (application.visa_type !== "KR_C39_SHORT_TERM_VISIT") {
    return NextResponse.json({ error: "Unsupported application type" }, { status: 400 });
  }
  if (!application.appointment_confirmation_id) {
    return NextResponse.json({ error: "No active Korea appointment confirmation" }, { status: 404 });
  }

  const { data: confirmation, error: confirmationError } = await admin
    .from("appointment_confirmations")
    .select("confirmation_pdf_url, confirmation_number, raw_confirmation_redacted_json")
    .eq("id", application.appointment_confirmation_id)
    .eq("application_id", id)
    .maybeSingle();
  if (confirmationError) throw new Error(confirmationError.message);
  if (
    !confirmation?.confirmation_pdf_url
    || confirmation.raw_confirmation_redacted_json?.mode === "dry_run"
    || String(confirmation.confirmation_number ?? "").startsWith("KR-DRYRUN-")
  ) {
    return NextResponse.json({ error: "Official Korea appointment confirmation PDF not found" }, { status: 404 });
  }

  const target = new URL(`/api/applications/${id}/korea-evidence`, req.url);
  target.searchParams.set("path", confirmation.confirmation_pdf_url);
  target.searchParams.set("download", "1");
  return NextResponse.redirect(target);
}
