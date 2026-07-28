import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ProfileRow = { id: string };
type ApplicationRow = {
  id: string;
  applicant_id: string;
  country: string | null;
  visa_type: string | null;
  external_status?: string | null;
};
type TrackingRow = { tracking_status: string };

const REFRESH_COOLDOWN_MS = 15 * 60 * 1_000;

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase().replace(/[\s/-]+/g, "_");
}

function isVietnamEVisa(application: ApplicationRow): boolean {
  return (
    ["VN", "VIETNAM", "VIET_NAM"].includes(normalize(application.country)) &&
    ["VN_E_VISA", "VIETNAM_E_VISA", "E_VISA_TOURISM", "EVISA_TOURISM", "TOURIST_E_VISA", "TOURIST_EVISA"].includes(normalize(application.visa_type))
  );
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
  const { data: profileData, error: profileError } = await admin
    .from("applicant_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }
  const profile = profileData as ProfileRow | null;
  if (!profile) {
    return NextResponse.json({ error: "Applicant profile not found" }, { status: 404 });
  }

  const { data: applicationData, error: applicationError } = await admin
    .from("applications")
    .select("id, applicant_id, country, visa_type, external_status")
    .eq("id", applicationId)
    .maybeSingle();
  if (applicationError) {
    return NextResponse.json({ error: applicationError.message }, { status: 500 });
  }
  const application = applicationData as ApplicationRow | null;
  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  if (application.applicant_id !== profile.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isVietnamEVisa(application)) {
    return NextResponse.json({ error: "Official status refresh is only enabled for Vietnam e-Visa." }, { status: 422 });
  }

  const { data: trackingData, error: trackingError } = await admin
    .from("official_application_tracking")
    .select("tracking_status")
    .eq("application_id", applicationId)
    .maybeSingle();
  if (trackingError) {
    return NextResponse.json({ error: trackingError.message }, { status: 500 });
  }
  const tracking = trackingData as TrackingRow | null;
  if (!tracking || tracking.tracking_status !== "active") {
    return NextResponse.json(
      { error: "Official status tracking is not active for this application." },
      { status: 409 },
    );
  }

  const { data: activeCheck, error: activeError } = await admin
    .from("official_status_checks")
    .select("id, status")
    .eq("application_id", applicationId)
    .eq("country_code", "VN")
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (activeError) {
    return NextResponse.json({ error: activeError.message }, { status: 500 });
  }
  if (activeCheck) {
    return NextResponse.json({
      ok: true,
      status: "deduplicated",
      statusCheckId: activeCheck.id,
    });
  }

  const cooldownThreshold = new Date(Date.now() - REFRESH_COOLDOWN_MS).toISOString();
  const { data: recentUserCheck, error: cooldownError } = await admin
    .from("official_status_checks")
    .select("id, created_at")
    .eq("application_id", applicationId)
    .eq("country_code", "VN")
    .eq("trigger_source", "user")
    .gte("created_at", cooldownThreshold)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (cooldownError) {
    return NextResponse.json({ error: cooldownError.message }, { status: 500 });
  }
  if (recentUserCheck) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil(
        (Date.parse(recentUserCheck.created_at) + REFRESH_COOLDOWN_MS - Date.now()) /
          1_000,
      ),
    );
    return NextResponse.json({
      ok: true,
      status: "cooldown",
      retryAfterSeconds,
    });
  }

  const now = new Date().toISOString();
  const idempotencyKey = `vn:user:${applicationId}:${Math.floor(Date.now() / REFRESH_COOLDOWN_MS)}`;
  const { data: check, error: checkError } = await admin
    .from("official_status_checks")
    .insert({
      application_id: applicationId,
      user_id: user.id,
      country_code: "VN",
      provider: "vietnam_evisa",
      status: "queued",
      requested_by: "user",
      trigger_source: "user",
      idempotency_key: idempotencyKey,
      scheduled_for: now,
      raw_status_json: {
        source: "user_refresh",
      },
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (checkError) {
    if (checkError.code === "23505") {
      return NextResponse.json({ ok: true, status: "deduplicated" });
    }
    return NextResponse.json({ error: checkError.message }, { status: 500 });
  }

  await admin.from("application_events").upsert(
    {
      application_id: applicationId,
      applicant_id: profile.id,
      auth_user_id: user.id,
      event_type: "official_status_refresh_requested",
      actor_type: "user",
      actor_id: user.id,
      source: "official_status",
      visibility: "staff",
      idempotency_key: idempotencyKey,
      message: "User requested Vietnam e-Visa official status refresh.",
      metadata: { status_check_id: (check as { id?: string } | null)?.id ?? null },
      occurred_at: now,
      created_at: now,
    },
    { onConflict: "idempotency_key", ignoreDuplicates: true },
  );

  return NextResponse.json({
    ok: true,
    status: "queued",
    statusCheckId: (check as { id?: string } | null)?.id ?? null,
  });
}
