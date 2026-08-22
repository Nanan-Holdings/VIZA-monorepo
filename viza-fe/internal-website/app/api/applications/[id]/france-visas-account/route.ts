import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { toBrowserSafeFranceVisasAccount } from "./route-handler";

export const dynamic = "force-dynamic";

type ApplicationRow = {
  id: string;
  applicant_id: string;
};

type FvAccountRow = {
  id: string;
  applicant_id?: string | null;
  email?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

export async function GET(
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
    .select("id, applicant_id")
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

  // This endpoint is a browser-safe status projection. Never select or
  // decrypt France-Visas/TLS passwords (or encrypted official references) for
  // an applicant-facing response.
  const { data: accountData, error: accountError } = await admin
    .from("fv_accounts")
    .select("id, applicant_id, email, updated_at, created_at")
    .eq("applicant_id", application.applicant_id)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (accountError) {
    return NextResponse.json({ error: accountError.message }, { status: 500 });
  }

  const account = accountData as FvAccountRow | null;

  if (!account) {
    return NextResponse.json(
      {
        ok: true,
        account: null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      account: toBrowserSafeFranceVisasAccount(account),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
