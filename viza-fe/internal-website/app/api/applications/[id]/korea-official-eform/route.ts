import { NextResponse } from "next/server";
import { getClientSessionWithFallback } from "@/lib/client-session";
import { getImpersonationSession } from "@/lib/impersonation-session";
import type { KrSubmissionResult } from "@/lib/submission-result";
import { createAdminClient } from "@/lib/supabase/admin";

const OFFICIAL_EFORM_URL = "https://www.visa.go.kr/openPage.do?MENU_ID=10204";

interface ApplicationRow {
  id: string;
  applicant_id: string;
  visa_type: string;
  submission_result: unknown | null;
}

type AuthResult =
  | { ok: false; response: Response }
  | { ok: true; admin: ReturnType<typeof createAdminClient>; application: ApplicationRow };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asKrResult(value: unknown, applicationId: string): KrSubmissionResult {
  if (isRecord(value) && value.country === "KR") {
    return {
      country: "KR",
      status: typeof value.status === "string" ? (value.status as KrSubmissionResult["status"]) : "official_eform_required",
      applicationId,
      annex17PdfUrl:
        typeof value.annex17PdfUrl === "string"
          ? value.annex17PdfUrl
          : `/api/applications/${applicationId}/kr-annex17-pdf`,
      officialEformPdfStoragePath:
        typeof value.officialEformPdfStoragePath === "string" ? value.officialEformPdfStoragePath : null,
      officialEformPortalUrl:
        typeof value.officialEformPortalUrl === "string" ? value.officialEformPortalUrl : OFFICIAL_EFORM_URL,
      officialEformStatus:
        typeof value.officialEformStatus === "string"
          ? (value.officialEformStatus as KrSubmissionResult["officialEformStatus"])
          : "not_started",
      manualAction: isRecord(value.manualAction)
        ? (value.manualAction as KrSubmissionResult["manualAction"])
        : undefined,
      recommendedCenter: isRecord(value.recommendedCenter)
        ? (value.recommendedCenter as KrSubmissionResult["recommendedCenter"])
        : undefined,
      appointmentStatus: typeof value.appointmentStatus === "string" ? value.appointmentStatus : null,
    };
  }

  return {
    country: "KR",
    status: "official_eform_required",
    applicationId,
    annex17PdfUrl: `/api/applications/${applicationId}/kr-annex17-pdf`,
    officialEformPortalUrl: OFFICIAL_EFORM_URL,
    officialEformStatus: "not_started",
    manualAction: {
      type: "official_eform_generation_required",
      status: "open",
      instructions:
        "Generate the official Korea Visa Portal e-Form with barcode before using this application at KVAC.",
    },
  };
}

async function requireApplication(applicationId: string): Promise<AuthResult> {
  const admin = createAdminClient();
  const { data: application, error } = await admin
    .from("applications")
    .select("id, applicant_id, visa_type, submission_result")
    .eq("id", applicationId)
    .maybeSingle();
  if (error || !application) return { ok: false, response: NextResponse.json({ error: "Application not found" }, { status: 404 }) };
  if (application.visa_type !== "KR_C39_SHORT_TERM_VISIT") {
    return { ok: false, response: NextResponse.json({ error: "Korea official e-Form only supports KR_C39_SHORT_TERM_VISIT" }, { status: 400 }) };
  }

  const impersonation = await getImpersonationSession();
  if (!impersonation) {
    const session = await getClientSessionWithFallback();
    if (!session) return { ok: false, response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
    if (session.userId !== application.applicant_id) return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { ok: true, admin, application: application as ApplicationRow };
}

function responsePayload(result: KrSubmissionResult) {
  return {
    status: result.officialEformPdfStoragePath ? "ready" : result.officialEformStatus ?? "not_started",
    portalUrl: result.officialEformPortalUrl ?? OFFICIAL_EFORM_URL,
    officialEformPdfStoragePath: result.officialEformPdfStoragePath ?? null,
    annex17PdfUrl: result.annex17PdfUrl,
    manualAction: result.manualAction ?? null,
  };
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  const auth = await requireApplication(id);
  if (!auth.ok) return auth.response;
  return NextResponse.json(responsePayload(asKrResult(auth.application.submission_result, id)));
}

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  const auth = await requireApplication(id);
  if (!auth.ok) return auth.response;
  const current = asKrResult(auth.application.submission_result, id);
  if (current.officialEformPdfStoragePath) {
    return NextResponse.json(responsePayload({ ...current, officialEformStatus: "ready", status: "official_eform_ready" }));
  }

  const next: KrSubmissionResult = {
    ...current,
    status: "official_eform_required",
    officialEformStatus: "manual_action_required",
    officialEformPortalUrl: OFFICIAL_EFORM_URL,
    manualAction: {
      type: "official_eform_portal_review_required",
      status: "open",
      instructions:
        "VIZA must fill the official Korea Visa Portal e-Form and download the barcode PDF. If the portal rejects the selected post or asks for unsupported verification, use the official portal link and complete the e-Form there before KVAC.",
    },
  };

  const { error } = await auth.admin
    .from("applications")
    .update({
      submission_result: next as unknown as Record<string, unknown>,
      submission_result_status: "needs_user_action",
      submission_result_updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(responsePayload(next));
}
