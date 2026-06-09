import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  isDs160VisaType,
  isFranceVisasVisaType,
  queueProviderForVisaType,
  queueStatusForApplication,
  queueStatusForSubmissionMode,
  RETRY_SUPERSEDABLE_SUBMISSION_QUEUE_STATUSES,
  type SubmissionMode,
} from "@/lib/submission-queue";

type ApplicationForRetry = {
  id: string;
  applicant_id: string;
  country: string | null;
  visa_type: string | null;
};

async function readRequestedMode(request: Request): Promise<SubmissionMode> {
  try {
    const body = (await request.json()) as { mode?: unknown };
    return body.mode === "live_assisted" ? "live_assisted" : "dry_run";
  } catch {
    return "dry_run";
  }
}

function envEnabled(...keys: string[]): boolean {
  return keys.some((key) => process.env[key] === "true" || process.env[key] === "1");
}

function envModeLive(...keys: string[]): boolean {
  return keys.some((key) => process.env[key] === "live_assisted");
}

function isFranceCountry(country: string | null): boolean {
  const normalized = (country ?? "").trim().toLowerCase();
  return normalized === "france" || normalized === "fr" || normalized === "法国";
}

function isFranceLiveRetryApplication(country: string | null, visaType: string | null): boolean {
  return isFranceCountry(country) && isFranceVisasVisaType(visaType);
}

function liveRetryEnabledForApplication(country: string | null, visaType: string | null): boolean {
  if (isFranceLiveRetryApplication(country, visaType)) {
    return (
      envEnabled("FRANCE_LIVE_SUBMISSION_ENABLED", "NEXT_PUBLIC_FRANCE_LIVE_SUBMISSION_ENABLED") &&
      envModeLive("FRANCE_SUBMISSION_MODE", "NEXT_PUBLIC_FRANCE_SUBMISSION_MODE")
    );
  }
  if (isDs160VisaType(visaType)) {
    return (
      envEnabled(
        "DS160_LIVE_SUBMISSION_ENABLED",
        "DS160_LIVE_ASSISTED_ENABLED",
        "NEXT_PUBLIC_DS160_LIVE_ASSISTED_ENABLED",
      ) &&
      envModeLive("DS160_SUBMISSION_MODE", "NEXT_PUBLIC_DS160_SUBMISSION_MODE")
    );
  }
  return false;
}

function isMissingSubmissionModeColumnError(error: { message?: string; code?: string }): boolean {
  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "PGRST204" ||
    message.includes("submission_queue.mode") ||
    message.includes("submission_queue.provider") ||
    message.includes("column submission_queue.mode does not exist") ||
    message.includes("column submission_queue.provider does not exist") ||
    message.includes("could not find the 'mode' column") ||
    message.includes("could not find the 'provider' column")
  );
}

async function insertRetryQueueRow(
  admin: ReturnType<typeof createAdminClient>,
  input: {
    applicationId: string;
    queueStatus: string;
    mode: SubmissionMode;
    provider: string | null;
    now: string;
  },
): Promise<string | null> {
  const { error } = await admin.from("submission_queue").insert({
    application_id: input.applicationId,
    status: input.queueStatus,
    mode: input.mode,
    provider: input.provider,
    attempts: 0,
    last_error: null,
    created_at: input.now,
    updated_at: input.now,
  });
  if (!error) return null;

  const canUseLegacyPayload =
    isMissingSubmissionModeColumnError(error) &&
    (input.mode === "dry_run" || input.queueStatus === "ds160_live_assisted_pending");
  if (!canUseLegacyPayload) return error.message;

  const { error: legacyError } = await admin.from("submission_queue").insert({
    application_id: input.applicationId,
    status: input.queueStatus,
    attempts: 0,
    last_error: null,
    created_at: input.now,
    updated_at: input.now,
  });
  return legacyError?.message ?? null;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: applicationId } = await context.params;
  if (!applicationId) {
    return NextResponse.json({ error: "Missing application id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("applicant_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }
  if (!profile) {
    return NextResponse.json({ error: "Applicant profile not found" }, { status: 404 });
  }

  const { data: application, error: applicationError } = await admin
    .from("applications")
    .select("id, applicant_id, country, visa_type")
    .eq("id", applicationId)
    .maybeSingle();

  if (applicationError) {
    return NextResponse.json({ error: applicationError.message }, { status: 500 });
  }
  const ownedApplication = application as ApplicationForRetry | null;
  if (!ownedApplication) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  if (ownedApplication.applicant_id !== profile.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date().toISOString();
  const mode = await readRequestedMode(request);
  const queueStatus = mode === "live_assisted"
    ? queueStatusForSubmissionMode(ownedApplication.visa_type, mode)
    : queueStatusForApplication(ownedApplication.country, ownedApplication.visa_type);
  const provider = queueProviderForVisaType(ownedApplication.visa_type, mode);

  if (mode === "live_assisted") {
    const supportsLiveAssisted =
      isDs160VisaType(ownedApplication.visa_type) ||
      isFranceLiveRetryApplication(ownedApplication.country, ownedApplication.visa_type);
    if (!provider || !supportsLiveAssisted) {
      return NextResponse.json(
        { error: "Live assisted retry is not supported for this visa type." },
        { status: 400 },
      );
    }
    if (!liveRetryEnabledForApplication(ownedApplication.country, ownedApplication.visa_type)) {
      return NextResponse.json(
        { error: "Live assisted retry is disabled by environment configuration." },
        { status: 403 },
      );
    }
    if (isFranceLiveRetryApplication(ownedApplication.country, ownedApplication.visa_type)) {
      const { data: existingOfficialRows, error: existingOfficialError } = await admin
        .from("submission_queue")
        .select("id, status, official_application_id_encrypted, official_application_reference_encrypted")
        .eq("application_id", applicationId)
        .eq("mode", "live_assisted")
        .limit(20);

      if (existingOfficialError) {
        return NextResponse.json({ error: existingOfficialError.message }, { status: 500 });
      }
      const hasOfficialReference = (existingOfficialRows ?? []).some((row) => {
        const bag = row as {
          official_application_id_encrypted?: string | null;
          official_application_reference_encrypted?: string | null;
        };
        return Boolean(
          bag.official_application_id_encrypted ||
          bag.official_application_reference_encrypted,
        );
      });
      if (hasOfficialReference) {
        return NextResponse.json(
          {
            error:
              "A France-Visas live job already captured an official reference. Verify the existing official draft before retrying.",
          },
          { status: 409 },
        );
      }
    }
  }

  const { error: supersedeError } = await admin
    .from("submission_queue")
    .update({
      status: "retry_superseded",
      updated_at: now,
    })
    .eq("application_id", applicationId)
    .in("status", RETRY_SUPERSEDABLE_SUBMISSION_QUEUE_STATUSES);

  if (supersedeError) {
    return NextResponse.json({ error: supersedeError.message }, { status: 500 });
  }

  const queueError = await insertRetryQueueRow(admin, {
    applicationId,
    queueStatus,
    mode,
    provider,
    now,
  });
  if (queueError) {
    return NextResponse.json({ error: queueError }, { status: 500 });
  }

  const { error: appUpdateError } = await admin
    .from("applications")
    .update({
      status: "submitted",
      submission_result_status: "waiting",
      submission_result: null,
      confirmation_number: null,
      submission_result_updated_at: now,
      updated_at: now,
    })
    .eq("id", applicationId);

  if (appUpdateError) {
    return NextResponse.json({ error: appUpdateError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    applicationId,
    queueStatus,
    mode,
    provider,
  });
}
