import { createAdminClient } from "@/lib/supabase/admin";
import { findOngoingApplicationByIdentity } from "@/lib/applications/ongoing-application";
import { hasSuccessfulArrivalCardSubmission } from "@/features/arrival-cards/application-lifecycle";

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
  PH_ETRAVEL_ARRIVAL_CARD: {
    country: "philippines",
    errorName: "Philippines eTravel",
  },
  PH_ETRAVEL_DEPARTURE_CARD: {
    country: "philippines",
    errorName: "Philippines eTravel Departure Card",
  },
  VN_PREARRIVAL_DECLARATION: {
    country: "vietnam",
    errorName: "Vietnam Pre-Arrival",
  },
  KR_E_ARRIVAL_CARD: {
    country: "south_korea",
    errorName: "Korea e-Arrival Card",
  },
} as const;

const REUSABLE_ANSWER_KEYS = [
  "full_name",
  "full_name_zh",
  "full_name_en",
  "first_name",
  "middle_name",
  "last_name",
  "suffix",
  "passport_number",
  "passport_expiry_date",
  "passport_issue_date",
  "passport_issuing_authority",
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
  "residence_address_line1",
  "residence_address_line2",
  "occupation",
  "email_address",
  "confirm_email_address",
  "mobile_country_code",
  "mobile_number",
  "phone_number",
  "has_used_different_name_to_enter_singapore",
] as const;

const KR_REUSABLE_ANSWER_KEYS = [
  "full_name",
  "full_name_zh",
  "full_name_en",
  "first_name",
  "middle_name",
  "last_name",
  "suffix",
  "passport_number",
  "passport_expiry_date",
  "passport_issue_date",
  "passport_issuing_authority",
  "passport_issuing_country",
  "sex",
  "gender",
  "date_of_birth",
  "nationality",
  "citizenship",
  "place_of_birth_country",
  "country_of_birth",
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
    .select("id, applicant_id, country, visa_type, visa_package_id, submission_result")
    .eq("id", sourceApplicationId)
    .maybeSingle();
  if (!source) return { error: "Application not found", status: 404 } as const;
  if (source.applicant_id !== profile.id) return { error: "Forbidden", status: 403 } as const;
  if (!isArrivalCardVisaType(source.visa_type)) {
    return { error: "This action is only available for arrival card applications", status: 400 } as const;
  }

  const config = ARRIVAL_CARD_CONFIG[source.visa_type];
  if (!hasSuccessfulArrivalCardSubmission({
    country: source.country || config.country,
    visaType: source.visa_type,
    submissionResult: source.submission_result,
  })) {
    return {
      error: "The previous arrival-card application must be successfully submitted before starting another.",
      status: 409,
    } as const;
  }

  const findExistingDraft = async () => {
    const { data, error } = await admin
      .from("applications")
      .select("id, country, visa_type, purpose, status, submission_result_status, result_status, submission_result")
      .eq("applicant_id", profile.id)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) return { error } as const;
    return {
      application: findOngoingApplicationByIdentity(
        (data ?? []).filter((application) => application.id !== source.id),
        source.country || config.country,
        source.visa_type,
      ),
    } as const;
  };

  const existingDraft = await findExistingDraft();
  if ("error" in existingDraft) {
    console.error(`[arrival-card] Could not look up an existing ${config.errorName} draft`, existingDraft.error);
    return { error: `Could not start another ${config.errorName} application`, status: 500 } as const;
  }
  if (existingDraft.application) {
    return {
      applicationId: existingDraft.application.id,
      country: source.country || config.country,
      visaType: source.visa_type,
      status: 200,
    } as const;
  }

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
  if (createError?.code === "23505") {
    const concurrentDraft = await findExistingDraft();
    if (!("error" in concurrentDraft) && concurrentDraft.application) {
      return {
        applicationId: concurrentDraft.application.id,
        country: source.country || config.country,
        visaType: source.visa_type,
        status: 200,
      } as const;
    }
  }
  if (createError || !created) {
    console.error(`[arrival-card] Could not create a new ${config.errorName} application`, createError);
    return { error: `Could not start another ${config.errorName} application`, status: 500 } as const;
  }

  const reusableAnswerKeys: readonly string[] = source.visa_type === "KR_E_ARRIVAL_CARD"
    ? KR_REUSABLE_ANSWER_KEYS
    : REUSABLE_ANSWER_KEYS;
  const reusableAnswerKeySet = new Set(reusableAnswerKeys);
  const { data: reusableAnswerRows, error: answersError } = await admin
    .from("visa_application_answers")
    .select("field_name, value_text, value_json")
    .eq("application_id", sourceApplicationId)
    .in(
      "field_name",
      [...reusableAnswerKeys],
    );
  if (answersError) {
    await admin.from("applications").delete().eq("id", created.id);
    return { error: answersError.message, status: 500 } as const;
  }

  const reusableAnswers = (reusableAnswerRows ?? []).filter(
    (answer) => typeof answer.field_name === "string" && reusableAnswerKeySet.has(answer.field_name),
  );
  if (reusableAnswers.length) {
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
