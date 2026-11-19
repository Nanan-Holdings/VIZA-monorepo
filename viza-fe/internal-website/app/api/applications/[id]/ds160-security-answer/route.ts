import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isDs160VisaType } from "@/lib/submission-queue";

const NO_STORE = { "Cache-Control": "no-store, private", Pragma: "no-cache" } as const;
const SECURITY_ANSWER_FIELD = "ds160_security_answer";

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/**
 * Reveal the DS-160 security answer to the applicant who owns the
 * application, so they can retrieve their CEAC draft. Requires a real
 * authenticated session (not admin impersonation) and never caches.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: applicationId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "Not authenticated" }, 401);

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("applicant_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (profileError) return json({ error: "Could not load the applicant profile" }, 500);
  if (!profile) return json({ error: "Applicant profile not found" }, 404);

  const { data: application, error: applicationError } = await admin
    .from("applications")
    .select("id, applicant_id, visa_type")
    .eq("id", applicationId)
    .maybeSingle();
  if (applicationError) return json({ error: "Could not load the application" }, 500);
  if (!application) return json({ error: "Application not found" }, 404);
  if (application.applicant_id !== profile.id) return json({ error: "Forbidden" }, 403);
  if (!isDs160VisaType(application.visa_type)) {
    return json({ error: "This application has no DS-160 security answer" }, 400);
  }

  const { data: answerRow, error: answerError } = await admin
    .from("visa_application_answers")
    .select("value_text")
    .eq("application_id", applicationId)
    .eq("field_name", SECURITY_ANSWER_FIELD)
    .maybeSingle();
  if (answerError) return json({ error: "Could not load the security answer" }, 500);
  const answer = typeof answerRow?.value_text === "string" && answerRow.value_text.trim()
    ? answerRow.value_text.trim()
    : null;
  return json({ answer });
}
