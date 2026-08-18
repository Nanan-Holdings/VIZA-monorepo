import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  isDigitalArrivalCardApplication,
} from "@/lib/submission-queue";
import { resolveRunnerPoolFlow } from "@/lib/queue/flows";

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
  "mdac_live_assisted_scheduled",
  "mdac_live_assisted_pending",
  "mdac_dry_run_pending",
  "tdac_live_assisted_scheduled",
  "tdac_live_assisted_pending",
  "tdac_dry_run_pending",
  "vn_prearrival_live_assisted_scheduled",
  "vn_prearrival_live_assisted_pending",
  "vn_prearrival_dry_run_pending",
  "phetravel_live_assisted_scheduled",
  "phetravel_live_assisted_pending",
  "phetravel_dry_run_pending",
  "kr_eac_live_assisted_scheduled",
  "kr_eac_live_assisted_pending",
  "kr_eac_dry_run_pending",
] as const;

const RUNNER_POOL_COUNTRY_BY_FLOW: Record<string, string> = {
  vn_prearrival: "vietnam",
  sgac: "singapore",
  mdac: "malaysia",
  tdac: "thailand",
  kr_eform: "south_korea",
  kr_arrival_card: "south_korea",
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
  let runnerQueue: { id: string; status: string } | null = null;
  const runnerFlow = resolveRunnerPoolFlow(application.country, application.visa_type);
  const runnerCountry = runnerFlow ? RUNNER_POOL_COUNTRY_BY_FLOW[runnerFlow] : undefined;
  if (!queue && runnerFlow && runnerCountry) {
    const { data: runnerData, error: runnerLoadError } = await admin
      .from("runner_job")
      .select("id, status, flow_key")
      .eq("application_id", applicationId)
      .eq("country", runnerCountry)
      .eq("flow_key", runnerFlow)
      .eq("status", "queued")
      .order("enqueued_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (runnerLoadError) {
      return NextResponse.json({ error: runnerLoadError.message }, { status: 500 });
    }
    runnerQueue = runnerData as { id: string; status: string } | null;
  }

  if (!queue && !runnerQueue) {
    return NextResponse.json(
      {
        error:
          "No cancelable digital arrival card submission was found. It may already be processing or completed.",
      },
      { status: 409 },
    );
  }

  const queueId = queue?.id ?? runnerQueue!.id;
  const queueTransport = queue ? "submission_queue" : "runner_job";
  const { data: cancelData, error: cancelError } = await admin.rpc(
    "cancel_application_submission",
    {
      p_application_id: applicationId,
      p_queue_id: queueId,
      p_transport: queueTransport,
    },
  );
  if (cancelError) {
    return NextResponse.json({ error: cancelError.message }, { status: 500 });
  }

  const cancelRow = (Array.isArray(cancelData) ? cancelData[0] : cancelData) as
    | {
        cancelled?: unknown;
        queue_id?: unknown;
        queue_transport?: unknown;
        cancelled_at?: unknown;
      }
    | null;
  if (!cancelRow || cancelRow.cancelled !== true) {
    return NextResponse.json(
      {
        error:
          "The submission could not be cancelled because it is already processing or has changed.",
      },
      { status: 409 },
    );
  }

  const cancelledAt =
    typeof cancelRow.cancelled_at === "string"
      ? cancelRow.cancelled_at
      : new Date().toISOString();

  return NextResponse.json({
    ok: true,
    applicationId,
    queueId:
      typeof cancelRow.queue_id === "string" ? cancelRow.queue_id : queueId,
    queueTransport:
      cancelRow.queue_transport === "submission_queue" || cancelRow.queue_transport === "runner_job"
        ? cancelRow.queue_transport
        : queueTransport,
    cancelled: true,
    cancelledAt,
  });
}
