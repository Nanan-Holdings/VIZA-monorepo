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

function submissionServiceBaseUrl() {
  return (process.env.KR_EFORM_SUBMISSION_SERVICE_URL ?? process.env.SUBMISSION_SERVICE_LOCAL_URL ?? "http://127.0.0.1:8080").replace(/\/$/u, "");
}

async function postSubmissionService<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const url = `${submissionServiceBaseUrl()}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
    if (!response.ok || !payload) {
      throw new Error(
        payload?.error
          ? `Submission service ${url} failed (${response.status}): ${payload.error}`
          : `Submission service ${url} failed (${response.status})`,
      );
    }
    if (payload.error) throw new Error(`Submission service ${url} returned error: ${payload.error}`);
    return payload as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function readAnswerMap(admin: ReturnType<typeof createAdminClient>, applicationId: string, applicantId: string) {
  const { data, error } = await admin
    .from("visa_application_answers")
    .select("field_name, value_text")
    .eq("application_id", applicationId);
  if (error) throw new Error(error.message);

  const answers: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row.field_name && row.value_text) answers[row.field_name] = row.value_text;
  }

  const { data: profile } = await admin
    .from("applicant_profiles")
    .select("surname, given_names, email, phone, date_of_birth, gender, nationality, passport_number, passport_expiry_date, passport_issue_date, address, address_en")
    .eq("id", applicantId)
    .maybeSingle();
  if (isRecord(profile)) {
    const profileFallbacks: Record<string, unknown> = {
      family_name: profile.surname,
      given_names: profile.given_names,
      email: profile.email,
      phone: profile.phone,
      date_of_birth: profile.date_of_birth,
      gender: profile.gender,
      nationality: profile.nationality,
      passport_number: profile.passport_number,
      passport_expiry_date: profile.passport_expiry_date,
      passport_issue_date: profile.passport_issue_date,
      home_address: profile.address_en ?? profile.address,
    };
    for (const [key, value] of Object.entries(profileFallbacks)) {
      if (!answers[key] && typeof value === "string" && value.trim()) answers[key] = value.trim();
    }
  }

  return answers;
}

type KoreaEformServiceResponse =
  | {
      ok: true;
      status: "official_eform_ready";
      portalUrl: string;
      officialPdfStoragePath: string;
      message: string;
    }
  | {
      ok: true;
      status: "manual_required";
      portalUrl: string;
      manualActionType: NonNullable<KrSubmissionResult["manualAction"]>["type"];
      message: string;
      evidence?: NonNullable<KrSubmissionResult["manualAction"]>["evidence"];
    }
  | {
      ok: true;
      status: "validation_failed";
      missingFields: string[];
      message: string;
    };

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

  let next: KrSubmissionResult;
  try {
    const answers = await readAnswerMap(auth.admin, id, auth.application.applicant_id);
    const serviceResult = await postSubmissionService<KoreaEformServiceResponse>("/local/korea-eform/generate", {
      applicationId: id,
      answers,
      officialPdfStoragePath: current.officialEformPdfStoragePath ?? null,
      finalReviewApproved: false,
    });
    if (serviceResult.status === "official_eform_ready") {
      next = {
        ...current,
        status: "official_eform_ready",
        officialEformStatus: "ready",
        officialEformPortalUrl: serviceResult.portalUrl,
        officialEformPdfStoragePath: serviceResult.officialPdfStoragePath,
        manualAction: undefined,
      };
    } else if (serviceResult.status === "validation_failed") {
      return NextResponse.json({ error: serviceResult.message, missingFields: serviceResult.missingFields }, { status: 422 });
    } else {
      next = {
        ...current,
        status: "official_eform_required",
        officialEformStatus: "manual_action_required",
        officialEformPortalUrl: serviceResult.portalUrl,
        manualAction: {
          type: serviceResult.manualActionType,
          status: "open",
          instructions: serviceResult.message,
          evidence: serviceResult.evidence,
        },
      };
    }
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : String(err);
    const runnerHint =
      errMessage === "fetch failed" || errMessage.includes("ECONNREFUSED") || errMessage.includes("Failed to fetch")
        ? "本机 official e-Form worker 没有运行或端口不可达。请启动 viza-be/submission-service 的 localhost endpoint，并设置 KR_VISA_PORTAL_EFORM_LOCAL_ENABLED=true；VIZA 不会用备用 Annex-17 冒充官网条码 PDF。"
        : `官方 e-Form runner 返回错误：${errMessage}`;
    next = {
      ...current,
      status: "official_eform_required",
      officialEformStatus: "manual_action_required",
      officialEformPortalUrl: OFFICIAL_EFORM_URL,
      manualAction: {
        type: "official_eform_portal_review_required",
        status: "open",
        instructions:
          `${runnerHint} Official Korea Visa Portal e-Form automation did not complete; use the official portal link, or start the gated submission-service runner and click Generate again.`,
      },
    };
  }

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
