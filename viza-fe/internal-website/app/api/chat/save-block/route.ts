import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getUserFromSupabaseSession } from "@/lib/client-session";
import { getImpersonationSession } from "@/lib/impersonation-session";

interface SaveBlockBody {
  saveTarget: string;
  applicationId?: string;
  blockType: string;
  data: Record<string, string>;
}

async function getAuthUserId(): Promise<string | null> {
  const impersonation = await getImpersonationSession();
  if (impersonation) return impersonation.userId;
  const session = await getUserFromSupabaseSession();
  return session?.userId ?? null;
}

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let body: SaveBlockBody;
  try {
    body = (await req.json()) as SaveBlockBody;
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const { saveTarget, applicationId, data } = body;

  if (!saveTarget || !data || typeof data !== "object") {
    return NextResponse.json(
      { message: "saveTarget and data are required" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  try {
    if (saveTarget === "applicant_profile") {
      // Update applicant_profiles where auth_user_id = userId
      const { error } = await supabase
        .from("applicant_profiles")
        .update(data)
        .eq("auth_user_id", userId);

      if (error) {
        console.error("[save-block] applicant_profile update error:", error);
        return NextResponse.json({ message: error.message }, { status: 500 });
      }
    } else if (saveTarget === "application") {
      if (!applicationId) {
        return NextResponse.json(
          { message: "applicationId is required for saveTarget=application" },
          { status: 400 }
        );
      }

      // Verify the application belongs to this user
      const { data: profile } = await supabase
        .from("applicant_profiles")
        .select("id")
        .eq("auth_user_id", userId)
        .maybeSingle();

      if (!profile) {
        return NextResponse.json({ message: "Profile not found" }, { status: 404 });
      }

      const { error } = await supabase
        .from("applications")
        .update(data)
        .eq("id", applicationId)
        .eq("applicant_id", profile.id);

      if (error) {
        console.error("[save-block] application update error:", error);
        return NextResponse.json({ message: error.message }, { status: 500 });
      }
    } else if (saveTarget === "visa_application_answers") {
      if (!applicationId) {
        return NextResponse.json(
          { message: "applicationId is required for saveTarget=visa_application_answers" },
          { status: 400 }
        );
      }

      const adminClient = createAdminClient();
      const { data: profile } = await adminClient
        .from("applicant_profiles")
        .select("id")
        .eq("auth_user_id", userId)
        .maybeSingle();

      if (!profile) {
        return NextResponse.json({ message: "Profile not found" }, { status: 404 });
      }

      const { data: application } = await adminClient
        .from("applications")
        .select("id, applicant_id")
        .eq("id", applicationId)
        .eq("applicant_id", profile.id)
        .maybeSingle();

      if (!application) {
        return NextResponse.json({ message: "Application not found" }, { status: 404 });
      }

      const answerRows = Object.entries(data)
        .filter(([, value]) => value.trim() !== "")
        .map(([fieldName, value]) => ({
          application_id: applicationId,
          field_name: fieldName,
          value_text: value,
          updated_at: new Date().toISOString(),
        }));

      if (answerRows.length > 0) {
        const { error } = await adminClient
          .from("visa_application_answers")
          .upsert(answerRows, { onConflict: "application_id,field_name" });

        if (error) {
          console.error("[save-block] visa_application_answers upsert error:", error);
          return NextResponse.json({ message: error.message }, { status: 500 });
        }
      }
    } else {
      return NextResponse.json(
        { message: `Unknown saveTarget: ${saveTarget}` },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[save-block] Unexpected error:", err);
    return NextResponse.json(
      {
        message:
          err instanceof Error ? err.message : "Unexpected error",
      },
      { status: 500 }
    );
  }
}
