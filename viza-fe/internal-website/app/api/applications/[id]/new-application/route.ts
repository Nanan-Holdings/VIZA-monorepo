import { NextResponse } from "next/server";
import { isUsDs160 } from "@/lib/application-tab-completion";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function createNewUsApplication(userId: string, sourceApplicationId: string) {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("applicant_profiles")
    .select("id")
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (!profile) return { error: "Applicant profile not found", status: 404 } as const;

  const { data: source } = await admin
    .from("applications")
    .select("id, applicant_id, country, visa_type, visa_package_id, status")
    .eq("id", sourceApplicationId)
    .maybeSingle();
  if (!source) return { error: "Application not found", status: 404 } as const;
  if (source.applicant_id !== profile.id) return { error: "Forbidden", status: 403 } as const;
  if (!isUsDs160(source.country, source.visa_type)) {
    return { error: "This action is only available for U.S. DS-160 applications", status: 400 } as const;
  }
  if (source.status !== "submitted") {
    return { error: "Only a submitted application can be used to start a new application", status: 409 } as const;
  }

  const { data: created, error: createError } = await admin
    .from("applications")
    .insert({
      applicant_id: profile.id,
      country: source.country || "united_states",
      visa_type: source.visa_type || "B1_B2",
      visa_package_id: source.visa_package_id,
      status: "draft",
    })
    .select("id")
    .single();
  if (createError || !created) {
    return { error: createError?.message || "Could not create a new application", status: 500 } as const;
  }

  return {
    applicationId: created.id,
    country: source.country || "united_states",
    visaType: source.visa_type || "B1_B2",
    status: 201,
  } as const;
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const result = await createNewUsApplication(auth.user.id, id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const params = new URLSearchParams({
    applicationId: result.applicationId,
    country: result.country,
    visaType: result.visaType,
  });
  return NextResponse.json(
    {
      applicationId: result.applicationId,
      href: `/client/application/long-form?${params.toString()}`,
    },
    { status: result.status },
  );
}
