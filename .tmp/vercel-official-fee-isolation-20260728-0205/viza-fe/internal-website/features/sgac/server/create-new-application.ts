import { createAdminClient } from "@/lib/supabase/admin";

const REUSABLE_ANSWER_KEYS = [
  "full_name",
  "full_name_zh",
  "full_name_en",
  "passport_number",
  "passport_expiry_date",
  "sex",
  "date_of_birth",
  "nationality",
  "place_of_birth_country",
  "place_of_residence",
  "email_address",
  "mobile_country_code",
  "mobile_number",
  "has_used_different_name_to_enter_singapore",
] as const;

export async function createNewSgacApplication(userId: string, sourceApplicationId: string) {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("applicant_profiles")
    .select("id")
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (!profile) return { error: "Applicant profile not found", status: 404 } as const;

  const { data: source } = await admin
    .from("applications")
    .select("id, applicant_id, country, visa_type, visa_package_id")
    .eq("id", sourceApplicationId)
    .maybeSingle();
  if (!source) return { error: "Application not found", status: 404 } as const;
  if (source.applicant_id !== profile.id) return { error: "Forbidden", status: 403 } as const;
  if (source.visa_type !== "SG_ARRIVAL_CARD") {
    return { error: "This action is only available for SG Arrival Card applications", status: 400 } as const;
  }

  const { data: created, error: createError } = await admin
    .from("applications")
    .insert({
      applicant_id: profile.id,
      country: source.country || "singapore",
      visa_type: "SG_ARRIVAL_CARD",
      visa_package_id: source.visa_package_id,
      status: "draft",
    })
    .select("id")
    .single();
  if (createError || !created) {
    return { error: createError?.message || "Could not create application", status: 500 } as const;
  }

  const { data: reusableAnswers, error: answersError } = await admin
    .from("visa_application_answers")
    .select("field_name, value_text, value_json")
    .eq("application_id", sourceApplicationId)
    .in("field_name", [...REUSABLE_ANSWER_KEYS]);
  if (answersError) {
    await admin.from("applications").delete().eq("id", created.id);
    return { error: answersError.message, status: 500 } as const;
  }

  if (reusableAnswers?.length) {
    const now = new Date().toISOString();
    const { error: copyError } = await admin.from("visa_application_answers").insert(
      reusableAnswers.map((answer) => ({
        application_id: created.id,
        field_name: answer.field_name,
        value_text: answer.value_text,
        value_json: answer.value_json,
        updated_at: now,
      })),
    );
    if (copyError) {
      await admin.from("applications").delete().eq("id", created.id);
      return { error: copyError.message, status: 500 } as const;
    }
  }

  return { applicationId: created.id, status: 201 } as const;
}
