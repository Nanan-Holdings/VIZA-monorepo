import { createAdminClient } from "@/lib/supabase/admin";

const ARRIVAL_CARD_CONFIG = {
  SG_ARRIVAL_CARD: {
    country: "singapore",
    errorName: "SG Arrival Card",
  },
  MY_MDAC_ARRIVAL_CARD: {
    country: "malaysia",
    errorName: "Malaysia MDAC",
  },
  TH_TDAC_ARRIVAL_CARD: {
    country: "thailand",
    errorName: "Thailand TDAC",
  },
} as const;

const REUSABLE_ANSWER_KEYS = [
  "full_name",
  "full_name_zh",
  "full_name_en",
  "passport_number",
  "passport_expiry_date",
  "passport_issue_date",
  "passport_issuing_country",
  "sex",
  "gender",
  "date_of_birth",
  "nationality",
  "citizenship",
  "place_of_birth_country",
  "country_of_birth",
  "place_of_residence",
  "country_of_residence",
  "email_address",
  "confirm_email_address",
  "mobile_country_code",
  "mobile_number",
  "phone_number",
  "has_used_different_name_to_enter_singapore",
] as const;

type ArrivalCardVisaType = keyof typeof ARRIVAL_CARD_CONFIG;

function isArrivalCardVisaType(value: string | null): value is ArrivalCardVisaType {
  return Boolean(value && value in ARRIVAL_CARD_CONFIG);
}

export async function createNewArrivalCardApplication(userId: string, sourceApplicationId: string) {
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
  if (!isArrivalCardVisaType(source.visa_type)) {
    return { error: "This action is only available for arrival card applications", status: 400 } as const;
  }

  const config = ARRIVAL_CARD_CONFIG[source.visa_type];
  const { data: created, error: createError } = await admin
    .from("applications")
    .insert({
      applicant_id: profile.id,
      country: source.country || config.country,
      visa_type: source.visa_type,
      visa_package_id: source.visa_package_id,
      status: "draft",
    })
    .select("id")
    .single();
  if (createError || !created) {
    return { error: createError?.message || `Could not create ${config.errorName} application`, status: 500 } as const;
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

  return {
    applicationId: created.id,
    country: source.country || config.country,
    visaType: source.visa_type,
    status: 201,
  } as const;
}
