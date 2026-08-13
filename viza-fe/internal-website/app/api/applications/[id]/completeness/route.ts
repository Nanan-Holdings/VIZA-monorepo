import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getClientSessionFromRequest } from "@/lib/client-session";
import { loadApplicationCompleteness, type ApplicationCompletenessApplication } from "@/lib/application-completeness";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: applicationId } = await context.params;
  if (!applicationId) {
    return NextResponse.json({ error: "Missing application id" }, { status: 400 });
  }

  const legacySession = await getClientSessionFromRequest(request);
  let authUserId: string | null = null;
  if (!legacySession) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    authUserId = user?.id ?? null;
  }
  if (!legacySession && !authUserId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();
  const profileQuery = admin.from("applicant_profiles").select("id, auth_user_id");
  const { data: profile, error: profileError } = legacySession
    ? await profileQuery.eq("id", legacySession.userId).maybeSingle()
    : await profileQuery.eq("auth_user_id", authUserId!).maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }
  if (!profile) {
    return NextResponse.json({ error: "Applicant profile not found" }, { status: 404 });
  }

  const { data: application, error: applicationError } = await admin
    .from("applications")
    .select("id, applicant_id, country, visa_type, visa_package_id")
    .eq("id", applicationId)
    .maybeSingle();

  if (applicationError) {
    return NextResponse.json({ error: applicationError.message }, { status: 500 });
  }
  const ownedApplication = application as ApplicationCompletenessApplication | null;
  if (!ownedApplication) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  if (ownedApplication.applicant_id !== (profile as { id: string }).id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const completeness = await loadApplicationCompleteness({
    admin,
    application: ownedApplication,
  });

  return NextResponse.json({ ok: true, applicationId, completeness });
}
