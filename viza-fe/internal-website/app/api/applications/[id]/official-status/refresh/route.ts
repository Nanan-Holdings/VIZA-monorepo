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

  const now = new Date().toISOString();
  const { data: check, error: checkError } = await admin
    .from("official_status_checks")
    .insert({
      application_id: applicationId,
      user_id: user.id,
      country_code: "VN",
      provider: "vietnam_evisa",
      status: "queued",
      requested_by: "user",
      checked_at: now,
      raw_status_json: {
        message: "User requested Vietnam e-Visa official status refresh.",
      },
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (checkError) {
    const message = checkError.message.toLowerCase();
    if (!message.includes("official_status_checks")) {
      return NextResponse.json({ error: checkError.message }, { status: 500 });
    }
  }

  await Promise.all([
    admin
      .from("applications")
      .update({
        external_status: application.external_status ?? "status_check_queued",
        external_status_updated_at: now,
        updated_at: now,
      })
      .eq("id", applicationId),
    admin.from("application_events").upsert(
      {
        application_id: applicationId,
        applicant_id: profile.id,
        auth_user_id: user.id,
        event_type: "official_status_refresh_requested",
        actor_type: "user",
        actor_id: user.id,
        source: "official_status",
        visibility: "staff",
        idempotency_key: `official-status-refresh:${applicationId}:${now}`,
        message: "User requested Vietnam e-Visa official status refresh.",
        metadata: { status_check_id: (check as { id?: string } | null)?.id ?? null },
        occurred_at: now,
        created_at: now,
      },
      { onConflict: "idempotency_key", ignoreDuplicates: true },
    ),
  ]);

  return NextResponse.json({ ok: true, statusCheck: check ?? null });
}
