import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isDigitalArrivalCardApplication } from "@/lib/submission-queue";

export const dynamic = "force-dynamic";

type ApplicationForCancel = {
  id: string;
  applicant_id: string;
  country: string | null;
  visa_type: string | null;
};

type QueueForCancel = {
  id: string;
  status: string | null;
  provider: string | null;
  mode: string | null;
};

const CANCELABLE_SGAC_QUEUE_STATUSES = [
  "sgac_live_assisted_scheduled",
  "sgac_live_assisted_pending",
  "sgac_dry_run_pending",
  "mdac_live_assisted_pending",
  "mdac_dry_run_pending",
  "tdac_live_assisted_pending",
  "tdac_dry_run_pending",
] as const;

function cancelledStatusForVisaType(visaType: string | null): string {
  const normalized = (visaType ?? "").trim().toUpperCase().replace(/[\s/-]+/g, "_");
  if (normalized === "MY_MDAC_ARRIVAL_CARD") return "mdac_live_assisted_cancelled";
  if (normalized === "TH_TDAC_ARRIVAL_CARD") return "tdac_live_assisted_cancelled";
  return "sgac_live_assisted_cancelled";
}

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

  const { data: applicationData, error: applicationError } = await admin
    .from("applications")
    .select("id, applicant_id, country, visa_type")
    .eq("id", applicationId)
    .maybeSingle();

  if (applicationError) {
    return NextResponse.json({ error: applicationError.message }, { status: 500 });
  }

  const application = applicationData as ApplicationForCancel | null;
  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  if (application.applicant_id !== (profile as { id: string }).id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isDigitalArrivalCardApplication(application.country, application.visa_type)) {
    return NextResponse.json(
      { error: "Cancellation is only available for digital arrival card submissions." },
      { status: 400 },
    );
  }

  const { data: queueData, error: queueLoadError } = await admin
    .from("submission_queue")
    .select("id, status, provider, mode")
    .eq("application_id", applicationId)
    .in("status", [...CANCELABLE_SGAC_QUEUE_STATUSES])
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (queueLoadError) {
    return NextResponse.json({ error: queueLoadError.message }, { status: 500 });
  }

  const queue = queueData as QueueForCancel | null;
  if (!queue) {
    return NextResponse.json(
      {
        error:
          "No cancelable digital arrival card submission was found. It may already be processing or completed.",
      },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  const cancelledStatus = cancelledStatusForVisaType(application.visa_type);
  const { error: queueUpdateError } = await admin
    .from("submission_queue")
    .update({
      status: cancelledStatus,
      current_stage: "cancelled_by_user",
      last_error: "Cancelled by user before official arrival card submission.",
      updated_at: now,
    })
    .eq("id", queue.id)
    .in("status", [...CANCELABLE_SGAC_QUEUE_STATUSES]);

  if (queueUpdateError) {
    return NextResponse.json({ error: queueUpdateError.message }, { status: 500 });
  }

  const { error: applicationUpdateError } = await admin
    .from("applications")
    .update({
      status: "draft",
      submitted_at: null,
      submission_result_status: null,
      submission_result: null,
      submission_result_updated_at: now,
      updated_at: now,
    })
    .eq("id", applicationId);

  if (applicationUpdateError) {
    return NextResponse.json({ error: applicationUpdateError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    applicationId,
    queueId: queue.id,
    cancelled: true,
    cancelledAt: now,
  });
}
