import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  ACTIVE_SUBMISSION_QUEUE_STATUSES,
  queueStatusForVisaType,
} from "@/lib/submission-queue";

type ApplicationForRetry = {
  id: string;
  applicant_id: string;
  visa_type: string | null;
};

export async function POST(
  _request: Request,
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
    .select("id, applicant_id, visa_type")
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
  const queueStatus = queueStatusForVisaType(ownedApplication.visa_type);

  const { error: supersedeError } = await admin
    .from("submission_queue")
    .update({
      status: "retry_superseded",
      updated_at: now,
    })
    .eq("application_id", applicationId)
    .in("status", ACTIVE_SUBMISSION_QUEUE_STATUSES);

  if (supersedeError) {
    return NextResponse.json({ error: supersedeError.message }, { status: 500 });
  }

  const { error: queueError } = await admin.from("submission_queue").insert({
    application_id: applicationId,
    status: queueStatus,
    attempts: 0,
    last_error: null,
    created_at: now,
    updated_at: now,
  });
  if (queueError) {
    return NextResponse.json({ error: queueError.message }, { status: 500 });
  }

  const { error: appUpdateError } = await admin
    .from("applications")
    .update({
      status: "submitted",
      submission_result_status: "waiting",
      submission_result: null,
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
  });
}
